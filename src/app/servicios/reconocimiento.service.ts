import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, throwError, Subscription } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ResultadoReconocimientoVideo {
  sena_detectada: string;
  texto_traducido: string;
  confianza: number;
  confianza_raw?: number;
  confianza_preliminar?: number;
  consistencia?: number;
  mensaje: string;
  modo: string;
  num_frames_procesados: number;
  alternativas: Array<{
    sena: string;
    confianza: number;
  }>;
  timeline?: Array<{
    timestamp: number;
    sena_detectada: string;
    confianza: number;
    frame_num: number;
  }>;
  estadisticas?: {
    confianza_promedio: number;
    consistencia_temporal: number;
    frames_consistentes: number;
    duracion_secuencia: number;
  };
  timestamp: string;
}

export interface FrameProcesado {
  frame_base64: string;
  timestamp: number;
  landmarks?: any[];
}

export interface ConfiguracionReconocimiento {
  confianza_minima: number;
  max_frames: number;
  requerir_consistencia: boolean;
  min_frames_consistentes: number;
  uso_landmarks: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReconocimientoService {
  private apiUrl = `${environment.apiUrl}/reconocimiento-video`;

  private framesBuffer: FrameProcesado[] = [];
  private readonly MAX_FRAMES_BUFFER = 24;
  private readonly MIN_FRAMES_PROCESAMIENTO = 12;
  private readonly FRAMES_OPTIMOS = 16;

  private reconocimientoActivo = false;
  private procesando = false;
  private ultimoProcesamiento = 0;
  private readonly MIN_INTERVALO_PROCESAMIENTO = 800;
  private readonly TIMEOUT_RECONOCIMIENTO = 12000;

  private resultadoSubject = new Subject<ResultadoReconocimientoVideo>();
  public resultado$ = this.resultadoSubject.asObservable();

  private estadoSubject = new BehaviorSubject<boolean>(false);
  public estado$ = this.estadoSubject.asObservable();

  private confianzaSubject = new BehaviorSubject<number>(0);
  public confianza$ = this.confianzaSubject.asObservable();

  private categoriaIdActual: number | null = null;

  private configuracion: ConfiguracionReconocimiento = {
    confianza_minima: 0.55,
    max_frames: 16,
    requerir_consistencia: true,
    min_frames_consistentes: 10,
    uso_landmarks: true
  };

  private requestInFlight = false;
  private solicitudActual: Subscription | null = null;

  constructor(private http: HttpClient) {
    console.log('[ReconocimientoService] Inicializado');
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  establecerCategoria(categoriaId: number): void {
    this.categoriaIdActual = categoriaId;
    console.log(`[ReconocimientoService] Categoría establecida: ${categoriaId}`);
  }

  obtenerCategoriaActual(): number | null {
    return this.categoriaIdActual;
  }

  actualizarConfiguracion(config: Partial<ConfiguracionReconocimiento>): void {
    this.configuracion = { ...this.configuracion, ...config };
    console.log('[ReconocimientoService] Configuración actualizada:', this.configuracion);
  }

  procesarSecuenciaFrames(frames: FrameProcesado[], categoriaId?: number): Observable<any> {
    const categoriaAUsar = categoriaId || this.categoriaIdActual;

    const solicitud = {
      frames: frames,
      configuracion: this.configuracion,
      categoria_id: categoriaAUsar
    };

    return this.http.post<any>(
      `${this.apiUrl}/secuencia`,
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(this.TIMEOUT_RECONOCIMIENTO),
      retry(1),
      catchError(error => this.handleError('procesarSecuenciaFrames', error))
    );
  }

  private handleError(operation: string, error: any): Observable<never> {
    let errorMsg = 'Error desconocido';

    if (error.status === 422) {
      errorMsg = 'Error de validación';
    } else if (error.status === 500) {
      errorMsg = 'Error del servidor';
    } else if (error.status === 0) {
      errorMsg = 'Sin conexión';
    } else if (error.name === 'TimeoutError') {
      errorMsg = 'Timeout';
    } else {
      errorMsg = error.message || errorMsg;
    }

    console.error(`❌ ${operation}:`, errorMsg);

    return throwError(() => new Error(errorMsg));
  }

  obtenerEstado(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/estado`,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(5000),
      catchError(error => this.handleError('obtenerEstado', error))
    );
  }

  agregarFrame(frameBase64: string, landmarks?: any[]): void {
    if (!this.reconocimientoActivo || this.procesando || this.requestInFlight) {
      return;
    }

    const ahora = Date.now();

    if (frameBase64.length > 100000) {
      console.warn('[ReconocimientoService] Frame grande sin comprimir:', frameBase64.length, 'bytes base64');
    }

    const frameProcesado: FrameProcesado = {
      frame_base64: frameBase64,
      timestamp: ahora,
      landmarks: landmarks || []
    };

    this.framesBuffer.push(frameProcesado);

    if (this.framesBuffer.length > this.MAX_FRAMES_BUFFER) {
      this.framesBuffer.shift();
    }

    this.evaluarProcesamiento(ahora);
  }

  private evaluarProcesamiento(ahora: number): void {
    const framesSuficientes = this.framesBuffer.length >= this.MIN_FRAMES_PROCESAMIENTO;
    const intervaloValido = (ahora - this.ultimoProcesamiento) > this.MIN_INTERVALO_PROCESAMIENTO;
    const noEstaProcesando = !this.procesando && !this.requestInFlight;

    if (framesSuficientes && intervaloValido && noEstaProcesando) {
      this.procesarBuffer();
    }
  }

  private procesarBuffer(): void {
    if (this.framesBuffer.length < this.MIN_FRAMES_PROCESAMIENTO || this.procesando || this.requestInFlight) {
      return;
    }

    this.procesando = true;
    this.requestInFlight = true;
    this.ultimoProcesamiento = Date.now();

    const framesParaProcesar = this.seleccionarFramesOptimos();

    console.log('🔄 Procesando:', framesParaProcesar.length, 'frames');

    this.solicitudActual = this.procesarSecuenciaFrames(framesParaProcesar).subscribe({
      next: (response) => {
        this.procesando = false;
        this.requestInFlight = false;
        this.solicitudActual = null;

        if (!this.reconocimientoActivo) {
          return;
        }

        if (response.exito && response.datos) {
          const datos = response.datos;

          let confianza = 0;

          if (datos.confianza !== undefined && datos.confianza !== null && !isNaN(datos.confianza)) {
            confianza = Number(datos.confianza);
          } else if (datos.confianza_preliminar !== undefined && !isNaN(datos.confianza_preliminar)) {
            confianza = Number(datos.confianza_preliminar);
          } else if (datos.confianza_raw !== undefined && !isNaN(datos.confianza_raw)) {
            confianza = Number(datos.confianza_raw);
          } else if (datos.porcentaje !== undefined && !isNaN(datos.porcentaje)) {
            confianza = Number(datos.porcentaje) / 100;
          } else {
            console.warn('⚠️ No se encontró confianza válida en la respuesta:', Object.keys(datos));
            confianza = 0;
          }

          if (isNaN(confianza) || !isFinite(confianza)) {
            console.error('❌ Confianza inválida (NaN/Inf):', confianza);
            confianza = 0;
          } else if (confianza > 1) {
            confianza = confianza / 100;
          }

          this.confianzaSubject.next(confianza);

          const resultadoCompleto: ResultadoReconocimientoVideo = {
            ...datos,
            confianza: confianza,
            confianza_raw: datos.confianza_raw ?? confianza,
            confianza_preliminar: datos.confianza_preliminar ?? confianza
          };

          this.resultadoSubject.next(resultadoCompleto);
          this.limpiarBufferParcial();
        } else {
          console.error('❌ Respuesta sin éxito:', response.mensaje, response.errores);
          this.confianzaSubject.next(0);
          this.emitirResultadoError(response.mensaje || 'Error en reconocimiento');
        }
      },
      error: (error) => {
        this.procesando = false;
        this.requestInFlight = false;
        this.solicitudActual = null;

        if (!this.reconocimientoActivo) {
          return;
        }

        console.error('❌ Error HTTP:', error.status, error.message);
        this.confianzaSubject.next(0);
        this.emitirResultadoError(error.message);
        this.limpiarBufferParcial();
      }
    });
  }

  private seleccionarFramesOptimos(): FrameProcesado[] {
    const totalFrames = this.framesBuffer.length;

    if (totalFrames <= this.FRAMES_OPTIMOS) {
      return [...this.framesBuffer];
    }

    const indices: number[] = [];
    const step = (totalFrames - 1) / (this.FRAMES_OPTIMOS - 1);

    for (let i = 0; i < this.FRAMES_OPTIMOS; i++) {
      const index = Math.round(i * step);
      indices.push(Math.min(index, totalFrames - 1));
    }

    return indices.map(i => this.framesBuffer[i]);
  }

  private emitirResultadoError(mensaje: string): void {
    const resultadoError: ResultadoReconocimientoVideo = {
      sena_detectada: '',
      texto_traducido: '',
      confianza: 0,
      consistencia: 0,
      mensaje: mensaje,
      modo: 'video_secuencia',
      num_frames_procesados: 0,
      alternativas: [],
      timestamp: new Date().toISOString(),
      estadisticas: {
        confianza_promedio: 0,
        consistencia_temporal: 0,
        frames_consistentes: 0,
        duracion_secuencia: 0
      }
    };

    this.confianzaSubject.next(0);
    this.resultadoSubject.next(resultadoError);
  }

  private limpiarBufferParcial(): void {
    if (this.framesBuffer.length > 6) {
      this.framesBuffer = this.framesBuffer.slice(-6);
    }
  }

  iniciarReconocimiento(): void {
    this.reconocimientoActivo = true;
    this.framesBuffer = [];
    this.procesando = false;
    this.requestInFlight = false;
    this.ultimoProcesamiento = 0;
    this.estadoSubject.next(true);
    this.confianzaSubject.next(0);

    console.log('🎬 Reconocimiento iniciado');
  }

  detenerReconocimiento(): void {
    this.reconocimientoActivo = false;
    this.framesBuffer = [];
    this.procesando = false;
    this.requestInFlight = false;
    this.estadoSubject.next(false);

    if (this.solicitudActual) {
      this.solicitudActual.unsubscribe();
      this.solicitudActual = null;
    }

    console.log('⏹️ Reconocimiento detenido');
  }

  estaActivo(): boolean {
    return this.reconocimientoActivo;
  }

  estaProcesando(): boolean {
    return this.procesando || this.requestInFlight;
  }

  probarConexion(): Observable<any> {
    return this.obtenerEstado();
  }

  obtenerEstadoBuffer(): {
    total: number;
    optimo: boolean;
    suficiente: boolean;
    porcentajeLleno: number;
  } {
    return {
      total: this.framesBuffer.length,
      optimo: this.framesBuffer.length >= this.FRAMES_OPTIMOS,
      suficiente: this.framesBuffer.length >= this.MIN_FRAMES_PROCESAMIENTO,
      porcentajeLleno: (this.framesBuffer.length / this.MAX_FRAMES_BUFFER) * 100
    };
  }

  obtenerUltimaConfianza(): number {
    return this.confianzaSubject.value;
  }

  verificarEstadoConexion(): { activo: boolean; procesando: boolean; confianza: number; buffer: number } {
    return {
      activo: this.reconocimientoActivo,
      procesando: this.procesando || this.requestInFlight,
      confianza: this.confianzaSubject.value,
      buffer: this.framesBuffer.length
    };
  }

  limpiarBuffer(): void {
    this.framesBuffer = [];
    console.log('Buffer limpiado');
  }
}
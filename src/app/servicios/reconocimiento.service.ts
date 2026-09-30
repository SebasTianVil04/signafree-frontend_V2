import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, throwError, Subscription } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
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

interface PrediccionBuffer {
  sena: string;
  confianza: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReconocimientoService {
  private apiUrl = `${environment.apiUrl}/reconocimiento-video`;

  private framesBuffer: FrameProcesado[] = [];
  private readonly MAX_FRAMES_BUFFER = 20;
  private readonly MIN_FRAMES_PROCESAMIENTO = 8;
  private readonly FRAMES_OPTIMOS = 12;
  private readonly FRAMES_OVERLAP = 4;
  private readonly VENTANA_MAX_FRAME_MS = 1500;

  private reconocimientoActivo = false;
  private procesando = false;
  private ultimoProcesamiento = 0;
  private readonly MIN_INTERVALO_PROCESAMIENTO = 250;
  private readonly TIMEOUT_RECONOCIMIENTO = 6000;

  private readonly TAMANO_VENTANA_VOTING_ESTATICA = 1;
  private readonly MIN_CONSENSO_ESTATICA = 1;
  private readonly TAMANO_VENTANA_VOTING_DINAMICA = 3;
  private readonly MIN_CONSENSO_DINAMICA = 2;

  private historialPredicciones: PrediccionBuffer[] = [];

  private readonly MODO_RAPIDO = true;

  private ultimaSenaCruda: string = '';
  private tipoSenaActual: string = '';

  private categoriaActualId: number | null = null;
  private senaEsperadaActual: string | null = null;

  // null = automático (el backend usa los modelos activos / ensemble)
  private modeloActualId: number | null = null;

  private resultadoSubject = new Subject<ResultadoReconocimientoVideo>();
  public resultado$ = this.resultadoSubject.asObservable();

  private estadoSubject = new BehaviorSubject<boolean>(false);
  public estado$ = this.estadoSubject.asObservable();

  private confianzaSubject = new BehaviorSubject<number>(0);
  public confianza$ = this.confianzaSubject.asObservable();

  private configuracion: ConfiguracionReconocimiento = {
    confianza_minima: 0.40,
    max_frames: 16,
    requerir_consistencia: false,
    min_frames_consistentes: 8,
    uso_landmarks: true
  };

  private requestInFlight = false;
  private solicitudActual: Subscription | null = null;

  constructor(private http: HttpClient) { }

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
    this.categoriaActualId = categoriaId;
  }

  obtenerCategoriaActual(): number | null {
    return this.categoriaActualId;
  }

  /**
   * Fija el modelo con el que se reconocerá. null = automático.
   * Al cambiar de modelo se descarta todo lo acumulado del modelo anterior.
   */
  establecerModelo(modeloId: number | null): void {
    if (this.modeloActualId === modeloId) {
      return;
    }

    this.modeloActualId = modeloId;
    this.limpiarBuffer();
    this.tipoSenaActual = '';
  }

  obtenerModeloActual(): number | null {
    return this.modeloActualId;
  }

  establecerSenaEsperada(sena: string | null): void {
    this.senaEsperadaActual = sena ? sena.trim() : null;
  }

  establecerTipoSenaInicial(tipo: string | null): void {
    this.tipoSenaActual = (tipo || '').toUpperCase();
  }

  actualizarConfiguracion(config: Partial<ConfiguracionReconocimiento>): void {
    this.configuracion = { ...this.configuracion, ...config };
  }

  procesarSecuenciaFrames(frames: FrameProcesado[], categoriaId?: number): Observable<any> {
    const catId = categoriaId ?? this.categoriaActualId;

    const solicitud: any = {
      frames: frames,
      configuracion: this.configuracion
    };

    if (catId !== null && catId !== undefined) {
      solicitud.categoria_id = catId;
    }

    if (this.modeloActualId !== null) {
      solicitud.modelo_id = this.modeloActualId;
    }

    if (this.senaEsperadaActual) {
      solicitud.sena_esperada = this.senaEsperadaActual;
    }

    return this.http.post<any>(
      `${this.apiUrl}/secuencia`,
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(this.TIMEOUT_RECONOCIMIENTO),
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

    console.warn(`[RECONOCIMIENTO] ${operation}:`, errorMsg);
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
    if (!this.reconocimientoActivo) {
      return;
    }

    const ahora = Date.now();

    const frameProcesado: FrameProcesado = {
      frame_base64: frameBase64,
      timestamp: ahora,
      landmarks: landmarks || []
    };

    this.framesBuffer.push(frameProcesado);

    if (this.framesBuffer.length > this.MAX_FRAMES_BUFFER) {
      this.framesBuffer.shift();
    }

    if (!this.procesando && !this.requestInFlight) {
      this.evaluarProcesamiento(ahora);
    }
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
    const catId = this.categoriaActualId;
    const modeloAlEnviar = this.modeloActualId;

    this.solicitudActual = this.procesarSecuenciaFrames(framesParaProcesar, catId ?? undefined).subscribe({
      next: (response) => {
        this.procesando = false;
        this.requestInFlight = false;
        this.solicitudActual = null;

        if (!this.reconocimientoActivo) {
          return;
        }

        // Si el usuario cambió de modelo mientras la petición estaba en vuelo,
        // la respuesta pertenece al modelo anterior y se descarta.
        if (modeloAlEnviar !== this.modeloActualId) {
          return;
        }

        if (response.exito && response.datos) {
          const datos = response.datos;

          let confianza = 0;

          if (datos.confianza !== undefined && datos.confianza !== null && !isNaN(datos.confianza)) {
            confianza = Number(datos.confianza);
          } else if (datos.porcentaje !== undefined && !isNaN(datos.porcentaje)) {
            confianza = Number(datos.porcentaje) / 100;
          }

          if (isNaN(confianza) || !isFinite(confianza)) {
            confianza = 0;
          } else if (confianza > 1) {
            confianza = confianza / 100;
          }

          const tipoRespuesta = ((datos.modo || '') as string).toUpperCase();
          if (tipoRespuesta === 'ESTATICA' || tipoRespuesta === 'DINAMICA') {
            this.tipoSenaActual = tipoRespuesta;
          }

          const senaCruda = (datos.sena_detectada || '').trim();

          const huboCambioDeSena = !!senaCruda &&
            !!this.ultimaSenaCruda &&
            senaCruda !== this.ultimaSenaCruda;

          if (senaCruda) {
            this.ultimaSenaCruda = senaCruda;
          }

          if (huboCambioDeSena) {
            this.historialPredicciones = [];
          }

          const resultadoConsenso = this.aplicarConsenso(
            { sena: senaCruda, confianza, timestamp: Date.now() },
            tipoRespuesta
          );

          if (!resultadoConsenso) {
            if (huboCambioDeSena) {
              this.framesBuffer = [];
            } else {
              this.limpiarBufferParcial();
            }
            this.evaluarProcesamiento(Date.now());
            return;
          }

          this.confianzaSubject.next(resultadoConsenso.confianza);

          const resultadoCompleto: ResultadoReconocimientoVideo = {
            ...datos,
            sena_detectada: resultadoConsenso.sena,
            texto_traducido: resultadoConsenso.sena,
            confianza: resultadoConsenso.confianza,
            confianza_raw: resultadoConsenso.confianza
          };

          this.resultadoSubject.next(resultadoCompleto);

          this.historialPredicciones = [];

          if (huboCambioDeSena) {
            this.framesBuffer = [];
          } else {
            this.limpiarBufferParcial();
          }
          this.evaluarProcesamiento(Date.now());
        } else {
          this.confianzaSubject.next(0);
          this.emitirResultadoError(response.mensaje || 'Error en reconocimiento');
          this.limpiarBufferParcial();
          this.evaluarProcesamiento(Date.now());
        }
      },
      error: (error) => {
        this.procesando = false;
        this.requestInFlight = false;
        this.solicitudActual = null;

        if (!this.reconocimientoActivo) {
          return;
        }

        this.confianzaSubject.next(0);
        this.emitirResultadoError(error.message);
        this.limpiarBufferParcial();
        this.evaluarProcesamiento(Date.now());
      }
    });
  }

  private aplicarConsenso(
    nuevaPrediccion: PrediccionBuffer,
    tipoSena: string
  ): { sena: string; confianza: number } | null {
    if (!nuevaPrediccion.sena || nuevaPrediccion.confianza === 0) {
      return null;
    }

    const tipo = (tipoSena || this.tipoSenaActual || '').toUpperCase();
    const esEstatica = tipo === 'ESTATICA';

    if (this.MODO_RAPIDO && esEstatica) {
      return { sena: nuevaPrediccion.sena, confianza: nuevaPrediccion.confianza };
    }

    this.historialPredicciones.push(nuevaPrediccion);

    const tamanoVentana = esEstatica
      ? this.TAMANO_VENTANA_VOTING_ESTATICA
      : this.TAMANO_VENTANA_VOTING_DINAMICA;

    const minConsenso = esEstatica
      ? this.MIN_CONSENSO_ESTATICA
      : this.MIN_CONSENSO_DINAMICA;

    if (this.historialPredicciones.length > tamanoVentana) {
      this.historialPredicciones.shift();
    }

    const votos: { [sena: string]: number } = {};
    const pesos: { [sena: string]: number } = {};

    for (const p of this.historialPredicciones) {
      votos[p.sena] = (votos[p.sena] || 0) + 1;
      pesos[p.sena] = (pesos[p.sena] || 0) + p.confianza;
    }

    let senaGanadora = '';
    let maxPeso = 0;
    for (const sena in pesos) {
      if (pesos[sena] > maxPeso) {
        maxPeso = pesos[sena];
        senaGanadora = sena;
      }
    }

    if (!senaGanadora || votos[senaGanadora] < minConsenso) {
      return null;
    }

    const confianzaPromedio = pesos[senaGanadora] / votos[senaGanadora];

    return {
      sena: senaGanadora,
      confianza: confianzaPromedio
    };
  }

  private seleccionarFramesOptimos(): FrameProcesado[] {
    const ahora = Date.now();
    const framesFrescos = this.framesBuffer.filter(f => (ahora - f.timestamp) <= this.VENTANA_MAX_FRAME_MS);
    const fuente = framesFrescos.length >= this.MIN_FRAMES_PROCESAMIENTO
      ? framesFrescos
      : this.framesBuffer;

    const totalFrames = fuente.length;

    if (totalFrames <= this.FRAMES_OPTIMOS) {
      return [...fuente];
    }

    const indices: number[] = [];
    const step = (totalFrames - 1) / (this.FRAMES_OPTIMOS - 1);

    for (let i = 0; i < this.FRAMES_OPTIMOS; i++) {
      const index = Math.round(i * step);
      indices.push(Math.min(index, totalFrames - 1));
    }

    return indices.map(i => fuente[i]);
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
    if (this.framesBuffer.length > this.FRAMES_OVERLAP) {
      this.framesBuffer = this.framesBuffer.slice(-this.FRAMES_OVERLAP);
    } else {
      this.framesBuffer = [];
    }
  }

  iniciarReconocimiento(): void {
    this.reconocimientoActivo = true;
    this.framesBuffer = [];
    this.historialPredicciones = [];
    this.ultimaSenaCruda = '';
    this.procesando = false;
    this.requestInFlight = false;
    this.ultimoProcesamiento = 0;
    this.estadoSubject.next(true);
    this.confianzaSubject.next(0);
  }

  detenerReconocimiento(): void {
    this.reconocimientoActivo = false;
    this.framesBuffer = [];
    this.historialPredicciones = [];
    this.ultimaSenaCruda = '';
    this.procesando = false;
    this.requestInFlight = false;
    this.estadoSubject.next(false);

    if (this.solicitudActual) {
      this.solicitudActual.unsubscribe();
      this.solicitudActual = null;
    }
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
    this.historialPredicciones = [];
    this.ultimaSenaCruda = '';
  }
}
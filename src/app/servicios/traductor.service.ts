import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RespuestaAPI {
  exito: boolean;
  mensaje: string;
  datos?: any;
  errores?: string[];
}

export interface ModeloActivoTraductor {
  id: number;
  nombre: string;
  accuracy: number;
  num_clases: number;
  arquitectura?: string | null;
  tipo?: string | null;
  fecha_activacion?: string | null;
}

export interface ConfiguracionTraduccion {
  confianza_minima?: number;
  activarAudio?: boolean;
  velocidadReproduccion?: number;
  usar_multiples_modelos?: boolean;
  categoria_id?: number;
  modelo_id?: number | null;
}

const PREFIJO_JPEG = 'data:image/jpeg;base64,';

@Injectable({
  providedIn: 'root'
})
export class TraductorService {
  private readonly apiUrl = `${environment.apiUrl}/traductor`;
  private readonly reconocimientoUrl = `${environment.apiUrl}/reconocimiento-video`;

  constructor(private http: HttpClient) { }

  traducirVozASenas(texto: string): Observable<RespuestaAPI> {
    if (!texto.trim()) {
      return throwError(() => new Error('Texto vacío'));
    }

    return this.http.post<RespuestaAPI>(`${this.apiUrl}/voz-a-senas`, { texto }).pipe(
      timeout(10000),
      retry(1),
      catchError(error => this.handleError(error))
    );
  }

  traducirSenasATexto(
    imagenBase64: string,
    configuracion: ConfiguracionTraduccion = {}
  ): Observable<RespuestaAPI> {
    if (!imagenBase64) {
      return throwError(() => new Error('Imagen vacía'));
    }

    return this.http.post<RespuestaAPI>(`${this.apiUrl}/senas-a-texto`, {
      imagen_base64: `${PREFIJO_JPEG}${imagenBase64}`,
      configuracion: this.armarConfiguracion(configuracion)
    }).pipe(
      timeout(15000),
      retry(1),
      catchError(error => this.handleError(error))
    );
  }

  traducirSenasATextoVideo(
    framesBase64: string[],
    framesLandmarks: any[][] = [],
    configuracion: ConfiguracionTraduccion = {}
  ): Observable<RespuestaAPI> {
    if (!framesBase64?.length) {
      return throwError(() => new Error('Frames vacíos'));
    }

    return this.http.post<RespuestaAPI>(`${this.apiUrl}/senas-a-texto`, {
      frames_base64: framesBase64.map(frame => `${PREFIJO_JPEG}${frame}`),
      frames_landmarks: framesLandmarks,
      configuracion: this.armarConfiguracion(configuracion)
    }).pipe(
      timeout(20000),
      retry(1),
      catchError(error => this.handleError(error))
    );
  }

  traducirSenasATextoConFrames(
    frames: string[],
    landmarks: any[][] = [],
    configuracion: ConfiguracionTraduccion = {}
  ): Observable<RespuestaAPI> {
    return this.traducirSenasATextoVideo(frames, landmarks, configuracion);
  }

  /**
   * Lista los modelos activos disponibles para traducir.
   * Respuesta: { exito, datos: { total, es_ensemble, modelos: ModeloActivoTraductor[] } }
   */
  obtenerModelosActivos(): Observable<RespuestaAPI> {
    return this.http.get<RespuestaAPI>(`${this.reconocimientoUrl}/modelos-activos`).pipe(
      timeout(5000),
      catchError(error => this.handleError(error))
    );
  }

  probarTodosModelos(framesBase64: string[]): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(`${this.apiUrl}/probar-todos-modelos`, { frames_base64: framesBase64 }).pipe(
      timeout(15000),
      catchError(error => this.handleError(error))
    );
  }

  limpiarCacheReconocedor(): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(`${this.apiUrl}/limpiar-cache`, {}).pipe(
      timeout(5000),
      catchError(error => this.handleError(error))
    );
  }

  obtenerDiccionarioSenas(): Observable<RespuestaAPI> {
    return this.http.get<RespuestaAPI>(`${this.apiUrl}/diccionario`).pipe(
      timeout(5000),
      catchError(error => this.handleError(error))
    );
  }

  obtenerEstadoReconocedor(): Observable<any> {
    return this.http.get<any>(`${this.reconocimientoUrl}/estado`).pipe(
      timeout(5000),
      catchError(error => this.handleError(error))
    );
  }

  validarSoporteNavegador(): { voz: boolean; sintesis: boolean; camara: boolean } {
    const w = window as any;

    return {
      voz: !!(w.SpeechRecognition || w.webkitSpeechRecognition),
      sintesis: !!w.speechSynthesis,
      camara: !!navigator.mediaDevices?.getUserMedia
    };
  }

  sintetizarVoz(texto: string, config: { velocidad?: number; tono?: number } = {}): void {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-PE';
    utterance.rate = config.velocidad || 1.0;
    utterance.pitch = config.tono || 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  detenerSintesisVoz(): void {
    window.speechSynthesis?.cancel();
  }

  private armarConfiguracion(configuracion: ConfiguracionTraduccion) {
    return {
      confianza_minima: configuracion.confianza_minima || 0.25,
      usar_multiples_modelos: configuracion.usar_multiples_modelos !== false,
      categoria_id: configuracion.categoria_id,
      modelo_id: configuracion.modelo_id ?? undefined
    };
  }

  private handleError(error: any): Observable<never> {
    const detalle = typeof error?.error?.detail === 'string' ? error.error.detail : null;
    let mensaje: string;

    if (error?.name === 'TimeoutError') {
      mensaje = 'Tiempo de espera agotado';
    } else if (error?.status === 0) {
      mensaje = 'Sin conexión al servidor';
    } else if (error?.status === 500) {
      mensaje = 'Error del servidor';
    } else if (error?.status === 422) {
      mensaje = 'Error de validación en los datos';
    } else {
      mensaje = detalle || error?.message || 'Error desconocido';
    }

    return throwError(() => new Error(mensaje));
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RespuestaAPI {
  exito: boolean;
  mensaje: string;
  datos?: any;
  errores?: string[];
}

export interface ConfiguracionTraduccion {
  confianza_minima?: number;
  activarAudio?: boolean;
  velocidadReproduccion?: number;
  usar_multiples_modelos?: boolean;
  categoria_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TraductorService {
  private apiUrl = `${environment.apiUrl}/traductor`;

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

  traducirVozASenas(texto: string): Observable<RespuestaAPI> {
    if (!texto.trim()) {
      return throwError(() => new Error('Texto vacío'));
    }

    const solicitud = { texto };

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/voz-a-senas`,
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(10000),
      retry(1),
      catchError(error => this.handleError('traducirVozASenas', error))
    );
  }

  traducirSenasATexto(
    imagenBase64: string,
    configuracion: ConfiguracionTraduccion = {}
  ): Observable<RespuestaAPI> {
    if (!imagenBase64) {
      return throwError(() => new Error('Imagen vacía'));
    }

    const solicitud = {
      imagen_base64: `data:image/jpeg;base64,${imagenBase64}`,
      configuracion: {
        confianza_minima: configuracion.confianza_minima || 0.25,
        usar_multiples_modelos: configuracion.usar_multiples_modelos !== false,
        categoria_id: configuracion.categoria_id
      }
    };

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/senas-a-texto`,
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      retry(1),
      catchError(error => this.handleError('traducirSenasATexto', error))
    );
  }

  traducirSenasATextoVideo(
    framesBase64: string[],
    configuracion: ConfiguracionTraduccion = {}
  ): Observable<RespuestaAPI> {
    if (!framesBase64 || framesBase64.length === 0) {
      return throwError(() => new Error('Frames vacíos'));
    }

    const solicitud = {
      frames_base64: framesBase64.map(frame => `data:image/jpeg;base64,${frame}`),
      configuracion: {
        confianza_minima: configuracion.confianza_minima || 0.25,
        usar_multiples_modelos: configuracion.usar_multiples_modelos !== false,
        categoria_id: configuracion.categoria_id
      }
    };

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/senas-a-texto`,
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(20000),
      retry(1),
      catchError(error => this.handleError('traducirSenasATextoVideo', error))
    );
  }

  obtenerModelosActivos(): Observable<RespuestaAPI> {
    return this.http.get<RespuestaAPI>(
      `${this.apiUrl}/modelos-activos`,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(5000),
      catchError(error => this.handleError('obtenerModelosActivos', error))
    );
  }


  probarTodosModelos(framesBase64: string[]): Observable<RespuestaAPI> {
    const solicitud = { frames_base64: framesBase64 };

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/probar-todos-modelos`,
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(15000),
      catchError(error => this.handleError('probarTodosModelos', error))
    );
  }

  limpiarCacheReconocedor(): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/limpiar-cache`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      timeout(5000),
      catchError(error => this.handleError('limpiarCacheReconocedor', error))
    );
  }

  obtenerDiccionarioSenas(): Observable<RespuestaAPI> {
    return this.http.get<RespuestaAPI>(
      `${this.apiUrl}/diccionario`,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(5000),
      catchError(error => this.handleError('obtenerDiccionarioSenas', error))
    );
  }

  private handleError(operation: string, error: any): Observable<never> {
    let errorMsg = 'Error desconocido';

    if (error.status === 422) {
      errorMsg = 'Error de validación en los datos';
    } else if (error.status === 500) {
      errorMsg = 'Error del servidor';
    } else if (error.status === 0) {
      errorMsg = 'Sin conexión al servidor';
    } else if (error.name === 'TimeoutError') {
      errorMsg = 'Tiempo de espera agotado';
    } else if (error.error?.detail) {
      errorMsg = error.error.detail;
    } else {
      errorMsg = error.message || errorMsg;
    }

    return throwError(() => new Error(errorMsg));
  }

  validarSoporteNavegador(): { voz: boolean; sintesis: boolean; camara: boolean } {
    const w = window as any;

    return {
      voz: !!(w.SpeechRecognition || w.webkitSpeechRecognition),
      sintesis: !!w.speechSynthesis,
      camara: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  }

  sintetizarVoz(texto: string, config: { velocidad?: number; tono?: number } = {}): void {
    if (!window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-PE';
    utterance.rate = config.velocidad || 1.0;
    utterance.pitch = config.tono || 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  detenerSintesisVoz(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  obtenerEstadoReconocedor(): Observable<any> {
    return this.http.get<any>(
      `${environment.apiUrl}/reconocimiento-video/estado`,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(5000),
      catchError(error => this.handleError('obtenerEstadoReconocedor', error))
    );
  }

  traducirSenasATextoConFrames(
    frames: string[],
    configuracion: ConfiguracionTraduccion = {}
  ): Observable<RespuestaAPI> {
    if (!frames || frames.length === 0) {
      return throwError(() => new Error('Frames vacíos'));
    }

    const solicitud = {
      frames_base64: frames.map(frame => `data:image/jpeg;base64,${frame}`),
      configuracion: {
        confianza_minima: configuracion.confianza_minima || 0.25,
        usar_multiples_modelos: configuracion.usar_multiples_modelos !== false,
        categoria_id: configuracion.categoria_id
      }
    };

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/senas-a-texto`,  // ✅ URL corregida
      solicitud,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(20000),
      retry(1),
      catchError(error => this.handleError('traducirSenasATextoConFrames', error))
    );
  }
}
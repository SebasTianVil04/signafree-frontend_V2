import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos?: T;
  errores?: string[];
}

export interface DatosVideoCapturado {
  id: number;
  sena: string;
  duracion: number;
  frames_extraidos: number;
  calidad_promedio: number;
  aprobado: boolean;
  fps: number;
  estado: string;
}

export interface EstadisticasCaptura {
  total_videos: number;
  videos_aprobados: number;
  videos_pendientes: number;
  tasa_aprobacion: number;
  promedio_frames: number;
  senas_unicas: number;
  usuario: {
    id: number;
    nombre: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CapturaService {
  private apiUrl = `${environment.apiUrl}/captura-entrenamiento`;
  private readonly TIMEOUT_SUBIDA_MS = 60000;
  private readonly TIMEOUT_MS = 10000;
  private readonly MAX_RETRIES = 1;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(operacion: string, error: unknown): Observable<never> {
    let mensaje = `Error en ${operacion}`;

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        mensaje = 'Sin conexión con el servidor';
      } else if (error.error?.detail) {
        mensaje = error.error.detail;
      } else if (error.error?.mensaje) {
        mensaje = error.error.mensaje;
      } else if (error.message) {
        mensaje = error.message;
      }
    } else if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        mensaje = 'Tiempo de espera agotado al procesar el video';
      } else {
        mensaje = error.message;
      }
    }

    return throwError(() => new Error(mensaje));
  }

  capturarVideoArchivo(formData: FormData): Observable<RespuestaAPI<DatosVideoCapturado>> {
    return this.http.post<RespuestaAPI<DatosVideoCapturado>>(
      `${this.apiUrl}/capturar-video-archivo`,
      formData,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(this.TIMEOUT_SUBIDA_MS),
      catchError(error => this.handleError('capturarVideoArchivo', error))
    );
  }

  obtenerEstadisticasCaptura(): Observable<RespuestaAPI<EstadisticasCaptura>> {
    return this.http.get<RespuestaAPI<EstadisticasCaptura>>(
      `${this.apiUrl}/estadisticas-captura`,
      { headers: this.getHeaders() }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(error => this.handleError('obtenerEstadisticasCaptura', error))
    );
  }
}
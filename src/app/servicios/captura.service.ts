import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
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
  mano_detectada?: string | null;
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

export interface ConteoSena {
  total: number;
  aprobados: number;
  pendientes: number;
}

export class ErrorCaptura extends Error {
  constructor(
    mensaje: string,
    public readonly status: number | null = null,
    public readonly esTimeout: boolean = false
  ) {
    super(mensaje);
    this.name = 'ErrorCaptura';
  }
}

@Injectable({
  providedIn: 'root'
})
export class CapturaService {
  private apiUrl = `${environment.apiUrl}/captura-entrenamiento`;
  private readonly TIMEOUT_SUBIDA_MS = 120000;
  private readonly TIMEOUT_MS = 10000;
  private readonly MAX_RETRIES = 1;

  constructor(private http: HttpClient) { }

  private handleError(operacion: string, error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      let mensaje = `Error en ${operacion}`;

      if (error.status === 0) {
        mensaje = 'Sin conexión con el servidor';
      } else if (typeof error.error?.detail === 'string') {
        mensaje = error.error.detail;
      } else if (error.error?.mensaje) {
        mensaje = error.error.mensaje;
      } else if (error.message) {
        mensaje = error.message;
      }

      return throwError(() => new ErrorCaptura(mensaje, error.status));
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      return throwError(() => new ErrorCaptura(
        'El servidor tardó demasiado en procesar el video. Se verificará si se guardó.',
        null,
        true
      ));
    }

    const mensaje = error instanceof Error ? error.message : `Error en ${operacion}`;
    return throwError(() => new ErrorCaptura(mensaje));
  }

  capturarVideoArchivo(formData: FormData): Observable<RespuestaAPI<DatosVideoCapturado>> {
    return this.http.post<RespuestaAPI<DatosVideoCapturado>>(
      `${this.apiUrl}/capturar-video-archivo`,
      formData
    ).pipe(
      timeout(this.TIMEOUT_SUBIDA_MS),
      catchError(error => this.handleError('capturarVideoArchivo', error))
    );
  }

  obtenerConteoSena(categoriaId: number, sena: string): Observable<RespuestaAPI<ConteoSena>> {
    const params = new HttpParams()
      .set('categoria_id', categoriaId.toString())
      .set('sena', sena);

    return this.http.get<RespuestaAPI<ConteoSena>>(
      `${this.apiUrl}/conteo-sena`,
      { params }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(error => this.handleError('obtenerConteoSena', error))
    );
  }

  obtenerEstadisticasCaptura(): Observable<RespuestaAPI<EstadisticasCaptura>> {
    return this.http.get<RespuestaAPI<EstadisticasCaptura>>(
      `${this.apiUrl}/estadisticas-captura`
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(error => this.handleError('obtenerEstadisticasCaptura', error))
    );
  }
}
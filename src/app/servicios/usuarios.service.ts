import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NotificacionesService } from './notificaciones.service';
import { Usuario } from '../modelos/usuario.model';

export interface ActualizacionPerfilRequest {
  nombre_usuario?: string;
}

export interface CambiarPasswordRequest {
  password_actual: string;
  password_nueva: string;
}

export interface ProgresoUsuario {
  nivel_actual: number;
  lecciones_completadas: number;
  total_lecciones: number;
  puntos_totales: number;
  porcentaje_progreso: number;
  ultima_leccion: string | null;
  proxima_leccion: string | null;
}

export interface RespuestaAPI {
  exito: boolean;
  mensaje: string;
  datos?: any;
}

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  constructor(
    private http: HttpClient,
    private notificaciones: NotificacionesService
  ) { }

  obtenerPerfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/perfil`).pipe(
      catchError(error => this.fallar(error))
    );
  }

  actualizarPerfil(datos: ActualizacionPerfilRequest): Observable<RespuestaAPI> {
    return this.http.put<RespuestaAPI>(`${this.apiUrl}/perfil`, datos).pipe(
      catchError(error => this.fallar(error))
    );
  }

  cambiarPassword(datos: CambiarPasswordRequest): Observable<RespuestaAPI> {
    return this.http.put<RespuestaAPI>(`${this.apiUrl}/cambiar-password`, datos).pipe(
      catchError(error => this.fallar(error))
    );
  }

  obtenerProgreso(): Observable<ProgresoUsuario> {
    return this.http.get<ProgresoUsuario>(`${this.apiUrl}/mi-progreso`).pipe(
      catchError(error => this.fallar(error))
    );
  }

  obtenerMisLecciones(
    nivel?: number,
    soloCompletadas: boolean = false,
    pagina: number = 1,
    porPagina: number = 10
  ): Observable<any> {
    let params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('por_pagina', porPagina.toString())
      .set('solo_completadas', soloCompletadas.toString());

    if (nivel) {
      params = params.set('nivel', nivel.toString());
    }

    return this.http.get(`${this.apiUrl}/mis-lecciones`, { params }).pipe(
      catchError(error => this.fallar(error))
    );
  }

  private fallar(error: any): Observable<never> {
    this.notificaciones.mostrarError(this.obtenerMensajeError(error));
    return throwError(() => error);
  }

  private obtenerMensajeError(error: any): string {
    const detalle = typeof error?.error?.detail === 'string' ? error.error.detail : null;
    const mensajeServidor = detalle || error?.error?.mensaje;

    switch (error?.status) {
      case 0:
        return 'Sin conexión a internet. Verifica tu conexión';
      case 500:
        return 'Error del servidor. Por favor intenta más tarde';
      case 400:
        return mensajeServidor || 'Los datos proporcionados no son válidos';
      case 401:
        return mensajeServidor || 'No tienes autorización. Por favor inicia sesión nuevamente';
      case 403:
        return mensajeServidor || 'No tienes permisos para realizar esta acción';
      case 404:
        return mensajeServidor || 'El recurso solicitado no fue encontrado';
      case 422:
        return mensajeServidor || 'Error de validación en los datos enviados';
      default:
        return mensajeServidor || error?.message || 'Error inesperado';
    }
  }
}
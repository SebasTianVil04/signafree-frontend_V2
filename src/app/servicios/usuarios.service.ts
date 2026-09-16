import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NotificacionesService } from './notificaciones.service';
import { Usuario, DatosReniec } from '../modelos/usuario.model';

export interface ActualizacionPerfilRequest {
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  direccion?: string | null;
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
  private apiUrl = `${environment.apiUrl}/usuarios`;

  constructor(
    private http: HttpClient,
    private notificaciones: NotificacionesService
  ) { }

  obtenerPerfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/perfil`).pipe(
      tap(usuario => {
        console.log('Perfil obtenido del servidor:', usuario);
      }),
      catchError(error => {
        console.error('Error al obtener perfil:', error);
        const mensaje = this.obtenerMensajeError(error);
        this.notificaciones.mostrarError(mensaje);
        return throwError(error);
      })
    );
  }

  actualizarPerfil(datos: ActualizacionPerfilRequest): Observable<RespuestaAPI> {
    console.log('Enviando datos al backend:', datos);

    return this.http.put<RespuestaAPI>(`${this.apiUrl}/perfil`, datos).pipe(
      tap(respuesta => {
        console.log('Respuesta del backend:', respuesta);
      }),
      catchError(error => {
        console.error('Error del backend:', error);
        console.error('Detalle del error:', error.error);

        const mensaje = error.error?.detail || error.error?.mensaje || this.obtenerMensajeError(error);
        this.notificaciones.mostrarError(mensaje);

        return throwError(error);
      })
    );
  }

  cambiarPassword(datos: CambiarPasswordRequest): Observable<RespuestaAPI> {
    return this.http.put<RespuestaAPI>(`${this.apiUrl}/cambiar-password`, datos).pipe(
      tap(respuesta => {
        console.log('Contraseña actualizada');
      }),
      catchError(error => {
        const mensaje = error.error?.detail || error.error?.mensaje || 'Error inesperado'; 
        console.error('Error al cambiar contraseña:', error);
        console.error('Detalle del error:', error.error); 
        this.notificaciones.mostrarError(mensaje);
        return throwError(error);
      })
    );
  }

  obtenerProgreso(): Observable<ProgresoUsuario> {
    return this.http.get<ProgresoUsuario>(`${this.apiUrl}/mi-progreso`).pipe(
      tap(progreso => {
        console.log('Progreso obtenido:', progreso);
      }),
      catchError(error => {
        const mensaje = this.obtenerMensajeError(error);
        this.notificaciones.mostrarError(mensaje);
        return throwError(error);
      })
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
      tap(respuesta => {
        console.log('Lecciones obtenidas:', respuesta);
      }),
      catchError(error => {
        const mensaje = this.obtenerMensajeError(error);
        this.notificaciones.mostrarError(mensaje);
        return throwError(error);
      })
    );
  }

  verificarDni(dni: string): Observable<DatosReniec> {
    return this.http.post<any>(`${this.apiUrl}/verificar-dni`, { dni }).pipe(
      tap(response => {
        if (response.valido && response.datos) {
          console.log('DNI verificado:', response.datos);
        } else {
          throw new Error(response.error || 'No se pudo verificar el DNI');
        }
      }),
      catchError(error => {
        const mensaje = this.obtenerMensajeError(error);
        this.notificaciones.mostrarError(mensaje);
        return throwError(error);
      })
    );
  }

  private obtenerMensajeError(error: any): string {
    if (error.status === 400) {
      return error.error?.detail || error.error?.mensaje || 'Los datos proporcionados no son válidos';
    } else if (error.status === 401) {
      return 'No tienes autorización. Por favor inicia sesión nuevamente';
    } else if (error.status === 403) {
      return 'No tienes permisos para realizar esta acción';
    } else if (error.status === 404) {
      return 'El recurso solicitado no fue encontrado';
    } else if (error.status === 422) {
      return error.error?.detail || 'Error de validación en los datos enviados';
    } else if (error.status === 500) {
      return 'Error del servidor. Por favor intenta más tarde';
    } else if (error.status === 0) {
      return 'Sin conexión a internet. Verifica tu conexión';
    } else {
      return error.error?.detail || error.error?.mensaje || error.message || 'Error inesperado';
    }
  }
}
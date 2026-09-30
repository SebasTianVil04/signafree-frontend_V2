import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpContextToken
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificacionesService } from '../servicios/notificaciones.service';

export const MANEJO_LOCAL_ERRORES = new HttpContextToken<boolean>(() => false);

const RUTAS_SIN_TRANSFORMAR = ['/auth/refresh'];
const RUTAS_SIN_NOTIFICAR = ['/polling', '/heartbeat', '/status', '/entrenamiento/progreso', '/auth/refresh'];

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(private notificaciones: NotificacionesService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse)) {
          return throwError(() => error);
        }

        if (request.method === 'OPTIONS') {
          return throwError(() => error);
        }

        if (RUTAS_SIN_TRANSFORMAR.some(r => request.url.includes(r))) {
          return throwError(() => error);
        }

        const mensajeError = this.extraerMensaje(error);

        if (request.context.get(MANEJO_LOCAL_ERRORES)) {
          return throwError(() => mensajeError);
        }

        if (error.status !== 401 && this.debeNotificar(error, request)) {
          this.notificaciones.mostrarError(mensajeError);
        }

        return throwError(() => mensajeError);
      })
    );
  }

  private debeNotificar(error: HttpErrorResponse, request: HttpRequest<unknown>): boolean {
    if (error.status === 0) {
      const esAccionUsuario = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
      if (!esAccionUsuario) {
        return false;
      }
    }

    if (RUTAS_SIN_NOTIFICAR.some(r => request.url.includes(r))) {
      return false;
    }

    if (error.status === 404 &&
        (request.url.includes('/favicon') || request.url.includes('/assets/'))) {
      return false;
    }

    return true;
  }

  private extraerMensaje(error: HttpErrorResponse): string {
    if (!error) return 'Error desconocido';

    if (error.error && typeof error.error === 'object') {
      if (error.error.detail) return String(error.error.detail);
      if (error.error.mensaje) return String(error.error.mensaje);
      if (error.error.message) return String(error.error.message);
    }

    if (typeof error.error === 'string' && error.error.trim() !== '') {
      return error.error;
    }

    switch (error.status) {
      case 400: return 'Solicitud incorrecta';
      case 401: return 'Credenciales incorrectas';
      case 403: return 'No tienes permisos';
      case 404: return 'Recurso no encontrado';
      case 422: return 'Datos inválidos';
      case 429: return 'Demasiados intentos';
      case 500: return 'Error del servidor';
      case 0: return 'Error de conexión';
      default: return 'Error inesperado';
    }
  }
}
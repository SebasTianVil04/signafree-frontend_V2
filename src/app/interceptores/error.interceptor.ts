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
import { Router } from '@angular/router';
import { AutenticacionService } from '../servicios/autenticacion.service';
import { NotificacionesService } from '../servicios/notificaciones.service';

export const MANEJO_LOCAL_ERRORES = new HttpContextToken<boolean>(() => false);

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private authService: AutenticacionService,
    private notificaciones: NotificacionesService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Ignorar peticiones OPTIONS (CORS preflight)
        if (request.method === 'OPTIONS') {
          return throwError(error);
        }

        const manejoLocal = request.context.get(MANEJO_LOCAL_ERRORES);
        const mensajeError = this.extraerMensaje(error);
        
        // Si tiene manejo local, solo transformar a string
        if (manejoLocal) {
          return throwError(mensajeError);
        }

        // Manejo global de errores
        if (error.status === 401 && !request.url.includes('/login')) {
          this.authService.logout();
        } else if (this.debeNotificar(error, request)) {
          this.notificaciones.mostrarError(mensajeError);
        }
        
        return throwError(mensajeError);
      })
    );
  }

  private debeNotificar(error: HttpErrorResponse, request: HttpRequest<any>): boolean {
    // No notificar errores de conexión durante la carga inicial
    if (error.status === 0) {
      // Solo notificar si es una acción explícita del usuario (POST, PUT, DELETE)
      const esAccionUsuario = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
      if (!esAccionUsuario) {
        return false;
      }
    }
    
    // No notificar errores de polling o heartbeat
    if (request.url.includes('/polling') || 
        request.url.includes('/heartbeat') ||
        request.url.includes('/status')) {
      return false;
    }
    
    // No notificar errores 404 en recursos opcionales
    if (error.status === 404 && 
        (request.url.includes('/favicon') || 
         request.url.includes('/assets/'))) {
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
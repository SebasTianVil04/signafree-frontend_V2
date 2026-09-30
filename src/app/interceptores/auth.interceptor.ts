import { Injectable, Injector } from '@angular/core';
import {
  HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AutenticacionService } from '../servicios/autenticacion.service';

const METODOS_SEGUROS = ['GET', 'HEAD', 'OPTIONS'];
const RUTAS_SIN_REFRESH = ['/auth/login', '/auth/registro', '/auth/refresh', '/auth/logout'];

function leerCookie(nombre: string): string | null {
  const par = document.cookie.split('; ').find(c => c.startsWith(nombre + '='));
  return par ? decodeURIComponent(par.split('=')[1]) : null;
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private injector: Injector, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith(environment.apiUrl)) {
      return next.handle(req);
    }

    return next.handle(this.prepararPeticion(req)).pipe(
      catchError((error: HttpErrorResponse) => {
        const esRutaExcluida = RUTAS_SIN_REFRESH.some(r => req.url.includes(r));
        if (error.status !== 401 || esRutaExcluida) {
          return throwError(() => error);
        }
        return this.renovarYReintentar(req, next);
      })
    );
  }

  private renovarYReintentar(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const auth = this.injector.get(AutenticacionService);
    const teniaSesion = !!auth.usuarioActualValor;

    return auth.refrescarSesion().pipe(
      catchError(errorRefresh => {
        auth.limpiarSesion();
        if (teniaSesion) {
          this.router.navigate(['/login'], {
            queryParams: { returnUrl: this.router.url, sesion: 'expirada' }
          });
        }
        return throwError(() => errorRefresh);
      }),
      switchMap(() => next.handle(this.prepararPeticion(req)))
    );
  }

  private prepararPeticion(req: HttpRequest<unknown>): HttpRequest<unknown> {
    let headers = req.headers;
    if (!METODOS_SEGUROS.includes(req.method)) {
      const csrf = leerCookie('csrf_token');
      if (csrf) headers = headers.set('X-CSRF-Token', csrf);
    }
    return req.clone({ withCredentials: true, headers });
  }
}
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Injectable({
  providedIn: 'root'
})
export class PermisoGuard implements CanActivate {

  constructor(
    private authService: AutenticacionService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    if (!this.authService.estaAutenticado()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    }

    return this.authService.cargarUsuarioSiEsNecesario().pipe(
      switchMap(usuario => {
        if (!usuario) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          return of(false);
        }

        if (this.authService.esAdmin()) {
          return of(true);
        }

        const permisoRequerido = route.data['permiso'] as string | undefined;

        if (!permisoRequerido) {
          this.router.navigate(['/inicio']);
          return of(false);
        }

        if (this.authService.tienePermiso(permisoRequerido)) {
          return of(true);
        }

        this.router.navigate(['/inicio']);
        return of(false);
      }),
      catchError(() => {
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
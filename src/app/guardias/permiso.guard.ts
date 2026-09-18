import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
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
  ): boolean {
    if (!this.authService.estaAutenticado()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    if (this.authService.esAdmin()) {
      return true;
    }

    const permisoRequerido = route.data['permiso'] as string;

    if (!permisoRequerido || this.authService.tienePermiso(permisoRequerido)) {
      return true;
    }

    this.router.navigate(['/inicio']);
    return false;
  }
}
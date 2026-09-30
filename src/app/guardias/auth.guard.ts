import { Injectable } from '@angular/core';
import {
  CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.autenticacionService.cargarUsuarioSiEsNecesario().pipe(
      map(usuario => {
        if (!usuario) {
          return this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
        }

        const permisos: string[] | undefined = route.data['permisos'];
        const roles: string[] | undefined = route.data['roles'];

        if (permisos?.length && !this.autenticacionService.tieneAlgunPermiso(...permisos)) {
          return this.router.createUrlTree(['/inicio']);
        }
        if (roles?.length && !this.autenticacionService.esAdmin()
            && !roles.some(r => this.autenticacionService.tieneRol(r))) {
          return this.router.createUrlTree(['/inicio']);
        }
        return true;
      })
    );
  }
}
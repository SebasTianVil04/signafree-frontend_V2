import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.autenticacionService.cargarUsuarioSiEsNecesario().pipe(
      map(usuario => usuario ? this.router.createUrlTree(['/inicio']) : true)
    );
  }
}
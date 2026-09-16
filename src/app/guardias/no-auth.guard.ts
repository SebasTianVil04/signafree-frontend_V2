import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (!this.autenticacionService.estaAutenticado()) {
      return true;
    }

    this.router.navigate(['/inicio']);
    return false;
  }
}
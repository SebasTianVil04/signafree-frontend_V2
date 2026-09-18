import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AutenticacionService } from '../../servicios/autenticacion.service';
import { Usuario } from '../../modelos/usuario.model';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss'],
  standalone: false
})
export class InicioComponent implements OnInit, OnDestroy {
  usuario: Usuario | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.autenticacionService.usuarioActual
      .pipe(takeUntil(this.destroy$))
      .subscribe(usuario => {
        this.usuario = usuario;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cerrarSesion(): void {
    this.autenticacionService.logout();
  }

  get iniciales(): string {
    if (!this.usuario) return '';
    const n = this.usuario.nombres?.charAt(0) || '';
    const a = (this.usuario.apellidos || this.usuario.apellido_paterno || '').charAt(0) || '';
    return (n + a).toUpperCase();
  }

  get nombreCompleto(): string {
    if (!this.usuario) return '';
    const apellidos = this.usuario.apellidos
      || `${this.usuario.apellido_paterno || ''} ${this.usuario.apellido_materno || ''}`.trim();
    return `${this.usuario.nombres || ''} ${apellidos}`.trim();
  }

  get nombreRol(): string {
    if (!this.usuario) return '';
    if (this.usuario.es_admin) return 'Administrador';
    return this.usuario.rol?.nombre || 'Usuario';
  }

  get esAdmin(): boolean {
    return !!this.usuario?.es_admin;
  }

  get esUsuarioBasico(): boolean {
    if (!this.usuario || this.usuario.es_admin) return false;
    return (this.usuario.permisos?.length || 0) === 0;
  }
}
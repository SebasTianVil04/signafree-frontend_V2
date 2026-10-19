import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AutenticacionService } from '../../servicios/autenticacion.service';
import { Usuario } from '../../modelos/usuario.model';

interface TarjetaAcceso {
  icono: string;
  titulo: string;
  descripcion: string;
  accion: string;
  ruta: string;
}

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss'],
  standalone: false
})
export class InicioComponent implements OnInit, OnDestroy {
  usuario: Usuario | null = null;

  readonly tarjetas: TarjetaAcceso[] = [
    {
      icono: '📚',
      titulo: 'Lecciones Interactivas',
      descripcion: 'Aprende paso a paso con nuestras lecciones estructuradas',
      accion: 'Ver lecciones',
      ruta: '/lecciones'
    },
    {
      icono: '📊',
      titulo: 'Seguimiento de Progreso',
      descripcion: 'Monitorea tu avance y obtén certificados',
      accion: 'Ver mi progreso',
      ruta: '/progreso'
    }
  ];

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

  irA(ruta: string): void {
    if (!this.esRolUsuario) return;
    this.router.navigate([ruta]);
  }

  trackByRuta(_: number, tarjeta: TarjetaAcceso): string {
    return tarjeta.ruta;
  }

  get iniciales(): string {
    if (!this.usuario?.nombre_usuario) return '';
    return this.usuario.nombre_usuario.substring(0, 2).toUpperCase();
  }

  get nombreCompleto(): string {
    return this.usuario?.nombre_usuario || '';
  }

  get nombreRol(): string {
    if (!this.usuario) return '';
    if (this.usuario.es_admin) return 'Administrador';
    return this.usuario.rol?.nombre || 'Usuario';
  }

  get esAdmin(): boolean {
    return !!this.usuario?.es_admin;
  }

  get esRolUsuario(): boolean {
    if (!this.usuario || this.usuario.es_admin) return false;
    const rol = (this.usuario.rol?.nombre || '').trim().toLowerCase();
    return rol === 'usuario';
  }
}
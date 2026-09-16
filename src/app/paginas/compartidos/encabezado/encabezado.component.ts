// src/app/componentes/compartidos/encabezado/encabezado.component.ts

import { Component, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { Usuario } from '../../../modelos/usuario.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-encabezado',
  templateUrl: './encabezado.component.html',
  styleUrls: ['./encabezado.component.scss'],
  standalone: false 
})
export class EncabezadoComponent implements OnInit {
  usuario: Usuario | null = null;
  menuAbierto = false;
  menuUsuarioAbierto = false;
  submenuAbierto: string | null = null;

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.autenticacionService.usuarioActual.subscribe(
      usuario => {
        this.usuario = usuario;
      }
    );

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cerrarMenus();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const navbar = document.querySelector('.navbar');
    
    if (navbar && !navbar.contains(target)) {
      this.cerrarMenus();
    }
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    if (this.menuAbierto) {
      this.menuUsuarioAbierto = false;
      this.submenuAbierto = null;
    }
  }

  toggleMenuUsuario(): void {
    this.menuUsuarioAbierto = !this.menuUsuarioAbierto;
    if (this.menuUsuarioAbierto) {
      this.menuAbierto = false;
      this.submenuAbierto = null;
    }
  }

  toggleSubmenu(submenu: string): void {
    if (this.submenuAbierto === submenu) {
      this.submenuAbierto = null;
    } else {
      this.submenuAbierto = submenu;
      this.menuUsuarioAbierto = false;
    }
  }

  cerrarMenus(): void {
    this.menuAbierto = false;
    this.menuUsuarioAbierto = false;
    this.submenuAbierto = null;
  }

  cerrarSesion(): void {
    this.autenticacionService.logout();
    this.cerrarMenus();
  }

  navegarA(ruta: string): void {
    this.router.navigate([ruta]);
    this.cerrarMenus();
  }

  get iniciales(): string {
    if (!this.usuario) return '';
    const nombres = this.usuario.nombres?.charAt(0) || '';
    const apellidos = this.usuario.apellidos?.charAt(0) || '';
    return (nombres + apellidos).toUpperCase();
  }

  get esAdmin(): boolean {
    return this.usuario?.rol === 'admin';
  }

  get esUser(): boolean {
    return this.usuario?.rol === 'usuario';
  }

  esRutaActiva(ruta: string): boolean {
    return this.router.url === ruta || this.router.url.includes(ruta);
  }
}
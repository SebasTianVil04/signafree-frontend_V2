import { Component, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { MenuService } from '../../../servicios/menu.service';
import { Usuario } from '../../../modelos/usuario.model';
import { MenuItemPublico } from '../../../modelos/menu.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-encabezado',
  templateUrl: './encabezado.component.html',
  styleUrls: ['./encabezado.component.scss'],
  standalone: false
})
export class EncabezadoComponent implements OnInit {
  usuario: Usuario | null = null;
  menuItems: MenuItemPublico[] = [];
  menuAbierto = false;
  menuUsuarioAbierto = false;
  submenuAbierto: string | null = null;

  constructor(
    private autenticacionService: AutenticacionService,
    private menuService: MenuService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.autenticacionService.usuarioActual.subscribe(usuario => {
      this.usuario = usuario;
      if (usuario) {
        this.menuService.cargarMenu().subscribe({
          error: (err) => console.error('Error cargando menú:', err)
        });
      } else {
        this.menuItems = [];
        this.menuService.limpiar();
      }
    });

    this.menuService.menu$.subscribe(items => {
      this.menuItems = items || [];
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.cerrarMenus());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const navbar = document.querySelector('.navbar');
    if (navbar && !navbar.contains(target)) {
      this.submenuAbierto = null;
      this.menuUsuarioAbierto = false;
    }
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    if (this.menuAbierto) {
      this.menuUsuarioAbierto = false;
      this.submenuAbierto = null;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  toggleMenuUsuario(event: Event): void {
    event.stopPropagation();
    this.menuUsuarioAbierto = !this.menuUsuarioAbierto;
    if (this.menuUsuarioAbierto) {
      this.menuAbierto = false;
      this.submenuAbierto = null;
    }
  }

  toggleSubmenu(event: Event, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.submenuAbierto = this.submenuAbierto === key ? null : key;
    if (this.submenuAbierto) {
      this.menuUsuarioAbierto = false;
    }
  }

  cerrarMenus(): void {
    this.menuAbierto = false;
    this.menuUsuarioAbierto = false;
    this.submenuAbierto = null;
    document.body.style.overflow = '';
  }

  cerrarSesion(event: Event): void {
    event.stopPropagation();
    this.autenticacionService.logout();
    this.menuService.limpiar();
    this.cerrarMenus();
  }

  navegarA(event: Event, ruta?: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (ruta) {
      this.router.navigate([ruta]);
    }
    this.cerrarMenus();
  }

  get iniciales(): string {
    if (!this.usuario) return '';
    const nombres = this.usuario.nombres?.charAt(0) || '';
    const apellidos = this.usuario.apellidos?.charAt(0) || '';
    return (nombres + apellidos).toUpperCase();
  }

  get esAdmin(): boolean {
    return !!this.usuario?.es_admin;
  }

  get esUser(): boolean {
    if (!this.usuario || this.usuario.es_admin) return false;
    return (this.usuario.permisos?.length || 0) === 0;
  }

  get nombreRol(): string {
    if (!this.usuario) return '';
    if (this.usuario.es_admin) return 'Administrador';
    return this.usuario.rol?.nombre || 'Usuario';
  }

  esRutaActiva(ruta?: string): boolean {
    if (!ruta) return false;
    return this.router.url === ruta || this.router.url.includes(ruta);
  }

  trackByLabel(index: number, item: MenuItemPublico): string {
    return `${index}-${item.label}`;
  }
}
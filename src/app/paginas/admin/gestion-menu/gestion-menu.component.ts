import { Component, OnInit } from '@angular/core';
import { MenuAdminService } from '../../../servicios/menu-admin.service';
import { RolesService } from '../../../servicios/roles.service';
import { Permiso } from '../../../modelos/rol.model';
import { MenuItemAdmin } from '../../../modelos/menu.model';
import { NotificacionesService } from '../../../servicios/notificaciones.service';

type FiltroVisibilidad = 'todos' | 'publico' | 'permiso';
type FiltroEstado = 'todos' | 'activo' | 'inactivo';

@Component({
  selector: 'app-gestion-menu',
  templateUrl: './gestion-menu.component.html',
  styleUrls: ['./gestion-menu.component.scss'],
  standalone: false
})
export class GestionMenuComponent implements OnInit {
  items: MenuItemAdmin[] = [];
  permisos: Permiso[] = [];
  cargando = false;
  guardando = false;
  eliminandoId: number | null = null;

  filtroTexto = '';
  filtroVisibilidad: FiltroVisibilidad = 'todos';
  filtroEstado: FiltroEstado = 'todos';

  mostrarModal = false;
  modoEdicion = false;
  itemActual: MenuItemAdmin = this.itemVacio();

  constructor(
    private menuAdminService: MenuAdminService,
    private rolesService: RolesService,
    private notificaciones: NotificacionesService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.cargarPermisos();
  }

  get itemsFiltrados(): MenuItemAdmin[] {
    return this.filtrarNodos(this.items);
  }

  get hayFiltrosActivos(): boolean {
    return !!this.filtroTexto || this.filtroVisibilidad !== 'todos' || this.filtroEstado !== 'todos';
  }

  private filtrarNodos(items: MenuItemAdmin[]): MenuItemAdmin[] {
    return items.reduce((acc: MenuItemAdmin[], item) => {
      const hijosFiltrados = item.hijos && item.hijos.length ? this.filtrarNodos(item.hijos) : [];
      const coincide = this.coincideFiltro(item);
      if (coincide || hijosFiltrados.length) {
        acc.push({ ...item, hijos: hijosFiltrados });
      }
      return acc;
    }, []);
  }

  private coincideFiltro(item: MenuItemAdmin): boolean {
    const texto = this.filtroTexto.trim().toLowerCase();
    const coincideTexto =
      !texto ||
      item.label.toLowerCase().includes(texto) ||
      (item.ruta || '').toLowerCase().includes(texto);

    const coincideVisibilidad =
      this.filtroVisibilidad === 'todos' ||
      (this.filtroVisibilidad === 'publico' && !item.permiso_codigo) ||
      (this.filtroVisibilidad === 'permiso' && !!item.permiso_codigo);

    const coincideEstado =
      this.filtroEstado === 'todos' ||
      (this.filtroEstado === 'activo' && item.activo) ||
      (this.filtroEstado === 'inactivo' && !item.activo);

    return coincideTexto && coincideVisibilidad && coincideEstado;
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroVisibilidad = 'todos';
    this.filtroEstado = 'todos';
  }

  private itemVacio(): MenuItemAdmin {
    return {
      label: '',
      icon: '',
      ruta: '',
      permiso_codigo: null,
      orden: 0,
      activo: true,
      padre_id: null
    };
  }

  cargar(): void {
    this.cargando = true;
    this.menuAdminService.listar().subscribe({
      next: (items) => {
        this.items = items;
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  cargarPermisos(): void {
    this.rolesService.listarPermisos().subscribe({
      next: (permisos) => (this.permisos = permisos)
    });
  }

  abrirModalNuevoRaiz(): void {
    this.modoEdicion = false;
    this.itemActual = this.itemVacio();
    this.mostrarModal = true;
  }

  abrirModalNuevoHijo(padre: MenuItemAdmin): void {
    this.modoEdicion = false;
    this.itemActual = { ...this.itemVacio(), padre_id: padre.id || null };
    this.mostrarModal = true;
  }

  abrirModalEditar(item: MenuItemAdmin): void {
    this.modoEdicion = true;
    this.itemActual = { ...item };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.mostrarModal = false;
    this.itemActual = this.itemVacio();
  }

  guardar(): void {
    if (!this.itemActual.label || !this.itemActual.label.trim()) {
      this.notificaciones.mostrarAdvertencia('El label es obligatorio');
      return;
    }

    this.guardando = true;
    const op = this.modoEdicion && this.itemActual.id
      ? this.menuAdminService.actualizar(this.itemActual.id, this.itemActual)
      : this.menuAdminService.crear(this.itemActual);

    op.subscribe({
      next: () => {
        this.notificaciones.mostrarExito(this.modoEdicion ? 'Ítem actualizado' : 'Ítem creado');
        this.guardando = false;
        this.mostrarModal = false;
        this.itemActual = this.itemVacio();
        this.cargar();
      },
      error: () => {
        this.guardando = false;
      }
    });
  }

  eliminar(item: MenuItemAdmin): void {
    if (!item.id) return;
    const msg = item.hijos && item.hijos.length
      ? `¿Eliminar "${item.label}" y todos sus hijos?`
      : `¿Eliminar "${item.label}"?`;
    if (!confirm(msg)) return;

    this.eliminandoId = item.id;
    this.menuAdminService.eliminar(item.id).subscribe({
      next: () => {
        this.notificaciones.mostrarExito('Ítem eliminado');
        this.eliminandoId = null;
        this.cargar();
      },
      error: () => {
        this.eliminandoId = null;
      }
    });
  }

  trackByItem(_: number, item: MenuItemAdmin): number | undefined {
    return item.id;
  }

  trackByPermiso(_: number, p: Permiso): number {
    return p.id;
  }
}
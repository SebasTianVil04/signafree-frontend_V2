import { Component, computed, inject, signal } from '@angular/core';
import { injectMutation, injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { RolesService } from '../../../servicios/roles.service';
import { Rol, PermisosPorModulo } from '../../../modelos/rol.model';

const CODIGO_ROL_ADMIN = 'admin';

@Component({
  selector: 'app-gestion-roles',
  templateUrl: './gestion-roles.component.html',
  styleUrls: ['./gestion-roles.component.scss'],
  standalone: false,
})
export class GestionRolesComponent {
  private rolesService = inject(RolesService);
  private queryClient = injectQueryClient();

  permisosQuery = injectQuery(() => ({
    queryKey: ['permisos'],
    queryFn: () => lastValueFrom(this.rolesService.listarPermisos()),
    staleTime: 5 * 60 * 1000,
  }));

  rolesQuery = injectQuery(() => ({
    queryKey: ['roles'],
    queryFn: () => lastValueFrom(this.rolesService.listarRoles()),
    staleTime: 30 * 1000,
  }));

  roles = computed<Rol[]>(() => this.rolesQuery.data() ?? []);

  permisosPorModulo = computed<PermisosPorModulo[]>(() =>
    this.rolesService.agruparPermisosPorModulo(this.permisosQuery.data() ?? [])
  );

  cargando = computed(() => this.permisosQuery.isPending() || this.rolesQuery.isPending());

  mostrarModalRol = signal(false);
  rolEditando = signal<Rol | null>(null);
  permisosSeleccionados = signal<ReadonlySet<number>>(new Set<number>());

  formRol = {
    codigo: '',
    nombre: '',
    descripcion: '',
  };

  esRolAdminEditando = computed(() => this.rolEditando()?.codigo === CODIGO_ROL_ADMIN);

  rolCambiandoEstadoId = signal<number | null>(null);
  rolEliminandoId = signal<number | null>(null);

  private cambiarEstadoMutation = injectMutation(() => ({
    mutationFn: (payload: { id: number; activo: boolean }) =>
      lastValueFrom(this.rolesService.actualizarRol(payload.id, { activo: payload.activo })),
    onMutate: (vars) => {
      this.rolCambiandoEstadoId.set(vars.id);
    },
    onSettled: () => {
      this.rolCambiandoEstadoId.set(null);
      this.queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  }));

  private eliminarRolMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.rolesService.eliminarRol(id)),
    onMutate: (id) => {
      this.rolEliminandoId.set(id);
    },
    onSettled: () => {
      this.rolEliminandoId.set(null);
      this.queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  }));

  private guardarMutation = injectMutation(() => ({
    mutationFn: async (payload: {
      modo: 'crear' | 'editar';
      id?: number;
      esAdmin: boolean;
      codigo: string;
      nombre: string;
      descripcion: string;
      permisos_ids: number[];
    }) => {
      if (payload.modo === 'crear') {
        return lastValueFrom(
          this.rolesService.crearRol({
            codigo: payload.codigo,
            nombre: payload.nombre,
            descripcion: payload.descripcion,
            permisos_ids: payload.permisos_ids,
          })
        );
      }

      let rolActualizado = await lastValueFrom(
        this.rolesService.actualizarRol(payload.id!, {
          nombre: payload.nombre,
          descripcion: payload.descripcion,
        })
      );

      if (!payload.esAdmin) {
        rolActualizado = await lastValueFrom(
          this.rolesService.asignarPermisos(payload.id!, {
            permisos_ids: payload.permisos_ids,
          })
        );
      }

      return rolActualizado;
    },
    onSuccess: () => {
      this.cerrarModalInterno();
    },
    onSettled: () => {
      this.queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  }));

  guardando = computed(() => this.guardarMutation.isPending());

  permisosBloqueados = computed(() => this.guardando() || this.esRolAdminEditando());

  trackByRolId = (_: number, rol: Rol) => rol.id;
  trackByPermisoId = (_: number, p: { id: number }) => p.id;

  estaCambiandoEstado(rol: Rol): boolean {
    return this.rolCambiandoEstadoId() === rol.id;
  }

  estaEliminando(rol: Rol): boolean {
    return this.rolEliminandoId() === rol.id;
  }

  hayMutacionEnVuelo(): boolean {
    return this.rolCambiandoEstadoId() !== null || this.rolEliminandoId() !== null;
  }

  abrirModalNuevo(): void {
    this.rolEditando.set(null);
    this.formRol = { codigo: '', nombre: '', descripcion: '' };
    this.permisosSeleccionados.set(new Set<number>());
    this.mostrarModalRol.set(true);
  }

  abrirModalEditar(rol: Rol): void {
    this.formRol = {
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion || '',
    };
    this.permisosSeleccionados.set(new Set<number>((rol.permisos ?? []).map((p) => p.id)));
    this.rolEditando.set(rol);
    this.mostrarModalRol.set(true);
  }

  private cerrarModalInterno(): void {
    this.mostrarModalRol.set(false);
    this.rolEditando.set(null);
    this.permisosSeleccionados.set(new Set<number>());
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.cerrarModalInterno();
  }

  alternarPermiso(permisoId: number): void {
    if (this.permisosBloqueados()) return;

    const siguiente = new Set<number>(this.permisosSeleccionados());
    if (siguiente.has(permisoId)) siguiente.delete(permisoId);
    else siguiente.add(permisoId);
    this.permisosSeleccionados.set(siguiente);
  }

  tienePermisoSeleccionado(permisoId: number): boolean {
    return this.esRolAdminEditando() || this.permisosSeleccionados().has(permisoId);
  }

  guardar(): void {
    if (this.guardando()) return;

    const rol = this.rolEditando();

    this.guardarMutation.mutate({
      modo: rol ? 'editar' : 'crear',
      id: rol?.id,
      esAdmin: this.esRolAdminEditando(),
      codigo: this.formRol.codigo,
      nombre: this.formRol.nombre,
      descripcion: this.formRol.descripcion,
      permisos_ids: Array.from(this.permisosSeleccionados()),
    });
  }

  cambiarEstado(rol: Rol): void {
    if (this.hayMutacionEnVuelo()) return;
    if (rol.es_sistema) return;

    this.cambiarEstadoMutation.mutate({ id: rol.id, activo: !rol.activo });
  }

  eliminarRol(rol: Rol): void {
    if (rol.es_sistema) {
      alert('No se puede eliminar un rol del sistema');
      return;
    }
    if (this.hayMutacionEnVuelo()) return;

    if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return;

    this.eliminarRolMutation.mutate(rol.id);
  }
}
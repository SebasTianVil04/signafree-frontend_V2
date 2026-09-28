import { Component, computed, inject, signal } from '@angular/core';
import { injectMutation, injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { RolesService } from '../../../servicios/roles.service';
import { Rol, PermisosPorModulo } from '../../../modelos/rol.model';

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

  mostrarModalRol = false;
  rolEditando: Rol | null = null;
  formRol = {
    codigo: '',
    nombre: '',
    descripcion: '',
    permisos_ids: [] as number[],
  };

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

      const [rolActualizado] = await Promise.all([
        lastValueFrom(
          this.rolesService.actualizarRol(payload.id!, {
            nombre: payload.nombre,
            descripcion: payload.descripcion,
          })
        ),
        lastValueFrom(
          this.rolesService.asignarPermisos(payload.id!, {
            permisos_ids: payload.permisos_ids,
          })
        ),
      ]);
      return rolActualizado;
    },
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['roles'] });
      this.cerrarModalInterno();
    },
  }));

  guardando = computed(() => this.guardarMutation.isPending());

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
    this.rolEditando = null;
    this.formRol = { codigo: '', nombre: '', descripcion: '', permisos_ids: [] };
    this.mostrarModalRol = true;
  }

  abrirModalEditar(rol: Rol): void {
    this.rolEditando = rol;
    this.formRol = {
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion || '',
      permisos_ids: rol.permisos.map((p) => p.id),
    };
    this.mostrarModalRol = true;
  }

  private cerrarModalInterno(): void {
    this.mostrarModalRol = false;
    this.rolEditando = null;
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.cerrarModalInterno();
  }

  togglePermiso(permisoId: number): void {
    if (this.guardando()) return;
    const indice = this.formRol.permisos_ids.indexOf(permisoId);
    if (indice >= 0) this.formRol.permisos_ids.splice(indice, 1);
    else this.formRol.permisos_ids.push(permisoId);
  }

  tienePermisoSeleccionado(permisoId: number): boolean {
    return this.formRol.permisos_ids.includes(permisoId);
  }

  guardar(): void {
    if (this.guardando()) return;

    this.guardarMutation.mutate({
      modo: this.rolEditando ? 'editar' : 'crear',
      id: this.rolEditando?.id,
      codigo: this.formRol.codigo,
      nombre: this.formRol.nombre,
      descripcion: this.formRol.descripcion,
      permisos_ids: this.formRol.permisos_ids,
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
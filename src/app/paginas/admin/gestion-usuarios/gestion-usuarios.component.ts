import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { injectMutation, injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../../servicios/admin.service';
import { RolesService } from '../../../servicios/roles.service';
import { EstadisticasService, EstadisticasGenerales, LeccionPopular } from '../../../servicios/estadisticas.service';
import { Usuario } from '../../../modelos/usuario.model';
import { Rol, Permiso, PermisosPorModulo } from '../../../modelos/rol.model';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const QK_USUARIOS = ['usuariosAdmin'] as const;
const QK_ROLES = ['rolesAdmin'] as const;
const QK_PERMISOS_CATALOGO = ['permisosCatalogo'] as const;
const STALE_USUARIOS = 30 * 1000;
const STALE_ROLES = 60 * 1000;
const STALE_PERMISOS_CATALOGO = 5 * 60 * 1000;
const STALE_ESTADISTICAS_MODAL = 60 * 1000;

@Component({
  selector: 'app-gestion-usuarios',
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.scss'],
  standalone: false
})
export class GestionUsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];
  roles: Rol[] = [];
  error: string | null = null;
  filtroTexto: string = '';
  filtroTipo: string = 'todos';
  filtroEstado: string = 'todos';
  paginaActual: number = 1;
  usuariosPorPagina: number = 10;
  usuarioSeleccionado: Usuario | null = null;

  estadisticasGenerales: EstadisticasGenerales | null = null;
  leccionesPopulares: LeccionPopular[] = [];
  fechaInicioModal: string = '';
  fechaFinModal: string = '';

  mostrarModalEdicion: boolean = false;
  usuarioEditando: Usuario | null = null;
  formEdicion = {
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    email: '',
    telefono: '',
    direccion: '',
    fecha_nacimiento: ''
  };

  mostrarModalRol: boolean = false;
  usuarioCambiandoRol: Usuario | null = null;
  rolIdSeleccionado: number | null = null;

  mostrarModalPermisosRol: boolean = false;
  rolPermisosEditando: Rol | null = null;
  permisosSeleccionados: number[] = [];

  usuarioIdEnAccion = signal<number | null>(null);

  Math = Math;

  private queryClient = injectQueryClient();

  private usuariosQuery = injectQuery(() => ({
    queryKey: QK_USUARIOS,
    queryFn: () => firstValueFrom(this.adminService.listarUsuarios()),
    staleTime: STALE_USUARIOS
  }));

  private rolesQuery = injectQuery(() => ({
    queryKey: QK_ROLES,
    queryFn: () => firstValueFrom(this.rolesService.listarRoles()),
    staleTime: STALE_ROLES
  }));

  private permisosQuery = injectQuery(() => ({
    queryKey: QK_PERMISOS_CATALOGO,
    queryFn: () => firstValueFrom(this.rolesService.listarPermisos()),
    staleTime: STALE_PERMISOS_CATALOGO
  }));

  private filtroEstadisticasModal = signal<{ usuarioId: number; inicio: string; fin: string } | null>(null);

  private estadisticasModalQuery = injectQuery(() => {
    const filtro = this.filtroEstadisticasModal();
    return {
      queryKey: ['estadisticasUsuarioModal', filtro?.usuarioId, filtro?.inicio, filtro?.fin],
      queryFn: () => firstValueFrom(
        this.estadisticasService.obtenerEstadisticasRangoFechas(filtro!.inicio, filtro!.fin)
      ),
      staleTime: STALE_ESTADISTICAS_MODAL,
      enabled: !!filtro
    };
  });

  permisosPorModulo = computed<PermisosPorModulo[]>(() =>
    this.rolesService.agruparPermisosPorModulo(this.permisosQuery.data() ?? [])
  );

  cargandoPermisosCatalogo = computed(() => this.permisosQuery.isPending());

  private guardarEdicionMutation = injectMutation(() => ({
    mutationFn: (payload: { id: number; datos: any }) =>
      firstValueFrom(this.adminService.actualizarUsuario(payload.id, payload.datos)),
    onSuccess: () => {
      alert('Usuario actualizado exitosamente');
      this.cerrarModalEdicion();
      this.queryClient.invalidateQueries({ queryKey: QK_USUARIOS });
    },
    onError: (err: any) => {
      console.error('Error al actualizar usuario:', err);
      alert(err.error?.detail || 'Error al actualizar usuario');
    }
  }));

  private guardarRolMutation = injectMutation(() => ({
    mutationFn: (payload: { usuarioId: number; rolId: number }) =>
      firstValueFrom(this.adminService.asignarRol(payload.usuarioId, payload.rolId)),
    onSuccess: () => {
      alert('Rol actualizado exitosamente');
      this.cerrarModalRol();
      this.queryClient.invalidateQueries({ queryKey: QK_USUARIOS });
    },
    onError: (err: any) => {
      console.error('Error al asignar rol:', err);
      alert(err.error?.detail || 'Error al asignar rol');
    }
  }));

  private guardarPermisosRolMutation = injectMutation(() => ({
    mutationFn: (payload: { rolId: number; permisos_ids: number[] }) =>
      firstValueFrom(this.rolesService.asignarPermisos(payload.rolId, { permisos_ids: payload.permisos_ids })),
    onSuccess: () => {
      alert('Permisos del rol actualizados exitosamente');
      this.cerrarModalPermisosRol();
      this.queryClient.invalidateQueries({ queryKey: QK_ROLES });
      this.queryClient.invalidateQueries({ queryKey: QK_USUARIOS });
    },
    onError: (err: any) => {
      console.error('Error al asignar permisos:', err);
      alert(err.error?.detail || 'Error al actualizar permisos');
    }
  }));

  private cambiarEstadoMutation = injectMutation(() => ({
    mutationFn: (payload: { id: number; activo: boolean }) =>
      firstValueFrom(this.adminService.cambiarEstadoUsuario(payload.id, payload.activo)),
    onSuccess: (response: any, payload) => {
      const accion = payload.activo ? 'activado' : 'desactivado';
      alert(response?.mensaje || `Usuario ${accion} correctamente`);
      this.queryClient.invalidateQueries({ queryKey: QK_USUARIOS });
    },
    onError: (err: any) => {
      console.error('Error al cambiar estado:', err);
      alert('Error al cambiar el estado del usuario');
    },
    onSettled: () => {
      this.usuarioIdEnAccion.set(null);
    }
  }));

  private eliminarUsuarioMutation = injectMutation(() => ({
    mutationFn: (id: number) => firstValueFrom(this.adminService.eliminarUsuario(id)),
    onSuccess: () => {
      alert('Usuario eliminado exitosamente');
      this.queryClient.invalidateQueries({ queryKey: QK_USUARIOS });
    },
    onError: (err: any) => {
      console.error('Error al eliminar usuario:', err);
      alert(err.error?.detail || 'Error al eliminar usuario');
    },
    onSettled: () => {
      this.usuarioIdEnAccion.set(null);
    }
  }));

  guardandoEdicion = computed(() => this.guardarEdicionMutation.isPending());
  guardandoRol = computed(() => this.guardarRolMutation.isPending());
  guardandoPermisos = computed(() => this.guardarPermisosRolMutation.isPending());

  constructor(
    private adminService: AdminService,
    private rolesService: RolesService,
    private estadisticasService: EstadisticasService
  ) {
    effect(() => {
      const response = this.usuariosQuery.data() as any;
      if (response) {
        const listaCompleta: Usuario[] = response.datos || response || [];
        this.usuarios = listaCompleta.filter(u => !u.es_admin);
        this.aplicarFiltros();
      }
    });

    effect(() => {
      if (this.usuariosQuery.isError()) {
        console.error('Error:', this.usuariosQuery.error());
        this.error = 'Error al cargar usuarios';
      }
    });

    effect(() => {
      const roles = this.rolesQuery.data();
      if (roles) {
        this.roles = roles.filter(r => r.activo);
      }
    });

    effect(() => {
      const response = this.estadisticasModalQuery.data();
      if (response) {
        this.estadisticasGenerales = response.estadisticas_generales;
        this.leccionesPopulares = response.lecciones_populares || [];
      }
    });

    effect(() => {
      if (this.estadisticasModalQuery.isError()) {
        console.error('Error al cargar estadísticas:', this.estadisticasModalQuery.error());
        this.estadisticasGenerales = null;
        this.leccionesPopulares = [];
      }
    });
  }

  get cargando(): boolean {
    return this.usuariosQuery.isPending();
  }

  get cargandoEstadisticas(): boolean {
    return this.estadisticasModalQuery.isPending() || this.estadisticasModalQuery.isFetching();
  }

  ngOnInit(): void {
  }

  cargarUsuarios(): void {
    this.error = null;
    this.queryClient.invalidateQueries({ queryKey: QK_USUARIOS });
  }

  verEstadisticas(usuario: Usuario): void {
    this.usuarioSeleccionado = usuario;
    this.establecerFechasPorDefectoModal();
    this.cargarEstadisticasModal();
  }

  establecerFechasPorDefectoModal(): void {
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(hoy.getMonth() - 1);

    this.fechaFinModal = hoy.toISOString().split('T')[0];
    this.fechaInicioModal = haceUnMes.toISOString().split('T')[0];
  }

  cargarEstadisticasModal(): void {
    if (!this.usuarioSeleccionado) return;
    this.filtroEstadisticasModal.set({
      usuarioId: this.usuarioSeleccionado.id,
      inicio: this.fechaInicioModal,
      fin: this.fechaFinModal
    });
  }

  aplicarFiltrosEstadisticas(): void {
    this.cargarEstadisticasModal();
  }

  limpiarFiltrosEstadisticas(): void {
    this.establecerFechasPorDefectoModal();
    this.cargarEstadisticasModal();
  }

  cerrarEstadisticas(): void {
    this.usuarioSeleccionado = null;
    this.estadisticasGenerales = null;
    this.leccionesPopulares = [];
    this.filtroEstadisticasModal.set(null);
  }

  abrirModalEdicion(usuario: Usuario): void {
    this.usuarioEditando = usuario;
    this.formEdicion = {
      nombres: usuario.nombres || '',
      apellido_paterno: usuario.apellido_paterno || '',
      apellido_materno: usuario.apellido_materno || '',
      email: usuario.email || '',
      telefono: usuario.telefono || '',
      direccion: usuario.direccion || '',
      fecha_nacimiento: usuario.fecha_nacimiento ?
        new Date(usuario.fecha_nacimiento).toISOString().split('T')[0] : ''
    };
    this.mostrarModalEdicion = true;
  }

  cerrarModalEdicion(): void {
    if (this.guardandoEdicion()) {
      return;
    }
    this.mostrarModalEdicion = false;
    this.usuarioEditando = null;
  }

  guardarEdicion(): void {
    if (!this.usuarioEditando || this.guardandoEdicion()) return;

    const datosActualizados = {
      ...this.formEdicion,
      fecha_nacimiento: this.formEdicion.fecha_nacimiento || undefined
    };

    this.guardarEdicionMutation.mutate({ id: this.usuarioEditando.id, datos: datosActualizados });
  }

  abrirModalRol(usuario: Usuario): void {
    this.usuarioCambiandoRol = usuario;
    this.rolIdSeleccionado = usuario.rol?.id ?? null;
    this.mostrarModalRol = true;
  }

  cerrarModalRol(): void {
    if (this.guardandoRol()) {
      return;
    }
    this.mostrarModalRol = false;
    this.usuarioCambiandoRol = null;
    this.rolIdSeleccionado = null;
  }

  guardarRol(): void {
    if (!this.usuarioCambiandoRol || this.rolIdSeleccionado === null || this.guardandoRol()) return;

    this.guardarRolMutation.mutate({
      usuarioId: this.usuarioCambiandoRol.id,
      rolId: this.rolIdSeleccionado
    });
  }

  abrirModalPermisosRol(): void {
    if (this.rolIdSeleccionado === null) return;

    const rol = this.roles.find(r => r.id === this.rolIdSeleccionado);
    if (!rol) return;

    this.rolPermisosEditando = rol;
    this.permisosSeleccionados = rol.permisos.map(p => p.id);
    this.mostrarModalPermisosRol = true;
  }

  cerrarModalPermisosRol(): void {
    if (this.guardandoPermisos()) {
      return;
    }
    this.mostrarModalPermisosRol = false;
    this.rolPermisosEditando = null;
    this.permisosSeleccionados = [];
  }

  togglePermisoRol(permisoId: number): void {
    const indice = this.permisosSeleccionados.indexOf(permisoId);
    if (indice >= 0) {
      this.permisosSeleccionados.splice(indice, 1);
    } else {
      this.permisosSeleccionados.push(permisoId);
    }
  }

  tienePermisoSeleccionadoRol(permisoId: number): boolean {
    return this.permisosSeleccionados.includes(permisoId);
  }

  guardarPermisosRol(): void {
    if (!this.rolPermisosEditando || this.guardandoPermisos()) return;

    this.guardarPermisosRolMutation.mutate({
      rolId: this.rolPermisosEditando.id,
      permisos_ids: this.permisosSeleccionados
    });
  }

  eliminarUsuario(usuario: Usuario): void {
    if (this.usuarioIdEnAccion() !== null) return;

    const confirmacion = confirm(
      `¿Estás seguro de eliminar al usuario "${usuario.nombre_completo}"?\n\n` +
      `Esta acción es IRREVERSIBLE y eliminará:\n` +
      `- Todos sus progresos\n` +
      `- Todas sus estadísticas\n` +
      `- Todos sus datos personales\n\n` +
      `¿Deseas continuar?`
    );

    if (!confirmacion) return;

    const confirmacionFinal = confirm(
      `ÚLTIMA ADVERTENCIA:\n\n` +
      `Estás a punto de eliminar permanentemente al usuario:\n` +
      `${usuario.nombre_completo} (${usuario.email})\n\n` +
      `Esta acción NO se puede deshacer. ¿Continuar?`
    );

    if (!confirmacionFinal) return;

    this.usuarioIdEnAccion.set(usuario.id);
    this.eliminarUsuarioMutation.mutate(usuario.id);
  }

  cambiarEstadoUsuario(usuario: Usuario): void {
    if (this.usuarioIdEnAccion() !== null) return;

    const nuevoEstado = !usuario.activo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';

    if (confirm(`¿Estás seguro de ${accion} al usuario ${usuario.nombre_completo}?`)) {
      this.usuarioIdEnAccion.set(usuario.id);
      this.cambiarEstadoMutation.mutate({ id: usuario.id, activo: nuevoEstado });
    }
  }

  obtenerEtiquetaTipoUsuario(tipo: string): string {
    const etiquetas: { [key: string]: string } = {
      'peruano_mayor': 'Peruano Mayor',
      'peruano_menor': 'Peruano Menor',
      'extranjero': 'Extranjero'
    };
    return etiquetas[tipo] || tipo;
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroTipo = 'todos';
    this.filtroEstado = 'todos';
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    let filtrados = [...this.usuarios];

    if (this.filtroTexto) {
      const texto = this.filtroTexto.toLowerCase();
      filtrados = filtrados.filter(u =>
        u.nombre_completo?.toLowerCase().includes(texto) ||
        u.email.toLowerCase().includes(texto)
      );
    }

    if (this.filtroTipo !== 'todos') {
      filtrados = filtrados.filter(u => u.tipo_usuario === this.filtroTipo);
    }

    if (this.filtroEstado === 'activos') {
      filtrados = filtrados.filter(u => u.activo);
    } else if (this.filtroEstado === 'inactivos') {
      filtrados = filtrados.filter(u => !u.activo);
    }

    this.usuariosFiltrados = filtrados;
    this.paginaActual = 1;
  }

  get usuariosPaginados(): Usuario[] {
    const inicio = (this.paginaActual - 1) * this.usuariosPorPagina;
    const fin = inicio + this.usuariosPorPagina;
    return this.usuariosFiltrados.slice(inicio, fin);
  }

  get totalPaginas(): number {
    return Math.ceil(this.usuariosFiltrados.length / this.usuariosPorPagina);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  obtenerColorPopularidad(popularidad: string): string {
    return this.estadisticasService.obtenerColorPopularidad(popularidad);
  }

  exportarExcel(): void {
    if (this.usuariosFiltrados.length === 0) {
      alert('No hay usuarios para exportar');
      return;
    }

    try {
      const datosExportar = this.usuariosFiltrados.map(usuario => ({
        'ID': usuario.id,
        'Nombre Completo': usuario.nombre_completo || '',
        'Email': usuario.email,
        'DNI': usuario.dni || '-',
        'Pasaporte': usuario.pasaporte || '-',
        'Tipo Usuario': this.obtenerEtiquetaTipoUsuario(usuario.tipo_usuario),
        'Rol': usuario.rol?.nombre || 'Usuario',
        'Estado': usuario.activo ? 'Activo' : 'Inactivo',
        'Fecha Registro': this.formatearFecha(usuario.fecha_creacion)
      }));

      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosExportar);

      const columnWidths = [
        { wch: 8 },
        { wch: 30 },
        { wch: 35 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 }
      ];
      ws['!cols'] = columnWidths;

      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');

      const fechaActual = this.obtenerFechaActual();
      const nombreArchivo = `usuarios_${fechaActual}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);

      alert('Archivo Excel generado exitosamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      alert('Error al generar el archivo Excel');
    }
  }

  exportarPDF(): void {
    if (this.usuariosFiltrados.length === 0) {
      alert('No hay usuarios para exportar');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');

      doc.setFontSize(18);
      doc.text('Reporte de Usuarios', 14, 15);

      doc.setFontSize(11);
      doc.text(`Fecha de generación: ${this.obtenerFechaHoraActual()}`, 14, 23);
      doc.text(`Total de usuarios: ${this.usuariosFiltrados.length}`, 14, 29);

      const datosTabla = this.usuariosFiltrados.map(usuario => [
        usuario.id.toString(),
        usuario.nombre_completo || '',
        usuario.email,
        usuario.dni || usuario.pasaporte || '-',
        this.obtenerEtiquetaTipoUsuario(usuario.tipo_usuario),
        usuario.rol?.nombre || 'Usuario',
        usuario.activo ? 'Activo' : 'Inactivo',
        this.formatearFecha(usuario.fecha_creacion)
      ]);

      doc.autoTable({
        startY: 35,
        head: [['ID', 'Nombre', 'Email', 'Documento', 'Tipo', 'Rol', 'Estado', 'Fecha Registro']],
        body: datosTabla,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 45 },
          2: { cellWidth: 50 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 28 }
        },
        margin: { left: 14, right: 14 }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 35;
      doc.setFontSize(10);

      const activos = this.usuariosFiltrados.filter(u => u.activo).length;
      const inactivos = this.usuariosFiltrados.filter(u => !u.activo).length;

      doc.text(`Usuarios activos: ${activos}`, 14, finalY + 10);
      doc.text(`Usuarios inactivos: ${inactivos}`, 14, finalY + 16);

      const fechaActual = this.obtenerFechaActual();
      const nombreArchivo = `usuarios_${fechaActual}.pdf`;

      doc.save(nombreArchivo);

      alert('Archivo PDF generado exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el archivo PDF');
    }
  }

  private formatearFecha(fecha: string | Date | null | undefined): string {
    if (!fecha) return '-';

    try {
      const fechaObj = new Date(fecha);
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const anio = fechaObj.getFullYear();
      return `${dia}/${mes}/${anio}`;
    } catch (error) {
      return '-';
    }
  }

  private obtenerFechaActual(): string {
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}-${mes}-${anio}`;
  }

  private obtenerFechaHoraActual(): string {
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }

  formatearTiempo(segundos: number): string {
    return this.estadisticasService.formatearTiempo(segundos);
  }

  formatearTiempoMinutos(minutos: number): string {
    return this.estadisticasService.formatearTiempoDesdeMinutos(minutos);
  }
}
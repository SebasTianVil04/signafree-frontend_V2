import { Component, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { AdminService, DashboardEstadisticas } from '../../../servicios/admin.service';

const QK_DASHBOARD = ['dashboardAdmin'] as const;
const STALE_DASHBOARD = 60 * 1000;

@Component({
  selector: 'app-panel-admin',
  templateUrl: './panel-admin.component.html',
  styleUrls: ['./panel-admin.component.scss'],
  standalone: false
})
export class PanelAdminComponent implements OnInit {
  estadisticas: DashboardEstadisticas | null = null;
  error: string | null = null;

  datosUsuarios: number[] = [];
  etiquetasUsuarios: string[] = [];

  datosLecciones: number[] = [];
  etiquetasLecciones: string[] = [];

  datosProgreso: number[] = [];
  etiquetasProgreso: string[] = [];

  datosExamenes: number[] = [];
  etiquetasExamenes: string[] = [];

  opcionesMenu = [
    {
      titulo: 'Gestión de Usuarios',
      descripcion: 'Administrar usuarios del sistema',
      icono: 'bi-people-fill',
      ruta: '/admin/usuarios',
      color: 'primary'
    },
    {
      titulo: 'Gestión de Lecciones',
      descripcion: 'Crear y editar lecciones',
      icono: 'bi-journal-text',
      ruta: '/admin/lecciones',
      color: 'success'
    },
    {
      titulo: 'Entrenamiento de Modelo',
      descripcion: 'Entrenar modelo de reconocimiento',
      icono: 'bi-cpu',
      ruta: '/admin/entrenamiento',
      color: 'danger'
    },
    {
      titulo: 'Estadísticas',
      descripcion: 'Ver reportes y análisis',
      icono: 'bi-bar-chart-fill',
      ruta: '/admin/estadisticas',
      color: 'info'
    }
  ];

  private queryClient = injectQueryClient();

  private dashboardQuery = injectQuery(() => ({
    queryKey: QK_DASHBOARD,
    queryFn: () => firstValueFrom(this.adminService.obtenerDashboard()),
    staleTime: STALE_DASHBOARD
  }));

  constructor(
    private adminService: AdminService,
    private router: Router
  ) {
    effect(() => {
      const data = this.dashboardQuery.data();
      if (data) {
        this.estadisticas = data;
        this.prepararDatosGraficos();
      }
    });

    effect(() => {
      if (this.dashboardQuery.isError()) {
        this.error = 'Error al cargar estadísticas del dashboard';
        console.error('Error:', this.dashboardQuery.error());
      } else {
        this.error = null;
      }
    });
  }

  get cargando(): boolean {
    return this.dashboardQuery.isPending();
  }

  ngOnInit(): void {
  }

  cargarDashboard(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_DASHBOARD });
  }

  prepararDatosGraficos(): void {
    if (!this.estadisticas) return;

    this.datosUsuarios = [
      this.estadisticas.usuarios.activos,
      this.estadisticas.usuarios.total - this.estadisticas.usuarios.activos
    ];
    this.etiquetasUsuarios = ['Activos', 'Inactivos'];

    this.datosLecciones = [
      this.estadisticas.lecciones.activas,
      this.estadisticas.lecciones.total - this.estadisticas.lecciones.activas
    ];
    this.etiquetasLecciones = ['Activas', 'Inactivas'];

    this.etiquetasProgreso = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    this.datosProgreso = [
      this.estadisticas.rendimiento.progreso_promedio - 15,
      this.estadisticas.rendimiento.progreso_promedio - 10,
      this.estadisticas.rendimiento.progreso_promedio - 5,
      this.estadisticas.rendimiento.progreso_promedio,
      this.estadisticas.rendimiento.progreso_promedio + 5,
      this.estadisticas.rendimiento.progreso_promedio + 3,
      this.estadisticas.rendimiento.progreso_promedio + 8
    ];

    this.datosExamenes = [
      this.estadisticas.examenes.completados,
      this.estadisticas.examenes.total - this.estadisticas.examenes.completados
    ];
    this.etiquetasExamenes = ['Completados', 'Pendientes'];
  }

  navegarA(ruta: string): void {
    this.router.navigate([ruta]);
  }

  calcularPorcentajeUsuariosActivos(): number {
    if (!this.estadisticas) return 0;
    const { total, activos } = this.estadisticas.usuarios;
    return total > 0 ? Math.round((activos / total) * 100) : 0;
  }

  calcularPorcentajeLeccionesActivas(): number {
    if (!this.estadisticas) return 0;
    const { total, activas } = this.estadisticas.lecciones;
    return total > 0 ? Math.round((activas / total) * 100) : 0;
  }
}
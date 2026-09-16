import { Component, OnInit, effect, signal } from '@angular/core';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { EstadisticasResponse, EstadisticasService, LeccionPopular } from '../../../servicios/estadisticas.service';

export interface ReporteUso {
  total_sesiones: number;
  sesiones_completadas: number;
  usuarios_activos: number;
  tiempo_promedio_sesion: number;
  tiempo_total_estudio: number;
  puntuacion_promedio: number;
  lecciones_mas_populares: LeccionPopularAdaptada[];
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface LeccionPopularAdaptada {
  leccion_id: number;
  leccion_titulo: string;
  completadas: number;
  tiempo_promedio: number;
  tiempo_promedio_minutos: number;
  popularidad: string;
  categoria: string;
}

const STALE_ESTADISTICAS = 60 * 1000;

@Component({
  selector: 'app-estadisticas-admin',
  templateUrl: './estadisticas-admin.component.html',
  styleUrls: ['./estadisticas-admin.component.scss'],
  standalone: false
})
export class EstadisticasAdminComponent implements OnInit {
  reporte: ReporteUso | null = null;
  error: string | null = null;

  fechaInicio: string = '';
  fechaFin: string = '';

  private jsPDF: any;
  private autoTable: any;
  private libreriasPDFCargadas = false;

  private queryClient = injectQueryClient();
  private filtroFechas = signal<{ inicio: string; fin: string }>({ inicio: '', fin: '' });

  private estadisticasQuery = injectQuery(() => ({
    queryKey: ['estadisticasAdmin', this.filtroFechas().inicio, this.filtroFechas().fin],
    queryFn: () => firstValueFrom(
      this.estadisticasService.obtenerEstadisticas(this.filtroFechas().inicio, this.filtroFechas().fin)
    ),
    staleTime: STALE_ESTADISTICAS,
    enabled: !!this.filtroFechas().inicio && !!this.filtroFechas().fin
  }));

  constructor(private estadisticasService: EstadisticasService) {
    effect(() => {
      const response = this.estadisticasQuery.data();
      if (response) {
        this.reporte = response.success
          ? this.adaptarReporte(response)
          : this.obtenerReporteVacio();
      }
    });

    effect(() => {
      if (this.estadisticasQuery.isError()) {
        const err = this.estadisticasQuery.error() as any;
        this.error = 'Error al cargar estadísticas: ' + (err?.error?.detail || err?.message || 'Error desconocido');
        this.reporte = this.obtenerReporteVacio();
      } else {
        this.error = null;
      }
    });
  }

  get cargando(): boolean {
    return this.estadisticasQuery.isPending() || this.estadisticasQuery.isFetching();
  }

  ngOnInit(): void {
    this.establecerFechasPorDefecto();
    this.cargarEstadisticas();
  }

  private establecerFechasPorDefecto(): void {
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);

    this.fechaInicio = hace30Dias.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  private async cargarLibreriasPDF(): Promise<void> {
    if (this.libreriasPDFCargadas) return;

    try {
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      this.jsPDF = jsPDFModule.default;
      this.autoTable = autoTableModule.default;
      this.libreriasPDFCargadas = true;
    } catch (error) {
      console.error('Error cargando librerías PDF:', error);
      throw error;
    }
  }

  cargarEstadisticas(): void {
    this.error = null;
    this.filtroFechas.set({ inicio: this.fechaInicio, fin: this.fechaFin });
  }

  private adaptarReporte(response: EstadisticasResponse): ReporteUso {
    const stats = response.estadisticas_generales;

    return {
      total_sesiones: stats.total_sesiones,
      sesiones_completadas: stats.sesiones_completadas,
      usuarios_activos: stats.usuarios_activos,
      tiempo_promedio_sesion: this.estadisticasService.redondearTiempoPromedio(stats.tiempo_promedio_segundos),
      tiempo_total_estudio: stats.tiempo_total_segundos,
      puntuacion_promedio: 0,
      lecciones_mas_populares: this.adaptarLeccionesPopulares(response.lecciones_populares),
      fecha_inicio: response.fecha_inicio,
      fecha_fin: response.fecha_fin
    };
  }

  private adaptarLeccionesPopulares(lecciones: LeccionPopular[]): LeccionPopularAdaptada[] {
    if (!lecciones || !Array.isArray(lecciones)) return [];

    return lecciones.map(leccion => ({
      leccion_id: leccion.leccion_id,
      leccion_titulo: leccion.titulo,
      completadas: leccion.completadas,
      tiempo_promedio: this.estadisticasService.redondearTiempoPromedio(leccion.tiempo_promedio_segundos),
      tiempo_promedio_minutos: this.estadisticasService.redondearMinutos(leccion.tiempo_promedio_minutos),
      popularidad: leccion.popularidad,
      categoria: leccion.categoria
    }));
  }

  private obtenerReporteVacio(): ReporteUso {
    return {
      total_sesiones: 0,
      sesiones_completadas: 0,
      usuarios_activos: 0,
      tiempo_promedio_sesion: 0,
      tiempo_total_estudio: 0,
      puntuacion_promedio: 0,
      lecciones_mas_populares: []
    };
  }

  aplicarFiltros(): void {
    if (this.fechaInicio && this.fechaFin) {
      if (new Date(this.fechaInicio) > new Date(this.fechaFin)) {
        alert('La fecha de inicio no puede ser mayor que la fecha de fin');
        return;
      }
    }
    this.cargarEstadisticas();
  }

  limpiarFiltros(): void {
    this.establecerFechasPorDefecto();
    this.cargarEstadisticas();
  }

  exportarExcel(): void {
    if (!this.reporte || !this.tieneDatos) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      const datosExportar = [
        {
          'Métrica': 'Total Sesiones',
          'Valor': this.reporte.total_sesiones
        },
        {
          'Métrica': 'Sesiones Completadas',
          'Valor': this.reporte.sesiones_completadas
        },
        {
          'Métrica': 'Porcentaje Completadas',
          'Valor': `${this.calcularPorcentajeCompletadas()}%`
        },
        {
          'Métrica': 'Usuarios Activos',
          'Valor': this.reporte.usuarios_activos
        },
        {
          'Métrica': 'Tiempo Promedio Sesión',
          'Valor': this.tiempoPromedioFormateado
        },
        {
          'Métrica': 'Tiempo Total Estudio',
          'Valor': this.tiempoTotalFormateado
        }
      ];

      const leccionesExportar = this.reporte.lecciones_mas_populares.map((leccion, index) => ({
        'Ranking': index + 1,
        'ID Lección': leccion.leccion_id,
        'Título': leccion.leccion_titulo,
        'Categoría': leccion.categoria,
        'Completadas': leccion.completadas,
        'Tiempo Promedio (segundos)': leccion.tiempo_promedio.toFixed(2),
        'Tiempo Promedio (minutos)': leccion.tiempo_promedio_minutos.toFixed(2),
        'Popularidad': leccion.popularidad
      }));

      const ws1: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosExportar);
      const ws2: XLSX.WorkSheet = XLSX.utils.json_to_sheet(leccionesExportar);

      ws1['!cols'] = [
        { wch: 25 },
        { wch: 15 }
      ];

      ws2['!cols'] = [
        { wch: 8 },
        { wch: 10 },
        { wch: 30 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 }
      ];

      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Estadísticas Generales');
      XLSX.utils.book_append_sheet(wb, ws2, 'Lecciones Populares');

      const fechaActual = this.obtenerFechaActual();
      const nombreArchivo = `reporte_estadisticas_${fechaActual}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);

      alert('Archivo Excel generado exitosamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      alert('Error al generar el archivo Excel');
    }
  }

  async exportarPDF(): Promise<void> {
    if (!this.reporte || !this.tieneDatos) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      if (!this.libreriasPDFCargadas) {
        await this.cargarLibreriasPDF();
      }

      const doc = new this.jsPDF('p', 'mm', 'a4');

      doc.setFontSize(16);
      doc.text('Reporte de Estadísticas', 14, 15);

      doc.setFontSize(11);
      doc.text(`Período: ${this.formatearFecha(this.fechaInicio)} - ${this.formatearFecha(this.fechaFin)}`, 14, 23);
      doc.text(`Fecha de generación: ${this.obtenerFechaHoraActual()}`, 14, 29);

      let yPos = 40;

      doc.setFontSize(12);
      doc.text('Estadísticas Generales', 14, yPos);
      yPos += 10;

      const datosGenerales = [
        ['Métrica', 'Valor'],
        ['Total Sesiones', this.reporte.total_sesiones.toString()],
        ['Sesiones Completadas', this.reporte.sesiones_completadas.toString()],
        ['Porcentaje Completadas', `${this.calcularPorcentajeCompletadas()}%`],
        ['Usuarios Activos', this.reporte.usuarios_activos.toString()],
        ['Tiempo Promedio', this.tiempoPromedioFormateado],
        ['Tiempo Total', this.tiempoTotalFormateado]
      ];

      this.autoTable(doc, {
        startY: yPos,
        head: [datosGenerales[0]],
        body: datosGenerales.slice(1),
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        margin: { left: 14, right: 14 }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      if (this.reporte.lecciones_mas_populares.length > 0) {
        doc.setFontSize(12);
        doc.text('Lecciones Más Populares', 14, yPos);
        yPos += 10;

        const datosLecciones = this.reporte.lecciones_mas_populares.map((leccion, index) => [
          (index + 1).toString(),
          leccion.leccion_titulo,
          leccion.categoria,
          leccion.completadas.toString(),
          this.formatearTiempo(leccion.tiempo_promedio),
          leccion.popularidad
        ]);

        this.autoTable(doc, {
          startY: yPos,
          head: [['#', 'Lección', 'Categoría', 'Completadas', 'Tiempo Promedio', 'Popularidad']],
          body: datosLecciones,
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 60 },
            2: { cellWidth: 30 },
            3: { cellWidth: 20 },
            4: { cellWidth: 25 },
            5: { cellWidth: 20 }
          },
          margin: { left: 14, right: 14 }
        });
      }

      const fechaActual = this.obtenerFechaActual();
      const nombreArchivo = `reporte_estadisticas_${fechaActual}.pdf`;

      doc.save(nombreArchivo);

      alert('Archivo PDF generado exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el archivo PDF');
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

  private formatearFecha(fecha: string): string {
    if (!fecha) return '';
    try {
      const [year, month, day] = fecha.split('-');
      return `${day}/${month}/${year}`;
    } catch (error) {
      return fecha;
    }
  }

  calcularPorcentajeCompletadas(): number {
    if (!this.reporte || this.reporte.total_sesiones === 0) return 0;
    return Math.round((this.reporte.sesiones_completadas / this.reporte.total_sesiones) * 100);
  }

  formatearTiempo(segundos: number): string {
    return this.estadisticasService.formatearTiempo(segundos);
  }

  obtenerTituloLeccion(leccion: LeccionPopularAdaptada): string {
    return leccion.leccion_titulo || `Lección ${leccion.leccion_id}`;
  }

  get tiempoTotalFormateado(): string {
    return this.reporte ? this.formatearTiempo(this.reporte.tiempo_total_estudio) : '0m';
  }

  get tiempoPromedioFormateado(): string {
    return this.reporte ? this.formatearTiempo(this.reporte.tiempo_promedio_sesion) : '0m';
  }

  get tieneDatos(): boolean {
    return this.reporte !== null && this.reporte.total_sesiones > 0;
  }

  obtenerColorPopularidad(popularidad: string): string {
    switch (popularidad) {
      case 'Alta': return 'bg-success text-white';
      case 'Media': return 'bg-warning text-dark';
      case 'Baja': return 'bg-secondary text-white';
      default: return 'bg-light text-dark';
    }
  }

  obtenerPorcentajePopularidad(leccion: LeccionPopularAdaptada): number {
    if (!this.reporte || this.reporte.lecciones_mas_populares.length === 0) return 0;

    const maxCompletadas = Math.max(...this.reporte.lecciones_mas_populares.map(l => l.completadas));
    if (maxCompletadas === 0) return 0;

    return (leccion.completadas / maxCompletadas) * 100;
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EstadisticasGenerales {
  total_sesiones: number;
  sesiones_completadas: number;
  porcentaje_completadas: number;
  usuarios_activos: number;
  tiempo_promedio_segundos: number;
  tiempo_total_segundos: number;
  tiempo_promedio_minutos: number;
  tiempo_total_minutos: number;
  tiempo_promedio_display: string;
  tiempo_total_display: string;
}

export interface LeccionPopular {
  leccion_id: number;
  titulo: string;
  categoria: string;
  completadas: number;
  usuarios_unicos: number;
  tiempo_promedio_segundos: number;
  tiempo_promedio_minutos: number;
  popularidad: string;
}

export interface EstadisticasResponse {
  success: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  estadisticas_generales: EstadisticasGenerales;
  lecciones_populares: LeccionPopular[];
}

const COLORES_POPULARIDAD: Record<string, string> = {
  alta: 'success',
  media: 'warning',
  baja: 'secondary'
};

@Injectable({
  providedIn: 'root'
})
export class EstadisticasService {
  private readonly apiUrl = `${environment.apiUrl}/estadisticas`;

  constructor(private http: HttpClient) { }

  private redondear(valor: number): number {
    return valor ? Math.round(valor * 100) / 100 : 0;
  }

  obtenerEstadisticas(fechaInicio?: string, fechaFin?: string): Observable<EstadisticasResponse> {
    let params = new HttpParams();
    if (fechaInicio) params = params.set('fecha_inicio', fechaInicio);
    if (fechaFin) params = params.set('fecha_fin', fechaFin);

    return this.http.get<EstadisticasResponse>(`${this.apiUrl}/`, { params });
  }

  obtenerEstadisticasRangoFechas(fechaInicio: string, fechaFin: string): Observable<EstadisticasResponse> {
    const params = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    return this.http.get<EstadisticasResponse>(`${this.apiUrl}/rango-fechas`, { params });
  }

  formatearTiempo(segundos: number): string {
    if (!segundos) return '0m';

    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);

    if (horas > 0) {
      const minutosRestantes = minutos % 60;
      return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}m` : `${horas}h`;
    }

    if (minutos > 0) {
      const segundosRestantes = segundos % 60;
      return segundosRestantes > 0 ? `${minutos}m ${segundosRestantes}s` : `${minutos}m`;
    }

    return `${segundos}s`;
  }

  formatearTiempoDesdeMinutos(minutos: number): string {
    if (!minutos) return '0m';
    return this.formatearTiempo(Math.round(minutos * 60));
  }

  formatearFechaParaDisplay(fecha: string): string {
    if (!fecha) return '';

    const [year, month, day] = fecha.split('-');
    return year && month && day ? `${day}/${month}/${year}` : fecha;
  }

  calcularPorcentajeCompletadas(totalSesiones: number, sesionesCompletadas: number): number {
    return totalSesiones ? Math.round((sesionesCompletadas / totalSesiones) * 100) : 0;
  }

  obtenerColorPopularidad(popularidad: string): string {
    return COLORES_POPULARIDAD[popularidad?.toLowerCase()] ?? 'light';
  }

  redondearTiempoPromedio(tiempoSegundos: number): number {
    return this.redondear(tiempoSegundos);
  }

  redondearMinutos(minutos: number): number {
    return this.redondear(minutos);
  }
}
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

@Injectable({
  providedIn: 'root'
})
export class EstadisticasService {
  private apiUrl = `${environment.apiUrl}/estadisticas`;

  constructor(private http: HttpClient) { }

  obtenerEstadisticas(fechaInicio?: string, fechaFin?: string): Observable<EstadisticasResponse> {
    let params = new HttpParams();
    
    if (fechaInicio) {
      params = params.set('fecha_inicio', fechaInicio);
    }
    
    if (fechaFin) {
      params = params.set('fecha_fin', fechaFin);
    }

    return this.http.get<EstadisticasResponse>(`${this.apiUrl}/`, { params });
  }

  obtenerEstadisticasRangoFechas(fechaInicio: string, fechaFin: string): Observable<EstadisticasResponse> {
    const params = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    return this.http.get<EstadisticasResponse>(`${this.apiUrl}/rango-fechas`, { params });
  }

  formatearTiempo(segundos: number): string {
    if (!segundos || segundos === 0) return '0m';
    
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
    if (!minutos || minutos === 0) return '0m';
    
    if (minutos < 1) {
      const segundos = Math.round(minutos * 60);
      return `${segundos}s`;
    } else if (minutos < 60) {
      const minutosEnteros = Math.floor(minutos);
      const segundos = Math.round((minutos - minutosEnteros) * 60);
      return segundos > 0 ? `${minutosEnteros}m ${segundos}s` : `${minutosEnteros}m`;
    } else {
      const horas = Math.floor(minutos / 60);
      const minutosRestantes = Math.round(minutos % 60);
      return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}m` : `${horas}h`;
    }
  }

  formatearFechaParaDisplay(fecha: string): string {
    if (!fecha) return '';
    
    try {
      const [year, month, day] = fecha.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return fecha;
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return fecha;
    }
  }

  calcularPorcentajeCompletadas(totalSesiones: number, sesionesCompletadas: number): number {
    if (!totalSesiones || totalSesiones === 0) return 0;
    return Math.round((sesionesCompletadas / totalSesiones) * 100);
  }

  obtenerColorPopularidad(popularidad: string): string {
    switch (popularidad?.toLowerCase()) {
      case 'alta': return 'success';
      case 'media': return 'warning';
      case 'baja': return 'secondary';
      default: return 'light';
    }
  }

  redondearTiempoPromedio(tiempoSegundos: number): number {
    if (!tiempoSegundos || tiempoSegundos === 0) return 0;
    return Math.round(tiempoSegundos * 100) / 100;
  }


  redondearMinutos(minutos: number): number {
    if (!minutos || minutos === 0) return 0;
    return Math.round(minutos * 100) / 100;
  }
}
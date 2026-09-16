import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, map } from 'rxjs/operators';
import { HttpContext } from '@angular/common/http';
import { SKIP_GLOBAL_LOADING } from '../interceptores/loading-context';


export interface ProgresoClase {
  id?: number;
  usuario_id?: number;
  clase_id?: number;
  vista: boolean;
  completada: boolean;
  aprobada: boolean;
  intentos_realizados: number;
  intentos_exitosos: number;
  mejor_precision: number;
  ultima_precision: number;
  precision_promedio: number;
  puntos_ganados: number;
  xp_ganado: number;
  tiempo_total_practica: number;
  tiempo_promedio_intento: number;
  racha_dias_consecutivos: number;
  mejor_racha: number;
  porcentaje_precision: string;
  tasa_exito: number;
  porcentaje_tasa_exito: string;
  eficiencia_puntos: number;
  nivel_dominio: string;
  dias_desde_ultima_practica: number;
  esta_en_racha: boolean;
  fecha_primera_vista?: string;
  fecha_completada?: string;
  fecha_mejor_precision?: string;
  ultima_practica?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface ProgresoLeccion {
  id: number;
  usuario_id: number;
  leccion_id: number;
  desbloqueada: boolean;
  bloqueada: boolean;
  iniciada: boolean;
  completada: boolean;
  total_clases: number;
  clases_completadas: number;
  clases_aprobadas: number;
  clases_vistas: number;
  mejor_precision: number;
  precision_promedio: number;
  total_intentos: number;
  intentos_exitosos: number;
  total_puntos: number;
  xp_total: number;
  puntos_bonificacion_completa: number;
  xp_bonificacion_completa: number;
  puntos_maximos_posibles: number;
  estrellas: number;
  estrella_dorada: boolean;
  tiempo_total_minutos: number;
  tiempo_promedio_clase_minutos: number;
  examenes_disponibles: number;
  examenes_completados: number;
  examenes_aprobados: number;
  mejor_calificacion_examen?: number;
  racha_dias_consecutivos: number;
  dias_activos: number;
  porcentaje_completado: number;
  porcentaje_precision: string;
  tasa_exito_general: number;
  eficiencia_puntos: number;
  nivel_dominio_leccion: string;
  tiene_estrella_dorada: boolean;
  dias_desde_ultima_actividad: number;
  fecha_desbloqueo?: string;
  fecha_inicio?: string;
  fecha_completada?: string;
  ultima_practica?: string;
}

export interface ResumenProgreso {
  total_lecciones: number;
  lecciones_completadas: number;
  porcentaje_completado: number;
  total_puntos: number;
  total_estrellas: number;
  progresos: ProgresoLeccion[];
}

export interface RegistroIntentoRequest {
  precision: number;
  duracion_segundos: number;
  es_exitoso?: boolean;
}

export interface RegistroIntentoRespuesta {
  puntos_ganados: number;
  xp_ganado: number;
  precision: number;
  es_exitoso: boolean;
  nivel_dominio: string;
  clase_aprobada: boolean;
  clase_completada: boolean;
}

export interface ResumenDesempenoClase {
  clase_id: number;
  completada: boolean;
  aprobada: boolean;
  intentos_realizados: number;
  intentos_exitosos: number;
  tasa_exito: number;
  mejor_precision: number;
  precision_promedio: number;
  ultima_precision: number;
  nivel_dominio: string;
  puntos_ganados: number;
  xp_ganado: number;
  tiempo_total_practica_minutos: number;
  racha_dias_consecutivos: number;
  mejor_racha: number;
  dias_desde_ultima_practica: number;
  fecha_completada?: string;
}

export interface SesionEstudioCrear {
  clase_id?: number;
  leccion_id?: number;
  tipo_sesion: 'clase' | 'practica' | 'examen' | 'video';
  fecha_inicio: string;
  fecha_fin?: string;
  duracion_segundos: number;
  dispositivo?: string;
  user_agent?: string;
}

export interface SesionEstudio extends SesionEstudioCrear {
  id?: number;
  usuario_id?: number;
  fecha_creacion?: string;
}

export interface EstadisticasTiempo {
  tiempo_total_segundos: number;
  tiempo_total_formateado: string;
  total_sesiones: number;
  sesiones_por_tipo: Array<{
    tipo: string;
    cantidad: number;
    tiempo_total: number;
    tiempo_formateado: string;
  }>;
  tiempo_por_dia: Array<{
    fecha: string;
    tiempo_segundos: number;
    tiempo_formateado: string;
  }>;
  promedio_diario: string;
}

export interface TiempoTotalUsuario {
  tiempo_total_segundos: number;
  tiempo_total_formateado: string;
  total_sesiones: number;
}

export interface EstadisticasGamificacion {
  puntos_totales: number;
  xp_total: number;
  nivel_actual: number;
  progreso_nivel: number;
  lecciones_completadas: number;
  total_lecciones: number;
  clases_completadas: number;
  total_clases: number;
  racha_actual: number;
  mejor_racha: number;
  tiempo_total_practica_horas: number;
  precision_global: number;
  rank_global?: number;
  logros_desbloqueados: number;
  total_logros: number;
}

export interface RankingUsuario {
  usuario_id: number;
  nombre_usuario: string;
  puntos_totales: number;
  nivel: number;
  lecciones_completadas: number;
  racha_actual: number;
  posicion: number;
  avatar_url?: string;
}

export interface ResultadoPracticaRequest {
  precision: number;
  tiempo_practica: number;
  sena_reconocida: string;
  es_exitoso?: boolean;
}

export interface ResultadoPracticaResponse {
  exito: boolean;
  mensaje: string;
  progreso: ProgresoClase;
  clase_completada: boolean;
  puntos_ganados: number;
  xp_ganado: number;
  racha_actual: number;
  nivel_subido: boolean;
  nuevo_nivel?: number;
  requisitos: {
    intentos_minimos: number;
    precision_minima: number;
    cumple_intentos: boolean;
    cumple_precision: boolean;
    sena_correcta: boolean;
    sena_esperada: string;
    sena_reconocida: string;
  };
}

export interface RespuestaGuardarPractica {
  exito: boolean;
  mensaje: string;
  progreso: ProgresoClase;
  clase_completada: boolean;
  puntos_ganados: number;
  xp_ganado: number;
  racha_actual: number;
  nivel_subido: boolean;
  nuevo_nivel?: number;
  requisitos: {
    intentos_minimos: number;
    precision_minima: number;
    cumple_intentos: boolean;
    cumple_precision: boolean;
    sena_correcta: boolean;
    sena_esperada: string;
    sena_reconocida: string;
  };
}

export interface RespuestaAPI {
  exito: boolean;
  mensaje: string;
  datos: any;
  errores?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ProgresoService {
  private apiUrl = `${environment.apiUrl}/progreso`;
  private estudioUrl = `${environment.apiUrl}/estudio`;

  constructor(private http: HttpClient) { }

  obtenerTiempoTotalUsuario(): Observable<TiempoTotalUsuario> {
    return this.http.get<TiempoTotalUsuario>(`${this.estudioUrl}/usuario/total`);
  }

  obtenerEstadisticasTiempo(rangoDias: number = 30): Observable<EstadisticasTiempo> {
    return this.http.get<EstadisticasTiempo>(`${this.estudioUrl}/estadisticas?rango_dias=${rangoDias}`);
  }

  obtenerSesionesRecientes(limite: number = 10): Observable<SesionEstudio[]> {
    return this.http.get<SesionEstudio[]>(`${this.estudioUrl}/sesiones/recientes?limite=${limite}`);
  }

  crearSesionEstudio(sesionData: SesionEstudioCrear): Observable<any> {
    return this.http.post(`${this.estudioUrl}/sesiones`, sesionData);
  }

  obtenerProgresoClase(claseId: number): Observable<ProgresoClase> {
    return this.http.get<ProgresoClase>(`${this.apiUrl}/clase/${claseId}`);
  }

  marcarClaseVista(claseId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/clase/${claseId}/marcar-vista`, {});
  }

  registrarIntentoPractica(
    claseId: number,
    intento: RegistroIntentoRequest
  ): Observable<RegistroIntentoRespuesta> {
    return this.http.post<RegistroIntentoRespuesta>(
      `${this.apiUrl}/clase/${claseId}/practica`,
      intento
    );
  }

  obtenerResumenDesempenoClase(claseId: number): Observable<ResumenDesempenoClase> {
    return this.http.get<ResumenDesempenoClase>(`${this.apiUrl}/clase/${claseId}/resumen`);
  }

  obtenerProgresoLeccion(leccionId: number): Observable<ProgresoLeccion> {
    return this.http.get<ProgresoLeccion>(`${this.apiUrl}/leccion/${leccionId}`);
  }

  obtenerResumenUsuario(): Observable<ResumenProgreso> {
    return this.http.get<ResumenProgreso>(`${this.apiUrl}/usuario/resumen`, {
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }

  obtenerRanking(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/ranking`).pipe(
      map((respuesta: any) => {
        if (respuesta.exito && respuesta.datos) {
          return respuesta.datos;
        } else if (Array.isArray(respuesta)) {
          return respuesta;
        } else if (respuesta.datos && Array.isArray(respuesta.datos)) {
          return respuesta.datos;
        } else {
          return [];
        }
      }),
      catchError(error => {
        return of([]);
      })
    );
  }

  obtenerEstadisticasGamificacion(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/estadisticas/gamificacion`).pipe(
      map((respuesta: any) => {
        if (respuesta.exito && respuesta.datos) {
          return respuesta.datos;
        } else if (respuesta.puntos_totales !== undefined) {
          return respuesta;
        } else {
          return {
            puntos_totales: 0,
            xp_total: 0,
            nivel_actual: 1,
            progreso_nivel: 0,
            lecciones_completadas: 0,
            total_lecciones: 0,
            clases_completadas: 0,
            total_clases: 0,
            racha_actual: 0,
            mejor_racha: 0,
            tiempo_total_practica_horas: 0,
            precision_global: 0,
            logros_desbloqueados: 0,
            total_logros: 10
          };
        }
      }),
      catchError(error => {
        return of({
          puntos_totales: 0,
          xp_total: 0,
          nivel_actual: 1,
          progreso_nivel: 0,
          lecciones_completadas: 0,
          total_lecciones: 0,
          clases_completadas: 0,
          total_clases: 0,
          racha_actual: 0,
          mejor_racha: 0,
          tiempo_total_practica_horas: 0,
          precision_global: 0,
          logros_desbloqueados: 0,
          total_logros: 10
        });
      })
    );
  }

  guardarResultadoPractica(
    claseId: number,
    precision: number,
    tiempoPractica: number,
    senaReconocida: string
  ): Observable<RespuestaGuardarPractica> {
    return this.http.post<RespuestaGuardarPractica>(
      `${this.apiUrl}/clases/${claseId}/practica`,
      {
        precision: precision,
        tiempo_practica: tiempoPractica,
        sena_reconocida: senaReconocida,
        es_exitoso: precision >= 0.7
      }
    );
  }

  guardarResultadoPracticaCompleto(
    claseId: number,
    datos: ResultadoPracticaRequest
  ): Observable<RespuestaGuardarPractica> {
    return this.http.post<RespuestaGuardarPractica>(
      `${this.apiUrl}/clases/${claseId}/practica`,
      datos
    );
  }

  actualizarProgresoLecciones() {
    return this.http.post(`${this.apiUrl}/actualizar-progreso`, {});
  }

}
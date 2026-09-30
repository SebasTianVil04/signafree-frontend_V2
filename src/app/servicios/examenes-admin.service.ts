import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExamenAdmin {
  id?: number;
  titulo: string;
  descripcion?: string;
  tipo: 'nivel' | 'final';
  nivel?: number;
  leccion_id: number;
  orden?: number;
  clases_requeridas?: number;
  requiere_todas_clases?: boolean;
  tiempo_limite?: number;
  puntuacion_minima: number;
  activo?: boolean;
  total_preguntas?: number;
  fecha_creacion?: string;
  preguntas?: PreguntaExamen[];
}

export interface EstadisticasExamen {
  total_intentos: number;
  promedio_puntuacion: number;
  tasa_aprobacion: number;
  intentos_recientes: Array<{
    usuario_id: number;
    usuario_nombre: string;
    usuario_email: string;
    puntuacion: number;
    puntuacion_obtenida: number;
    puntuacion_maxima: number;
    aprobado: boolean;
    fecha_intento: string;
    duracion_segundos: number;
  }>;
  distribucion_puntuaciones: Array<{
    rango: string;
    cantidad: number;
  }>;
  progreso_tiempo: Array<{
    fecha: string;
    intentos: number;
    promedio_puntuacion: number;
  }>;
  detalles_examen?: {
    puntuacion_minima: number;
    total_preguntas: number;
    puntos_totales: number;
  };
}

export interface PreguntaExamen {
  id?: number;
  examen_id: number;
  leccion_id?: number;
  pregunta: string;
  tipo_pregunta: 'reconocimiento' | 'multiple' | 'verdadero_falso';
  sena_esperada?: string;
  imagen_sena?: string;
  opciones?: any;
  respuesta_correcta?: string;
  puntos: number;
  orden: number;
  leccion?: any;
}

export interface Leccion {
  id: number;
  titulo: string;
  categoria: string;
  orden: number;
  activa: boolean;
  total_clases?: number;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos?: T;
}

export interface RespuestaLista<T = any> {
  exito: boolean;
  mensaje: string;
  datos: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExamenesAdminService {
  private readonly apiBaseUrl = environment.apiUrl;
  private readonly apiUrl = `${environment.apiUrl}/admin/examenes`;

  constructor(private http: HttpClient) { }

  private aNumero(valor: unknown): number | undefined {
    return valor ? Number(valor) : undefined;
  }

  listarExamenes(tipo?: string, activo?: boolean, leccionId?: number): Observable<RespuestaLista<ExamenAdmin>> {
    let params = new HttpParams();

    if (tipo) params = params.set('tipo', tipo);
    if (activo !== undefined) params = params.set('activo', activo.toString());
    if (leccionId) params = params.set('leccion_id', leccionId.toString());

    return this.http.get<RespuestaLista<ExamenAdmin>>(this.apiUrl, { params });
  }

  obtenerExamen(examenId: number): Observable<RespuestaAPI<ExamenAdmin>> {
    return this.http.get<RespuestaAPI<ExamenAdmin>>(`${this.apiUrl}/${examenId}`);
  }

  crearExamen(examen: Partial<ExamenAdmin>): Observable<RespuestaAPI<ExamenAdmin>> {
    return this.http.post<RespuestaAPI<ExamenAdmin>>(this.apiUrl, {
      ...examen,
      leccion_id: Number(examen.leccion_id),
      nivel: this.aNumero(examen.nivel) ?? null,
      orden: Number(examen.orden) || 1,
      clases_requeridas: Number(examen.clases_requeridas) || 0,
      tiempo_limite: this.aNumero(examen.tiempo_limite) ?? null,
      puntuacion_minima: Number(examen.puntuacion_minima)
    });
  }

  actualizarExamen(examenId: number, datos: Partial<ExamenAdmin>): Observable<RespuestaAPI<ExamenAdmin>> {
    return this.http.put<RespuestaAPI<ExamenAdmin>>(`${this.apiUrl}/${examenId}`, {
      ...datos,
      leccion_id: this.aNumero(datos.leccion_id),
      nivel: this.aNumero(datos.nivel),
      orden: this.aNumero(datos.orden),
      clases_requeridas: this.aNumero(datos.clases_requeridas),
      tiempo_limite: this.aNumero(datos.tiempo_limite),
      puntuacion_minima: this.aNumero(datos.puntuacion_minima)
    });
  }

  eliminarExamen(examenId: number): Observable<RespuestaAPI<null>> {
    return this.http.delete<RespuestaAPI<null>>(`${this.apiUrl}/${examenId}`);
  }

  listarPreguntas(examenId: number): Observable<RespuestaLista<PreguntaExamen>> {
    return this.http.get<RespuestaLista<PreguntaExamen>>(`${this.apiUrl}/${examenId}/preguntas`);
  }

  crearPregunta(pregunta: Partial<PreguntaExamen>): Observable<RespuestaAPI<PreguntaExamen>> {
    return this.http.post<RespuestaAPI<PreguntaExamen>>(`${this.apiUrl}/preguntas`, pregunta);
  }

  actualizarPregunta(preguntaId: number, datos: Partial<PreguntaExamen>): Observable<RespuestaAPI<PreguntaExamen>> {
    return this.http.put<RespuestaAPI<PreguntaExamen>>(`${this.apiUrl}/preguntas/${preguntaId}`, datos);
  }

  eliminarPregunta(preguntaId: number): Observable<RespuestaAPI<null>> {
    return this.http.delete<RespuestaAPI<null>>(`${this.apiUrl}/preguntas/${preguntaId}`);
  }

  obtenerLecciones(): Observable<RespuestaLista<Leccion>> {
    return this.obtenerLeccionesPorCategoria();
  }

  obtenerLeccionesPorCategoria(categoriaId?: number): Observable<RespuestaLista<Leccion>> {
    const params = categoriaId
      ? new HttpParams().set('categoria_id', categoriaId.toString())
      : undefined;

    return this.http.get<RespuestaLista<Leccion>>(`${this.apiBaseUrl}/lecciones`, { params });
  }

  obtenerEstadisticasExamen(examenId: number): Observable<RespuestaAPI<EstadisticasExamen>> {
    return this.http.get<RespuestaAPI<EstadisticasExamen>>(`${this.apiUrl}/${examenId}/estadisticas`);
  }

  validarExamen(examen: Partial<ExamenAdmin>): boolean {
    if (!examen.titulo || examen.titulo.trim().length < 3) return false;
    if (examen.tipo === 'nivel' && (!examen.nivel || examen.nivel < 1)) return false;
    if (!examen.puntuacion_minima || examen.puntuacion_minima < 0 || examen.puntuacion_minima > 100) return false;
    if (!examen.leccion_id || examen.leccion_id < 1) return false;
    return true;
  }
}
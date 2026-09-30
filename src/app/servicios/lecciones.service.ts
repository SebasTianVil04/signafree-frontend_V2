import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Categoria } from './categoria.service';

import { obtenerUrlVideoEmbebida } from '../modelos/clase.model';
import type { Clase, ClaseActualizar, ClaseCrear } from '../modelos/clase.model';
import { ClasesService } from './clase.service';

export type { Clase, ClaseActualizar, ClaseCrear };

export interface Leccion {
  id: number;
  categoria_id: number;
  titulo: string;
  descripcion?: string;
  sena: string;
  nivel_dificultad: number;
  orden: number;
  leccion_previa_id?: number | null;
  puntos_base: number;
  puntos_perfecto: number;
  requiere_examen_nivel?: boolean;
  numero_examen?: number;
  imagen_miniatura?: string;
  color_tema: string;
  activa: boolean;
  bloqueada: boolean;
  total_clases?: number;
  total_preguntas_examen?: number;
  total_examenes?: number;
  nivel_dificultad_texto: string;
  categoria_nombre?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
}

export interface LeccionCrear {
  categoria_id: number;
  titulo: string;
  descripcion?: string;
  sena: string;
  nivel_dificultad: number;
  orden: number;
  leccion_previa_id?: number | null;
  puntos_base: number;
  puntos_perfecto: number;
  requiere_examen_nivel?: boolean;
  numero_examen?: number;
  imagen_miniatura?: string;
  color_tema?: string;
  activa?: boolean;
  bloqueada?: boolean;
}

export type LeccionActualizar = Partial<LeccionCrear>;

export interface Examen {
  id: number;
  titulo: string;
  descripcion?: string;
  tipo: 'nivel' | 'final';
  nivel?: number;
  leccion_id: number;
  orden: number;
  clases_requeridas: number;
  requiere_todas_clases: boolean;
  tiempo_limite?: number;
  puntuacion_minima: number;
  activo: boolean;
  total_preguntas?: number;
  fecha_creacion?: string;
  disponible?: boolean;
  completado?: boolean;
  mejor_calificacion?: number;
}

export interface ProgresoExamen {
  examen_id: number;
  completado: boolean;
  mejor_calificacion: number;
  intentos_realizados: number;
  ultimo_intento?: string;
}

export interface ProgresoClaseItem {
  clase_id: number;
  completada: boolean;
}

export interface ProgresoClasesLeccion {
  leccion_id: number;
  total_clases: number;
  clases_completadas: number;
  clases: ProgresoClaseItem[];
}

export interface RespuestaLista<T = any> {
  exito: boolean;
  mensaje: string;
  datos: T[];
  total: number;
  pagina?: number;
  por_pagina?: number;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos?: T;
}

export interface FiltrosLecciones {
  categoria?: number | string;
  activa?: boolean;
  [clave: string]: unknown;
}

export interface NivelLogro {
  nivel: string;
  descripcion: string;
  color: string;
}

const NIVELES_DIFICULTAD: ReadonlyArray<{ valor: number; etiqueta: string }> = [
  { valor: 1, etiqueta: 'Principiante' },
  { valor: 2, etiqueta: 'Intermedio' },
  { valor: 3, etiqueta: 'Avanzado' }
];

const NIVELES_LOGRO: ReadonlyArray<{ minimo: number } & NivelLogro> = [
  { minimo: 0.95, nivel: 'Perfecto', descripcion: 'Dominio completo de la seña', color: '#ffd700' },
  { minimo: 0.85, nivel: 'Excelente', descripcion: 'Muy buen dominio de la seña', color: '#4caf50' },
  { minimo: 0.75, nivel: 'Bueno', descripcion: 'Buen dominio de la seña', color: '#8bc34a' },
  { minimo: 0.65, nivel: 'Aceptable', descripcion: 'Dominio aceptable de la seña', color: '#ff9800' }
];

const NIVEL_LOGRO_MINIMO: NivelLogro = {
  nivel: 'Necesita mejorar',
  descripcion: 'Requiere más práctica',
  color: '#f44336'
};

@Injectable({
  providedIn: 'root'
})
export class LeccionesService {
  private readonly apiUrl = `${environment.apiUrl}/lecciones`;
  private readonly examenesUrl = `${environment.apiUrl}/examenes`;
  private readonly categoriasUrl = `${environment.apiUrl}/categorias`;

  constructor(
    private http: HttpClient,
    private clases: ClasesService
  ) { }

  private paramsLecciones(categoriaId?: number | string, activa?: boolean): HttpParams {
    let params = new HttpParams();
    if (categoriaId) params = params.set('categoria_id', categoriaId.toString());
    if (activa !== undefined) params = params.set('activa', activa.toString());
    return params;
  }

  obtenerLecciones(filtros?: FiltrosLecciones): Observable<RespuestaAPI<Leccion[]>> {
    const params = this.paramsLecciones(filtros?.categoria, filtros?.activa);
    return this.http.get<RespuestaAPI<Leccion[]>>(this.apiUrl, { params });
  }

  listarLecciones(categoriaId?: number, activa?: boolean): Observable<RespuestaLista<Leccion>> {
    const params = this.paramsLecciones(categoriaId, activa);
    return this.http.get<RespuestaLista<Leccion>>(this.apiUrl, { params });
  }

  obtenerLeccion(id: number): Observable<RespuestaAPI<Leccion>> {
    return this.http.get<RespuestaAPI<Leccion>>(`${this.apiUrl}/${id}`);
  }

  crearLeccion(leccion: LeccionCrear): Observable<RespuestaAPI<Leccion>> {
    return this.http.post<RespuestaAPI<Leccion>>(this.apiUrl, leccion);
  }

  actualizarLeccion(id: number, leccion: LeccionActualizar): Observable<RespuestaAPI<Leccion>> {
    return this.http.patch<RespuestaAPI<Leccion>>(`${this.apiUrl}/${id}`, leccion);
  }

  eliminarLeccion(id: number): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(`${this.apiUrl}/${id}`);
  }

  obtenerProgresoClases(leccionId: number): Observable<RespuestaAPI<ProgresoClasesLeccion>> {
    return this.http.get<RespuestaAPI<ProgresoClasesLeccion>>(`${this.apiUrl}/${leccionId}/progreso-clases`);
  }

  obtenerClasesDeLeccion(leccionId: number): Observable<RespuestaAPI<Clase[]>> {
    return this.clases.obtenerClasesDeLeccion(leccionId);
  }

  listarClasesDeLeccion(leccionId: number): Observable<RespuestaLista<Clase>> {
    return this.clases.obtenerClasesDeLeccion(leccionId);
  }

  obtenerClase(id: number): Observable<RespuestaAPI<Clase>> {
    return this.clases.obtenerClase(id);
  }

  crearClase(clase: ClaseCrear): Observable<RespuestaAPI<Clase>> {
    return this.clases.crearClase(clase);
  }

  actualizarClase(id: number, clase: ClaseActualizar): Observable<RespuestaAPI<Clase>> {
    return this.clases.actualizarClase(id, clase);
  }

  eliminarClase(id: number): Observable<RespuestaAPI> {
    return this.clases.eliminarClase(id);
  }

  listarExamenesDeLeccion(leccionId: number): Observable<RespuestaLista<Examen>> {
    return this.http.get<RespuestaLista<Examen>>(`${this.apiUrl}/${leccionId}/examenes`);
  }

  obtenerExamenesDeLeccion(leccionId: number): Observable<RespuestaAPI<Examen[]>> {
    return this.http.get<RespuestaAPI<Examen[]>>(`${this.apiUrl}/${leccionId}/examenes`);
  }

  obtenerExamen(id: number): Observable<RespuestaAPI<Examen>> {
    return this.http.get<RespuestaAPI<Examen>>(`${this.examenesUrl}/${id}`);
  }

  obtenerProgresoExamen(examenId: number): Observable<RespuestaAPI<ProgresoExamen>> {
    return this.http.get<RespuestaAPI<ProgresoExamen>>(`${this.examenesUrl}/${examenId}/progreso`);
  }

  obtenerProgresoExamenes(leccionId: number): Observable<RespuestaAPI<ProgresoExamen[]>> {
    return this.http.get<RespuestaAPI<ProgresoExamen[]>>(`${this.examenesUrl}/leccion/${leccionId}/progreso`);
  }

  obtenerExamenesPorNivel(nivel: number): Observable<RespuestaAPI<Examen[]>> {
    return this.http.get<RespuestaAPI<Examen[]>>(`${this.examenesUrl}/nivel/${nivel}`);
  }

  obtenerCategorias(activasSolo: boolean = true): Observable<RespuestaLista<Categoria>> {
    const params = new HttpParams().set('activas_solo', activasSolo.toString());
    return this.http.get<RespuestaLista<Categoria>>(this.categoriasUrl, { params });
  }

  verificarDisponibilidadExamen(examen: Examen, clasesCompletadas: number, totalClases: number): boolean {
    if (!examen.activo) return false;
    if (examen.requiere_todas_clases) return clasesCompletadas >= totalClases;
    if (examen.clases_requeridas > 0) return clasesCompletadas >= examen.clases_requeridas;
    return true;
  }

  obtenerMensajeRequisitoExamen(examen: Examen, clasesCompletadas: number, totalClases: number): string {
    if (examen.requiere_todas_clases) {
      return `Completa todas las clases (${clasesCompletadas}/${totalClases})`;
    }

    const faltantes = Math.max(0, examen.clases_requeridas - clasesCompletadas);
    if (examen.clases_requeridas > 0 && faltantes > 0) {
      return `Completa ${faltantes} clase${faltantes > 1 ? 's' : ''} más`;
    }

    return 'Disponible';
  }

  generarUrlVideoEmbebida(clase: Clase): string | null {
    return obtenerUrlVideoEmbebida(clase);
  }

  obtenerNivelesDificultad(): Array<{ valor: number; etiqueta: string }> {
    return NIVELES_DIFICULTAD.map(nivel => ({ ...nivel }));
  }

  obtenerEtiquetaNivel(nivel: number): string {
    return NIVELES_DIFICULTAD.find(n => n.valor === nivel)?.etiqueta ?? `Nivel ${nivel}`;
  }

  calcularPuntosObtenidos(leccion: Leccion, precision: number, completada: boolean): number {
    if (!completada) return 0;

    const puntosBase = leccion.puntos_base || 10;
    const puntosPerfecto = leccion.puntos_perfecto || 20;

    return Math.round(puntosBase + (puntosPerfecto - puntosBase) * precision);
  }

  calcularPorcentajePuntos(puntosObtenidos: number, leccion: Leccion): number {
    const puntosPerfecto = leccion.puntos_perfecto || 20;
    return Math.round((puntosObtenidos / puntosPerfecto) * 100);
  }

  obtenerNivelLogro(precision: number): NivelLogro {
    const encontrado = NIVELES_LOGRO.find(n => precision >= n.minimo);
    if (!encontrado) return { ...NIVEL_LOGRO_MINIMO };

    const { nivel, descripcion, color } = encontrado;
    return { nivel, descripcion, color };
  }
}
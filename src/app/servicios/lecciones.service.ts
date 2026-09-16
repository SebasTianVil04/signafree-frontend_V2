import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Categoria } from './categoria.service';

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

export interface LeccionActualizar {
  categoria_id?: number;
  titulo?: string;
  descripcion?: string;
  sena?: string;
  nivel_dificultad?: number;
  orden?: number;
  leccion_previa_id?: number | null;
  puntos_base?: number;
  puntos_perfecto?: number;
  requiere_examen_nivel?: boolean;
  numero_examen?: number;
  imagen_miniatura?: string;
  color_tema?: string;
  activa?: boolean;
  bloqueada?: boolean;
}

export interface Clase {
  id?: number;
  leccion_id: number;
  titulo: string;
  descripcion?: string;
  contenido?: string;
  contenido_texto?: string;
  sena?: string;
  orden: number;
  video_id?: string;
  tipo_video?: string;
  video_url?: string;
  duracion?: number;
  duracion_estimada?: number;
  imagen_referencia?: string;
  gif_demostracion?: string;
  tips?: string;
  errores_comunes?: string;
  requiere_practica: boolean;
  intentos_minimos: number;
  precision_minima: number;
  activa: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface ClaseCrear {
  leccion_id: number;
  titulo: string;
  descripcion?: string;
  contenido?: string;
  contenido_texto?: string;
  sena?: string;
  orden: number;
  video_id?: string;
  tipo_video?: string;
  video_url?: string;
  duracion?: number;
  duracion_estimada?: number;
  imagen_referencia?: string;
  gif_demostracion?: string;
  tips?: string;
  errores_comunes?: string;
  requiere_practica?: boolean;
  intentos_minimos?: number;
  precision_minima?: number;
  activa?: boolean;
}

export interface ClaseActualizar {
  titulo?: string;
  descripcion?: string;
  contenido?: string;
  contenido_texto?: string;
  sena?: string;
  orden?: number;
  video_id?: string;
  tipo_video?: string;
  video_url?: string;
  duracion?: number;
  duracion_estimada?: number;
  imagen_referencia?: string;
  gif_demostracion?: string;
  tips?: string;
  errores_comunes?: string;
  requiere_practica?: boolean;
  intentos_minimos?: number;
  precision_minima?: number;
  activa?: boolean;
}

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

@Injectable({
  providedIn: 'root'
})
export class LeccionesService {
  private apiUrl = `${environment.apiUrl}/lecciones`;
  private clasesUrl = `${environment.apiUrl}/clases`;
  private examenesUrl = `${environment.apiUrl}/examenes`;
  private categoriasUrl = `${environment.apiUrl}/categorias`;

  constructor(private http: HttpClient) { }

  obtenerLecciones(filtros?: any): Observable<RespuestaAPI<Leccion[]>> {
    let params = new HttpParams();

    if (filtros?.categoria) {
      params = params.set('categoria_id', filtros.categoria.toString());
    }

    if (filtros?.activa !== undefined) {
      params = params.set('activa', filtros.activa.toString());
    }

    return this.http.get<RespuestaAPI<Leccion[]>>(this.apiUrl, { params });
  }

  listarLecciones(categoriaId?: number, activa?: boolean): Observable<RespuestaLista<Leccion>> {
    let params = new HttpParams();

    if (categoriaId) {
      params = params.set('categoria_id', categoriaId.toString());
    }

    if (activa !== undefined) {
      params = params.set('activa', activa.toString());
    }

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

  obtenerClasesDeLeccion(leccionId: number): Observable<RespuestaAPI<Clase[]>> {
    return this.http.get<RespuestaAPI<Clase[]>>(`${this.clasesUrl}/leccion/${leccionId}`);
  }

  listarClasesDeLeccion(leccionId: number): Observable<RespuestaLista<Clase>> {
    return this.http.get<RespuestaLista<Clase>>(`${this.clasesUrl}/leccion/${leccionId}`);
  }

  obtenerClase(id: number): Observable<RespuestaAPI<Clase>> {
    return this.http.get<RespuestaAPI<Clase>>(`${this.clasesUrl}/${id}`);
  }

  crearClase(clase: ClaseCrear): Observable<RespuestaAPI<Clase>> {
    return this.http.post<RespuestaAPI<Clase>>(this.clasesUrl, clase);
  }

  actualizarClase(id: number, clase: ClaseActualizar): Observable<RespuestaAPI<Clase>> {
    return this.http.put<RespuestaAPI<Clase>>(`${this.clasesUrl}/${id}`, clase);
  }

  eliminarClase(id: number): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(`${this.clasesUrl}/${id}`);
  }

  listarExamenesDeLeccion(leccionId: number): Observable<RespuestaLista<Examen>> {
    return this.http.get<RespuestaLista<Examen>>(`${this.apiUrl}/${leccionId}/examenes`);
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

  obtenerExamenesDeLeccion(leccionId: number): Observable<RespuestaAPI<Examen[]>> {
    return this.http.get<RespuestaAPI<Examen[]>>(`${this.apiUrl}/${leccionId}/examenes`);
  }

  obtenerExamenesPorNivel(nivel: number): Observable<RespuestaAPI<Examen[]>> {
    return this.http.get<RespuestaAPI<Examen[]>>(`${this.examenesUrl}/nivel/${nivel}`);
  }

  verificarDisponibilidadExamen(
    examen: Examen,
    clasesCompletadas: number,
    totalClases: number
  ): boolean {
    if (!examen.activo) {
      return false;
    }

    if (examen.requiere_todas_clases) {
      return clasesCompletadas >= totalClases;
    }

    if (examen.clases_requeridas > 0) {
      return clasesCompletadas >= examen.clases_requeridas;
    }

    return true;
  }

  obtenerMensajeRequisitoExamen(
    examen: Examen,
    clasesCompletadas: number,
    totalClases: number
  ): string {
    if (examen.requiere_todas_clases) {
      return `Completa todas las clases (${clasesCompletadas}/${totalClases})`;
    }

    if (examen.clases_requeridas > 0) {
      const faltantes = Math.max(0, examen.clases_requeridas - clasesCompletadas);
      if (faltantes > 0) {
        return `Completa ${faltantes} clase${faltantes > 1 ? 's' : ''} más`;
      }
      return 'Disponible';
    }

    return 'Disponible';
  }

  generarUrlVideoEmbebida(clase: Clase): string | null {
    if (!clase.video_id) return null;

    switch (clase.tipo_video) {
      case 'youtube':
        return `https://www.youtube.com/embed/${clase.video_id}`;
      case 'google_drive':
        return `https://drive.google.com/file/d/${clase.video_id}/preview`;
      case 'vimeo':
        return `https://player.vimeo.com/video/${clase.video_id}`;
      default:
        return null;
    }
  }

  obtenerNivelesDificultad(): Array<{ valor: number, etiqueta: string }> {
    return [
      { valor: 1, etiqueta: 'Principiante' },
      { valor: 2, etiqueta: 'Intermedio' },
      { valor: 3, etiqueta: 'Avanzado' }
    ];
  }

  obtenerEtiquetaNivel(nivel: number): string {
    const niveles = this.obtenerNivelesDificultad();
    const nivelEncontrado = niveles.find(n => n.valor === nivel);
    return nivelEncontrado?.etiqueta || `Nivel ${nivel}`;
  }

  obtenerCategorias(activasSolo: boolean = true): Observable<RespuestaLista<Categoria>> {
    let params = new HttpParams();
    params = params.set('activas_solo', activasSolo.toString());
    return this.http.get<RespuestaLista<Categoria>>(this.categoriasUrl, { params });
  }

  calcularPuntosObtenidos(
    leccion: Leccion,
    precision: number,
    completada: boolean
  ): number {
    if (!completada) {
      return 0;
    }

    const puntosBase = leccion.puntos_base || 10;
    const puntosPerfecto = leccion.puntos_perfecto || 20;

    const puntosAdicionales = (puntosPerfecto - puntosBase) * precision;
    return Math.round(puntosBase + puntosAdicionales);
  }

  calcularPorcentajePuntos(puntosObtenidos: number, leccion: Leccion): number {
    const puntosPerfecto = leccion.puntos_perfecto || 20;
    if (puntosPerfecto === 0) return 0;
    return Math.round((puntosObtenidos / puntosPerfecto) * 100);
  }

  obtenerNivelLogro(precision: number): {
    nivel: string;
    descripcion: string;
    color: string;
  } {
    if (precision >= 0.95) {
      return {
        nivel: 'Perfecto',
        descripcion: 'Dominio completo de la seña',
        color: '#ffd700'
      };
    } else if (precision >= 0.85) {
      return {
        nivel: 'Excelente',
        descripcion: 'Muy buen dominio de la seña',
        color: '#4caf50'
      };
    } else if (precision >= 0.75) {
      return {
        nivel: 'Bueno',
        descripcion: 'Buen dominio de la seña',
        color: '#8bc34a'
      };
    } else if (precision >= 0.65) {
      return {
        nivel: 'Aceptable',
        descripcion: 'Dominio aceptable de la seña',
        color: '#ff9800'
      };
    } else {
      return {
        nivel: 'Necesita mejorar',
        descripcion: 'Requiere más práctica',
        color: '#f44336'
      };
    }
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Clase {
  id?: number;
  leccion_id: number;
  titulo: string;
  descripcion?: string;
  contenido_texto?: string;
  sena?: string;
  tipo_video: 'youtube' | 'google_drive' | 'vimeo';
  video_url?: string;
  video_id?: string;
  imagen_referencia?: string;
  gif_demostracion?: string;
  orden: number;
  duracion_estimada?: number;
  tips?: string;
  errores_comunes?: string;
  requiere_practica: boolean;
  intentos_minimos: number;
  precision_minima: number;
  activa: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  url_video_embebida?: string;
}

export interface ClaseCrear {
  leccion_id: number;
  titulo: string;
  descripcion?: string;
  contenido_texto?: string;
  sena?: string;
  tipo_video: 'youtube' | 'google_drive' | 'vimeo';
  video_url?: string;
  video_id?: string;
  imagen_referencia?: string;
  gif_demostracion?: string;
  orden: number;
  duracion_estimada?: number;
  tips?: string;
  errores_comunes?: string;
  requiere_practica: boolean;
  intentos_minimos: number;
  precision_minima: number;
  activa: boolean;
}

export interface ClaseActualizar {
  titulo?: string;
  descripcion?: string;
  contenido_texto?: string;
  sena?: string;
  tipo_video?: 'youtube' | 'google_drive' | 'vimeo';
  video_url?: string;
  video_id?: string;
  imagen_referencia?: string;
  gif_demostracion?: string;
  orden?: number;
  duracion_estimada?: number;
  tips?: string;
  errores_comunes?: string;
  requiere_practica?: boolean;
  intentos_minimos?: number;
  precision_minima?: number;
  activa?: boolean;
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
export class ClasesService {
  private apiUrl = `${environment.apiUrl}/clases`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }


  private limpiarDatos<T>(datos: T): T {
    const resultado: any = {};
    
    for (const [key, value] of Object.entries(datos as any)) {
      // Si es un string vacío o solo espacios, convertir a null
      if (typeof value === 'string' && value.trim() === '') {
        resultado[key] = null;
      }
      // Si es null o undefined, mantener como está
      else if (value === null || value === undefined) {
        resultado[key] = null;
      }
      // Para cualquier otro valor, mantenerlo
      else {
        resultado[key] = value;
      }
    }
    
    return resultado as T;
  }

  obtenerClasesDeLeccion(leccionId: number): Observable<RespuestaAPI<Clase[]>> {
    return this.http.get<RespuestaAPI<Clase[]>>(
      `${this.apiUrl}/leccion/${leccionId}`,
      { headers: this.getHeaders() }
    );
  }

  obtenerClase(claseId: number): Observable<RespuestaAPI<Clase>> {
    return this.http.get<RespuestaAPI<Clase>>(
      `${this.apiUrl}/${claseId}`,
      { headers: this.getHeaders() }
    );
  }

  crearClase(clase: ClaseCrear): Observable<RespuestaAPI<Clase>> {
    // Limpiar los datos antes de enviar
    const datosLimpios = this.limpiarDatos(clase);
    
    console.log('🧹 Datos después de limpiar:', datosLimpios);
    console.log('   sena:', datosLimpios.sena);
    console.log('   sena type:', typeof datosLimpios.sena);
    
    return this.http.post<RespuestaAPI<Clase>>(
      `${this.apiUrl}/`,
      datosLimpios,
      { headers: this.getHeaders() }
    );
  }

  actualizarClase(id: number, clase: ClaseActualizar): Observable<RespuestaAPI<Clase>> {
    // Limpiar los datos antes de enviar
    const datosLimpios = this.limpiarDatos(clase);
    
    return this.http.put<RespuestaAPI<Clase>>(
      `${this.apiUrl}/${id}`,
      datosLimpios,
      { headers: this.getHeaders() }
    );
  }

  eliminarClase(id: number): Observable<RespuestaAPI<null>> {
    return this.http.delete<RespuestaAPI<null>>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }

  extraerVideoId(url: string, tipoVideo: string): string {
    if (!url) return '';

    let videoId = '';

    switch (tipoVideo) {
      case 'youtube':
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        videoId = youtubeMatch ? youtubeMatch[1] : '';
        break;

      case 'google_drive':
        const driveRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
        const driveMatch = url.match(driveRegex);
        videoId = driveMatch ? driveMatch[1] : '';
        break;

      case 'vimeo':
        const vimeoRegex = /vimeo\.com\/(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        videoId = vimeoMatch ? vimeoMatch[1] : '';
        break;
    }

    return videoId;
  }

  generarUrlEmbebida(videoId: string, tipoVideo: string): string {
    if (!videoId) return '';

    switch (tipoVideo) {
      case 'youtube':
        return `https://www.youtube.com/embed/${videoId}`;
      case 'google_drive':
        return `https://drive.google.com/file/d/${videoId}/preview`;
      case 'vimeo':
        return `https://player.vimeo.com/video/${videoId}`;
      default:
        return '';
    }
  }
}
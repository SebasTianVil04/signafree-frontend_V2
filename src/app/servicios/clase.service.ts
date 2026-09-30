import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CLASE_DEFAULT, extraerVideoId, generarUrlEmbebida } from '../modelos/clase.model';
import type { Clase, ClaseActualizar, ClaseCrear, TipoVideo } from '../modelos/clase.model';

export type { Clase, ClaseActualizar, ClaseCrear, TipoVideo };

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

export interface VideoClase {
  tipo: 'local' | 'externo';
  url: string;
  expira_en_segundos: number | null;
}

export interface ResultadoSubidaVideo {
  clase_id: number;
  tamano_bytes: number;
}

export interface EstadoClaseLeccion {
  clase_id: number;
  completada: boolean;
}

export interface ProgresoClasesLeccion {
  leccion_id: number;
  total_clases: number;
  clases_completadas: number;
  clases: EstadoClaseLeccion[];
}

@Injectable({
  providedIn: 'root'
})
export class ClasesService {
  private readonly apiUrl = `${environment.apiUrl}/clases`;

  constructor(private http: HttpClient) { }

  private limpiarDatos<T extends object>(datos: T): Partial<T> {
    const limpio: Record<string, unknown> = {};

    for (const [clave, valor] of Object.entries(datos)) {
      if (valor === undefined) continue;
      limpio[clave] = typeof valor === 'string' && valor.trim() === '' ? null : valor;
    }

    return limpio as Partial<T>;
  }

  obtenerClasesDeLeccion(leccionId: number): Observable<RespuestaLista<Clase>> {
    return this.http.get<RespuestaLista<Clase>>(`${this.apiUrl}/leccion/${leccionId}`);
  }

  obtenerClase(claseId: number): Observable<RespuestaAPI<Clase>> {
    return this.http.get<RespuestaAPI<Clase>>(`${this.apiUrl}/${claseId}`);
  }

  obtenerProgresoClasesLeccion(leccionId: number): Observable<RespuestaAPI<ProgresoClasesLeccion>> {
    return this.http.get<RespuestaAPI<ProgresoClasesLeccion>>(
      `${environment.apiUrl}/lecciones/${leccionId}/progreso-clases`
    );
  }

  crearClase(clase: ClaseCrear): Observable<RespuestaAPI<Clase>> {
    return this.http.post<RespuestaAPI<Clase>>(`${this.apiUrl}/`, {
      ...CLASE_DEFAULT,
      ...this.limpiarDatos(clase)
    });
  }

  actualizarClase(id: number, clase: ClaseActualizar): Observable<RespuestaAPI<Clase>> {
    return this.http.put<RespuestaAPI<Clase>>(`${this.apiUrl}/${id}`, this.limpiarDatos(clase));
  }

  eliminarClase(id: number): Observable<RespuestaAPI<null>> {
    return this.http.delete<RespuestaAPI<null>>(`${this.apiUrl}/${id}`);
  }

  obtenerVideoClase(claseId: number): Observable<RespuestaAPI<VideoClase>> {
    return this.http.get<RespuestaAPI<VideoClase>>(`${this.apiUrl}/${claseId}/video`);
  }

  subirVideoClase(claseId: number, archivo: File): Observable<HttpEvent<RespuestaAPI<ResultadoSubidaVideo>>> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);

    return this.http.post<RespuestaAPI<ResultadoSubidaVideo>>(`${this.apiUrl}/${claseId}/video`, formulario, {
      reportProgress: true,
      observe: 'events'
    });
  }

  eliminarVideoClase(claseId: number): Observable<RespuestaAPI<null>> {
    return this.http.delete<RespuestaAPI<null>>(`${this.apiUrl}/${claseId}/video`);
  }

  construirUrlAbsoluta(ruta: string): string {
    const base = new URL(environment.apiUrl, window.location.origin);
    return new URL(ruta, base).href;
  }

  extraerVideoId(url: string, tipoVideo: string): string {
    return extraerVideoId(url, tipoVideo);
  }

  generarUrlEmbebida(videoId: string, tipoVideo: string): string {
    return generarUrlEmbebida(videoId, tipoVideo);
  }
}
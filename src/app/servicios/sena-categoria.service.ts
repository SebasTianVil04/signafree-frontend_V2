import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SenaCategoria {
  id: number;
  categoria_id: number;
  nombre: string;
  orden: number;
  archivo_referencia: string | null;
  tipo_referencia: 'imagen' | 'video' | null;
  activa: boolean;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
}

export interface SenaCategoriaCrear {
  nombre: string;
  orden: number;
}

export interface SenaCategoriaActualizar {
  nombre?: string;
  orden?: number;
  activa?: boolean;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos: T;
}

export interface RespuestaLista<T = any> {
  exito: boolean;
  mensaje: string;
  datos: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

@Injectable({ providedIn: 'root' })
export class SenaCategoriaService {
  private baseUrl = `${environment.apiUrl}/categorias`;

  constructor(private http: HttpClient) {}

  listarSenas(categoriaId: number): Observable<RespuestaLista<SenaCategoria>> {
    return this.http.get<RespuestaLista<SenaCategoria>>(`${this.baseUrl}/${categoriaId}/senas`);
  }

  crearSena(categoriaId: number, sena: SenaCategoriaCrear): Observable<RespuestaAPI<SenaCategoria>> {
    return this.http.post<RespuestaAPI<SenaCategoria>>(`${this.baseUrl}/${categoriaId}/senas`, sena);
  }

  actualizarSena(categoriaId: number, senaId: number, datos: SenaCategoriaActualizar): Observable<RespuestaAPI<SenaCategoria>> {
    return this.http.put<RespuestaAPI<SenaCategoria>>(`${this.baseUrl}/${categoriaId}/senas/${senaId}`, datos);
  }

  eliminarSena(categoriaId: number, senaId: number): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(`${this.baseUrl}/${categoriaId}/senas/${senaId}`);
  }

  subirArchivoReferencia(categoriaId: number, senaId: number, archivo: File): Observable<RespuestaAPI<SenaCategoria>> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<RespuestaAPI<SenaCategoria>>(`${this.baseUrl}/${categoriaId}/senas/${senaId}/referencia`, formData);
  }

  eliminarArchivoReferencia(categoriaId: number, senaId: number): Observable<RespuestaAPI<SenaCategoria>> {
    return this.http.delete<RespuestaAPI<SenaCategoria>>(`${this.baseUrl}/${categoriaId}/senas/${senaId}/referencia`);
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap } from 'rxjs/operators';

export interface Categoria {
  id: number;
  nombre: string;
  tipo_id: number;
  tipo_valor?: string;
  tipo_etiqueta?: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden: number;
  nivel_requerido: number;
  activa: boolean;
  fecha_creacion: string;
  total_lecciones: number;
  dataset_id?: number;

  // Información del modelo asignado
  modelo_ia_id?: number;
  modelo_nombre?: string;
  modelo_activo?: boolean;
  modelo_accuracy?: number;
  tiene_modelo?: boolean;
}

export interface CategoriaCrear {
  nombre: string;
  tipo_id: number;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden: number;
  nivel_requerido?: number;
}

export interface CategoriaActualizar {
  nombre?: string;
  tipo_id?: number;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden?: number;
  nivel_requerido?: number;
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

export interface AsignacionModelo {
  categoria_id: number;
  modelo_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {
  private apiUrl = `${environment.apiUrl}/categorias`;
  private categoriasConModelosSubject = new BehaviorSubject<Categoria[]>([]);
  public categoriasConModelos$ = this.categoriasConModelosSubject.asObservable();

  constructor(private http: HttpClient) { 
    this.cargarCategoriasConModelos();
  }

  cargarCategoriasConModelos(): void {
    this.http.get<RespuestaLista<Categoria>>(
      `${this.apiUrl}/con-modelos`
    ).pipe(
      catchError(error => {
        console.error('Error cargando categorías con modelos:', error);
        return of({
          exito: false,
          mensaje: 'Error al cargar categorías',
          datos: [],
          total: 0,
          pagina: 1,
          por_pagina: 0
        });
      })
    ).subscribe(response => {
      if (response.exito) {
        this.categoriasConModelosSubject.next(response.datos);
      }
    });
  }

  listarCategorias(activasSolo: boolean = true, tipo_id?: number): Observable<RespuestaLista<Categoria>> {
    let params = new HttpParams();
    params = params.set('activas_solo', activasSolo.toString());

    if (tipo_id) {
      params = params.set('tipo_id', tipo_id.toString());
    }

    return this.http.get<RespuestaLista<Categoria>>(this.apiUrl, { params });
  }

  obtenerCategoria(id: number): Observable<RespuestaAPI<Categoria>> {
    return this.http.get<RespuestaAPI<Categoria>>(`${this.apiUrl}/${id}`);
  }

  crearCategoria(categoria: CategoriaCrear): Observable<RespuestaAPI<Categoria>> {
    return this.http.post<RespuestaAPI<Categoria>>(this.apiUrl, categoria);
  }

  actualizarCategoria(id: number, categoria: CategoriaActualizar): Observable<RespuestaAPI<Categoria>> {
    return this.http.put<RespuestaAPI<Categoria>>(`${this.apiUrl}/${id}`, categoria);
  }

  eliminarCategoria(id: number, forzar: boolean = false): Observable<RespuestaAPI> {
    let params = new HttpParams();
    if (forzar) {
      params = params.set('forzar', forzar.toString());
    }

    return this.http.delete<RespuestaAPI>(`${this.apiUrl}/${id}`, { params });
  }

  cambiarEstadoCategoria(id: number): Observable<RespuestaAPI<Categoria>> {
    return this.http.patch<RespuestaAPI<Categoria>>(`${this.apiUrl}/${id}/toggle`, {});
  }

  sincronizarDataset(): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(`${this.apiUrl}/sincronizar-dataset`, {});
  }

  asignarModelo(categoriaId: number, modeloId: number): Observable<RespuestaAPI> {
    const params = new HttpParams().set('modelo_id', modeloId.toString());
    return this.http.patch<RespuestaAPI>(
      `${this.apiUrl}/${categoriaId}/asignar-modelo`,
      {},
      { params }
    ).pipe(
      tap(response => {
        if (response.exito) {
          this.cargarCategoriasConModelos();
        }
      })
    );
  }

  desasignarModelo(categoriaId: number): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(
      `${this.apiUrl}/${categoriaId}/desasignar-modelo`
    ).pipe(
      tap(response => {
        if (response.exito) {
          this.cargarCategoriasConModelos();
        }
      })
    );
  }

  listarCategoriasConModelos(): Observable<RespuestaLista<Categoria>> {
    return this.http.get<RespuestaLista<Categoria>>(
      `${this.apiUrl}/con-modelos`
    ).pipe(
      catchError(error => {
        console.error('Error cargando categorías con modelos:', error);
        return of({
          exito: false,
          mensaje: 'Error al cargar categorías',
          datos: [],
          total: 0,
          pagina: 1,
          por_pagina: 0
        });
      })
    );
  }

  asignarModelosEnLote(asignaciones: AsignacionModelo[]): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/asignar-modelos-lote`,
      { asignaciones }
    ).pipe(
      tap(response => {
        if (response.exito) {
          this.cargarCategoriasConModelos();
        }
      })
    );
  }
}
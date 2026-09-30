import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TipoCategoria {
  id: number;
  valor: string;
  etiqueta: string;
  icono: string;
  color: string;
  activo: boolean;
  fecha_creacion: string;
}

export interface TipoCategoriaCrear {
  valor: string;
  etiqueta: string;
  icono: string;
  color: string;
}

export interface TipoCategoriaActualizar {
  etiqueta?: string;
  icono?: string;
  color?: string;
  activo?: boolean;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos?: T;
}

@Injectable({
  providedIn: 'root'
})
export class TipoCategoriaService {
  private readonly apiUrl = `${environment.apiUrl}/tipos-categoria`;

  constructor(private http: HttpClient) { }

  listarTipos(soloActivos: boolean = true): Observable<TipoCategoria[]> {
    const params = new HttpParams().set('solo_activos', soloActivos.toString());
    return this.http.get<TipoCategoria[]>(this.apiUrl, { params });
  }

  obtenerTipo(id: number): Observable<RespuestaAPI<TipoCategoria>> {
    return this.http.get<RespuestaAPI<TipoCategoria>>(`${this.apiUrl}/${id}`);
  }

  crearTipo(datos: TipoCategoriaCrear): Observable<RespuestaAPI<TipoCategoria>> {
    return this.http.post<RespuestaAPI<TipoCategoria>>(this.apiUrl, datos);
  }

  actualizarTipo(id: number, datos: TipoCategoriaActualizar): Observable<RespuestaAPI<TipoCategoria>> {
    return this.http.put<RespuestaAPI<TipoCategoria>>(`${this.apiUrl}/${id}`, datos);
  }

  eliminarTipo(id: number): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(`${this.apiUrl}/${id}`);
  }

  cambiarEstado(id: number): Observable<RespuestaAPI> {
    return this.http.patch<RespuestaAPI>(`${this.apiUrl}/${id}/toggle`, {});
  }
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NotificacionesService } from './notificaciones.service';
import { MenuService } from './menu.service';
import { MenuItemAdmin } from '../modelos/menu.model';

@Injectable({
  providedIn: 'root'
})
export class MenuAdminService {
  private readonly apiUrl = `${environment.apiUrl}/menu`;

  constructor(
    private http: HttpClient,
    private notificaciones: NotificacionesService,
    private menuPublico: MenuService
  ) { }

  listar(): Observable<MenuItemAdmin[]> {
    return this.http.get<MenuItemAdmin[]>(this.apiUrl).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  crear(datos: MenuItemAdmin): Observable<MenuItemAdmin> {
    return this.http.post<MenuItemAdmin>(this.apiUrl, datos).pipe(
      tap(() => this.menuPublico.refrescar()),
      catchError(error => this.manejarError(error))
    );
  }

  actualizar(id: number, datos: MenuItemAdmin): Observable<MenuItemAdmin> {
    return this.http.put<MenuItemAdmin>(`${this.apiUrl}/${id}`, datos).pipe(
      tap(() => this.menuPublico.refrescar()),
      catchError(error => this.manejarError(error))
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.menuPublico.refrescar()),
      catchError(error => this.manejarError(error))
    );
  }

  private manejarError(error: any): Observable<never> {
    const detalle = typeof error?.error?.detail === 'string' ? error.error.detail : null;
    this.notificaciones.mostrarError(error?.error?.mensaje || detalle || 'Error inesperado');
    return throwError(() => error);
  }
}
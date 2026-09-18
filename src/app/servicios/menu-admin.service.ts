import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { environment } from '../../environments/environment';
import { NotificacionesService } from './notificaciones.service';
import { MenuItemAdmin } from '../modelos/menu.model';

const MENU_ADMIN_KEY = ['menu-admin'];

@Injectable({
  providedIn: 'root'
})
export class MenuAdminService {
  private apiUrl = `${environment.apiUrl}/menu`;
  private queryClient = injectQueryClient();

  constructor(
    private http: HttpClient,
    private notificaciones: NotificacionesService
  ) {}

  listar(): Observable<MenuItemAdmin[]> {
    const promesa = this.queryClient.fetchQuery({
      queryKey: MENU_ADMIN_KEY,
      queryFn: () => firstValueFrom(this.http.get<MenuItemAdmin[]>(this.apiUrl)),
    });

    return from(promesa).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  crear(datos: MenuItemAdmin): Observable<MenuItemAdmin> {
    return this.http.post<MenuItemAdmin>(this.apiUrl, datos).pipe(
      tap(() => this.queryClient.invalidateQueries({ queryKey: MENU_ADMIN_KEY })),
      catchError(error => this.manejarError(error))
    );
  }

  actualizar(id: number, datos: MenuItemAdmin): Observable<MenuItemAdmin> {
    return this.http.put<MenuItemAdmin>(`${this.apiUrl}/${id}`, datos).pipe(
      tap(() => this.queryClient.invalidateQueries({ queryKey: MENU_ADMIN_KEY })),
      catchError(error => this.manejarError(error))
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.queryClient.invalidateQueries({ queryKey: MENU_ADMIN_KEY })),
      catchError(error => this.manejarError(error))
    );
  }

  private manejarError(error: any) {
    const mensaje = error.error?.mensaje || error.error?.detail || 'Error inesperado';
    this.notificaciones.mostrarError(mensaje);
    return throwError(error);
  }
}
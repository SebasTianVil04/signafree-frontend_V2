import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NotificacionesService } from './notificaciones.service';
import {
  Rol,
  Permiso,
  RolCrear,
  RolActualizar,
  AsignarPermisosRequest,
  PermisosPorModulo
} from '../modelos/rol.model';

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private apiUrl = `${environment.apiUrl}/roles`;

  constructor(
    private http: HttpClient,
    private notificaciones: NotificacionesService
  ) { }

  listarRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(this.apiUrl).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  listarPermisos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${this.apiUrl}/permisos`).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  agruparPermisosPorModulo(permisos: Permiso[]): PermisosPorModulo[] {
    const grupos = new Map<string, Permiso[]>();
    for (const permiso of permisos) {
      if (!grupos.has(permiso.modulo)) {
        grupos.set(permiso.modulo, []);
      }
      grupos.get(permiso.modulo)!.push(permiso);
    }
    return Array.from(grupos.entries()).map(([modulo, permisos]) => ({ modulo, permisos }));
  }

  crearRol(datos: RolCrear): Observable<Rol> {
    return this.http.post<Rol>(this.apiUrl, datos).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  actualizarRol(rolId: number, datos: RolActualizar): Observable<Rol> {
    return this.http.put<Rol>(`${this.apiUrl}/${rolId}`, datos).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  asignarPermisos(rolId: number, datos: AsignarPermisosRequest): Observable<Rol> {
    return this.http.put<Rol>(`${this.apiUrl}/${rolId}/permisos`, datos).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  eliminarRol(rolId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${rolId}`).pipe(
      catchError(error => this.manejarError(error))
    );
  }

  private manejarError(error: any) {
    const mensaje = error.error?.mensaje || error.error?.detail || 'Error inesperado';
    this.notificaciones.mostrarError(mensaje);
    return throwError(error);
  }
}
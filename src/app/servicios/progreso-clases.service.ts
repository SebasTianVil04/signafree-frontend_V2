import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AccesoClaseResponse {
  exito: boolean;
  acceso_permitido: boolean;
  mensaje: string;
  examen_requerido?: {
    id: number;
    titulo: string;
    descripcion: string;
    total_preguntas: number;
    tiempo_limite: number;
    puntuacion_minima: number;
  };
  clase?: {
    id: number;
    titulo: string;
    orden: number;
  };
}

export interface CompletarClaseResponse {
  exito: boolean;
  mensaje: string;
  clases_completadas: number;
  requiere_examen: boolean;
  examen?: {
    id: number;
    titulo: string;
    descripcion: string;
    total_preguntas: number;
    tiempo_limite: number;
    puntuacion_minima: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProgresoClasesService {
  private apiUrl = `${environment.apiUrl}/clases`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  verificarAccesoClase(claseId: number): Observable<AccesoClaseResponse> {
    return this.http.get<AccesoClaseResponse>(
      `${this.apiUrl}/${claseId}/acceso`,
      { headers: this.getHeaders() }
    );
  }

  marcarClaseCompletada(claseId: number): Observable<CompletarClaseResponse> {
    return this.http.post<CompletarClaseResponse>(
      `${this.apiUrl}/${claseId}/completar`,
      {},
      { headers: this.getHeaders() }
    );
  }
}
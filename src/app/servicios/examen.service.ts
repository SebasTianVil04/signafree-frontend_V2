import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Examen,
  ExamenesResponse,
  ResultadoExamen,
  PresentarExamenRequest,
  ResultadosExamenResponse
} from '../modelos/examen.model';
import { SKIP_GLOBAL_LOADING } from '../interceptores/loading-context';

@Injectable({
  providedIn: 'root'
})
export class ExamenService {
  private apiUrl = `${environment.apiUrl}/examenes`;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  listarExamenes(tipo?: string, nivel?: number): Observable<ExamenesResponse> {
    let url = this.apiUrl;
    const params = [];

    if (tipo) params.push(`tipo=${tipo}`);
    if (nivel) params.push(`nivel=${nivel}`);

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this.http.get<ExamenesResponse>(url, {
      headers: this.getHeaders(),
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }

  obtenerExamen(examenId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${examenId}`, {
      headers: this.getHeaders()
    });
  }

  presentarExamen(
    examenId: number,
    respuestas: { [key: string]: string },
    tiempoEmpleado: number
  ): Observable<any> {
    const body = {
      ...respuestas,
      tiempo_empleado: tiempoEmpleado
    };

    return this.http.post<any>(
      `${this.apiUrl}/${examenId}/presentar`,
      body,
      { headers: this.getHeaders() }
    );
  }

  obtenerResultadosExamen(examenId: number): Observable<ResultadosExamenResponse> {
    return this.http.get<ResultadosExamenResponse>(
      `${this.apiUrl}/${examenId}/resultados`,
      { headers: this.getHeaders() }
    );
  }

  listarExamenesNivel(nivel: number): Observable<ExamenesResponse> {
    return this.listarExamenes('nivel', nivel);
  }

  listarExamenesFinales(): Observable<ExamenesResponse> {
    return this.listarExamenes('final');
  }
}
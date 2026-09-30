import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ExamenesResponse,
  ResultadosExamenResponse
} from '../modelos/examen.model';
import { SKIP_GLOBAL_LOADING } from '../interceptores/loading-context';

@Injectable({
  providedIn: 'root'
})
export class ExamenService {
  private readonly apiUrl = `${environment.apiUrl}/examenes`;

  constructor(private http: HttpClient) { }

  listarExamenes(tipo?: string, nivel?: number): Observable<ExamenesResponse> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    if (nivel) params = params.set('nivel', nivel.toString());

    return this.http.get<ExamenesResponse>(this.apiUrl, {
      params,
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }

  obtenerExamen(examenId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${examenId}`);
  }

  presentarExamen(
    examenId: number,
    respuestas: { [key: string]: string },
    tiempoEmpleado: number
  ): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${examenId}/presentar`,
      { ...respuestas, tiempo_empleado: tiempoEmpleado }
    );
  }

  obtenerResultadosExamen(examenId: number): Observable<ResultadosExamenResponse> {
    return this.http.get<ResultadosExamenResponse>(`${this.apiUrl}/${examenId}/resultados`);
  }

  listarExamenesNivel(nivel: number): Observable<ExamenesResponse> {
    return this.listarExamenes('nivel', nivel);
  }

  listarExamenesFinales(): Observable<ExamenesResponse> {
    return this.listarExamenes('final');
  }
}
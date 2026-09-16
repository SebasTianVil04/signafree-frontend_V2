import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Practica, RespuestaPractica } from '../modelos/practica.model';

@Injectable({
  providedIn: 'root'
})
export class PracticaService {
  private apiUrl = `${environment.apiUrl}/practicas`;

  constructor(private http: HttpClient) {}

  registrarPractica(practica: Practica): Observable<RespuestaPractica> {
    return this.http.post<RespuestaPractica>(this.apiUrl, practica);
  }

  obtenerHistorial(leccionId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/leccion/${leccionId}/historial`);
  }
}
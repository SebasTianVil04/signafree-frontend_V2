import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DatosReniec } from '../modelos/usuario.model';
import { throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiPeruService {
  constructor(private http: HttpClient) { }

  obtenerDatosPorDni(dni: string): Observable<DatosReniec> {
    const params = new HttpParams().set('dni', dni);
    
    return this.http.post<any>(
      `${environment.apiUrl}/usuarios/verificar-dni`, 
      null,
      { params }
    ).pipe(
      map(response => {
        console.log(' Respuesta completa del backend:', response);
        
        if (response.valido && response.datos) {
          const datosReniec: DatosReniec = {
            dni: response.datos.numero,
            nombres: response.datos.nombres,
            apellidoPaterno: response.datos.apellido_paterno,
            apellidoMaterno: response.datos.apellido_materno
          };
          
          console.log(' Datos mapeados para el frontend:', datosReniec);
          return datosReniec;
        }
        
        console.error(' Respuesta sin valido o datos:', response);
        throw new Error('No se encontraron datos para este DNI');
      }),
      catchError(error => {
        console.error(' Error en obtenerDatosPorDni:', error);
        return throwError(() => error);
      })
    );
  }

  validarDni(dni: string): boolean {
    return /^\d{8}$/.test(dni);
  }
}
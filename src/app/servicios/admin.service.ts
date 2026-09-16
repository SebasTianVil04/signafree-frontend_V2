import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, retry, timeout, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DashboardEstadisticas {
  usuarios: {
    total: number;
    activos: number;
    nuevos_mes: number;
  };
  lecciones: {
    total: number;
    activas: number;
  };
  examenes: {
    total: number;
    completados: number;
  };
  rendimiento: {
    progreso_promedio: number;
  };
}

export interface ModeloIA {
  id?: number;
  nombre: string;
  version?: string;
  accuracy?: number;
  loss?: number;
  accuracy_porcentaje?: string;
  num_clases?: number;
  total_imagenes?: number;
  epocas_entrenamiento?: number;
  activo: boolean;
  peso_ensemble?: number;
  fecha_creacion?: string;
  fecha_entrenamiento?: string;
  descripcion?: string;
  calidad?: string;
  estado_texto?: string;
  arquitectura?: string;
  tipo_modelo?: string;
  tamaño_mb?: number;
  clases?: string[];
  origen?: string;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos?: T;
  errores?: string[];
}

export interface EstadisticasEntrenamiento {
  total_datos: number;
  datos_por_clase: { [key: string]: number };
  precision_actual?: number;
  ultimo_entrenamiento?: string;
}

export interface VideosModelo {
  total: number;
  videos: Array<{
    id: number;
    sena: string;
    duracion_segundos: number;
    frames_extraidos: number;
    fecha_subida: string;
  }>;
}

export interface ConfiguracionEnsemble {
  total_modelos: number;
  modelos: Array<{
    nombre: string;
    peso: number;
    accuracy: number;
    num_clases: number;
    tipo: string;
    fecha_activacion: string;
  }>;
}

export interface DatosActualizarUsuario {
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;
  private readonly TIMEOUT_MS = 15000;
  private readonly TIMEOUT_DELETE_MS = 30000;
  private readonly TIMEOUT_ENSEMBLE_MS = 10000;

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse, operacion: string = 'operación'): Observable<RespuestaAPI> {
    let mensajeError = `Error en ${operacion}`;

    if (error.error instanceof ErrorEvent) {
      mensajeError = `Error de conexión: ${error.error.message}`;
    } else {
      mensajeError = error.error?.detail || error.error?.mensaje || error.message || mensajeError;
    }

    return of({
      exito: false,
      mensaje: mensajeError,
      errores: [mensajeError]
    });
  }

  obtenerDashboard(): Observable<DashboardEstadisticas> {
    return this.http.get<DashboardEstadisticas>(`${this.apiUrl}/dashboard`).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => {
        throw error;
      })
    );
  }

  listarUsuarios(skip: number = 0, limit: number = 100): Observable<any> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());

    return this.http.get<any>(`${this.apiUrl}/usuarios`, { params }).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => {
        throw error;
      })
    );
  }

  obtenerEstadisticasUsuario(usuarioId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/usuarios/${usuarioId}/estadisticas`).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  obtenerProgresoDetalladoUsuario(usuarioId: number): Observable<RespuestaAPI> {
    return this.http.get<RespuestaAPI>(`${this.apiUrl}/usuarios/${usuarioId}/progreso-detallado`).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  cambiarEstadoUsuario(usuarioId: number, activo: boolean): Observable<RespuestaAPI> {
    return this.http.patch<RespuestaAPI>(
      `${this.apiUrl}/usuarios/${usuarioId}/estado`,
      null,
      { params: new HttpParams().set('activo', activo.toString()) }
    ).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  asignarRol(usuarioId: number, esAdmin: boolean): Observable<RespuestaAPI> {
    const params = new HttpParams().set('es_admin', esAdmin.toString());

    return this.http.put<RespuestaAPI>(
      `${this.apiUrl}/usuarios/${usuarioId}/rol`,
      null,
      { params }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => this.handleError(error, 'asignar rol'))
    );
  }


  actualizarUsuario(usuarioId: number, datos: DatosActualizarUsuario): Observable<RespuestaAPI> {
    let params = new HttpParams();

    Object.entries(datos).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, valor);
      }
    });

    return this.http.put<RespuestaAPI>(
      `${this.apiUrl}/usuarios/${usuarioId}`,
      null,
      { params }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => this.handleError(error, 'actualizar usuario'))
    );
  }

  eliminarUsuario(usuarioId: number): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(`${this.apiUrl}/usuarios/${usuarioId}`).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => this.handleError(error, 'eliminar usuario'))
    );
  }

  subirContenidoLeccion(leccionId: number, archivo: File): Observable<RespuestaAPI> {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/lecciones/${leccionId}/contenido`,
      formData
    ).pipe(
      timeout(60000)
    );
  }

  iniciarEntrenamiento(): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(`${this.apiUrl}/modelo/entrenar`, {}).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  obtenerEstadoModelo(): Observable<RespuestaAPI> {
    return this.http.get<RespuestaAPI>(`${this.apiUrl}/modelo/estado`).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  toggleModelo(nombreModelo: string): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/modelo/toggle`,
      { nombre_modelo: nombreModelo }
    ).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  listarModelos(): Observable<RespuestaAPI<ModeloIA[]>> {
    return this.http.get<RespuestaAPI<ModeloIA[]>>(`${this.apiUrl}/modelos`).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => this.handleError(error, 'listar modelos'))
    );
  }

  activarModelo(nombreModelo: string): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/modelo/activar`,
      { nombre_modelo: nombreModelo }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => this.handleError(error, 'activar modelo'))
    );
  }

  obtenerEstadisticasEntrenamiento(): Observable<RespuestaAPI<EstadisticasEntrenamiento>> {
    return this.http.get<RespuestaAPI<EstadisticasEntrenamiento>>(
      `${this.apiUrl}/estadisticas-entrenamiento`
    ).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  subirDatosEntrenamiento(
    archivos: File | File[],
    categoria: string = 'general'
  ): Observable<RespuestaAPI> {
    const formData = new FormData();
    const lista = Array.isArray(archivos) ? archivos : [archivos];
    lista.forEach(archivo => formData.append('archivos', archivo));

    const params = new HttpParams().set('categoria', categoria);

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/datos-entrenamiento/subir`,
      formData,
      { params }
    ).pipe(
      timeout(60000),
      catchError((error) => this.handleError(error, 'subir datos de entrenamiento'))
    );
  }

  limpiarArchivosTemporales(): Observable<RespuestaAPI> {
    return this.http.delete<RespuestaAPI>(`${this.apiUrl}/limpiar-archivos-temp`).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  generarReporteUso(fechaInicio?: string, fechaFin?: string): Observable<RespuestaAPI> {
    let params = new HttpParams();

    if (fechaInicio) {
      params = params.set('fecha_inicio', fechaInicio);
    }

    if (fechaFin) {
      params = params.set('fecha_fin', fechaFin);
    }

    return this.http.get<RespuestaAPI>(`${this.apiUrl}/reportes/uso`, { params }).pipe(
      timeout(this.TIMEOUT_MS)
    );
  }

  eliminarModelo(nombreModelo: string, eliminarVideos: boolean = false): Observable<RespuestaAPI> {
    if (!nombreModelo || nombreModelo.trim() === '') {
      return of({
        exito: false,
        mensaje: 'Nombre de modelo no válido',
        errores: ['El nombre del modelo no puede estar vacío']
      });
    }

    const params = new HttpParams().set('eliminar_videos', eliminarVideos.toString());

    return this.http.delete<RespuestaAPI>(
      `${this.apiUrl}/modelos/${encodeURIComponent(nombreModelo)}`,
      { params }
    ).pipe(
      timeout(this.TIMEOUT_DELETE_MS),
      retry(1),
      map(response => response),
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error, `eliminar modelo '${nombreModelo}'`);
      })
    );
  }

  activarMultiplesModelos(
    nombresModelos: string[],
    pesos: number[] = []
  ): Observable<RespuestaAPI> {
    if (nombresModelos.length < 2) {
      return of({
        exito: false,
        mensaje: 'Debes seleccionar al menos 2 modelos para ensemble'
      });
    }

    const pesosFinales = pesos.length === nombresModelos.length
      ? pesos
      : Array(nombresModelos.length).fill(1.0);

    const payload = {
      nombres_modelos: nombresModelos,
      pesos: pesosFinales
    };

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/modelos/activar-multiples`,
      payload
    ).pipe(
      timeout(10000),
      catchError((error) => {
        return of({
          exito: false,
          mensaje: error.error?.detail || 'Error al activar ensemble'
        });
      })
    );
  }

  desactivarTodosModelos(): Observable<RespuestaAPI> {
    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/modelos/desactivar-todos`,
      {}
    ).pipe(
      timeout(10000),
      catchError((error) => {
        return of({
          exito: false,
          mensaje: error.error?.detail || 'Error al desactivar modelos'
        });
      })
    );
  }

  obtenerConfiguracionEnsemble(): Observable<RespuestaAPI<any>> {
    return this.http.get<RespuestaAPI<any>>(
      `${this.apiUrl}/modelos/activos/ensemble`
    ).pipe(
      timeout(10000),
      catchError((error) => {
        return of({
          exito: true,
          mensaje: 'Configuración cargada',
          datos: { total_modelos: 0, modelos: [] }
        });
      })
    );
  }

  obtenerVideosModelo(nombreModelo: string): Observable<RespuestaAPI<VideosModelo>> {
    if (!nombreModelo || nombreModelo.trim() === '') {
      return of({
        exito: false,
        mensaje: 'Nombre de modelo no válido',
        datos: { total: 0, videos: [] }
      });
    }

    return this.http.get<RespuestaAPI<VideosModelo>>(
      `${this.apiUrl}/modelos/${encodeURIComponent(nombreModelo)}/videos`
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError((error) => this.handleError(error, 'obtener videos del modelo'))
    );
  }

  verificarExistenciaModelo(nombreModelo: string): Observable<boolean> {
    return this.listarModelos().pipe(
      map(response => {
        if (!response.exito || !response.datos) {
          return false;
        }
        return response.datos.some(m => m.nombre === nombreModelo);
      }),
      catchError(() => of(false))
    );
  }
}
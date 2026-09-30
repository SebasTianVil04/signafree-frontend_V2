import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DashboardEstadisticas {
  usuarios: { total: number; activos: number; nuevos_mes: number };
  lecciones: { total: number; activas: number };
  examenes: { total: number; completados: number };
  rendimiento: { progreso_promedio: number };
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

export interface ModeloActivo {
  nombre: string;
  accuracy: number;
  num_clases: number;
  tipo: string;
  fecha_activacion: string;
}

export interface ConfiguracionEnsemble {
  total_modelos: number;
  modelos: ModeloActivo[];
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

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface OpcionesPeticion {
  body?: unknown;
  params?: HttpParams;
  ms?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;
  private readonly TIMEOUT_MS = 15000;
  private readonly TIMEOUT_DELETE_MS = 30000;
  private readonly TIMEOUT_CORTO_MS = 10000;
  private readonly TIMEOUT_SUBIDA_MS = 60000;

  constructor(private http: HttpClient) { }

  private peticion<T>(metodo: Metodo, ruta: string, opciones: OpcionesPeticion = {}): Observable<T> {
    return this.http.request<T>(metodo, `${this.apiUrl}${ruta}`, {
      body: opciones.body,
      params: opciones.params
    }).pipe(timeout(opciones.ms ?? this.TIMEOUT_MS));
  }

  private handleError(error: HttpErrorResponse, operacion: string = 'operación'): Observable<RespuestaAPI> {
    const detalle = error.error?.detail;
    const mensaje = error.error instanceof ErrorEvent
      ? `Error de conexión: ${error.error.message}`
      : (typeof detalle === 'string' ? detalle : null) || error.error?.mensaje || error.message || `Error en ${operacion}`;

    return of({ exito: false, mensaje, errores: [mensaje] });
  }

  obtenerDashboard(): Observable<DashboardEstadisticas> {
    return this.peticion('GET', '/dashboard');
  }

  listarUsuarios(skip: number = 0, limit: number = 100): Observable<any> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());

    return this.peticion('GET', '/usuarios', { params });
  }

  obtenerEstadisticasUsuario(usuarioId: number): Observable<any> {
    return this.peticion('GET', `/usuarios/${usuarioId}/estadisticas`);
  }

  obtenerProgresoDetalladoUsuario(usuarioId: number): Observable<RespuestaAPI> {
    return this.peticion('GET', `/usuarios/${usuarioId}/progreso-detallado`);
  }

  cambiarEstadoUsuario(usuarioId: number, activo: boolean): Observable<RespuestaAPI> {
    return this.peticion('PATCH', `/usuarios/${usuarioId}/estado`, {
      params: new HttpParams().set('activo', activo.toString())
    });
  }

  asignarRol(usuarioId: number, rolId: number): Observable<RespuestaAPI> {
    return this.peticion<RespuestaAPI>('PUT', `/usuarios/${usuarioId}/rol`, {
      params: new HttpParams().set('rol_id', rolId.toString())
    }).pipe(catchError(error => this.handleError(error, 'asignar rol')));
  }

  actualizarUsuario(usuarioId: number, datos: DatosActualizarUsuario): Observable<RespuestaAPI> {
    let params = new HttpParams();

    Object.entries(datos).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, valor);
      }
    });

    return this.peticion<RespuestaAPI>('PUT', `/usuarios/${usuarioId}`, { params }).pipe(
      catchError(error => this.handleError(error, 'actualizar usuario'))
    );
  }

  eliminarUsuario(usuarioId: number): Observable<RespuestaAPI> {
    return this.peticion<RespuestaAPI>('DELETE', `/usuarios/${usuarioId}`).pipe(
      catchError(error => this.handleError(error, 'eliminar usuario'))
    );
  }

  subirContenidoLeccion(leccionId: number, archivo: File): Observable<RespuestaAPI> {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.peticion('POST', `/lecciones/${leccionId}/contenido`, {
      body: formData,
      ms: this.TIMEOUT_SUBIDA_MS
    });
  }

  iniciarEntrenamiento(): Observable<RespuestaAPI> {
    return this.peticion('POST', '/modelo/entrenar', { body: {} });
  }

  obtenerEstadoModelo(): Observable<RespuestaAPI> {
    return this.peticion('GET', '/modelo/estado');
  }

  toggleModelo(nombreModelo: string): Observable<RespuestaAPI> {
    return this.peticion('POST', '/modelo/toggle', { body: { nombre_modelo: nombreModelo } });
  }

  listarModelos(): Observable<RespuestaAPI<ModeloIA[]>> {
    return this.peticion<RespuestaAPI<ModeloIA[]>>('GET', '/modelos').pipe(
      catchError(error => this.handleError(error, 'listar modelos'))
    );
  }

  activarModelo(nombreModelo: string): Observable<RespuestaAPI> {
    return this.peticion<RespuestaAPI>('POST', '/modelo/activar', { body: { nombre_modelo: nombreModelo } }).pipe(
      catchError(error => this.handleError(error, 'activar modelo'))
    );
  }

  activarMultiplesModelos(nombresModelos: string[], pesos: number[] = []): Observable<RespuestaAPI> {
    if (nombresModelos.length < 1) {
      return of({ exito: false, mensaje: 'Debes seleccionar al menos 1 modelo' });
    }

    return this.peticion<RespuestaAPI>('POST', '/modelos/activar-multiples', {
      body: { nombres_modelos: nombresModelos, pesos },
      ms: this.TIMEOUT_CORTO_MS
    }).pipe(catchError(error => this.handleError(error, 'activar modelos')));
  }

  desactivarTodosModelos(): Observable<RespuestaAPI> {
    return this.peticion<RespuestaAPI>('POST', '/modelos/desactivar-todos', {
      body: {},
      ms: this.TIMEOUT_CORTO_MS
    }).pipe(catchError(error => this.handleError(error, 'desactivar modelos')));
  }

  obtenerConfiguracionEnsemble(): Observable<RespuestaAPI<ConfiguracionEnsemble>> {
    return this.peticion<RespuestaAPI<ConfiguracionEnsemble>>('GET', '/modelos/activos', {
      ms: this.TIMEOUT_CORTO_MS
    }).pipe(
      catchError(() => of({
        exito: true,
        mensaje: 'Configuración cargada',
        datos: { total_modelos: 0, modelos: [] }
      }))
    );
  }

  verificarExistenciaModelo(nombreModelo: string): Observable<boolean> {
    return this.listarModelos().pipe(
      map(response => !!response.exito && !!response.datos?.some(m => m.nombre === nombreModelo)),
      catchError(() => of(false))
    );
  }

  eliminarModelo(nombreModelo: string, eliminarVideos: boolean = false): Observable<RespuestaAPI> {
    if (!nombreModelo?.trim()) {
      return of({ exito: false, mensaje: 'Nombre de modelo no válido', errores: ['El nombre del modelo no puede estar vacío'] });
    }

    return this.peticion<RespuestaAPI>('DELETE', `/modelos/${encodeURIComponent(nombreModelo)}`, {
      params: new HttpParams().set('eliminar_videos', eliminarVideos.toString()),
      ms: this.TIMEOUT_DELETE_MS
    }).pipe(catchError(error => this.handleError(error, `eliminar modelo '${nombreModelo}'`)));
  }
}
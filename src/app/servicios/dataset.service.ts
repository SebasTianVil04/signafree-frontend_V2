import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap, takeWhile, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SKIP_GLOBAL_LOADING } from '../interceptores/loading-context';

export interface CategoriaDataset {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion?: string;
  total_videos: number;
  total_frames: number;
  activa: boolean;
  fecha_creacion: string;
}

export interface VideoDataset {
  id: number;
  categoria_id: number;
  categoria_nombre?: string;
  usuario_id?: number;
  sena: string;
  ruta_video?: string | null;
  drive_url?: string;
  drive_file_id?: string;
  duracion_segundos?: number;
  fps?: number;
  resolucion?: string;
  tamaño_bytes?: number;
  formato?: string;
  notas?: string;
  procesado: boolean;
  aprobado: boolean;
  rechazado: boolean;
  usado_entrenamiento: boolean;
  frames_extraidos?: number;
  calidad_promedio?: number;
  fecha_subida?: string;
  fecha_procesado?: string;
  fecha_aprobado?: string;
  fecha_rechazado?: string;
  subido_por?: string;
}

export interface EstadisticasDataset {
  total_videos: number;
  videos_aprobados: number;
  total_frames: number;
  total_senas: number;
  por_sena: Array<{
    sena: string;
    videos: number;
    frames: number;
    duracion_promedio?: number;
  }>;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  mensaje: string;
  datos?: T;
  errores?: string[];
}

export interface RespuestaLista<T = any> {
  exito: boolean;
  mensaje: string;
  datos: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface ProgresosEntrenamiento {
  nombre_modelo: string;
  estado: string;
  progreso: number;
  accuracy: number;
  loss: number;
  train_accuracy?: number;
  train_loss?: number;
  epoch_actual?: number;
  total_epochs?: number;
  mensaje?: string;
  fecha_inicio?: string;
  num_clases?: number;
  clases?: string[];
  total_videos?: number;
  frames_procesados?: number;
  total_frames?: number;
  arquitectura?: string;
  fecha_entrenamiento?: string;
  entrenando?: boolean;
  accuracy_por_clase?: { [clase: string]: number };
}

export interface ConfiguracionEntrenamiento {
  nombre_modelo?: string;
  categoria_ids: number[];
  epochs: number;
  batch_size?: number;
  learning_rate?: number;
}

export interface ResultadoValidacionModelo {
  valido: boolean;
  tipo?: string;
  tamano_mb?: number;
  estructura?: string;
  num_parametros?: number;
  error?: string;
  clases_detectadas?: string[];
  metadata?: any;
}

interface EntradaCache<T> {
  expira: number;
  datos$: Observable<T>;
}

const ESTADOS_FINALES = ['completado', 'error', 'timeout'];

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  private readonly apiUrl = `${environment.apiUrl}/dataset`;
  private readonly TIMEOUT_MS = 30000;
  private readonly TIMEOUT_UPLOAD_MS = 180000;
  private readonly MONITOREO_INTERVALO_MS = 2000;
  private readonly MAX_INTENTOS_MONITOREO = 7200;
  private readonly MAX_RETRIES = 2;
  private readonly MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  private readonly cacheDuracion = 30000;

  private categoriasCache: EntradaCache<RespuestaAPI<CategoriaDataset[]>> | null = null;
  private estadisticasCache: EntradaCache<RespuestaAPI<EstadisticasDataset>> | null = null;

  constructor(private http: HttpClient) { }

  private handleError(operation: string, error: HttpErrorResponse): Observable<never> {
    const detalle = error.error?.detail;
    const errorMsg = error.error instanceof ErrorEvent
      ? `Error de red: ${error.error.message}`
      : (typeof detalle === 'string' ? detalle : null) || error.error?.mensaje || error.message || `Error en ${operation}`;

    console.error(`[DatasetService] ${errorMsg}`, error);
    return throwError(() => new Error(errorMsg));
  }

  private mensajeError(error: any, porDefecto: string): string {
    const detalle = error?.error?.detail;
    return (typeof detalle === 'string' ? detalle : null) || error?.error?.mensaje || porDefecto;
  }

  private cacheVigente<T>(entrada: EntradaCache<T> | null): entrada is EntradaCache<T> {
    return !!entrada && entrada.expira > Date.now();
  }

  private num(valor: unknown): number {
    return typeof valor === 'number' ? valor : 0;
  }

  private progresoVacio(nombreModelo: string, estado: string, mensaje: string): ProgresosEntrenamiento {
    return {
      nombre_modelo: nombreModelo,
      estado,
      progreso: 0,
      accuracy: 0,
      loss: 0,
      train_accuracy: 0,
      train_loss: 0,
      epoch_actual: 0,
      total_epochs: 0,
      num_clases: 0,
      clases: [],
      total_videos: 0,
      frames_procesados: 0,
      total_frames: 0,
      mensaje,
      entrenando: false,
      accuracy_por_clase: {}
    };
  }

  private extensionModelo(archivo: File): string | undefined {
    return archivo.name.split('.').pop()?.toLowerCase();
  }

  private esExtensionModeloValida(archivo: File): boolean {
    const extension = this.extensionModelo(archivo);
    return extension === 'pth' || extension === 'pt';
  }

  listarTodosLosVideos(): Observable<RespuestaAPI<VideoDataset[]>> {
    return this.http.get<RespuestaAPI<VideoDataset[]>>(`${this.apiUrl}/videos/todos`).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => this.handleError('listarTodosLosVideos', error))
    );
  }

  rechazarVideo(videoId: number): Observable<RespuestaAPI<any>> {
    return this.http.put<RespuestaAPI<any>>(`${this.apiUrl}/videos/${videoId}/rechazar`, {}).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al rechazar video')
      }))
    );
  }

  subirVideo(archivo: File, categoriaId: number, sena: string): Observable<RespuestaAPI> {
    if (!archivo) {
      return of({ exito: false, mensaje: 'Archivo no válido' });
    }

    if (!categoriaId || categoriaId <= 0) {
      return of({ exito: false, mensaje: 'Categoría no válida' });
    }

    if (!sena?.trim()) {
      return of({ exito: false, mensaje: 'El nombre de la seña es requerido' });
    }

    if (archivo.size > this.MAX_VIDEO_BYTES) {
      return of({ exito: false, mensaje: 'El video es demasiado grande (máximo 50MB)' });
    }

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('categoria_id', categoriaId.toString());
    formData.append('sena', sena.trim().toUpperCase());

    return this.http.post<RespuestaAPI>(`${this.apiUrl}/videos/subir`, formData).pipe(
      timeout(this.TIMEOUT_UPLOAD_MS),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al subir video')
      }))
    );
  }

  listarVideosPendientes(
    categoriaId?: number,
    pagina: number = 1,
    por_pagina: number = 20
  ): Observable<RespuestaLista<VideoDataset>> {
    pagina = Math.max(1, Math.floor(pagina));
    por_pagina = Math.min(100, Math.max(1, Math.floor(por_pagina)));

    let params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('por_pagina', por_pagina.toString());

    if (categoriaId && categoriaId > 0) {
      params = params.set('categoria_id', categoriaId.toString());
    }

    return this.http.get<RespuestaLista<VideoDataset>>(`${this.apiUrl}/videos/pendientes`, { params }).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al listar videos',
        datos: [],
        total: 0,
        pagina,
        por_pagina
      }))
    );
  }

  aprobarVideo(videoId: number, aprobar: boolean = true, notas?: string): Observable<RespuestaAPI> {
    if (!videoId || videoId <= 0) {
      return of({ exito: false, mensaje: 'Video ID no válido' });
    }

    return this.http.put<RespuestaAPI>(
      `${this.apiUrl}/videos/${videoId}/aprobar`,
      { aprobar, notas: (notas || '').trim() }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al aprobar video')
      }))
    );
  }

  eliminarVideo(videoId: number): Observable<RespuestaAPI> {
    if (!videoId || videoId <= 0) {
      return of({ exito: false, mensaje: 'Video ID no válido' });
    }

    return this.http.delete<RespuestaAPI>(`${this.apiUrl}/videos/${videoId}`).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al eliminar video')
      }))
    );
  }

  obtenerCategorias(forzarRecarga: boolean = false): Observable<RespuestaAPI<CategoriaDataset[]>> {
    if (!forzarRecarga && this.cacheVigente(this.categoriasCache)) {
      return this.categoriasCache.datos$;
    }

    const datos$ = this.http.get<RespuestaAPI<CategoriaDataset[]>>(`${this.apiUrl}/categorias`).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(() => {
        this.categoriasCache = null;
        return of<RespuestaAPI<CategoriaDataset[]>>({
          exito: false,
          mensaje: 'Error al obtener categorías',
          datos: []
        });
      }),
      shareReplay(1)
    );

    this.categoriasCache = { expira: Date.now() + this.cacheDuracion, datos$ };
    return datos$;
  }

  listarCategorias(pagina: number = 1, por_pagina: number = 20): Observable<RespuestaLista<CategoriaDataset>> {
    pagina = Math.max(1, Math.floor(pagina));
    por_pagina = Math.min(100, Math.max(1, Math.floor(por_pagina)));

    const params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('por_pagina', por_pagina.toString());

    return this.http.get<RespuestaLista<CategoriaDataset>>(`${this.apiUrl}/categorias`, { params }).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al listar categorías',
        datos: [],
        total: 0,
        pagina,
        por_pagina
      }))
    );
  }

  crearCategoria(
    nombre: string,
    descripcion: string = '',
    tipoId: number = 1,
    nivelRequerido: number = 1
  ): Observable<RespuestaAPI<CategoriaDataset>> {
    if (!nombre?.trim()) {
      return of({ exito: false, mensaje: 'El nombre de la categoría es requerido' });
    }

    return this.http.post<RespuestaAPI<CategoriaDataset>>(`${this.apiUrl}/categorias`, {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      tipo_id: tipoId,
      nivel_requerido: nivelRequerido
    }).pipe(
      timeout(this.TIMEOUT_MS),
      tap(response => {
        if (response.exito) this.categoriasCache = null;
      }),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al crear categoría')
      }))
    );
  }

  validarModelo(archivo: File): Observable<RespuestaAPI<ResultadoValidacionModelo>> {
    if (!archivo) {
      return of({
        exito: false,
        mensaje: 'Archivo no válido',
        datos: { valido: false, error: 'Archivo no válido' }
      });
    }

    if (!this.esExtensionModeloValida(archivo)) {
      return of({
        exito: false,
        mensaje: 'Solo se permiten archivos .pth o .pt',
        datos: { valido: false, error: 'Formato de archivo no válido' }
      });
    }

    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.http.post<RespuestaAPI<ResultadoValidacionModelo>>(`${this.apiUrl}/validar-modelo`, formData).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al validar modelo'),
        datos: { valido: false, error: error.message }
      }))
    );
  }

  cargarModelo(
    archivo: File,
    nombreModelo: string,
    descripcion: string,
    clases: string
  ): Observable<RespuestaAPI<any>> {
    if (!archivo) {
      return of({ exito: false, mensaje: 'Archivo no válido' });
    }

    if (!this.esExtensionModeloValida(archivo)) {
      return of({ exito: false, mensaje: 'Solo se permiten archivos .pth o .pt' });
    }

    if (!nombreModelo || nombreModelo.trim().length < 3) {
      return of({ exito: false, mensaje: 'El nombre del modelo debe tener al menos 3 caracteres' });
    }

    if (clases?.trim()) {
      try {
        if (!Array.isArray(JSON.parse(clases))) {
          return of({ exito: false, mensaje: 'Las clases deben ser un array JSON válido' });
        }
      } catch {
        return of({
          exito: false,
          mensaje: 'El formato de clases debe ser un JSON válido. Ejemplo: ["hola", "gracias", "adios"]'
        });
      }
    }

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('nombre_modelo', nombreModelo.trim());

    if (descripcion?.trim()) {
      formData.append('descripcion', descripcion.trim());
    }

    if (clases?.trim()) {
      formData.append('clases', clases.trim());
    }

    return this.http.post<RespuestaAPI<any>>(`${this.apiUrl}/cargar-modelo`, formData).pipe(
      timeout(this.TIMEOUT_UPLOAD_MS),
      tap(response => {
        if (response.exito) this.limpiarCache();
      }),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al cargar modelo'),
        datos: null
      }))
    );
  }

  obtenerEstadisticas(forzarRecarga: boolean = false): Observable<RespuestaAPI<EstadisticasDataset>> {
    if (!forzarRecarga && this.cacheVigente(this.estadisticasCache)) {
      return this.estadisticasCache.datos$;
    }

    const datos$ = this.http.get<RespuestaAPI<EstadisticasDataset>>(`${this.apiUrl}/estadisticas`).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(() => {
        this.estadisticasCache = null;
        return of<RespuestaAPI<EstadisticasDataset>>({
          exito: false,
          mensaje: 'Error al obtener estadísticas',
          datos: {
            total_videos: 0,
            videos_aprobados: 0,
            total_frames: 0,
            total_senas: 0,
            por_sena: []
          }
        });
      }),
      shareReplay(1)
    );

    this.estadisticasCache = { expira: Date.now() + this.cacheDuracion, datos$ };
    return datos$;
  }

  entrenarModeloAdaptativo(configuracion: ConfiguracionEntrenamiento): Observable<RespuestaAPI> {
    if (!configuracion.categoria_ids?.length) {
      return of({ exito: false, mensaje: 'Debe seleccionar al menos una categoría' });
    }

    const epochs = Math.max(10, Math.min(500, configuracion.epochs || 50));

    return this.http.post<RespuestaAPI>(`${this.apiUrl}/entrenar-modelo`, {
      nombre_modelo: configuracion.nombre_modelo || undefined,
      categoria_ids: configuracion.categoria_ids.filter(id => id > 0),
      epochs
    }).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: this.mensajeError(error, 'Error al iniciar entrenamiento adaptativo')
      }))
    );
  }

  entrenarModeloVideo(configuracion: ConfiguracionEntrenamiento): Observable<RespuestaAPI> {
    return this.entrenarModeloAdaptativo(configuracion);
  }

  obtenerProgresoEntrenamiento(nombreModelo: string): Observable<ProgresosEntrenamiento> {
    if (!nombreModelo?.trim()) {
      return of(this.progresoVacio('', 'error', 'Nombre de modelo no válido'));
    }

    return this.http.get<RespuestaAPI<any>>(
      `${this.apiUrl}/entrenamiento/progreso/${encodeURIComponent(nombreModelo)}`,
      { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      map((response): ProgresosEntrenamiento => {
        const datos = response.datos;

        if (!response.exito || !datos) {
          return this.progresoVacio(nombreModelo, 'error', response.mensaje || 'Error al obtener progreso');
        }

        return {
          nombre_modelo: datos.nombre_modelo || nombreModelo,
          estado: datos.estado || 'error',
          progreso: this.num(datos.progreso),
          accuracy: this.num(datos.accuracy),
          loss: this.num(datos.loss),
          train_accuracy: this.num(datos.train_accuracy),
          train_loss: this.num(datos.train_loss),
          epoch_actual: this.num(datos.epoch_actual),
          total_epochs: this.num(datos.total_epochs),
          mensaje: datos.mensaje || '',
          fecha_inicio: datos.fecha_inicio,
          num_clases: this.num(datos.num_clases),
          clases: Array.isArray(datos.clases) ? datos.clases : [],
          total_videos: this.num(datos.total_videos),
          frames_procesados: this.num(datos.frames_procesados),
          total_frames: this.num(datos.total_frames),
          fecha_entrenamiento: datos.fecha_entrenamiento,
          entrenando: datos.entrenando === true,
          accuracy_por_clase: datos.accuracy_por_clase && typeof datos.accuracy_por_clase === 'object'
            ? datos.accuracy_por_clase
            : {}
        };
      }),
      catchError(error => {
        console.error('[DatasetService] Error obteniendo progreso:', error);
        return of(this.progresoVacio(nombreModelo, 'error', 'Error de conexión'));
      })
    );
  }

  monitorearEntrenamiento(nombreModelo: string): Observable<ProgresosEntrenamiento> {
    if (!nombreModelo?.trim()) {
      return of(this.progresoVacio('', 'error', 'Nombre de modelo no válido'));
    }

    return timer(0, this.MONITOREO_INTERVALO_MS).pipe(
      switchMap(intento => intento >= this.MAX_INTENTOS_MONITOREO
        ? of(this.progresoVacio(nombreModelo, 'timeout', 'Tiempo de espera agotado'))
        : this.obtenerProgresoEntrenamiento(nombreModelo)
      ),
      distinctUntilChanged((prev, curr) => {
        if (prev.estado !== curr.estado || prev.epoch_actual !== curr.epoch_actual) return false;

        return !(
          Math.abs(prev.progreso - curr.progreso) >= 0.1 ||
          Math.abs((prev.accuracy ?? 0) - (curr.accuracy ?? 0)) >= 0.001 ||
          Math.abs((prev.loss ?? 0) - (curr.loss ?? 0)) >= 0.001
        );
      }),
      takeWhile(resultado => !ESTADOS_FINALES.includes(resultado.estado), true)
    );
  }

  verificarVideosSuficientes(
    categoriaIds: number[],
    minimoRequerido: number = 10
  ): Observable<{ suficiente: boolean; total: number; mensaje: string; detalles?: any }> {
    if (!categoriaIds?.length) {
      return of({
        suficiente: false,
        total: 0,
        mensaje: 'Debe seleccionar al menos una categoría'
      });
    }

    return this.obtenerEstadisticas(true).pipe(
      map(response => {
        if (!response.exito || !response.datos) {
          return { suficiente: false, total: 0, mensaje: 'Error al verificar videos' };
        }

        const stats = response.datos;
        const total = stats.videos_aprobados;
        const suficiente = total >= minimoRequerido;

        return {
          suficiente,
          total,
          mensaje: suficiente
            ? `Suficientes videos (${total} aprobados)`
            : `Insuficientes videos (${total}/${minimoRequerido})`,
          detalles: {
            total_videos: stats.total_videos,
            videos_aprobados: stats.videos_aprobados,
            total_frames: stats.total_frames,
            senas_disponibles: stats.por_sena?.length || 0
          }
        };
      }),
      catchError(() => of({
        suficiente: false,
        total: 0,
        mensaje: 'Error al verificar disponibilidad'
      }))
    );
  }

  limpiarCache(): void {
    this.categoriasCache = null;
    this.estadisticasCache = null;
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, interval, of, throwError, timer } from 'rxjs';
import { switchMap, map, timeout, catchError, distinctUntilChanged, takeWhile, retry, shareReplay, tap, startWith, filter, debounceTime, finalize } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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
  ruta_video: string;
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

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  private apiUrl = `${environment.apiUrl}/dataset`;
  private readonly TIMEOUT_MS = 30000;
  private readonly TIMEOUT_UPLOAD_MS = 180000;
  private readonly MONITOREO_INTERVALO_MS = 2000;
  private readonly MAX_INTENTOS_MONITOREO = 7200;
  private readonly MAX_RETRIES = 2;

  private categoriasCache$?: Observable<RespuestaAPI<CategoriaDataset[]>>;
  private estadisticasCache$?: Observable<RespuestaAPI<EstadisticasDataset>>;
  private cacheDuracion = 30000;

  constructor(private http: HttpClient) {
    console.log('[DatasetService] Inicializado');
  }

  private getHeaders(): { headers: { [header: string]: string } } {
    const token = localStorage.getItem('token');
    const headers: { [header: string]: string } = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return { headers };
  }

  private getHeadersFormData(): { headers: { [header: string]: string } } {
    const token = localStorage.getItem('token');
    const headers: { [header: string]: string } = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return { headers };
  }

  private handleError(operation: string, error: HttpErrorResponse): Observable<never> {
    let errorMsg = `Error en ${operation}`;

    if (error.error instanceof ErrorEvent) {
      errorMsg = `Error de red: ${error.error.message}`;
    } else {
      errorMsg = error.error?.detail || error.error?.mensaje || error.message || errorMsg;
    }

    console.error(`[DatasetService] ${errorMsg}`, error);
    return throwError(() => new Error(errorMsg));
  }

  private progresoVacio(nombreModelo: string, estado: string, mensaje: string): ProgresosEntrenamiento {
    return {
      nombre_modelo: nombreModelo,
      estado: estado,
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
      mensaje: mensaje,
      entrenando: false,
      accuracy_por_clase: {}
    };
  }

  listarTodosLosVideos(): Observable<RespuestaAPI<VideoDataset[]>> {
    return this.http.get<RespuestaAPI<VideoDataset[]>>(
      `${this.apiUrl}/videos/todos`,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => this.handleError('listarTodosLosVideos', error))
    );
  }

  rechazarVideo(videoId: number): Observable<RespuestaAPI<any>> {
    return this.http.put<RespuestaAPI<any>>(
      `${this.apiUrl}/videos/${videoId}/rechazar`,
      {},
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: error.error?.detail || 'Error al rechazar video'
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

    const maxSize = 50 * 1024 * 1024;
    if (archivo.size > maxSize) {
      return of({ exito: false, mensaje: 'El video es demasiado grande (máximo 50MB)' });
    }

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('categoria_id', categoriaId.toString());
    formData.append('sena', sena.trim().toUpperCase());

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/videos/subir`,
      formData,
      this.getHeadersFormData()
    ).pipe(
      timeout(this.TIMEOUT_UPLOAD_MS),
      catchError(error => of({
        exito: false,
        mensaje: error.error?.detail || 'Error al subir video'
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

    return this.http.get<RespuestaLista<VideoDataset>>(
      `${this.apiUrl}/videos/pendientes`,
      { params, ...this.getHeaders() }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al listar videos',
        datos: [],
        total: 0,
        pagina: pagina,
        por_pagina: por_pagina
      }))
    );
  }

  aprobarVideo(videoId: number, aprobar: boolean = true, notas?: string): Observable<RespuestaAPI> {
    if (!videoId || videoId <= 0) {
      return of({ exito: false, mensaje: 'Video ID no válido' });
    }

    const datos = {
      aprobar: aprobar,
      notas: (notas || '').trim()
    };

    return this.http.put<RespuestaAPI>(
      `${this.apiUrl}/videos/${videoId}/aprobar`,
      datos,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: error.error?.detail || 'Error al aprobar video'
      }))
    );
  }

  eliminarVideo(videoId: number): Observable<RespuestaAPI> {
    if (!videoId || videoId <= 0) {
      return of({ exito: false, mensaje: 'Video ID no válido' });
    }

    return this.http.delete<RespuestaAPI>(
      `${this.apiUrl}/videos/${videoId}`,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: error.error?.detail || 'Error al eliminar video'
      }))
    );
  }

  obtenerCategorias(forzarRecarga: boolean = false): Observable<RespuestaAPI<CategoriaDataset[]>> {
    if (!forzarRecarga && this.categoriasCache$) {
      return this.categoriasCache$;
    }

    this.categoriasCache$ = this.http.get<RespuestaAPI<CategoriaDataset[]>>(
      `${this.apiUrl}/categorias`,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      finalize(() => {
        this.categoriasCache$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: true, windowTime: this.cacheDuracion }),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al obtener categorías',
        datos: []
      }))
    );

    return this.categoriasCache$;
  }

  listarCategorias(pagina: number = 1, por_pagina: number = 20): Observable<RespuestaLista<CategoriaDataset>> {
    pagina = Math.max(1, Math.floor(pagina));
    por_pagina = Math.min(100, Math.max(1, Math.floor(por_pagina)));

    const params = new HttpParams()
      .set('pagina', pagina.toString())
      .set('por_pagina', por_pagina.toString());

    return this.http.get<RespuestaLista<CategoriaDataset>>(
      `${this.apiUrl}/categorias`,
      { params, ...this.getHeaders() }
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al listar categorías',
        datos: [],
        total: 0,
        pagina: pagina,
        por_pagina: por_pagina
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
      return of({
        exito: false,
        mensaje: 'El nombre de la categoría es requerido'
      });
    }

    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      tipo_id: tipoId,
      nivel_requerido: nivelRequerido
    };

    return this.http.post<RespuestaAPI<CategoriaDataset>>(
      `${this.apiUrl}/categorias`,
      datos,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      map(response => {
        if (response.exito) {
          this.categoriasCache$ = undefined;
          console.log('[DatasetService] Categoría creada:', response.datos);
        }
        return response;
      }),
      catchError(error => {
        console.error('[DatasetService] Error creando categoría:', error);
        return of({
          exito: false,
          mensaje: error.error?.detail || 'Error al crear categoría'
        });
      })
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

    const extension = archivo.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pth' && extension !== 'pt') {
      return of({
        exito: false,
        mensaje: 'Solo se permiten archivos .pth o .pt',
        datos: { valido: false, error: 'Formato de archivo no válido' }
      });
    }

    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.http.post<RespuestaAPI<ResultadoValidacionModelo>>(
      `${this.apiUrl}/validar-modelo`,
      formData,
      this.getHeadersFormData()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => {
        console.error('[DatasetService] Error validando modelo:', error);
        return of({
          exito: false,
          mensaje: error.error?.detail || error.error?.mensaje || 'Error al validar modelo',
          datos: {
            valido: false,
            error: error.message
          }
        });
      })
    );
  }

  cargarModelo(
    archivo: File,
    nombreModelo: string,
    descripcion: string,
    clases: string
  ): Observable<RespuestaAPI<any>> {
    if (!archivo) {
      return of({
        exito: false,
        mensaje: 'Archivo no válido'
      });
    }

    const extension = archivo.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pth' && extension !== 'pt') {
      return of({
        exito: false,
        mensaje: 'Solo se permiten archivos .pth o .pt'
      });
    }

    if (!nombreModelo || nombreModelo.trim().length < 3) {
      return of({
        exito: false,
        mensaje: 'El nombre del modelo debe tener al menos 3 caracteres'
      });
    }

    if (clases && clases.trim()) {
      try {
        const clasesArray = JSON.parse(clases);
        if (!Array.isArray(clasesArray)) {
          return of({
            exito: false,
            mensaje: 'Las clases deben ser un array JSON válido'
          });
        }
      } catch (e) {
        return of({
          exito: false,
          mensaje: 'El formato de clases debe ser un JSON válido. Ejemplo: ["hola", "gracias", "adios"]'
        });
      }
    }

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('nombre_modelo', nombreModelo.trim());

    if (descripcion && descripcion.trim()) {
      formData.append('descripcion', descripcion.trim());
    }

    if (clases && clases.trim()) {
      formData.append('clases', clases.trim());
    }

    console.log('[DatasetService] Cargando modelo:', {
      nombre: nombreModelo,
      tamaño: `${(archivo.size / (1024 * 1024)).toFixed(2)} MB`,
      extension: extension,
      tieneClases: !!clases
    });

    return this.http.post<RespuestaAPI<any>>(
      `${this.apiUrl}/cargar-modelo`,
      formData,
      this.getHeadersFormData()
    ).pipe(
      timeout(this.TIMEOUT_UPLOAD_MS),
      tap(response => {
        if (response.exito) {
          console.log('[DatasetService] Modelo cargado exitosamente:', response.datos);
          this.limpiarCache();
        }
      }),
      catchError(error => {
        console.error('[DatasetService] Error cargando modelo:', error);
        return of({
          exito: false,
          mensaje: error.error?.detail || error.error?.mensaje || 'Error al cargar modelo',
          datos: null
        });
      })
    );
  }

  obtenerEstadisticas(forzarRecarga: boolean = false): Observable<RespuestaAPI<EstadisticasDataset>> {
    if (!forzarRecarga && this.estadisticasCache$) {
      return this.estadisticasCache$;
    }

    this.estadisticasCache$ = this.http.get<RespuestaAPI<EstadisticasDataset>>(
      `${this.apiUrl}/estadisticas`,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      retry(this.MAX_RETRIES),
      finalize(() => {
        this.estadisticasCache$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: true, windowTime: this.cacheDuracion }),
      catchError(() => of({
        exito: false,
        mensaje: 'Error al obtener estadísticas',
        datos: {
          total_videos: 0,
          videos_aprobados: 0,
          total_frames: 0,
          total_senas: 0,
          por_sena: []
        }
      }))
    );

    return this.estadisticasCache$;
  }

  entrenarModeloAdaptativo(configuracion: ConfiguracionEntrenamiento): Observable<RespuestaAPI> {
    if (!configuracion.categoria_ids?.length) {
      return of({
        exito: false,
        mensaje: 'Debe seleccionar al menos una categoría'
      });
    }

    let epochs = configuracion.epochs || 50;
    epochs = Math.max(10, Math.min(500, epochs));

    const datosEnvio = {
      nombre_modelo: configuracion.nombre_modelo || undefined,
      categoria_ids: configuracion.categoria_ids.filter(id => id > 0),
      epochs: epochs
    };

    console.log('[DatasetService] Iniciando entrenamiento adaptativo:', datosEnvio);

    return this.http.post<RespuestaAPI>(
      `${this.apiUrl}/entrenar-modelo`,
      datosEnvio,
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      catchError(error => of({
        exito: false,
        mensaje: error.error?.detail || error.error?.mensaje || 'Error al iniciar entrenamiento adaptativo'
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
      this.getHeaders()
    ).pipe(
      timeout(this.TIMEOUT_MS),
      map(response => {
        if (response.exito && response.datos) {
          const datos = response.datos;

          const resultado: ProgresosEntrenamiento = {
            nombre_modelo: datos.nombre_modelo || nombreModelo,
            estado: datos.estado || 'error',
            progreso: typeof datos.progreso === 'number' ? datos.progreso : 0,
            accuracy: typeof datos.accuracy === 'number' ? datos.accuracy : 0,
            loss: typeof datos.loss === 'number' ? datos.loss : 0,
            train_accuracy: typeof datos.train_accuracy === 'number' ? datos.train_accuracy : 0,
            train_loss: typeof datos.train_loss === 'number' ? datos.train_loss : 0,
            epoch_actual: typeof datos.epoch_actual === 'number' ? datos.epoch_actual : 0,
            total_epochs: typeof datos.total_epochs === 'number' ? datos.total_epochs : 0,
            mensaje: datos.mensaje || '',
            fecha_inicio: datos.fecha_inicio,
            num_clases: typeof datos.num_clases === 'number' ? datos.num_clases : 0,
            clases: Array.isArray(datos.clases) ? datos.clases : [],
            total_videos: typeof datos.total_videos === 'number' ? datos.total_videos : 0,
            frames_procesados: typeof datos.frames_procesados === 'number' ? datos.frames_procesados : 0,
            total_frames: typeof datos.total_frames === 'number' ? datos.total_frames : 0,
            fecha_entrenamiento: datos.fecha_entrenamiento,
            entrenando: typeof datos.entrenando === 'boolean' ? datos.entrenando : false,
            accuracy_por_clase: datos.accuracy_por_clase && typeof datos.accuracy_por_clase === 'object'
              ? datos.accuracy_por_clase
              : {}
          };

          return resultado;
        }

        console.warn('[DatasetService] Respuesta sin datos válidos:', response);
        return this.progresoVacio(nombreModelo, 'error', response.mensaje || 'Error al obtener progreso');
      }),
      catchError((error) => {
        console.error('[DatasetService] Error obteniendo progreso:', error);
        return of(this.progresoVacio(nombreModelo, 'error', 'Error de conexión'));
      })
    );
  }

  monitorearEntrenamiento(nombreModelo: string): Observable<ProgresosEntrenamiento> {
    if (!nombreModelo?.trim()) {
      return of(this.progresoVacio('', 'error', 'Nombre de modelo no válido'));
    }

    let intentos = 0;

    return interval(this.MONITOREO_INTERVALO_MS).pipe(
      startWith(0),
      switchMap(() => {
        intentos++;

        if (intentos > this.MAX_INTENTOS_MONITOREO) {
          return of(this.progresoVacio(nombreModelo, 'timeout', 'Tiempo de espera agotado'));
        }

        return this.obtenerProgresoEntrenamiento(nombreModelo);
      }),
      debounceTime(100),
      distinctUntilChanged((prev, curr) => {
        if (prev.estado !== curr.estado) return false;
        if (prev.epoch_actual !== curr.epoch_actual) return false;

        const accuracyPrev = prev.accuracy ?? 0;
        const accuracyCurr = curr.accuracy ?? 0;
        const lossPrev = prev.loss ?? 0;
        const lossCurr = curr.loss ?? 0;

        const cambioSignificativo =
          Math.abs(prev.progreso - curr.progreso) >= 0.1 ||
          Math.abs(accuracyPrev - accuracyCurr) >= 0.001 ||
          Math.abs(lossPrev - lossCurr) >= 0.001;

        return !cambioSignificativo;
      }),
      takeWhile(resultado => {
        const continuar =
          resultado.estado !== 'completado' &&
          resultado.estado !== 'error' &&
          resultado.estado !== 'timeout';

        return continuar;
      }, true)
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
          return {
            suficiente: false,
            total: 0,
            mensaje: 'Error al verificar videos'
          };
        }

        const stats = response.datos;
        const videosTotal = stats.videos_aprobados;
        const suficiente = videosTotal >= minimoRequerido;

        const mensaje = suficiente
          ? `Suficientes videos (${videosTotal} aprobados)`
          : `Insuficientes videos (${videosTotal}/${minimoRequerido})`;

        return {
          suficiente: suficiente,
          total: videosTotal,
          mensaje: mensaje,
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
    this.categoriasCache$ = undefined;
    this.estadisticasCache$ = undefined;
    console.log('[DatasetService] Cache limpiado');
  }
}
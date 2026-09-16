import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { AdminService, ModeloIA, ConfiguracionEnsemble } from '../../../servicios/admin.service';
import { Subscription, of, firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { Categoria, CategoriaService } from '../../../servicios/categoria.service';
import { CategoriaDataset, DatasetService, EstadisticasDataset, ResultadoValidacionModelo } from '../../../servicios/dataset.service';
import { EntrenamientoEstadoService } from '../../../servicios/entrenamiento-estado.service';

export type SeccionEntrenamiento = 'resumen' | 'subir' | 'cargar-modelo' | 'entrenar' | 'asignaciones' | 'modelos';

const QK_CATEGORIAS = ['categorias'] as const;
const QK_ESTADISTICAS = ['estadisticas'] as const;
const QK_MODELOS = ['modelos'] as const;
const QK_ENSEMBLE = ['ensemble'] as const;
const QK_CATEGORIAS_CON_MODELOS = ['categoriasConModelos'] as const;

const STALE_CATEGORIAS = 5 * 60 * 1000;
const STALE_ESTADISTICAS = 30 * 1000;
const STALE_MODELOS = 30 * 1000;
const STALE_ENSEMBLE = 30 * 1000;
const STALE_CATEGORIAS_CON_MODELOS = 30 * 1000;

@Component({
  selector: 'app-entrenamiento-modelo',
  templateUrl: './entrenamiento-modelo.component.html',
  styleUrls: ['./entrenamiento-modelo.component.scss'],
  standalone: false
})
export class EntrenamientoModeloComponent implements OnInit, OnDestroy {
  accionEnCurso: boolean = false;
  error: string | null = null;
  mensaje: string | null = null;

  seccionActiva: SeccionEntrenamiento = 'resumen';

  modelosDisponibles: ModeloIA[] = [];
  categoriasConModelos: Categoria[] = [];
  asignacionesModelo: Map<number, number> = new Map();
  mostrarModalAsignacion: boolean = false;

  estadisticas: EstadisticasDataset | null = null;
  categorias: CategoriaDataset[] = [];
  modelos: ModeloIA[] = [];

  configuracion = {
    nombre_modelo: '',
    categoria_ids: [] as number[],
    epochs: 50
  };

  archivosSeleccionados: File[] = [];
  categoriaSeleccionada: number | null = null;
  senaSeleccionada: string = '';

  archivoModeloSeleccionado: File | null = null;
  nombreModeloCarga: string = '';
  descripcionModeloCarga: string = '';
  clasesModeloCarga: string = '';
  clasesDetectadas: string[] = [];
  validandoModelo: boolean = false;
  cargandoModelo: boolean = false;
  resultadoValidacion: ResultadoValidacionModelo | null = null;

  datosClases: number[] = [];
  etiquetasClases: string[] = [];

  modoEnsemble: boolean = false;
  modelosSeleccionadosEnsemble: string[] = [];
  pesosEnsemble: { [key: string]: number } = {};
  configurandoEnsemble: boolean = false;
  configuracionEnsemble: ConfiguracionEnsemble | null = null;
  entrenando: boolean = false;
  modeloActualEntrenando: string | null = null;
  progresoActual: number = 0;
  estadoEntrenamiento: string = 'preparando';
  epochActual: number = 0;
  totalEpochs: number = 0;
  accuracyActual: number = 0;
  lossActual: number = 0;
  trainAccuracyActual: number = 0;
  trainLossActual: number = 0;
  mensajeProgreso: string = '';
  tiempoTranscurrido: string = '0:00';
  framesProcesados: number = 0;
  totalFrames: number = 0;
  numClases: number = 0;
  clasesActuales: string[] = [];

  private entrenandoAnterior: boolean = false;
  private readonly TIMEOUT_MS = 10000;

  private queryClient = injectQueryClient();

  private categoriasQuery = injectQuery(() => ({
    queryKey: QK_CATEGORIAS,
    queryFn: () => firstValueFrom(
      this.datasetService.obtenerCategorias().pipe(
        timeout(this.TIMEOUT_MS),
        catchError(() => of({ exito: false, datos: [] as CategoriaDataset[], mensaje: 'Error' }))
      )
    ),
    staleTime: STALE_CATEGORIAS
  }));

  private estadisticasQuery = injectQuery(() => ({
    queryKey: QK_ESTADISTICAS,
    queryFn: () => firstValueFrom(
      this.datasetService.obtenerEstadisticas().pipe(
        timeout(this.TIMEOUT_MS),
        catchError(() => of({ exito: false, datos: null as EstadisticasDataset | null, mensaje: 'Error' }))
      )
    ),
    staleTime: STALE_ESTADISTICAS
  }));

  private modelosQuery = injectQuery(() => ({
    queryKey: QK_MODELOS,
    queryFn: () => firstValueFrom(
      this.adminService.listarModelos().pipe(
        timeout(this.TIMEOUT_MS),
        catchError(() => of({ exito: false, datos: [] as ModeloIA[], mensaje: 'Error' }))
      )
    ),
    staleTime: STALE_MODELOS
  }));

  private ensembleQuery = injectQuery(() => ({
    queryKey: QK_ENSEMBLE,
    queryFn: () => firstValueFrom(
      this.adminService.obtenerConfiguracionEnsemble().pipe(
        timeout(this.TIMEOUT_MS),
        catchError(() => of({ exito: false, datos: null as ConfiguracionEnsemble | null, mensaje: 'Error' }))
      )
    ),
    staleTime: STALE_ENSEMBLE
  }));

  private categoriasConModelosQuery = injectQuery(() => ({
    queryKey: QK_CATEGORIAS_CON_MODELOS,
    queryFn: () => firstValueFrom(
      this.categoriaService.listarCategoriasConModelos().pipe(
        timeout(this.TIMEOUT_MS),
        catchError(() => of({ exito: false, datos: [] as Categoria[], mensaje: 'Error' }))
      )
    ),
    staleTime: STALE_CATEGORIAS_CON_MODELOS
  }));

  constructor(
    private adminService: AdminService,
    private datasetService: DatasetService,
    private categoriaService: CategoriaService,
    private entrenamientoEstado: EntrenamientoEstadoService
  ) {
    effect(() => {
      const res = this.categoriasQuery.data();
      if (res?.exito && res.datos) {
        this.categorias = [...res.datos];
      }
    });

    effect(() => {
      const res = this.estadisticasQuery.data();
      if (res?.exito && res.datos) {
        this.estadisticas = { ...res.datos };
        this.prepararDatosGraficos();
      }
    });

    effect(() => {
      const res = this.modelosQuery.data();
      if (res?.exito && res.datos) {
        this.modelos = this.mapearModelos(res.datos);
      }
    });

    effect(() => {
      const res = this.ensembleQuery.data();
      if (res?.exito && res.datos) {
        this.configuracionEnsemble = { ...res.datos };
      }
    });

    effect(() => {
      const res = this.categoriasConModelosQuery.data();
      if (res?.exito && res.datos) {
        this.categoriasConModelos = this.mapearCategoriasConModelos(res.datos);
      }
    });

    effect(() => {
      const huboFallos = this.categoriasQuery.isError()
        || this.estadisticasQuery.isError()
        || this.modelosQuery.isError()
        || this.ensembleQuery.isError()
        || this.categoriasConModelosQuery.isError();
      if (huboFallos && !this.cargando) {
        this.mostrarError('No se pudieron cargar algunos datos. Intenta de nuevo.');
      }
    });
  }

  get cargando(): boolean {
    return this.accionEnCurso
      || this.categoriasQuery.isPending()
      || this.estadisticasQuery.isPending()
      || this.modelosQuery.isPending()
      || this.ensembleQuery.isPending()
      || this.categoriasConModelosQuery.isPending();
  }

  ngOnInit(): void {
    this.suscribirEstadoEntrenamiento();
  }

  cambiarSeccion(seccion: SeccionEntrenamiento): void {
    this.seccionActiva = seccion;
  }

  private suscribirEstadoEntrenamiento(): void {
    this.entrenamientoEstado.estado$.subscribe(estado => {
      this.entrenando = estado.entrenando;
      this.modeloActualEntrenando = estado.modeloActualEntrenando;
      this.progresoActual = estado.progresoActual;
      this.estadoEntrenamiento = estado.estadoEntrenamiento;
      this.epochActual = estado.epochActual;
      this.totalEpochs = estado.totalEpochs;
      this.accuracyActual = estado.accuracyActual;
      this.lossActual = estado.lossActual;
      this.trainAccuracyActual = estado.trainAccuracyActual;
      this.trainLossActual = estado.trainLossActual;
      this.mensajeProgreso = estado.mensajeProgreso;
      this.tiempoTranscurrido = estado.tiempoTranscurrido;
      this.framesProcesados = estado.framesProcesados;
      this.totalFrames = estado.totalFrames;
      this.numClases = estado.numClases;
      this.clasesActuales = estado.clasesActuales;

      if (this.entrenandoAnterior && !estado.entrenando) {
        this.manejarFinDeEntrenamiento();
      }
      this.entrenandoAnterior = estado.entrenando;
    });

    if (!this.entrenamientoEstado.enCurso && this.entrenamientoEstado.resultadoPendiente) {
      this.manejarFinDeEntrenamiento();
    }
  }

  private manejarFinDeEntrenamiento(): void {
    const resultado = this.entrenamientoEstado.consumirResultadoPendiente();
    this.resetearConfiguracionEntrenamiento();
    this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });

    if (!resultado) return;

    if (resultado.exito) {
      setTimeout(() => {
        Swal.fire({
          icon: 'success',
          title: '¡Entrenamiento Completado!',
          html: `
            <div style="text-align: left; padding: 15px;">
              <p style="margin: 10px 0;"><strong>Modelo:</strong> ${resultado.nombre_modelo}</p>
              <p style="margin: 10px 0;"><strong>Accuracy:</strong> ${((resultado.accuracy || 0) * 100).toFixed(2)}%</p>
              <p style="margin: 10px 0;"><strong>Épocas:</strong> ${resultado.epochs_entrenadas}</p>
              <p style="margin: 10px 0;"><strong>Clases:</strong> ${resultado.num_clases}</p>
            </div>
          `,
          confirmButtonColor: '#28a745',
          confirmButtonText: 'Aceptar',
          allowOutsideClick: false,
          width: '500px'
        });
      }, 200);
    } else {
      this.mostrarError(resultado.error || 'Error en el entrenamiento');
    }
  }

  private resetearConfiguracionEntrenamiento(): void {
    this.configuracion = {
      nombre_modelo: '',
      categoria_ids: [],
      epochs: 50
    };
  }

  ngOnDestroy(): void {
  }

  cargarDatos(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
    this.queryClient.invalidateQueries({ queryKey: QK_ESTADISTICAS });
    this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
    this.queryClient.invalidateQueries({ queryKey: QK_ENSEMBLE });
    this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS_CON_MODELOS });
  }

  forzarActualizacionCompleta(): void {
    this.cargarDatos();
  }

  private mapearModelos(datos: ModeloIA[]): ModeloIA[] {
    return [...datos].map((m: ModeloIA) => ({
      ...m,
      accuracy_porcentaje: m.accuracy ? `${(m.accuracy * 100).toFixed(2)}%` : 'N/A',
      calidad: this.obtenerCalidadModelo(m.accuracy),
      estado_texto: m.activo ? 'Activo' : 'Inactivo'
    }));
  }

  private mapearCategoriasConModelos(datos: Categoria[]): Categoria[] {
    return [...datos].map(categoria => ({
      ...categoria,
      modelo_nombre: categoria.modelo_nombre || undefined,
      modelo_activo: categoria.modelo_activo || false,
      modelo_accuracy: categoria.modelo_accuracy || 0,
      tiene_modelo: categoria.tiene_modelo || false
    }));
  }

  private mostrarExito(mensaje: string): void {
    Swal.fire({
      icon: 'success',
      title: '¡Éxito!',
      text: mensaje,
      confirmButtonColor: '#28a745',
      timer: 3000,
      timerProgressBar: true
    });
  }

  private mostrarError(mensaje: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: mensaje,
      confirmButtonColor: '#dc3545'
    });
  }

  private mostrarAdvertencia(mensaje: string): void {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: mensaje,
      confirmButtonColor: '#ffc107'
    });
  }

  private async confirmarAccion(titulo: string, mensaje: string): Promise<boolean> {
    const result = await Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#007bff',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    });
    return result.isConfirmed;
  }

  toggleModoEnsemble(): void {
    this.modoEnsemble = !this.modoEnsemble;

    setTimeout(() => {
      if (!this.modoEnsemble) {
        const modelosActivos = this.modelos.filter(m => m.activo);
        this.modelosSeleccionadosEnsemble = modelosActivos.length > 0
          ? [modelosActivos[0].nombre]
          : [];
        this.pesosEnsemble = {};
      } else {
        this.modelosSeleccionadosEnsemble = [];
        this.pesosEnsemble = {};
      }
    }, 0);
  }

  toggleModeloEnsemble(nombreModelo: string): void {
    const index = this.modelosSeleccionadosEnsemble.indexOf(nombreModelo);

    if (index > -1) {
      this.modelosSeleccionadosEnsemble.splice(index, 1);
      delete this.pesosEnsemble[nombreModelo];
    } else {
      this.modelosSeleccionadosEnsemble.push(nombreModelo);
      this.pesosEnsemble[nombreModelo] = 1.0;
    }
  }

  estaModeloSeleccionadoEnsemble(nombreModelo: string): boolean {
    return this.modelosSeleccionadosEnsemble.includes(nombreModelo);
  }

  async aplicarEnsemble(): Promise<void> {
    if (this.modelosSeleccionadosEnsemble.length < 2) {
      this.mostrarError('Debes seleccionar al menos 2 modelos para ensemble');
      return;
    }

    if (this.configurandoEnsemble) return;

    const sumaPesos = Object.values(this.pesosEnsemble).reduce((a, b) => a + b, 0);
    const pesosNormalizados: { [key: string]: number } = {};
    Object.keys(this.pesosEnsemble).forEach(nombre => {
      pesosNormalizados[nombre] = this.pesosEnsemble[nombre] / sumaPesos;
    });

    const mensaje = `Activar ensemble con ${this.modelosSeleccionadosEnsemble.length} modelos:\n\n` +
      this.modelosSeleccionadosEnsemble.map(nombre =>
        `${nombre}: peso ${pesosNormalizados[nombre].toFixed(2)}`
      ).join('\n');

    const confirmar = await this.confirmarAccion('Configurar Ensemble', mensaje);
    if (!confirmar) return;

    this.configurandoEnsemble = true;
    this.error = null;

    this.adminService.activarMultiplesModelos(
      this.modelosSeleccionadosEnsemble,
      Object.values(this.pesosEnsemble)
    ).subscribe({
      next: (response) => {
        this.configurandoEnsemble = false;
        if (response.exito) {
          this.mostrarExito(response.mensaje || 'Ensemble configurado exitosamente');
          this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
          this.queryClient.invalidateQueries({ queryKey: QK_ENSEMBLE });
        } else {
          this.mostrarError(response.mensaje || 'Error al configurar ensemble');
        }
      },
      error: (err) => {
        this.configurandoEnsemble = false;
        this.mostrarError(err.error?.detail || err.error?.mensaje || 'Error al configurar ensemble');
      }
    });
  }

  async desactivarTodosModelos(): Promise<void> {
    const confirmar = await this.confirmarAccion(
      'Desactivar Modelos',
      '¿Desactivar todos los modelos activos?'
    );
    if (!confirmar) return;

    this.adminService.desactivarTodosModelos().subscribe({
      next: (response) => {
        if (response.exito) {
          this.mostrarExito(response.mensaje || 'Todos los modelos desactivados');
          this.modoEnsemble = false;
          this.modelosSeleccionadosEnsemble = [];
          this.pesosEnsemble = {};
          this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
          this.queryClient.invalidateQueries({ queryKey: QK_ENSEMBLE });
        } else {
          this.mostrarError(response.mensaje || 'Error al desactivar modelos');
        }
      },
      error: () => {
        this.mostrarError('Error al desactivar modelos');
      }
    });
  }

  cargarModelosParaAsignacion(): void {
    this.adminService.listarModelos().pipe(
      timeout(this.TIMEOUT_MS),
      catchError(() => of({ exito: false, datos: [], mensaje: 'Error' }))
    ).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.modelosDisponibles = [...response.datos];
        }
      },
      error: (err) => {
        console.error('Error cargando modelos:', err);
      }
    });
  }

  abrirModalAsignacion(): void {
    this.mostrarModalAsignacion = true;
    this.cargarModelosParaAsignacion();
  }

  cerrarModalAsignacion(): void {
    this.mostrarModalAsignacion = false;
    this.asignacionesModelo.clear();
  }

  seleccionarModeloParaCategoria(categoriaId: number, modeloId: any): void {
    const modeloIdNum = parseInt(modeloId);
    if (modeloId === 'null' || modeloId === null || modeloId === '') {
      this.asignacionesModelo.set(categoriaId, null as any);
    } else if (modeloIdNum && !isNaN(modeloIdNum)) {
      this.asignacionesModelo.set(categoriaId, modeloIdNum);
    } else {
      this.asignacionesModelo.delete(categoriaId);
    }
  }

  obtenerModeloSeleccionado(categoriaId: number): number | undefined {
    return this.asignacionesModelo.get(categoriaId);
  }

  async aplicarAsignacionesModelos(): Promise<void> {
    if (this.asignacionesModelo.size === 0) {
      this.mostrarError('No hay asignaciones para aplicar');
      return;
    }

    const confirmar = await this.confirmarAccion(
      'Aplicar Asignaciones',
      `¿Aplicar ${this.asignacionesModelo.size} asignaciones de modelos a categorías?`
    );

    if (!confirmar) return;

    this.accionEnCurso = true;
    this.error = null;

    const asignacionesArray: any[] = [];
    this.asignacionesModelo.forEach((modeloId, categoriaId) => {
      asignacionesArray.push({
        categoria_id: categoriaId,
        modelo_id: modeloId
      });
    });

    this.categoriaService.asignarModelosEnLote(asignacionesArray).subscribe({
      next: (response) => {
        this.accionEnCurso = false;
        if (response.exito) {
          this.mostrarExito(response.mensaje);
          this.cerrarModalAsignacion();
          this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
          this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
          this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS_CON_MODELOS });
        } else {
          this.mostrarError(response.mensaje || 'Error al aplicar asignaciones');
        }
      },
      error: (err) => {
        this.accionEnCurso = false;
        this.mostrarError('Error al aplicar asignaciones');
        console.error('Error:', err);
      }
    });
  }

  async desasignarModeloDeCategoria(categoriaId: number): Promise<void> {
    const confirmar = await this.confirmarAccion(
      'Desasignar Modelo',
      '¿Desasignar modelo de esta categoría?'
    );
    if (!confirmar) return;

    this.accionEnCurso = true;
    this.categoriaService.desasignarModelo(categoriaId).subscribe({
      next: (response) => {
        this.accionEnCurso = false;
        this.mostrarExito(response.mensaje);
        this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS_CON_MODELOS });
      },
      error: () => {
        this.accionEnCurso = false;
        this.mostrarError('Error al desasignar modelo');
      }
    });
  }

  async asignacionRapida(modelo: ModeloIA): Promise<void> {
    if (modelo.id === undefined || modelo.id === null) {
      this.mostrarError('El modelo no tiene un ID válido');
      return;
    }

    const { value: categoriaId } = await Swal.fire({
      title: 'Asignación Rápida',
      input: 'number',
      inputLabel: 'ID de la categoría:',
      inputPlaceholder: 'Ingresa el ID',
      showCancelButton: true,
      confirmButtonText: 'Asignar',
      cancelButtonText: 'Cancelar'
    });

    if (!categoriaId) return;

    this.accionEnCurso = true;
    this.categoriaService.asignarModelo(parseInt(categoriaId), modelo.id).subscribe({
      next: (response) => {
        this.accionEnCurso = false;
        this.mostrarExito(response.mensaje);
        this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS_CON_MODELOS });
      },
      error: () => {
        this.accionEnCurso = false;
        this.mostrarError('Error al asignar modelo');
      }
    });
  }

  prepararDatosGraficos(): void {
    if (!this.estadisticas?.por_sena) {
      return;
    }
    this.etiquetasClases = [...this.estadisticas.por_sena.map(item => item.sena)];
    this.datosClases = [...this.estadisticas.por_sena.map(item => item.videos)];
  }

  onFileSelect(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.archivosSeleccionados = Array.from(files);
      this.error = null;
    }
  }

  onModeloFileSelect(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'pth' || extension === 'pt') {
        this.archivoModeloSeleccionado = file;
        this.error = null;
        this.resultadoValidacion = null;
        this.clasesDetectadas = [];
        this.clasesModeloCarga = '';
      } else {
        this.mostrarError('Solo se permiten archivos .pth o .pt');
        this.archivoModeloSeleccionado = null;
        event.target.value = '';
      }
    }
  }

  validarModelo(): void {
    if (!this.archivoModeloSeleccionado) {
      this.mostrarError('Selecciona un archivo de modelo');
      return;
    }
    if (this.validandoModelo) return;

    this.validandoModelo = true;
    this.error = null;
    this.resultadoValidacion = null;
    this.clasesDetectadas = [];
    this.datasetService.validarModelo(this.archivoModeloSeleccionado).subscribe({
      next: (response) => {
        this.validandoModelo = false;
        if (response.exito && response.datos) {
          this.resultadoValidacion = response.datos;
          if (response.datos.valido && response.datos.clases_detectadas) {
            this.clasesDetectadas = [...response.datos.clases_detectadas];
            this.clasesModeloCarga = JSON.stringify(this.clasesDetectadas, null, 2);
            this.mostrarExito('Modelo válido y compatible - Clases detectadas automáticamente');
          } else {
            this.mostrarAdvertencia('Modelo válido y compatible - Ingresa las clases manualmente');
          }
        } else {
          this.mostrarError(response.mensaje || 'Modelo inválido');
        }
      },
      error: (err) => {
        this.validandoModelo = false;
        this.mostrarError('Error al validar el modelo');
        console.error(err);
      }
    });
  }

  formatearClases(): void {
    if (this.clasesModeloCarga.trim()) {
      try {
        const clasesArray = JSON.parse(this.clasesModeloCarga);
        this.clasesModeloCarga = JSON.stringify(clasesArray, null, 2);
        this.error = null;
      } catch (e) {
      }
    }
  }

  usarClasesDetectadas(): void {
    if (this.clasesDetectadas.length > 0) {
      this.clasesModeloCarga = JSON.stringify(this.clasesDetectadas, null, 2);
      this.mostrarExito('Clases detectadas aplicadas automáticamente');
    }
  }

  async cargarModelo(): Promise<void> {
    if (!this.archivoModeloSeleccionado) {
      this.mostrarError('Selecciona un archivo de modelo');
      return;
    }
    if (!this.nombreModeloCarga || this.nombreModeloCarga.trim().length < 3) {
      this.mostrarError('El nombre del modelo debe tener al menos 3 caracteres');
      return;
    }
    if (!this.clasesModeloCarga || this.clasesModeloCarga.trim() === '') {
      this.mostrarError('Debes especificar las clases en formato JSON');
      return;
    }
    let clasesArray: string[] = [];
    try {
      clasesArray = JSON.parse(this.clasesModeloCarga);
      if (!Array.isArray(clasesArray) || clasesArray.length < 2) {
        this.mostrarError('Las clases deben ser un array con al menos 2 elementos');
        return;
      }
      if (!clasesArray.every(item => typeof item === 'string')) {
        this.mostrarError('Todos los elementos del array deben ser strings');
        return;
      }
    } catch (e) {
      this.mostrarError('El formato de clases debe ser un JSON válido. Ejemplo: ["hola", "gracias", "adios"]');
      return;
    }

    if (this.cargandoModelo) return;

    const mensaje = `Cargar modelo "${this.nombreModeloCarga}"\n\n` +
      `Clases: ${clasesArray.length} (${clasesArray.slice(0, 3).join(', ')}${clasesArray.length > 3 ? '...' : ''})\n` +
      `Descripción: ${this.descripcionModeloCarga || 'Sin descripción'}`;

    const confirmar = await this.confirmarAccion('Cargar Modelo', mensaje);
    if (!confirmar) return;

    this.cargandoModelo = true;
    this.error = null;
    this.mensaje = null;

    this.datasetService.cargarModelo(
      this.archivoModeloSeleccionado,
      this.nombreModeloCarga.trim(),
      this.descripcionModeloCarga.trim(),
      this.clasesModeloCarga.trim()
    ).subscribe({
      next: (response) => {
        this.cargandoModelo = false;
        if (response.exito) {
          this.mostrarExito(response.mensaje || 'Modelo cargado exitosamente');
          this.limpiarFormularioCargaModelo();
          this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
        } else {
          this.mostrarError(response.mensaje || 'Error al cargar el modelo');
        }
      },
      error: (err) => {
        this.cargandoModelo = false;
        this.mostrarError(err.error?.detail || err.error?.mensaje || 'Error al cargar el modelo');
        console.error(err);
      }
    });
  }

  limpiarFormularioCargaModelo(): void {
    this.archivoModeloSeleccionado = null;
    this.nombreModeloCarga = '';
    this.descripcionModeloCarga = '';
    this.clasesModeloCarga = '';
    this.clasesDetectadas = [];
    this.resultadoValidacion = null;
    const fileInput = document.querySelector('#archivoModelo') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  async subirVideos(): Promise<void> {
    if (this.archivosSeleccionados.length === 0) {
      this.mostrarError('Por favor selecciona al menos un video');
      return;
    }
    if (!this.categoriaSeleccionada) {
      this.mostrarError('Por favor selecciona una categoría');
      return;
    }
    if (!this.senaSeleccionada || this.senaSeleccionada.trim() === '') {
      this.mostrarError('Por favor ingresa el nombre de la seña');
      return;
    }
    if (this.accionEnCurso) return;

    this.accionEnCurso = true;
    this.error = null;
    this.mensaje = null;
    let totalSubidos = 0;
    let totalErrores = 0;

    for (const archivo of this.archivosSeleccionados) {
      try {
        const response = await this.datasetService.subirVideo(
          archivo,
          this.categoriaSeleccionada!,
          this.senaSeleccionada.toUpperCase()
        ).toPromise();
        if (response?.exito) {
          totalSubidos++;
        } else {
          totalErrores++;
        }
        this.mensaje = `Subiendo: ${totalSubidos + totalErrores}/${this.archivosSeleccionados.length}`;
      } catch (error) {
        totalErrores++;
      }
    }

    if (totalSubidos > 0) {
      this.mostrarExito(`Se subieron ${totalSubidos} video(s). Errores: ${totalErrores}`);
      this.limpiarFormulario();
      this.queryClient.invalidateQueries({ queryKey: QK_ESTADISTICAS });
      this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
    } else {
      this.mostrarError('No se pudo subir ningún video');
    }
    this.accionEnCurso = false;
  }

  limpiarFormulario(): void {
    this.archivosSeleccionados = [];
    this.senaSeleccionada = '';
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  toggleCategoriaParaEntrenamiento(categoriaId: number): void {
    const index = this.configuracion.categoria_ids.indexOf(categoriaId);
    if (index > -1) {
      this.configuracion.categoria_ids.splice(index, 1);
    } else {
      this.configuracion.categoria_ids.push(categoriaId);
    }
  }

  seleccionarTodasCategorias(): void {
    this.configuracion.categoria_ids = this.categorias.map(c => c.id);
  }

  deseleccionarTodasCategorias(): void {
    this.configuracion.categoria_ids = [];
  }

  estaCategoriaSeleccionada(categoriaId: number): boolean {
    return this.configuracion.categoria_ids.includes(categoriaId);
  }

  async iniciarEntrenamiento(): Promise<void> {
    if (this.entrenamientoEstado.enCurso) {
      this.mostrarAdvertencia('Ya hay un entrenamiento en curso');
      return;
    }

    if (!this.validarEntrenamiento()) {
      return;
    }

    const mensaje = `¿Estás seguro de iniciar el entrenamiento?\n\n` +
      `Configuración:\n` +
      `- Modelo: ${this.configuracion.nombre_modelo}\n` +
      `- Categorías: ${this.configuracion.categoria_ids.length}\n` +
      `- Épocas: ${this.configuracion.epochs}\n\n` +
      `El entrenamiento puede tardar varios minutos. Puedes navegar a otras ` +
      `secciones mientras entrena: el progreso sigue corriendo y lo verás al volver aquí.`;

    const confirmar = await this.confirmarAccion('Iniciar Entrenamiento', mensaje);
    if (!confirmar) return;

    this.error = null;
    this.mensaje = 'Iniciando entrenamiento...';

    const configuracionEnviada = { ...this.configuracion, categoria_ids: [...this.configuracion.categoria_ids] };

    this.datasetService.entrenarModeloAdaptativo(configuracionEnviada).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          const nombreModelo = response.datos.nombre_modelo || configuracionEnviada.nombre_modelo || '';
          const epocasRetornadas = response.datos.epocas || configuracionEnviada.epochs;

          if (nombreModelo) {
            this.mensaje = `Entrenamiento iniciado: ${nombreModelo}`;
            this.entrenamientoEstado.iniciarMonitoreo(nombreModelo, epocasRetornadas, this.datasetService);
            this.resetearConfiguracionEntrenamiento();
          } else {
            this.mostrarError('No se pudo obtener el nombre del modelo');
          }
        } else {
          this.mostrarError(response.mensaje || 'Error durante el entrenamiento');
        }
      },
      error: (err) => {
        this.mostrarError(err.error?.detail || err.error?.mensaje || 'Error al iniciar entrenamiento');
      }
    });
  }

  private validarEntrenamiento(): boolean {
    if (!this.configuracion.nombre_modelo || this.configuracion.nombre_modelo.trim() === '') {
      this.mostrarError('El nombre del modelo es obligatorio');
      return false;
    }
    if (this.configuracion.nombre_modelo.length < 3) {
      this.mostrarError('El nombre del modelo debe tener al menos 3 caracteres');
      return false;
    }
    if (!this.estadisticas || this.estadisticas.videos_aprobados < 5) {
      this.mostrarError('Necesitas al menos 5 videos aprobados');
      return false;
    }
    if (this.configuracion.categoria_ids.length === 0) {
      this.mostrarError('Debes seleccionar al menos una categoría');
      return false;
    }
    if (!this.configuracion.epochs || this.configuracion.epochs < 10) {
      this.mostrarError('Las épocas deben ser mayores a 10');
      return false;
    }
    if (this.configuracion.epochs > 500) {
      this.mostrarError('Las épocas no pueden ser mayores a 500');
      return false;
    }
    return true;
  }

  async alternarEstado(modelo: ModeloIA): Promise<void> {
    if (!modelo.nombre) return;

    if (this.modoEnsemble && this.modelosSeleccionadosEnsemble.length > 1) {
      this.mostrarError('En modo ensemble usa la configuración de ensemble para activar/desactivar modelos');
      return;
    }

    const accion = modelo.activo ? 'desactivar' : 'activar';
    const confirmar = await this.confirmarAccion(
      `${accion.charAt(0).toUpperCase() + accion.slice(1)} Modelo`,
      `¿Estás seguro de ${accion} el modelo "${modelo.nombre}"?`
    );
    if (!confirmar) return;

    const servicio = modelo.activo
      ? this.adminService.toggleModelo(modelo.nombre)
      : this.adminService.activarModelo(modelo.nombre);

    servicio.subscribe({
      next: (res) => {
        this.mostrarExito(res.mensaje || `Modelo ${modelo.activo ? 'desactivado' : 'activado'}`);
        this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
        this.queryClient.invalidateQueries({ queryKey: QK_ENSEMBLE });
      },
      error: () => {
        this.mostrarError(`Error al ${modelo.activo ? 'desactivar' : 'activar'} modelo`);
      }
    });
  }

  async eliminarModelo(modelo: ModeloIA, eliminarVideos: boolean = false): Promise<void> {
    const mensaje = eliminarVideos
      ? `¿Eliminar "${modelo.nombre}" Y TODOS sus videos asociados?`
      : `¿Eliminar el modelo "${modelo.nombre}"?`;

    const confirmar = await this.confirmarAccion('Eliminar Modelo', mensaje);
    if (!confirmar) return;

    this.adminService.eliminarModelo(modelo.nombre, eliminarVideos).subscribe({
      next: (res) => {
        this.mostrarExito(res.mensaje || 'Modelo eliminado');
        this.queryClient.invalidateQueries({ queryKey: QK_MODELOS });
        this.queryClient.invalidateQueries({ queryKey: QK_ENSEMBLE });
        if (eliminarVideos) {
          this.queryClient.invalidateQueries({ queryKey: QK_ESTADISTICAS });
          this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
        }
      },
      error: (err) => {
        this.mostrarError(err.error?.mensaje || 'Error al eliminar modelo');
      }
    });
  }

  private obtenerCalidadModelo(accuracy?: number): string {
    if (!accuracy) return 'Sin datos';
    if (accuracy >= 0.95) return 'Excelente';
    if (accuracy >= 0.90) return 'Muy Bueno';
    if (accuracy >= 0.80) return 'Bueno';
    if (accuracy >= 0.70) return 'Regular';
    return 'Necesita Mejora';
  }

  obtenerColorEstado(): string {
    if (!this.estadisticas) return 'secondary';
    const total = this.estadisticas.videos_aprobados;
    if (total >= 20) return 'success';
    if (total >= 10) return 'warning';
    return 'danger';
  }

  obtenerMensajeEstado(): string {
    if (!this.estadisticas) return 'Sin datos';
    const total = this.estadisticas.videos_aprobados;
    if (total >= 20) return 'Dataset listo';
    if (total >= 10) return 'Dataset mínimo';
    return 'Insuficiente';
  }

  get totalVideosAprobados(): number {
    return this.estadisticas?.videos_aprobados || 0;
  }

  get accuracyPorcentaje(): string {
    return `${(this.accuracyActual * 100).toFixed(2)}%`;
  }

  get trainAccuracyPorcentaje(): string {
    return `${(this.trainAccuracyActual * 100).toFixed(2)}%`;
  }

  get lossFormateado(): string {
    return this.lossActual.toFixed(4);
  }

  get trainLossFormateado(): string {
    return this.trainLossActual.toFixed(4);
  }

  get clasesTexto(): string {
    if (!this.clasesActuales || this.clasesActuales.length === 0) {
      return 'Cargando...';
    }
    const maxMostrar = 5;
    if (this.clasesActuales.length <= maxMostrar) {
      return this.clasesActuales.join(', ');
    }
    const primeras = this.clasesActuales.slice(0, maxMostrar).join(', ');
    const restantes = this.clasesActuales.length - maxMostrar;
    return `${primeras} ... (+${restantes} más)`;
  }

  get tieneClasesDetectadas(): boolean {
    return this.clasesDetectadas.length > 0;
  }

  get textoClasesDetectadas(): string {
    if (!this.tieneClasesDetectadas) return '';
    return this.clasesDetectadas.slice(0, 5).join(', ') +
      (this.clasesDetectadas.length > 5 ? ` ... (+${this.clasesDetectadas.length - 5} más)` : '');
  }

  get modelosDisponiblesEnsemble(): ModeloIA[] {
    return this.modelos.filter(m => !m.activo);
  }

  get tieneModelosSuficientesParaEnsemble(): boolean {
    return this.modelos.length >= 2;
  }

  get textoEstadoEnsemble(): string {
    if (!this.modoEnsemble) {
      return 'Modo individual';
    }
    if (this.modelosSeleccionadosEnsemble.length < 2) {
      return 'Selecciona al menos 2 modelos';
    }
    return `Ensemble con ${this.modelosSeleccionadosEnsemble.length} modelos`;
  }

  limpiarSeleccionEnsemble(): void {
    this.modelosSeleccionadosEnsemble = [];
    this.pesosEnsemble = {};
    this.mostrarExito('Selección de ensemble limpiada');
  }

  actualizarPesoEnsemble(nombreModelo: string, event: any): void {
    const nuevoPeso = parseFloat(event.target.value);
    if (nuevoPeso && nuevoPeso > 0) {
      this.pesosEnsemble[nombreModelo] = nuevoPeso;
    } else {
      this.pesosEnsemble[nombreModelo] = 1.0;
      event.target.value = '1.0';
    }
  }
}
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { DatasetService, ProgresosEntrenamiento } from './dataset.service';

export interface ResultadoEntrenamiento {
  exito: boolean;
  nombre_modelo?: string;
  accuracy?: number;
  loss?: number;
  num_clases?: number;
  clases?: string[];
  epochs_entrenadas?: number;
  videos_asociados?: number;
  error?: string;
  modo?: string;
  advertencia?: string;
}

export interface EstadoEntrenamientoUI {
  entrenando: boolean;
  modeloActualEntrenando: string | null;
  progresoActual: number;
  estadoEntrenamiento: string;
  epochActual: number;
  totalEpochs: number;
  accuracyActual: number;
  lossActual: number;
  trainAccuracyActual: number;
  trainLossActual: number;
  mensajeProgreso: string;
  tiempoTranscurrido: string;
  framesProcesados: number;
  totalFrames: number;
  numClases: number;
  clasesActuales: string[];
}

const ESTADO_INICIAL: EstadoEntrenamientoUI = {
  entrenando: false,
  modeloActualEntrenando: null,
  progresoActual: 0,
  estadoEntrenamiento: 'preparando',
  epochActual: 0,
  totalEpochs: 0,
  accuracyActual: 0,
  lossActual: 0,
  trainAccuracyActual: 0,
  trainLossActual: 0,
  mensajeProgreso: '',
  tiempoTranscurrido: '0:00',
  framesProcesados: 0,
  totalFrames: 0,
  numClases: 0,
  clasesActuales: []
};

@Injectable({ providedIn: 'root' })
export class EntrenamientoEstadoService {
  private readonly estadoSubject = new BehaviorSubject<EstadoEntrenamientoUI>({ ...ESTADO_INICIAL });
  readonly estado$ = this.estadoSubject.asObservable();

  resultadoPendiente: ResultadoEntrenamiento | null = null;

  private suscripcionMonitoreo: Subscription | null = null;
  private intervaloTiempo: ReturnType<typeof setInterval> | null = null;
  private inicioEntrenamiento: number | null = null;

  get estadoActual(): EstadoEntrenamientoUI {
    return this.estadoSubject.value;
  }

  get enCurso(): boolean {
    return this.estadoActual.entrenando;
  }

  private patch(cambios: Partial<EstadoEntrenamientoUI>): void {
    this.estadoSubject.next({ ...this.estadoActual, ...cambios });
  }

  iniciarMonitoreo(nombreModelo: string, totalEpochs: number, datasetService: DatasetService): void {
    this.detenerMonitoreoInterno();

    this.estadoSubject.next({
      ...ESTADO_INICIAL,
      entrenando: true,
      modeloActualEntrenando: nombreModelo,
      totalEpochs
    });

    this.inicioEntrenamiento = Date.now();
    this.intervaloTiempo = setInterval(() => this.actualizarTiempo(), 1000);

    this.suscripcionMonitoreo = datasetService.monitorearEntrenamiento(nombreModelo).subscribe({
      next: progreso => this.procesarProgreso(progreso, nombreModelo),
      error: () => this.finalizarConError('Error monitoreando entrenamiento')
    });
  }

  consumirResultadoPendiente(): ResultadoEntrenamiento | null {
    const resultado = this.resultadoPendiente;
    this.resultadoPendiente = null;
    return resultado;
  }

  private procesarProgreso(progreso: ProgresosEntrenamiento, nombreModelo: string): void {
    const actual = this.estadoActual;

    this.patch({
      progresoActual: progreso.progreso || 0,
      estadoEntrenamiento: progreso.estado || 'preparando',
      mensajeProgreso: progreso.mensaje || 'Procesando...',
      accuracyActual: progreso.accuracy || 0,
      lossActual: progreso.loss || 0,
      trainAccuracyActual: progreso.train_accuracy || 0,
      trainLossActual: progreso.train_loss || 0,
      framesProcesados: progreso.frames_procesados || 0,
      totalFrames: progreso.total_frames || 0,
      numClases: progreso.num_clases || 0,
      clasesActuales: progreso.clases ? [...progreso.clases] : actual.clasesActuales,
      epochActual: progreso.epoch_actual ?? actual.epochActual,
      totalEpochs: progreso.total_epochs ?? actual.totalEpochs
    });

    if (progreso.estado === 'completado') {
      setTimeout(() => this.finalizarExitoso(progreso, nombreModelo), 500);
    } else if (progreso.estado === 'error' || progreso.estado === 'timeout') {
      this.finalizarConError(progreso.mensaje || 'Error en el entrenamiento');
    }
  }

  private finalizarExitoso(progreso: ProgresosEntrenamiento, nombreModelo: string): void {
    const actual = this.estadoActual;

    this.resultadoPendiente = {
      exito: true,
      nombre_modelo: progreso.nombre_modelo || nombreModelo,
      accuracy: progreso.accuracy ?? actual.accuracyActual,
      loss: progreso.loss ?? actual.lossActual,
      num_clases: progreso.num_clases,
      clases: progreso.clases ? [...progreso.clases] : [],
      epochs_entrenadas: actual.totalEpochs,
      videos_asociados: progreso.total_videos,
      modo: 'produccion'
    };

    this.finalizar();
  }

  private finalizarConError(mensajeError: string): void {
    this.resultadoPendiente = { exito: false, error: mensajeError };
    this.finalizar();
  }

  private finalizar(): void {
    this.detenerMonitoreoInterno();
    this.patch({ entrenando: false });
  }

  private detenerMonitoreoInterno(): void {
    this.suscripcionMonitoreo?.unsubscribe();
    this.suscripcionMonitoreo = null;

    if (this.intervaloTiempo) {
      clearInterval(this.intervaloTiempo);
      this.intervaloTiempo = null;
    }
    this.inicioEntrenamiento = null;
  }

  private actualizarTiempo(): void {
    if (this.inicioEntrenamiento === null) return;

    const segundosTotales = Math.floor((Date.now() - this.inicioEntrenamiento) / 1000);
    const minutos = Math.floor(segundosTotales / 60);
    const segundos = segundosTotales % 60;

    this.patch({ tiempoTranscurrido: `${minutos}:${segundos.toString().padStart(2, '0')}` });
  }
}
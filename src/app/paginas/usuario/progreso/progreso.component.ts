import { Component, OnInit, effect } from '@angular/core';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProgresoService } from '../../../servicios/progreso.service';

const QK_RESUMEN = ['resumenProgreso'] as const;
const QK_ESTADISTICAS_GAMIFICACION = ['estadisticasGamificacion'] as const;
const QK_RANKING = ['rankingProgreso'] as const;

const STALE_RESUMEN = 15 * 1000;
const STALE_ESTADISTICAS_GAMIFICACION = 15 * 1000;
const STALE_RANKING = 60 * 1000;

@Component({
  selector: 'app-progreso',
  templateUrl: './progreso.component.html',
  styleUrls: ['./progreso.component.scss'],
  standalone: false
})
export class ProgresoComponent implements OnInit {
  estadisticas: any = {
    nivel_actual: 1,
    xp_total: 0,
    progreso_nivel: 0,
    exp_restante: 1000,
    total_lecciones: 0,
    lecciones_completadas: 0,
    porcentaje_completado: 0,
    total_puntos: 0,
    total_estrellas: 0,
    precision_global: 0,
    racha_actual: 0,
    mejor_racha: 0,
    logros_desbloqueados: 0,
    total_logros: 10,
    desglose_puntos: {
      puntos_clases: 0,
      puntos_examenes: 0
    }
  };

  progresosLecciones: any[] = [];
  logrosDesbloqueados: any[] = [];
  ranking: any[] = [];
  error: string | null = null;

  private queryClient = injectQueryClient();

  private resumenQuery = injectQuery(() => ({
    queryKey: QK_RESUMEN,
    queryFn: () => firstValueFrom(
      this.progresoService.obtenerResumenUsuario().pipe(
        catchError(error => {
          console.error('Error en obtenerResumenUsuario:', error);
          return of({
            total_lecciones: 0,
            lecciones_completadas: 0,
            porcentaje_completado: 0,
            total_puntos: 0,
            total_estrellas: 0,
            progresos: []
          });
        })
      )
    ),
    staleTime: STALE_RESUMEN
  }));

  private estadisticasGamificacionQuery = injectQuery(() => ({
    queryKey: QK_ESTADISTICAS_GAMIFICACION,
    queryFn: () => firstValueFrom(
      this.progresoService.obtenerEstadisticasGamificacion().pipe(
        catchError(error => {
          console.error('Error en obtenerEstadisticasGamificacion:', error);
          return of({
            puntos_totales: 0,
            xp_total: 0,
            nivel_actual: 1,
            progreso_nivel: 0,
            lecciones_completadas: 0,
            total_lecciones: 0,
            clases_completadas: 0,
            total_clases: 0,
            racha_actual: 0,
            mejor_racha: 0,
            tiempo_total_practica_horas: 0,
            precision_global: 0,
            logros_desbloqueados: 0,
            total_logros: 10,
            desglose_puntos: {
              puntos_clases: 0,
              puntos_examenes: 0
            }
          });
        })
      )
    ),
    staleTime: STALE_ESTADISTICAS_GAMIFICACION
  }));

  private rankingQuery = injectQuery(() => ({
    queryKey: QK_RANKING,
    queryFn: () => firstValueFrom(
      this.progresoService.obtenerRanking().pipe(
        catchError(error => {
          console.error('Error en obtenerRanking:', error);
          return of([]);
        })
      )
    ),
    staleTime: STALE_RANKING
  }));

  constructor(private progresoService: ProgresoService) { }

  effectProcesarDatos = effect(() => {
    const resumen = this.resumenQuery.data();
    const estadisticas = this.estadisticasGamificacionQuery.data();
    const ranking = this.rankingQuery.data();

    if (resumen && estadisticas && ranking !== undefined) {
      this.procesarDatosGamificacion({ resumen, estadisticas, ranking });
    }
  });

  effectError = effect(() => {
    const huboError = this.resumenQuery.isError()
      || this.estadisticasGamificacionQuery.isError()
      || this.rankingQuery.isError();
    if (huboError) {
      console.error('Error general al cargar gamificación');
      this.error = 'Error al cargar los datos de progreso';
    } else {
      this.error = null;
    }
  });

  get cargando(): boolean {
    return this.resumenQuery.isPending()
      || this.estadisticasGamificacionQuery.isPending()
      || this.rankingQuery.isPending();
  }

  ngOnInit(): void {
  }

  cargarDatosGamificacion(): void {
    this.error = null;
    this.queryClient.invalidateQueries({ queryKey: QK_RESUMEN });
    this.queryClient.invalidateQueries({ queryKey: QK_ESTADISTICAS_GAMIFICACION });
    this.queryClient.invalidateQueries({ queryKey: QK_RANKING });
  }

  private procesarDatosGamificacion(results: any): void {
    const resumen = results.resumen;
    const estadisticas = results.estadisticas;
    const ranking = results.ranking;
    const clasesCompletadas = resumen.estadisticas_clases?.clases_completadas || 0;
    const totalClases = resumen.estadisticas_clases?.total_clases || 0;
    const porcentajeGeneral = resumen.estadisticas_clases?.porcentaje_clases || 0;

    const puntosClases = estadisticas.puntos_totales || 0;
    const puntosExamenes = estadisticas.estadisticas_examenes?.puntos_examenes ||
      estadisticas.desglose_puntos?.puntos_examenes || 0;

    const puntosTotales = puntosClases + puntosExamenes;

    const desglosePuntos = estadisticas.desglose_puntos || {
      puntos_clases: puntosClases,
      puntos_examenes: puntosExamenes
    };

    this.estadisticas = {
      nivel_actual: estadisticas.nivel_actual || 1,
      xp_total: estadisticas.xp_total || 0,
      progreso_nivel: estadisticas.progreso_nivel || 0,
      exp_restante: this.calcularExpRestante(estadisticas.xp_total || 0, estadisticas.nivel_actual || 1),
      total_lecciones: resumen.total_lecciones || 0,
      lecciones_completadas: resumen.lecciones_completadas || 0,
      porcentaje_completado: porcentajeGeneral,
      total_puntos: puntosTotales,
      total_estrellas: resumen.total_estrellas || 0,
      precision_global: estadisticas.precision_global || 0,
      racha_actual: estadisticas.racha_actual || 0,
      mejor_racha: estadisticas.mejor_racha || 0,
      logros_desbloqueados: estadisticas.logros_desbloqueados || 0,
      total_logros: estadisticas.total_logros || 10,
      desglose_puntos: desglosePuntos,
      tiempo_total_practica: estadisticas.tiempo_total_practica_horas || 0,
      clases_completadas: clasesCompletadas,
      total_clases: totalClases
    };

    if (resumen.progresos && Array.isArray(resumen.progresos)) {
      this.progresosLecciones = resumen.progresos.map((progreso: any) => ({
        leccion_titulo: progreso.leccion_titulo || `Lección ${progreso.leccion_id}`,
        leccion_id: progreso.leccion_id,
        total_clases: progreso.total_clases || 0,
        clases_completadas: progreso.clases_completadas || 0,
        mejor_precision: progreso.mejor_precision || 0,
        estrellas: progreso.estrellas || 0,
        porcentaje_completado: progreso.porcentaje_completado || 0,
        completada: progreso.completada || false,
        iniciada: progreso.iniciada || false,
        estrella_dorada: progreso.tiene_estrella_dorada || progreso.mejor_precision >= 0.95,
        puntos_leccion: progreso.total_puntos || 0,
        puntos_examenes: progreso.puntos_examenes || 0,
        puntos_clases: progreso.puntos_clases || 0
      }));
    } else {
      this.progresosLecciones = [];
    }

    this.generarLogrosDesbloqueados();

    if (ranking && Array.isArray(ranking)) {
      this.ranking = ranking.map((usuario: any, index: number) => ({
        ...usuario,
        posicion: usuario.posicion || index + 1,
        es_actual: usuario.es_usuario_actual || false
      }));
    } else {
      this.ranking = [];
    }
  }

  forzarActualizacionProgreso(): void {
    this.error = null;

    this.progresoService.actualizarProgresoLecciones().subscribe({
      next: (response: any) => {
        console.log('Progreso recalculado exitosamente:', response);
        this.recargarDatos();
      },
      error: (err: any) => {
        console.error('Error al forzar actualización:', err);
        this.error = 'Error al recalcular progreso. Intenta nuevamente.';
        this.recargarDatos();
      }
    });
  }

  private calcularExpRestante(xpTotal: number, nivelActual: number): number {
    const expPorNivel = 100;
    const expNecesariaNivelActual = (nivelActual - 1) * expPorNivel;
    const expEnNivelActual = xpTotal - expNecesariaNivelActual;
    return Math.max(0, expPorNivel - expEnNivelActual);
  }

  private generarLogrosDesbloqueados(): void {
    this.logrosDesbloqueados = [];

    if (this.estadisticas.lecciones_completadas >= 1) {
      this.logrosDesbloqueados.push({
        titulo: 'Primeros Pasos',
        descripcion: 'Completaste tu primera lección',
        fecha_desbloqueo: new Date().toISOString(),
        emoji: '🎉'
      });
    }

    if (this.estadisticas.precision_global >= 90) {
      this.logrosDesbloqueados.push({
        titulo: 'Precisión Excelente',
        descripcion: 'Mantienes una precisión superior al 90%',
        fecha_desbloqueo: new Date().toISOString(),
        emoji: '🎯'
      });
    }

    if (this.estadisticas.racha_actual >= 7) {
      this.logrosDesbloqueados.push({
        titulo: 'Racha de Fuego',
        descripcion: '7 días consecutivos practicando',
        fecha_desbloqueo: new Date().toISOString(),
        emoji: '🔥'
      });
    }

    if (this.estadisticas.nivel_actual >= 5) {
      this.logrosDesbloqueados.push({
        titulo: 'Experto en Señas',
        descripcion: 'Alcanzaste el nivel 5',
        fecha_desbloqueo: new Date().toISOString(),
        emoji: '🏆'
      });
    }

    if (this.estadisticas.total_puntos >= 100) {
      this.logrosDesbloqueados.push({
        titulo: 'Cazador de Puntos',
        descripcion: 'Alcanzaste 100 puntos',
        fecha_desbloqueo: new Date().toISOString(),
        emoji: '⭐'
      });
    }
  }

  obtenerColorNivel(nivel: number): string {
    const colores: Record<number, string> = {
      1: 'nivel-principiante',
      2: 'nivel-aprendiz',
      3: 'nivel-intermedio',
      4: 'nivel-avanzado',
      5: 'nivel-experto'
    };
    return colores[nivel] || 'nivel-principiante';
  }

  obtenerNivelTexto(nivel: number): string {
    const niveles: Record<number, string> = {
      1: 'Principiante',
      2: 'Aprendiz',
      3: 'Intermedio',
      4: 'Avanzado',
      5: 'Experto'
    };
    return niveles[nivel] || 'Principiante';
  }

  obtenerClaseDominio(precision: number): string {
    if (precision >= 90) return 'dominio-excelente';
    if (precision >= 80) return 'dominio-bueno';
    if (precision >= 70) return 'dominio-aceptable';
    return 'dominio-basico';
  }

  obtenerNivelDominio(precision: number): string {
    if (precision >= 90) return 'Excelente';
    if (precision >= 80) return 'Bueno';
    if (precision >= 70) return 'Aceptable';
    return 'Básico';
  }

  obtenerIniciales(nombreCompleto: string): string {
    if (!nombreCompleto) return '??';

    const palabras = nombreCompleto.trim().split(' ');

    if (palabras.length === 1) {
      return palabras[0].substring(0, 2).toUpperCase();
    } else {
      return (palabras[0].charAt(0) + palabras[palabras.length - 1].charAt(0)).toUpperCase();
    }
  }

  obtenerColorAvatar(nombreCompleto: string): string {
    const colores = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];

    let hash = 0;
    for (let i = 0; i < nombreCompleto.length; i++) {
      hash = nombreCompleto.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colores.length;
    return colores[index];
  }

  obtenerClaseEstadoLeccion(progreso: any): string {
    if (progreso.completada) {
      return progreso.estrella_dorada ? 'estado-dorado' : 'estado-completado';
    }
    return progreso.iniciada ? 'estado-en-progreso' : 'estado-pendiente';
  }

  obtenerTextoEstadoLeccion(progreso: any): string {
    if (progreso.completada) {
      return progreso.estrella_dorada ? 'Perfecto' : 'Completada';
    }
    return progreso.iniciada ? 'En progreso' : 'Pendiente';
  }

  get mostrarDatos(): boolean {
    return !this.cargando && !this.error;
  }

  recargarDatos(): void {
    this.cargarDatosGamificacion();
  }
}
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, from, interval, of } from 'rxjs';
import { catchError, concatMap, filter, finalize, take } from 'rxjs/operators';
import { ProgresoService, SesionEstudioCrear } from './progreso.service';
import { AutenticacionService } from './autenticacion.service';

export type TipoSesion = 'clase' | 'practica' | 'examen' | 'video';

export interface SesionActiva {
  clase_id?: number;
  leccion_id?: number;
  tipo_sesion: TipoSesion;
  fecha_inicio: string;
  tiempoInicio: number;
}

interface SesionPendiente {
  sesion: SesionEstudioCrear;
  intentos: number;
  usuarioId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SeguimientoTiempoService {
  private readonly CLAVE_PENDIENTES = 'sesiones_pendientes';
  private readonly DURACION_MINIMA_S = 10;
  private readonly MAX_INTENTOS = 3;

  private sesionActiva: SesionActiva | null = null;
  private readonly temporizador$ = new BehaviorSubject<number>(0);
  private intervaloSubscription?: Subscription;
  private reintentando = false;

  constructor(
    private progresoService: ProgresoService,
    private auth: AutenticacionService
  ) {
    this.auth.usuarioActual.pipe(
      filter(usuario => !!usuario),
      take(1)
    ).subscribe(() => this.reintentarSesionesPendientes());
  }

  iniciarSesion(claseId?: number, leccionId?: number, tipo: TipoSesion = 'clase'): boolean {
    const claseValida = !!claseId && claseId > 0;
    const leccionValida = !!leccionId && leccionId > 0;

    if (!claseValida && !leccionValida) {
      console.warn('No se puede iniciar sesión sin clase_id o leccion_id válido');
      return false;
    }

    if (this.sesionActiva) {
      this.detenerSesion();
    }

    const tiempoInicio = Date.now();

    this.sesionActiva = {
      clase_id: claseValida ? claseId : undefined,
      leccion_id: leccionValida ? leccionId : undefined,
      tipo_sesion: tipo,
      fecha_inicio: new Date(tiempoInicio).toISOString(),
      tiempoInicio
    };

    this.iniciarTemporizador();
    return true;
  }

  detenerSesion(): void {
    const sesion = this.sesionActiva;
    if (!sesion) return;

    const tiempoFin = Date.now();
    const duracion = Math.floor((tiempoFin - sesion.tiempoInicio) / 1000);

    this.limpiarSesion();

    if (duracion < this.DURACION_MINIMA_S) return;

    const sesionData: SesionEstudioCrear = {
      clase_id: sesion.clase_id,
      leccion_id: sesion.leccion_id,
      tipo_sesion: sesion.tipo_sesion,
      fecha_inicio: sesion.fecha_inicio,
      fecha_fin: new Date(tiempoFin).toISOString(),
      duracion_segundos: duracion,
      dispositivo: this.obtenerInfoDispositivo(),
      user_agent: navigator.userAgent
    };

    this.progresoService.crearSesionEstudio(sesionData).subscribe({
      error: () => this.agregarPendiente({
        sesion: sesionData,
        intentos: 0,
        usuarioId: this.auth.usuarioActualValor?.id
      })
    });
  }

  getSesionActual(): SesionActiva | null {
    return this.sesionActiva;
  }

  getTiempoTranscurrido(): Observable<number> {
    return this.temporizador$.asObservable();
  }

  getSesionActiva(): boolean {
    return this.sesionActiva !== null;
  }

  getTiempoTranscurridoValor(): number {
    return this.temporizador$.value;
  }

  formatearTiempo(segundos: number): string {
    if (segundos < 60) return `${segundos}s`;

    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;

    if (minutos < 60) {
      return segundosRestantes > 0 ? `${minutos}m ${segundosRestantes}s` : `${minutos}m`;
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}m` : `${horas}h`;
  }

  reintentarSesionesPendientes(): void {
    const usuarioId = this.auth.usuarioActualValor?.id;
    if (this.reintentando || usuarioId === undefined) return;

    const todas = this.leerPendientes();
    const propias = todas.filter(p => p.usuarioId === undefined || p.usuarioId === usuarioId);
    if (propias.length === 0) return;

    this.reintentando = true;
    this.escribirPendientes(todas.filter(p => !propias.includes(p)));

    from(propias).pipe(
      concatMap(pendiente => this.progresoService.crearSesionEstudio(pendiente.sesion).pipe(
        catchError(error => {
          const sinConexionOAuth = error?.status === 0 || error?.status === 401;
          const intentos = pendiente.intentos + (sinConexionOAuth ? 0 : 1);
          if (intentos < this.MAX_INTENTOS) {
            this.agregarPendiente({ ...pendiente, intentos, usuarioId });
          }
          return of(null);
        })
      )),
      finalize(() => (this.reintentando = false))
    ).subscribe();
  }

  limpiarSesionesPendientes(): void {
    localStorage.removeItem(this.CLAVE_PENDIENTES);
  }

  getEstadisticasSesionesPendientes(): { total: number; conReintentos: number } {
    const pendientes = this.leerPendientes();
    return {
      total: pendientes.length,
      conReintentos: pendientes.filter(p => p.intentos > 0).length
    };
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();

    this.intervaloSubscription = interval(1000).subscribe(() => {
      if (this.sesionActiva) {
        this.temporizador$.next(Math.floor((Date.now() - this.sesionActiva.tiempoInicio) / 1000));
      }
    });
  }

  private detenerTemporizador(): void {
    this.intervaloSubscription?.unsubscribe();
    this.intervaloSubscription = undefined;
  }

  private limpiarSesion(): void {
    this.detenerTemporizador();
    this.sesionActiva = null;
    this.temporizador$.next(0);
  }

  private obtenerInfoDispositivo(): string {
    const ua = navigator.userAgent.toLowerCase();

    if (/tablet|ipad/.test(ua)) return 'tablet';
    if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
    return 'desktop';
  }

  private leerPendientes(): SesionPendiente[] {
    try {
      const crudo = JSON.parse(localStorage.getItem(this.CLAVE_PENDIENTES) || '[]');
      if (!Array.isArray(crudo)) return [];

      return crudo.flatMap((entrada: any): SesionPendiente[] => {
        if (entrada?.sesion?.fecha_inicio) {
          return [{
            sesion: entrada.sesion,
            intentos: Number(entrada.intentos) || 0,
            usuarioId: entrada.usuarioId
          }];
        }
        if (entrada?.fecha_inicio) {
          const { intento_fecha, intentos, ...sesion } = entrada;
          return [{ sesion, intentos: Number(intentos) || 0 }];
        }
        return [];
      });
    } catch {
      return [];
    }
  }

  private escribirPendientes(pendientes: SesionPendiente[]): void {
    try {
      if (pendientes.length === 0) {
        localStorage.removeItem(this.CLAVE_PENDIENTES);
      } else {
        localStorage.setItem(this.CLAVE_PENDIENTES, JSON.stringify(pendientes));
      }
    } catch (error) {
      console.error('Error guardando sesiones pendientes:', error);
    }
  }

  private agregarPendiente(pendiente: SesionPendiente): void {
    const pendientes = this.leerPendientes();
    pendientes.push(pendiente);
    this.escribirPendientes(pendientes);
  }
}
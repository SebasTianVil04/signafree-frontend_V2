import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProgresoService, SesionEstudioCrear } from './progreso.service';
import { BehaviorSubject, interval, Observable, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SesionActiva {
  clase_id?: number;
  leccion_id?: number;
  tipo_sesion: 'clase' | 'practica' | 'examen' | 'video';
  fecha_inicio: string;
  tiempoInicio: number;
}

@Injectable({
  providedIn: 'root'
})
export class SeguimientoTiempoService {
  private sesionActiva: SesionActiva | null = null;
  private temporizador$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private intervaloSubscription?: Subscription;
  private apiUrl = environment.apiUrl;

  constructor(
    private progresoService: ProgresoService,
    private http: HttpClient
  ) {
    // Reintentar sesiones pendientes al inicializar el servicio
    this.reintentarSesionesPendientes();
  }

  iniciarSesion(
    claseId?: number,
    leccionId?: number,
    tipo: 'clase' | 'practica' | 'examen' | 'video' = 'clase'
  ): boolean {
    // Validar que al menos un ID esté presente
    if ((!claseId || claseId <= 0) && (!leccionId || leccionId <= 0)) {
      console.warn('No se puede iniciar sesión sin clase_id o leccion_id válido');
      return false;
    }

    // Detener sesión anterior si existe
    if (this.sesionActiva) {
      this.detenerSesion();
    }

    const tiempoInicio = Date.now();

    this.sesionActiva = {
      clase_id: claseId && claseId > 0 ? claseId : undefined,
      leccion_id: leccionId && leccionId > 0 ? leccionId : undefined,
      tipo_sesion: tipo,
      fecha_inicio: new Date(tiempoInicio).toISOString(),
      tiempoInicio: tiempoInicio
    };

    // Iniciar temporizador
    this.iniciarTemporizador();

    console.log('Sesión de estudio iniciada', {
      clase_id: claseId,
      leccion_id: leccionId,
      tipo_sesion: tipo
    });
    
    return true;
  }

  private iniciarTemporizador(): void {
    // Limpiar suscripción anterior
    if (this.intervaloSubscription) {
      this.intervaloSubscription.unsubscribe();
    }

    // Iniciar nuevo temporizador
    this.intervaloSubscription = interval(1000).subscribe(() => {
      if (this.sesionActiva) {
        const tiempoTranscurrido = Math.floor((Date.now() - this.sesionActiva.tiempoInicio) / 1000);
        this.temporizador$.next(tiempoTranscurrido);
      }
    });
  }

  detenerSesion(): void {
    if (!this.sesionActiva) {
      console.warn('No hay sesión activa para detener');
      return;
    }

    const tiempoFin = Date.now();
    const duracion = Math.floor((tiempoFin - this.sesionActiva.tiempoInicio) / 1000);

    // Validar duración mínima (10 segundos)
    if (duracion < 10) {
      console.warn('Sesión demasiado corta, no se guardará:', duracion + 's');
      this.limpiarSesion();
      return;
    }

    // Detener temporizador
    this.detenerTemporizador();

    // Validar que al menos un ID esté presente
    if (!this.sesionActiva.clase_id && !this.sesionActiva.leccion_id) {
      console.error('No se puede guardar sesión sin clase_id o leccion_id');
      this.limpiarSesion();
      return;
    }

    // Preparar datos de la sesión
    const sesionData: SesionEstudioCrear = {
      clase_id: this.sesionActiva.clase_id,
      leccion_id: this.sesionActiva.leccion_id,
      tipo_sesion: this.sesionActiva.tipo_sesion,
      fecha_inicio: this.sesionActiva.fecha_inicio,
      fecha_fin: new Date(tiempoFin).toISOString(),
      duracion_segundos: duracion,
      dispositivo: this.obtenerInfoDispositivo(),
      user_agent: navigator.userAgent
    };

    console.log('Sesión finalizada', sesionData);

    // Guardar en backend
    this.guardarSesionBackend(sesionData);
  }

  private detenerTemporizador(): void {
    if (this.intervaloSubscription) {
      this.intervaloSubscription.unsubscribe();
      this.intervaloSubscription = undefined;
    }
  }

  private guardarSesionBackend(sesionData: SesionEstudioCrear): void {
    this.progresoService.crearSesionEstudio(sesionData).subscribe({
      next: (response) => {
        console.log('Tiempo de estudio guardado correctamente:', response);
        this.limpiarSesion();
      },
      error: (err) => {
        console.error('Error guardando tiempo de estudio:', err);
        this.guardarSesionLocalStorage(sesionData);
      }
    });
  }

  private guardarSesionLocalStorage(sesionData: SesionEstudioCrear): void {
    try {
      const sesionesPendientes = this.obtenerSesionesPendientes();
      
      sesionesPendientes.push({
        ...sesionData,
        intento_fecha: new Date().toISOString(),
        intentos: 0
      });
      
      localStorage.setItem('sesiones_pendientes', JSON.stringify(sesionesPendientes));
      console.log('Sesión guardada en localStorage para reintento posterior');
      
      this.limpiarSesion();
    } catch (error) {
      console.error('Error guardando en localStorage:', error);
      this.limpiarSesion();
    }
  }

  private obtenerSesionesPendientes(): any[] {
    try {
      return JSON.parse(localStorage.getItem('sesiones_pendientes') || '[]');
    } catch (error) {
      console.error('Error obteniendo sesiones pendientes:', error);
      return [];
    }
  }

  private limpiarSesion(): void {
    this.sesionActiva = null;
    this.temporizador$.next(0);
  }

  // Métodos públicos
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

  private obtenerInfoDispositivo(): string {
    const ua = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|ipad/.test(ua)) {
      return 'mobile';
    } else if (/tablet|ipad/.test(ua)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  formatearTiempo(segundos: number): string {
    if (segundos < 60) {
      return `${segundos}s`;
    }

    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;

    if (minutos < 60) {
      return segundosRestantes > 0 ? `${minutos}m ${segundosRestantes}s` : `${minutos}m`;
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    if (minutosRestantes > 0) {
      return `${horas}h ${minutosRestantes}m`;
    }
    
    return `${horas}h`;
  }

  reintentarSesionesPendientes(): void {
    const sesionesPendientes = this.obtenerSesionesPendientes();
    
    if (sesionesPendientes.length === 0) return;

    console.log(`Reintentando ${sesionesPendientes.length} sesiones pendientes`);

    const sesionesExitosas: number[] = [];

    sesionesPendientes.forEach((sesion: any, index: number) => {
      // Limitar reintentos a 3
      if (sesion.intentos >= 3) {
        console.log(`Sesión ${index} excedió límite de reintentos, eliminando`);
        sesionesExitosas.push(index);
        return;
      }

      setTimeout(() => {
        this.progresoService.crearSesionEstudio(sesion).subscribe({
          next: () => {
            console.log(`Sesión pendiente ${index} guardada correctamente`);
            sesionesExitosas.push(index);
            this.actualizarSesionesPendientes(sesionesExitosas);
          },
          error: (err) => {
            console.error(`Error guardando sesión pendiente ${index}:`, err);
            // Incrementar contador de intentos
            sesion.intentos = (sesion.intentos || 0) + 1;
            this.actualizarSesionPendiente(index, sesion);
          }
        });
      }, index * 2000); // Espaciar reintentos
    });

    // Limpiar sesiones exitosas después de procesar todas
    setTimeout(() => {
      this.actualizarSesionesPendientes(sesionesExitosas);
    }, sesionesPendientes.length * 2000 + 1000);
  }

  private actualizarSesionPendiente(index: number, sesion: any): void {
    try {
      const sesionesPendientes = this.obtenerSesionesPendientes();
      if (sesionesPendientes[index]) {
        sesionesPendientes[index] = sesion;
        localStorage.setItem('sesiones_pendientes', JSON.stringify(sesionesPendientes));
      }
    } catch (error) {
      console.error('Error actualizando sesión pendiente:', error);
    }
  }

  private actualizarSesionesPendientes(indicesExitosos: number[]): void {
    if (indicesExitosos.length === 0) return;

    try {
      const sesionesPendientes = this.obtenerSesionesPendientes();
      const nuevasSesiones = sesionesPendientes.filter((_, index) => !indicesExitosos.includes(index));
      
      localStorage.setItem('sesiones_pendientes', JSON.stringify(nuevasSesiones));
      console.log(`Eliminadas ${indicesExitosos.length} sesiones pendientes exitosas`);
    } catch (error) {
      console.error('Error actualizando sesiones pendientes:', error);
    }
  }

  // Limpiar todas las sesiones pendientes (para debugging)
  limpiarSesionesPendientes(): void {
    localStorage.removeItem('sesiones_pendientes');
    console.log('Sesiones pendientes limpiadas');
  }

  // Obtener estadísticas de sesiones pendientes
  getEstadisticasSesionesPendientes(): { total: number; conReintentos: number } {
    const sesionesPendientes = this.obtenerSesionesPendientes();
    const conReintentos = sesionesPendientes.filter((s: any) => s.intentos > 0).length;
    
    return {
      total: sesionesPendientes.length,
      conReintentos: conReintentos
    };
  }
}
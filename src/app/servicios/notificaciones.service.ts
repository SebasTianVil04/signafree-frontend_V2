import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type TipoNotificacion = 'exito' | 'error' | 'advertencia' | 'info';

export interface Notificacion {
  tipo: TipoNotificacion;
  mensaje: string;
  duracion?: number;
  id?: string;
}

const PATRONES_TECNICOS: readonly RegExp[] = [
  /Http failure response/i,
  /https?:\/\/(localhost|127\.0\.0\.1)/i,
  /Network Error/i,
  /ERR_CONNECTION_REFUSED/i
];

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {
  private readonly notificacionSubject = new Subject<Notificacion>();
  readonly notificacion$ = this.notificacionSubject.asObservable();

  private contador = 0;

  mostrarExito(mensaje: string, duracion: number = 3000): void {
    this.emitir('exito', mensaje, duracion);
  }

  mostrarError(mensaje: string, duracion: number = 5000): void {
    this.emitir('error', mensaje, duracion);
  }

  mostrarAdvertencia(mensaje: string, duracion: number = 4000): void {
    this.emitir('advertencia', mensaje, duracion);
  }

  mostrarInfo(mensaje: string, duracion: number = 3000): void {
    this.emitir('info', mensaje, duracion);
  }

  private emitir(tipo: TipoNotificacion, mensaje: string, duracion: number): void {
    if (typeof mensaje !== 'string' || !mensaje.trim()) return;
    if (tipo === 'error' && this.esMensajeTecnico(mensaje)) return;

    this.notificacionSubject.next({
      tipo,
      mensaje,
      duracion,
      id: `notif_${Date.now()}_${++this.contador}`
    });
  }

  private esMensajeTecnico(mensaje: string): boolean {
    return PATRONES_TECNICOS.some(patron => patron.test(mensaje));
  }
}
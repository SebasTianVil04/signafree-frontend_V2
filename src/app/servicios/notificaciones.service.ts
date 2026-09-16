import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notificacion {
  tipo: 'exito' | 'error' | 'advertencia' | 'info';
  mensaje: string;
  duracion?: number;
  id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {
  private notificacionSubject = new Subject<Notificacion>();
  public notificacion$ = this.notificacionSubject.asObservable();

  constructor() {}

  mostrarExito(mensaje: string, duracion: number = 3000): void {
    if (!mensaje || typeof mensaje !== 'string') return;
    
    this.mostrarNotificacion({
      tipo: 'exito',
      mensaje,
      duracion
    });
  }

  mostrarError(mensaje: string, duracion: number = 5000): void {
    if (!mensaje || typeof mensaje !== 'string') return;
    
    if (this.esMensajeTecnico(mensaje)) return;

    this.mostrarNotificacion({
      tipo: 'error',
      mensaje,
      duracion
    });
  }

  mostrarAdvertencia(mensaje: string, duracion: number = 4000): void {
    if (!mensaje || typeof mensaje !== 'string') return;
    
    this.mostrarNotificacion({
      tipo: 'advertencia',
      mensaje,
      duracion
    });
  }

  mostrarInfo(mensaje: string, duracion: number = 3000): void {
    if (!mensaje || typeof mensaje !== 'string') return;
    
    this.mostrarNotificacion({
      tipo: 'info',
      mensaje,
      duracion
    });
  }

  private mostrarNotificacion(notificacion: Notificacion): void {
    notificacion.id = this.generarId();
    this.notificacionSubject.next(notificacion);
  }

  private generarId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private esMensajeTecnico(mensaje: string): boolean {
    const patronesTecnicos = [
      'Http failure response',
      'http://localhost',
      'https://localhost',
      'Network Error',
      'ERR_CONNECTION_REFUSED'
    ];

    return patronesTecnicos.some(patron => mensaje.includes(patron));
  }
}
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificacionesService, Notificacion } from '../../../servicios/notificaciones.service';

@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.component.html',
  styleUrls: ['./notificaciones.component.scss'],
  standalone: false 
})
export class NotificacionesComponent implements OnInit, OnDestroy {
  notificaciones: Notificacion[] = [];
  private subscription: Subscription | null = null;

  constructor(private notificacionesService: NotificacionesService) {}

  ngOnInit(): void {
    this.subscription = this.notificacionesService.notificacion$.subscribe(
      (notificacion) => {
        this.agregarNotificacion(notificacion);
      }
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  agregarNotificacion(notificacion: Notificacion): void {
    this.notificaciones.push(notificacion);

    if (notificacion.duracion && notificacion.duracion > 0) {
      setTimeout(() => {
        this.eliminarNotificacion(notificacion.id!);
      }, notificacion.duracion);
    }
  }

  eliminarNotificacion(id: string): void {
    this.notificaciones = this.notificaciones.filter(n => n.id !== id);
  }

  obtenerIcono(tipo: string): string {
    const iconos: { [key: string]: string } = {
      'exito': 'fa-check-circle',
      'error': 'fa-times-circle',
      'advertencia': 'fa-exclamation-triangle',
      'info': 'fa-info-circle'
    };
    return iconos[tipo] || 'fa-info-circle';
  }
}
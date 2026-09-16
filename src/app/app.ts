import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Notificacion, NotificacionesService } from './servicios/notificaciones.service';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.scss',        // ✅ correcto en Angular 19
  templateUrl: './app.html',     // ✅ correcto en Angular 19
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('signaFree-frontend-v2');
  notificacion: Notificacion | null = null;
  private notificacionSubscription?: Subscription;

  constructor(private notificacionesService: NotificacionesService) {}

  ngOnInit(): void {
    this.notificacionSubscription = this.notificacionesService.notificacion$.subscribe(
      notif => {
        this.notificacion = notif;
        if (notif.duracion) {
          setTimeout(() => {
            this.cerrarNotificacion();
          }, notif.duracion);
        }
      }
    );
  }
  
  ngOnDestroy(): void {
    this.notificacionSubscription?.unsubscribe();
  }

  cerrarNotificacion(): void {
    this.notificacion = null;
  }

  obtenerClaseNotificacion(): string {
    if (!this.notificacion) return '';
    const clases: Record<string, string> = {
      'exito': 'notificacion-exito',
      'error': 'notificacion-error',
      'advertencia': 'notificacion-advertencia',
      'info': 'notificacion-info'
    };
    return clases[this.notificacion.tipo] || '';
  }
}
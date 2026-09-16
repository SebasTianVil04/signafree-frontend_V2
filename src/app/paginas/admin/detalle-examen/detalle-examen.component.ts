// src/app/paginas/admin/detalle-examen/detalle-examen.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamenesAdminService, ExamenAdmin, EstadisticasExamen } from '../../../servicios/examenes-admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detalle-examen',
  templateUrl: './detalle-examen.component.html',
  styleUrls: ['./detalle-examen.component.scss'],
  standalone: false
})
export class DetalleExamenComponent implements OnInit {
  examen: ExamenAdmin | null = null;
  cargando: boolean = false;
  cargandoEstadisticas: boolean = false;
  estadisticas: EstadisticasExamen | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examenesAdminService: ExamenesAdminService
  ) {}

  ngOnInit(): void {
    this.cargarExamen();
  }

  cargarExamen(): void {
    this.cargando = true;
    const examenId = parseInt(this.route.snapshot.params['id']);

    if (isNaN(examenId)) {
      Swal.fire('Error', 'ID de examen inválido', 'error');
      this.router.navigate(['/admin/examenes']);
      return;
    }

    this.examenesAdminService.obtenerExamen(examenId).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.examen = response.datos;
          this.cargarEstadisticas(examenId);
        } else {
          Swal.fire('Error', response.mensaje || 'No se pudo cargar el examen', 'error');
          this.router.navigate(['/admin/examenes']);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar examen:', error);
        Swal.fire('Error', 'No se pudo cargar el examen', 'error');
        this.cargando = false;
        this.router.navigate(['/admin/examenes']);
      }
    });
  }

 cargarEstadisticas(examenId: number): void {
    this.cargandoEstadisticas = true;
    
    this.examenesAdminService.obtenerEstadisticasExamen(examenId).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.estadisticas = response.datos;
        } else {
          console.warn('No se pudieron cargar las estadísticas:', response.mensaje);
          // Mostrar estadísticas vacías en lugar de simuladas
          this.estadisticas = {
            total_intentos: 0,
            promedio_puntuacion: 0,
            tasa_aprobacion: 0,
            intentos_recientes: [],
            distribucion_puntuaciones: [],
            progreso_tiempo: []
          };
        }
        this.cargandoEstadisticas = false;
      },
      error: (error) => {
        console.error('Error al cargar estadísticas:', error);
        // En caso de error, mostrar estadísticas vacías
        this.estadisticas = {
          total_intentos: 0,
          promedio_puntuacion: 0,
          tasa_aprobacion: 0,
          intentos_recientes: [],
          distribucion_puntuaciones: [],
          progreso_tiempo: []
        };
        this.cargandoEstadisticas = false;
      }
    });
  }

  editarExamen(): void {
    if (this.examen) {
      this.router.navigate(['/admin/examenes', this.examen.id, 'editar']);
    }
  }

  gestionarPreguntas(): void {
    if (this.examen) {
      this.router.navigate(['/admin/examenes', this.examen.id, 'preguntas']);
    }
  }

  volverALista(): void {
    this.router.navigate(['/admin/examenes']);
  }

  toggleActivo(): void {
    if (!this.examen) return;

    const nuevoEstado = !this.examen.activo;
    
    this.examenesAdminService.actualizarExamen(this.examen.id!, {
      activo: nuevoEstado
    }).subscribe({
      next: (response) => {
        if (response.exito) {
          this.examen!.activo = nuevoEstado;
          Swal.fire({
            icon: 'success',
            title: nuevoEstado ? 'Examen Activado' : 'Examen Desactivado',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          Swal.fire('Error', response.mensaje || 'Error al cambiar estado', 'error');
        }
      },
      error: (error) => {
        console.error('Error al cambiar estado:', error);
        Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
      }
    });
  }

  getTipoLabel(tipo: string): string {
    return tipo === 'nivel' ? 'Examen de Nivel' : 'Examen Final';
  }

  getEstadoLabel(activo: boolean): string {
    return activo ? 'Activo' : 'Inactivo';
  }

  getEstadoClass(activo: boolean): string {
    return activo ? 'estado-activo' : 'estado-inactivo';
  }
}
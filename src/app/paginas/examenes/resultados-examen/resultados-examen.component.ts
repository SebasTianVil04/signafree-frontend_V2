// src/app/paginas/examenes/resultados-examen/resultados-examen.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamenService } from '../../../servicios/examen.service';
import { ResultadoExamen } from '../../../modelos/examen.model';

// Interface que coincide con la respuesta del backend - hacer id opcional
interface ResultadoExamenDetalle {
  id?: number;  // Hacer opcional para coincidir con ResultadoExamen
  puntuacion_obtenida: number;
  puntuacion_maxima: number;
  porcentaje: number;
  aprobado: boolean;
  tiempo_empleado: number;
  fecha_finalizacion: string;
  respuestas_correctas: number;
  total_preguntas: number;
}

@Component({
  selector: 'app-resultados-examen',
  templateUrl: './resultados-examen.component.html',
  styleUrls: ['./resultados-examen.component.scss'],
  standalone: false 
})
export class ResultadosExamenComponent implements OnInit {
  examen: any = null;
  resultados: ResultadoExamenDetalle[] = [];
  resultadoActual: any = null;
  cargando = true;
  examenId: number;

  // Estadísticas
  mejorResultado: ResultadoExamenDetalle | null = null;
  promedioPorcentaje = 0;
  totalIntentos = 0;
  aprobados = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examenService: ExamenService
  ) {
    this.examenId = parseInt(this.route.snapshot.params['id']);
  }

  async ngOnInit() {
    // Verificar si hay resultado reciente en el state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['resultado']) {
      this.resultadoActual = navigation.extras.state['resultado'];
    }

    await this.cargarExamen();
    await this.cargarResultados();
    this.calcularEstadisticas();
  }

  async cargarExamen() {
    try {
      const response = await this.examenService.obtenerExamen(this.examenId).toPromise();
      this.examen = response.datos;
    } catch (error) {
      console.error('Error cargando examen:', error);
    }
  }

  async cargarResultados() {
    try {
      const response = await this.examenService.obtenerResultadosExamen(this.examenId).toPromise();
      // Mapear los resultados para asegurar la compatibilidad
      this.resultados = response.datos.map((resultado: any) => ({
        id: resultado.id,
        puntuacion_obtenida: resultado.puntuacion_obtenida,
        puntuacion_maxima: resultado.puntuacion_maxima,
        porcentaje: resultado.porcentaje,
        aprobado: resultado.aprobado,
        tiempo_empleado: resultado.tiempo_empleado,
        fecha_finalizacion: resultado.fecha_finalizacion,
        respuestas_correctas: resultado.respuestas_correctas,
        total_preguntas: resultado.total_preguntas
      }));
    } catch (error) {
      console.error('Error cargando resultados:', error);
    } finally {
      this.cargando = false;
    }
  }

  calcularEstadisticas() {
    if (this.resultados.length === 0) return;

    this.totalIntentos = this.resultados.length;
    this.aprobados = this.resultados.filter(r => r.aprobado).length;
    this.promedioPorcentaje = this.resultados.reduce((sum, r) => sum + r.porcentaje, 0) / this.totalIntentos;
    this.mejorResultado = this.resultados.reduce((best, current) => 
      current.porcentaje > best.porcentaje ? current : best
    );
  }

  tomarExamenNuevamente() {
    this.router.navigate(['/examenes', this.examenId, 'tomar']);
  }

  volverALista() {
    this.router.navigate(['/examenes']);
  }

  formatTiempo(segundos: number): string {
    if (!segundos) return '--:--';
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  }

  getNivelTexto(): string {
    return this.examen?.tipo === 'final' ? 'Final' : `Nivel ${this.examen?.nivel}`;
  }
}
// src/app/paginas/examenes/resultados-examen/resultados-examen.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamenService } from '../../../servicios/examen.service';
import { ResultadoExamen } from '../../../modelos/examen.model';

interface ResultadoExamenDetalle {
  id?: number;
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
  error: string | null = null;
  examenId: number;

  mejorResultado: ResultadoExamenDetalle | null = null;
  promedioPorcentaje = 0;
  totalIntentos = 0;
  aprobados = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examenService: ExamenService
  ) {
    const idParam = this.route.snapshot.params['id'];
    const idParseado = parseInt(idParam, 10);
    this.examenId = isNaN(idParseado) ? 0 : idParseado;
  }

  async ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['resultado']) {
      this.resultadoActual = navigation.extras.state['resultado'];
    }

    if (!this.examenId) {
      this.error = 'ID de examen inválido';
      this.cargando = false;
      return;
    }

    this.cargando = true;
    this.error = null;

    const [examenOk, resultadosOk] = await Promise.all([
      this.cargarExamen(),
      this.cargarResultados()
    ]);

    this.cargando = false;

    if (!examenOk && !resultadosOk) {
      this.error = 'No se pudo cargar la información del examen. Intenta nuevamente.';
      return;
    }

    this.calcularEstadisticas();
  }

  async cargarExamen(): Promise<boolean> {
    try {
      const response = await this.examenService.obtenerExamen(this.examenId).toPromise();
      this.examen = response?.datos || null;
      return true;
    } catch (error) {
      console.error('Error cargando examen:', error);
      this.examen = null;
      return false;
    }
  }

  async cargarResultados(): Promise<boolean> {
    try {
      const response = await this.examenService.obtenerResultadosExamen(this.examenId).toPromise();
      const datos = Array.isArray(response?.datos) ? response.datos : [];

      this.resultados = datos.map((resultado: any) => ({
        id: resultado.id,
        puntuacion_obtenida: Number(resultado.puntuacion_obtenida) || 0,
        puntuacion_maxima: Number(resultado.puntuacion_maxima) || 0,
        porcentaje: Number(resultado.porcentaje) || 0,
        aprobado: !!resultado.aprobado,
        tiempo_empleado: Number(resultado.tiempo_empleado) || 0,
        fecha_finalizacion: resultado.fecha_finalizacion,
        respuestas_correctas: Number(resultado.respuestas_correctas) || 0,
        total_preguntas: Number(resultado.total_preguntas) || 0
      }));
      return true;
    } catch (error) {
      console.error('Error cargando resultados:', error);
      this.resultados = [];
      return false;
    }
  }

  calcularEstadisticas() {
    if (!this.resultados || this.resultados.length === 0) {
      this.mejorResultado = null;
      this.promedioPorcentaje = 0;
      this.totalIntentos = 0;
      this.aprobados = 0;
      return;
    }

    this.totalIntentos = this.resultados.length;
    this.aprobados = this.resultados.filter(r => r.aprobado).length;
    this.promedioPorcentaje = this.resultados.reduce((sum, r) => sum + r.porcentaje, 0) / this.totalIntentos;
    this.mejorResultado = this.resultados.reduce((best, current) =>
      current.porcentaje > best.porcentaje ? current : best
    );
  }

  reintentarCarga(): void {
    this.ngOnInit();
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
import { Component, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ExamenService } from '../../../servicios/examen.service';
import { ProgresoService } from '../../../servicios/progreso.service';
import Swal from 'sweetalert2';
import { LeccionesService } from '../../../servicios/lecciones.service';
import { Examen } from '../../../modelos/examen.model';

const QK_EXAMENES = ['listaExamenes'] as const;
const QK_RESUMEN_PROGRESO = ['resumenProgresoExamenes'] as const;

const STALE_EXAMENES = 30 * 1000;
const STALE_RESUMEN_PROGRESO = 20 * 1000;

@Component({
  selector: 'app-lista-examenes',
  templateUrl: './lista-examenes.component.html',
  styleUrls: ['./lista-examenes.component.scss'],
  standalone: false
})
export class ListaExamenesComponent implements OnInit {
  examenes: Examen[] = [];
  examenesFiltrados: Examen[] = [];
  clasesCompletadasCount: number = 0;
  leccionesProgreso: any = {};

  filtros = {
    tipo: '',
    nivel: null as number | null,
    estado: ''
  };

  private queryClient = injectQueryClient();

  private examenesQuery = injectQuery(() => ({
    queryKey: QK_EXAMENES,
    queryFn: () => firstValueFrom(this.examenService.listarExamenes()),
    staleTime: STALE_EXAMENES
  }));

  private resumenProgresoQuery = injectQuery(() => ({
    queryKey: QK_RESUMEN_PROGRESO,
    queryFn: () => firstValueFrom(this.progresoService.obtenerResumenUsuario()),
    staleTime: STALE_RESUMEN_PROGRESO
  }));

  constructor(
    private examenService: ExamenService,
    private progresoService: ProgresoService,
    private leccionesService: LeccionesService,
    private router: Router
  ) {
    effect(() => {
      const respuestaExamenes = this.examenesQuery.data();
      const resumen = this.resumenProgresoQuery.data();

      if (!respuestaExamenes?.exito || !respuestaExamenes.datos) {
        return;
      }

      this.examenes = respuestaExamenes.datos;

      if (resumen) {
        this.procesarProgresoLecciones(resumen);
      }

      this.actualizarDisponibilidadExamenes();
      this.aplicarFiltros();
    });

    effect(() => {
      if (this.examenesQuery.isError()) {
        console.error('Error al cargar exámenes:', this.examenesQuery.error());
        Swal.fire('Error', 'No se pudieron cargar los exámenes', 'error');
      }
    });

    effect(() => {
      if (this.resumenProgresoQuery.isError()) {
        console.error('Error al cargar progreso:', this.resumenProgresoQuery.error());
      }
    });
  }

  get cargando(): boolean {
    return this.examenesQuery.isPending() || this.resumenProgresoQuery.isPending();
  }

  ngOnInit(): void {
  }

  cargarExamenes(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_EXAMENES });
    this.queryClient.invalidateQueries({ queryKey: QK_RESUMEN_PROGRESO });
  }

  procesarProgresoLecciones(resumen: any): void {
    if (resumen.progresos && Array.isArray(resumen.progresos)) {
      resumen.progresos.forEach((progreso: any) => {
        this.leccionesProgreso[progreso.leccion_id] = {
          clases_completadas: progreso.clases_completadas || 0,
          total_clases: progreso.total_clases || 0
        };
      });

      this.clasesCompletadasCount = resumen.progresos.reduce((total: number, progreso: any) => {
        return total + (progreso.clases_completadas || 0);
      }, 0);
    }
  }

  verificarDisponibilidadExamen(examen: Examen): boolean {
    if (!examen.activo) {
      return false;
    }

    if (examen.completado || examen.ultimo_resultado?.realizado) {
      return true;
    }

    const progresoLeccion = this.leccionesProgreso[examen.leccion_id];

    if (!progresoLeccion) {
      return false;
    }

    const clasesCompletadas = progresoLeccion.clases_completadas || 0;
    const totalClases = progresoLeccion.total_clases || 0;

    if (examen.requiere_todas_clases === true) {
      return clasesCompletadas >= totalClases;
    }

    if (examen.clases_requeridas && examen.clases_requeridas > 0) {
      return clasesCompletadas >= examen.clases_requeridas;
    }

    return clasesCompletadas >= 2;
  }

  actualizarDisponibilidadExamenes(): void {
    this.examenes = this.examenes.map(examen => {
      const disponible = this.verificarDisponibilidadExamen(examen);
      return { ...examen, disponible };
    });
  }

  aplicarFiltros(): void {
    this.examenesFiltrados = this.examenes.filter(examen => {
      if (this.filtros.tipo && examen.tipo !== this.filtros.tipo) {
        return false;
      }

      if (this.filtros.nivel !== null && examen.nivel !== this.filtros.nivel) {
        return false;
      }

      if (this.filtros.estado) {
        if (this.filtros.estado === 'pendiente' && examen.ultimo_resultado?.realizado) {
          return false;
        }
        if (this.filtros.estado === 'aprobado' &&
            (!examen.ultimo_resultado?.realizado || !examen.ultimo_resultado?.aprobado)) {
          return false;
        }
        if (this.filtros.estado === 'reprobado' &&
            (!examen.ultimo_resultado?.realizado || examen.ultimo_resultado?.aprobado)) {
          return false;
        }
      }

      return true;
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      tipo: '',
      nivel: null,
      estado: ''
    };
    this.aplicarFiltros();
  }

  contarAprobados(): number {
    return this.examenes.filter(e =>
      e.ultimo_resultado?.realizado && e.ultimo_resultado?.aprobado
    ).length;
  }

  contarPendientes(): number {
    return this.examenes.filter(e =>
      !e.ultimo_resultado?.realizado
    ).length;
  }

  calcularPromedio(): number {
    const realizados = this.examenes.filter(e =>
      e.ultimo_resultado?.realizado && e.ultimo_resultado?.porcentaje !== null
    );

    if (realizados.length === 0) return 0;

    const suma = realizados.reduce((total, e) =>
      total + (e.ultimo_resultado?.porcentaje || 0), 0
    );

    return Math.round(suma / realizados.length);
  }

  estaExamenDisponible(examen: Examen): boolean {
    return this.verificarDisponibilidadExamen(examen);
  }

  obtenerMensajeRequisitos(examen: Examen): string {
    if (examen.ultimo_resultado?.realizado) {
      return examen.ultimo_resultado.aprobado ? 'Aprobado' : 'Reprobado';
    }

    if (!examen.activo) {
      return 'No disponible';
    }

    const progresoLeccion = this.leccionesProgreso[examen.leccion_id];

    if (!progresoLeccion) {
      return 'Completa clases para desbloquear';
    }

    const clasesCompletadas = progresoLeccion.clases_completadas || 0;
    const totalClases = progresoLeccion.total_clases || 0;

    const disponible = this.verificarDisponibilidadExamen(examen);

    if (disponible) {
      return 'Disponible';
    }

    if (examen.requiere_todas_clases === true) {
      const clasesFaltantes = totalClases - clasesCompletadas;
      if (clasesFaltantes > 0) {
        return `Faltan ${clasesFaltantes} clase${clasesFaltantes > 1 ? 's' : ''} (requiere todas)`;
      }
      return 'Disponible';
    }

    if (examen.clases_requeridas && examen.clases_requeridas > 0) {
      const clasesFaltantes = examen.clases_requeridas - clasesCompletadas;
      if (clasesFaltantes > 0) {
        return `Faltan ${clasesFaltantes} clase${clasesFaltantes > 1 ? 's' : ''}`;
      }
      return 'Disponible';
    }

    const clasesFaltantes = 2 - clasesCompletadas;
    if (clasesFaltantes > 0) {
      return `Faltan ${clasesFaltantes} clase${clasesFaltantes > 1 ? 's' : ''}`;
    }

    return 'Disponible';
  }

  iniciarExamen(examen: Examen): void {
    if (!this.estaExamenDisponible(examen)) {
      this.mostrarMensajeRequisitosNoCumplidos(examen);
      return;
    }

    Swal.fire({
      title: '¿Comenzar Examen?',
      html: `
        <div style="text-align: left; margin: 20px 0;">
          <p><strong>${examen.titulo}</strong></p>
          <ul style="padding-left: 20px;">
            <li>${examen.total_preguntas} preguntas</li>
            <li>${examen.tiempo_limite ? examen.tiempo_limite + ' minutos' : 'Sin límite de tiempo'}</li>
            <li>Puntuación mínima: ${examen.puntuacion_minima}%</li>
          </ul>
          <p style="margin-top: 15px; color: #666;">
            <i class="fas fa-info-circle"></i>
            Asegúrate de tener buena iluminación y una cámara funcional
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-play"></i> Comenzar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6366f1'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/examenes', examen.id, 'tomar']);
      }
    });
  }

  mostrarMensajeRequisitosNoCumplidos(examen: Examen): void {
    const progresoLeccion = this.leccionesProgreso[examen.leccion_id];

    let mensaje = `
      <div style="text-align: left;">
        <p><strong>${examen.titulo}</strong></p>
        <p style="color: #f44336; margin: 15px 0;">
          <i class="fas fa-lock"></i> Este examen no está disponible aún.
        </p>
    `;

    if (!examen.activo) {
      mensaje += '<p>El examen no está activo.</p>';
    } else if (!progresoLeccion) {
      mensaje += '<p>No hay progreso registrado para esta lección. Comienza a completar las clases.</p>';
    } else {
      const clasesCompletadas = progresoLeccion.clases_completadas || 0;
      const totalClases = progresoLeccion.total_clases || 0;

      let clasesRequeridas: number;
      let textoRequisito: string;

      if (examen.requiere_todas_clases === true) {
        clasesRequeridas = totalClases;
        textoRequisito = 'Completar TODAS las clases de la lección';
      } else if (examen.clases_requeridas && examen.clases_requeridas > 0) {
        clasesRequeridas = examen.clases_requeridas;
        textoRequisito = `Completar ${clasesRequeridas} clase${clasesRequeridas > 1 ? 's' : ''} mínimo`;
      } else {
        clasesRequeridas = 2;
        textoRequisito = 'Completar 2 clases mínimo';
      }

      const clasesFaltantes = Math.max(0, clasesRequeridas - clasesCompletadas);

      mensaje += `
        <p><strong>Requisito:</strong> ${textoRequisito}</p>
        <p><strong>Tu progreso:</strong> ${clasesCompletadas}/${clasesRequeridas} clases completadas</p>
      `;

      if (clasesFaltantes > 0) {
        mensaje += `
          <p style="color: #ff9800; font-weight: bold;">
            <i class="fas fa-exclamation-triangle"></i>
            Faltan ${clasesFaltantes} clase${clasesFaltantes > 1 ? 's' : ''} por completar
          </p>
        `;
      }
    }

    mensaje += `</div>`;

    Swal.fire({
      title: 'Examen Bloqueado',
      html: mensaje,
      icon: 'warning',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#ff9800'
    });
  }

  verResultados(examen: Examen): void {
    this.router.navigate(['/examenes', examen.id, 'resultados']);
  }

  reintentar(examen: Examen): void {
    Swal.fire({
      title: '¿Reintentar Examen?',
      text: 'Tendrás una nueva oportunidad para aprobarlo',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reintentar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ff9800'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/examenes', examen.id, 'tomar']);
      }
    });
  }
}
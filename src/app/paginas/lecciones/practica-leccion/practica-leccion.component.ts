import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { QueryClient } from '@tanstack/angular-query-experimental';

import { LeccionesService } from '../../../servicios/lecciones.service';
import { PracticaService } from '../../../servicios/practica.service';
import { ProgresoService } from '../../../servicios/progreso.service';
import { convertirLeccionServicio, Leccion } from '../../../modelos/leccion.model';

@Component({
  selector: 'app-practica-leccion',
  templateUrl: './practica-leccion.component.html',
  styleUrls: ['./practica-leccion.component.scss'],
  standalone: false
})
export class PracticaLeccionComponent implements OnInit, OnDestroy {
  leccion: Leccion | null = null;
  clases: any[] = [];
  claseActual: any = null;
  indiceActual = 0;

  puntuacion = 0;
  tiempoInicio: number = 0;
  tiempoTranscurrido = 0;
  intervaloTiempo: any;

  videoUrl: SafeResourceUrl | null = null;
  practicaEnCurso: boolean = false;
  mostrarRespuesta = false;
  respuestaCorrecta = false;

  cargando = true;
  error: string | null = null;
  practicaCompletada = false;

  ultimaPrecision: number = 0;
  ultimaSenaDetectada: string = '';
  mensajeFeedback: string = '';
  respuestasCorrectas = 0;
  respuestasIncorrectas = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private leccionesService: LeccionesService,
    private practicaService: PracticaService,
    private progresoService: ProgresoService,
    private queryClient: QueryClient
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) {
        this.cargarLeccion(id);
      } else {
        this.error = 'ID de lección inválido';
        this.cargando = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.intervaloTiempo) {
      clearInterval(this.intervaloTiempo);
    }
  }

  cargarLeccion(id: number): void {
    this.cargando = true;
    this.error = null;

    this.queryClient.fetchQuery({
      queryKey: ['leccion', id],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerLeccion(id)),
      staleTime: Infinity
    }).then(response => {
      if (response.exito && response.datos) {
        this.leccion = convertirLeccionServicio(response.datos);
        this.cargarClases(id);
      } else {
        this.error = response.mensaje || 'Error al cargar la lección';
        this.cargando = false;
      }
    }).catch(err => {
      this.error = err.error?.detail || 'Error al cargar la lección';
      this.cargando = false;
    });
  }

  cargarClases(leccionId: number): void {
    this.queryClient.fetchQuery({
      queryKey: ['clases-leccion', leccionId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerClasesDeLeccion(leccionId)),
      staleTime: Infinity
    }).then(response => {
      if (response.exito && response.datos) {
        this.clases = response.datos
          .filter((clase: any) => clase.activa)
          .sort((a: any, b: any) => a.orden - b.orden);

        if (this.clases.length > 0) {
          this.claseActual = this.clases[0];
          this.generarUrlVideo();
          this.iniciarTemporizador();
        } else {
          this.error = 'Esta lección no tiene clases para practicar.';
        }
      }
      this.cargando = false;
    }).catch(err => {
      this.error = err.error?.detail || 'Error al cargar las clases';
      this.cargando = false;
    });
  }

  generarUrlVideo(): void {
    if (!this.claseActual) return;

    let url = '';
    if (this.claseActual.tipo_video === 'youtube' && this.claseActual.video_id) {
      url = `https://www.youtube.com/embed/${this.claseActual.video_id}`;
    } else if (this.claseActual.tipo_video === 'google_drive' && this.claseActual.video_id) {
      url = `https://drive.google.com/file/d/${this.claseActual.video_id}/preview`;
    } else if (this.claseActual.tipo_video === 'vimeo' && this.claseActual.video_id) {
      url = `https://player.vimeo.com/video/${this.claseActual.video_id}`;
    }

    if (url) {
      this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } else {
      this.videoUrl = null;
    }
  }

  iniciarTemporizador(): void {
    this.tiempoInicio = Date.now();
    this.intervaloTiempo = setInterval(() => {
      this.tiempoTranscurrido = Math.floor((Date.now() - this.tiempoInicio) / 1000);
    }, 1000);
  }

  iniciarPractica(): void {
    this.practicaEnCurso = true;
    this.mostrarRespuesta = false;
  }

  private normalizarSena(valor: any): string {
    if (valor === null || valor === undefined) return '';
    return String(valor)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  procesarResultado(resultado: any): void {
    this.practicaEnCurso = false;
    this.mostrarRespuesta = true;

    const senaDetectadaRaw = (resultado?.sena_reconocida ?? '').toString().trim();
    const senaEsperadaRaw  = (this.senaEsperada ?? '').toString().trim();

    const senaDetectadaNorm = this.normalizarSena(senaDetectadaRaw);
    const senaEsperadaNorm  = this.normalizarSena(senaEsperadaRaw);

    let precision = Number(resultado?.precision);
    if (isNaN(precision)) precision = 0;
    if (precision > 1) precision = precision / 100;

    const precisionMinima = Number(this.claseActual?.precision_minima ?? 0.8) || 0.8;

    const senaCoincide = senaDetectadaNorm !== '' && senaDetectadaNorm === senaEsperadaNorm;
    const precisionSuficiente = precision >= precisionMinima;

    this.ultimaPrecision = precision;
    this.ultimaSenaDetectada = senaDetectadaRaw;
    this.respuestaCorrecta = senaCoincide && precisionSuficiente;

    if (!senaCoincide) {
      this.mensajeFeedback =
        `La seña detectada "${senaDetectadaRaw || '—'}" no coincide con la esperada ` +
        `"${senaEsperadaRaw}". Intenta realizar la seña correcta.`;
    } else if (!precisionSuficiente) {
      this.mensajeFeedback =
        `Seña correcta, pero la precisión fue insuficiente: ` +
        `${(precision * 100).toFixed(1)}%. ` +
        `Se requiere al menos ${(precisionMinima * 100).toFixed(0)}%.`;
    } else {
      this.mensajeFeedback =
        resultado?.mensaje || '¡Bien hecho! Seña y precisión correctas.';
    }

    if (!this.respuestaCorrecta) {
      this.ultimaPrecision = 0;
    }

    this.registrarPracticaConGamificacion();
  }

  registrarPracticaConGamificacion(): void {
    if (!this.leccion || !this.claseActual) return;

    const practicaData = {
      precision: this.respuestaCorrecta ? this.ultimaPrecision : 0,
      tiempo_practica: this.tiempoTranscurrido,
      sena_reconocida: this.ultimaSenaDetectada,
      es_exitoso: this.respuestaCorrecta
    };

    if (this.progresoService.guardarResultadoPracticaCompleto) {
      this.progresoService.guardarResultadoPracticaCompleto(
        this.claseActual.id,
        practicaData
      ).subscribe({
        next: (respuesta: any) => {
          if (this.respuestaCorrecta) {
            this.respuestasCorrectas++;

            const puntosGanados = respuesta?.puntos_ganados ||
              Math.round((this.leccion?.puntos_base || 10) * this.ultimaPrecision);

            this.puntuacion += Math.round(puntosGanados);

            if (respuesta?.puntos_ganados > 0) {
              this.mostrarAnimacionPuntos(respuesta.puntos_ganados);
            }
            if (respuesta?.xp_ganado > 0) {
              this.mostrarAnimacionXP(respuesta.xp_ganado);
            }
          } else {
            this.respuestasIncorrectas++;
          }
        },
        error: (err) => {
          this.registrarPracticaBasica();
        }
      });
    } else {
      this.registrarPracticaBasica();
    }
  }

  private registrarPracticaBasica(): void {
    if (!this.leccion || !this.claseActual) return;

    const practica = {
      leccion_id: this.leccion.id,
      sena_detectada: this.ultimaSenaDetectada,
      confianza: this.ultimaPrecision,
      tiempo_empleado: this.tiempoTranscurrido
    };

    this.practicaService.registrarPractica(practica).subscribe({
      next: (resultado) => {
        if (this.respuestaCorrecta) {
          this.respuestasCorrectas++;
          const puntosBase = this.leccion?.puntos_base || 10;
          const puntosGanados = Math.round(puntosBase * this.ultimaPrecision);
          this.puntuacion += puntosGanados;

          this.mostrarAnimacionPuntos(puntosGanados);
        } else {
          this.respuestasIncorrectas++;
        }
      },
      error: (err) => { }
    });
  }

  private mostrarAnimacionPuntos(puntos: number): void { }

  private mostrarAnimacionXP(xp: number): void { }

  registrarPractica(): void {
    if (!this.leccion || !this.claseActual) return;

    const practica = {
      leccion_id: this.leccion.id,
      sena_detectada: this.ultimaSenaDetectada,
      confianza: this.ultimaPrecision,
      tiempo_empleado: this.tiempoTranscurrido
    };

    this.practicaService.registrarPractica(practica).subscribe({
      next: (resultado) => { },
      error: (err) => { }
    });
  }

  reintentar(): void {
    this.practicaEnCurso = false;
    this.mostrarRespuesta = false;
    this.ultimaPrecision = 0;
    this.ultimaSenaDetectada = '';
    this.respuestaCorrecta = false;
    this.mensajeFeedback = '';
  }

  siguienteSena(): void {
    if (!this.respuestaCorrecta) {
      this.mensajeFeedback =
        'Debes realizar la seña correcta con la precisión mínima para continuar.';
      return;
    }

    this.practicaEnCurso = false;
    this.mostrarRespuesta = false;
    this.ultimaPrecision = 0;
    this.ultimaSenaDetectada = '';
    this.respuestaCorrecta = false;
    this.mensajeFeedback = '';

    this.indiceActual++;

    if (this.indiceActual < this.clases.length) {
      this.claseActual = this.clases[this.indiceActual];
      this.generarUrlVideo();
    } else {
      this.completarPractica();
    }
  }

  completarPractica(): void {
    if (this.intervaloTiempo) {
      clearInterval(this.intervaloTiempo);
    }
    this.practicaCompletada = true;
  }

  reiniciarPractica(): void {
    this.indiceActual = 0;
    this.puntuacion = 0;
    this.respuestasCorrectas = 0;
    this.respuestasIncorrectas = 0;
    this.claseActual = this.clases[0];
    this.generarUrlVideo();
    this.practicaEnCurso = false;
    this.mostrarRespuesta = false;
    this.practicaCompletada = false;
    this.respuestaCorrecta = false;
    this.ultimaPrecision = 0;
    this.ultimaSenaDetectada = '';
    this.mensajeFeedback = '';
    this.iniciarTemporizador();
  }

  salir(): void {
    if (this.intervaloTiempo) {
      clearInterval(this.intervaloTiempo);
    }

    if (this.leccion?.id) {
      this.router.navigate(['/lecciones', this.leccion.id]);
    } else {
      this.router.navigate(['/lecciones']);
    }
  }

  obtenerProgreso(): number {
    return this.clases.length > 0 ? ((this.indiceActual + 1) / this.clases.length) * 100 : 0;
  }

  formatearTiempo(segundos: number): string {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  obtenerDificultad(): string {
    if (!this.leccion) return 'media';
    const niveles: Record<number, string> = {
      1: 'facil',
      2: 'media',
      3: 'dificil'
    };
    return niveles[this.leccion.nivel_dificultad] || 'media';
  }

  obtenerEtiquetaDificultad(): string {
    if (!this.leccion) return 'Medio';
    const etiquetas: Record<number, string> = {
      1: 'Fácil',
      2: 'Medio',
      3: 'Difícil'
    };
    return etiquetas[this.leccion.nivel_dificultad] || 'Medio';
  }

  obtenerPrecision(): number {
    const total = this.respuestasCorrectas + this.respuestasIncorrectas;
    return total > 0 ? (this.respuestasCorrectas / total) * 100 : 0;
  }

  get senaEsperada(): string {
    if (this.claseActual) {
      const senaClase = this.claseActual.sena || this.claseActual.palabra || this.claseActual.titulo;
      if (senaClase && String(senaClase).trim()) {
        return String(senaClase).trim();
      }
    }
    return this.leccion?.sena || '';
  }

  get colorPrecision(): string {
    if (this.ultimaPrecision >= 0.8) return '#4caf50';
    if (this.ultimaPrecision >= 0.6) return '#ff9800';
    return '#f44336';
  }
}
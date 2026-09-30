import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, firstValueFrom } from 'rxjs';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { ProgresoService, ProgresoClase, ResultadoPracticaRequest, ResultadoPracticaResponse } from '../../../servicios/progreso.service';
import { Leccion } from '../../../modelos/leccion.model';
import { Clase, Examen, LeccionesService } from '../../../servicios/lecciones.service';
import { ClasesService } from '../../../servicios/clase.service';
import { SeguimientoTiempoService } from '../../../servicios/seguimiento-tiempo.service';

@Component({
  selector: 'app-clase-vista',
  templateUrl: './clase-vista.component.html',
  styleUrls: ['./clase-vista.component.scss'],
  standalone: false
})
export class ClaseVistaComponent implements OnInit, OnDestroy {
  claseActual: Clase | null = null;
  leccionActual: Leccion | null = null;
  progresoClase: ProgresoClase | null = null;
  clasesDeLeccion: Clase[] = [];
  examenesDeLeccion: Examen[] = [];

  leccionId: number = 0;
  claseId: number = 0;

  modoActual: 'aprender' | 'practicar' = 'aprender';
  videoUrl: SafeResourceUrl | null = null;
  videoLocalUrl: string | null = null;
  videoTipo: 'local' | 'externo' | null = null;
  cargandoVideo: boolean = false;

  cargando: boolean = true;
  cambiandoClase: boolean = false;
  error: string = '';
  cargandoExamenes: boolean = false;

  practicaEnCurso: boolean = false;
  resultadoPractica: any = null;
  tiempoInicioPractica: number = 0;

  menuAbierto: boolean = true;

  estadoClases: { [claseId: number]: boolean } = {};
  clasesCompletadas: number = 0;

  private procesandoResultado: boolean = false;
  private reintentoVideo: boolean = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private sanitizer: DomSanitizer,
    private leccionesService: LeccionesService,
    private clasesService: ClasesService,
    private progresoService: ProgresoService,
    private cdr: ChangeDetectorRef,
    private seguimientoTiempo: SeguimientoTiempoService,
    private queryClient: QueryClient
  ) { }

  ngOnInit(): void {
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        this.leccionId = +params['leccionId'];
        this.claseId = +params['claseId'];

        if (this.leccionId && this.claseId) {
          this.resetearEstadoPractica();
          this.iniciarSesionEstudio();
          this.cargarDatosCompletos();
        } else {
          this.error = 'Parámetros de navegación inválidos';
          this.cargando = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.seguimientoTiempo.detenerSesion();
  }

  private resetearEstadoPractica(): void {
    this.practicaEnCurso = false;
    this.resultadoPractica = null;
    this.tiempoInicioPractica = 0;
    this.modoActual = 'aprender';
    this.procesandoResultado = false;
    this.reintentoVideo = false;
  }

  private iniciarSesionEstudio(): void {
    const exito = this.seguimientoTiempo.iniciarSesion(this.claseId, this.leccionId, 'clase');
    if (exito) {
      this.subscriptions.push(
        this.seguimientoTiempo.getTiempoTranscurrido().subscribe(tiempo => {
        })
      );
    }
  }

  async cargarDatosCompletos(): Promise<void> {
    const claseId = this.claseId;
    const primeraCarga = !this.claseActual;

    this.error = '';
    if (primeraCarga) {
      this.cargando = true;
    } else {
      this.cambiandoClase = true;
    }

    const criticos = Promise.all([
      this.cargarLeccion(),
      this.cargarClase(),
      this.cargarClasesDeLeccion()
    ]);

    const secundarios = Promise.all([
      this.cargarProgresoClasesLeccion(),
      this.cargarExamenesDeLeccion()
    ]);

    Promise.allSettled([criticos, secundarios]).then(() => {
      if (claseId !== this.claseId) return;
      this.actualizarClasesCompletadas();
      this.cdr.detectChanges();
    });

    try {
      await criticos;
      if (claseId !== this.claseId) return;
      this.actualizarClasesCompletadas();
      this.precargarSiguienteClase();
    } catch (error) {
      if (claseId === this.claseId) {
        this.error = this.error || 'Error al cargar los datos de la clase';
      }
    } finally {
      if (claseId === this.claseId) {
        this.cargando = false;
        this.cambiandoClase = false;
        this.cdr.detectChanges();
      }
    }
  }

  private precargarSiguienteClase(): void {
    const indice = this.clasesDeLeccion.findIndex(c => c.id === this.claseId);
    if (indice < 0) return;

    const siguiente = this.clasesDeLeccion[indice + 1];
    if (!siguiente?.id) return;

    const siguienteId = siguiente.id;
    this.queryClient.prefetchQuery({
      queryKey: ['clase', siguienteId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerClase(siguienteId)),
      staleTime: Infinity
    });
  }

  cargarLeccion(): Promise<void> {
    return this.queryClient.fetchQuery({
      queryKey: ['leccion', this.leccionId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerLeccion(this.leccionId)),
      staleTime: Infinity
    }).then(response => {
      if (response.exito && response.datos) {
        this.leccionActual = { ...response.datos };
      } else {
        throw new Error('No se pudo cargar la lección');
      }
    });
  }

  cargarClase(): Promise<void> {
    const claseId = this.claseId;

    return this.queryClient.fetchQuery({
      queryKey: ['clase', claseId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerClase(claseId)),
      staleTime: Infinity
    }).then(response => {
      if (claseId !== this.claseId) {
        return;
      }

      if (response.exito && response.datos) {
        this.claseActual = { ...response.datos };
        this.cargarVideo();
        this.cargarProgresoClase();
        this.marcarComoVista();
      } else {
        this.error = response.mensaje || 'Error al cargar la clase';
        throw new Error(this.error);
      }
    });
  }

  async cargarVideo(): Promise<void> {
    const claseId = this.claseId;

    this.cargandoVideo = true;
    this.videoTipo = null;
    this.videoUrl = null;
    this.videoLocalUrl = null;

    try {
      const respuesta = await firstValueFrom(this.clasesService.obtenerVideoClase(claseId));

      if (claseId !== this.claseId) {
        return;
      }

      const video = respuesta.datos;

      if (respuesta.exito && video) {
        if (video.tipo === 'local') {
          this.videoLocalUrl = this.clasesService.construirUrlAbsoluta(video.url);
          this.videoTipo = 'local';
        } else {
          this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(video.url);
          this.videoTipo = 'externo';
        }
      }
    } catch {
      if (claseId === this.claseId) {
        this.videoTipo = null;
      }
    } finally {
      if (claseId === this.claseId) {
        this.cargandoVideo = false;
        this.cdr.detectChanges();
      }
    }
  }

  alErrorVideoLocal(): void {
    if (this.videoTipo !== 'local' || this.reintentoVideo) {
      return;
    }
    this.reintentoVideo = true;
    this.cargarVideo();
  }

  cargarClasesDeLeccion(): Promise<void> {
    return this.queryClient.fetchQuery({
      queryKey: ['clases-leccion', this.leccionId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerClasesDeLeccion(this.leccionId)),
      staleTime: Infinity
    }).then(response => {
      if (response.exito && response.datos) {
        this.clasesDeLeccion = response.datos
          .filter(c => c.activa)
          .sort((a, b) => a.orden - b.orden);
      }
    }).catch(() => undefined);
  }

  async cargarProgresoClasesLeccion(): Promise<void> {
    const leccionId = this.leccionId;

    try {
      const respuesta = await firstValueFrom(this.clasesService.obtenerProgresoClasesLeccion(leccionId));

      if (leccionId !== this.leccionId) {
        return;
      }

      const estado: { [claseId: number]: boolean } = {};
      for (const clase of respuesta.datos?.clases ?? []) {
        estado[clase.clase_id] = clase.completada;
      }
      this.estadoClases = estado;
    } catch {
      if (leccionId === this.leccionId) {
        this.estadoClases = {};
      }
    }
  }

  cargarProgresoClase(): void {
    const claseId = this.claseId;

    this.progresoService.obtenerProgresoClase(claseId).subscribe({
      next: (progreso) => {
        if (claseId !== this.claseId) {
          return;
        }
        this.progresoClase = progreso;
        this.estadoClases = { ...this.estadoClases, [claseId]: progreso.completada };
        this.actualizarClasesCompletadas();
        this.cdr.detectChanges();
      },
      error: (error) => { }
    });
  }

  actualizarClasesCompletadas(): void {
    this.clasesCompletadas = Object.values(this.estadoClases).filter(Boolean).length;
    this.actualizarDisponibilidadExamenes();
  }

  cargarExamenesDeLeccion(): Promise<void> {
    if (this.examenesDeLeccion.length === 0) {
      this.cargandoExamenes = true;
    }

    const leccionId = this.leccionId;

    return this.queryClient.fetchQuery({
      queryKey: ['examenes-leccion', leccionId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerExamenesDeLeccion(leccionId)),
      staleTime: 0
    }).then(response => {
      if (leccionId !== this.leccionId) {
        return;
      }

      if (response.exito && response.datos) {
        this.examenesDeLeccion = response.datos
          .filter(examen => examen.activo)
          .sort((a, b) => (a.orden || 0) - (b.orden || 0));
      } else {
        this.examenesDeLeccion = [];
      }
      this.cargandoExamenes = false;
    }).catch(() => {
      this.examenesDeLeccion = [];
      this.cargandoExamenes = false;
    });
  }

  verificarDisponibilidadExamen(examen: Examen): boolean {
    if (!examen.activo) {
      return false;
    }

    if (examen.completado) {
      return true;
    }

    if (examen.requiere_todas_clases) {
      return this.clasesCompletadas >= this.totalClases;
    }

    const clasesRequeridas = examen.clases_requeridas || 2;
    return this.clasesCompletadas >= clasesRequeridas;
  }

  actualizarDisponibilidadExamenes(): void {
    if (!this.examenesDeLeccion || this.examenesDeLeccion.length === 0) {
      return;
    }

    this.examenesDeLeccion = this.examenesDeLeccion.map(examen => {
      const disponible = this.verificarDisponibilidadExamen(examen);
      return { ...examen, disponible };
    });

    this.cdr.detectChanges();
  }

  obtenerRequisitosExamen(examen: Examen): {
    requeridas: number;
    cumplidas: number;
    faltantes: number;
    porcentaje: number;
  } {
    let clasesRequeridas: number;

    if (examen.requiere_todas_clases) {
      clasesRequeridas = this.totalClases;
    } else if (examen.clases_requeridas && examen.clases_requeridas > 0) {
      clasesRequeridas = examen.clases_requeridas;
    } else {
      clasesRequeridas = 2;
    }

    const faltantes = Math.max(0, clasesRequeridas - this.clasesCompletadas);
    const porcentaje = clasesRequeridas > 0
      ? Math.min(100, Math.round((this.clasesCompletadas / clasesRequeridas) * 100))
      : 100;

    return {
      requeridas: clasesRequeridas,
      cumplidas: Math.min(this.clasesCompletadas, clasesRequeridas),
      faltantes: faltantes,
      porcentaje: porcentaje
    };
  }

  navegarAExamen(examenId: number): void {
    const examen = this.examenesDeLeccion.find(e => e.id === examenId);

    if (!examen) {
      return;
    }

    this.actualizarClasesCompletadas();
    const disponible = this.verificarDisponibilidadExamen(examen);

    if (disponible || examen.completado) {
      this.router.navigate(['/examenes', examenId, 'tomar']);
    } else {
      this.mostrarMensajeExamenNoDisponible(examen);
    }
  }

  mostrarMensajeExamenNoDisponible(examen: Examen): void {
    const requisitos = this.obtenerRequisitosExamen(examen);
    let mensaje = `El examen "${examen.titulo}" no está disponible aún.\n\n`;

    if (!examen.activo) {
      mensaje += 'El examen no está activo.';
    } else {
      if (examen.requiere_todas_clases) {
        mensaje += `Requisito: Completar TODAS las clases\n`;
      } else if (examen.clases_requeridas && examen.clases_requeridas > 0) {
        mensaje += `Requisito: ${requisitos.requeridas} clases mínimo\n`;
      } else {
        mensaje += `Requisito: 2 clases mínimo\n`;
      }

      mensaje += `Completadas: ${requisitos.cumplidas}/${requisitos.requeridas}\n`;
      mensaje += `Progreso: ${requisitos.porcentaje}%\n`;

      if (requisitos.faltantes > 0) {
        mensaje += `Faltan: ${requisitos.faltantes} clase${requisitos.faltantes > 1 ? 's' : ''}`;
      }
    }

    alert(mensaje);
  }

  iniciarPractica(): void {
    this.seguimientoTiempo.iniciarSesion(this.claseId, this.leccionId, 'practica');
    if (!this.claseActual) {
      return;
    }

    this.procesandoResultado = false;
    this.practicaEnCurso = true;
    this.resultadoPractica = null;
    this.tiempoInicioPractica = Date.now();
  }

  finalizarPractica(resultado: any): void {
    if (this.procesandoResultado) {
      return;
    }
    this.procesandoResultado = true;

    this.practicaEnCurso = false;

    const senaDetectada = (resultado?.sena_reconocida || '').toString();
    const senaEsperada = this.letraSena;
    const precision = Number(resultado?.precision) || 0;
    const precisionMinima = Number(this.claseActual?.precision_minima || 0.7);

    const senaCoincide = this.normalizarSena(senaDetectada) === this.normalizarSena(senaEsperada);
    const precisionSuficiente = precision >= precisionMinima;
    const exitoValidado = senaCoincide && precisionSuficiente;

    this.resultadoPractica = {
      ...resultado,
      exito: exitoValidado,
      precision: precision,
      sena_reconocida: senaDetectada,
      sena_esperada: senaEsperada
    };

    if (!senaCoincide) {
      this.resultadoPractica.mensaje =
        `La seña detectada "${senaDetectada || '—'}" no coincide con la esperada "${senaEsperada}".`;
    } else if (!precisionSuficiente) {
      this.resultadoPractica.mensaje =
        `Precisión insuficiente: ${(precision * 100).toFixed(1)}%. ` +
        `Se requiere al menos ${(precisionMinima * 100).toFixed(0)}%.`;
    }

    const tiempoPractica = Math.floor((Date.now() - this.tiempoInicioPractica) / 1000);

    this.guardarResultadoPracticaConGamificacion(
      exitoValidado ? precision : 0,
      tiempoPractica,
      senaDetectada,
      exitoValidado
    );
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

  private guardarResultadoPracticaConGamificacion(
    precision: number,
    tiempoPractica: number,
    senaReconocida: string,
    esExitoso: boolean
  ): void {
    const datosPractica: ResultadoPracticaRequest = {
      precision: precision,
      tiempo_practica: tiempoPractica,
      sena_reconocida: senaReconocida,
      es_exitoso: esExitoso
    };

    this.progresoService.guardarResultadoPracticaCompleto(
      this.claseId,
      datosPractica
    ).subscribe({
      next: (respuesta) => {
        if (respuesta.progreso) {
          this.progresoClase = { ...respuesta.progreso };
          this.estadoClases = { ...this.estadoClases, [this.claseId]: respuesta.progreso.completada };

          const validacion = this.validarIntentoConProgresoActualizado(respuesta.progreso);

          this.resultadoPractica.exito = validacion.cumpleRequisitos;
          this.resultadoPractica.detalles = validacion.detalles;

          if (!this.resultadoPractica.exito) {
            this.resultadoPractica.mensaje = validacion.mensajesError.join('. ');
          } else {
            this.resultadoPractica.mensaje = 'Excelente trabajo! Has completado la práctica exitosamente.';
          }

          this.actualizarDatosGamificacion(respuesta);
          this.actualizarClasesCompletadas();
          this.cdr.detectChanges();

          if (respuesta.clase_completada && respuesta.progreso.completada) {
            setTimeout(() => {
              this.mostrarFelicitacion(respuesta);
            }, 100);
          }

          setTimeout(() => {
            this.cdr.detectChanges();
          }, 200);
        } else {
          this.refrescarProgresoClase();
        }
      },
      error: (error) => {
        this.guardarResultadoPracticaSimple(precision, tiempoPractica, senaReconocida);
      }
    });
  }

  private validarIntentoConProgresoActualizado(progresoActualizado: ProgresoClase): {
    cumpleRequisitos: boolean;
    mensajesError: string[];
    detalles: {
      coincidenciaCorrecta: boolean;
      precisionSuficiente: boolean;
      intentosSuficientes: boolean;
    }
  } {
    const mensajesError: string[] = [];

    if (!this.resultadoPractica || !progresoActualizado || !this.claseActual) {
      return {
        cumpleRequisitos: false,
        mensajesError: ['No hay datos de práctica disponibles'],
        detalles: {
          coincidenciaCorrecta: false,
          precisionSuficiente: false,
          intentosSuficientes: false
        }
      };
    }

    const senaDetectadaNorm = this.normalizarSena(this.resultadoPractica.sena_reconocida);
    const senaEsperadaNorm = this.normalizarSena(this.letraSena);
    const coincidenciaCorrecta = senaDetectadaNorm !== '' && senaDetectadaNorm === senaEsperadaNorm;

    const precisionMinima = this.claseActual.precision_minima || 0.7;
    const precisionSuficiente = this.resultadoPractica.precision >= precisionMinima;

    const intentosMinimos = this.claseActual.intentos_minimos || 3;
    const intentosActuales = progresoActualizado.intentos_realizados;
    const intentosSuficientes = intentosActuales >= intentosMinimos;

    if (!coincidenciaCorrecta) {
      mensajesError.push(
        `La seña detectada (${this.resultadoPractica.sena_reconocida}) no coincide con la esperada (${this.letraSena})`
      );
    }

    if (!precisionSuficiente) {
      const precisionObtenida = (this.resultadoPractica.precision * 100).toFixed(1);
      const precisionRequerida = (precisionMinima * 100).toFixed(0);
      mensajesError.push(
        `Precisión insuficiente: ${precisionObtenida}% (se requiere ${precisionRequerida}%)`
      );
    }

    if (!intentosSuficientes) {
      const faltantes = intentosMinimos - intentosActuales;
      mensajesError.push(
        `Faltan ${faltantes} intento${faltantes > 1 ? 's' : ''} (${intentosActuales}/${intentosMinimos})`
      );
    }

    const cumpleRequisitos = coincidenciaCorrecta && precisionSuficiente && intentosSuficientes;

    return {
      cumpleRequisitos,
      mensajesError,
      detalles: {
        coincidenciaCorrecta,
        precisionSuficiente,
        intentosSuficientes
      }
    };
  }

  private guardarResultadoPracticaSimple(
    precision: number,
    tiempoPractica: number,
    senaReconocida: string
  ): void {
    this.progresoService.guardarResultadoPractica(
      this.claseId,
      precision,
      tiempoPractica,
      senaReconocida
    ).subscribe({
      next: (respuesta) => {
        if (respuesta.progreso) {
          this.progresoClase = respuesta.progreso;
          this.estadoClases = { ...this.estadoClases, [this.claseId]: respuesta.progreso.completada };

          const validacion = this.validarIntentoConProgresoActualizado(respuesta.progreso);
          this.resultadoPractica.exito = validacion.cumpleRequisitos;
          this.resultadoPractica.detalles = validacion.detalles;

          if (!this.resultadoPractica.exito) {
            this.resultadoPractica.mensaje = validacion.mensajesError.join('. ');
          } else {
            this.resultadoPractica.mensaje = 'Excelente trabajo! Has completado la práctica exitosamente.';
          }

          if (respuesta.clase_completada && this.progresoClase.completada) {
            this.mostrarFelicitacion(respuesta);
          }

          this.actualizarClasesCompletadas();
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.refrescarProgresoClase();
      }
    });
  }

  validarIntento(): {
    cumpleRequisitos: boolean;
    mensajesError: string[];
    detalles: {
      coincidenciaCorrecta: boolean;
      precisionSuficiente: boolean;
      intentosSuficientes: boolean;
    }
  } {
    return this.validarIntentoConProgresoActualizado(this.progresoClase!);
  }

  private refrescarProgresoClase(): void {
    this.progresoService.obtenerProgresoClase(this.claseId).subscribe({
      next: (progresoActualizado) => {
        this.progresoClase = { ...progresoActualizado };
        this.estadoClases = { ...this.estadoClases, [this.claseId]: progresoActualizado.completada };

        if (this.resultadoPractica) {
          const validacion = this.validarIntentoConProgresoActualizado(progresoActualizado);
          this.resultadoPractica.exito = validacion.cumpleRequisitos;
          this.resultadoPractica.detalles = validacion.detalles;

          if (!this.resultadoPractica.exito) {
            this.resultadoPractica.mensaje = validacion.mensajesError.join('. ');
          } else {
            this.resultadoPractica.mensaje = 'Excelente trabajo! Has completado la práctica exitosamente.';
          }
        }

        this.actualizarClasesCompletadas();
        this.cdr.detectChanges();
        setTimeout(() => this.cdr.detectChanges(), 100);
      },
      error: (error) => { }
    });
  }

  reiniciarPractica(): void {
    this.procesandoResultado = false;
    this.resultadoPractica = null;
    this.practicaEnCurso = false;

    setTimeout(() => {
      this.iniciarPractica();
    }, 300);
  }

  marcarComoVista(): void {
    if (this.progresoClase && !this.progresoClase.vista) {
      this.progresoService.marcarClaseVista(this.claseId).subscribe({
        next: () => {
          if (this.progresoClase) {
            this.progresoClase.vista = true;
          }
        },
        error: (error) => { }
      });
    }
  }

  cambiarModo(modo: 'aprender' | 'practicar'): void {
    if (this.modoActual === 'practicar' && modo === 'aprender') {
      this.practicaEnCurso = false;
      this.resultadoPractica = null;
      this.procesandoResultado = false;
    }

    this.modoActual = modo;
  }

  estaClaseCompletada(claseId: number): boolean {
    return !!this.estadoClases[claseId];
  }

  estaClaseBloqueada(claseId: number): boolean {
    const indice = this.clasesDeLeccion.findIndex(c => c.id === claseId);
    if (indice <= 0) return false;

    const claseAnterior = this.clasesDeLeccion[indice - 1];
    return !this.estaClaseCompletada(claseAnterior.id!);
  }

  navegarAClase(claseId: number): void {
    if (this.estaClaseBloqueada(claseId)) {
      alert('Completa la clase anterior primero.');
      return;
    }

    this.resetearEstadoPractica();
    this.router.navigate(['/lecciones', this.leccionId, 'clase', claseId]);
  }

  navegarASiguienteClase(): void {
    if (!this.claseActual) return;

    const indiceActual = this.clasesDeLeccion.findIndex(c => c.id === this.claseId);

    if (indiceActual >= 0 && indiceActual < this.clasesDeLeccion.length - 1) {
      const siguienteClase = this.clasesDeLeccion[indiceActual + 1];
      this.navegarAClase(siguienteClase.id!);
    } else {
      alert('No hay más clases disponibles.');
      window.location.reload();
    }
  }

  navegarAClaseAnterior(): void {
    if (!this.claseActual) return;

    const indiceActual = this.clasesDeLeccion.findIndex(c => c.id === this.claseId);

    if (indiceActual > 0) {
      const claseAnterior = this.clasesDeLeccion[indiceActual - 1];
      this.navegarAClase(claseAnterior.id!);
    }
  }

  volverALecciones(): void {
    this.router.navigate(['/lecciones']);
  }

  volverAInicio(): void {
    this.router.navigate(['/dashboard']);
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  get puntosObtenidos(): number {
    return this.progresoClase?.puntos_ganados || 0;
  }

  private actualizarDatosGamificacion(respuesta: ResultadoPracticaResponse): void {
    if (respuesta.puntos_ganados > 0) {
      this.mostrarAnimacionPuntos(respuesta.puntos_ganados);
    }

    if (respuesta.xp_ganado > 0) {
      this.mostrarAnimacionXP(respuesta.xp_ganado);
    }

    if (respuesta.nivel_subido && respuesta.nuevo_nivel) {
      this.mostrarSubidaNivel(respuesta.nuevo_nivel);
    }

    if (respuesta.racha_actual > 0) {
      this.mostrarRacha(respuesta.racha_actual);
    }
  }

  private mostrarAnimacionPuntos(puntos: number): void {
    this.mostrarNotificacion(`+${puntos} puntos`, 'success');
  }

  private mostrarAnimacionXP(xp: number): void {
    this.mostrarNotificacion(`+${xp} XP`, 'info');
  }

  private mostrarSubidaNivel(nuevoNivel: number): void {
    this.mostrarNotificacion(`Nivel ${nuevoNivel} alcanzado!`, 'celebracion');
  }

  private mostrarRacha(racha: number): void {
    if (racha >= 3) {
      this.mostrarNotificacion(`Racha de ${racha} días consecutivos!`, 'warning');
    }
  }

  private mostrarNotificacion(mensaje: string, tipo: string): void {
    alert(mensaje);
  }

  private mostrarFelicitacion(respuesta: ResultadoPracticaResponse): void {
    let mensaje = 'Felicitaciones! Has completado esta clase exitosamente.';

    if (respuesta.puntos_ganados > 0) {
      mensaje += `\nGanaste ${respuesta.puntos_ganados} puntos.`;
    }

    if (respuesta.xp_ganado > 0) {
      mensaje += `\nGanaste ${respuesta.xp_ganado} XP.`;
    }

    if (respuesta.racha_actual > 1) {
      mensaje += `\nLlevas una racha de ${respuesta.racha_actual} días.`;
    }

    setTimeout(() => {
      alert(mensaje);
    }, 500);
  }

  get tituloSena(): string {
    return this.claseActual?.titulo || 'Seña';
  }

  get letraSena(): string {
    if (!this.claseActual) return '';

    const sena = (this.claseActual as any)?.sena;
    if (sena && String(sena).trim()) {
      return String(sena).trim();
    }

    const palabra = (this.claseActual as any)?.palabra;
    if (palabra && String(palabra).trim()) {
      return String(palabra).trim();
    }

    const titulo = this.claseActual?.titulo;
    return titulo ? String(titulo).trim() : '';
  }

  get senaReconocidaCoincide(): boolean {
    if (!this.resultadoPractica) return false;
    const detectada = this.normalizarSena(this.resultadoPractica.sena_reconocida);
    const esperada = this.normalizarSena(this.letraSena);
    return detectada !== '' && detectada === esperada;
  }

  get categoriaId(): number {
    return this.leccionActual?.categoria_id || 0;
  }

  get tipoContenido(): 'letras' | 'numeros' | 'colores' | 'comunes' {
    const titulo = (this.claseActual?.titulo || '').toLowerCase();

    if (titulo.includes('palabra')) return 'comunes';
    if (titulo.includes('número') || titulo.includes('numero')) return 'numeros';
    if (titulo.includes('color')) return 'colores';

    return 'letras';
  }

  get porcentajePrecision(): number {
    return this.progresoClase ? Math.round(this.progresoClase.mejor_precision * 100) : 0;
  }

  get claseCompletada(): boolean {
    return this.progresoClase?.completada || false;
  }

  get puedeAvanzar(): boolean {
    if (!this.claseActual || !this.progresoClase) return false;
    return this.progresoClase.completada;
  }

  get tituloCompleto(): string {
    if (this.leccionActual && this.claseActual) {
      return `${this.leccionActual.titulo} - ${this.claseActual.titulo}`;
    }
    return this.claseActual?.titulo || 'Clase';
  }

  get numeroClaseActual(): number {
    const indice = this.clasesDeLeccion.findIndex(c => c.id === this.claseId);
    return indice >= 0 ? indice + 1 : 1;
  }

  get totalClases(): number {
    return this.clasesDeLeccion.length;
  }

  get esPrimeraClase(): boolean {
    return this.numeroClaseActual === 1;
  }

  get esUltimaClase(): boolean {
    return this.numeroClaseActual === this.totalClases;
  }

  get porcentajeProgreso(): number {
    if (this.totalClases === 0) return 0;
    return Math.round((this.numeroClaseActual / this.totalClases) * 100);
  }

  get mensajeProgreso(): string {
    if (this.claseCompletada) return 'Clase completada';
    if (this.progresoClase?.vista) return 'En progreso';
    return 'No iniciada';
  }

  get colorProgreso(): string {
    if (this.claseCompletada) return '#4caf50';
    if (this.progresoClase?.vista) return '#ff9800';
    return '#999';
  }

  get hayExamenesDisponibles(): boolean {
    return this.examenesDeLeccion.some(examen => examen.disponible);
  }

  get examenMasReciente(): Examen | null {
    const examenesDisponibles = this.examenesDeLeccion.filter(examen => examen.disponible);
    return examenesDisponibles.length > 0 ? examenesDisponibles[0] : null;
  }
}
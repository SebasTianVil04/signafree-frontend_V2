import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CapturaService } from '../../../servicios/captura.service';
import { CategoriaService, Categoria } from '../../../servicios/categoria.service';
import { SenaCategoriaService, SenaCategoria } from '../../../servicios/sena-categoria.service';
import { HandDetectionService } from '../../../servicios/hand-detection.service';
import { PrivacyFilterService } from '../../../servicios/privacy-filter.service';
import { ArchivosService } from '../../../servicios/archivos.service';
import { Results } from '@mediapipe/hands';

interface ItemSubida {
  blob: Blob;
  categoriaId: number;
  senaId: number;
  senaNombre: string;
  nombreArchivo: string;
  porcentajeMano: number;
}

interface ConfigCaptura {
  metaVideos?: number;
  categoriaId?: number;
  modoAutomatico?: boolean;
  filtroPrivacidadActivo?: boolean;
}

type FaseCaptura = 'inactiva' | 'posicionando' | 'cuenta' | 'grabando';

const CLAVE_CONFIG = 'configCapturaUnificada';

@Component({
  selector: 'app-captura-unificada',
  templateUrl: './captura-unificada.component.html',
  styleUrls: ['./captura-unificada.component.scss'],
  standalone: false
})
export class CapturaUnificadaComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('inputImagenReferencia', { static: false }) inputImagenReferencia!: ElementRef<HTMLInputElement>;

  categorias: Categoria[] = [];
  categoriaSeleccionada: Categoria | null = null;

  senasDisponibles: SenaCategoria[] = [];
  senaActual: SenaCategoria | null = null;
  indiceSenaActual: number = 0;
  cargandoSenas: boolean = false;

  camaraActiva: boolean = false;
  deteccionActiva: boolean = false;
  grabando: boolean = false;
  mensaje: string | null = null;
  error: string | null = null;
  cargandoCategorias: boolean = true;

  manoDetectada: boolean = false;
  numeroManos: number = 0;

  fase: FaseCaptura = 'inactiva';
  cuenta: number = 3;
  posicionOk: boolean = false;

  videosCapturados: number = 0;
  metaVideos: number = 20;
  readonly metasDisponibles: number[] = [10, 20, 30, 50, 100, 150, 200];

  pendientesSubida: number = 0;
  private colaSubida: ItemSubida[] = [];
  private enSubida: ItemSubida[] = [];
  private enProceso: boolean = false;
  private readonly MAX_PENDIENTES = 4;
  private readonly MAX_SUBIDAS_SIMULTANEAS = 1;

  tiempoGrabacion: number = 0;
  maxTiempoGrabacion: number = 3;
  tiempoInicio: number = 0;
  private intervaloGrabacion: ReturnType<typeof setInterval> | null = null;
  private timeoutFinGrabacion: ReturnType<typeof setTimeout> | null = null;

  mediaRecorder: any = null;
  recordedChunks: Blob[] = [];
  streamCaptura: any = null;
  streamOriginal: MediaStream | null = null;

  videoPreviewUrl: SafeUrl | null = null;
  private videoPreviewObjectUrl: string | null = null;
  mostrarReferencia: boolean = true;
  imagenCargada: boolean = false;
  imagenError: boolean = false;
  subiendoImagen: boolean = false;

  urlReferencia: string = '';
  cargandoReferencia: boolean = false;

  nuevaSenaTexto: string = '';
  mostrarInputSena: boolean = false;
  editandoSenaId: number | null = null;

  modoAutomatico: boolean = true;
  filtroPrivacidadActivo: boolean = true;
  private framesTotalesGrabacion: number = 0;
  private framesConManoGrabacion: number = 0;
  private porcentajeManoUltimaToma: number = 0;
  progresoEstabilidad: number = 0;

  private readonly SEGUNDOS_CUENTA = 3;
  private readonly MS_POSICION_ESTABLE = 1000;
  private readonly MAX_FRAMES_SIN_POSICION = 10;
  private posicionOkDesde: number = 0;
  private framesSinPosicion: number = 0;
  private cuentaAutomatica: boolean = false;
  private timerCuenta: ReturnType<typeof setInterval> | null = null;

  cooldownActivo: boolean = false;
  private readonly COOLDOWN_MS = 1000;
  private temporizadorCooldown: ReturnType<typeof setTimeout> | null = null;

  private modoAutomaticoPrevioACapturaMasiva: boolean | null = null;

  private destruido = false;
  private readonly destroy$ = new Subject<void>();
  private senasSub?: Subscription;
  private conteoSub?: Subscription;
  private referenciaSub?: Subscription;
  private configGuardada: ConfigCaptura | null = null;

  constructor(
    private capturaService: CapturaService,
    private categoriaService: CategoriaService,
    private senaCategoriaService: SenaCategoriaService,
    private handDetectionService: HandDetectionService,
    private privacyFilter: PrivacyFilterService,
    private archivosService: ArchivosService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.cargarConfiguracion();
    this.cargarCategorias();
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.destroy$.next();
    this.destroy$.complete();

    if (this.temporizadorCooldown) {
      clearTimeout(this.temporizadorCooldown);
      this.temporizadorCooldown = null;
    }

    this.detenerCamara();
    this.limpiarRecursos();
  }

  get categoriaDatasetId(): number | null {
    const c = this.categoriaSeleccionada;
    return c ? (c.dataset_id ?? c.id) : null;
  }

  trackByCategoria(_: number, categoria: Categoria): number {
    return categoria.id;
  }

  trackBySena(_: number, sena: SenaCategoria): number {
    return sena.id;
  }

  obtenerClaseIcono(icono?: string | null): string {
    if (!icono) return 'fas fa-folder';
    const valor = icono.trim();
    if (valor.startsWith('fas ') || valor.startsWith('far ') ||
        valor.startsWith('fab ') || valor.startsWith('fa ')) {
      return valor;
    }
    if (valor.startsWith('fa-')) return `fas ${valor}`;
    if (valor.startsWith('bi bi-')) return `fas ${valor.slice(3)}`;
    if (valor.startsWith('bi-')) return `fas ${valor}`;
    return `fas fa-${valor}`;
  }

  cerrarAlerta(tipo: 'error' | 'mensaje'): void {
    if (tipo === 'error') {
      this.error = null;
    } else {
      this.mensaje = null;
    }
  }

  private leerConfiguracion(): ConfigCaptura | null {
    try {
      const raw = localStorage.getItem(CLAVE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Error cargando configuración:', e);
      return null;
    }
  }

  private cargarConfiguracion(): void {
    const config = this.leerConfiguracion();
    this.configGuardada = config;
    if (!config) return;

    if (config.metaVideos && this.metasDisponibles.includes(config.metaVideos)) {
      this.metaVideos = config.metaVideos;
    }
    if (typeof config.modoAutomatico === 'boolean') {
      this.modoAutomatico = config.modoAutomatico;
    }
    if (typeof config.filtroPrivacidadActivo === 'boolean') {
      this.filtroPrivacidadActivo = config.filtroPrivacidadActivo;
    }
  }

  private guardarConfiguracion(): void {
    const config: ConfigCaptura = {
      metaVideos: this.metaVideos,
      categoriaId: this.categoriaSeleccionada?.id,
      modoAutomatico: this.modoAutomatico,
      filtroPrivacidadActivo: this.filtroPrivacidadActivo
    };
    try {
      localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('No se pudo guardar la configuración:', e);
    }
  }

  cargarCategorias(): void {
    this.cargandoCategorias = true;

    this.categoriaService.listarCategorias(true).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.categorias = response.datos.filter(c => c.activa);

          const guardada = this.categorias.find(c => c.id === this.configGuardada?.categoriaId);
          const inicial = guardada ?? this.categorias[0];
          if (inicial) {
            this.seleccionarCategoria(inicial);
          }
        } else {
          this.error = response.mensaje || 'No se pudieron cargar las categorías';
        }
        this.cargandoCategorias = false;
      },
      error: (err) => {
        console.error('Error cargando categorías:', err);
        this.error = 'No se pudieron cargar las categorías';
        this.cargandoCategorias = false;
      }
    });
  }

  seleccionarCategoria(categoria: Categoria): void {
    this.categoriaSeleccionada = categoria;
    this.videosCapturados = 0;
    this.mostrarInputSena = false;
    this.nuevaSenaTexto = '';
    this.cargarSenasDeCategoria(categoria.id);
    this.guardarConfiguracion();
    this.mensaje = `Categoría seleccionada: ${categoria.nombre}`;
    this.error = null;
  }

  private cargarSenasDeCategoria(categoriaId: number): void {
    this.senasSub?.unsubscribe();
    this.cargandoSenas = true;

    this.senasSub = this.senaCategoriaService.listarSenas(categoriaId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senasDisponibles = [...respuesta.datos].sort((a, b) => a.orden - b.orden);
          if (this.senasDisponibles.length > 0) {
            this.indiceSenaActual = 0;
            this.senaActual = this.senasDisponibles[0];
            this.actualizarUrlReferencia();
            this.sincronizarConteo();
          } else {
            this.senaActual = null;
            this.indiceSenaActual = 0;
            this.mostrarInputSena = true;
            this.actualizarUrlReferencia();
          }
        }
        this.cargandoSenas = false;
      },
      error: (err) => {
        console.error('Error cargando señas:', err);
        this.error = 'No se pudieron cargar las señas de esta categoría';
        this.cargandoSenas = false;
      }
    });
  }

  cambiarMetaVideos(nuevaMeta: number): void {
    this.metaVideos = nuevaMeta;
    this.guardarConfiguracion();
    this.mensaje = `Meta actualizada: ${nuevaMeta} videos por seña`;
  }

  toggleModoAutomatico(): void {
    this.modoAutomatico = !this.modoAutomatico;
    this.posicionOkDesde = 0;
    this.progresoEstabilidad = 0;
    this.guardarConfiguracion();
    this.mensaje = this.modoAutomatico
      ? 'Auto-grabación activada: al ubicarte bien se iniciará la cuenta regresiva'
      : 'Auto-grabación desactivada: usa el botón "Grabar Video"';
  }

  toggleFiltroPrivacidad(): void {
    if (this.grabando) return;
    this.filtroPrivacidadActivo = !this.filtroPrivacidadActivo;
    this.guardarConfiguracion();
    this.mensaje = this.filtroPrivacidadActivo
      ? 'Filtro de privacidad activado: el rostro no se grabará'
      : 'Filtro de privacidad desactivado: se grabará la imagen completa';
  }

  private actualizarUrlReferencia(): void {
    this.referenciaSub?.unsubscribe();
    this.urlReferencia = '';
    this.imagenCargada = false;
    this.imagenError = false;

    const sena = this.senaActual;
    if (!sena?.archivo_referencia) {
      this.cargandoReferencia = false;
      return;
    }

    this.cargandoReferencia = true;
    this.referenciaSub = this.archivosService.urlReferencia(sena.archivo_referencia).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (url) => {
        if (this.senaActual?.id !== sena.id) return;
        this.urlReferencia = url;
        this.cargandoReferencia = false;
      },
      error: () => {
        if (this.senaActual?.id !== sena.id) return;
        this.imagenError = true;
        this.cargandoReferencia = false;
      }
    });
  }

  tieneReferencia(): boolean {
    return !!this.senaActual?.archivo_referencia;
  }

  esVideoReferencia(): boolean {
    return this.senaActual?.tipo_referencia === 'video';
  }

  esImagenReferencia(): boolean {
    return this.senaActual?.tipo_referencia === 'imagen';
  }

  toggleReferencia(): void {
    this.mostrarReferencia = !this.mostrarReferencia;
  }

  onImageError(event: any): void {
    this.imagenCargada = false;
    this.imagenError = true;
    event.target.style.display = 'none';
  }

  onImageLoad(event: any): void {
    this.imagenCargada = true;
    this.imagenError = false;
    event.target.style.display = 'block';
  }

  abrirSelectorImagen(): void {
    this.inputImagenReferencia?.nativeElement.click();
  }

  onArchivoReferenciaSeleccionado(event: Event): void {
    if (!this.categoriaSeleccionada || !this.senaActual) return;

    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoImagen = true;
    this.senaCategoriaService.subirArchivoReferencia(this.categoriaSeleccionada.id, this.senaActual.id, archivo).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senaActual = respuesta.datos;
          const indice = this.senasDisponibles.findIndex(s => s.id === respuesta.datos.id);
          if (indice >= 0) this.senasDisponibles[indice] = respuesta.datos;
          this.archivosService.limpiarCache();
          this.actualizarUrlReferencia();
          this.mensaje = respuesta.datos.tipo_referencia === 'video'
            ? 'Video de referencia actualizado'
            : 'Imagen de referencia actualizada';
        }
        this.subiendoImagen = false;
        input.value = '';
      },
      error: (err) => {
        this.error = err.error?.detail || 'Error al subir el archivo de referencia';
        this.subiendoImagen = false;
        input.value = '';
      }
    });
  }

  eliminarReferencia(): void {
    if (!this.categoriaSeleccionada || !this.senaActual) return;

    if (!confirm('¿Eliminar la referencia de esta seña?')) return;

    this.senaCategoriaService.eliminarArchivoReferencia(this.categoriaSeleccionada.id, this.senaActual.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senaActual = respuesta.datos;
          const indice = this.senasDisponibles.findIndex(s => s.id === respuesta.datos.id);
          if (indice >= 0) this.senasDisponibles[indice] = respuesta.datos;
          this.archivosService.limpiarCache();
          this.actualizarUrlReferencia();
          this.mensaje = 'Referencia eliminada';
        }
      },
      error: (err) => {
        this.error = err.error?.detail || 'Error al eliminar la referencia';
      }
    });
  }

  agregarSena(): void {
    if (!this.categoriaSeleccionada) return;

    if (this.nuevaSenaTexto.trim() === '') {
      this.error = 'Por favor ingresa el nombre de la seña';
      return;
    }

    const nombre = this.nuevaSenaTexto.trim().toUpperCase();

    if (this.editandoSenaId !== null) {
      this.senaCategoriaService.actualizarSena(this.categoriaSeleccionada.id, this.editandoSenaId, { nombre }).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (respuesta) => {
          if (respuesta.exito) {
            const indice = this.senasDisponibles.findIndex(s => s.id === this.editandoSenaId);
            if (indice >= 0) this.senasDisponibles[indice] = respuesta.datos;
            this.senaActual = respuesta.datos;
            this.actualizarUrlReferencia();
            this.mensaje = `Seña actualizada: ${nombre}`;
          }
          this.finalizarEdicionSena();
        },
        error: (err) => {
          this.error = err.error?.detail || 'Error al actualizar la seña';
        }
      });
      return;
    }

    const maxOrden = this.senasDisponibles.length > 0
      ? Math.max(...this.senasDisponibles.map(s => s.orden))
      : 0;

    this.senaCategoriaService.crearSena(this.categoriaSeleccionada.id, { nombre, orden: maxOrden + 1 }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senasDisponibles.push(respuesta.datos);
          this.senaActual = respuesta.datos;
          this.indiceSenaActual = this.senasDisponibles.length - 1;
          this.videosCapturados = 0;
          this.actualizarUrlReferencia();
          this.mensaje = `Seña agregada: ${nombre}`;
        }
        this.finalizarEdicionSena();
      },
      error: (err) => {
        this.error = err.error?.detail || 'Error al crear la seña';
      }
    });
  }

  editarSenaActual(): void {
    if (!this.senaActual) return;
    this.nuevaSenaTexto = this.senaActual.nombre;
    this.editandoSenaId = this.senaActual.id;
    this.mostrarInputSena = true;
  }

  cancelarEdicionSena(): void {
    this.finalizarEdicionSena();
  }

  private finalizarEdicionSena(): void {
    this.mostrarInputSena = false;
    this.nuevaSenaTexto = '';
    this.editandoSenaId = null;
    this.error = null;
  }

  eliminarSena(sena: SenaCategoria): void {
    if (!this.categoriaSeleccionada) return;

    if (!confirm(`¿Eliminar la seña "${sena.nombre}"? Esto no borra los videos ya grabados.`)) return;

    this.senaCategoriaService.eliminarSena(this.categoriaSeleccionada.id, sena.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        const indice = this.senasDisponibles.findIndex(s => s.id === sena.id);
        if (indice >= 0) this.senasDisponibles.splice(indice, 1);

        if (this.senaActual?.id === sena.id) {
          this.videosCapturados = 0;
          if (this.senasDisponibles.length > 0) {
            this.indiceSenaActual = 0;
            this.senaActual = this.senasDisponibles[0];
            this.sincronizarConteo();
          } else {
            this.senaActual = null;
            this.indiceSenaActual = 0;
            this.mostrarInputSena = true;
          }
          this.actualizarUrlReferencia();
        }

        this.mensaje = `Seña "${sena.nombre}" eliminada`;
      },
      error: (err) => {
        this.error = err.error?.detail || 'Error al eliminar la seña';
      }
    });
  }

  async iniciarCamara(): Promise<void> {
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        },
        audio: false
      };

      this.streamOriginal = await navigator.mediaDevices.getUserMedia(constraints);

      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;

      video.srcObject = this.streamOriginal;

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Timeout esperando metadata del video'));
        }, 5000);

        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Error cargando video'));
        };
      });

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      await video.play();

      await new Promise(resolve => setTimeout(resolve, 100));

      this.handDetectionService.setDibujarLandmarks(true);

      await this.handDetectionService.iniciarDeteccion(
        video,
        canvas,
        (results: Results) => this.onHandsDetected(results)
      );

      this.camaraActiva = true;
      this.deteccionActiva = true;
      this.fase = 'posicionando';
      this.posicionOk = false;
      this.posicionOkDesde = 0;
      this.progresoEstabilidad = 0;
      this.mensaje = this.modoAutomatico
        ? 'Cámara iniciada. Ubícate según la guía: al ponerse verde comenzará la cuenta regresiva'
        : 'Cámara iniciada. Ubícate según la guía y pulsa "Grabar Video"';
      this.error = null;

    } catch (error) {
      console.error('Error iniciando cámara:', error);
      this.error = 'No se pudo acceder a la cámara. Asegúrate de permitir el acceso.';
      this.camaraActiva = false;
      this.fase = 'inactiva';
    }
  }

  onHandsDetected(results: Results): void {
    if (this.filtroPrivacidadActivo) {
      this.privacyFilter.actualizarMascara(results);
    }

    const teniaMano = this.manoDetectada;
    this.manoDetectada = this.handDetectionService.verificarManoDetectada(results);
    this.numeroManos = results.multiHandLandmarks?.length || 0;

    if (this.grabando) {
      this.framesTotalesGrabacion++;
      if (this.manoDetectada) {
        this.framesConManoGrabacion++;
      }
    }

    if (this.manoDetectada && !teniaMano && this.fase === 'posicionando' && !this.enProceso && this.senaActual) {
      this.mensaje = `Mano detectada. Listo para grabar "${this.senaActual.nombre}"`;
    }

    this.evaluarFases(results);
  }

  private posicionCorrecta(results: Results): boolean {
    const manos = results.multiHandLandmarks ?? [];
    if (manos.length === 0) return false;
    if (!this.handDetectionService.verificarManoDetectada(results)) return false;

    return manos.every(mano =>
      mano.every(p => p.x > 0.03 && p.x < 0.97 && p.y > 0.03 && p.y < 0.97)
    );
  }

  private puedeAutoGrabar(): boolean {
    return !this.grabando
      && !this.enProceso
      && !this.cooldownActivo
      && !!this.senaActual
      && this.pendientesSubida === 0
      && this.totalContado() < this.metaVideos;
  }

  private evaluarFases(results: Results): void {
    if (!this.camaraActiva) return;

    const ok = this.posicionCorrecta(results);

    if (this.fase === 'posicionando') {
      this.posicionOk = ok;

      if (!this.modoAutomatico || !this.puedeAutoGrabar() || !ok) {
        this.posicionOkDesde = 0;
        this.progresoEstabilidad = 0;
        return;
      }

      if (!this.posicionOkDesde) {
        this.posicionOkDesde = Date.now();
      }

      const transcurrido = Date.now() - this.posicionOkDesde;
      this.progresoEstabilidad = Math.min(100, Math.round((transcurrido / this.MS_POSICION_ESTABLE) * 100));

      if (transcurrido >= this.MS_POSICION_ESTABLE) {
        this.posicionOkDesde = 0;
        this.progresoEstabilidad = 0;
        this.iniciarCuenta(true);
      }
      return;
    }

    if (this.fase === 'cuenta' && this.cuentaAutomatica) {
      if (ok) {
        this.framesSinPosicion = 0;
      } else {
        this.framesSinPosicion++;
        if (this.framesSinPosicion > this.MAX_FRAMES_SIN_POSICION) {
          this.cancelarCuenta();
        }
      }
    }
  }

  private iniciarCuenta(automatica: boolean): void {
    if (this.fase === 'cuenta' || this.grabando || this.enProceso) return;

    this.limpiarTimerCuenta();
    this.cuentaAutomatica = automatica;
    this.framesSinPosicion = 0;
    this.cuenta = this.SEGUNDOS_CUENTA;
    this.fase = 'cuenta';
    this.handDetectionService.setDibujarLandmarks(false);
    this.mensaje = `Prepárate para hacer la seña "${this.senaActual?.nombre}"`;

    this.timerCuenta = setInterval(() => {
      this.cuenta--;
      if (this.cuenta <= 0) {
        this.limpiarTimerCuenta();
        this.comenzarGrabacion();
      }
    }, 1000);
  }

  private limpiarTimerCuenta(): void {
    if (this.timerCuenta) {
      clearInterval(this.timerCuenta);
      this.timerCuenta = null;
    }
  }

  cancelarCuenta(): void {
    this.limpiarTimerCuenta();
    this.volverAPosicionando();
  }

  private volverAPosicionando(): void {
    this.fase = this.camaraActiva ? 'posicionando' : 'inactiva';
    this.cuenta = this.SEGUNDOS_CUENTA;
    this.posicionOk = false;
    this.posicionOkDesde = 0;
    this.framesSinPosicion = 0;
    this.progresoEstabilidad = 0;
    this.handDetectionService.setDibujarLandmarks(true);
  }

  private activarCooldown(): void {
    this.cooldownActivo = true;
    if (this.temporizadorCooldown) {
      clearTimeout(this.temporizadorCooldown);
    }
    this.temporizadorCooldown = setTimeout(() => {
      this.cooldownActivo = false;
      this.temporizadorCooldown = null;
    }, this.COOLDOWN_MS);
  }

  detenerCamara(): void {
    this.limpiarTimerCuenta();

    if (this.grabando) {
      this.detenerGrabacion();
    }

    this.handDetectionService.detenerDeteccion().catch(() => {});
    this.handDetectionService.setDibujarLandmarks(true);

    this.privacyFilter.detenerRender();
    this.privacyFilter.reiniciar();

    if (this.streamOriginal) {
      this.streamOriginal.getTracks().forEach((track: any) => {
        track.stop();
      });
      this.streamOriginal = null;
    }

    if (this.videoElement && this.videoElement.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.pause();
      video.srcObject = null;
    }

    this.camaraActiva = false;
    this.deteccionActiva = false;
    this.manoDetectada = false;
    this.numeroManos = 0;
    this.fase = 'inactiva';
    this.posicionOk = false;
    this.posicionOkDesde = 0;
    this.framesSinPosicion = 0;
    this.progresoEstabilidad = 0;
    this.mensaje = 'Cámara detenida correctamente';
  }

  private validarParaGrabar(requiereMano: boolean): boolean {
    if (!this.categoriaSeleccionada) {
      this.error = 'Primero selecciona una categoría';
      return false;
    }

    if (!this.camaraActiva) {
      this.error = 'Primero inicia la cámara';
      return false;
    }

    if (requiereMano && !this.manoDetectada) {
      this.error = 'No se detecta ninguna mano. Coloca tu mano frente a la cámara';
      return false;
    }

    if (!this.senaActual) {
      this.error = 'Primero ingresa o selecciona una seña';
      return false;
    }

    if (this.totalContado() >= this.metaVideos) {
      this.error = `Ya alcanzaste la meta de ${this.metaVideos} videos para "${this.senaActual.nombre}"`;
      return false;
    }

    return true;
  }

  iniciarGrabacion(): void {
    if (this.grabando || this.enProceso || this.fase === 'cuenta') return;
    if (!this.validarParaGrabar(true)) return;
    this.iniciarCuenta(false);
  }

  iniciarGrabacionDirecta(): void {
    if (this.grabando || this.enProceso) return;
    if (!this.validarParaGrabar(true)) return;
    this.comenzarGrabacion();
  }

  private comenzarGrabacion(): void {
    if (this.grabando || this.enProceso) return;

    if (!this.validarParaGrabar(false)) {
      this.volverAPosicionando();
      return;
    }

    const sena = this.senaActual!;

    this.enProceso = true;
    this.grabando = true;
    this.fase = 'grabando';
    this.handDetectionService.setDibujarLandmarks(false);
    this.tiempoGrabacion = 0;
    this.tiempoInicio = performance.now();
    this.framesTotalesGrabacion = 0;
    this.framesConManoGrabacion = 0;
    this.error = null;

    const usaFiltro = this.filtroPrivacidadActivo;
    const chunks: Blob[] = [];
    this.recordedChunks = chunks;

    try {
      if (usaFiltro) {
        this.privacyFilter.iniciarRender(this.videoElement.nativeElement);
        this.streamCaptura = this.privacyFilter.obtenerStream(30);
      } else {
        this.streamCaptura = this.streamOriginal;
      }

      const streamLocal = this.streamCaptura;
      const mimeType = this.obtenerMejorMimeType();

      const options = {
        mimeType: mimeType,
        videoBitsPerSecond: 1500000
      };

      const recorder = new (window as any).MediaRecorder(streamLocal, options);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (usaFiltro) {
          this.privacyFilter.detenerRender();
          streamLocal?.getTracks().forEach((t: any) => t.stop());
        }

        this.streamCaptura = null;

        if (chunks.length === 0) {
          this.error = 'No se capturaron datos de video';
          this.enProceso = false;
          this.activarCooldown();
          this.volverAPosicionando();
          return;
        }

        this.porcentajeManoUltimaToma = this.framesTotalesGrabacion > 0
          ? Math.round((this.framesConManoGrabacion / this.framesTotalesGrabacion) * 100)
          : 0;

        const blob = new Blob(chunks, { type: mimeType });

        this.reemplazarPreview(blob);
        this.guardarVideo(blob);

        this.enProceso = false;
        this.activarCooldown();
        this.volverAPosicionando();
      };

      recorder.start(100);
      this.actualizarTemporizador();

      this.mensaje = `Grabando "${sena.nombre}"... (${this.tiempoGrabacion}s)`;

    } catch (error) {
      console.error('Error iniciando grabación:', error);
      this.privacyFilter.detenerRender();
      this.error = 'Error al iniciar la grabación. Intenta nuevamente.';
      this.grabando = false;
      this.enProceso = false;
      this.volverAPosicionando();
    }
  }

  private reemplazarPreview(blob: Blob): void {
    this.liberarPreview();
    this.videoPreviewObjectUrl = URL.createObjectURL(blob);
    this.videoPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(this.videoPreviewObjectUrl);
  }

  private liberarPreview(): void {
    if (this.videoPreviewObjectUrl) {
      URL.revokeObjectURL(this.videoPreviewObjectUrl);
      this.videoPreviewObjectUrl = null;
    }
    this.videoPreviewUrl = null;
  }

  private actualizarTemporizador(): void {
    this.limpiarTemporizadorGrabacion();

    this.intervaloGrabacion = setInterval(() => {
      if (!this.grabando) {
        this.limpiarTemporizadorGrabacion();
        return;
      }

      const tiempoTranscurrido = (performance.now() - this.tiempoInicio) / 1000;
      this.tiempoGrabacion = Math.min(this.maxTiempoGrabacion, Math.floor(tiempoTranscurrido * 10) / 10);
    }, 100);

    this.timeoutFinGrabacion = setTimeout(() => {
      this.timeoutFinGrabacion = null;
      this.detenerGrabacion();
    }, this.maxTiempoGrabacion * 1000);
  }

  private limpiarTemporizadorGrabacion(): void {
    if (this.intervaloGrabacion) {
      clearInterval(this.intervaloGrabacion);
      this.intervaloGrabacion = null;
    }
    if (this.timeoutFinGrabacion) {
      clearTimeout(this.timeoutFinGrabacion);
      this.timeoutFinGrabacion = null;
    }
  }

  private obtenerMejorMimeType(): string {
    const tipos = [
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    const MediaRecorder = (window as any).MediaRecorder;

    if (MediaRecorder && MediaRecorder.isTypeSupported) {
      for (const tipo of tipos) {
        if (MediaRecorder.isTypeSupported(tipo)) {
          return tipo;
        }
      }
    }

    return 'video/webm';
  }

  detenerGrabacion(): void {
    if (!this.grabando) return;

    this.grabando = false;
    this.limpiarTemporizadorGrabacion();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('Error deteniendo MediaRecorder:', error);
        this.enProceso = false;
        this.volverAPosicionando();
      }
    } else {
      this.enProceso = false;
      this.volverAPosicionando();
    }

    this.mensaje = 'Grabación finalizada, procesando video...';
  }

  guardarVideo(videoBlob: Blob): void {
    const datasetId = this.categoriaDatasetId;
    if (datasetId === null || !this.senaActual) return;

    const tipoReal = videoBlob.type.toLowerCase();
    const esMp4 = tipoReal.includes('mp4') || tipoReal.includes('h264') || tipoReal.includes('avc1');
    const extension = esMp4 ? '.mp4' : '.webm';

    this.colaSubida.push({
      blob: videoBlob,
      categoriaId: datasetId,
      senaId: this.senaActual.id,
      senaNombre: this.senaActual.nombre,
      nombreArchivo: `${this.senaActual.nombre}_${Date.now()}${extension}`,
      porcentajeMano: this.porcentajeManoUltimaToma
    });

    this.actualizarPendientes();
    this.procesarCola();
  }

  private actualizarPendientes(): void {
    this.pendientesSubida = this.colaSubida.length + this.enSubida.length;
  }

  private pendientesDeSenaActual(): number {
    const id = this.senaActual?.id;
    return this.colaSubida.filter(i => i.senaId === id).length
      + this.enSubida.filter(i => i.senaId === id).length;
  }

  private totalContado(): number {
    return this.videosCapturados + this.pendientesDeSenaActual() + (this.enProceso ? 1 : 0);
  }

  private procesarCola(): void {
    while (this.enSubida.length < this.MAX_SUBIDAS_SIMULTANEAS && this.colaSubida.length > 0) {
      this.subirSiguiente();
    }
  }

  private subirSiguiente(): void {
    const item = this.colaSubida.shift()!;
    this.enSubida.push(item);
    this.actualizarPendientes();

    const formData = new FormData();
    formData.append('archivo', item.blob, item.nombreArchivo);
    formData.append('categoria_id', item.categoriaId.toString());
    formData.append('sena', item.senaNombre);

    this.capturaService.capturarVideoArchivo(formData).pipe(
      finalize(() => {
        this.enSubida = this.enSubida.filter(i => i !== item);
        this.actualizarPendientes();

        if (this.destruido) return;

        if (this.colaSubida.length > 0) {
          this.procesarCola();
        } else if (this.enSubida.length === 0) {
          this.sincronizarConteo();
        }
      })
    ).subscribe({
      next: (response) => {
        if (this.destruido) return;

        if (!response.exito) {
          this.error = `Error: ${response.mensaje || 'Error al guardar video'}`;
          return;
        }

        if (item.senaId === this.senaActual?.id) {
          this.videosCapturados++;
        }

        const restantes = Math.max(0, this.metaVideos - this.videosCapturados);
        let texto = `Video ${Math.min(this.videosCapturados, this.metaVideos)}/${this.metaVideos} de "${item.senaNombre}" guardado`;
        texto += ` | Frames: ${response.datos?.frames_extraidos ?? 0}`;
        texto += ` | Mano visible: ${item.porcentajeMano}%`;
        if (restantes > 0) {
          texto += ` | Faltan: ${restantes} videos`;
        }
        this.mensaje = texto;
      },
      error: (err: Error) => {
        if (this.destruido) return;
        this.error = `Error al guardar video de "${item.senaNombre}": ${err.message}`;
      }
    });
  }

  private sincronizarConteo(): void {
    const datasetId = this.categoriaDatasetId;
    const sena = this.senaActual;
    if (datasetId === null || !sena) return;

    this.conteoSub?.unsubscribe();
    this.conteoSub = this.capturaService.obtenerConteoSena(datasetId, sena.nombre).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (respuesta) => {
        const sinSubidasEnCurso = this.enSubida.length === 0 && this.colaSubida.length === 0;
        if (respuesta.exito && respuesta.datos && this.senaActual?.id === sena.id && sinSubidasEnCurso) {
          this.videosCapturados = respuesta.datos.total;
        }
      },
      error: () => {}
    });
  }

  private cambiarSena(indice: number): void {
    this.indiceSenaActual = indice;
    this.senaActual = this.senasDisponibles[indice];
    this.videosCapturados = 0;
    this.posicionOkDesde = 0;
    this.progresoEstabilidad = 0;
    this.error = null;
    this.actualizarUrlReferencia();
    this.sincronizarConteo();
  }

  siguienteSena(): void {
    if (this.indiceSenaActual < this.senasDisponibles.length - 1) {
      this.cambiarSena(this.indiceSenaActual + 1);
      this.mensaje = `Pasando a: ${this.senaActual!.nombre} (Meta: ${this.metaVideos} videos)`;
    } else {
      this.mensaje = '¡Categoría completa!';
      this.detenerCamara();
    }
  }

  senaAnterior(): void {
    if (this.indiceSenaActual > 0) {
      this.cambiarSena(this.indiceSenaActual - 1);
      this.mensaje = `Volviendo a: ${this.senaActual!.nombre}`;
    }
  }

  seleccionarSena(sena: SenaCategoria): void {
    const indice = this.senasDisponibles.findIndex(s => s.id === sena.id);
    if (indice >= 0) {
      this.cambiarSena(indice);
      this.mensaje = `Seña seleccionada: ${sena.nombre}`;
    }
  }

  capturaMasiva(cantidad: number): void {
    if (!this.manoDetectada) {
      this.error = 'Primero coloca tu mano frente a la cámara';
      return;
    }

    const objetivo = Math.min(cantidad, this.metaVideos - this.totalContado());

    if (objetivo <= 0) {
      this.error = `Ya alcanzaste la meta de ${this.metaVideos} videos`;
      return;
    }

    this.modoAutomaticoPrevioACapturaMasiva = this.modoAutomatico;
    this.modoAutomatico = false;
    this.mensaje = `Iniciando captura rápida de ${objetivo} videos...`;

    let iniciados = 0;

    const terminar = () => {
      this.mensaje = `Captura rápida completada: ${iniciados} videos`;
      this.restaurarModoAutomaticoPostCapturaMasiva();
    };

    const paso = () => {
      if (this.destruido) return;

      if (iniciados >= objetivo || !this.camaraActiva || this.totalContado() >= this.metaVideos) {
        terminar();
        return;
      }

      if (this.grabando || this.enProceso || this.cooldownActivo || this.fase === 'cuenta'
          || this.pendientesSubida >= this.MAX_PENDIENTES) {
        setTimeout(paso, 300);
        return;
      }

      if (!this.manoDetectada) {
        terminar();
        return;
      }

      this.iniciarGrabacionDirecta();

      if (!this.grabando) {
        terminar();
        return;
      }

      iniciados++;
      setTimeout(paso, 300);
    };

    paso();
  }

  private restaurarModoAutomaticoPostCapturaMasiva(): void {
    if (this.modoAutomaticoPrevioACapturaMasiva !== null) {
      this.modoAutomatico = this.modoAutomaticoPrevioACapturaMasiva;
      this.modoAutomaticoPrevioACapturaMasiva = null;
    }
  }

  getPorcentajeCompletado(): number {
    return Math.min(100, (this.videosCapturados / this.metaVideos) * 100);
  }

  getMetaAlcanzada(): boolean {
    return this.videosCapturados >= this.metaVideos;
  }

  private limpiarRecursos(): void {
    this.limpiarTemporizadorGrabacion();

    if (this.streamCaptura) {
      this.streamCaptura.getTracks().forEach((track: any) => track.stop());
      this.streamCaptura = null;
    }

    if (this.streamOriginal) {
      this.streamOriginal.getTracks().forEach((track: any) => track.stop());
      this.streamOriginal = null;
    }

    this.liberarPreview();

    this.recordedChunks = [];
    this.colaSubida = [];
  }
}
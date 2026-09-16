import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CapturaService } from '../../../servicios/captura.service';
import { CategoriaService, Categoria } from '../../../servicios/categoria.service';
import { SenaCategoriaService, SenaCategoria } from '../../../servicios/sena-categoria.service';
import { HandDetectionService } from '../../../servicios/hand-detection.service';
import { Results } from '@mediapipe/hands';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-captura-unificada',
  templateUrl: './captura-unificada.component.html',
  styleUrls: ['./captura-unificada.component.scss'],
  standalone: false
})
export class CapturaUnificadaComponent implements OnInit, OnDestroy, AfterViewInit {
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

  videosCapturados: number = 0;
  metaVideos: number = 20;
  opcionesMetaVideos: number[] = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);

  tiempoGrabacion: number = 0;
  maxTiempoGrabacion: number = 3;
  tiempoInicio: number = 0;
  animationFrameId: number | null = null;

  mediaRecorder: any = null;
  recordedChunks: Blob[] = [];
  streamCaptura: any = null;
  renderFrameId: number | null = null;
  streamOriginal: MediaStream | null = null;

  videoPreviewUrl: SafeUrl | null = null;
  mostrarReferencia: boolean = true;
  imagenCargada: boolean = false;
  imagenError: boolean = false;
  subiendoImagen: boolean = false;

  nuevaSenaTexto: string = '';
  mostrarInputSena: boolean = false;
  editandoSenaId: number | null = null;

  modoAutomatico: boolean = true;
  private framesConsecutivosConMano: number = 0;
  private readonly FRAMES_ESTABLES_REQUERIDOS = 6;
  progresoEstabilidad: number = 0;

  cooldownActivo: boolean = false;
  private readonly COOLDOWN_MS = 1500;

  private modoAutomaticoPrevioACapturaMasiva: boolean | null = null;

  constructor(
    private capturaService: CapturaService,
    private categoriaService: CategoriaService,
    private senaCategoriaService: SenaCategoriaService,
    private handDetectionService: HandDetectionService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarConfiguracion();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    // detenerCamara() dispara el cierre de la cámara y de MediaPipe de
    // forma asíncrona pero no bloqueante (ver HandDetectionService):
    // la navegación no se congela esperando a que termine.
    this.detenerCamara();
    this.limpiarRecursos();
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

  private cargarConfiguracion(): void {
    const configGuardada = localStorage.getItem('configCapturaUnificada');
    if (configGuardada) {
      try {
        const config = JSON.parse(configGuardada);
        if (config.metaVideos && this.opcionesMetaVideos.includes(config.metaVideos)) {
          this.metaVideos = config.metaVideos;
        }
        if (typeof config.modoAutomatico === 'boolean') {
          this.modoAutomatico = config.modoAutomatico;
        }
      } catch (e) {
        console.warn('Error cargando configuración:', e);
      }
    }
  }

  private guardarConfiguracion(): void {
    const config = {
      metaVideos: this.metaVideos,
      categoriaId: this.categoriaSeleccionada?.id,
      modoAutomatico: this.modoAutomatico
    };
    localStorage.setItem('configCapturaUnificada', JSON.stringify(config));
  }

  cargarCategorias(): void {
    this.cargandoCategorias = true;
    this.categoriaService.listarCategorias(true).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.categorias = response.datos.filter(c => c.activa);

          const configGuardada = localStorage.getItem('configCapturaUnificada');
          if (configGuardada) {
            try {
              const config = JSON.parse(configGuardada);
              const categoriaGuardada = this.categorias.find(c => c.id === config.categoriaId);
              if (categoriaGuardada) {
                this.seleccionarCategoria(categoriaGuardada);
              } else if (this.categorias.length > 0) {
                this.seleccionarCategoria(this.categorias[0]);
              }
            } catch (e) {
              if (this.categorias.length > 0) {
                this.seleccionarCategoria(this.categorias[0]);
              }
            }
          } else if (this.categorias.length > 0) {
            this.seleccionarCategoria(this.categorias[0]);
          }
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
    this.cargandoSenas = true;
    this.senaCategoriaService.listarSenas(categoriaId).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senasDisponibles = respuesta.datos.sort((a, b) => a.orden - b.orden);
          if (this.senasDisponibles.length > 0) {
            this.indiceSenaActual = 0;
            this.senaActual = this.senasDisponibles[0];
            this.imagenCargada = false;
            this.imagenError = false;
          } else {
            this.senaActual = null;
            this.indiceSenaActual = 0;
            this.mostrarInputSena = true;
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

    if (this.videosCapturados > this.metaVideos) {
      this.videosCapturados = this.metaVideos;
    }
  }

  toggleModoAutomatico(): void {
    this.modoAutomatico = !this.modoAutomatico;
    this.framesConsecutivosConMano = 0;
    this.progresoEstabilidad = 0;
    this.guardarConfiguracion();
    this.mensaje = this.modoAutomatico
      ? 'Auto-grabación activada: se grabará sola al estabilizar la mano'
      : 'Auto-grabación desactivada: usa el botón "Grabar Video"';
  }

  obtenerRutaReferencia(): string {
    if (!this.senaActual?.archivo_referencia) return '';
    const nombreArchivo = this.senaActual.archivo_referencia.split(/[\\/]/).pop();
    return `${environment.apiUrl.replace('/api/v1', '')}/archivos/senas_referencia/${nombreArchivo}`;
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
    this.senaCategoriaService.subirArchivoReferencia(this.categoriaSeleccionada.id, this.senaActual.id, archivo).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senaActual = respuesta.datos;
          const indice = this.senasDisponibles.findIndex(s => s.id === respuesta.datos.id);
          if (indice >= 0) this.senasDisponibles[indice] = respuesta.datos;
          this.imagenCargada = false;
          this.imagenError = false;
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

    this.senaCategoriaService.eliminarArchivoReferencia(this.categoriaSeleccionada.id, this.senaActual.id).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senaActual = respuesta.datos;
          const indice = this.senasDisponibles.findIndex(s => s.id === respuesta.datos.id);
          if (indice >= 0) this.senasDisponibles[indice] = respuesta.datos;
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
      this.senaCategoriaService.actualizarSena(this.categoriaSeleccionada.id, this.editandoSenaId, { nombre }).subscribe({
        next: (respuesta) => {
          if (respuesta.exito) {
            const indice = this.senasDisponibles.findIndex(s => s.id === this.editandoSenaId);
            if (indice >= 0) this.senasDisponibles[indice] = respuesta.datos;
            this.senaActual = respuesta.datos;
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

    this.senaCategoriaService.crearSena(this.categoriaSeleccionada.id, { nombre, orden: maxOrden + 1 }).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.senasDisponibles.push(respuesta.datos);
          this.senaActual = respuesta.datos;
          this.indiceSenaActual = this.senasDisponibles.length - 1;
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

    this.senaCategoriaService.eliminarSena(this.categoriaSeleccionada.id, sena.id).subscribe({
      next: () => {
        const indice = this.senasDisponibles.findIndex(s => s.id === sena.id);
        if (indice >= 0) this.senasDisponibles.splice(indice, 1);

        if (this.senaActual?.id === sena.id) {
          if (this.senasDisponibles.length > 0) {
            this.indiceSenaActual = 0;
            this.senaActual = this.senasDisponibles[0];
          } else {
            this.senaActual = null;
            this.indiceSenaActual = 0;
            this.mostrarInputSena = true;
          }
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

      await this.handDetectionService.iniciarDeteccion(
        video,
        canvas,
        (results: Results) => this.onHandsDetected(results)
      );

      this.camaraActiva = true;
      this.deteccionActiva = true;
      this.framesConsecutivosConMano = 0;
      this.progresoEstabilidad = 0;
      this.mensaje = this.modoAutomatico
        ? 'Cámara iniciada. Auto-grabación activa: mantén la mano estable para grabar'
        : 'Cámara iniciada con detección de manos activa';
      this.error = null;

    } catch (error) {
      console.error('Error iniciando cámara:', error);
      this.error = 'No se pudo acceder a la cámara. Asegúrate de permitir el acceso.';
      this.camaraActiva = false;
    }
  }

  onHandsDetected(results: Results): void {
    this.manoDetectada = this.handDetectionService.verificarManoDetectada(results);
    this.numeroManos = results.multiHandLandmarks?.length || 0;

    if (this.manoDetectada && !this.grabando && this.senaActual) {
      this.mensaje = `Mano detectada. Listo para grabar "${this.senaActual.nombre}"`;
    }

    if (this.modoAutomatico) {
      this.evaluarAutoGrabacion();
    }
  }

  private evaluarAutoGrabacion(): void {
    if (this.grabando || this.cooldownActivo || !this.senaActual || !this.camaraActiva) {
      this.framesConsecutivosConMano = 0;
      this.progresoEstabilidad = 0;
      return;
    }

    if (this.videosCapturados >= this.metaVideos) {
      this.progresoEstabilidad = 0;
      return;
    }

    if (this.manoDetectada) {
      this.framesConsecutivosConMano++;
      this.progresoEstabilidad = Math.min(
        100,
        Math.round((this.framesConsecutivosConMano / this.FRAMES_ESTABLES_REQUERIDOS) * 100)
      );

      if (this.framesConsecutivosConMano >= this.FRAMES_ESTABLES_REQUERIDOS) {
        this.framesConsecutivosConMano = 0;
        this.progresoEstabilidad = 0;
        this.iniciarGrabacion();
      }
    } else {
      this.framesConsecutivosConMano = 0;
      this.progresoEstabilidad = 0;
    }
  }

  private activarCooldown(): void {
    this.cooldownActivo = true;
    setTimeout(() => {
      this.cooldownActivo = false;
    }, this.COOLDOWN_MS);
  }

  detenerCamara(): void {
    if (this.grabando) {
      this.detenerGrabacion();
    }

    // No se espera esta promesa a propósito: el cierre de MediaPipe
    // ahora es rápido y seguro (ver HandDetectionService), y no
    // queremos bloquear la navegación ni este método por eso.
    this.handDetectionService.detenerDeteccion().catch(() => {
      // Cualquier error de cierre ya quedó logueado dentro del servicio.
    });

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
    this.framesConsecutivosConMano = 0;
    this.progresoEstabilidad = 0;
    this.mensaje = 'Cámara detenida correctamente';
  }

  iniciarGrabacion(): void {
    if (!this.categoriaSeleccionada) {
      this.error = 'Primero selecciona una categoría';
      return;
    }

    if (!this.camaraActiva) {
      this.error = 'Primero inicia la cámara';
      return;
    }

    if (!this.manoDetectada) {
      this.error = 'No se detecta ninguna mano. Coloca tu mano frente a la cámara';
      return;
    }

    if (!this.senaActual) {
      this.error = 'Primero ingresa o selecciona una seña';
      return;
    }

    if (this.videosCapturados >= this.metaVideos) {
      this.error = `Ya alcanzaste la meta de ${this.metaVideos} videos para "${this.senaActual.nombre}"`;
      return;
    }

    if (this.grabando) {
      return;
    }

    this.grabando = true;
    this.tiempoGrabacion = 0;
    this.recordedChunks = [];
    this.tiempoInicio = performance.now();
    this.error = null;

    try {
      this.streamCaptura = this.streamOriginal;

      const mimeType = this.obtenerMejorMimeType();

      const options = {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000
      };

      this.mediaRecorder = new (window as any).MediaRecorder(this.streamCaptura, options);

      this.mediaRecorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length === 0) {
          this.error = 'No se capturaron datos de video';
          this.activarCooldown();
          return;
        }

        const blob = new Blob(this.recordedChunks, { type: mimeType });

        if (this.videoPreviewUrl && typeof this.videoPreviewUrl === 'string') {
          URL.revokeObjectURL(this.videoPreviewUrl as string);
        }

        const objectURL = URL.createObjectURL(blob);
        this.videoPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(objectURL);

        this.guardarVideo(blob);

        this.streamCaptura = null;
        this.activarCooldown();
      };

      this.mediaRecorder.start(100);
      this.actualizarTemporizador();

      this.mensaje = `Grabando "${this.senaActual.nombre}"... (${this.tiempoGrabacion}s)`;

    } catch (error) {
      console.error('Error iniciando grabación:', error);
      this.error = 'Error al iniciar la grabación. Intenta nuevamente.';
      this.grabando = false;
    }
  }

  private actualizarTemporizador(): void {
    const actualizar = () => {
      if (!this.grabando) {
        this.animationFrameId = null;
        return;
      }

      const tiempoTranscurrido = (performance.now() - this.tiempoInicio) / 1000;
      this.tiempoGrabacion = Math.floor(tiempoTranscurrido * 10) / 10;

      this.mensaje = `Grabando "${this.senaActual?.nombre}"... (${this.tiempoGrabacion.toFixed(1)}s)`;

      if (this.tiempoGrabacion >= this.maxTiempoGrabacion) {
        this.detenerGrabacion();
        return;
      }

      this.animationFrameId = requestAnimationFrame(actualizar);
    };

    this.animationFrameId = requestAnimationFrame(actualizar);
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

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('Error deteniendo MediaRecorder:', error);
      }
    }

    this.mensaje = 'Grabación finalizada, procesando video...';
  }

  guardarVideo(videoBlob: Blob): void {
    if (!this.categoriaSeleccionada || !this.senaActual) return;

    const formData = new FormData();
    const timestamp = new Date().getTime();

    let extension = '.webm';
    let tipoReal = videoBlob.type.toLowerCase();

    if (tipoReal.includes('mp4') || tipoReal.includes('h264') || tipoReal.includes('avc1')) {
      extension = '.mp4';
    }

    const filename = `${this.senaActual.nombre}_${timestamp}${extension}`;

    formData.append('archivo', videoBlob, filename);
    formData.append('categoria_id', this.categoriaSeleccionada.id.toString());
    formData.append('sena', this.senaActual.nombre);

    this.mensaje = 'Enviando video al servidor...';

    this.capturaService.capturarVideoArchivo(formData).subscribe({
      next: (response) => {
        if (response.exito) {
          this.videosCapturados++;
          const videosRestantes = this.metaVideos - this.videosCapturados;

          this.mensaje = `Video ${this.videosCapturados}/${this.metaVideos} de "${this.senaActual!.nombre}" guardado`;

          if (response.datos) {
            const videoData = response.datos;
            this.mensaje += ` | Frames: ${videoData.frames_extraidos}`;
          }

          if (videosRestantes > 0) {
            this.mensaje += ` | Faltan: ${videosRestantes} videos`;
          }

          if (this.videosCapturados >= this.metaVideos) {
            setTimeout(() => {
              this.mensaje = `Meta completada para "${this.senaActual?.nombre}" (${this.metaVideos} videos)`;
            }, 1000);
          }
        } else {
          this.error = `Error: ${response.mensaje || 'Error al guardar video'}`;
        }
      },
      error: (err) => {
        console.error('Error completo:', err);
        let errorMsg = 'Error al guardar video';

        if (err.error?.detail) {
          errorMsg += `: ${err.error.detail}`;
        } else if (err.error?.mensaje) {
          errorMsg += `: ${err.error.mensaje}`;
        }

        this.error = errorMsg;
      }
    });
  }

  siguienteSena(): void {
    if (this.indiceSenaActual < this.senasDisponibles.length - 1) {
      this.indiceSenaActual++;
      this.senaActual = this.senasDisponibles[this.indiceSenaActual];
      this.videosCapturados = 0;
      this.imagenCargada = false;
      this.imagenError = false;
      this.framesConsecutivosConMano = 0;
      this.progresoEstabilidad = 0;
      this.mensaje = `Pasando a: ${this.senaActual.nombre} (Meta: ${this.metaVideos} videos)`;
      this.error = null;
    } else {
      this.mensaje = '¡Categoría completa!';
      this.detenerCamara();
    }
  }

  senaAnterior(): void {
    if (this.indiceSenaActual > 0) {
      this.indiceSenaActual--;
      this.senaActual = this.senasDisponibles[this.indiceSenaActual];
      this.videosCapturados = 0;
      this.imagenCargada = false;
      this.imagenError = false;
      this.framesConsecutivosConMano = 0;
      this.progresoEstabilidad = 0;
      this.mensaje = `Volviendo a: ${this.senaActual.nombre}`;
      this.error = null;
    }
  }

  seleccionarSena(sena: SenaCategoria): void {
    const indice = this.senasDisponibles.findIndex(s => s.id === sena.id);
    if (indice >= 0) {
      this.indiceSenaActual = indice;
      this.senaActual = sena;
      this.videosCapturados = 0;
      this.imagenCargada = false;
      this.imagenError = false;
      this.framesConsecutivosConMano = 0;
      this.progresoEstabilidad = 0;
      this.mensaje = `Seña seleccionada: ${sena.nombre}`;
      this.error = null;
    }
  }

  capturaMasiva(cantidad: number): void {
    if (!this.manoDetectada) {
      this.error = 'Primero coloca tu mano frente a la cámara';
      return;
    }

    const videosPosibles = Math.min(cantidad, this.metaVideos - this.videosCapturados);

    if (videosPosibles <= 0) {
      this.error = `Ya alcanzaste la meta de ${this.metaVideos} videos`;
      return;
    }

    this.modoAutomaticoPrevioACapturaMasiva = this.modoAutomatico;
    this.modoAutomatico = false;

    this.mensaje = `Iniciando captura rápida de ${videosPosibles} videos...`;

    let contador = 0;
    const capturarSiguiente = () => {
      if (contador >= videosPosibles || !this.manoDetectada || !this.camaraActiva || this.videosCapturados >= this.metaVideos) {
        this.mensaje = `Captura rápida completada: ${contador} videos`;
        this.restaurarModoAutomaticoPostCapturaMasiva();
        return;
      }

      this.iniciarGrabacion();
      contador++;

      setTimeout(() => {
        capturarSiguiente();
      }, (this.maxTiempoGrabacion + 2) * 1000);
    };

    capturarSiguiente();
  }

  private restaurarModoAutomaticoPostCapturaMasiva(): void {
    if (this.modoAutomaticoPrevioACapturaMasiva !== null) {
      this.modoAutomatico = this.modoAutomaticoPrevioACapturaMasiva;
      this.modoAutomaticoPrevioACapturaMasiva = null;
    }
  }

  getPorcentajeCompletado(): number {
    return (this.videosCapturados / this.metaVideos) * 100;
  }

  getMetaAlcanzada(): boolean {
    return this.videosCapturados >= this.metaVideos;
  }

  private limpiarRecursos(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }

    if (this.streamCaptura) {
      this.streamCaptura.getTracks().forEach((track: any) => track.stop());
      this.streamCaptura = null;
    }

    if (this.streamOriginal) {
      this.streamOriginal.getTracks().forEach((track: any) => track.stop());
      this.streamOriginal = null;
    }

    if (this.videoPreviewUrl && typeof this.videoPreviewUrl === 'string') {
      URL.revokeObjectURL(this.videoPreviewUrl as string);
    }

    this.recordedChunks = [];
  }
}
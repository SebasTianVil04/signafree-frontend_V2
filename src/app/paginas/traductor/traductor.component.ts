import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  TraductorService,
  ConfiguracionTraduccion,
  RespuestaAPI,
  ModeloActivoTraductor,
} from '../../servicios/traductor.service';
import { HandDetectionService } from '../../servicios/hand-detection.service';
import { RecursosSenasService, RecursoSena } from '../../servicios/recursos-senas.service';
import { ReconocimientoService } from '../../servicios/reconocimiento.service';

@Component({
  selector: 'app-traductor',
  templateUrl: './traductor.component.html',
  styleUrls: ['./traductor.component.scss'],
  standalone: false,
})
export class TraductorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;

  modoActual: 'voz-a-senas' | 'senas-a-texto' = 'voz-a-senas';
  camaraActiva = false;
  procesando = false;
  error: string | null = null;
  escuchando = false;
  textoManual = '';

  soporteNavegador = { voz: false, sintesis: false, camara: false };

  configuracion: ConfiguracionTraduccion = {
    activarAudio: true,
    confianza_minima: 0.25,
    velocidadReproduccion: 2000,
    modelo_id: null,
  };

  // Selección de modelo (null = automático: todos los activos)
  modelosActivos: ModeloActivoTraductor[] = [];
  modeloSeleccionadoId: number | null = null;
  cargandoModelos = false;

  senasVisuales: RecursoSena[] = [];
  indiceActual = 0;
  reproduciendo = false;
  intervaloReproduccion: any = null;
  resultadoReconocimiento: any = null;
  textoReconocido = '';
  historicoLetras: string[] = [];

  stream: MediaStream | null = null;
  manoDetectada = false;
  confianzaDeteccion = 0;

  reconocimientoContinuo = false;

  letraEnVivo = '';
  confianzaEnVivo = 0;

  private framesBuffer: string[] = [];
  private readonly MAX_FRAMES_BUFFER = 16;
  private capturaManualActiva = false;
  private reconocimientoContinuoSubscription?: Subscription;

  private readonly LETRAS_ESTABLES_REQUERIDAS = 1;
  private readonly COOLDOWN_LETRAS_MS = 500;
  private readonly CONFIANZA_MINIMA_CONTINUO = 0.30;
  private readonly FRAMES_SIN_MANO_TOLERADOS = 6;

  private letraCandidata = '';
  private contadorLetraCandidata = 0;
  private ultimaLetraTimestamp = 0;
  private framesSinManoContinuo = 0;

  private ultimaLetraConfirmada = '';
  private bloqueoRepeticion = false;

  private ultimosSlotsMP: any[] = [[], []];

  private frameCanvas: HTMLCanvasElement | null = null;
  private frameCtx: CanvasRenderingContext2D | null = null;
  private readonly FRAME_CAPTURE_SIZE = 320;

  private colaVoz: string[] = [];
  private hablandoVoz = false;

  constructor(
    private traductorSvc: TraductorService,
    private handDetectionSvc: HandDetectionService,
    private reconocimientoSvc: ReconocimientoService,
    private recursosSvc: RecursosSenasService,
    private ngZone: NgZone
  ) {
    this.verificarSoporteNavegador();
    this.configurarReconocimientoContinuo();
  }

  ngOnInit(): void {
    // Al entrar a la vista siempre se parte en modo automático
    this.reconocimientoSvc.establecerModelo(null);
    this.cargarModelosActivos();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.detenerCamara();
    this.detenerReproduccion();
    this.detenerReconocimientoContinuo();
    this.reconocimientoSvc.detenerReconocimiento();
    // El servicio es singleton: no dejar el modelo elegido aquí "pegado" para otras vistas
    this.reconocimientoSvc.establecerModelo(null);
    this.reconocimientoContinuoSubscription?.unsubscribe();
    this.detenerColaVoz();
  }

  // ---------------------------------------------------------------------------
  // Selección de modelo
  // ---------------------------------------------------------------------------

  cargarModelosActivos(): void {
    this.cargandoModelos = true;

    this.traductorSvc.obtenerModelosActivos().subscribe({
      next: (res: RespuestaAPI) => {
        this.modelosActivos = res.exito && Array.isArray(res.datos?.modelos)
          ? res.datos.modelos
          : [];

        // Si el modelo elegido ya no está activo, volver a automático
        if (
          this.modeloSeleccionadoId !== null &&
          !this.modelosActivos.some(m => m.id === this.modeloSeleccionadoId)
        ) {
          this.aplicarModelo(null);
        }

        this.cargandoModelos = false;
      },
      error: (err) => {
        this.modelosActivos = [];
        this.cargandoModelos = false;
        this.error = err.message || 'No se pudieron cargar los modelos activos';
      },
    });
  }

  seleccionarModelo(valor: string): void {
    const id = valor ? Number(valor) : null;
    this.aplicarModelo(id !== null && !isNaN(id) ? id : null);
  }

  private aplicarModelo(id: number | null): void {
    this.modeloSeleccionadoId = id;
    this.configuracion = { ...this.configuracion, modelo_id: id };
    this.reconocimientoSvc.establecerModelo(id);
    this.resetearEstadoContinuo();
  }

  get modeloSeleccionado(): ModeloActivoTraductor | null {
    if (this.modeloSeleccionadoId === null) return null;
    return this.modelosActivos.find(m => m.id === this.modeloSeleccionadoId) ?? null;
  }

  etiquetaModelo(m: ModeloActivoTraductor): string {
    const acc = Math.round((m.accuracy || 0) * 100);
    return `${m.nombre} · ${acc}% · ${m.num_clases} clases`;
  }

  // ---------------------------------------------------------------------------

  cambiarModo(nuevo: 'voz-a-senas' | 'senas-a-texto'): void {
    this.modoActual = nuevo;
    this.limpiarResultados();
    this.error = null;

    if (nuevo === 'voz-a-senas' && this.camaraActiva) {
      this.detenerCamara();
    }
  }

  private limpiarResultados(): void {
    this.detenerReproduccion();
    this.senasVisuales = [];
    this.indiceActual = 0;
    this.resultadoReconocimiento = null;
    this.textoReconocido = '';
    this.historicoLetras = [];
    this.framesBuffer = [];
    this.capturaManualActiva = false;
    this.resetearEstadoContinuo();
  }

  private resetearEstadoContinuo(): void {
    this.letraCandidata = '';
    this.contadorLetraCandidata = 0;
    this.ultimaLetraTimestamp = 0;
    this.framesSinManoContinuo = 0;
    this.letraEnVivo = '';
    this.confianzaEnVivo = 0;
    this.ultimaLetraConfirmada = '';
    this.bloqueoRepeticion = false;
  }

  iniciarReconocimientoVoz(): void {
    this.error = null;
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.error = 'Reconocimiento de voz no soportado en este navegador';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (e: any) => {
      this.ngZone.run(() => {
        const resultado = e.results[e.results.length - 1];
        const textoReconocido = resultado[0].transcript;
        this.textoManual = textoReconocido;

        if (resultado.isFinal) {
          this.escuchando = false;
          setTimeout(() => this.traducirVozASenas(), 100);
        }
      });
    };

    recognition.onerror = (e: any) => {
      this.error = `Error: ${e.error === 'no-speech' ? 'No se detectó voz' : e.error}`;
      this.escuchando = false;
    };

    recognition.onend = () => {
      this.escuchando = false;
    };

    try {
      recognition.start();
      this.escuchando = true;
    } catch (err: any) {
      this.error = 'No se pudo iniciar el reconocimiento de voz';
      this.escuchando = false;
    }
  }

  traducirVozASenas(): void {
    if (!this.textoManual.trim()) {
      this.error = 'Escribe algo para traducir';
      return;
    }

    this.procesando = true;
    this.error = null;
    this.detenerReproduccion();

    this.traductorSvc.traducirVozASenas(this.textoManual).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.procesarTraduccionVoz(response.datos);
        } else {
          this.error = response.mensaje || 'Error en la traducción';
          this.procesando = false;
        }
      },
      error: (err) => {
        this.error = err.message || 'Error al conectar con el servidor';
        this.procesando = false;
      },
    });
  }

  private procesarTraduccionVoz(datos: any): void {
    try {
      this.senasVisuales = this.recursosSvc.textoASenas(this.textoManual);
      if (this.senasVisuales.length === 0) {
        this.error = 'No se encontraron recursos visuales para este texto';
        this.procesando = false;
        return;
      }
      this.indiceActual = 0;
      this.procesando = false;
      this.iniciarReproduccion();
    } catch (err: any) {
      this.error = `Error al traducir: ${err.message}`;
      this.procesando = false;
    }
  }

  iniciarReproduccion(): void {
    if (this.senasVisuales.length === 0) return;
    this.reproduciendo = true;
    this.indiceActual = 0;

    this.intervaloReproduccion = setInterval(() => {
      this.indiceActual++;
      if (this.indiceActual >= this.senasVisuales.length) {
        this.detenerReproduccion();
      }
    }, this.configuracion.velocidadReproduccion || 2000);
  }

  detenerReproduccion(): void {
    this.reproduciendo = false;
    if (this.intervaloReproduccion) {
      clearInterval(this.intervaloReproduccion);
      this.intervaloReproduccion = null;
    }
  }

  irASena(indice: number): void {
    if (indice >= 0 && indice < this.senasVisuales.length) {
      this.indiceActual = indice;
      this.detenerReproduccion();
    }
  }

  siguiente(): void {
    if (this.indiceActual < this.senasVisuales.length - 1) {
      this.indiceActual++;
    }
  }

  anterior(): void {
    if (this.indiceActual > 0) {
      this.indiceActual--;
    }
  }

  async iniciarCamara(): Promise<void> {
    this.error = null;

    if (!this.soporteNavegador.camara) {
      this.error = 'Tu navegador no soporta acceso a la cámara';
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      video.srcObject = this.stream;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            resolve();
          });
        };
      });

      this.camaraActiva = true;
      setTimeout(() => this.inicializarDeteccionManos(), 500);
    } catch (err: any) {
      this.error = `Error al acceder a la cámara: ${err.message}`;
      this.camaraActiva = false;
    }
  }

  private async inicializarDeteccionManos(): Promise<void> {
    try {
      await this.handDetectionSvc.iniciarDeteccion(
        this.videoElement.nativeElement,
        this.canvasElement.nativeElement,
        (results: any) => {
          this.manoDetectada = this.handDetectionSvc.verificarManoDetectada(results);
          this.ultimosSlotsMP = this.handDetectionSvc.obtenerLandmarksConSlotsFijos(results);

          const hayMano = this.ultimosSlotsMP.some(s => Array.isArray(s) && s.length >= 21);

          if (this.manoDetectada && hayMano) {
            this.framesSinManoContinuo = 0;

            if (this.reconocimientoContinuo) {
              this.capturarFrameParaBuffer();
            }
          } else {
            this.confianzaDeteccion = 0;

            if (this.reconocimientoContinuo) {
              this.framesSinManoContinuo++;

              if (this.framesSinManoContinuo >= this.FRAMES_SIN_MANO_TOLERADOS) {
                this.reconocimientoSvc.limpiarBuffer();
                this.letraCandidata = '';
                this.contadorLetraCandidata = 0;
                this.bloqueoRepeticion = false;
              }
            }
          }
        }
      );
    } catch (err) {
      this.error = 'Error al inicializar detección de manos';
    }
  }

  private calcularEncuadreLetterbox(video: HTMLVideoElement, tamano: number) {
    const anchoVideo = video.videoWidth || 640;
    const altoVideo = video.videoHeight || 480;
    const escala = Math.min(tamano / anchoVideo, tamano / altoVideo);
    const anchoDestino = Math.max(1, Math.round(anchoVideo * escala));
    const altoDestino = Math.max(1, Math.round(altoVideo * escala));
    const offsetX = Math.floor((tamano - anchoDestino) / 2);
    const offsetY = Math.floor((tamano - altoDestino) / 2);
    return { anchoDestino, altoDestino, offsetX, offsetY };
  }

  private obtenerCanvasReutilizable(): CanvasRenderingContext2D | null {
    if (!this.frameCanvas) {
      this.frameCanvas = document.createElement('canvas');
      this.frameCanvas.width = this.FRAME_CAPTURE_SIZE;
      this.frameCanvas.height = this.FRAME_CAPTURE_SIZE;
      this.frameCtx = this.frameCanvas.getContext('2d');
    }
    return this.frameCtx;
  }

  private capturarFrameParaBuffer(): void {
    if (!this.camaraActiva || this.procesando) return;

    const video = this.videoElement.nativeElement;
    const TAMANO = this.FRAME_CAPTURE_SIZE;
    const ctx = this.obtenerCanvasReutilizable();
    if (!ctx) return;

    const { anchoDestino, altoDestino, offsetX, offsetY } = this.calcularEncuadreLetterbox(video, TAMANO);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, TAMANO, TAMANO);
    ctx.drawImage(video, offsetX, offsetY, anchoDestino, altoDestino);

    const base64 = ctx.canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    this.framesBuffer.push(base64);
    if (this.framesBuffer.length > this.MAX_FRAMES_BUFFER) {
      this.framesBuffer.shift();
    }

    const landmarksSimplificados = this.handDetectionSvc.convertirSlotsASimplificados(this.ultimosSlotsMP);

    this.reconocimientoSvc.agregarFrame(base64, landmarksSimplificados);
  }

  capturarYReconocer(): void {
    if (!this.camaraActiva) {
      this.error = 'La cámara no está activa';
      return;
    }
    if (this.capturaManualActiva) {
      return;
    }

    this.error = null;
    this.procesando = true;
    this.capturaManualActiva = true;

    const frames: string[] = [];
    const framesLandmarks: any[][] = [];
    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    const CAPTURE_SIZE = 320;
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.error = 'No se pudo obtener el contexto del canvas';
      this.procesando = false;
      this.capturaManualActiva = false;
      return;
    }

    const { anchoDestino, altoDestino, offsetX, offsetY } = this.calcularEncuadreLetterbox(video, CAPTURE_SIZE);

    let count = 0;
    const MAX_FRAMES = 12;
    const INTERVAL_MS = 120;

    const interval = setInterval(() => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
      ctx.drawImage(video, offsetX, offsetY, anchoDestino, altoDestino);

      const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      frames.push(base64);

      const slotsActuales = this.ultimosSlotsMP;
      const hayMano = slotsActuales.some(s => Array.isArray(s) && s.length >= 21);
      const landmarksActuales = hayMano
        ? this.handDetectionSvc.convertirSlotsASimplificados(slotsActuales)
        : [[], []];
      framesLandmarks.push(landmarksActuales);

      count++;

      if (count >= MAX_FRAMES) {
        clearInterval(interval);

        // this.configuracion ya lleva modelo_id (null = automático)
        this.traductorSvc.traducirSenasATextoConFrames(frames, framesLandmarks, this.configuracion).subscribe({
          next: (res: RespuestaAPI) => {
            this.procesarResultadoReconocimiento(res);
            this.capturaManualActiva = false;
          },
          error: (err) => {
            this.error = err.message || 'Error en el reconocimiento';
            this.procesando = false;
            this.capturaManualActiva = false;
          },
        });
      }
    }, INTERVAL_MS);
  }

  private procesarResultadoReconocimiento(res: RespuestaAPI): void {
    this.procesando = false;
    if (res.exito && res.datos) {
      this.resultadoReconocimiento = res.datos;

      const letra = res.datos?.texto_traducido || res.datos?.sena_detectada || '?';

      if (letra !== '?' && letra !== 'desconocido') {
        this.historicoLetras.push(letra);
        this.textoReconocido = this.historicoLetras.join('');

        if (this.configuracion.activarAudio) {
          this.reproducirLetraPorVoz(letra);
        }
      } else {
        this.error = 'No se pudo reconocer la seña (confianza baja)';
      }

      if (res.datos?.confianza !== undefined) {
        this.confianzaDeteccion = res.datos.confianza;
      }
      this.error = null;
    } else {
      this.error = res.mensaje || 'No se pudo reconocer la seña';
    }
  }

  private configurarReconocimientoContinuo(): void {
    this.reconocimientoContinuoSubscription = this.reconocimientoSvc.resultado$.subscribe({
      next: (resultado) => {
        if (this.reconocimientoContinuo && resultado?.sena_detectada) {
          this.ngZone.run(() => {
            this.procesarResultadoContinuo(resultado);
          });
        }
      },
      error: () => { },
    });

    this.reconocimientoContinuoSubscription.add(
      this.reconocimientoSvc.confianza$.subscribe(() => { })
    );
  }

  private procesarResultadoContinuo(resultado: any): void {
    const confianza = resultado.confianza || 0;
    const letra = (resultado.sena_detectada || '').trim().toUpperCase();

    this.letraEnVivo = letra;
    this.confianzaEnVivo = confianza;

    if (!letra || letra === 'DESCONOCIDO' || letra === '?' || confianza < this.CONFIANZA_MINIMA_CONTINUO) {
      this.letraCandidata = '';
      this.contadorLetraCandidata = 0;
      this.bloqueoRepeticion = false;
      return;
    }

    this.resultadoReconocimiento = resultado;
    this.confianzaDeteccion = confianza;

    if (letra !== this.ultimaLetraConfirmada) {
      this.bloqueoRepeticion = false;
    }

    if (letra === this.letraCandidata) {
      this.contadorLetraCandidata++;
    } else {
      this.letraCandidata = letra;
      this.contadorLetraCandidata = 1;
    }

    if (this.contadorLetraCandidata < this.LETRAS_ESTABLES_REQUERIDAS) {
      return;
    }

    if (letra === this.ultimaLetraConfirmada && this.bloqueoRepeticion) {
      return;
    }

    const ahora = Date.now();
    if (ahora - this.ultimaLetraTimestamp < this.COOLDOWN_LETRAS_MS) {
      return;
    }

    this.ultimaLetraTimestamp = ahora;
    this.ultimaLetraConfirmada = letra;
    this.bloqueoRepeticion = true;
    this.letraCandidata = '';
    this.contadorLetraCandidata = 0;

    this.historicoLetras.push(letra);
    this.textoReconocido = this.historicoLetras.join('');

    if (this.configuracion.activarAudio) {
      this.reproducirLetraPorVoz(letra);
    }
  }

  private reproducirLetraPorVoz(texto: string): void {
    if (!window.speechSynthesis) return;

    if (this.colaVoz.length >= 5) {
      this.colaVoz.shift();
    }
    this.colaVoz.push(texto);
    this.procesarColaVoz();
  }

  private procesarColaVoz(): void {
    if (this.hablandoVoz || this.colaVoz.length === 0 || !window.speechSynthesis) {
      return;
    }

    const texto = this.colaVoz.shift()!;
    this.hablandoVoz = true;

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-PE';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      this.hablandoVoz = false;
      this.procesarColaVoz();
    };

    utterance.onerror = () => {
      this.hablandoVoz = false;
      this.procesarColaVoz();
    };

    window.speechSynthesis.speak(utterance);
  }

  private detenerColaVoz(): void {
    this.colaVoz = [];
    this.hablandoVoz = false;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  toggleReconocimientoContinuo(): void {
    if (this.reconocimientoContinuo) {
      this.detenerReconocimientoContinuo();
    } else {
      this.iniciarReconocimientoContinuo();
    }
  }

  private iniciarReconocimientoContinuo(): void {
    if (!this.camaraActiva) {
      this.error = 'Primero debes iniciar la cámara';
      return;
    }
    this.resetearEstadoContinuo();
    this.reconocimientoContinuo = true;
    this.reconocimientoSvc.iniciarReconocimiento();
  }

  private detenerReconocimientoContinuo(): void {
    this.reconocimientoContinuo = false;
    this.resetearEstadoContinuo();
    this.reconocimientoSvc.detenerReconocimiento();
  }

  probarConexionServidor(): void {
    this.traductorSvc.obtenerEstadoReconocedor().subscribe({
      next: (estado) => {
        alert(`Servidor conectado: ${estado.estado}\nModelo: ${estado.arquitectura}`);
      },
      error: (err) => {
        alert('Error conectando al servidor: ' + err.message);
      },
    });
  }

  limpiarTexto(): void {
    this.historicoLetras = [];
    this.textoReconocido = '';
    this.resultadoReconocimiento = null;
    this.resetearEstadoContinuo();
  }

  borrarUltima(): void {
    if (this.historicoLetras.length > 0) {
      this.historicoLetras.pop();
      this.textoReconocido = this.historicoLetras.join('');
    } else {
      this.textoReconocido = '';
    }
  }

  detenerCamara(): void {
    this.detenerReconocimientoContinuo();
    this.handDetectionSvc.detenerDeteccion();
    this.reconocimientoSvc.detenerReconocimiento();
    this.detenerColaVoz();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement?.nativeElement) {
      const videoEl = this.videoElement.nativeElement;
      videoEl.srcObject = null;
      videoEl.pause();
      videoEl.load();
    }

    this.camaraActiva = false;
    this.manoDetectada = false;
    this.confianzaDeteccion = 0;
    this.framesBuffer = [];
    this.capturaManualActiva = false;
    this.ultimosSlotsMP = [[], []];
    this.resetearEstadoContinuo();
  }

  obtenerClaseConfianza(confianza: number): string {
    if (confianza >= 0.7) return 'bg-success';
    if (confianza >= 0.5) return 'bg-warning text-dark';
    return 'bg-danger';
  }

  verificarSoporteNavegador(): void {
    this.soporteNavegador = this.traductorSvc.validarSoporteNavegador();
  }

  get senaActual(): RecursoSena | null {
    return this.senasVisuales[this.indiceActual] || null;
  }

  get progreso(): number {
    if (this.senasVisuales.length === 0) return 0;
    return ((this.indiceActual + 1) / this.senasVisuales.length) * 100;
  }
}
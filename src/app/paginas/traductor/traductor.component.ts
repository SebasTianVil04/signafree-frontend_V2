import {
  Component,
  ElementRef,
  ViewChild,
  OnDestroy,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { TraductorService, ConfiguracionTraduccion, RespuestaAPI } from '../../servicios/traductor.service';
import { HandDetectionService } from '../../servicios/hand-detection.service';
import { RecursosSenasService, RecursoSena } from '../../servicios/recursos-senas.service';
import { ReconocimientoService } from '../../servicios/reconocimiento.service';

@Component({
  selector: 'app-traductor',
  templateUrl: './traductor.component.html',
  styleUrls: ['./traductor.component.scss'],
  standalone: false,
})
export class TraductorComponent implements OnDestroy, AfterViewInit {
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
  };

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

  private framesBuffer: string[] = [];
  private readonly MAX_FRAMES_BUFFER = 16;
  private capturaManualActiva = false;

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

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.detenerCamara();
    this.detenerReproduccion();
    this.detenerReconocimientoContinuo();
    this.reconocimientoSvc.detenerReconocimiento();
  }

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
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.confianzaDeteccion = results.multiHandedness?.[0]?.score || 0;
            if (this.reconocimientoContinuo && this.manoDetectada) {
              this.capturarFrameParaBuffer();
            }
          } else {
            this.confianzaDeteccion = 0;
          }
        }
      );
    } catch (err) {
      this.error = 'Error al inicializar detección de manos';
    }
  }

  private capturarFrameParaBuffer(): void {
    if (!this.camaraActiva || this.procesando) return;

    const canvas = document.createElement('canvas');
    const video = this.videoElement.nativeElement;
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 224, 224);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    this.framesBuffer.push(base64);
    if (this.framesBuffer.length > this.MAX_FRAMES_BUFFER) {
      this.framesBuffer.shift();
    }

    this.reconocimientoSvc.agregarFrame(base64);
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

    let count = 0;
    const MAX_FRAMES = 12;
    const INTERVAL_MS = 120;

    const interval = setInterval(() => {
      ctx.drawImage(video, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

      const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      frames.push(base64);
      count++;

      if (count >= MAX_FRAMES) {
        clearInterval(interval);

        this.traductorSvc.traducirSenasATextoConFrames(frames, this.configuracion).subscribe({
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
          this.traductorSvc.sintetizarVoz(letra, { velocidad: 1.0 });
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
    this.reconocimientoSvc.resultado$.subscribe({
      next: (resultado) => {
        if (this.reconocimientoContinuo && resultado?.sena_detectada) {
          this.ngZone.run(() => {
            this.procesarResultadoContinuo(resultado);
          });
        }
      },
      error: (err) => {
        console.error('Error en reconocimiento continuo:', err);
      },
    });

    this.reconocimientoSvc.confianza$.subscribe(() => { });
  }

  private procesarResultadoContinuo(resultado: any): void {
    const confianza = resultado.confianza || 0;
    if (confianza >= (this.configuracion.confianza_minima || 0.25)) {
      this.resultadoReconocimiento = resultado;
      const letra = resultado.sena_detectada;
      if (letra && letra !== 'desconocido' && letra !== '?' && letra !== this.textoReconocido) {
        this.textoReconocido = letra;
        if (this.configuracion.activarAudio) {
          this.traductorSvc.sintetizarVoz(letra, { velocidad: 1.0 });
        }
      }
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
    this.reconocimientoContinuo = true;
    this.reconocimientoSvc.iniciarReconocimiento();
  }

  private detenerReconocimientoContinuo(): void {
    this.reconocimientoContinuo = false;
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
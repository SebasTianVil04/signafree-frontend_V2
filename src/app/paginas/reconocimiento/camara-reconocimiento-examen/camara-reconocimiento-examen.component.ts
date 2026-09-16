import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input, Output, EventEmitter, ChangeDetectorRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { ReconocimientoService, ResultadoReconocimientoVideo } from '../../../servicios/reconocimiento.service';
import { CategoriaService, Categoria } from '../../../servicios/categoria.service';
import { Subscription } from 'rxjs';
import { obtenerConfiguracionTiempo, ConfiguracionTiempo, calcularTiempoPorEdad } from '../../../config/tiempos-practica.config';
import { Hands, HAND_CONNECTIONS, Results } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';

@Component({
  selector: 'app-camara-reconocimiento-examen',
  templateUrl: './camara-reconocimiento-examen.component.html',
  styleUrls: ['./camara-reconocimiento-examen.component.scss'],
  standalone: false
})
export class CamaraReconocimientoExamenComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement?: ElementRef<HTMLCanvasElement>;

  @Input() senaObjetivo: string = '';
  @Input() categoriaId?: number;
  @Input() tipoContenido?: 'letras' | 'numeros' | 'colores' | 'comunes';
  @Output() resultadoEmitido = new EventEmitter<any>();

  procesando: boolean = false;
  camaraActiva: boolean = false;
  reconocimientoActivo: boolean = false;
  cargando: boolean = false;
  error: string = '';
  errorDetalle: string = '';

  senaDetectada: string = '';
  confianza: number = 0;
  manoDetectada: boolean = false;
  manosDetectadas: number = 0;

  temporizador: number = 45;
  intervaloTemporizador: any;

  configuracionTiempo: ConfiguracionTiempo;
  tiempoInicial: number = 45;
  umbralDeteccionEstable: number = 3;
  umbralConfianzaMinima: number = 0.75;
  deteccionesConsecutivas: number = 0;

  private categoriasDisponibles: Categoria[] = [];
  private categoriaSeleccionada?: Categoria;

  private reconocimientoSubscription?: Subscription;
  private categoriasSubscription?: Subscription;
  estaProcesando: boolean = false;

  private hands?: Hands;
  private camera?: Camera;
  private mediaPipeInicializado: boolean = false;
  private ultimoFrameEnviado: number = 0;
  private minIntervaloEntreFrames: number = 250;

  private inicializacionEnProgreso: boolean = false;
  private animationFrameId?: number;
  private isProcessingFrame: boolean = false;

  private permisoDenegado: boolean = false;
  private reintentosPermiso: number = 0;
  private maxReintentosPermiso: number = 2;

  private streamActivo: MediaStream | null = null;
  private camaraInicializada: boolean = false;
  private componenteDestruido: boolean = false;

  constructor(
    private http: HttpClient,
    private autenticacionService: AutenticacionService,
    private reconocimientoService: ReconocimientoService,
    private categoriaService: CategoriaService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.configuracionTiempo = this.obtenerConfiguracion();
    this.aplicarConfiguracion();
  }

  ngOnInit(): void {
    this.componenteDestruido = false;
    
    this.cargarCategoriasDisponibles();
    
    if (this.categoriaId) {
      this.reconocimientoService.establecerCategoria(this.categoriaId);
    }

    if (!this.tipoContenido && this.senaObjetivo) {
      this.tipoContenido = this.detectarTipoContenido(this.senaObjetivo);
    }

    this.reconocimientoSubscription = this.reconocimientoService.resultado$.subscribe(
      (resultado: ResultadoReconocimientoVideo) => {
        if (!this.componenteDestruido) {
          this.ngZone.run(() => {
            this.procesarResultadoVideo(resultado);
          });
        }
      }
    );

    this.reconocimientoSubscription.add(
      this.reconocimientoService.estado$.subscribe(activo => {
        if (!this.componenteDestruido) {
          this.estaProcesando = activo && this.reconocimientoService.estaProcesando();
        }
      })
    );

    this.reconocimientoSubscription.add(
      this.reconocimientoService.confianza$.subscribe(confianza => {
        if (!this.componenteDestruido) {
          this.confianza = confianza;
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (!this.componenteDestruido && !this.inicializacionEnProgreso && !this.camaraActiva) {
        this.inicializarCamara();
      }
    }, 500);
  }

  ngOnDestroy(): void {
    this.componenteDestruido = true;
    this.detenerTodoInmediatamente();
  }

  private obtenerConfiguracion(): ConfiguracionTiempo {
    const usuario = this.autenticacionService.usuarioActualValor;
    if (!usuario) return obtenerConfiguracionTiempo(null);
    if (usuario.tipo_usuario) return obtenerConfiguracionTiempo(usuario.tipo_usuario);
    if (usuario.fecha_nacimiento) {
      const edad = this.autenticacionService.calcularEdad(usuario.fecha_nacimiento);
      return calcularTiempoPorEdad(edad);
    }
    return obtenerConfiguracionTiempo(null);
  }

  private aplicarConfiguracion(): void {
    this.tiempoInicial = this.configuracionTiempo.tiempo_segundos;
    this.temporizador = this.configuracionTiempo.tiempo_segundos;
    this.umbralDeteccionEstable = Math.max(3, this.configuracionTiempo.detecciones_requeridas);
    this.umbralConfianzaMinima = Math.max(0.70, this.configuracionTiempo.umbral_confianza);
  }

  private cargarCategoriasDisponibles(): void {
    this.categoriaService.listarCategoriasConModelos().subscribe({
      next: (response) => {
        if (response.exito) {
          this.categoriasDisponibles = response.datos.filter(cat =>
            cat.activa && cat.tiene_modelo && cat.modelo_activo
          );

          if (this.categoriaId) {
            this.categoriaSeleccionada = this.categoriasDisponibles.find(
              cat => cat.id === this.categoriaId
            );
          }
        }
      },
      error: (error) => {}
    });
  }

  private detectarTipoContenido(sena: string): 'letras' | 'numeros' | 'colores' | 'comunes' {
    const senaUpper = sena.toUpperCase().trim();

    if (/^\d+$/.test(senaUpper)) {
      return 'numeros';
    }

    if (/^[A-ZÑ]$/.test(senaUpper)) {
      return 'letras';
    }

    const colores = ['ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'BLANCO', 'NEGRO', 'MORADO', 'NARANJA'];
    if (colores.includes(senaUpper)) {
      return 'colores';
    }

    return 'comunes';
  }

  private determinarCategoriaPorTipo(): number {
    if (this.categoriasDisponibles.length === 0) {
      return 0;
    }

    const mapeoTipos = {
      'letras': ['Letras', 'Alfabeto', 'Abecedario', 'LETRAS', 'ALFABETO'],
      'numeros': ['Números', 'Números LSM', 'Dígitos', 'NUMEROS', 'DIGITOS', 'NÚMEROS'],
      'colores': ['Colores', 'Colores Básicos', 'COLORES'],
      'comunes': ['Comunes', 'Básicas', 'Señas Comunes', 'Vocabulario', 'COMUNES']
    };

    const nombresBuscados = mapeoTipos[this.tipoContenido!] || ['Comunes'];

    const categoriaEncontrada = this.categoriasDisponibles.find(cat =>
      nombresBuscados.some(nombre => 
        cat.nombre.toUpperCase().includes(nombre.toUpperCase())
      )
    );

    if (categoriaEncontrada) {
      this.categoriaSeleccionada = categoriaEncontrada;
      return categoriaEncontrada.id;
    }

    const categoriaDefault = this.categoriasDisponibles[0];
    if (categoriaDefault) {
      this.categoriaSeleccionada = categoriaDefault;
      return categoriaDefault.id;
    }

    return 0;
  }

  private detenerTodoInmediatamente(): void {
    this.componenteDestruido = true;
    this.reconocimientoActivo = false;
    this.camaraActiva = false;
    this.camaraInicializada = false;
    this.estaProcesando = false;
    this.isProcessingFrame = false;

    this.detenerTemporizador();

    try {
      this.reconocimientoService.detenerReconocimiento();
    } catch (error) {}

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (this.camera) {
      try {
        this.camera.stop();
      } catch (error) {}
      this.camera = undefined;
    }

    if (this.hands) {
      try {
        this.hands.close();
      } catch (error) {}
      this.hands = undefined;
    }

    this.detenerMediaStream();

    if (this.videoElement?.nativeElement) {
      try {
        const videoEl = this.videoElement.nativeElement;
        videoEl.pause();
        videoEl.srcObject = null;
        videoEl.load();
      } catch (error) {}
    }

    if (this.canvasElement?.nativeElement) {
      try {
        const canvas = this.canvasElement.nativeElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch (error) {}
    }

    if (this.reconocimientoSubscription) {
      this.reconocimientoSubscription.unsubscribe();
      this.reconocimientoSubscription = undefined;
    }

    if (this.categoriasSubscription) {
      this.categoriasSubscription.unsubscribe();
      this.categoriasSubscription = undefined;
    }

    this.resetearEstado();
    this.inicializacionEnProgreso = false;
    this.mediaPipeInicializado = false;
  }

  private detenerMediaStream(): void {
    if (this.streamActivo) {
      this.streamActivo.getTracks().forEach(track => {
        track.stop();
      });
      this.streamActivo = null;
    }

    if (this.videoElement?.nativeElement?.srcObject) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }

  async inicializarCamara(): Promise<void> {
    if (this.componenteDestruido) {
      return;
    }

    if (this.inicializacionEnProgreso) {
      return;
    }

    if (this.camaraActiva && this.streamActivo) {
      return;
    }

    if (this.permisoDenegado && this.reintentosPermiso >= this.maxReintentosPermiso) {
      this.mostrarInstruccionesPermiso();
      return;
    }

    this.inicializacionEnProgreso = true;
    this.camaraInicializada = false;

    try {
      this.cargando = true;
      this.error = '';
      this.errorDetalle = '';

      await this.reconocimientoService.probarConexion().toPromise();

      if (this.componenteDestruido) {
        return;
      }

      if (!this.videoElement?.nativeElement) {
        throw new Error('Elemento de video no disponible');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      await this.inicializarMediaPipe();

      if (this.componenteDestruido) {
        return;
      }

      const stream = await this.solicitarPermisoCamara();
      this.streamActivo = stream;

      if (this.componenteDestruido) {
        this.detenerMediaStream();
        return;
      }

      const videoEl = this.videoElement.nativeElement;
      videoEl.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout cargando video'));
        }, 10000);

        videoEl.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        videoEl.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Error al cargar el video'));
        };
      });

      if (this.componenteDestruido) {
        this.detenerMediaStream();
        return;
      }

      await videoEl.play();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.ajustarCanvasATamanioVideo();

      this.camaraActiva = true;
      this.camaraInicializada = true;
      this.cargando = false;
      this.reintentosPermiso = 0;
      this.inicializacionEnProgreso = false;

      this.cdr.detectChanges();

      await new Promise(resolve => setTimeout(resolve, 500));
      
      await this.iniciarReconocimiento();

    } catch (error: any) {
      this.cargando = false;
      this.inicializacionEnProgreso = false;
      this.camaraInicializada = false;
      this.manejarErrorCamara(error);
      this.cdr.detectChanges();
    }
  }

  private async solicitarPermisoCamara(): Promise<MediaStream> {
    try {
      const constraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user',
          frameRate: { ideal: 24, max: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
      }

      return stream;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.permisoDenegado = true;
        this.reintentosPermiso++;
      }
      throw error;
    }
  }

  private mostrarInstruccionesPermiso(): void {
    this.error = 'Permiso de cámara denegado';
    this.errorDetalle = 'Debes permitir el acceso a la cámara para continuar.';
  }

  private ajustarCanvasATamanioVideo(): void {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    
    if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    } else if (canvas) {
      canvas.width = 640;
      canvas.height = 480;
    }
  }

  private async inicializarMediaPipe(): Promise<void> {
    if (this.mediaPipeInicializado && this.hands) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        this.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => {
          if (!this.componenteDestruido) {
            this.onMediaPipeResults(results);
          }
        });

        this.mediaPipeInicializado = true;
        resolve();
      } catch (error) {
        this.mediaPipeInicializado = false;
        reject(error);
      }
    });
  }

  private onMediaPipeResults(results: Results): void {
    if (this.isProcessingFrame || this.componenteDestruido) return;
    this.isProcessingFrame = true;

    const canvas = this.canvasElement?.nativeElement;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) {
      this.isProcessingFrame = false;
      return;
    }

    if (this.videoElement?.nativeElement) {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    this.manosDetectadas = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    this.manoDetectada = this.manosDetectadas > 0;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const colors = ['#00FF00', '#FF00FF'];

      results.multiHandLandmarks.forEach((landmarks, index) => {
        const color = colors[index] || '#00FF00';

        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: color,
          lineWidth: 2
        });

        drawLandmarks(ctx, landmarks, {
          color: color,
          lineWidth: 1,
          radius: 3
        });
      });

      if (!this.componenteDestruido) {
        this.capturarYEnviarFrame(results.multiHandLandmarks);
      }
    }

    this.isProcessingFrame = false;
    
    if (!this.componenteDestruido) {
      this.cdr.markForCheck();
    }
  }

  private capturarYEnviarFrame(landmarks: any[]): void {
    if (!this.reconocimientoActivo || this.componenteDestruido) return;

    const ahora = Date.now();
    if (ahora - this.ultimoFrameEnviado < this.minIntervaloEntreFrames) {
      return;
    }

    const frameBase64 = this.capturarFrameDesdeVideo();
    if (frameBase64) {
      const landmarksSimplificados = this.extraerLandmarksSimplificados(landmarks);
      this.reconocimientoService.agregarFrame(frameBase64, landmarksSimplificados);
      this.ultimoFrameEnviado = ahora;
    }
  }

  private extraerLandmarksSimplificados(landmarks: any[]): any[] {
    return landmarks.map(mano => {
      const puntosClave = [0, 4, 8, 12, 16, 20];
      return puntosClave.map(idx => ({
        x: mano[idx].x,
        y: mano[idx].y,
        z: mano[idx].z
      }));
    });
  }

  private capturarFrameDesdeVideo(): string | null {
    const video = this.videoElement?.nativeElement;

    if (!video || this.componenteDestruido) return null;

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 224;
      tempCanvas.height = 224;
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) return null;

      tempCtx.drawImage(video, 0, 0, 224, 224);
      return tempCanvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      return null;
    }
  }

  private iniciarProcesamientoMediaPipe(): void {
    if (!this.videoElement?.nativeElement || !this.hands || this.componenteDestruido) {
      return;
    }

    if (this.camera) {
      try {
        this.camera.stop();
      } catch (e) {}
    }

    this.camera = new Camera(this.videoElement.nativeElement, {
      onFrame: async () => {
        if (this.reconocimientoActivo && this.hands && !this.isProcessingFrame && !this.componenteDestruido) {
          try {
            await this.hands.send({ image: this.videoElement!.nativeElement });
          } catch (error) {
            if (!this.componenteDestruido) {}
          }
        }
      },
      width: 640,
      height: 480
    });

    this.camera.start().catch(error => {
      if (!this.componenteDestruido) {}
    });
  }

  async iniciarReconocimiento(): Promise<void> {
    if (this.componenteDestruido) {
      return;
    }

    try {
      if (!this.categoriaId && this.tipoContenido) {
        this.categoriaId = this.determinarCategoriaPorTipo();
        this.reconocimientoService.establecerCategoria(this.categoriaId);
      }

      if (!this.videoElement?.nativeElement) {
        throw new Error('Elemento de video no disponible');
      }

      if (!this.camaraActiva || !this.camaraInicializada) {
        throw new Error('Cámara no activa');
      }

      if (!this.mediaPipeInicializado) {
        await this.inicializarMediaPipe();
      }

      if (this.componenteDestruido) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      this.reconocimientoService.iniciarReconocimiento();
      this.reconocimientoActivo = true;
      this.estaProcesando = false;

      this.resetearEstado();

      this.iniciarTemporizador();
      this.iniciarProcesamientoMediaPipe();

    } catch (error: any) {
      this.error = 'Error al iniciar';
      this.errorDetalle = error.message;
      this.reconocimientoActivo = false;
      
      if (!this.componenteDestruido) {
        this.cdr.detectChanges();
      }
    }
  }

  private resetearEstado(): void {
    this.deteccionesConsecutivas = 0;
    this.manosDetectadas = 0;
    this.ultimoFrameEnviado = 0;
    this.confianza = 0;
    this.senaDetectada = '';
    this.manoDetectada = false;
  }

  private procesarResultadoVideo(resultado: ResultadoReconocimientoVideo): void {
    if (!this.reconocimientoActivo || this.componenteDestruido) {
      return;
    }

    this.senaDetectada = resultado.sena_detectada || '';
    this.confianza = resultado.confianza || 0;

    this.verificarDeteccionEstable();
    
    if (!this.componenteDestruido) {
      this.cdr.detectChanges();
    }
  }

  private verificarDeteccionEstable(): void {
    if (!this.senaDetectada || this.confianza < this.umbralConfianzaMinima) {
      this.deteccionesConsecutivas = 0;
      return;
    }

    this.deteccionesConsecutivas++;

    if (this.deteccionesConsecutivas >= this.umbralDeteccionEstable) {
      this.capturarRespuesta();
    }
  }

  private capturarRespuesta(): void {
    if (this.componenteDestruido) return;

    this.reconocimientoActivo = false;
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();

    setTimeout(() => {
      if (!this.componenteDestruido) {
        this.resultadoEmitido.emit({
          exito: true,
          sena_reconocida: this.senaDetectada,
          confianza: this.confianza,
          detecciones: this.deteccionesConsecutivas,
          categoria_id: this.categoriaId,
          tipo_contenido: this.tipoContenido,
          categoria_nombre: this.categoriaSeleccionada?.nombre,
          modelo_usado: this.categoriaSeleccionada?.modelo_nombre
        });
      }
    }, 500);
  }

  private manejarTiempoAgotado(): void {
    if (this.componenteDestruido) return;

    this.reconocimientoActivo = false;
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();

    setTimeout(() => {
      if (!this.componenteDestruido) {
        this.resultadoEmitido.emit({
          exito: false,
          sena_reconocida: this.senaDetectada || '',
          confianza: this.confianza,
          detecciones: this.deteccionesConsecutivas,
          timeout: true,
          categoria_id: this.categoriaId,
          tipo_contenido: this.tipoContenido,
          categoria_nombre: this.categoriaSeleccionada?.nombre,
          modelo_usado: this.categoriaSeleccionada?.modelo_nombre
        });
      }
    }, 500);
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.temporizador = this.tiempoInicial;
    
    this.intervaloTemporizador = setInterval(() => {
      if (this.componenteDestruido) {
        this.detenerTemporizador();
        return;
      }

      this.temporizador--;

      this.ngZone.run(() => {
        if (!this.componenteDestruido) {
          this.cdr.markForCheck();
        }
      });

      if (this.temporizador <= 0) {
        this.manejarTiempoAgotado();
      }
    }, 1000);
  }

  private detenerTemporizador(): void {
    if (this.intervaloTemporizador) {
      clearInterval(this.intervaloTemporizador);
      this.intervaloTemporizador = null;
    }
  }

  detenerCamara(): void {
    this.detenerTodo();
  }

  detenerTodo(): void {
    this.detenerTodoInmediatamente();
  }

  reiniciarReconocimiento(): void {
    if (this.componenteDestruido) return;

    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();

    this.reconocimientoActivo = false;
    this.estaProcesando = false;
    this.resetearEstado();

    setTimeout(() => {
      if (this.camaraActiva && this.camaraInicializada && !this.cargando && !this.componenteDestruido) {
        this.iniciarReconocimiento();
      }
    }, 500);
  }

  private manejarErrorCamara(error: any): void {
    const errorName = error.name || '';
    const errorMessage = error.message || '';

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      this.error = 'Permiso de cámara denegado';
      this.errorDetalle = 'Haz clic en "Reintentar" y permite el acceso cuando el navegador lo solicite.';
      this.permisoDenegado = true;
    } else if (errorName === 'NotFoundError') {
      this.error = 'No se encontró cámara';
      this.errorDetalle = 'Verifica que tu dispositivo tenga una cámara conectada.';
    } else if (errorName === 'NotReadableError') {
      this.error = 'Cámara en uso';
      this.errorDetalle = 'Cierra otras aplicaciones que usen la cámara.';
    } else if (errorMessage.includes('servidor')) {
      this.error = 'Error de conexión';
      this.errorDetalle = 'No se pudo conectar con el servidor.';
    } else if (errorMessage.includes('Timeout')) {
      this.error = 'Tiempo de espera agotado';
      this.errorDetalle = 'La cámara tardó demasiado en responder. Reintenta.';
    } else {
      this.error = 'Error de cámara';
      this.errorDetalle = errorMessage || 'Recarga la página e intenta de nuevo.';
    }
  }

  get colorConfianza(): string {
    if (this.confianza >= 0.7) return '#4caf50';
    if (this.confianza >= 0.5) return '#ff9800';
    return '#f44336';
  }

  get porcentajeConfianza(): number {
    return Math.round(this.confianza * 100);
  }

  get estadoMano(): string {
    if (this.manosDetectadas === 0) return 'No detectada';
    if (this.manosDetectadas === 1) return '1 mano';
    return `${this.manosDetectadas} manos`;
  }

  get infoConfiguracion(): string {
    const usuario = this.autenticacionService.usuarioActualValor;
    if (!usuario) return 'Configuración estándar';

    const edad = usuario.fecha_nacimiento
      ? this.autenticacionService.calcularEdad(usuario.fecha_nacimiento)
      : null;

    return `${this.configuracionTiempo.descripcion}${edad ? ` (${edad} años)` : ''}`;
  }

  get requiereDosManos(): boolean {
    return this.senaObjetivo.toUpperCase() === 'J' || this.senaObjetivo.toUpperCase() === 'Ñ';
  }

  get progresoDeteccion(): number {
    return Math.min((this.deteccionesConsecutivas / this.umbralDeteccionEstable) * 100, 100);
  }
}
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input, Output, EventEmitter, ChangeDetectorRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { ReconocimientoService, ResultadoReconocimientoVideo } from '../../../servicios/reconocimiento.service';
import { CategoriaService, Categoria } from '../../../servicios/categoria.service';
import { HandDetectionService } from '../../../servicios/hand-detection.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { obtenerConfiguracionTiempo, ConfiguracionTiempo, NivelDificultad } from '../../../config/tiempos-practica.config';

@Component({
  selector: 'app-camara-reconocimiento',
  templateUrl: './camara-reconocimiento.component.html',
  styleUrls: ['./camara-reconocimiento.component.scss'],
  standalone: false
})
export class CamaraReconocimientoComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement', { static: false }) videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement?: ElementRef<HTMLCanvasElement>;

  @Input() senaObjetivo: string = '';
  @Input() modo: 'video' = 'video';
  @Input() categoriaId?: number;
  @Input() tipoContenido?: 'letras' | 'numeros' | 'colores' | 'comunes';
  @Input() nivelDificultad: NivelDificultad = 1;
  @Input() modoContinuo: boolean = false;
  @Input() activarAudio: boolean = true;
  @Output() resultadoEmitido = new EventEmitter<any>();

  procesando: boolean = false;
  camaraActiva: boolean = false;
  reconocimientoActivo: boolean = false;
  cargando: boolean = false;
  error: string = '';
  errorDetalle: string = '';
  pausado: boolean = false;

  mostrarFeedback: boolean = false;
  feedbackTipo: 'exito' | 'error' = 'exito';
  feedbackMensaje: string = '';

  senaDetectada: string = '';
  confianza: number = 0;
  manoDetectada: boolean = false;
  manosDetectadas: number = 0;
  consistenciaTemporal: number = 0;
  framesConsistentes: number = 0;

  intentos: number = 0;
  aciertos: number = 0;
  tiempoInicio: number = 0;
  temporizador: number = 45;
  intervaloTemporizador: any;

  configuracionTiempo: ConfiguracionTiempo;
  tiempoInicial: number = 45;
  umbralDeteccionEstable: number = 2;
  umbralConfianzaMinima: number = 0.30;

  resultadosRecientes: any[] = [];
  deteccionesConsecutivas: number = 0;
  ultimasSenasDetectadas: string[] = [];

  categoriasDisponibles: Categoria[] = [];
  categoriaSeleccionada?: Categoria;
  cargandoCategorias: boolean = false;
  instruccionesAbiertas: boolean = false;

  letraEnVivo: string = '';
  confianzaEnVivo: number = 0;

  private reconocimientoSubscription?: Subscription;
  estaProcesando: boolean = false;

  private ultimoFrameEnviado: number = 0;
  private minIntervaloEntreFrames: number = 80;

  private inicializacionEnProgreso: boolean = false;

  private permisoDenegado: boolean = false;
  private reintentosPermiso: number = 0;
  private maxReintentosPermiso: number = 2;
  private streamActivo: MediaStream | null = null;
  private camaraInicializada: boolean = false;

  private readonly LETRAS_ESTABLES_CONTINUO = 2;
  private readonly COOLDOWN_CONTINUO_MS = 500;
  private ultimaLetraEmitidaContinuo: string = '';
  private ultimoTimestampEmisionContinuo: number = 0;
  private bloqueoRepeticionContinuo: boolean = false;

  private readonly LADO_MAX_FRAME = 480;
  private readonly RETRASO_EMIT_EXITO_MS = 1300;

  private ultimosSlotsMP: any[] = [[], []];

  private colaVoz: string[] = [];
  private hablandoVoz: boolean = false;
  private emitPendiente: any = null;

  constructor(
    private http: HttpClient,
    private autenticacionService: AutenticacionService,
    private reconocimientoService: ReconocimientoService,
    private handDetectionService: HandDetectionService,
    private categoriaService: CategoriaService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private queryClient: QueryClient
  ) {
    this.configuracionTiempo = obtenerConfiguracionTiempo(this.nivelDificultad);
    this.aplicarConfiguracion();
  }

  ngOnInit(): void {
    this.configuracionTiempo = obtenerConfiguracionTiempo(this.nivelDificultad);
    this.aplicarConfiguracion();
    this.cargarCategoriasDisponibles();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inicializarTodo();
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.emitPendiente) {
      clearTimeout(this.emitPendiente);
      this.emitPendiente = null;
    }
    this.detenerTodo();
    if (this.reconocimientoSubscription) {
      this.reconocimientoSubscription.unsubscribe();
    }
  }

  private async inicializarTodo(): Promise<void> {
    try {
      await this.esperarCategoriasCargadas();
      this.configurarCategoriaAutomatica();
      this.configurarSuscripciones();
      await this.inicializarCamara();
    } catch (error: any) {
      this.error = 'Error de inicialización';
      this.errorDetalle = 'Intenta recargar la página';
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private configurarCategoriaAutomatica(): void {
    if (this.categoriaId && this.categoriaId > 0) {
      this.categoriaSeleccionada = this.categoriasDisponibles.find(cat => cat.id === this.categoriaId);
    } else if (this.tipoContenido) {
      this.categoriaId = this.obtenerCategoriaPorTipo();
    } else if (this.senaObjetivo) {
      this.tipoContenido = this.detectarTipoContenido(this.senaObjetivo);
      this.categoriaId = this.obtenerCategoriaPorTipo();
    } else if (this.categoriasDisponibles.length > 0) {
      this.categoriaId = this.categoriasDisponibles[0].id;
      this.categoriaSeleccionada = this.categoriasDisponibles[0];
    }
  }

  private esperarCategoriasCargadas(): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 3000);
      const verificar = () => {
        if (!this.cargandoCategorias) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(verificar, 200);
        }
      };
      verificar();
    });
  }

  private configurarSuscripciones(): void {
    this.reconocimientoSubscription = this.reconocimientoService.resultado$.subscribe(
      (resultado: ResultadoReconocimientoVideo) => {
        this.ngZone.run(() => this.procesarResultadoVideo(resultado));
      }
    );

    this.reconocimientoSubscription.add(
      this.reconocimientoService.estado$.subscribe(activo => {
        this.estaProcesando = activo && this.reconocimientoService.estaProcesando();
      })
    );

    this.reconocimientoSubscription.add(
      this.reconocimientoService.confianza$.subscribe(confianza => {
        this.confianza = confianza;
        this.cdr.detectChanges();
      })
    );
  }

  private cargarCategoriasDisponibles(): void {
    this.cargandoCategorias = true;

    this.queryClient.fetchQuery({
      queryKey: ['categorias-con-modelos'],
      queryFn: () => firstValueFrom(this.categoriaService.listarCategoriasConModelos()),
      staleTime: Infinity
    }).then(response => {
      if (response.exito) {
        this.categoriasDisponibles = response.datos.filter(cat => cat.activa && cat.tiene_modelo && cat.modelo_activo);
        if (this.categoriaId) {
          this.categoriaSeleccionada = this.categoriasDisponibles.find(cat => cat.id === this.categoriaId);
        }
      }
      this.cargandoCategorias = false;
      this.cdr.detectChanges();
    }).catch(() => {
      this.cargandoCategorias = false;
      this.cdr.detectChanges();
    });
  }

  private detectarTipoContenido(sena: string): 'letras' | 'numeros' | 'colores' | 'comunes' {
    const senaUpper = sena.toUpperCase().trim();
    if (/^\d+$/.test(senaUpper)) return 'numeros';
    if (/^[A-ZÑ]$/.test(senaUpper)) return 'letras';
    const colores = ['ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'BLANCO', 'NEGRO', 'MORADO', 'NARANJA'];
    if (colores.includes(senaUpper)) return 'colores';
    return 'comunes';
  }

  private obtenerCategoriaPorTipo(): number {
    if (this.categoriasDisponibles.length === 0) return 0;

    const mapeoTipos = {
      'letras': ['LETRAS', 'ALFABETO', 'ABECEDARIO'],
      'numeros': ['NUMEROS', 'NÚMEROS', 'DIGITOS', 'DÍGITOS'],
      'colores': ['COLORES'],
      'comunes': ['COMUNES', 'BASICAS', 'BÁSICAS', 'VOCABULARIO', 'EMERGENCIA', 'EMERGENCIAS']
    };

    const nombresBuscados = mapeoTipos[this.tipoContenido!] || ['COMUNES'];

    const categoriaEncontrada = this.categoriasDisponibles.find(cat =>
      nombresBuscados.some(nombre => cat.nombre.toUpperCase().includes(nombre))
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

  private aplicarConfiguracion(): void {
    this.tiempoInicial = this.configuracionTiempo.tiempo_segundos;
    this.temporizador = this.configuracionTiempo.tiempo_segundos;
    this.umbralDeteccionEstable = Math.max(2, this.configuracionTiempo.detecciones_requeridas - 2);
    this.umbralConfianzaMinima = 0.30;
  }

  async inicializarCamara(): Promise<void> {
    if (this.inicializacionEnProgreso || this.camaraInicializada) return;

    if (this.permisoDenegado && this.reintentosPermiso >= this.maxReintentosPermiso) {
      this.mostrarInstruccionesPermiso();
      return;
    }

    this.inicializacionEnProgreso = true;
    this.cargando = true;
    this.error = '';
    this.errorDetalle = '';

    try {
      if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) {
        throw new Error('Elementos de video/canvas no disponibles');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      try {
        await Promise.race([
          this.reconocimientoService.probarConexion().toPromise(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (error) { }

      await this.handDetectionService.inicializarDetector();
      await new Promise(resolve => setTimeout(resolve, 300));

      const stream = await this.solicitarPermisoCamara();
      this.streamActivo = stream;

      const videoEl = this.videoElement.nativeElement;
      videoEl.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout cargando video')), 10000);
        videoEl.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
        videoEl.onerror = () => { clearTimeout(timeout); reject(new Error('Error al cargar el video')); };
      });

      await videoEl.play();
      await new Promise(resolve => setTimeout(resolve, 500));

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
      return await navigator.mediaDevices.getUserMedia(constraints);
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

  private async iniciarDeteccionManos(): Promise<void> {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    await this.handDetectionService.iniciarDeteccion(
      this.videoElement.nativeElement,
      this.canvasElement.nativeElement,
      (results: any) => this.onMediaPipeResults(results)
    );
  }

  private onMediaPipeResults(results: any): void {
    const video = this.videoElement?.nativeElement;
    if (!video || video.readyState < 2) return;

    this.manosDetectadas = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    this.manoDetectada = this.handDetectionService.verificarManoDetectada(results);

    this.ultimosSlotsMP = this.handDetectionService.obtenerLandmarksConSlotsFijos(results);

    if (this.manoDetectada) {
      const hayMano = this.ultimosSlotsMP.some(s => Array.isArray(s) && s.length >= 21);
      if (hayMano) {
        this.capturarYEnviarFrame();
      }
    } else if (this.modoContinuo) {
      this.bloqueoRepeticionContinuo = false;
      this.reconocimientoService.limpiarBuffer();
    }

    this.cdr.markForCheck();
  }

  private capturarYEnviarFrame(): void {
    if (!this.reconocimientoActivo || this.pausado) return;

    const ahora = Date.now();
    if (ahora - this.ultimoFrameEnviado < this.minIntervaloEntreFrames) return;

    const frameBase64 = this.capturarFrameDesdeVideo();
    if (!frameBase64) return;

    const landmarksSimplificados = this.handDetectionService.convertirSlotsASimplificados(this.ultimosSlotsMP);

    this.reconocimientoService.agregarFrame(frameBase64, landmarksSimplificados);
    this.ultimoFrameEnviado = ahora;
  }

  private capturarFrameDesdeVideo(): string | null {
    const video = this.videoElement?.nativeElement;
    if (!video) return null;

    try {
      const anchoVideo = video.videoWidth || 640;
      const altoVideo = video.videoHeight || 480;
      const escala = Math.min(1, this.LADO_MAX_FRAME / Math.max(anchoVideo, altoVideo));
      const anchoDestino = Math.max(1, Math.round(anchoVideo * escala));
      const altoDestino = Math.max(1, Math.round(altoVideo * escala));

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = anchoDestino;
      tempCanvas.height = altoDestino;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;

      tempCtx.drawImage(video, 0, 0, anchoDestino, altoDestino);
      return tempCanvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
      return null;
    }
  }

  async iniciarReconocimiento(): Promise<void> {
    try {
      if (!this.videoElement?.nativeElement) throw new Error('Elemento de video no disponible');
      if (!this.camaraActiva || !this.camaraInicializada) throw new Error('Cámara no activa');

      await new Promise(resolve => setTimeout(resolve, 300));

      this.reconocimientoService.iniciarReconocimiento();
      this.reconocimientoActivo = true;
      this.estaProcesando = false;
      this.pausado = false;

      this.tiempoInicio = Date.now();
      this.intentos = 0;
      this.aciertos = 0;
      this.resultadosRecientes = [];
      this.deteccionesConsecutivas = 0;
      this.manosDetectadas = 0;
      this.ultimasSenasDetectadas = [];
      this.ultimoFrameEnviado = 0;
      this.confianza = 0;
      this.ultimaLetraEmitidaContinuo = '';
      this.ultimoTimestampEmisionContinuo = 0;
      this.bloqueoRepeticionContinuo = false;

      this.iniciarTemporizador();
      await this.iniciarDeteccionManos();
    } catch (error: any) {
      this.error = 'Error al iniciar reconocimiento';
      this.errorDetalle = error.message;
      this.reconocimientoActivo = false;
      this.cdr.detectChanges();
    }
  }

  private procesarResultadoVideo(resultado: ResultadoReconocimientoVideo): void {
    if (!this.reconocimientoActivo || this.pausado) return;

    this.senaDetectada = (resultado.sena_detectada || '').trim().toUpperCase();
    this.confianza = resultado.confianza || 0;
    this.letraEnVivo = this.senaDetectada;
    this.confianzaEnVivo = this.confianza;

    if (this.modoContinuo) {
      this.verificarDeteccionContinua();
    } else {
      this.verificarDeteccionSimple();
    }

    this.cdr.detectChanges();
  }

  private verificarDeteccionSimple(): void {
    if (!this.senaDetectada || this.confianza < this.umbralConfianzaMinima) return;

    const senaDetectadaNorm = this.senaDetectada.trim().toUpperCase();
    const senaObjetivoNorm = this.senaObjetivo.trim().toUpperCase();

    if (senaDetectadaNorm === senaObjetivoNorm) {
      this.deteccionesConsecutivas++;
      if (this.deteccionesConsecutivas >= this.umbralDeteccionEstable) {
        this.manejarAciertoSimple();
      }
    } else {
      if (this.ultimasSenasDetectadas.length >= 2 &&
        this.ultimasSenasDetectadas.slice(-2).every(s => s !== senaObjetivoNorm)) {
        this.deteccionesConsecutivas = 0;
      }
    }

    this.ultimasSenasDetectadas.push(senaDetectadaNorm);
    if (this.ultimasSenasDetectadas.length > 3) this.ultimasSenasDetectadas.shift();
  }

  private verificarDeteccionContinua(): void {
    const letra = this.senaDetectada.trim().toUpperCase();

    if (!letra || letra === 'DESCONOCIDO' || letra === '?') {
      this.deteccionesConsecutivas = 0;
      this.bloqueoRepeticionContinuo = false;
      return;
    }
    if (this.confianza < this.umbralConfianzaMinima) {
      this.deteccionesConsecutivas = 0;
      return;
    }

    if (letra !== this.ultimaLetraEmitidaContinuo) {
      this.bloqueoRepeticionContinuo = false;
    }

    if (letra === this.ultimasSenasDetectadas[this.ultimasSenasDetectadas.length - 1]) {
      this.deteccionesConsecutivas++;
    } else {
      this.deteccionesConsecutivas = 1;
    }

    this.ultimasSenasDetectadas.push(letra);
    if (this.ultimasSenasDetectadas.length > 5) this.ultimasSenasDetectadas.shift();

    if (this.deteccionesConsecutivas < this.LETRAS_ESTABLES_CONTINUO) return;

    if (letra === this.ultimaLetraEmitidaContinuo && this.bloqueoRepeticionContinuo) return;

    const ahora = Date.now();
    if (ahora - this.ultimoTimestampEmisionContinuo < this.COOLDOWN_CONTINUO_MS) return;

    this.ultimaLetraEmitidaContinuo = letra;
    this.ultimoTimestampEmisionContinuo = ahora;
    this.bloqueoRepeticionContinuo = true;
    this.deteccionesConsecutivas = 0;

    if (this.activarAudio) {
      this.reproducirLetraPorVoz(letra);
    }

    this.resultadoEmitido.emit({
      exito: true,
      precision: this.confianza,
      sena_reconocida: letra,
      tiempo: Math.floor((Date.now() - this.tiempoInicio) / 1000),
      intentos: this.intentos,
      mensaje: 'Letra detectada',
      modo: 'continuo',
      categoria_id: this.categoriaId,
      tipo_contenido: this.tipoContenido,
      categoria_nombre: this.categoriaSeleccionada?.nombre
    });

    this.mostrarFeedbackTemporal('exito', `Letra detectada: ${letra}`);
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

  private manejarAciertoSimple(): void {
    this.aciertos++;
    this.intentos++;

    if (!this.modoContinuo) {
      this.reconocimientoActivo = false;
      this.detenerTemporizador();
      this.reconocimientoService.detenerReconocimiento();
    }

    if (this.activarAudio) {
      this.reproducirLetraPorVoz(this.senaObjetivo);
    }

    this.mostrarFeedbackTemporal('exito', `¡Correcto! Seña ${this.senaObjetivo} detectada`);

    const datosResultado = {
      exito: true,
      precision: this.confianza,
      sena_reconocida: this.senaObjetivo,
      tiempo: Math.floor((Date.now() - this.tiempoInicio) / 1000),
      intentos: this.intentos,
      mensaje: 'Reconocimiento exitoso',
      modo: 'video',
      categoria_id: this.categoriaId,
      tipo_contenido: this.tipoContenido,
      categoria_nombre: this.categoriaSeleccionada?.nombre
    };

    if (this.modoContinuo) {
      this.deteccionesConsecutivas = 0;
      this.senaDetectada = '';
      this.confianza = 0;
      this.resultadoEmitido.emit(datosResultado);
      return;
    }

    const retraso = this.activarAudio ? this.RETRASO_EMIT_EXITO_MS : 0;

    this.emitPendiente = setTimeout(() => {
      this.emitPendiente = null;
      this.resultadoEmitido.emit(datosResultado);
    }, retraso);
  }

  private manejarTiempoAgotado(): void {
    this.intentos++;
    this.reconocimientoActivo = false;
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();

    this.mostrarFeedbackTemporal('error', 'Tiempo agotado. Intenta de nuevo.');

    setTimeout(() => {
      this.resultadoEmitido.emit({
        exito: false,
        precision: this.confianza,
        sena_reconocida: this.senaDetectada,
        tiempo: this.tiempoInicial,
        intentos: this.intentos,
        mensaje: 'Tiempo agotado',
        modo: 'video',
        manosDetectadas: this.manosDetectadas,
        categoria_id: this.categoriaId,
        tipo_contenido: this.tipoContenido,
        categoria_nombre: this.categoriaSeleccionada?.nombre
      });
    }, 2000);
  }

  private mostrarFeedbackTemporal(tipo: 'exito' | 'error', mensaje: string): void {
    this.feedbackTipo = tipo;
    this.feedbackMensaje = mensaje;
    this.mostrarFeedback = true;
    setTimeout(() => {
      this.mostrarFeedback = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.temporizador = this.tiempoInicial;

    this.intervaloTemporizador = setInterval(() => {
      this.temporizador--;
      if (this.temporizador === 10) {
        this.mostrarFeedbackTemporal('error', 'Quedan 10 segundos!');
      }
      this.ngZone.run(() => this.cdr.markForCheck());
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

  reiniciarIntento(): void {
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();
    this.resetearEstadoSinDetener();

    setTimeout(() => {
      if (this.camaraActiva && this.camaraInicializada) {
        this.reconocimientoService.iniciarReconocimiento();
        this.reconocimientoActivo = true;
        this.tiempoInicio = Date.now();
        this.iniciarTemporizador();
      }
    }, 500);
  }

  togglePausa(): void {
    this.pausado = !this.pausado;
    if (this.pausado) {
      this.detenerTemporizador();
      this.reconocimientoService.detenerReconocimiento();
    } else {
      this.reconocimientoService.iniciarReconocimiento();
      this.iniciarTemporizador();
    }
  }

  detenerCamara(): void {
    this.detenerTodo();
  }

  reiniciarReconocimiento(): void {
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();

    this.reconocimientoActivo = false;
    this.estaProcesando = false;
    this.resultadosRecientes = [];
    this.deteccionesConsecutivas = 0;
    this.senaDetectada = '';
    this.confianza = 0;
    this.manosDetectadas = 0;
    this.ultimasSenasDetectadas = [];
    this.ultimoFrameEnviado = 0;
    this.intentos = 0;
    this.aciertos = 0;
    this.pausado = false;
    this.ultimaLetraEmitidaContinuo = '';
    this.ultimoTimestampEmisionContinuo = 0;
    this.bloqueoRepeticionContinuo = false;

    setTimeout(() => {
      if (this.camaraActiva && this.camaraInicializada && !this.cargando) {
        this.iniciarReconocimiento();
      }
    }, 500);
  }

  detenerReconocimiento(): void {
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();
    this.reconocimientoActivo = false;
    this.estaProcesando = false;
    this.pausado = true;
  }

  resetearEstadoSinDetener(): void {
    this.deteccionesConsecutivas = 0;
    this.ultimasSenasDetectadas = [];
    this.senaDetectada = '';
    this.confianza = 0;
    this.reconocimientoService.limpiarBuffer();
  }

  detenerTodo(): void {
    this.detenerTemporizador();
    this.reconocimientoService.detenerReconocimiento();
    this.handDetectionService.detenerDeteccion();
    this.detenerColaVoz();

    if (this.streamActivo) {
      try {
        this.streamActivo.getTracks().forEach(track => track.stop());
        this.streamActivo = null;
      } catch (error) { }
    }

    if (this.videoElement?.nativeElement?.srcObject) {
      try {
        const stream = this.videoElement.nativeElement.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        this.videoElement.nativeElement.srcObject = null;
      } catch (error) { }
    }

    this.reconocimientoActivo = false;
    this.camaraActiva = false;
    this.camaraInicializada = false;
    this.pausado = false;
    this.estaProcesando = false;
    this.manosDetectadas = 0;
    this.ultimasSenasDetectadas = [];
    this.ultimoFrameEnviado = 0;
    this.inicializacionEnProgreso = false;
    this.ultimosSlotsMP = [[], []];
    this.bloqueoRepeticionContinuo = false;
  }

  cancelarPractica(): void {
    if (this.emitPendiente) {
      clearTimeout(this.emitPendiente);
      this.emitPendiente = null;
    }
    this.resultadoEmitido.emit({
      exito: false,
      precision: 0,
      sena_reconocida: '',
      tiempo: 0,
      intentos: this.intentos,
      mensaje: 'Cancelado',
      modo: 'video',
      manosDetectadas: this.manosDetectadas,
      consistencia: 0,
      categoria_id: this.categoriaId,
      tipo_contenido: this.tipoContenido,
      categoria_nombre: this.categoriaSeleccionada?.nombre
    });
    this.detenerTodo();
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
    if (this.confianza >= 0.8) return '#4caf50';
    if (this.confianza >= 0.6) return '#ff9800';
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
    return this.configuracionTiempo.descripcion;
  }

  get requiereDosManos(): boolean {
    if (this.senaObjetivo.length > 1) return true;
    const s = this.senaObjetivo.toUpperCase();
    return s === 'J' || s === 'Ñ';
  }

  get progresoDeteccion(): number {
    return Math.min((this.deteccionesConsecutivas / this.umbralDeteccionEstable) * 100, 100);
  }

  get estadoSistema(): string {
    if (!this.camaraActiva) return 'Cámara inactiva';
    if (!this.reconocimientoActivo) return 'Reconocimiento pausado';
    if (this.estaProcesando) return 'Procesando...';
    return 'Activo';
  }

  get puedeIniciar(): boolean {
    return this.camaraActiva && !this.cargando && !this.inicializacionEnProgreso;
  }

  get infoCategoria(): string {
    if (!this.categoriaSeleccionada) return 'Sin categoría';
    return this.categoriaSeleccionada.nombre;
  }

  get infoModelo(): string {
    return 'Modelo global';
  }

  toggleInstrucciones(): void {
    this.instruccionesAbiertas = !this.instruccionesAbiertas;
  }
}
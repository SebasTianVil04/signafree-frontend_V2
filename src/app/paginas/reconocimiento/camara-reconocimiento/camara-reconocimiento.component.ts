import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input, Output, EventEmitter, ChangeDetectorRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { ReconocimientoService, ResultadoReconocimientoVideo } from '../../../servicios/reconocimiento.service';
import { CategoriaService, Categoria } from '../../../servicios/categoria.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { obtenerConfiguracionTiempo, ConfiguracionTiempo, calcularTiempoPorEdad } from '../../../config/tiempos-practica.config';
import { Hands, HAND_CONNECTIONS, Results } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';

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
  @Input() modoContinuo: boolean = false;
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
  umbralConfianzaMinima: number = 0.70;

  resultadosRecientes: any[] = [];
  deteccionesConsecutivas: number = 0;
  ultimasSenasDetectadas: string[] = [];

  categoriasDisponibles: Categoria[] = [];
  categoriaSeleccionada?: Categoria;
  cargandoCategorias: boolean = false;
  instruccionesAbiertas: boolean = false;

  private reconocimientoSubscription?: Subscription;
  estaProcesando: boolean = false;

  private hands?: Hands;
  private camera?: Camera;
  private mediaPipeInicializado: boolean = false;
  private ultimoFrameEnviado: number = 0;
  private minIntervaloEntreFrames: number = 80;

  private frameEnProceso: boolean = false;
  private ultimoFrameProcesadoMP: number = 0;
  private minIntervaloProcesamientoMP: number = 100;

  private inicializacionEnProgreso: boolean = false;
  private animationFrameId?: number;

  private permisoDenegado: boolean = false;
  private reintentosPermiso: number = 0;
  private maxReintentosPermiso: number = 2;
  private streamActivo: MediaStream | null = null;
  private camaraInicializada: boolean = false;

  private categoriaValidadaInternamente: boolean = false;
  private modeloValidadoInternamente: boolean = false;
  private categoriaIdInterno: number = 0;
  private modeloNombreInterno: string = '';

  constructor(
    private http: HttpClient,
    private autenticacionService: AutenticacionService,
    private reconocimientoService: ReconocimientoService,
    private categoriaService: CategoriaService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private queryClient: QueryClient
  ) {
    this.configuracionTiempo = this.obtenerConfiguracion();
    this.aplicarConfiguracion();
  }

  ngOnInit(): void {
    this.cargarCategoriasDisponibles();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inicializarTodo();
    }, 500);
  }

  ngOnDestroy(): void {
    this.detenerTodo();
    if (this.reconocimientoSubscription) {
      this.reconocimientoSubscription.unsubscribe();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
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
      this.categoriaSeleccionada = this.categoriasDisponibles.find(
        cat => cat.id === this.categoriaId
      );
      this.categoriaIdInterno = this.categoriaId;
    }
    else if (this.tipoContenido) {
      this.categoriaId = this.obtenerCategoriaPorTipo();
      this.categoriaIdInterno = this.categoriaId;
    }
    else if (this.senaObjetivo) {
      this.tipoContenido = this.detectarTipoContenido(this.senaObjetivo);
      this.categoriaId = this.obtenerCategoriaPorTipo();
      this.categoriaIdInterno = this.categoriaId;
    }
    else if (this.categoriasDisponibles.length > 0) {
      this.categoriaId = this.categoriasDisponibles[0].id;
      this.categoriaSeleccionada = this.categoriasDisponibles[0];
      this.categoriaIdInterno = this.categoriaId;
    }

    if (this.categoriaId && this.categoriaId > 0) {
      this.reconocimientoService.establecerCategoria(this.categoriaId);
      this.modeloNombreInterno = this.categoriaSeleccionada?.modelo_nombre || 'Global';
      this.categoriaValidadaInternamente = true;
      this.modeloValidadoInternamente = true;
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
        this.ngZone.run(() => {
          this.procesarResultadoVideo(resultado);
        });
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
        this.categoriasDisponibles = response.datos.filter(cat =>
          cat.activa && cat.tiene_modelo && cat.modelo_activo
        );

        if (this.categoriaId) {
          this.categoriaSeleccionada = this.categoriasDisponibles.find(
            cat => cat.id === this.categoriaId
          );
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
    this.umbralDeteccionEstable = Math.max(2, this.configuracionTiempo.detecciones_requeridas - 2);
    this.umbralConfianzaMinima = Math.max(0.70, this.configuracionTiempo.umbral_confianza);
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

      await this.inicializarMediaPipe();
      await new Promise(resolve => setTimeout(resolve, 300));

      const stream = await this.solicitarPermisoCamara();
      this.streamActivo = stream;

      const videoEl = this.videoElement.nativeElement;
      videoEl.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout cargando video')), 10000);

        videoEl.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };

        videoEl.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Error al cargar el video'));
        };
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

  private async inicializarMediaPipe(): Promise<void> {
    if (this.mediaPipeInicializado && this.hands) return;

    return new Promise<void>((resolve, reject) => {
      try {
        this.hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onMediaPipeResults(results));
        this.mediaPipeInicializado = true;
        resolve();
      } catch (error) {
        this.mediaPipeInicializado = false;
        reject(error);
      }
    });
  }

  private onMediaPipeResults(results: Results): void {
    const canvas = this.canvasElement?.nativeElement;
    const ctx = canvas?.getContext('2d');
    const video = this.videoElement?.nativeElement;

    if (!canvas || !ctx || !video || video.readyState < 2) {
      return;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    this.manosDetectadas = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    this.manoDetectada = this.manosDetectadas > 0;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const colors = ['#00FF00', '#FF00FF'];

      results.multiHandLandmarks.forEach((landmarks, index) => {
        const color = colors[index] || '#00FF00';
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color, lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color, lineWidth: 1, radius: 3 });
      });

      this.capturarYEnviarFrame(results.multiHandLandmarks);
    }

    this.cdr.markForCheck();
  }

  private esSenaDinamica(): boolean {
    const objetivo = (this.senaObjetivo || '').trim();
    if (objetivo.length > 1) return true;
    return this.tipoContenido === 'comunes';
  }

  private capturarYEnviarFrame(landmarks: any[]): void {
    if (!this.reconocimientoActivo || this.pausado) return;

    const ahora = Date.now();
    if (ahora - this.ultimoFrameEnviado < this.minIntervaloEntreFrames) return;

    const frameBase64 = this.capturarFrameDesdeVideo();
    if (!frameBase64) return;

    if (this.esSenaDinamica()) {
      this.reconocimientoService.agregarFrame(frameBase64);
    } else {
      const landmarksSimplificados = this.extraerLandmarksSimplificados(landmarks);
      this.reconocimientoService.agregarFrame(frameBase64, landmarksSimplificados);
    }

    this.ultimoFrameEnviado = ahora;
  }

  private extraerLandmarksSimplificados(landmarks: any[]): any[] {
    return landmarks.map(mano => {
      const puntos = Array.isArray(mano) ? mano : [];
      return puntos.slice(0, 21).map((punto: any) => ({
        x: Number(punto.x) || 0,
        y: Number(punto.y) || 0,
        z: Number(punto.z) || 0
      }));
    });
  }

  private capturarFrameDesdeVideo(): string | null {
    const video = this.videoElement?.nativeElement;
    if (!video) return null;

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 256;
      tempCanvas.height = 256;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return null;

      tempCtx.drawImage(video, 0, 0, 256, 256);

      const calidad = this.esSenaDinamica() ? 0.85 : 0.7;
      return tempCanvas.toDataURL('image/jpeg', calidad);
    } catch (error) {
      return null;
    }
  }

  private iniciarProcesamientoMediaPipe(): void {
    if (!this.videoElement?.nativeElement || !this.hands) return;

    if (this.camera) {
      try { this.camera.stop(); } catch (e) { }
      this.camera = undefined;
    }

    this.frameEnProceso = false;
    this.ultimoFrameProcesadoMP = 0;

    try {
      this.camera = new Camera(this.videoElement.nativeElement, {
        onFrame: async () => {
          if (!this.reconocimientoActivo || this.pausado || !this.hands) return;

          if (this.frameEnProceso) return;

          const ahora = Date.now();
          if (ahora - this.ultimoFrameProcesadoMP < this.minIntervaloProcesamientoMP) return;

          const video = this.videoElement?.nativeElement;
          if (!video || video.readyState < 2) return;

          this.frameEnProceso = true;
          this.ultimoFrameProcesadoMP = ahora;

          try {
            await this.hands.send({ image: video });
          } catch (error) {
          } finally {
            this.frameEnProceso = false;
          }
        },
        width: 640,
        height: 480
      });

      this.camera.start();
    } catch (error) { }
  }

  async iniciarReconocimiento(): Promise<void> {
    try {
      if (!this.categoriaIdInterno && this.categoriasDisponibles.length > 0) {
        this.configurarCategoriaAutomatica();
      }

      if (!this.categoriaIdInterno) {
        this.categoriaIdInterno = 1;
        this.reconocimientoService.establecerCategoria(1);
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

      await new Promise(resolve => setTimeout(resolve, 300));
      await this.precalentarModelo();

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

      this.iniciarTemporizador();
      this.iniciarProcesamientoMediaPipe();

    } catch (error: any) {
      this.error = 'Error al iniciar reconocimiento';
      this.errorDetalle = error.message;
      this.reconocimientoActivo = false;
      this.cdr.detectChanges();
    }
  }

  private async precalentarModelo(): Promise<void> {
    if (!this.videoElement?.nativeElement) return;

    try {
      for (let i = 0; i < 3; i++) {
        const frameBase64 = this.capturarFrameDesdeVideo();
        if (frameBase64) {
          if (this.esSenaDinamica()) {
            this.reconocimientoService.agregarFrame(frameBase64);
          } else {
            this.reconocimientoService.agregarFrame(frameBase64, []);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.reconocimientoService.limpiarBuffer();
    } catch (error) { }
  }

  private procesarResultadoVideo(resultado: ResultadoReconocimientoVideo): void {
    if (!this.reconocimientoActivo || this.pausado) return;

    this.senaDetectada = (resultado.sena_detectada || '').trim().toUpperCase();
    this.confianza = resultado.confianza || 0;

    this.verificarDeteccionSimple();
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
    if (this.ultimasSenasDetectadas.length > 3) {
      this.ultimasSenasDetectadas.shift();
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

    this.mostrarFeedbackTemporal('exito', `¡Correcto! Seña ${this.senaObjetivo} detectada`);

    this.resultadoEmitido.emit({
      exito: true,
      precision: this.confianza,
      sena_reconocida: this.senaObjetivo,
      tiempo: Math.floor((Date.now() - this.tiempoInicio) / 1000),
      intentos: this.intentos,
      mensaje: 'Reconocimiento exitoso',
      modo: 'video',
      categoria_id: this.categoriaIdInterno,
      tipo_contenido: this.tipoContenido,
      categoria_nombre: this.categoriaSeleccionada?.nombre,
      modelo_usado: this.modeloNombreInterno
    });

    if (this.modoContinuo) {
      this.deteccionesConsecutivas = 0;
      this.senaDetectada = '';
      this.confianza = 0;
    }
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
        categoria_id: this.categoriaIdInterno,
        tipo_contenido: this.tipoContenido,
        categoria_nombre: this.categoriaSeleccionada?.nombre,
        modelo_usado: this.modeloNombreInterno
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
        this.iniciarProcesamientoMediaPipe();
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

    if (this.camera) {
      try {
        this.camera.stop();
      } catch (error) { }
      this.camera = undefined;
    }

    if (this.hands) {
      try {
        this.hands.close();
      } catch (error) { }
      this.hands = undefined;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (this.streamActivo) {
      try {
        this.streamActivo.getTracks().forEach(track => {
          track.stop();
        });
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
    this.frameEnProceso = false;
    this.ultimoFrameProcesadoMP = 0;
    this.inicializacionEnProgreso = false;
    this.mediaPipeInicializado = false;
  }

  cancelarPractica(): void {
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
      categoria_id: this.categoriaIdInterno,
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
    const usuario = this.autenticacionService.usuarioActualValor;
    if (!usuario) return 'Configuración estándar';

    const edad = usuario.fecha_nacimiento
      ? this.autenticacionService.calcularEdad(usuario.fecha_nacimiento)
      : null;

    return `${this.configuracionTiempo.descripcion}${edad ? ` (${edad} años)` : ''}`;
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
    return this.categoriaValidadaInternamente &&
      this.modeloValidadoInternamente &&
      !this.cargando &&
      !this.inicializacionEnProgreso;
  }

  get infoCategoria(): string {
    if (!this.categoriaSeleccionada) return 'Sin categoría';
    return this.categoriaSeleccionada.nombre;
  }

  get infoModelo(): string {
    return this.modeloNombreInterno || 'Modelo global';
  }

  toggleInstrucciones(): void {
    this.instruccionesAbiertas = !this.instruccionesAbiertas;
  }
}
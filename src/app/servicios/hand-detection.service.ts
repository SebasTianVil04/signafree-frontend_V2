import { Injectable } from '@angular/core';

const MEDIAPIPE_HANDS_VERSION = '0.4.1675469240';

declare global {
  interface Window {
    Hands?: any;
    HAND_CONNECTIONS?: any;
    drawConnectors?: any;
    drawLandmarks?: any;
    Camera?: any;
    SelfieSegmentation?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class HandDetectionService {
  private hands: any = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;
  private isDetecting: boolean = false;
  private onResultsCallback: ((results: any) => void) | null = null;
  private animationFrameId: number | null = null;
  private envioEnCurso: Promise<void> | null = null;
  private cerrando: boolean = false;
  private avisoDrawingUtilsMostrado: boolean = false;
  private dibujarActivo: boolean = true;

  private ultimosResultados: any = null;
  private ultimoResultadoMs: number = 0;
  private inicioEnvioMs: number = 0;
  private ultimoTiempoVideo: number = -1;
  private huboResultado: boolean = false;
  private recuperando: boolean = false;

  private readonly TIMEOUT_ENVIO_MS = 3000;
  private readonly TIMEOUT_PRIMER_ENVIO_MS = 20000;
  private readonly VIGENCIA_RESULTADOS_MS = 500;

  constructor() {}

  setDibujarLandmarks(valor: boolean): void {
    this.dibujarActivo = valor;
  }

  async inicializarDetector(): Promise<any> {
    if (this.hands && this.isInitialized) {
      return this.hands;
    }

    const HandsClass = (window as any).Hands;
    if (!HandsClass) {
      throw new Error(
        'MediaPipe Hands no está disponible. Verifica que el script se cargue en index.html antes de Angular.'
      );
    }

    try {
      this.hands = new HandsClass({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isInitialized = true;
      return this.hands;
    } catch (error) {
      console.error('Error inicializando detector:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async iniciarDeteccion(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onResultsCallback?: (results: any) => void
  ): Promise<void> {
    if (this.isDetecting) {
      await this.detenerDeteccion();
    }

    this.cerrando = false;

    if (!this.hands || !this.isInitialized) {
      await this.inicializarDetector();
    }

    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasCtx = canvasElement.getContext('2d');
    this.onResultsCallback = onResultsCallback || null;
    this.ultimosResultados = null;
    this.ultimoResultadoMs = 0;
    this.ultimoTiempoVideo = -1;
    this.huboResultado = false;
    this.recuperando = false;

    if (!this.canvasCtx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }

    this.ajustarTamañoCanvas();
    this.registrarResultados();

    this.isDetecting = true;
    this.procesarFrames();
  }

  private registrarResultados(): void {
    if (!this.hands) return;

    this.hands.onResults((results: any) => {
      if (!this.isDetecting || this.cerrando) return;
      this.huboResultado = true;
      this.ultimosResultados = results;
      this.ultimoResultadoMs = performance.now();
      if (this.onResultsCallback) {
        this.onResultsCallback(results);
      }
    });
  }

  private ajustarTamañoCanvas(): void {
    if (!this.videoElement || !this.canvasElement) return;

    const canvas = this.canvasElement;
    const ancho = this.videoElement.videoWidth;
    const alto = this.videoElement.videoHeight;

    if (ancho > 0 && alto > 0) {
      if (canvas.width !== ancho) canvas.width = ancho;
      if (canvas.height !== alto) canvas.height = alto;
    } else if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = 640;
      canvas.height = 480;
    }
  }

  private procesarFrames(): void {
    const detectar = () => {
      if (!this.isDetecting || this.cerrando || !this.videoElement) {
        return;
      }

      const video = this.videoElement;

      this.ajustarTamañoCanvas();
      this.dibujarFrame();

      if (this.envioEnCurso) {
        const limite = this.huboResultado ? this.TIMEOUT_ENVIO_MS : this.TIMEOUT_PRIMER_ENVIO_MS;
        if (performance.now() - this.inicioEnvioMs > limite) {
          void this.recuperarDetector();
        }
      }

      if (
        this.hands &&
        !this.envioEnCurso &&
        !this.recuperando &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        video.currentTime !== this.ultimoTiempoVideo
      ) {
        this.ultimoTiempoVideo = video.currentTime;
        this.inicioEnvioMs = performance.now();

        const envio: Promise<void> = this.hands.send({ image: video })
          .catch((error: any) => {
            console.warn('Error enviando frame a MediaPipe:', error);
          })
          .finally(() => {
            if (this.envioEnCurso === envio) {
              this.envioEnCurso = null;
            }
          });

        this.envioEnCurso = envio;
      }

      if (this.isDetecting && !this.cerrando) {
        this.animationFrameId = requestAnimationFrame(detectar);
      }
    };

    detectar();
  }

  private async recuperarDetector(): Promise<void> {
    if (this.recuperando || this.cerrando) return;

    this.recuperando = true;
    console.warn('MediaPipe dejó de responder. Reiniciando el detector...');

    const anterior = this.hands;
    this.hands = null;
    this.isInitialized = false;
    this.envioEnCurso = null;
    this.huboResultado = false;

    try {
      Promise.resolve(anterior?.close()).catch(() => {});
    } catch {}

    try {
      await this.inicializarDetector();
      if (this.isDetecting && !this.cerrando) {
        this.registrarResultados();
      }
    } catch (error) {
      console.warn('No se pudo reiniciar el detector:', error);
    } finally {
      this.recuperando = false;
    }
  }

  private dibujarFrame(): void {
    const ctx = this.canvasCtx;
    const canvas = this.canvasElement;
    const video = this.videoElement;

    if (!ctx || !canvas || !video || video.readyState < 2) return;

    try {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const resultados = this.ultimosResultados;
      if (
        this.dibujarActivo &&
        resultados &&
        performance.now() - this.ultimoResultadoMs < this.VIGENCIA_RESULTADOS_MS
      ) {
        this.dibujarLandmarks(resultados);
      }

      ctx.restore();
    } catch (error) {
      console.warn('Error dibujando resultados:', error);
    }
  }

  private dibujarLandmarks(results: any): void {
    if (!this.canvasCtx) return;

    const drawConnectors = (window as any).drawConnectors;
    const drawLandmarks = (window as any).drawLandmarks;
    const handConnections = (window as any).HAND_CONNECTIONS;

    if ((!drawConnectors || !drawLandmarks || !handConnections) && !this.avisoDrawingUtilsMostrado) {
      console.warn('drawing_utils no disponible. Se usarán dibujos con canvas puro.');
      this.avisoDrawingUtilsMostrado = true;
    }

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

    for (let index = 0; index < results.multiHandLandmarks.length; index++) {
      const landmarks = results.multiHandLandmarks[index];
      const handedness = results.multiHandedness?.[index]?.label || 'Unknown';
      const score = results.multiHandedness?.[index]?.score ?? 0;

      const esConfiable = score >= 0.75;
      const connectionColor = !esConfiable ? '#888888' : (handedness === 'Right' ? '#00FF00' : '#00FFFF');
      const landmarkColor = !esConfiable ? '#555555' : (handedness === 'Right' ? '#FF0000' : '#FF00FF');

      if (drawConnectors && drawLandmarks && handConnections) {
        drawConnectors(
          this.canvasCtx,
          landmarks,
          handConnections,
          { color: connectionColor, lineWidth: 2 }
        );
        drawLandmarks(
          this.canvasCtx,
          landmarks,
          { color: landmarkColor, fillColor: landmarkColor, lineWidth: 1, radius: 2 }
        );
      } else {
        this.dibujarPuntosCanvasPuro(landmarks, connectionColor, landmarkColor);
      }
    }
  }

  private dibujarPuntosCanvasPuro(landmarks: any[], connectionColor: string, landmarkColor: string): void {
    if (!this.canvasCtx) return;

    const canvas = this.canvasCtx.canvas;

    const conexiones: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

    this.canvasCtx.strokeStyle = connectionColor;
    this.canvasCtx.lineWidth = 2;
    for (const [a, b] of conexiones) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) continue;
      this.canvasCtx.beginPath();
      this.canvasCtx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
      this.canvasCtx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
      this.canvasCtx.stroke();
    }

    this.canvasCtx.fillStyle = landmarkColor;
    for (const p of landmarks) {
      this.canvasCtx.beginPath();
      this.canvasCtx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, 2 * Math.PI);
      this.canvasCtx.fill();
    }
  }

  async detenerDeteccion(): Promise<void> {
    if (this.cerrando) return;
    this.cerrando = true;
    this.isDetecting = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.canvasCtx) {
      try {
        const canvas = this.canvasCtx.canvas;
        this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      } catch {}
    }

    if (this.envioEnCurso) {
      await Promise.race([
        this.envioEnCurso,
        new Promise(resolve => setTimeout(resolve, 300))
      ]);
    }

    if (this.hands) {
      const handsRef = this.hands;
      this.hands = null;
      try {
        handsRef.close();
      } catch (error) {
        console.warn('Error cerrando Hands:', error);
      }
    }

    this.canvasCtx = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.onResultsCallback = null;
    this.isInitialized = false;
    this.envioEnCurso = null;
    this.ultimosResultados = null;
    this.ultimoResultadoMs = 0;
    this.ultimoTiempoVideo = -1;
    this.huboResultado = false;
    this.recuperando = false;
    this.cerrando = false;
  }

  verificarManoDetectada(results: any): boolean {
    if (!results?.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return false;
    }

    const scores = results.multiHandedness?.map((h: any) => h.score ?? 0) ?? [];
    return scores.some((s: number) => s >= 0.75);
  }

  obtenerLandmarksConSlotsFijos(results: any): any[] {
    const lms = results?.multiHandLandmarks || [];
    const handedness = results?.multiHandedness || [];

    const slots: any[] = [[], []];

    for (let i = 0; i < lms.length; i++) {
      const label = (handedness[i]?.label || '').toString();
      if (label === 'Right' && slots[0].length === 0) {
        slots[0] = lms[i];
      } else if (label === 'Left' && slots[1].length === 0) {
        slots[1] = lms[i];
      }
    }

    return slots;
  }

  convertirSlotsASimplificados(slots: any[]): any[] {
    return slots.map(mano => {
      const puntos = Array.isArray(mano) ? mano : [];
      return puntos.slice(0, 21).map((punto: any) => ({
        x: Number(punto.x) || 0,
        y: Number(punto.y) || 0,
        z: Number(punto.z) || 0
      }));
    });
  }

  calcularCentroMano(landmarks: any[]): { x: number, y: number } {
    if (!landmarks || landmarks.length === 0) {
      return { x: 0, y: 0 };
    }

    let sumX = 0;
    let sumY = 0;

    for (const landmark of landmarks) {
      sumX += landmark.x;
      sumY += landmark.y;
    }

    return { x: sumX / landmarks.length, y: sumY / landmarks.length };
  }
}
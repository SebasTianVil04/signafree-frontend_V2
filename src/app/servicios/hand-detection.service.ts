import { Injectable } from '@angular/core';

const MEDIAPIPE_HANDS_VERSION = '0.4.1675469240';

@Injectable({
  providedIn: 'root'
})
export class HandDetectionService {
  private hands: any = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private drawingUtils: any = null;
  private handsModule: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;
  private isDetecting: boolean = false;
  private onResultsCallback: ((results: any) => void) | null = null;
  private animationFrameId: number | null = null;
  private envioEnCurso: Promise<void> | null = null;
  private cerrando: boolean = false;

  constructor() {}

  async inicializarDetector(): Promise<any> {
    if (this.hands && this.isInitialized) {
      return this.hands;
    }

    try {
      this.handsModule = await import('@mediapipe/hands');

      this.hands = new this.handsModule.Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
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

    if (!this.canvasCtx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }

    this.ajustarTamañoCanvas();

    this.drawingUtils = await import('@mediapipe/drawing_utils');

    this.hands.onResults((results: any) => {
      if (!this.isDetecting || this.cerrando) return;
      this.dibujarResultados(results, canvasElement);
      if (this.onResultsCallback) {
        this.onResultsCallback(results);
      }
    });

    this.isDetecting = true;
    this.procesarFrames();
  }

  private ajustarTamañoCanvas(): void {
    if (!this.videoElement || !this.canvasElement) return;

    const ancho = this.videoElement.videoWidth;
    const alto = this.videoElement.videoHeight;

    if (ancho > 0 && alto > 0) {
      this.canvasElement.width = ancho;
      this.canvasElement.height = alto;
    } else if (this.canvasElement.width === 0 || this.canvasElement.height === 0) {
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
    }
  }

  private procesarFrames(): void {
    const detectar = async () => {
      if (!this.isDetecting || this.cerrando || !this.videoElement || !this.hands) {
        return;
      }

      if (!this.envioEnCurso && this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
        this.ajustarTamañoCanvas();
        this.envioEnCurso = this.hands.send({ image: this.videoElement })
          .catch((error: any) => {
            console.warn('Error enviando frame a MediaPipe:', error);
          })
          .finally(() => {
            this.envioEnCurso = null;
          });
      }

      if (this.isDetecting && !this.cerrando) {
        this.animationFrameId = requestAnimationFrame(() => detectar());
      }
    };

    detectar();
  }

  private dibujarResultados(results: any, canvas: HTMLCanvasElement): void {
    if (!this.canvasCtx || !this.isDetecting) return;

    try {
      this.canvasCtx.save();
      this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.image) {
        this.canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      }

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
          const landmarks = results.multiHandLandmarks[index];
          const handedness = results.multiHandedness?.[index]?.label || 'Unknown';
          const score = results.multiHandedness?.[index]?.score ?? 0;

          const esConfiable = score >= 0.75;
          const connectionColor = !esConfiable ? '#888888' : (handedness === 'Right' ? '#00FF00' : '#00FFFF');
          const landmarkColor = !esConfiable ? '#555555' : (handedness === 'Right' ? '#FF0000' : '#FF00FF');

          if (this.drawingUtils && this.handsModule) {
            this.drawingUtils.drawConnectors(
              this.canvasCtx,
              landmarks,
              this.handsModule.HAND_CONNECTIONS,
              { color: connectionColor, lineWidth: 2 }
            );

            this.drawingUtils.drawLandmarks(
              this.canvasCtx,
              landmarks,
              { color: landmarkColor, fillColor: landmarkColor, lineWidth: 1, radius: 2 }
            );
          }
        }
      }

      this.canvasCtx.restore();

      if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandedness.length; i++) {
          const handedness = results.multiHandedness[i];
          const landmarks = results.multiHandLandmarks[i];

          if (landmarks && landmarks[0]) {
            const wrist = landmarks[0];
            const x = wrist.x * canvas.width;
            const y = wrist.y * canvas.height;

            this.canvasCtx.fillStyle = '#FFFFFF';
            this.canvasCtx.strokeStyle = '#000000';
            this.canvasCtx.lineWidth = 3;
            this.canvasCtx.font = 'bold 16px Arial';

            const score = handedness.score ?? 0;
            const text = `${handedness.label} (${Math.round(score * 100)}%)`;
            this.canvasCtx.strokeText(text, x - 40, y - 10);
            this.canvasCtx.fillText(text, x - 40, y - 10);
          }
        }
      }
    } catch (error) {
      console.warn('Error dibujando resultados:', error);
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
      } catch {
      }
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
    this.drawingUtils = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.onResultsCallback = null;
    this.isInitialized = false;
    this.handsModule = null;
    this.envioEnCurso = null;
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
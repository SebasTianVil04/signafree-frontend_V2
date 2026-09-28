import { Injectable } from '@angular/core';

interface Punto {
  x: number;
  y: number;
}

interface Mascara {
  puntos: Punto[];
  ancho: number;
  alto: number;
}

@Injectable({
  providedIn: 'root'
})
export class PrivacyFilterService {
  private canvas: HTMLCanvasElement = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D = this.canvas.getContext('2d')!;

  private historial: Mascara[][] = [];
  private video: HTMLVideoElement | null = null;
  private renderFrameId: number | null = null;
  private resultadosSinMano = 0;

  private readonly RESULTADOS_EN_HISTORIAL = 3;
  private readonly RESULTADOS_SIN_MANO_TOLERADOS = 8;
  private readonly MARGEN = 0.25;
  private readonly MARGEN_MINIMO_PX = 16;

  actualizarMascara(results: any): void {
    const manos: any[][] = results?.multiHandLandmarks ?? [];

    const mascaras: Mascara[] = manos.map(landmarks => {
      const pts: Punto[] = landmarks.map((p: any) => ({ x: p.x, y: p.y }));
      const puntos = this.envolventeConvexa(pts);
      const xs = puntos.map(p => p.x);
      const ys = puntos.map(p => p.y);

      return {
        puntos,
        ancho: Math.max(...xs) - Math.min(...xs),
        alto: Math.max(...ys) - Math.min(...ys)
      };
    });

    if (mascaras.length === 0) {
      this.resultadosSinMano++;
      if (this.resultadosSinMano > this.RESULTADOS_SIN_MANO_TOLERADOS) {
        this.historial = [];
      }
      return;
    }

    this.resultadosSinMano = 0;
    this.historial.push(mascaras);
    if (this.historial.length > this.RESULTADOS_EN_HISTORIAL) {
      this.historial.shift();
    }
  }

  iniciarRender(video: HTMLVideoElement): void {
    this.detenerRender();
    this.video = video;
    this.dibujar();

    const bucle = () => {
      if (!this.video) return;
      this.dibujar();
      this.renderFrameId = requestAnimationFrame(bucle);
    };
    this.renderFrameId = requestAnimationFrame(bucle);
  }

  detenerRender(): void {
    if (this.renderFrameId !== null) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
    this.video = null;
  }

  obtenerStream(fps: number = 30): MediaStream {
    return this.canvas.captureStream(fps);
  }

  reiniciar(): void {
    this.historial = [];
    this.resultadosSinMano = 0;
  }

  private dibujar(): void {
    const video = this.video;
    if (!video || video.readyState < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineJoin = 'round';
    for (const mascaras of this.historial) {
      for (const m of mascaras) {
        const tam = Math.max(m.ancho * w, m.alto * h);
        const pad = Math.max(this.MARGEN_MINIMO_PX, tam * this.MARGEN);

        ctx.beginPath();
        m.puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)));
        ctx.closePath();
        ctx.lineWidth = pad * 2;
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(video, 0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'source-over';
  }

  private envolventeConvexa(puntos: Punto[]): Punto[] {
    const p = [...puntos].sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;

    const cruz = (o: Punto, a: Punto, b: Punto) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const inferior: Punto[] = [];
    for (const q of p) {
      while (inferior.length >= 2 && cruz(inferior[inferior.length - 2], inferior[inferior.length - 1], q) <= 0) {
        inferior.pop();
      }
      inferior.push(q);
    }

    const superior: Punto[] = [];
    for (const q of [...p].reverse()) {
      while (superior.length >= 2 && cruz(superior[superior.length - 2], superior[superior.length - 1], q) <= 0) {
        superior.pop();
      }
      superior.push(q);
    }

    inferior.pop();
    superior.pop();
    return inferior.concat(superior);
  }
}
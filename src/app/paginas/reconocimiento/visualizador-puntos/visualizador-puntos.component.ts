import { Component, OnInit, ViewChild, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

interface Punto {
  x: number;
  y: number;
  z?: number;
}

@Component({
  selector: 'app-visualizador-puntos',
  templateUrl: './visualizador-puntos.component.html',
  styleUrls: ['./visualizador-puntos.component.scss'],
  standalone: false 
})
export class VisualizadorPuntosComponent implements OnInit, OnChanges {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() puntos: Punto[] = [];
  @Input() ancho: number = 640;
  @Input() alto: number = 480;

  private ctx!: CanvasRenderingContext2D;

  // Conexiones de la mano según MediaPipe Hand Landmarks
  private conexiones = [
    [0, 1], [1, 2], [2, 3], [3, 4],  
    [0, 5], [5, 6], [6, 7], [7, 8],     
    [0, 9], [9, 10], [10, 11], [11, 12], 
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], 
    [5, 9], [9, 13], [13, 17]          
  ];

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    canvas.width = this.ancho;
    canvas.height = this.alto;
    this.dibujar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['puntos'] && !changes['puntos'].firstChange) {
      this.dibujar();
    }
  }

  dibujar(): void {
    if (!this.ctx) return;

    // Limpiar canvas
    this.ctx.clearRect(0, 0, this.ancho, this.alto);

    if (!this.puntos || this.puntos.length === 0) {
      this.dibujarMensaje('No hay puntos para visualizar');
      return;
    }

    // Dibujar conexiones
    this.ctx.strokeStyle = '#00BCD4';
    this.ctx.lineWidth = 2;
    
    this.conexiones.forEach(([inicio, fin]) => {
      if (this.puntos[inicio] && this.puntos[fin]) {
        this.ctx.beginPath();
        this.ctx.moveTo(
          this.puntos[inicio].x * this.ancho,
          this.puntos[inicio].y * this.alto
        );
        this.ctx.lineTo(
          this.puntos[fin].x * this.ancho,
          this.puntos[fin].y * this.alto
        );
        this.ctx.stroke();
      }
    });

    // Dibujar puntos
    this.puntos.forEach((punto, index) => {
      const x = punto.x * this.ancho;
      const y = punto.y * this.alto;

      // Color según el dedo
      if (index === 0) {
        this.ctx.fillStyle = '#FF5722'; 
      } else if (index <= 4) {
        this.ctx.fillStyle = '#4CAF50'; 
      } else if (index <= 8) {
        this.ctx.fillStyle = '#2196F3';
      } else if (index <= 12) {
        this.ctx.fillStyle = '#9C27B0'; 
      } else if (index <= 16) {
        this.ctx.fillStyle = '#FF9800'; 
      } else {
        this.ctx.fillStyle = '#F44336'; 
      }

      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
      this.ctx.fill();

      // Número del punto
      this.ctx.fillStyle = 'white';
      this.ctx.font = '10px Arial';
      this.ctx.fillText(index.toString(), x - 3, y + 3);
    });
  }

  dibujarMensaje(mensaje: string): void {
    this.ctx.fillStyle = '#666';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(mensaje, this.ancho / 2, this.alto / 2);
  }

  descargarImagen(): void {
    const canvas = this.canvasRef.nativeElement;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'puntos-mano.png';
    link.href = url;
    link.click();
  }
}
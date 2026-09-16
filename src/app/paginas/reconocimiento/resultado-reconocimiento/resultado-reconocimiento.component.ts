import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ResultadoReconocimiento } from '../../../modelos';

@Component({
  selector: 'app-resultado-reconocimiento',
  templateUrl: './resultado-reconocimiento.component.html',
  styleUrls: ['./resultado-reconocimiento.component.scss'],
  standalone: false
})
export class ResultadoReconocimientoComponent {
  @Input() resultado: ResultadoReconocimiento | null = null;
  @Input() mostrarPuntos: boolean = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() intentarNuevamente = new EventEmitter<void>();

  get nivelConfianza(): string {
    if (!this.resultado) return 'bajo';
    const confianza = this.resultado.confianza * 100;
    if (confianza >= 80) return 'alto';
    if (confianza >= 60) return 'medio';
    return 'bajo';
  }

  get colorConfianza(): string {
    switch (this.nivelConfianza) {
      case 'alto': return '#4CAF50';
      case 'medio': return '#FF9800';
      case 'bajo': return '#f44336';
      default: return '#666';
    }
  }

  get mensajeConfianza(): string {
    switch (this.nivelConfianza) {
      case 'alto': return '¡Excelente reconocimiento!';
      case 'medio': return 'Reconocimiento aceptable';
      case 'bajo': return 'Baja confianza, intenta nuevamente';
      default: return '';
    }
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  onIntentarNuevamente(): void {
    this.intentarNuevamente.emit();
  }

  compartirResultado(): void {
    if (this.resultado) {
      const texto = `Seña reconocida: ${this.resultado.senaDetectada} con ${(this.resultado.confianza * 100).toFixed(1)}% de confianza`;
      
      if (navigator.share) {
        navigator.share({
          title: 'Resultado de Reconocimiento',
          text: texto
        }).catch(err => console.log('Error al compartir:', err));
      } else {
        navigator.clipboard.writeText(texto).then(() => {
          alert('Resultado copiado al portapapeles');
        });
      }
    }
  }
}
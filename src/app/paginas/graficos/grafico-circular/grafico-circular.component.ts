// src/app/paginas/graficos/grafico-circular/grafico-circular.component.ts
import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-grafico-circular',
  templateUrl: './grafico-circular.component.html',
  styleUrls: ['./grafico-circular.component.scss'],
  standalone: false 
})
export class GraficoCircularComponent implements OnInit, OnChanges {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() datos: number[] = [];
  @Input() etiquetas: string[] = [];
  @Input() titulo: string = 'Gráfico Circular';
  @Input() colores: string[] = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6c757d'];
  @Input() tipo: 'pie' | 'doughnut' = 'doughnut';
  
  private chart: Chart | null = null;

  ngOnInit(): void {
    this.crearGrafico();
  }

  ngOnChanges(): void {
    if (this.chart) {
      this.actualizarGrafico();
    }
  }

  crearGrafico(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: this.tipo,
      data: {
        labels: this.etiquetas,
        datasets: [{
          data: this.datos,
          backgroundColor: this.colores,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          },
          title: {
            display: true,
            text: this.titulo,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: any) => a + b, 0);
                const porcentaje = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${porcentaje}%)`;
              }
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  actualizarGrafico(): void {
    if (this.chart) {
      this.chart.data.labels = this.etiquetas;
      this.chart.data.datasets[0].data = this.datos;
      this.chart.update();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
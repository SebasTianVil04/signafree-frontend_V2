// src/app/paginas/graficos/grafico-estadisticas/grafico-estadisticas.component.ts
import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-grafico-estadisticas',
  templateUrl: './grafico-estadisticas.component.html',
  styleUrls: ['./grafico-estadisticas.component.scss'],
  standalone: false
})
export class GraficoEstadisticasComponent implements OnInit, OnChanges {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() datos: number[] = [];
  @Input() etiquetas: string[] = [];
  @Input() titulo: string = 'Gráfico de Estadísticas';
  @Input() tipo: 'bar' | 'line' = 'bar';
  @Input() color: string = '#0d6efd';
  @Input() label: string = 'Datos';
  
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
          label: this.label,
          data: this.datos,
          backgroundColor: this.tipo === 'bar' ? this.color : 'rgba(13, 110, 253, 0.2)',
          borderColor: this.color,
          borderWidth: 2,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: this.titulo,
            font: { size: 16, weight: 'bold' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
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
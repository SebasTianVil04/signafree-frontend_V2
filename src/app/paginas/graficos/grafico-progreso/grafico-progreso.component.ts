// src/app/paginas/graficos/grafico-progreso/grafico-progreso.component.ts
import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-grafico-progreso',
  templateUrl: './grafico-progreso.component.html',
  styleUrls: ['./grafico-progreso.component.scss'],
  standalone: false 
})
export class GraficoProgresoComponent implements OnInit, OnChanges {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() datos: number[] = [];
  @Input() etiquetas: string[] = [];
  @Input() titulo: string = 'Progreso de Usuarios';
  @Input() datasets: any[] = [];
  
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

    const datasetsConfig = this.datasets.length > 0 ? this.datasets : [
      {
        label: 'Progreso',
        data: this.datos,
        backgroundColor: 'rgba(13, 110, 253, 0.2)',
        borderColor: '#0d6efd',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }
    ];

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.etiquetas,
        datasets: datasetsConfig
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
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
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
      if (this.datasets.length > 0) {
        this.chart.data.datasets = this.datasets;
      } else {
        this.chart.data.datasets[0].data = this.datos;
      }
      this.chart.update();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
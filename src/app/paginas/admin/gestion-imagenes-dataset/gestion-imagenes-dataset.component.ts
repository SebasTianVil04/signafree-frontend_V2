import { Component, OnInit, effect } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { DatasetService, VideoDataset, CategoriaDataset } from '../../../servicios/dataset.service';
import { environment } from '../../../../environments/environment';

const QK_CATEGORIAS = ['categoriasDataset'] as const;
const QK_VIDEOS = ['todosLosVideosDataset'] as const;

const STALE_CATEGORIAS = 5 * 60 * 1000;
const STALE_VIDEOS = 15 * 1000;

@Component({
  selector: 'app-gestion-imagenes-dataset',
  templateUrl: './gestion-imagenes-dataset.component.html',
  styleUrls: ['./gestion-imagenes-dataset.component.scss'],
  standalone: false
})
export class GestionImagenesDatasetComponent implements OnInit {
  todosLosVideos: VideoDataset[] = [];
  videosFiltrados: VideoDataset[] = [];

  categorias: CategoriaDataset[] = [];
  categoriaFiltro: number | null = null;
  estadoFiltro: string | null = null;

  procesandoMasivo: boolean = false;
  error: string | null = null;
  mensaje: string | null = null;
  videoSeleccionado: VideoDataset | null = null;
  mostrarModal: boolean = false;
  private cacheUrlsSeguras = new Map<number, SafeResourceUrl>();

  opcionesEstado = [
    { valor: null, etiqueta: 'Todos los estados' },
    { valor: 'aprobado', etiqueta: 'Aprobados' },
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'rechazado', etiqueta: 'Rechazados' }
  ];

  private queryClient = injectQueryClient();

  private categoriasQuery = injectQuery(() => ({
    queryKey: QK_CATEGORIAS,
    queryFn: () => firstValueFrom(this.datasetService.listarCategorias()),
    staleTime: STALE_CATEGORIAS
  }));

  private videosQuery = injectQuery(() => ({
    queryKey: QK_VIDEOS,
    queryFn: () => firstValueFrom(this.datasetService.listarTodosLosVideos()),
    staleTime: STALE_VIDEOS
  }));

  constructor(private datasetService: DatasetService,
    private sanitizer: DomSanitizer) {
    effect(() => {
      const res = this.categoriasQuery.data();
      if (res?.exito && res.datos) {
        this.categorias = res.datos;
      }
    });

    effect(() => {
      const res = this.videosQuery.data();
      if (res?.exito && res.datos) {
        this.todosLosVideos = res.datos;
      } else if (res && !res.exito) {
        this.todosLosVideos = [];
      }
      this.aplicarFiltros();
    });

    effect(() => {
      if (this.videosQuery.isError()) {
        const err = this.videosQuery.error() as any;
        console.error('Error completo:', err);
        this.error = 'Error al cargar videos: ' + (err?.error?.mensaje || err?.message);
        this.todosLosVideos = [];
        this.videosFiltrados = [];
      }
    });
  }

  get cargando(): boolean {
    return this.categoriasQuery.isPending() || this.videosQuery.isPending();
  }

  ngOnInit(): void {
  }

  cargarCategorias(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
  }

  cargarTodosLosVideos(): void {
    this.error = null;
    this.mensaje = null;
    this.queryClient.invalidateQueries({ queryKey: QK_VIDEOS });
  }

  aplicarFiltros(): void {
    let videosFiltrados = [...this.todosLosVideos];

    if (this.categoriaFiltro !== null) {
      videosFiltrados = videosFiltrados.filter(
        video => video.categoria_id === this.categoriaFiltro
      );
    }

    if (this.estadoFiltro !== null) {
      if (this.estadoFiltro === 'aprobado') {
        videosFiltrados = videosFiltrados.filter(video => video.aprobado === true);
      } else if (this.estadoFiltro === 'pendiente') {
        videosFiltrados = videosFiltrados.filter(video => video.aprobado === false && !video.rechazado);
      } else if (this.estadoFiltro === 'rechazado') {
        videosFiltrados = videosFiltrados.filter(video => video.rechazado === true);
      }
    }

    this.videosFiltrados = videosFiltrados;
  }

  onCategoriaChange(): void {
    this.aplicarFiltros();
  }

  onEstadoChange(): void {
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.categoriaFiltro = null;
    this.estadoFiltro = null;
    this.aplicarFiltros();
  }

  verVideo(video: VideoDataset): void {
    this.videoSeleccionado = video;
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.videoSeleccionado = null;
  }

  esVideoDeDrive(video: VideoDataset): boolean {
    return !!(video.drive_file_id || video.drive_url);
  }

  obtenerUrlEmbedDrive(video: VideoDataset): string {
    if (video.drive_file_id) {
      return `https://drive.google.com/file/d/${video.drive_file_id}/preview`;
    }
    if (video.drive_url) {
      const match = video.drive_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }
    return '';
  }

  obtenerRutaVideo(video: VideoDataset): string | null {
    const posiblesPropiedades = [
      'ruta_video', 'ruta', 'path', 'url', 'video_path',
      'archivo', 'file', 'video_url', 'rutaVideo', 'video'
    ];

    for (const prop of posiblesPropiedades) {
      if ((video as any)[prop]) {
        return (video as any)[prop];
      }
    }
    return null;
  }

  construirUrlCompleta(ruta: string): string {
    if (!ruta) return '';
    if (ruta.startsWith('http')) return ruta;

    ruta = ruta.replace(/\\/g, '/');
    const urlBase = environment.apiUrl.split('/api')[0];

    if (ruta.startsWith('archivos_subidos/')) {
      return `${urlBase}/${ruta}`;
    }

    return `${urlBase}/uploads/${ruta}`;
  }

  obtenerUrlVideo(video: VideoDataset): string {
    if (this.esVideoDeDrive(video)) {
      return '';
    }
    const ruta = this.obtenerRutaVideo(video);
    return ruta ? this.construirUrlCompleta(ruta) : '';
  }

  tieneVideoDisponible(video: VideoDataset): boolean {
    return this.esVideoDeDrive(video) || !!this.obtenerUrlVideo(video);
  }

  obtenerUrlEmbedDriveSegura(video: VideoDataset): SafeResourceUrl {
    if (this.cacheUrlsSeguras.has(video.id)) {
      return this.cacheUrlsSeguras.get(video.id)!;
    }
    const url = this.obtenerUrlEmbedDrive(video);
    const urlSegura = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.cacheUrlsSeguras.set(video.id, urlSegura);
    return urlSegura;
  }

  obtenerEstadoVideo(video: VideoDataset): string {
    if (video.aprobado) return 'aprobado';
    if (video.rechazado) return 'rechazado';
    return 'pendiente';
  }

  obtenerClaseEstado(video: VideoDataset): string {
    const estado = this.obtenerEstadoVideo(video);
    switch (estado) {
      case 'aprobado': return 'badge bg-success';
      case 'rechazado': return 'badge bg-danger';
      case 'pendiente': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }

  aprobarVideo(video: VideoDataset): void {
    if (!confirm(`¿Aprobar el video de la seña "${video.sena}"?`)) {
      return;
    }

    this.datasetService.aprobarVideo(video.id, true).subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = 'Video aprobado exitosamente';
          this.queryClient.invalidateQueries({ queryKey: QK_VIDEOS });
          this.cerrarModal();
        } else {
          this.error = response.mensaje || 'Error al aprobar video';
        }
      },
      error: (err) => {
        this.error = 'Error al aprobar video: ' + (err.error?.mensaje || err.message);
        console.error(err);
      }
    });
  }

  rechazarVideo(video: VideoDataset): void {
    if (!confirm(`¿Rechazar el video de la seña "${video.sena}"?`)) {
      return;
    }

    this.datasetService.rechazarVideo(video.id).subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = 'Video rechazado';
          this.queryClient.invalidateQueries({ queryKey: QK_VIDEOS });
          this.cerrarModal();
        } else {
          this.error = response.mensaje || 'Error al rechazar video';
        }
      },
      error: (err) => {
        this.error = 'Error al rechazar video: ' + (err.error?.mensaje || err.message);
        console.error(err);
      }
    });
  }

  eliminarVideo(video: VideoDataset): void {
    if (!confirm(
      `¿Eliminar PERMANENTEMENTE el video de "${video.sena}"?\n\n` +
      `Esta acción eliminará:\n` +
      `• El archivo físico del servidor\n` +
      `• El registro de la base de datos\n\n` +
      `Esta acción NO se puede deshacer.`
    )) {
      return;
    }

    this.datasetService.eliminarVideo(video.id).subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = 'Video eliminado permanentemente';
          this.queryClient.invalidateQueries({ queryKey: QK_VIDEOS });
          this.cerrarModal();
        } else {
          this.error = response.mensaje || 'Error al eliminar video';
        }
      },
      error: (err) => {
        this.error = 'Error al eliminar video: ' + (err.error?.mensaje || err.message);
        console.error(err);
      }
    });
  }

  aprobarTodos(): void {
    if (this.videosFiltrados.length === 0) {
      this.mensaje = 'No hay videos para aprobar';
      return;
    }

    if (!confirm(`¿Aprobar los ${this.videosFiltrados.length} videos mostrados?`)) {
      return;
    }

    this.procesandoMasivo = true;
    this.aprobarEnLote(this.videosFiltrados);
  }

  eliminarTodos(): void {
    if (this.videosFiltrados.length === 0) {
      this.mensaje = 'No hay videos para eliminar';
      return;
    }

    if (!confirm(
      `⚠️ ADVERTENCIA ⚠️\n\n` +
      `¿Eliminar PERMANENTEMENTE los ${this.videosFiltrados.length} videos mostrados?\n\n` +
      `Esta acción:\n` +
      `• Eliminará los archivos físicos del servidor\n` +
      `• Eliminará los registros de la base de datos\n` +
      `• NO SE PUEDE DESHACER\n\n` +
      `¿Estás seguro de continuar?`
    )) {
      return;
    }

    const confirmacionFinal = prompt('Para confirmar, escribe "ELIMINAR" en mayúsculas:');
    if (confirmacionFinal !== 'ELIMINAR') {
      this.mensaje = 'Operación cancelada';
      return;
    }

    this.procesandoMasivo = true;
    this.eliminarEnLote(this.videosFiltrados);
  }

  private async aprobarEnLote(videos: VideoDataset[]): Promise<void> {
    let totalAprobados = 0;
    let totalErrores = 0;

    for (const video of videos) {
      try {
        const response = await this.datasetService
          .aprobarVideo(video.id, true)
          .toPromise();

        if (response?.exito) {
          totalAprobados++;
        } else {
          totalErrores++;
        }

        this.mensaje = `Procesando: ${totalAprobados + totalErrores}/${videos.length} (${totalAprobados} exitosos)`;
      } catch (error) {
        console.error(`Error aprobando video ${video.id}:`, error);
        totalErrores++;
      }
    }

    this.procesandoMasivo = false;
    this.mensaje = `Se aprobaron ${totalAprobados} videos. Errores: ${totalErrores}`;
    this.queryClient.invalidateQueries({ queryKey: QK_VIDEOS });
  }

  private async eliminarEnLote(videos: VideoDataset[]): Promise<void> {
    let totalEliminados = 0;
    let totalErrores = 0;

    for (const video of videos) {
      try {
        const response = await this.datasetService
          .eliminarVideo(video.id)
          .toPromise();

        if (response?.exito) {
          totalEliminados++;
        } else {
          totalErrores++;
        }

        this.mensaje = `Eliminando: ${totalEliminados + totalErrores}/${videos.length} (${totalEliminados} eliminados)`;
      } catch (error) {
        console.error(`Error eliminando video ${video.id}:`, error);
        totalErrores++;
      }
    }

    this.procesandoMasivo = false;
    this.mensaje = `Se eliminaron ${totalEliminados} videos permanentemente. Errores: ${totalErrores}`;
    this.queryClient.invalidateQueries({ queryKey: QK_VIDEOS });
  }

  manejarErrorVideo(event: any, video: VideoDataset): void {
    console.error('Error cargando video:', video, event);
    const videoElement = event.target as HTMLVideoElement;
    videoElement.style.display = 'none';
  }

  get totalVideos(): number {
    return this.videosFiltrados.length;
  }

  get estadisticas() {
    return {
      total: this.todosLosVideos.length,
      aprobados: this.todosLosVideos.filter(v => v.aprobado).length,
      pendientes: this.todosLosVideos.filter(v => !v.aprobado && !v.rechazado).length,
      rechazados: this.todosLosVideos.filter(v => v.rechazado).length,
      filtrados: this.videosFiltrados.length
    };
  }
}
import { Component, OnInit, effect } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { DatasetService, VideoDataset, CategoriaDataset } from '../../../servicios/dataset.service';
import { ArchivosService } from '../../../servicios/archivos.service';
import { CategoriaService } from '../../../servicios/categoria.service';

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
  descargandoZip: boolean = false;
  incluirDrive: boolean = false;
  error: string | null = null;
  mensaje: string | null = null;
  videoSeleccionado: VideoDataset | null = null;
  mostrarModal: boolean = false;
  urlVideoLocal: string | null = null;
  cargandoVideo: boolean = false;
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
    private sanitizer: DomSanitizer,
    private archivosService: ArchivosService,
    private categoriaService: CategoriaService) {
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
    this.urlVideoLocal = null;

    if (this.esVideoDeDrive(video)) {
      this.cargandoVideo = false;
      return;
    }

    this.cargandoVideo = true;
    this.archivosService.urlVideoDataset(video.id).subscribe({
      next: (respuesta) => {
        if (this.videoSeleccionado?.id !== video.id) return;
        this.urlVideoLocal = respuesta.url;
        this.cargandoVideo = false;
      },
      error: () => {
        if (this.videoSeleccionado?.id !== video.id) return;
        this.urlVideoLocal = null;
        this.cargandoVideo = false;
      }
    });
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.videoSeleccionado = null;
    this.urlVideoLocal = null;
    this.cargandoVideo = false;
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

  async descargarZip(): Promise<void> {
    if (this.descargandoZip) {
      return;
    }

    this.descargandoZip = true;
    this.error = null;
    this.mensaje = null;

    try {
      const blob = await firstValueFrom(
        this.categoriaService.descargarDatasetZip({
          categoria_id: this.categoriaFiltro ?? undefined,
          solo_aprobados: true,
          incluir_drive: this.incluirDrive
        })
      );

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = this.nombreArchivoZip();
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);

      this.mensaje = 'ZIP generado y descargado correctamente';
    } catch (err) {
      this.error = 'Error al descargar el ZIP: ' + await this.mensajeDeError(err);
    } finally {
      this.descargandoZip = false;
    }
  }

  private nombreArchivoZip(): string {
    const ahora = new Date();
    const dos = (n: number) => String(n).padStart(2, '0');
    const fecha = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}`;
    const hora = `${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
    return `dataset_signafree_${fecha}_${hora}.zip`;
  }

  private async mensajeDeError(err: any): Promise<string> {
    const cuerpo = err?.error;

    if (cuerpo instanceof Blob) {
      try {
        const texto = await cuerpo.text();
        const json = JSON.parse(texto);
        return json.mensaje || json.detail || texto;
      } catch {
        return err?.message || 'Error desconocido';
      }
    }

    return cuerpo?.mensaje || err?.message || 'Error desconocido';
  }

  private async aprobarEnLote(videos: VideoDataset[]): Promise<void> {
    let totalAprobados = 0;
    let totalErrores = 0;

    for (const video of videos) {
      try {
        const response = await firstValueFrom(this.datasetService.aprobarVideo(video.id, true));

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
        const response = await firstValueFrom(this.datasetService.eliminarVideo(video.id));

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
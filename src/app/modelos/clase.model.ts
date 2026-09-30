export type TipoVideo = 'youtube' | 'google_drive' | 'vimeo';

export interface Clase {
  id?: number;
  leccion_id: number;
  titulo: string;
  descripcion?: string | null;
  contenido_texto?: string | null;
  sena?: string | null;
  tipo_video: TipoVideo;
  video_url?: string | null;
  video_id?: string | null;
  imagen_referencia?: string | null;
  gif_demostracion?: string | null;
  orden: number;
  duracion_estimada?: number | null;
  tips?: string | null;
  errores_comunes?: string | null;
  requiere_practica: boolean;
  intentos_minimos: number;
  precision_minima: number;
  activa: boolean;
  es_evaluacion: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
  url_video_embebida?: string | null;
  completada?: boolean;
  bloqueada?: boolean;
  progreso?: number;
}

export interface ClaseCrear {
  leccion_id: number;
  titulo: string;
  orden: number;
  descripcion?: string | null;
  contenido_texto?: string | null;
  sena?: string | null;
  tipo_video?: TipoVideo;
  video_url?: string | null;
  video_id?: string | null;
  imagen_referencia?: string | null;
  gif_demostracion?: string | null;
  duracion_estimada?: number | null;
  tips?: string | null;
  errores_comunes?: string | null;
  requiere_practica?: boolean;
  intentos_minimos?: number;
  precision_minima?: number;
  activa?: boolean;
  es_evaluacion?: boolean;
}

export type ClaseActualizar = Partial<Omit<ClaseCrear, 'leccion_id'>>;

export const CLASE_DEFAULT: Partial<ClaseCrear> = {
  tipo_video: 'youtube',
  requiere_practica: true,
  intentos_minimos: 3,
  precision_minima: 0.7,
  activa: true,
  es_evaluacion: false,
  orden: 1
};

export const TipoVideoEnum = {
  YOUTUBE: 'youtube' as TipoVideo,
  GOOGLE_DRIVE: 'google_drive' as TipoVideo,
  VIMEO: 'vimeo' as TipoVideo
};

const PATRONES_VIDEO: Record<TipoVideo, RegExp> = {
  youtube: /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
  google_drive: /\/file\/d\/([a-zA-Z0-9_-]+)/,
  vimeo: /vimeo\.com\/(\d+)/
};

const URLS_EMBEBIDAS: Record<TipoVideo, (id: string) => string> = {
  youtube: id => `https://www.youtube.com/embed/${id}`,
  google_drive: id => `https://drive.google.com/file/d/${id}/preview`,
  vimeo: id => `https://player.vimeo.com/video/${id}`
};

function esTipoVideo(tipo: unknown): tipo is TipoVideo {
  return typeof tipo === 'string' && Object.prototype.hasOwnProperty.call(PATRONES_VIDEO, tipo);
}

export function extraerVideoId(url: string, tipoVideo: string): string {
  if (!url || !esTipoVideo(tipoVideo)) return '';
  return url.match(PATRONES_VIDEO[tipoVideo])?.[1] ?? '';
}

export function generarUrlEmbebida(videoId: string, tipoVideo: string): string {
  if (!videoId || !esTipoVideo(tipoVideo)) return '';
  return URLS_EMBEBIDAS[tipoVideo](videoId);
}

export function obtenerUrlVideoEmbebida(clase: Pick<Clase, 'video_id' | 'tipo_video'>): string | null {
  return generarUrlEmbebida(clase.video_id ?? '', clase.tipo_video) || null;
}

export function validarClase(clase: Partial<ClaseCrear>): string[] {
  const errores: string[] = [];

  if (!clase.titulo || clase.titulo.trim().length < 3) {
    errores.push('El título debe tener al menos 3 caracteres');
  }

  if (!clase.leccion_id || clase.leccion_id <= 0) {
    errores.push('Debe seleccionar una lección válida');
  }

  if (!clase.orden || clase.orden < 1) {
    errores.push('El orden debe ser mayor a 0');
  }

  if (clase.intentos_minimos !== undefined && clase.intentos_minimos < 1) {
    errores.push('Los intentos mínimos deben ser al menos 1');
  }

  if (clase.precision_minima !== undefined && (clase.precision_minima < 0 || clase.precision_minima > 1)) {
    errores.push('La precisión mínima debe estar entre 0 y 1');
  }

  if (clase.requiere_practica && !clase.sena?.trim()) {
    errores.push('La seña es obligatoria cuando se requiere práctica');
  }

  return errores;
}
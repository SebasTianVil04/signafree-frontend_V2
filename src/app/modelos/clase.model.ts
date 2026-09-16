export type TipoVideo = 'youtube' | 'google_drive' | 'vimeo';

export interface Clase {
  id?: number;
  leccion_id: number;
  
  // Contenido de la clase
  titulo: string;
  descripcion?: string | null;
  contenido_texto?: string | null;
  
  // AGREGAR: Propiedad para la seña específica de la clase
  sena?: string | null;
  
  // Multimedia - Video principal
  tipo_video: TipoVideo;
  video_url?: string | null;
  video_id?: string | null;
  
  // Recursos adicionales
  imagen_referencia?: string | null;
  gif_demostracion?: string | null;
  
  // Organización
  orden: number;
  duracion_estimada?: number | null;
  
  // Tips y consejos
  tips?: string | null;
  errores_comunes?: string | null;
  
  // Configuración de práctica
  requiere_practica: boolean;
  intentos_minimos: number;
  precision_minima: number;
  
  // Estados
  activa: boolean;
  es_evaluacion: boolean;
  
  // Timestamps
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
  
  // Propiedad computed (del backend)
  url_video_embebida?: string | null;
  
  // Propiedades adicionales del frontend (progreso)
  completada?: boolean;
  bloqueada?: boolean;
  progreso?: number;
}

// Interface para crear una clase (sin id ni timestamps)
export interface ClaseCrear {
  leccion_id: number;
  titulo: string;
  descripcion?: string;
  contenido_texto?: string;
  sena?: string; // AGREGAR
  tipo_video: TipoVideo;
  video_url?: string;
  video_id?: string;
  imagen_referencia?: string;
  gif_demostracion?: string;
  orden: number;
  duracion_estimada?: number;
  tips?: string;
  errores_comunes?: string;
  requiere_practica: boolean;
  intentos_minimos: number;
  precision_minima: number;
  activa: boolean;
  es_evaluacion: boolean;
}

export interface ClaseActualizar {
  titulo?: string;
  descripcion?: string;
  contenido_texto?: string;
  sena?: string; // AGREGAR
  tipo_video?: TipoVideo;
  video_url?: string;
  video_id?: string;
  imagen_referencia?: string;
  gif_demostracion?: string;
  orden?: number;
  duracion_estimada?: number;
  tips?: string;
  errores_comunes?: string;
  requiere_practica?: boolean;
  intentos_minimos?: number;
  precision_minima?: number;
  activa?: boolean;
  es_evaluacion?: boolean;
}
// Valores por defecto para crear una clase
export const CLASE_DEFAULT: Partial<ClaseCrear> = {
  tipo_video: 'youtube',
  requiere_practica: true,
  intentos_minimos: 3,
  precision_minima: 0.7,
  activa: true,
  es_evaluacion: false,
  orden: 1
};

// Enum para tipos de video (espejo del Python)
export const TipoVideoEnum = {
  YOUTUBE: 'youtube' as TipoVideo,
  GOOGLE_DRIVE: 'google_drive' as TipoVideo,
  VIMEO: 'vimeo' as TipoVideo
};

// Helper para obtener URL embebida del lado del cliente
export function obtenerUrlVideoEmbebida(clase: Clase): string | null {
  if (!clase.video_id) return null;
  
  switch (clase.tipo_video) {
    case 'youtube':
      return `https://www.youtube.com/embed/${clase.video_id}`;
    case 'google_drive':
      return `https://drive.google.com/file/d/${clase.video_id}/preview`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${clase.video_id}`;
    default:
      return null;
  }
}

// Helper para validar una clase antes de enviar
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
  
  if (clase.intentos_minimos && clase.intentos_minimos < 1) {
    errores.push('Los intentos mínimos deben ser al menos 1');
  }
  
  if (clase.precision_minima !== undefined && (clase.precision_minima < 0 || clase.precision_minima > 1)) {
    errores.push('La precisión mínima debe estar entre 0 y 1');
  }
  
  return errores;
}
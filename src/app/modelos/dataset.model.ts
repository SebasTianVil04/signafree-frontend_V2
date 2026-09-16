export interface CategoriaDataset {
  id: number;
  nombre: string;
  descripcion?: string;
  total_imagenes: number;
  imagenes_aprobadas: number;
  fecha_creacion: string;
}

export interface ImagenDataset {
  id: number;
  categoria_id: number;
  sena: string; 
  ruta_imagen: string;
  procesada: boolean;
  aprobada: boolean;
  usada_entrenamiento: boolean;
  fecha_subida: string;
  categoria_nombre?: string;
}
export interface EstadisticasDataset {
  total_imagenes: number;
  total_aprobadas: number;
  total_pendientes: number;
  por_categoria: Array<{
    categoria: string;
    total: number;
    aprobadas: number;
    usadas: number;
  }>;
  por_sena: Array<{
    sena: string;
    total: number;
  }>;
}
export interface Categoria {
  id: number;
  nombre: string;
  tipo: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden: number;
  nivel_requerido: number;
  activa: boolean;
  fecha_creacion: string;
  total_lecciones?: number;
}

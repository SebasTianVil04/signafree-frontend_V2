import { 
  Leccion as LeccionServicio,
  LeccionCrear as LeccionCrearServicio,
  LeccionActualizar as LeccionActualizarServicio
} from '../servicios/lecciones.service';

export interface CategoriaDB {
  id: number;
  nombre: string;
  tipo_id: number;
  tipo_valor?: string;
  tipo_etiqueta?: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden: number;
  nivel_requerido: number;
  activa: boolean;
  fecha_creacion?: string;
  total_lecciones?: number;
}

export interface Leccion extends Omit<LeccionServicio, 'color_tema' | 'requiere_examen_nivel'> {
  categoria_nombre?: string;
  nivel_dificultad_enum?: NivelDificultad;
  color_tema?: string;
  requiere_examen_nivel?: boolean;
  progreso?: ProgresoLeccion;
}

export interface ProgresoLeccion {
  id?: number;
  usuario_id?: number;
  leccion_id?: number;
  desbloqueada: boolean;
  iniciada: boolean;
  completada: boolean;
  total_clases: number;
  clases_completadas: number;
  mejor_precision: number;
  total_intentos: number;
  total_puntos: number;
  estrellas: number;
  fecha_desbloqueo?: string | null;
  fecha_inicio?: string | null;
  fecha_completada?: string | null;
  ultima_practica?: string | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
  porcentaje_completado?: number;
  porcentaje_precision?: string;
  tiene_estrella_dorada?: boolean;
}

export enum NivelDificultad {
  PRINCIPIANTE = 'principiante',
  INTERMEDIO = 'intermedio',
  AVANZADO = 'avanzado'
}

export interface LeccionCrear extends Omit<LeccionCrearServicio, 'puntos_base' | 'puntos_perfecto'> {
  puntos_base?: number;
  puntos_perfecto?: number;
}

export interface LeccionActualizar extends LeccionActualizarServicio {}

export const NIVELES_DIFICULTAD = [
  { valor: NivelDificultad.PRINCIPIANTE, etiqueta: 'Principiante', numero: 1 },
  { valor: NivelDificultad.INTERMEDIO, etiqueta: 'Intermedio', numero: 2 },
  { valor: NivelDificultad.AVANZADO, etiqueta: 'Avanzado', numero: 3 }
];

export function nivelEnumANumero(nivel: NivelDificultad): number {
  const mapeo: Record<NivelDificultad, number> = {
    [NivelDificultad.PRINCIPIANTE]: 1,
    [NivelDificultad.INTERMEDIO]: 2,
    [NivelDificultad.AVANZADO]: 3
  };
  return mapeo[nivel] || 1;
}

export function nivelNumeroAEnum(numero: number): NivelDificultad {
  const mapeo: Record<number, NivelDificultad> = {
    1: NivelDificultad.PRINCIPIANTE,
    2: NivelDificultad.INTERMEDIO,
    3: NivelDificultad.AVANZADO
  };
  return mapeo[numero] || NivelDificultad.PRINCIPIANTE;
}

export function obtenerEtiquetaNivel(nivel: NivelDificultad | number): string {
  if (typeof nivel === 'number') {
    const mapeo: Record<number, string> = {
      1: 'Principiante',
      2: 'Intermedio',
      3: 'Avanzado'
    };
    return mapeo[nivel] || 'Desconocido';
  }
  
  const niv = NIVELES_DIFICULTAD.find(n => n.valor === nivel);
  return niv?.etiqueta || nivel;
}

export function obtenerNumeroNivel(nivel: NivelDificultad): number {
  return nivelEnumANumero(nivel);
}

export function numeroANivel(numero: number): NivelDificultad {
  return nivelNumeroAEnum(numero);
}

export function obtenerNombreCategoria(categoria: CategoriaDB): string {
  return categoria?.nombre || 'Sin categoría';
}

export function convertirLeccionServicio(leccionServicio: LeccionServicio): Leccion {
  return {
    ...leccionServicio,
    nivel_dificultad_enum: nivelNumeroAEnum(leccionServicio.nivel_dificultad),
    categoria_nombre: leccionServicio.categoria_nombre
  };
}

export function convertirLeccionesServicio(leccionesServicio: LeccionServicio[]): Leccion[] {
  return leccionesServicio.map(leccion => convertirLeccionServicio(leccion));
}

export function prepararLeccionParaCrear(leccion: LeccionCrear): LeccionCrearServicio {
  return {
    ...leccion,
    puntos_base: leccion.puntos_base || 10,
    puntos_perfecto: leccion.puntos_perfecto || 20
  };
}
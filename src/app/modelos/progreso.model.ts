export interface ProgresoUsuario {
  nivel_actual: number;
  lecciones_completadas: number;
  total_lecciones: number;
  puntos_totales: number;
  porcentaje_progreso: number;
  estrellas_doradas: number;
  racha_actual: number;
  ultima_leccion?: any;
  proxima_leccion?: any;
  categorias_progreso?: any[];
}

export interface EstadisticasUsuario {
  usuario_id: number;
  nombre_completo: string;
  email: string;
  total_practicas: number;
  precision_promedio: number;
  mejor_precision: number;
  estrellas_doradas: number;
  puntos_totales: number;
  nivel_actual: number;
  examenes_completados: number;
  examenes_aprobados: number;
  tasa_aprobacion: number;
  racha_actual: number;
  fecha_registro: string;
  ultima_actividad?: string;
}
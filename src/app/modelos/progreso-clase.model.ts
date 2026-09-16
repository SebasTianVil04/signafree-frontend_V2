// src/app/modelos/progreso-clase.model.ts

export interface ProgresoClase {
  id?: number;
  
  // Relaciones
  usuario_id?: number;
  clase_id: number;
  
  // Estado
  vista: boolean;
  completada: boolean;
  
  // Estadísticas de práctica
  intentos_realizados: number;
  mejor_precision: number;
  ultima_precision: number;
  
  // Tiempo invertido (en segundos)
  tiempo_video: number;
  tiempo_practica: number;
  
  // Timestamps
  fecha_primera_vista?: string | null;
  fecha_completada?: string | null;
  ultima_practica?: string | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
}

export interface ProgresoClaseCrear {
  clase_id: number;
  vista?: boolean;
  completada?: boolean;
  intentos_realizados?: number;
  mejor_precision?: number;
  ultima_precision?: number;
  tiempo_video?: number;
  tiempo_practica?: number;
}

export interface ProgresoClaseActualizar {
  vista?: boolean;
  completada?: boolean;
  intentos_realizados?: number;
  mejor_precision?: number;
  ultima_precision?: number;
  tiempo_video?: number;
  tiempo_practica?: number;
}
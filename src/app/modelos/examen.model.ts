// src/app/modelos/examen.model.ts
export interface Examen {
  id: number;
  titulo: string;
  descripcion?: string;
  tipo: 'nivel' | 'final';
  nivel?: number;
  leccion_id: number;
  orden: number;
  clases_requeridas: number;
  requiere_todas_clases: boolean;
  tiempo_limite?: number;
  puntuacion_minima: number;
  activo: boolean;
  total_preguntas?: number;
  disponible?: boolean;
  completado?: boolean;
  mejor_calificacion?: number;
  ultimo_resultado?: {
    realizado: boolean;
    aprobado: boolean;
    porcentaje: number;
    fecha: string;
  };
}

export interface PreguntaExamen {
  id: number;
  pregunta: string;
  tipo_pregunta: 'reconocimiento' | 'multiple' | 'verdadero_falso';
  sena_esperada: string;
  imagen_sena: string;
  puntos: number;
  orden: number;
  opciones?: any;
}

export interface UltimoResultado {
  realizado: boolean;
  aprobado: boolean;
  puntuacion: number;
  porcentaje: number;
  fecha: string;
}

export interface ResultadoExamen {
  id?: number; 
  resultado_id?: number;
  examen_titulo?: string;
  puntuacion_obtenida: number;
  puntuacion_maxima: number;
  porcentaje: number;
  puntuacion_minima?: number;
  aprobado: boolean;
  tiempo_empleado: number;
  respuestas_correctas: number;
  total_preguntas: number;
  fecha_finalizacion: string;
}

export interface PresentarExamenRequest {
  respuestas: { [preguntaId: string]: string };
  tiempo_empleado?: number;
}

export interface ExamenesResponse {
  exito: boolean;
  mensaje: string;
  datos: Examen[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface ResultadosExamenResponse {
  exito: boolean;
  mensaje: string;
  datos: ResultadoExamen[];
  total: number;
  pagina: number;
  por_pagina: number;
}
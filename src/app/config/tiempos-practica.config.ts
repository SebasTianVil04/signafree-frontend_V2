export type NivelDificultad = 1 | 2 | 3;

export interface ConfiguracionTiempo {
  tiempo_segundos: number;
  detecciones_requeridas: number;
  umbral_confianza: number;
  descripcion: string;
}

// 1 = Principiante, 2 = Intermedio, 3 = Avanzado (ver Leccion.nivel_dificultad en el backend)
export const CONFIGURACION_TIEMPOS: { [key in NivelDificultad]: ConfiguracionTiempo } = {
  1: {
    tiempo_segundos: 60,
    detecciones_requeridas: 2,
    umbral_confianza: 0.60,
    descripcion: 'Tiempo extendido para nivel básico'
  },
  2: {
    tiempo_segundos: 30,
    detecciones_requeridas: 3,
    umbral_confianza: 0.70,
    descripcion: 'Tiempo moderado para nivel intermedio'
  },
  3: {
    tiempo_segundos: 15,
    detecciones_requeridas: 3,
    umbral_confianza: 0.75,
    descripcion: 'Tiempo mínimo para nivel avanzado'
  }
};

const CONFIGURACION_DEFAULT: ConfiguracionTiempo = CONFIGURACION_TIEMPOS[1];

export function obtenerConfiguracionTiempo(nivelDificultad: number | null | undefined): ConfiguracionTiempo {
  if (nivelDificultad === 1 || nivelDificultad === 2 || nivelDificultad === 3) {
    return CONFIGURACION_TIEMPOS[nivelDificultad];
  }
  return CONFIGURACION_DEFAULT;
}

export function obtenerResumenConfiguracion(config: ConfiguracionTiempo): string {
  return `${config.descripcion} - ${config.tiempo_segundos}s, ${config.detecciones_requeridas} detecciones, ${(config.umbral_confianza * 100)}% confianza`;
}

export function obtenerRecomendaciones(config: ConfiguracionTiempo): string[] {
  const recomendaciones: string[] = [];

  if (config.tiempo_segundos >= 60) {
    recomendaciones.push('Tómate tu tiempo para realizar la seña correctamente');
    recomendaciones.push('No te preocupes por la velocidad, enfócate en la precisión');
  }

  if (config.umbral_confianza <= 0.60) {
    recomendaciones.push('El sistema es más flexible con la detección');
    recomendaciones.push('Practica hasta sentirte cómodo con el movimiento');
  }

  if (config.detecciones_requeridas <= 2) {
    recomendaciones.push('Se necesitan menos detecciones consecutivas para validar');
    recomendaciones.push('Mantén la seña estable por al menos 1-2 segundos');
  } else {
    recomendaciones.push('Mantén la seña estable por al menos 2-3 segundos');
  }

  return recomendaciones;
}
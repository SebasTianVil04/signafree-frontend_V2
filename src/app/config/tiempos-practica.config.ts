

export interface ConfiguracionTiempo {
  tiempo_segundos: number;
  detecciones_requeridas: number;
  umbral_confianza: number;
  descripcion: string;
}

export const CONFIGURACION_TIEMPOS: { [key: string]: ConfiguracionTiempo } = {
  'peruano_mayor': {
    tiempo_segundos: 15,
    detecciones_requeridas: 3,
    umbral_confianza: 0.75,
    descripcion: 'Tiempo estándar para adultos'
  },
  'peruano_menor': {
    tiempo_segundos: 60,
    detecciones_requeridas: 2,
    umbral_confianza: 0.60,
    descripcion: 'Tiempo extendido para menores'
  },
  'extranjero': {
    tiempo_segundos: 20,
    detecciones_requeridas: 3,
    umbral_confianza: 0.70,
    descripcion: 'Tiempo para extranjeros aprendiendo LSP'
  },
  'default': {
    tiempo_segundos: 15,
    detecciones_requeridas: 3,
    umbral_confianza: 0.75,
    descripcion: 'Configuración por defecto'
  }
};


export function obtenerConfiguracionTiempo(tipoUsuario: string | null): ConfiguracionTiempo {
  if (!tipoUsuario || !CONFIGURACION_TIEMPOS[tipoUsuario]) {
    return CONFIGURACION_TIEMPOS['default'];
  }
  return CONFIGURACION_TIEMPOS[tipoUsuario];
}


export function calcularTiempoPorEdad(edad: number | null): ConfiguracionTiempo {
  if (!edad) {
    return CONFIGURACION_TIEMPOS['default'];
  }


  if (edad >= 6 && edad <= 10) {
    return {
      tiempo_segundos: 90,
      detecciones_requeridas: 2,
      umbral_confianza: 0.55,
      descripcion: 'Tiempo extendido para niños'
    };
  }
  

  if (edad >= 11 && edad <= 14) {
    return {
      tiempo_segundos: 60,
      detecciones_requeridas: 2,
      umbral_confianza: 0.60,
      descripcion: 'Tiempo para pre-adolescentes'
    };
  }

  if (edad >= 15 && edad < 18) {
    return {
      tiempo_segundos: 45,
      detecciones_requeridas: 3,
      umbral_confianza: 0.65,
      descripcion: 'Tiempo para adolescentes'
    };
  }
  
  if (edad >= 18 && edad <= 35) {
    return {
      tiempo_segundos: 15,
      detecciones_requeridas: 3,
      umbral_confianza: 0.75,
      descripcion: 'Tiempo estándar para adultos jóvenes'
    };
  }
  

  if (edad >= 36 && edad <= 50) {
    return {
      tiempo_segundos: 15,
      detecciones_requeridas: 3,
      umbral_confianza: 0.75,
      descripcion: 'Tiempo estándar para adultos'
    };
  }
  

  if (edad >= 51 && edad <= 65) {
    return {
      tiempo_segundos: 20,
      detecciones_requeridas: 3,
      umbral_confianza: 0.70,
      descripcion: 'Tiempo para adultos mayores'
    };
  }
  
 
  return {
    tiempo_segundos: 30,
    detecciones_requeridas: 2,
    umbral_confianza: 0.65,
    descripcion: 'Tiempo para tercera edad'
  };
}


export function obtenerResumenConfiguracion(config: ConfiguracionTiempo): string {
  return `${config.descripcion} - ${config.tiempo_segundos}s, ${config.detecciones_requeridas} detecciones, ${(config.umbral_confianza * 100)}% confianza`;
}


export function esMenorDeEdad(edad: number): boolean {
  return edad < 18;
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
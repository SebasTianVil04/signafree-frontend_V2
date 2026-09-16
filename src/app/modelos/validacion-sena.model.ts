export interface ValidacionSena {
  senaDetectada: string;
  senaEsperada: string;
  confianza: number;
  intentoNumero?: number;
  timestamp?: Date;
}

export interface ResultadoValidacion {
  esCorrecta: boolean;
  puntuacion: number;
  mensaje: string;
  confianza: number;
  sugerencias?: string[];
  errores?: ErrorValidacion[];
  tiempoRespuestaMs?: number;
}

export interface ErrorValidacion {
  codigo: string;
  mensaje: string;
  sugerencia?: string;
}

export interface CriteriosValidacion {
  confianzaMinima: number;
  toleranciaPuntos: number;
  tiempoMaximoMs?: number;
  requiereAmbaManos?: boolean;
}

export interface ComparacionSenas {
  senaOriginal: string;
  senaComparada: string;
  similitud: number;
  diferencias: DiferenciaPunto[];
  esValida: boolean;
}

export interface DiferenciaPunto {
  indice: number;
  nombrePunto: string;
  distancia: number;
  esSignificativa: boolean;
}

export interface FeedbackValidacion {
  tipo: 'exito' | 'error' | 'advertencia';
  titulo: string;
  mensaje: string;
  sugerencias: string[];
  color: string;
  icono: string;
}

// Constantes
export const CRITERIOS_DEFAULT: CriteriosValidacion = {
  confianzaMinima: 0.7,
  toleranciaPuntos: 0.1,
  tiempoMaximoMs: 30000
};

export const MENSAJES_VALIDACION = {
  CORRECTA: '¡Correcto! Excelente ejecución de la sena',
  INCORRECTA: 'Sena incorrecta. Revisa la posición de tus dedos',
  CONFIANZA_BAJA: 'La confianza es baja. Intenta con mejor iluminación',
  TIMEOUT: 'Tiempo agotado. Intenta nuevamente'
};

// Utilidades
export function validarConfianza(
  validacion: ValidacionSena, 
  criterios: CriteriosValidacion
): ResultadoValidacion {
  
  const esCorrecta = validacion.senaDetectada.toLowerCase() === 
                     validacion.senaEsperada.toLowerCase() &&
                     validacion.confianza >= criterios.confianzaMinima;

  const puntuacion = esCorrecta 
    ? Math.round(validacion.confianza * 100)
    : 0;

  const mensaje = esCorrecta 
    ? MENSAJES_VALIDACION.CORRECTA
    : MENSAJES_VALIDACION.INCORRECTA;

  const sugerencias: string[] = [];
  
  if (!esCorrecta) {
    if (validacion.confianza < criterios.confianzaMinima) {
      sugerencias.push('Mejora la iluminación');
      sugerencias.push('Asegúrate de que tu mano esté completamente visible');
    }
    if (validacion.senaDetectada !== validacion.senaEsperada) {
      sugerencias.push('Revisa la posición correcta de la sena');
      sugerencias.push('Mira el video de referencia nuevamente');
    }
  }

  return {
    esCorrecta,
    puntuacion,
    mensaje,
    confianza: validacion.confianza,
    sugerencias
  };
}

export function generarFeedback(resultado: ResultadoValidacion): FeedbackValidacion {
  if (resultado.esCorrecta && resultado.confianza >= 0.9) {
    return {
      tipo: 'exito',
      titulo: '¡Perfecto!',
      mensaje: resultado.mensaje,
      sugerencias: ['¡Excelente trabajo!', 'Continúa así'],
      color: '#4CAF50',
      icono: '🎉'
    };
  }

  if (resultado.esCorrecta) {
    return {
      tipo: 'exito',
      titulo: '¡Correcto!',
      mensaje: resultado.mensaje,
      sugerencias: resultado.sugerencias || ['Bien hecho'],
      color: '#8BC34A',
      icono: '✓'
    };
  }

  return {
    tipo: 'error',
    titulo: 'Incorrecto',
    mensaje: resultado.mensaje,
    sugerencias: resultado.sugerencias || ['Intenta nuevamente'],
    color: '#F44336',
    icono: '✗'
  };
}

export function calcularSimilitud(puntos1: number[], puntos2: number[]): number {
  if (puntos1.length !== puntos2.length) return 0;
  
  let distanciaTotal = 0;
  for (let i = 0; i < puntos1.length; i++) {
    distanciaTotal += Math.abs(puntos1[i] - puntos2[i]);
  }
  
  const distanciaPromedio = distanciaTotal / puntos1.length;
  return Math.max(0, 1 - distanciaPromedio);
}
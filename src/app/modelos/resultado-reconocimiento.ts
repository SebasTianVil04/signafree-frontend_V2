/**
 * MODELO DE RESULTADO DE RECONOCIMIENTO - ARCHIVO COMPLETO
 * src/app/models/resultado-reconocimiento.model.ts
 */

export interface ResultadoReconocimiento {
  senaDetectada: string;
  confianza: number;
  puntosMano: any[];
  mensaje: string;
  timestamp?: Date;
  idSesion?: string;
  duracionMs?: number;
  intentoNumero?: number;
}

export interface HistorialReconocimiento {
  id: string;
  usuarioId: string;
  resultados: ResultadoReconocimiento[];
  fechaInicio: Date;
  fechaFin?: Date;
  totalReconocimientos: number;
  confianzaPromedio: number;
}

export interface EstadisticasReconocimiento {
  totalReconocimientos: number;
  reconocimientosExitosos: number;
  confianzaPromedio: number;
  tiempoPromedioMs: number;
  senaMasReconocida: string;
  tasaExito: number;
}

export interface SesionReconocimiento {
  id: string;
  usuarioId: string;
  fechaInicio: Date;
  fechaFin?: Date;
  estado: 'activa' | 'pausada' | 'finalizada';
  resultados: ResultadoReconocimiento[];
  intentosTotales: number;
  reconocimientosExitosos: number;
}

// Utilidades
export function esResultadoValido(obj: any): obj is ResultadoReconocimiento {
  return obj && 
    typeof obj.senaDetectada === 'string' && 
    typeof obj.confianza === 'number' &&
    Array.isArray(obj.puntosMano);
}

export function calcularNivelConfianza(confianza: number): string {
  if (confianza >= 0.9) return 'muy_alta';
  if (confianza >= 0.7) return 'alta';
  if (confianza >= 0.5) return 'media';
  if (confianza >= 0.3) return 'baja';
  return 'muy_baja';
}

export function obtenerColorConfianza(confianza: number): string {
  if (confianza >= 0.9) return '#4CAF50';
  if (confianza >= 0.7) return '#8BC34A';
  if (confianza >= 0.5) return '#FF9800';
  if (confianza >= 0.3) return '#FF5722';
  return '#F44336';
}
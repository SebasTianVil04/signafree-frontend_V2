export interface PuntoMano {
  puntos: number[];
  confianza: number;
  lado?: 'izquierda' | 'derecha';
  visible?: boolean;
  indice?: number;
  nombre?: string;
}

export interface PuntoNormalizado {
  x: number;
  y: number;
  z: number;
  confianza: number;
}

export interface DeteccionMano {
  puntos: PuntoMano[];
  boundingBox: BoundingBox;
  lado: 'izquierda' | 'derecha';
  confianza: number;
  visible: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface ConjuntoPuntosMano {
  puntos: PuntoMano[];
  manoIzquierda?: PuntoMano[];
  manoDerecha?: PuntoMano[];
  timestamp: number;
  confianzaGeneral: number;
}

// Constantes
export const NOMBRES_PUNTOS: { [key: number]: string } = {
  0: 'Muneca',
  1: 'Pulgar_Base',
  2: 'Pulgar_Medio',
  3: 'Pulgar_Superior',
  4: 'Pulgar_Punta',
  5: 'Indice_Base',
  6: 'Indice_Medio',
  7: 'Indice_Superior',
  8: 'Indice_Punta',
  9: 'Medio_Base',
  10: 'Medio_Medio',
  11: 'Medio_Superior',
  12: 'Medio_Punta',
  13: 'Anular_Base',
  14: 'Anular_Medio',
  15: 'Anular_Superior',
  16: 'Anular_Punta',
  17: 'Menique_Base',
  18: 'Menique_Medio',
  19: 'Menique_Superior',
  20: 'Menique_Punta'
};

export const CONEXIONES_MANO: number[][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

export const COLORES_DEDOS: { [key: string]: string } = {
  'Muneca': '#FF5722',
  'Pulgar': '#4CAF50',
  'Indice': '#2196F3',
  'Medio': '#9C27B0',
  'Anular': '#FF9800',
  'Menique': '#F44336'
};

// Utilidades
export function normalizarPuntos(puntos: number[]): PuntoNormalizado[] {
  const resultado: PuntoNormalizado[] = [];
  for (let i = 0; i < puntos.length; i += 3) {
    resultado.push({
      x: puntos[i] || 0,
      y: puntos[i + 1] || 0,
      z: puntos[i + 2] || 0,
      confianza: 1.0
    });
  }
  return resultado;
}

export function obtenerBoundingBox(puntos: PuntoMano[]): BoundingBox {
  if (puntos.length === 0) {
    return { x: 0, y: 0, ancho: 0, alto: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  puntos.forEach(punto => {
    if (punto.puntos.length >= 2) {
      minX = Math.min(minX, punto.puntos[0]);
      minY = Math.min(minY, punto.puntos[1]);
      maxX = Math.max(maxX, punto.puntos[0]);
      maxY = Math.max(maxY, punto.puntos[1]);
    }
  });

  return {
    x: minX,
    y: minY,
    ancho: maxX - minX,
    alto: maxY - minY
  };
}

export function calcularDistancia(p1: number[], p2: number[]): number {
  if (p1.length < 2 || p2.length < 2) return 0;
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}
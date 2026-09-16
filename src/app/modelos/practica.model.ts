export interface Practica {
  id?: number;
  usuario_id?: number;
  leccion_id?: number;
  sena_detectada: string;
  sena_esperada?: string;
  confianza: number;
  correcta?: boolean;
  tiempo_empleado: number;
  puntos_ganados?: number;
  fecha_practica?: string;
}

export interface RespuestaPractica {
  exito: boolean;
  mensaje: string;
  datos?: {
    practica_id: number;
    correcta: boolean;
    puntos_ganados: number;
    precision: number;
    nuevo_nivel?: boolean;
    progreso_actualizado: boolean;
  };
}
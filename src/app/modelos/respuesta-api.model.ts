export interface RespuestaApi<T = any> {
  exito: boolean;
  mensaje?: string;
  datos?: T;
  error?: string;
}

export interface ErrorApi {
  mensaje: string;
  detalle?: any;
  codigo?: number;
}
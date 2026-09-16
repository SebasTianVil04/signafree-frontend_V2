export interface ConfiguracionTraductor {
  idioma_voz: string;           // e.g., 'es-PE' (Spanish - Peru)
  velocidad_habla: number;     // e.g., 1.0 (normal speed)
  confianza_minima: number;    // e.g., 0.7 (minimum confidence for recognition)
  mostrar_imagenes_referencia: boolean;  // Whether to show reference images for signs
  activar_audio: boolean;      // Whether to enable audio playback for results
}


export interface ConfiguracionCamara {
  ancho?: number;
  alto?: number;
  deviceId?: string;
  facingMode?: 'user' | 'environment';
  frameRate?: number;
  aspectRatio?: number;
}

export interface DispositivoCamara {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  groupId: string;
  esFrontal?: boolean;
  esDefecto?: boolean;
}

export interface EstadoCamara {
  activa: boolean;
  deviceId?: string;
  stream?: MediaStream;
  configuracion?: ConfiguracionCamara;
  error?: string;
}

export interface Resolucion {
  ancho: number;
  alto: number;
  label: string;
  aspectRatio: number;
}

export interface CapacidadesCamara {
  resolucionesDisponibles: Resolucion[];
  frameRatesDisponibles: number[];
  soportaZoom: boolean;
  soportaTorch: boolean;
}

// Constantes
export const RESOLUCIONES_PREDEFINIDAS: Resolucion[] = [
  { ancho: 320, alto: 240, label: 'QVGA', aspectRatio: 4/3 },
  { ancho: 640, alto: 480, label: 'VGA', aspectRatio: 4/3 },
  { ancho: 1280, alto: 720, label: 'HD', aspectRatio: 16/9 },
  { ancho: 1920, alto: 1080, label: 'Full HD', aspectRatio: 16/9 }
];

export const CONFIG_DEFAULT: ConfiguracionCamara = {
  ancho: 640,
  alto: 480,
  facingMode: 'user',
  frameRate: 30
};

// Utilidades
export async function obtenerDispositivosCamara(): Promise<DispositivoCamara[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Cámara ${device.deviceId.substring(0, 5)}`,
        kind: device.kind as 'videoinput',
        groupId: device.groupId,
        esFrontal: device.label.toLowerCase().includes('front')
      }));
  } catch (err) {
    console.error('Error al obtener dispositivos:', err);
    return [];
  }
}

export async function iniciarCamara(config: ConfiguracionCamara): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    video: {
      width: config.ancho || 640,
      height: config.alto || 480,
      frameRate: config.frameRate || 30,
      facingMode: config.facingMode || 'user',
      deviceId: config.deviceId ? { exact: config.deviceId } : undefined
    }
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    throw new Error('No se pudo acceder a la cámara: ' + err);
  }
}

export function detenerCamara(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}

export function capturarFrame(
  video: HTMLVideoElement, 
  canvas: HTMLCanvasElement
): Blob | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.8);
  }) as any;
}
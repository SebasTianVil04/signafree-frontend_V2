import { CONSTANTES } from './constantes';

export class Helpers {

  static obtenerDeStorage<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  static esTokenValido(token: string): boolean {
    return token.length > 0;
  }

  static limpiarStorage(): void {
    localStorage.clear();
  }

  static guardarEnStorage(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Métodos de formato
  static formatearFecha(fecha: Date | string): string {
    if (!fecha) return '';
    
    const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    return fechaObj.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  static formatearFechaCorta(fecha: Date | string): string {
    if (!fecha) return '';
    
    const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    return fechaObj.toLocaleDateString('es-PE', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });
  }

  static formatearTiempo(segundos: number): string {
    if (segundos < 0) return '00:00';
    
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
      return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    }
    
    return `${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  }

  static formatearPuntos(puntos: number): string {
    if (puntos < 1000) return puntos.toString();
    if (puntos < 1000000) return `${(puntos / 1000).toFixed(1)}K`;
    return `${(puntos / 1000000).toFixed(1)}M`;
  }

  static formatearPorcentaje(valor: number, decimales: number = 1): string {
    return `${valor.toFixed(decimales)}%`;
  }

  // Métodos de conversión
  static base64ABlob(base64: string, tipo: string): Blob {
    const byteCharacters = atob(base64.split(',')[1] || base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: tipo });
  }

  static archivoABase64(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(archivo);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  static redimensionarImagen(imagenSrc: string, ancho: number, alto: number): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = ancho;
        canvas.height = alto;
        ctx?.drawImage(img, 0, 0, ancho, alto);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.src = imagenSrc;
    });
  }

  // Métodos de utilidad
  static generarColorAleatorio(): string {
    const colores = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colores[Math.floor(Math.random() * colores.length)];
  }

  static descargarArchivo(datos: Blob, nombreArchivo: string): void {
    const url = window.URL.createObjectURL(datos);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  static copiarAlPortapapeles(texto: string): Promise<void> {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(texto);
    } else {
      // Fallback para navegadores más antiguos
      const textArea = document.createElement('textarea');
      textArea.value = texto;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return Promise.resolve();
    }
  }

  static obtenerIniciales(nombreCompleto: string): string {
    return nombreCompleto
      .split(' ')
      .map(palabra => palabra.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  static slug(texto: string): string {
    return texto
      .toLowerCase()
      .trim()
      .replace(/[áéíóúñ]/g, (match) => {
        const acentos: { [key: string]: string } = {
          'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'
        };
        return acentos[match];
      })
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Métodos de validación de dispositivo
  static esMovil(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  static soportaWebRTC(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  static obtenerVersionNavegador(): string {
    const agent = navigator.userAgent;
    let match = agent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    
    if (/trident/i.test(match[1])) {
      const temp = agent.match(/\brv[ :]+(\d+)/g) || [];
      return `IE ${temp[1] || ''}`;
    }
    
    if (match[1] === 'Chrome') {
      const temp = agent.match(/\b(OPR|Edge)\/(\d+)/);
      if (temp) return temp.slice(1).join(' ').replace('OPR', 'Opera');
    }
    
    match = match[2] ? [match[1], match[2]] : [navigator.appName, navigator.appVersion, '-?'];
    const temp = agent.match(/version\/(\d+)/i);
    if (temp) match.splice(1, 1, temp[1]);
    
    return match.join(' ');
  }

  // Métodos de nivel
  static obtenerNombreNivel(nivel: number): string {
    return CONSTANTES.NOMBRES_NIVELES[nivel as keyof typeof CONSTANTES.NOMBRES_NIVELES] || 'Desconocido';
  }

  static obtenerColorNivel(nivel: number): string {
    return CONSTANTES.COLORES_NIVELES[nivel as keyof typeof CONSTANTES.COLORES_NIVELES] || '#9E9E9E';
  }

  static calcularNivelPorPuntos(puntos: number): number {
    if (puntos < 100) return 1;
    if (puntos < 500) return 2;
    return 3;
  }

  // Debounce function
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;   // <--- CAMBIO IMPORTANTE

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Throttle function
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}
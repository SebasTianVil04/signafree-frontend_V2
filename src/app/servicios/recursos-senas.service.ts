import { Injectable } from '@angular/core';

export interface RecursoSena {
  tipo: 'imagen' | 'video';
  url: string;
  descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecursosSenasService {
  
  private mapaAlfabeto: Map<string, RecursoSena> = new Map();
  private mapaNumeros: Map<string, RecursoSena> = new Map();
  private mapaPalabras: Map<string, RecursoSena> = new Map();

  constructor() {
    this.inicializarRecursos();
  }

  private inicializarRecursos(): void {
    // Mapeo del alfabeto (a-z en minúscula)
    const letras = 'abcdefghijklmnñopqrstuvwxyz'.split('');
    letras.forEach(letra => {
      this.mapaAlfabeto.set(letra.toLowerCase(), {
        tipo: 'imagen',
        url: `assets/alfabeto-senas/${letra.toLowerCase()}.png`,
        descripcion: `Seña de la letra ${letra.toUpperCase()}`
      });
      // También mapear mayúsculas a las mismas minúsculas
      this.mapaAlfabeto.set(letra.toUpperCase(), {
        tipo: 'imagen',
        url: `assets/alfabeto-senas/${letra.toLowerCase()}.png`,
        descripcion: `Seña de la letra ${letra.toUpperCase()}`
      });
    });

    // Mapeo de números (0-9)
    for (let i = 0; i <= 9; i++) {
      this.mapaNumeros.set(i.toString(), {
        tipo: 'imagen',
        url: `assets/numeros/${i}.png`,
        descripcion: `Seña del número ${i}`
      });
    }

    // Mapeo de palabras comunes
    const palabrasComunes = [
      'hola', 'adios', 'gracias', 'por favor', 'si', 'no',
      'buenos dias', 'buenas tardes', 'buenas noches',
      'te quiero', 'familia', 'casa', 'escuela'
    ];

    palabrasComunes.forEach(palabra => {
      this.mapaPalabras.set(palabra.toLowerCase(), {
        tipo: 'video',
        url: `assets/videos/${palabra.replace(/\s+/g, '-')}.mp4`,
        descripcion: `Seña de "${palabra}"`
      });
    });
  }

  /**
   * Convierte texto a una secuencia de señas - OPTIMIZADO
   */
  public textoASenas(texto: string): RecursoSena[] {
    if (!texto) return [];

    const inicio = performance.now();
    const textoLimpio = texto.toLowerCase().trim();
    const senas: RecursoSena[] = [];

    const palabras = textoLimpio.split(/\s+/).filter(p => p.length > 0);
    
    palabras.forEach((palabra) => {
      if (this.mapaPalabras.has(palabra)) {
        const recurso = this.mapaPalabras.get(palabra);
        if (recurso) senas.push(recurso);
      } else {
        const caracteres = palabra.split('');
        caracteres.forEach(char => {
          if (this.mapaAlfabeto.has(char)) {
            const recurso = this.mapaAlfabeto.get(char);
            if (recurso) senas.push(recurso);
          } else if (this.mapaNumeros.has(char)) {
            const recurso = this.mapaNumeros.get(char);
            if (recurso) senas.push(recurso);
          }
        });
      }
    });

    const fin = performance.now();
    console.log(`✅ Texto convertido en ${(fin - inicio).toFixed(2)}ms - ${senas.length} señas generadas`);

    return senas;
  }

  public obtenerLetra(letra: string): RecursoSena | null {
    return this.mapaAlfabeto.get(letra.toLowerCase()) || null;
  }

  public obtenerNumero(numero: string): RecursoSena | null {
    return this.mapaNumeros.get(numero) || null;
  }

  public obtenerPalabra(palabra: string): RecursoSena | null {
    return this.mapaPalabras.get(palabra.toLowerCase()) || null;
  }
}
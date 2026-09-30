import { Injectable } from '@angular/core';

export interface RecursoSena {
  tipo: 'imagen' | 'video';
  url: string;
  descripcion: string;
}

const LETRAS = 'abcdefghijklmnñopqrstuvwxyz';

const PALABRAS_COMUNES = [
  'hola', 'adios', 'gracias', 'por favor', 'si', 'no',
  'buenos dias', 'buenas tardes', 'buenas noches',
  'te quiero', 'familia', 'casa', 'escuela'
];

const MAX_PALABRAS_FRASE = Math.max(...PALABRAS_COMUNES.map(p => p.split(' ').length));

@Injectable({
  providedIn: 'root'
})
export class RecursosSenasService {
  private readonly mapaAlfabeto = new Map<string, RecursoSena>();
  private readonly mapaNumeros = new Map<string, RecursoSena>();
  private readonly mapaPalabras = new Map<string, RecursoSena>();

  constructor() {
    for (const letra of LETRAS) {
      this.mapaAlfabeto.set(letra, {
        tipo: 'imagen',
        url: `assets/alfabeto-senas/${encodeURIComponent(letra)}.png`,
        descripcion: `Seña de la letra ${letra.toUpperCase()}`
      });
    }

    for (let i = 0; i <= 9; i++) {
      this.mapaNumeros.set(i.toString(), {
        tipo: 'imagen',
        url: `assets/numeros/${i}.png`,
        descripcion: `Seña del número ${i}`
      });
    }

    for (const palabra of PALABRAS_COMUNES) {
      this.mapaPalabras.set(palabra, {
        tipo: 'video',
        url: `assets/videos/${palabra.replace(/\s+/g, '-')}.mp4`,
        descripcion: `Seña de "${palabra}"`
      });
    }
  }

  textoASenas(texto: string): RecursoSena[] {
    if (!texto) return [];

    const palabras = this.normalizar(texto).split(/\s+/).filter(Boolean);
    const senas: RecursoSena[] = [];
    let i = 0;

    while (i < palabras.length) {
      const frase = this.buscarFrase(palabras, i);

      if (frase) {
        senas.push(frase.recurso);
        i += frase.palabras;
        continue;
      }

      for (const caracter of palabras[i]) {
        const recurso = this.mapaAlfabeto.get(caracter) ?? this.mapaNumeros.get(caracter);
        if (recurso) senas.push(recurso);
      }
      i++;
    }

    return senas;
  }

  obtenerLetra(letra: string): RecursoSena | null {
    return this.mapaAlfabeto.get(letra.toLowerCase()) ?? null;
  }

  obtenerNumero(numero: string): RecursoSena | null {
    return this.mapaNumeros.get(numero) ?? null;
  }

  obtenerPalabra(palabra: string): RecursoSena | null {
    return this.mapaPalabras.get(this.normalizar(palabra)) ?? null;
  }

  private buscarFrase(palabras: string[], inicio: number): { recurso: RecursoSena; palabras: number } | null {
    const maximo = Math.min(MAX_PALABRAS_FRASE, palabras.length - inicio);

    for (let n = maximo; n >= 1; n--) {
      const recurso = this.mapaPalabras.get(palabras.slice(inicio, inicio + n).join(' '));
      if (recurso) return { recurso, palabras: n };
    }
    return null;
  }

  private normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .trim()
      .replace(/ñ/g, '\u0001')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'ñ');
  }
}
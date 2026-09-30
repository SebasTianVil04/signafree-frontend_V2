import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type RaizArchivo = 'senas_referencia' | 'videos_dataset' | 'videos_lecciones' | 'avatares';

interface RespuestaFirma {
  url: string;
  expira_en_segundos: number;
}

interface RespuestaVideoDataset {
  url: string;
  externo: boolean;
  expira_en_segundos?: number;
}

export interface UrlVideoDataset {
  url: string;
  externo: boolean;
}

interface EntradaCache {
  url: string;
  externo: boolean;
  expiraEn: number;
}

@Injectable({
  providedIn: 'root'
})
export class ArchivosService {
  private readonly apiUrl = `${environment.apiUrl}/archivos`;
  private readonly hostUrl = environment.apiUrl.split('/api')[0];
  private readonly TIMEOUT_MS = 10000;
  private readonly MARGEN_MS = 60000;
  private readonly EXPIRACION_POR_DEFECTO_S = 3600;
  private cache = new Map<string, EntradaCache>();

  constructor(private http: HttpClient) { }

  private urlAbsoluta(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${this.hostUrl}${url}`;
  }

  private leerCache(clave: string): EntradaCache | null {
    const entrada = this.cache.get(clave);
    if (!entrada) return null;
    if (entrada.expiraEn - this.MARGEN_MS <= Date.now()) {
      this.cache.delete(clave);
      return null;
    }
    return entrada;
  }

  private guardarCache(clave: string, url: string, externo: boolean, segundos?: number): void {
    const duracion = (segundos ?? this.EXPIRACION_POR_DEFECTO_S) * 1000;
    this.cache.set(clave, { url, externo, expiraEn: Date.now() + duracion });
  }

  firmar(raiz: RaizArchivo, ruta: string): Observable<string> {
    if (!ruta) return of('');

    const clave = `${raiz}:${ruta}`;
    const enCache = this.leerCache(clave);
    if (enCache) return of(enCache.url);

    const params = new HttpParams().set('raiz', raiz).set('ruta', ruta);

    return this.http.get<RespuestaFirma>(`${this.apiUrl}/firmar`, { params }).pipe(
      timeout(this.TIMEOUT_MS),
      map(respuesta => this.urlAbsoluta(respuesta.url)),
      tap(url => this.guardarCache(clave, url, false))
    );
  }

  urlReferencia(archivoReferencia: string | null | undefined): Observable<string> {
    const nombre = (archivoReferencia || '').split(/[\\/]/).pop() || '';
    return this.firmar('senas_referencia', nombre);
  }

  urlVideoDataset(videoId: number): Observable<UrlVideoDataset> {
    const clave = `video_dataset:${videoId}`;
    const enCache = this.leerCache(clave);
    if (enCache) return of({ url: enCache.url, externo: enCache.externo });

    return this.http.get<RespuestaVideoDataset>(`${this.apiUrl}/video-dataset/${videoId}/url`).pipe(
      timeout(this.TIMEOUT_MS),
      map(respuesta => ({
        url: this.urlAbsoluta(respuesta.url),
        externo: respuesta.externo,
        expira: respuesta.expira_en_segundos
      })),
      tap(r => this.guardarCache(clave, r.url, r.externo, r.expira)),
      map(r => ({ url: r.url, externo: r.externo }))
    );
  }

  limpiarCache(): void {
    this.cache.clear();
  }
}
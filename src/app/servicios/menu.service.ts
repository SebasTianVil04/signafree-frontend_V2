import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, defer, firstValueFrom, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { environment } from '../../environments/environment';
import { MenuItemPublico } from '../modelos/menu.model';
import { AutenticacionService } from './autenticacion.service';

const MENU_PUBLICO_KEY = ['menu-publico'] as const;
const STALE_MENU_MS = 5 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private readonly apiUrl = `${environment.apiUrl}/auth/menu`;
  private readonly queryClient = injectQueryClient();
  private readonly menuSubject = new BehaviorSubject<MenuItemPublico[]>([]);

  readonly menu$: Observable<MenuItemPublico[]> = this.menuSubject.asObservable();

  constructor(
    private http: HttpClient,
    private auth: AutenticacionService
  ) { }

  cargarMenu(): Observable<MenuItemPublico[]> {
    const usuarioId = this.auth.usuarioActualValor?.id ?? 'anonimo';

    return defer(() => this.queryClient.fetchQuery({
      queryKey: [...MENU_PUBLICO_KEY, usuarioId],
      queryFn: () => firstValueFrom(this.http.get<MenuItemPublico[]>(this.apiUrl)),
      staleTime: STALE_MENU_MS
    })).pipe(
      tap(items => this.menuSubject.next(items ?? [])),
      catchError(() => {
        this.menuSubject.next([]);
        return of([] as MenuItemPublico[]);
      })
    );
  }

  refrescar(): void {
    this.queryClient.removeQueries({ queryKey: MENU_PUBLICO_KEY });
    this.cargarMenu().subscribe();
  }

  limpiar(): void {
    this.menuSubject.next([]);
    this.queryClient.removeQueries({ queryKey: MENU_PUBLICO_KEY });
  }
}
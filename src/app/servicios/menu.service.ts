import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, of, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { environment } from '../../environments/environment';
import { MenuItemPublico } from '../modelos/menu.model';

const MENU_PUBLICO_KEY = ['menu-publico'];

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private menuSubject = new BehaviorSubject<MenuItemPublico[]>([]);
  public menu$: Observable<MenuItemPublico[]> = this.menuSubject.asObservable();

  private apiUrl = `${environment.apiUrl}/auth/menu`;
  private queryClient = injectQueryClient();

  constructor(private http: HttpClient) {}

  cargarMenu(): Observable<MenuItemPublico[]> {
    const promesa = this.queryClient.fetchQuery({
      queryKey: MENU_PUBLICO_KEY,
      queryFn: () => firstValueFrom(this.http.get<MenuItemPublico[]>(this.apiUrl)),
      staleTime: 5 * 60 * 1000,
    });

    return from(promesa).pipe(
      tap(items => this.menuSubject.next(items || [])),
      catchError(() => {
        this.menuSubject.next([]);
        return of([]);
      })
    );
  }

  limpiar(): void {
    this.menuSubject.next([]);
    this.queryClient.removeQueries({ queryKey: MENU_PUBLICO_KEY });
  }
}
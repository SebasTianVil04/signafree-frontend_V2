import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, Subscription, of, timer } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  shareReplay,
  switchMap,
  tap
} from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegistroRequest,
  Usuario,
  SolicitudRecuperacion,
  ConfirmarRecuperacion,
  RespuestaRecuperacion,
  CambiarPassword,
  ValidacionUtils,
  esUsuarioAdmin
} from '../modelos/usuario.model';
import { MANEJO_LOCAL_ERRORES } from '../interceptores/error.interceptor';
import { SKIP_GLOBAL_LOADING } from '../interceptores/loading-context';

@Injectable({
  providedIn: 'root'
})
export class AutenticacionService {
  private readonly apiUrl = environment.apiUrl;
  private readonly usuarioActualSubject = new BehaviorSubject<Usuario | null>(null);
  readonly usuarioActual: Observable<Usuario | null> = this.usuarioActualSubject.asObservable();

  private readonly INTERVALO_RENOVACION_MS = 10 * 60 * 1000;

  private cargaUsuario$?: Observable<Usuario | null>;
  private refresco$?: Observable<void>;
  private renovacionSub?: Subscription;
  private tokenRecuperacion: string | null = null;

  private sesionCerradaExplicitamente = false;

  private readonly PERMISOS_PANEL: readonly string[] = [
    'admin.dashboard.ver',
    'admin.usuarios.listar',
    'admin.usuarios.ver',
    'admin.usuarios.editar',
    'admin.usuarios.eliminar',
    'admin.usuarios.asignar_rol',
    'admin.usuarios.cambiar_estado',
    'admin.usuarios.ver_estadisticas',
    'admin.roles.gestionar',
    'admin.menu.gestionar',
    'admin.reportes.ver',
    'admin.archivos.limpiar',
    'admin.categorias.gestionar',
    'admin.lecciones.gestionar',
    'admin.examenes.gestionar',
    'categorias.gestionar_senas',
    'clases.crear',
    'clases.editar',
    'clases.eliminar',
    'dataset.categorias.gestionar',
    'dataset.videos.gestionar',
    'modelos.gestionar',
    'captura.gestionar',
    'tipos_categoria.gestionar'
  ];

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    this.usuarioActualSubject.pipe(
      map(usuario => !!usuario),
      distinctUntilChanged()
    ).subscribe(activo => {
      if (activo) {
        this.iniciarRenovacionAutomatica();
      } else {
        this.detenerRenovacionAutomatica();
      }
    });
  }

  private get contextoLocal(): HttpContext {
    return new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
  }

  private normalizarUsuario(usuario: Usuario): Usuario {
    return { ...usuario, es_admin: esUsuarioAdmin(usuario) };
  }

  private permisosUsuario(): string[] | null {
    const usuario = this.usuarioActualValor;
    if (!usuario) return null;
    return usuario.permisos ?? [];
  }

  private iniciarRenovacionAutomatica(): void {
    if (this.renovacionSub) return;

    this.renovacionSub = timer(this.INTERVALO_RENOVACION_MS, this.INTERVALO_RENOVACION_MS).pipe(
      filter(() => !!this.usuarioActualValor),
      switchMap(() =>
        this.refrescarSesion().pipe(
          catchError((error: HttpErrorResponse) => {
            this.manejarFalloRenovacion(error);
            return EMPTY;
          })
        )
      )
    ).subscribe();
  }

  private detenerRenovacionAutomatica(): void {
    this.renovacionSub?.unsubscribe();
    this.renovacionSub = undefined;
  }

  private manejarFalloRenovacion(error: HttpErrorResponse): void {
    if (error.status === 401 || error.status === 403) {
      this.limpiarSesion();
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url, sesion: 'expirada' }
      });
    }
  }

  get usuarioActualValor(): Usuario | null {
    return this.usuarioActualSubject.value;
  }

  cargarUsuarioSiEsNecesario(): Observable<Usuario | null> {
    if (this.usuarioActualValor) return of(this.usuarioActualValor);

    if (this.sesionCerradaExplicitamente) {
      return of(null);
    }

    if (!this.cargaUsuario$) {
      this.cargaUsuario$ = this.http.get<Usuario>(
        `${this.apiUrl}/usuarios/perfil`,
        { context: this.contextoLocal }
      ).pipe(
        map(usuario => this.normalizarUsuario(usuario)),
        tap(usuario => this.usuarioActualSubject.next(usuario)),
        catchError(() => {
          this.usuarioActualSubject.next(null);
          return of(null);
        }),
        finalize(() => (this.cargaUsuario$ = undefined)),
        shareReplay(1)
      );
    }
    return this.cargaUsuario$;
  }

  refrescarSesion(): Observable<void> {
    if (this.sesionCerradaExplicitamente) {
      return EMPTY;
    }

    if (!this.refresco$) {
      this.refresco$ = this.http.post<void>(
        `${this.apiUrl}/auth/refresh`,
        {},
        { context: this.contextoLocal.set(SKIP_GLOBAL_LOADING, true) }
      ).pipe(
        finalize(() => (this.refresco$ = undefined)),
        shareReplay(1)
      );
    }
    return this.refresco$;
  }

  login(credenciales: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/login`,
      credenciales,
      { context: this.contextoLocal }
    ).pipe(
      tap(respuesta => {
        this.sesionCerradaExplicitamente = false;
        this.usuarioActualSubject.next(this.normalizarUsuario(respuesta.usuario));
      })
    );
  }

  registro(datos: RegistroRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/registro`,
      datos,
      { context: this.contextoLocal }
    ).pipe(
      tap(respuesta => {
        this.sesionCerradaExplicitamente = false;
        this.usuarioActualSubject.next(this.normalizarUsuario(respuesta.usuario));
      })
    );
  }

  cerrarSesion(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/auth/logout`,
      {},
      { context: this.contextoLocal }
    ).pipe(
      catchError(() => of(null)),
      tap(() => this.logout())
    );
  }

  logout(): void {
    this.limpiarSesion();
    this.router.navigate(['/login']);
  }

  estaAutenticado(): boolean {
    return !!this.usuarioActualValor;
  }

  esAdmin(): boolean {
    return esUsuarioAdmin(this.usuarioActualValor);
  }

  tieneRol(codigo: string): boolean {
    return this.usuarioActualValor?.rol?.codigo === codigo;
  }

  esEntrenador(): boolean {
    return this.tieneRol('entrenador');
  }

  esEditor(): boolean {
    return this.tieneRol('editor');
  }

  esUsuarioBase(): boolean {
    return this.tieneRol('usuario');
  }

  tienePermiso(codigo: string): boolean {
    const permisos = this.permisosUsuario();
    if (!permisos) return false;
    return this.esAdmin() || permisos.includes(codigo);
  }

  tieneAlgunPermiso(...codigos: string[]): boolean {
    const permisos = this.permisosUsuario();
    if (!permisos) return false;
    return this.esAdmin() || codigos.some(codigo => permisos.includes(codigo));
  }

  tieneTodosLosPermisos(...codigos: string[]): boolean {
    const permisos = this.permisosUsuario();
    if (!permisos) return false;
    return this.esAdmin() || codigos.every(codigo => permisos.includes(codigo));
  }

  tieneAlgunPermisoDe(prefijo: string): boolean {
    const permisos = this.permisosUsuario();
    if (!permisos) return false;
    return this.esAdmin() || permisos.some(p => p.startsWith(prefijo));
  }

  esAdminOSuperior(): boolean {
    return this.esAdmin() || this.tieneAlgunPermiso(...this.PERMISOS_PANEL);
  }

  obtenerUsuarioActual(): Usuario | null {
    return this.usuarioActualValor;
  }

  actualizarUsuarioLocal(usuario: Usuario): void {
    this.usuarioActualSubject.next(this.normalizarUsuario(usuario));
  }

  limpiarSesion(): void {
    this.sesionCerradaExplicitamente = true;
    this.usuarioActualSubject.next(null);
    this.cargaUsuario$ = undefined;
    this.refresco$ = undefined;
    this.tokenRecuperacion = null;
  }

  validarNombreUsuario(nombreUsuario: string): boolean {
    return ValidacionUtils.esNombreUsuarioValido(nombreUsuario);
  }

  validarEmail(email: string): boolean {
    return ValidacionUtils.esEmailValido(email);
  }

  validarPassword(password: string): { esValida: boolean; errores: string[] } {
    return ValidacionUtils.esPasswordSegura(password);
  }

  passwordsCoinciden(password: string, confirmarPassword: string): boolean {
    return ValidacionUtils.passwordsCoinciden(password, confirmarPassword);
  }

  normalizarEmail(email: string): string {
    return ValidacionUtils.normalizarEmail(email);
  }

  solicitarRecuperacion(datos: SolicitudRecuperacion): Observable<RespuestaRecuperacion> {
    return this.http.post<RespuestaRecuperacion>(
      `${this.apiUrl}/auth/solicitar-recuperacion`,
      datos,
      { context: this.contextoLocal }
    );
  }

  confirmarRecuperacion(datos: ConfirmarRecuperacion): Observable<RespuestaRecuperacion> {
    return this.http.post<RespuestaRecuperacion>(
      `${this.apiUrl}/auth/confirmar-recuperacion`,
      datos,
      { context: this.contextoLocal }
    );
  }

  cambiarPassword(datos: CambiarPassword): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/auth/cambiar-password`,
      datos,
      { context: this.contextoLocal }
    );
  }

  verificarTokenRecuperacion(token: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/auth/verificar-token-recuperacion/${encodeURIComponent(token)}`,
      { context: this.contextoLocal }
    );
  }

  extraerTokenDeUrl(url: string = window.location.href): string | null {
    try {
      return new URL(url).searchParams.get('token');
    } catch {
      return null;
    }
  }

  guardarTokenRecuperacion(token: string): void {
    this.tokenRecuperacion = token;
  }

  obtenerTokenRecuperacion(): string | null {
    return this.tokenRecuperacion;
  }

  limpiarTokenRecuperacion(): void {
    this.tokenRecuperacion = null;
  }

  obtenerUsuario(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/usuarios/perfil`);
  }

  actualizarUsuario(datos: Partial<Usuario>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/usuarios/perfil`, datos).pipe(
      tap(respuesta => {
        if (respuesta.datos) {
          this.usuarioActualSubject.next(this.normalizarUsuario(respuesta.datos));
        }
      })
    );
  }
}
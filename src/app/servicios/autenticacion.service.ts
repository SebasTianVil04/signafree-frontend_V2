import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
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
  VerificarEmailResponse,
  TipoUsuario,
  ValidacionUtils,
  esUsuarioAdmin
} from '../modelos/usuario.model';
import { MANEJO_LOCAL_ERRORES } from '../interceptores/error.interceptor';

@Injectable({
  providedIn: 'root'
})
export class AutenticacionService {
  private usuarioActualSubject: BehaviorSubject<Usuario | null>;
  public usuarioActual: Observable<Usuario | null>;

  private readonly PERMISOS_ADMIN: string[] = [
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
    'admin.examenes.gestionar',
    'admin.reportes.ver',
    'admin.archivos.limpiar'
  ];

  private readonly PERMISOS_GESTION: string[] = [
    'categorias.ver',
    'categorias.crear',
    'categorias.editar',
    'categorias.eliminar',
    'categorias.gestionar_senas',
    'lecciones.ver',
    'lecciones.crear',
    'lecciones.editar',
    'lecciones.eliminar',
    'clases.ver',
    'clases.crear',
    'clases.editar',
    'clases.eliminar',
    'dataset.gestionar',
    'modelos.gestionar',
    'captura.gestionar',
    'tipos_categoria.gestionar',
    'examenes.ver'
  ];

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    const usuarioGuardado = localStorage.getItem('usuario');
    const usuarioInicial = usuarioGuardado
      ? this.normalizarUsuario(JSON.parse(usuarioGuardado))
      : null;
    this.usuarioActualSubject = new BehaviorSubject<Usuario | null>(usuarioInicial);
    this.usuarioActual = this.usuarioActualSubject.asObservable();
  }

  private normalizarUsuario(usuario: Usuario): Usuario {
    return {
      ...usuario,
      es_admin: esUsuarioAdmin(usuario)
    };
  }

  public get usuarioActualValor(): Usuario | null {
    return this.usuarioActualSubject.value;
  }



  login(credenciales: LoginRequest): Observable<AuthResponse> {
    const context = new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/auth/login`,
      credenciales,
      { context }
    ).pipe(
      tap(respuesta => {
        const usuarioNormalizado = this.normalizarUsuario(respuesta.usuario);
        localStorage.setItem('token', respuesta.access_token);
        localStorage.setItem('usuario', JSON.stringify(usuarioNormalizado));
        this.usuarioActualSubject.next(usuarioNormalizado);
      })
    );
  }

  registro(datos: RegistroRequest): Observable<AuthResponse> {
    const context = new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
    return this.http.post<AuthResponse>(
      `${environment.apiUrl}/auth/registro`,
      datos,
      { context }
    ).pipe(
      tap(respuesta => {
        const usuarioNormalizado = this.normalizarUsuario(respuesta.usuario);
        localStorage.setItem('token', respuesta.access_token);
        localStorage.setItem('usuario', JSON.stringify(usuarioNormalizado));
        this.usuarioActualSubject.next(usuarioNormalizado);
      })
    );
  }

  cerrarSesion(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
      tap(() => this.logout())
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.usuarioActualSubject.next(null);
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
    if (this.esAdmin()) return true;
    return !!this.usuarioActualValor?.permisos?.includes(codigo);
  }

  tieneAlgunPermiso(...codigos: string[]): boolean {
    if (this.esAdmin()) return true;
    const permisos = this.usuarioActualValor?.permisos || [];
    return codigos.some(codigo => permisos.includes(codigo));
  }

  tieneTodosLosPermisos(...codigos: string[]): boolean {
    if (this.esAdmin()) return true;
    const permisos = this.usuarioActualValor?.permisos || [];
    return codigos.every(codigo => permisos.includes(codigo));
  }

  tieneAlgunPermisoDe(prefijo: string): boolean {
    if (this.esAdmin()) return true;
    const permisos = this.usuarioActualValor?.permisos || [];
    return permisos.some(p => p.startsWith(prefijo));
  }

  esAdminOSuperior(): boolean {
    if (this.esAdmin()) return true;
    if (this.tieneAlgunPermiso(...this.PERMISOS_ADMIN)) return true;
    if (this.tieneAlgunPermiso(...this.PERMISOS_GESTION)) return true;
    return false;
  }



  obtenerTipoUsuario(): TipoUsuario | null {
    return this.usuarioActualValor?.tipo_usuario || null;
  }

  esPeruanoMayor(): boolean {
    return this.usuarioActualValor?.tipo_usuario === 'peruano_mayor';
  }

  esPeruanoMenor(): boolean {
    return this.usuarioActualValor?.tipo_usuario === 'peruano_menor';
  }

  esExtranjero(): boolean {
    return this.usuarioActualValor?.tipo_usuario === 'extranjero';
  }


  obtenerToken(): string | null {
    return localStorage.getItem('token');
  }



  obtenerDocumentoIdentidad(): string {
    const usuario = this.usuarioActualValor;
    if (!usuario) return 'Sin documento';
    if (usuario.tipo_usuario === 'extranjero' && usuario.pasaporte) {
      return usuario.pasaporte;
    }
    return usuario.dni || 'Sin documento';
  }

  obtenerTipoDocumento(): string {
    const usuario = this.usuarioActualValor;
    if (!usuario) return 'Documento';
    return ValidacionUtils.obtenerTipoDocumento(usuario);
  }



  obtenerUsuarioActual(): Usuario | null {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        return this.normalizarUsuario(JSON.parse(usuarioStr));
      } catch {
        return null;
      }
    }
    return null;
  }

  actualizarUsuarioLocal(usuario: any): void {
    try {
      const usuarioNormalizado = this.normalizarUsuario(usuario);
      localStorage.setItem('usuario', JSON.stringify(usuarioNormalizado));
      this.usuarioActualSubject.next(usuarioNormalizado);
    } catch (error) {
      console.error('Error al actualizar usuario local:', error);
    }
  }

  limpiarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.usuarioActualSubject.next(null);
  }



  obtenerTelefonoCompleto(codigoPais: string, numero: string): string | null {
    if (!numero || numero.trim() === '') return null;
    const numeroLimpio = numero.replace(/\D/g, '');
    return `${codigoPais}${numeroLimpio}`;
  }

  extraerCodigoPais(telefono: string | null | undefined): string {
    if (!telefono) return '+51';
    return ValidacionUtils.extraerCodigoPais(telefono);
  }

  extraerNumeroTelefono(telefono: string | null | undefined): string {
    if (!telefono) return '';
    return ValidacionUtils.extraerNumeroSinCodigo(telefono);
  }

  formatearTelefono(telefono: string | null | undefined): string {
    if (!telefono) return 'No especificado';
    return ValidacionUtils.formatearTelefono(telefono);
  }



  validarDni(dni: string): boolean {
    return ValidacionUtils.esDniValido(dni);
  }

  validarPasaporte(pasaporte: string): boolean {
    return ValidacionUtils.esPasaporteValido(pasaporte);
  }

  validarTelefono(telefono: string): boolean {
    if (!telefono) return true;
    return ValidacionUtils.esTelefonoValido(telefono);
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

  verificarEmailExiste(email: string): Observable<VerificarEmailResponse> {
    return this.http.post<VerificarEmailResponse>(
      `${environment.apiUrl}/auth/verificar-email`,
      { email: email.trim().toLowerCase() }
    );
  }


  solicitarRecuperacion(datos: SolicitudRecuperacion): Observable<RespuestaRecuperacion> {
    const context = new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
    return this.http.post<RespuestaRecuperacion>(
      `${environment.apiUrl}/auth/solicitar-recuperacion`,
      datos,
      { context }
    );
  }

  confirmarRecuperacion(datos: ConfirmarRecuperacion): Observable<RespuestaRecuperacion> {
    const context = new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
    return this.http.post<RespuestaRecuperacion>(
      `${environment.apiUrl}/auth/confirmar-recuperacion`,
      datos,
      { context }
    );
  }

  cambiarPassword(datos: CambiarPassword): Observable<any> {
    const context = new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
    return this.http.put(
      `${environment.apiUrl}/auth/cambiar-password`,
      datos,
      { context }
    );
  }

  verificarTokenRecuperacion(token: string): Observable<any> {
    const context = new HttpContext().set(MANEJO_LOCAL_ERRORES, true);
    return this.http.get(
      `${environment.apiUrl}/auth/verificar-token-recuperacion/${token}`,
      { context }
    );
  }

  extraerTokenDeUrl(url: string = window.location.href): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('token');
    } catch {
      return null;
    }
  }

  guardarTokenRecuperacion(token: string): void {
    sessionStorage.setItem('tokenRecuperacion', token);
  }

  obtenerTokenRecuperacion(): string | null {
    return sessionStorage.getItem('tokenRecuperacion');
  }

  limpiarTokenRecuperacion(): void {
    sessionStorage.removeItem('tokenRecuperacion');
  }



  obtenerUsuario(): Observable<Usuario> {
    return this.http.get<Usuario>(`${environment.apiUrl}/usuarios/perfil`);
  }

  actualizarUsuario(datos: Partial<Usuario>): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/usuarios/perfil`, datos).pipe(
      tap(respuesta => {
        if (respuesta.datos) {
          const usuarioNormalizado = this.normalizarUsuario(respuesta.datos);
          localStorage.setItem('usuario', JSON.stringify(usuarioNormalizado));
          this.usuarioActualSubject.next(usuarioNormalizado);
        }
      })
    );
  }



  calcularEdad(fechaNacimiento: Date | string): number | null {
    return ValidacionUtils.calcularEdad(fechaNacimiento);
  }

  validarEdadPorTipo(fechaNacimiento: Date | string, tipoUsuario: TipoUsuario): boolean {
    return ValidacionUtils.validarEdadPorTipo(fechaNacimiento, tipoUsuario);
  }


  normalizarEmail(email: string): string {
    return ValidacionUtils.normalizarEmail(email);
  }

  normalizarPasaporte(pasaporte: string): string {
    return ValidacionUtils.normalizarPasaporte(pasaporte);
  }
}
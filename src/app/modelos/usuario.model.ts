export interface RolUsuario {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Usuario {
  id: number;
  nombre_usuario: string;
  email: string;
  activo: boolean;
  es_admin?: boolean;
  verificado: boolean;
  rol?: RolUsuario;
  permisos?: string[];
  fecha_creacion?: Date | string;
}

export function esUsuarioAdmin(usuario: Usuario | null | undefined): boolean {
  return !!usuario?.rol && usuario.rol.codigo === 'admin';
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegistroRequest {
  nombre_usuario: string;
  email: string;
  password: string;
}

export interface SolicitudRecuperacion {
  email: string;
}

export interface RespuestaRecuperacion {
  mensaje: string;
  email?: string;
}

export interface VerificarTokenResponse {
  mensaje: string;
  email: string;
  expira_en: string;
}

export interface ConfirmarRecuperacion {
  token: string;
  password_nueva: string;
}

export interface FormularioRestablecerPassword {
  password_nueva: string;
  confirmar_password: string;
}

export interface CambiarPassword {
  password_actual: string;
  password_nueva: string;
}

export interface VerificarEmailRequest {
  email: string;
}

export interface VerificarEmailResponse {
  existe: boolean;
  activo?: boolean;
  mensaje: string;
  emailNoExiste?: boolean;
}

export interface ValidacionPassword {
  esValida: boolean;
  errores: string[];
}

export interface FortalezaPassword {
  nivel: 'debil' | 'medio' | 'fuerte';
  progreso: number;
  sugerencias: string[];
}

export interface EstadoFormulario {
  cargando: boolean;
  enviado: boolean;
  completado: boolean;
  error: string | null;
  exito: string | null;
}

export interface EstadoRecuperacion extends EstadoFormulario {
  verificandoToken: boolean;
  tokenValido: boolean;
  emailEnviado: string;
  emailAsociado: string;
}

export type TipoError =
  | 'email_no_valido'
  | 'email_no_existe'
  | 'usuario_desactivado'
  | 'token_invalido'
  | 'token_expirado'
  | 'token_usado'
  | 'password_debil'
  | 'passwords_no_coinciden'
  | 'password_actual_incorrecta'
  | 'sin_conexion'
  | 'servidor_error'
  | 'rate_limit'
  | 'nombre_usuario_invalido'
  | 'nombre_usuario_ya_registrado'
  | 'desconocido';

export interface ErrorPersonalizado {
  tipo: TipoError;
  mensaje: string;
  campo?: string;
  sugerencia?: string;
}

export const MENSAJES_ERROR = {
  email_no_valido: 'El formato del correo electrónico no es válido',
  email_no_existe: 'Este correo no está registrado en nuestro sistema',
  usuario_desactivado: 'La cuenta está desactivada. Contacta al administrador',
  token_invalido: 'El enlace de recuperación no es válido',
  token_expirado: 'El enlace de recuperación ha expirado. Solicita uno nuevo',
  token_usado: 'Este enlace ya ha sido utilizado anteriormente',
  password_debil: 'La contrasena no cumple con los requisitos de seguridad',
  passwords_no_coinciden: 'Las contrasenas no coinciden',
  password_actual_incorrecta: 'La contrasena actual es incorrecta',
  sin_conexion: 'Sin conexión a internet. Verifica tu conexión',
  servidor_error: 'Error del servidor. Intenta más tarde',
  rate_limit: 'Demasiados intentos. Espera unos minutos',
  nombre_usuario_invalido: 'El nombre de usuario no es válido',
  nombre_usuario_ya_registrado: 'Este nombre de usuario ya está en uso',
  desconocido: 'Error inesperado. Intenta nuevamente'
} as const;

export const CONFIGURACION_DEFAULT = {
  tiempoEsperaValidacion: 500,
  tiempoRedireccion: 3000,
  longitudMinimaPassword: 8,
  longitudMinimaNombreUsuario: 3,
  longitudMaximaNombreUsuario: 30,
  requiereMayuscula: true,
  requiereMinuscula: true,
  requiereNumero: true,
  requiereCaracterEspecial: true
};

export type EstadoValidacion = 'validando' | 'valido' | 'invalido' | 'neutral';
export type TipoFormulario = 'recuperacion' | 'restablecer' | 'cambiar';
export type NivelFortaleza = 'debil' | 'medio' | 'fuerte';

export class ValidacionUtils {
  static esEmailValido(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static esNombreUsuarioValido(nombreUsuario: string): boolean {
    if (!nombreUsuario) return false;
    const longitudValida =
      nombreUsuario.length >= CONFIGURACION_DEFAULT.longitudMinimaNombreUsuario &&
      nombreUsuario.length <= CONFIGURACION_DEFAULT.longitudMaximaNombreUsuario;
    const formatoValido = /^[a-zA-Z0-9_]+$/.test(nombreUsuario);
    return longitudValida && formatoValido;
  }

  static esPasswordSegura(password: string): ValidacionPassword {
    const errores: string[] = [];

    if (password.length < CONFIGURACION_DEFAULT.longitudMinimaPassword) {
      errores.push('Debe tener al menos 8 caracteres');
    }
    if (CONFIGURACION_DEFAULT.requiereMayuscula && !/[A-Z]/.test(password)) {
      errores.push('Debe tener al menos una mayúscula');
    }
    if (CONFIGURACION_DEFAULT.requiereMinuscula && !/[a-z]/.test(password)) {
      errores.push('Debe tener al menos una minúscula');
    }
    if (CONFIGURACION_DEFAULT.requiereNumero && !/\d/.test(password)) {
      errores.push('Debe tener al menos un número');
    }
    if (CONFIGURACION_DEFAULT.requiereCaracterEspecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errores.push('Debe tener al menos un carácter especial');
    }

    return {
      esValida: errores.length === 0,
      errores
    };
  }

  static obtenerFortalezaPassword(password: string): FortalezaPassword {
    const validacion = this.esPasswordSegura(password);
    const totalRequisitos = 5;
    const requisitosCompletos = totalRequisitos - validacion.errores.length;
    const progreso = Math.round((requisitosCompletos / totalRequisitos) * 100);

    let nivel: NivelFortaleza;
    if (progreso >= 80) {
      nivel = 'fuerte';
    } else if (progreso >= 60) {
      nivel = 'medio';
    } else {
      nivel = 'debil';
    }

    return {
      nivel,
      progreso,
      sugerencias: validacion.errores
    };
  }

  static normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  static passwordsCoinciden(password: string, confirmarPassword: string): boolean {
    return password === confirmarPassword;
  }
}

export function esUsuarioValido(obj: any): obj is Usuario {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.email === 'string' &&
    typeof obj.nombre_usuario === 'string' &&
    typeof obj.activo === 'boolean';
}

export function esAuthResponse(obj: any): obj is AuthResponse {
  return obj &&
    typeof obj.access_token === 'string' &&
    typeof obj.token_type === 'string' &&
    esUsuarioValido(obj.usuario);
}

export function esErrorPersonalizado(obj: any): obj is ErrorPersonalizado {
  return obj &&
    typeof obj.tipo === 'string' &&
    typeof obj.mensaje === 'string';
}

export const CONFIG_APP = {
  API_TIMEOUT: 30000,
  DEBOUNCE_TIME: 500,
  REDIRECT_DELAY: 3000,
  TOKEN_REFRESH_MARGIN: 300000,
  MAX_FILE_SIZE: 5242880,
  FORMATOS_IMAGEN_PERMITIDOS: ['image/jpeg', 'image/png', 'image/webp']
} as const;

export const RUTAS_AUTH = {
  LOGIN: '/login',
  REGISTRO: '/registro',
  DASHBOARD: '/dashboard',
  PERFIL: '/perfil',
  OLVIDASTE_CONTRASENA: '/olvidaste-contrasena',
  RESTABLECER_CONTRASENA: '/restablecer-contrasena',
  CAMBIAR_CONTRASENA: '/cambiar-contrasena',
  INICIO: '/inicio'
} as const;

export const MENSAJES_VALIDACION = {
  nombre_usuario: {
    requerido: 'El nombre de usuario es obligatorio',
    formato: 'Solo letras, números y guion bajo, entre 3 y 30 caracteres',
    duplicado: 'Este nombre de usuario ya está en uso'
  },
  email: {
    requerido: 'El correo electrónico es obligatorio',
    formato: 'El formato del correo no es válido',
    duplicado: 'Este correo ya está registrado'
  },
  password: {
    requerido: 'La contrasena es obligatoria',
    minimo: 'La contrasena debe tener al menos 8 caracteres',
    debil: 'La contrasena es muy débil'
  }
} as const;
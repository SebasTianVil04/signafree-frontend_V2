export type TipoUsuario = 'peruano_mayor' | 'peruano_menor' | 'extranjero';

export interface RolUsuario {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Usuario {
  id: number;
  tipo_usuario: TipoUsuario;
  email: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  apellidos?: string;
  dni?: string | null;
  pasaporte?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fecha_nacimiento?: Date | string | null;
  activo: boolean;
  es_admin?: boolean;
  verificado: boolean;
  rol?: RolUsuario;
  permisos?: string[];
  nombre_completo?: string;
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
  tipo_usuario: TipoUsuario;
  dni?: string | null;
  pasaporte?: string | null; // Cambiado de carnet_extranjeria
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  email: string;
  password: string;
  telefono?: string | null; // Incluye código de país
  fecha_nacimiento?: Date | string | null;
  direccion?: string | null;
}

export interface DatosReniec {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
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

// Interfaz para códigos de país
export interface CodigoPais {
  codigo: string;
  pais: string;
  flag: string;
  longitud?: number; // Longitud esperada del número
}

// Tipos para manejo de errores
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
  | 'dni_invalido'
  | 'pasaporte_invalido' 
  | 'dni_ya_registrado'
  | 'pasaporte_ya_registrado' 
  | 'edad_no_valida'
  | 'fecha_invalida'
  | 'telefono_invalido'
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
  dni_invalido: 'El DNI debe tener 8 dígitos',
  pasaporte_invalido: 'El pasaporte debe tener entre 6 y 20 caracteres', 
  dni_ya_registrado: 'Este DNI ya está registrado',
  pasaporte_ya_registrado: 'Este pasaporte ya está registrado', 
  edad_no_valida: 'La edad no cumple con los requisitos',
  fecha_invalida: 'La fecha de nacimiento no es válida',
  telefono_invalido: 'El número de teléfono no es válido',
  desconocido: 'Error inesperado. Intenta nuevamente'
} as const;

export const CONFIGURACION_DEFAULT = {
  tiempoEsperaValidacion: 500,
  tiempoRedireccion: 3000,
  longitudMinimaPassword: 8,
  longitudDni: 8,
  longitudMinimaPasaporte: 6, 
  longitudMaximaPasaporte: 20, 
  edadMinimaAdulto: 18,
  requiereMayuscula: true,
  requiereMinuscula: true,
  requiereNumero: true,
  requiereCaracterEspecial: true,
  longitudMinimaTelefono: 9,
  longitudMaximaTelefono: 15
};

export type EstadoValidacion = 'validando' | 'valido' | 'invalido' | 'neutral';
export type TipoFormulario = 'recuperacion' | 'restablecer' | 'cambiar';
export type NivelFortaleza = 'debil' | 'medio' | 'fuerte';

// Códigos de país disponibles
export const CODIGOS_PAIS: CodigoPais[] = [
  { codigo: '+51', pais: 'Perú', flag: '🇵🇪', longitud: 9 },
  { codigo: '+1', pais: 'Estados Unidos', flag: '🇺🇸', longitud: 10 },
  { codigo: '+34', pais: 'España', flag: '🇪🇸', longitud: 9 },
  { codigo: '+54', pais: 'Argentina', flag: '🇦🇷', longitud: 10 },
  { codigo: '+56', pais: 'Chile', flag: '🇨🇱', longitud: 9 },
  { codigo: '+57', pais: 'Colombia', flag: '🇨🇴', longitud: 10 },
  { codigo: '+52', pais: 'México', flag: '🇲🇽', longitud: 10 },
  { codigo: '+55', pais: 'Brasil', flag: '🇧🇷', longitud: 11 },
  { codigo: '+593', pais: 'Ecuador', flag: '🇪🇨', longitud: 9 },
  { codigo: '+58', pais: 'Venezuela', flag: '🇻🇪', longitud: 10 }
];

// Utilidades de validación
export class ValidacionUtils {
  static esEmailValido(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  static esDniValido(dni: string): boolean {
    return /^\d{8}$/.test(dni);
  }

  static esPasaporteValido(pasaporte: string): boolean {
    if (!pasaporte) return false;
    
    const longitudValida = pasaporte.length >= CONFIGURACION_DEFAULT.longitudMinimaPasaporte && 
                          pasaporte.length <= CONFIGURACION_DEFAULT.longitudMaximaPasaporte;
    
    const formatoValido = /^[A-Z0-9\-\s]+$/i.test(pasaporte);
    
    return longitudValida && formatoValido;
  }

  static esTelefonoValido(telefono: string): boolean {

    if (!telefono.startsWith('+')) {
      return false;
    }
    
    const soloDigitos = telefono.replace(/\D/g, '');
    
    return soloDigitos.length >= CONFIGURACION_DEFAULT.longitudMinimaTelefono && 
           soloDigitos.length <= CONFIGURACION_DEFAULT.longitudMaximaTelefono;
  }

  static calcularEdad(fechaNacimiento: Date | string): number | null {
    try {
      const fecha = typeof fechaNacimiento === 'string' 
        ? new Date(fechaNacimiento) 
        : fechaNacimiento;

      if (isNaN(fecha.getTime())) {
        return null;
      }

      const hoy = new Date();
      let edad = hoy.getFullYear() - fecha.getFullYear();
      const mesActual = hoy.getMonth();
      const mesNacimiento = fecha.getMonth();

      if (mesActual < mesNacimiento || 
          (mesActual === mesNacimiento && hoy.getDate() < fecha.getDate())) {
        edad--;
      }

      return edad;
    } catch {
      return null;
    }
  }

  static validarEdadPorTipo(fechaNacimiento: Date | string, tipoUsuario: TipoUsuario): boolean {
    const edad = this.calcularEdad(fechaNacimiento);
    
    if (edad === null) {
      return false;
    }

    switch (tipoUsuario) {
      case 'peruano_menor':
        return edad < CONFIGURACION_DEFAULT.edadMinimaAdulto;
      case 'peruano_mayor':
      case 'extranjero':
        return edad >= CONFIGURACION_DEFAULT.edadMinimaAdulto;
      default:
        return false;
    }
  }

  static extraerCodigoPais(telefono: string): string {
    if (!telefono || !telefono.startsWith('+')) {
      return '+51'; // Default para Perú
    }

    // Códigos de país conocidos ordenados por longitud (de mayor a menor)
    const codigosConocidos = [
      '+593', '+507', '+506', '+505', '+504', '+503', '+502', '+501', 
      '+51', '+52', '+53', '+54', '+55', '+56', '+57', '+58', 
      '+34', '+33', '+44', '+49', '+39', '+41', '+43', '+45', 
      '+1', '+7' 
    ];

    // Buscar el código de país que coincida
    for (const codigo of codigosConocidos) {
      if (telefono.startsWith(codigo)) {
        return codigo;
      }
    }

    // Si no encuentra coincidencia, intentar extraer hasta el primer espacio o hasta 4 dígitos
    const match = telefono.match(/^(\+\d{1,4})/);
    return match ? match[1] : '+51';
  }

  static extraerNumeroSinCodigo(telefono: string): string {
    if (!telefono || !telefono.startsWith('+')) {
      return telefono;
    }

    const codigoPais = this.extraerCodigoPais(telefono);
    // Remover el código de país y cualquier espacio o carácter no numérico al inicio
    let numero = telefono.substring(codigoPais.length).trim();
    
    // Remover espacios del número
    numero = numero.replace(/\s/g, '');
    
    return numero;
  }

  static formatearTelefono(telefono: string): string {
    if (!telefono || !telefono.startsWith('+')) {
      return telefono;
    }

    const codigoPais = this.extraerCodigoPais(telefono);
    const numero = this.extraerNumeroSinCodigo(telefono);

    if (!numero) {
      return codigoPais;
    }

    // Formatear número en grupos de 3 dígitos
    if (numero.length === 9) {
      return `${codigoPais} ${numero.slice(0, 3)} ${numero.slice(3, 6)} ${numero.slice(6)}`;
    } else if (numero.length === 10) {
      return `${codigoPais} ${numero.slice(0, 3)} ${numero.slice(3, 6)} ${numero.slice(6)}`;
    }

    return `${codigoPais} ${numero}`;
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

  static obtenerDocumentoIdentidad(usuario: Usuario): string {
    if (usuario.tipo_usuario === 'extranjero' && usuario.pasaporte) {
      return usuario.pasaporte;
    }
    return usuario.dni || 'Sin documento';
  }

  static obtenerTipoDocumento(usuario: Usuario): string {
    if (usuario.tipo_usuario === 'extranjero') {
      return 'Pasaporte'; // Cambiado de 'Carnet de Extranjería'
    }
    return 'DNI';
  }

  static esFechaValida(fecha: string | Date): boolean {
    try {
      const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
      
      // Verificar que sea una fecha válida
      if (isNaN(fechaObj.getTime())) {
        return false;
      }

      // Verificar que no sea una fecha futura
      const hoy = new Date();
      if (fechaObj > hoy) {
        return false;
      }

      // Verificar que la persona no tenga más de 120 años
      const edad = this.calcularEdad(fechaObj);
      if (edad === null || edad > 120) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  static normalizarPasaporte(pasaporte: string): string {
    // Normalizar pasaporte: convertir a mayúsculas y remover espacios extras
    return pasaporte.trim().toUpperCase().replace(/\s+/g, ' ');
  }
}

// Type guards
export function esUsuarioValido(obj: any): obj is Usuario {
  return obj && 
    typeof obj.id === 'number' &&
    typeof obj.email === 'string' &&
    typeof obj.nombres === 'string' &&
    typeof obj.activo === 'boolean' &&
    typeof obj.tipo_usuario === 'string' &&
    ['peruano_mayor', 'peruano_menor', 'extranjero'].includes(obj.tipo_usuario);
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

export function esTipoUsuarioValido(tipo: any): tipo is TipoUsuario {
  return ['peruano_mayor', 'peruano_menor', 'extranjero'].includes(tipo);
}

// Constantes de configuración
export const CONFIG_APP = {
  API_TIMEOUT: 30000,
  DEBOUNCE_TIME: 500,
  REDIRECT_DELAY: 3000,
  TOKEN_REFRESH_MARGIN: 300000,
  MAX_FILE_SIZE: 5242880, // 5MB
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

export const ETIQUETAS_TIPO_USUARIO: Record<TipoUsuario, string> = {
  peruano_mayor: 'Peruano Mayor de Edad',
  peruano_menor: 'Peruano Menor de Edad',
  extranjero: 'Extranjero'
};

export const MENSAJES_VALIDACION = {
  dni: {
    requerido: 'El DNI es obligatorio',
    formato: 'El DNI debe tener 8 dígitos',
    duplicado: 'Este DNI ya está registrado'
  },
  pasaporte: { // Cambiado de carnet
    requerido: 'El pasaporte es obligatorio',
    formato: 'El pasaporte debe tener entre 6 y 20 caracteres alfanuméricos',
    duplicado: 'Este pasaporte ya está registrado'
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
  },
  telefono: {
    formato: 'El formato del teléfono no es válido',
    minimo: 'El número es demasiado corto',
    duplicado: 'Este número de teléfono ya está registrado'
  },
  fecha: {
    requerido: 'La fecha de nacimiento es obligatoria',
    invalida: 'La fecha no es válida',
    futura: 'La fecha no puede ser futura',
    edadNoCoincide: 'La edad no coincide con el tipo de usuario'
  }
} as const;
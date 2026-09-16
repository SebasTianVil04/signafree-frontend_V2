interface Auth {
  LOGIN: string;
  REGISTRO: string;
  LOGOUT: string;
  PERFIL: string;
}

interface Endpoints {
  AUTH: Auth;               
  VERIFICAR_DNI: string;   
}

export const CONSTANTES = {
  // Claves de autenticación
  TOKEN_KEY: 'access_token',
  USUARIO_KEY: 'usuario',

  // Endpoints de la API
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTRO: '/auth/registro',
      LOGOUT: '/auth/logout',
      PERFIL: '/auth/perfil',
    },
    VERIFICAR_DNI: '/auth/verificar-dni', 
  } as Endpoints, 

 
  MENSAJES: {
    ERROR_INESPERADO: 'Ocurrió un error inesperado.',
    ERROR_CONEXION: 'Problemas de conexión con el servidor.',
    SESION_EXPIRADA: 'Tu sesión ha expirado, por favor inicia sesión nuevamente.',
  },


  NIVELES: {
    BASICO: 1,
    INTERMEDIO: 2,
    AVANZADO: 3,
  },
  NOMBRES_NIVELES: {
    1: 'Básico',
    2: 'Intermedio',
    3: 'Avanzado',
  },
  COLORES_NIVELES: {
    1: '#FF6B6B',
    2: '#4ECDC4',
    3: '#45B7D1',
  },
  PUNTUACION: {
    MINIMA_APROBACION: 50,
    MAXIMA: 100,
    POR_LECCION_COMPLETADA: 10,
    BONIFICACION_PERFECTO: 20,
  },
  TIEMPOS: {
    TIEMPO_LECCION: 300,
  },


  VALIDACIONES: {
    MINIMO_LONGITUD_PASSWORD: 8,
    MAXIMO_LONGITUD_PASSWORD: 20,
    EMAIL_REQUERIDO: 'El correo electrónico es obligatorio.',
    PASSWORD_REQUERIDO: 'La contraseña es obligatoria.',
    DNI_PATTERN: /^[0-9]{8}$/,  
  },
};

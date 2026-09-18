export interface Permiso {
    id: number;
    codigo: string;
    modulo: string;
    descripcion: string;
}

export interface Rol {
    id: number;
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    es_sistema: boolean;
    activo: boolean;
    permisos: Permiso[];
}

export interface RolCrear {
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    permisos_ids: number[];
}

export interface RolActualizar {
    nombre?: string;
    descripcion?: string | null;
    activo?: boolean;
}

export interface AsignarPermisosRequest {
    permisos_ids: number[];
}

export interface PermisosPorModulo {
    modulo: string;
    permisos: Permiso[];
}
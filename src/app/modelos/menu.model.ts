export interface MenuItemPublico {
    label: string;
    icon?: string;
    ruta?: string;
    hijos?: MenuItemPublico[];
}

export interface MenuItemAdmin {
    id?: number;
    label: string;
    icon?: string;
    ruta?: string;
    permiso_codigo?: string | null;
    orden: number;
    activo: boolean;
    padre_id?: number | null;
    hijos?: MenuItemAdmin[];
}
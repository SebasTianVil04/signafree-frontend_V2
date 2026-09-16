import { Component, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { Leccion, CategoriaDB, NivelDificultad, NIVELES_DIFICULTAD } from '../../../modelos/leccion.model';
import { LeccionesService, RespuestaAPI } from '../../../servicios/lecciones.service';

@Component({
  selector: 'app-lista-lecciones',
  templateUrl: './lista-lecciones.component.html',
  styleUrls: ['./lista-lecciones.component.scss'],
  standalone: false
})
export class ListaLeccionesComponent implements OnInit {
  leccionesFiltradas: Leccion[] = [];

  filtros = {
    categoria_id: undefined as number | undefined,
    nivel_dificultad: undefined as NivelDificultad | undefined,
    busqueda: ''
  };

  niveles = NIVELES_DIFICULTAD;
  vistaGrid = true;

  categoriasQuery = injectQuery(() => ({
    queryKey: ['categorias'],
    queryFn: () => firstValueFrom(this.leccionesService.obtenerCategorias(true)),
    staleTime: Infinity,
  }));

  leccionesQuery = injectQuery(() => ({
    queryKey: ['lecciones'],
    queryFn: () => firstValueFrom(this.leccionesService.obtenerLecciones({})),
    staleTime: 30_000,
    retry: 3,
  }));

  get categorias(): CategoriaDB[] {
    const res = this.categoriasQuery.data();
    return res?.exito && res.datos ? res.datos : [];
  }

  get cargando(): boolean {
    return this.leccionesQuery.isPending();
  }

  get error(): string | null {
    if (!this.leccionesQuery.isError()) return null;
    const err: any = this.leccionesQuery.error();
    return err?.error?.mensaje || err?.error?.detail || err?.message || 'Error al cargar las lecciones. Por favor, intenta recargar la página.';
  }

  constructor(
    private leccionesService: LeccionesService,
    private router: Router
  ) {
    effect(() => {
      const res = this.leccionesQuery.data();
      const lecciones = res?.exito && res.datos ? res.datos.filter(l => l.activa) : [];
      this.leccionesFiltradas = this.filtrar(lecciones);
    });
  }

  ngOnInit(): void {}

  private obtenerLeccionesBase(): Leccion[] {
    const res = this.leccionesQuery.data();
    return res?.exito && res.datos ? res.datos.filter(l => l.activa) : [];
  }

  private filtrar(lecciones: Leccion[]): Leccion[] {
    const textoBusqueda = this.filtros.busqueda.toLowerCase().trim();
    return lecciones.filter(leccion => {
      const cumpleCategoria = !this.filtros.categoria_id ||
        leccion.categoria_id === this.filtros.categoria_id;
      const cumpleNivel = !this.filtros.nivel_dificultad ||
        leccion.nivel_dificultad === this.nivelDificultadANumero(this.filtros.nivel_dificultad);
      const cumpleBusqueda = !textoBusqueda ||
        leccion.titulo.toLowerCase().includes(textoBusqueda) ||
        leccion.sena.toLowerCase().includes(textoBusqueda) ||
        (leccion.descripcion && leccion.descripcion.toLowerCase().includes(textoBusqueda));
      return cumpleCategoria && cumpleNivel && cumpleBusqueda;
    });
  }

  onFiltroChange(): void {
    this.leccionesFiltradas = this.filtrar(this.obtenerLeccionesBase());
  }

  limpiarFiltros(): void {
    this.filtros = { categoria_id: undefined, nivel_dificultad: undefined, busqueda: '' };
    this.onFiltroChange();
  }

  verDetalle(leccion: Leccion): void {
    if (!leccion.id) {
      console.error('Lección sin ID');
      return;
    }

    if (!leccion.activa) {
      alert('Esta lección no está activa actualmente');
      return;
    }

    if (leccion.bloqueada) {
      alert('Debes completar la lección anterior primero');
      return;
    }

    this.router.navigate(['/lecciones', leccion.id]);
  }

  iniciarLeccion(leccion: Leccion, event: Event): void {
    event.stopPropagation();
    this.verDetalle(leccion);
  }

  toggleVista(): void {
    this.vistaGrid = !this.vistaGrid;
  }

  obtenerEtiquetaNivel(nivel: number): string {
    const mapeo: Record<number, string> = {
      1: 'Principiante',
      2: 'Intermedio',
      3: 'Avanzado'
    };
    return mapeo[nivel] || 'Desconocido';
  }

  obtenerNombreCategoria(categoriaId: number): string {
    const categoria = this.categorias.find(c => c.id === categoriaId);
    return categoria?.nombre || 'Sin categoría';
  }

  obtenerColorNivel(nivel: number): string {
    const mapeo: Record<number, string> = {
      1: '#3B82F6',
      2: '#F59E0B',
      3: '#EF4444'
    };
    return mapeo[nivel] || '#6B7280';
  }

  private nivelDificultadANumero(nivel: NivelDificultad): number {
    const mapeo: Record<NivelDificultad, number> = {
      [NivelDificultad.PRINCIPIANTE]: 1,
      [NivelDificultad.INTERMEDIO]: 2,
      [NivelDificultad.AVANZADO]: 3
    };
    return mapeo[nivel] || 1;
  }

  get totalLecciones(): number {
    return this.obtenerLeccionesBase().length;
  }

  get leccionesPorCategoria(): Map<number, number> {
    const mapa = new Map<number, number>();
    this.obtenerLeccionesBase().forEach(l => {
      if (l.categoria_id) {
        mapa.set(l.categoria_id, (mapa.get(l.categoria_id) || 0) + 1);
      }
    });
    return mapa;
  }
}
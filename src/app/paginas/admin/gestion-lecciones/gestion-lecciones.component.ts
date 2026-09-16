import { Component, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { LeccionesService } from '../../../servicios/lecciones.service';
import { Leccion, CategoriaDB } from '../../../modelos/leccion.model';

const QK_CATEGORIAS = ['categoriasLecciones'] as const;
const QK_LECCIONES = ['lecciones'] as const;

const STALE_CATEGORIAS = 5 * 60 * 1000;
const STALE_LECCIONES = 30 * 1000;

@Component({
  selector: 'app-gestion-lecciones',
  templateUrl: './gestion-lecciones.component.html',
  styleUrls: ['./gestion-lecciones.component.scss'],
  standalone: false
})
export class GestionLeccionesComponent implements OnInit {
  lecciones: Leccion[] = [];
  leccionesFiltradas: Leccion[] = [];
  categorias: CategoriaDB[] = [];
  leccionesParaSelect: Leccion[] = [];

  error: string | null = null;
  mensaje: string | null = null;
  mostrarModal = false;
  modoEdicion = false;

  filtros = {
    busqueda: '',
    categoria_id: undefined as number | undefined,
    nivel: undefined as number | undefined
  };

  formulario: any = {
    categoria_id: null,
    titulo: '',
    descripcion: '',
    sena: '',
    nivel_dificultad: 1,
    orden: 1,
    leccion_previa_id: null,
    puntos_base: 10,
    puntos_perfecto: 20,
    activa: true,
    bloqueada: false
  };

  private queryClient = injectQueryClient();

  private categoriasQuery = injectQuery(() => ({
    queryKey: QK_CATEGORIAS,
    queryFn: () => firstValueFrom(this.leccionesService.obtenerCategorias(true)),
    staleTime: STALE_CATEGORIAS
  }));

  private leccionesQuery = injectQuery(() => ({
    queryKey: QK_LECCIONES,
    queryFn: () => firstValueFrom(this.leccionesService.obtenerLecciones()),
    staleTime: STALE_LECCIONES
  }));

  constructor(
    private leccionesService: LeccionesService,
    private router: Router
  ) {
    effect(() => {
      const respuesta = this.categoriasQuery.data();
      if (respuesta?.exito && respuesta.datos) {
        this.categorias = respuesta.datos;
      }
    });

    effect(() => {
      if (this.categoriasQuery.isError()) {
        console.error('Error cargando categorías:', this.categoriasQuery.error());
        this.error = 'No se pudieron cargar las categorías';
      }
    });

    effect(() => {
      const respuesta = this.leccionesQuery.data();
      if (respuesta?.exito && respuesta.datos) {
        this.lecciones = respuesta.datos;
        this.prepararLeccionesParaSelect();
        this.aplicarFiltros();
        this.mensaje = null;
      }
    });

    effect(() => {
      if (this.leccionesQuery.isError()) {
        console.error('Error cargando lecciones:', this.leccionesQuery.error());
        this.error = 'Error al cargar las lecciones';
      }
    });
  }

  get cargando(): boolean {
    return this.categoriasQuery.isPending() || this.leccionesQuery.isPending();
  }

  ngOnInit(): void {
  }

  cargarCategorias(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
  }

  cargarLecciones(): void {
    this.error = null;
    this.queryClient.invalidateQueries({ queryKey: QK_LECCIONES });
  }

  prepararLeccionesParaSelect(): void {
    this.leccionesParaSelect = this.lecciones
      .filter(l => l.activa)
      .sort((a, b) => a.orden - b.orden);
  }

  aplicarFiltros(): void {
    this.leccionesFiltradas = this.lecciones.filter(leccion => {
      const cumpleBusqueda = !this.filtros.busqueda ||
        leccion.titulo.toLowerCase().includes(this.filtros.busqueda.toLowerCase()) ||
        leccion.sena.toLowerCase().includes(this.filtros.busqueda.toLowerCase()) ||
        (leccion.descripcion && leccion.descripcion.toLowerCase().includes(this.filtros.busqueda.toLowerCase()));

      const cumpleCategoria = !this.filtros.categoria_id ||
        leccion.categoria_id === this.filtros.categoria_id;

      const cumpleNivel = !this.filtros.nivel ||
        leccion.nivel_dificultad === this.filtros.nivel;

      return cumpleBusqueda && cumpleCategoria && cumpleNivel;
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      busqueda: '',
      categoria_id: undefined,
      nivel: undefined
    };
    this.aplicarFiltros();
  }

  abrirModalNuevo(): void {
    this.modoEdicion = false;
    this.formulario = {
      categoria_id: null,
      titulo: '',
      descripcion: '',
      sena: '',
      nivel_dificultad: 1,
      orden: this.lecciones.length + 1,
      leccion_previa_id: null,
      puntos_base: 10,
      puntos_perfecto: 20,
      activa: true,
      bloqueada: false
    };
    this.error = null;
    this.mostrarModal = true;
  }

  editarLeccion(leccion: Leccion): void {
    this.modoEdicion = true;
    this.formulario = { ...leccion };
    this.error = null;
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.error = null;
  }

  guardarLeccion(): void {
    if (!this.validarFormulario()) {
      return;
    }

    this.error = null;

    if (this.modoEdicion) {
      this.leccionesService.actualizarLeccion(this.formulario.id, this.formulario).subscribe({
        next: (response) => {
          if (response.exito) {
            this.mensaje = 'Lección actualizada exitosamente';
            this.queryClient.invalidateQueries({ queryKey: QK_LECCIONES });
            this.cerrarModal();
          } else {
            this.error = response.mensaje || 'Error al actualizar la lección';
          }
        },
        error: (err) => {
          this.error = 'Error al actualizar la lección';
          console.error(err);
        }
      });
    } else {
      this.leccionesService.crearLeccion(this.formulario).subscribe({
        next: (response) => {
          if (response.exito) {
            this.mensaje = 'Lección creada exitosamente';
            this.queryClient.invalidateQueries({ queryKey: QK_LECCIONES });
            this.cerrarModal();
          } else {
            this.error = response.mensaje || 'Error al crear la lección';
          }
        },
        error: (err) => {
          this.error = 'Error al crear la lección';
          console.error(err);
        }
      });
    }
  }

  validarFormulario(): boolean {
    if (!this.formulario.categoria_id) {
      this.error = 'Debes seleccionar una categoría';
      return false;
    }
    if (!this.formulario.titulo || this.formulario.titulo.trim() === '') {
      this.error = 'El título es requerido';
      return false;
    }
    if (!this.formulario.sena || this.formulario.sena.trim() === '') {
      this.error = 'La seña es requerida';
      return false;
    }
    if (!this.formulario.nivel_dificultad) {
      this.error = 'El nivel de dificultad es requerido';
      return false;
    }
    if (!this.formulario.orden || this.formulario.orden < 1) {
      this.error = 'El orden debe ser mayor a 0';
      return false;
    }
    if (!this.formulario.puntos_base || this.formulario.puntos_base < 1) {
      this.error = 'Los puntos base deben ser mayores a 0';
      return false;
    }
    if (!this.formulario.puntos_perfecto || this.formulario.puntos_perfecto < 1) {
      this.error = 'Los puntos perfectos deben ser mayores a 0';
      return false;
    }
    return true;
  }

  gestionarClases(leccion: Leccion): void {
    if (!leccion.id) {
      console.error('Lección sin ID');
      return;
    }
    this.router.navigate(['/admin/lecciones', leccion.id, 'clases']);
  }

  toggleLeccion(leccion: Leccion): void {
    if (!leccion.id) {
      console.error('Lección sin ID');
      return;
    }

    const nuevoEstado = {
      activa: !leccion.activa || leccion.bloqueada ? true : false,
      bloqueada: leccion.bloqueada ? false : leccion.bloqueada
    };

    const accion = nuevoEstado.activa ? 'activar' : 'desactivar';

    this.leccionesService.actualizarLeccion(leccion.id, nuevoEstado).subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = `Lección ${accion}ada exitosamente`;
          this.queryClient.invalidateQueries({ queryKey: QK_LECCIONES });
        } else {
          this.error = `Error al ${accion} la lección`;
        }
      },
      error: (err) => {
        this.error = `Error al ${accion} la lección`;
        console.error(err);
      }
    });
  }

  confirmarEliminar(leccion: Leccion): void {
    if (confirm(`¿Estás seguro de que deseas eliminar la lección "${leccion.titulo}"? Esta acción no se puede deshacer.`)) {
      this.eliminarLeccion(leccion.id);
    }
  }

  eliminarLeccion(leccionId: number): void {
    this.error = null;

    this.leccionesService.eliminarLeccion(leccionId).subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = 'Lección eliminada exitosamente';
          this.queryClient.invalidateQueries({ queryKey: QK_LECCIONES });
        } else {
          this.error = response.mensaje || 'Error al eliminar la lección';
        }
      },
      error: (err) => {
        this.error = 'Error al eliminar la lección';
        console.error(err);
      }
    });
  }

  obtenerClaseNivel(nivel: number): string {
    const mapeo: Record<number, string> = {
      1: 'bg-nivel-principiante',
      2: 'bg-nivel-intermedio',
      3: 'bg-nivel-avanzado'
    };
    return mapeo[nivel] || 'bg-secondary';
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
}
import { Component, OnInit, effect } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { Categoria, CategoriaActualizar, CategoriaCrear, CategoriaService } from '../../../servicios/categoria.service';
import { TipoCategoria, TipoCategoriaActualizar, TipoCategoriaCrear, TipoCategoriaService } from '../../../servicios/tipo-categoria.service';

const QK_TIPOS_CATEGORIA = ['tiposCategoria'] as const;
const QK_CATEGORIAS = ['categoriasAdmin'] as const;

const STALE_TIPOS_CATEGORIA = 5 * 60 * 1000;
const STALE_CATEGORIAS = 30 * 1000;

@Component({
  selector: 'app-gestion-categorias',
  templateUrl: './gestion-categorias.component.html',
  styleUrls: ['./gestion-categorias.component.scss'],
  standalone: false
})
export class GestionCategoriasComponent implements OnInit {
  categorias: Categoria[] = [];
  categoriasFiltradas: Categoria[] = [];
  categoriaSeleccionada: Categoria | null = null;
  categoriaForm: FormGroup;
  tipoForm: FormGroup;

  modoEdicion = false;
  mostrarModal = false;
  mostrarModalTipos = false;
  mostrarFormTipoInline = false;
  modoEdicionTipo = false;
  mostrarInactivas = false;

  error: string | null = null;
  mensaje: string | null = null;

  textoBusqueda = '';
  tipoFiltro: number | string = '';

  tiposCategoria: TipoCategoria[] = [];
  tipoSeleccionado: TipoCategoria | null = null;

  private queryClient = injectQueryClient();

  private tiposCategoriaQuery = injectQuery(() => ({
    queryKey: QK_TIPOS_CATEGORIA,
    queryFn: () => firstValueFrom(this.tipoCategoriaService.listarTipos(false)),
    staleTime: STALE_TIPOS_CATEGORIA
  }));

  private categoriasQuery = injectQuery(() => ({
    queryKey: QK_CATEGORIAS,
    queryFn: () => firstValueFrom(this.categoriaService.listarCategorias(false)),
    staleTime: STALE_CATEGORIAS
  }));

  constructor(
    private categoriaService: CategoriaService,
    private tipoCategoriaService: TipoCategoriaService,
    private fb: FormBuilder
  ) {
    this.categoriaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      tipo_id: [null, Validators.required],
      descripcion: ['', Validators.maxLength(500)],
      icono: ['', Validators.maxLength(30)],
      color: ['#3B82F6', Validators.required],
      orden: [1, [Validators.required, Validators.min(1)]],
      nivel_requerido: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
      activa: [true]
    });

    this.tipoForm = this.fb.group({
      valor: ['', [Validators.required, Validators.pattern(/^[a-z_]+$/)]],
      etiqueta: ['', [Validators.required, Validators.maxLength(50)]],
      icono: ['', [Validators.required, Validators.maxLength(30)]],
      color: ['#3B82F6', Validators.required]
    });

    effect(() => {
      const tipos = this.tiposCategoriaQuery.data();
      if (tipos) {
        this.tiposCategoria = tipos;
      }
    });

    effect(() => {
      if (this.tiposCategoriaQuery.isError()) {
        this.error = 'Error al cargar tipos de categoría';
        this.ocultarMensaje(3000);
      }
    });

    effect(() => {
      const respuesta = this.categoriasQuery.data();
      if (respuesta?.exito) {
        this.categorias = respuesta.datos;
        this.aplicarFiltros();
      }
    });

    effect(() => {
      if (this.categoriasQuery.isError()) {
        const error = this.categoriasQuery.error() as any;
        this.error = 'Error al cargar categorías: ' + (error?.error?.detail || error?.message);
        this.ocultarMensaje(5000);
      }
    });
  }

  get cargando(): boolean {
    return this.tiposCategoriaQuery.isPending() || this.categoriasQuery.isPending();
  }

  ngOnInit(): void {
  }

  obtenerClaseIcono(icono?: string | null): string {
    if (!icono) return 'fas fa-folder';
    const valor = icono.trim();
    if (valor.startsWith('fas ') || valor.startsWith('far ') ||
        valor.startsWith('fab ') || valor.startsWith('fa ')) {
      return valor;
    }
    if (valor.startsWith('fa-')) return `fas ${valor}`;
    if (valor.startsWith('bi bi-')) return `fas ${valor.slice(3)}`;
    if (valor.startsWith('bi-')) return `fas ${valor}`;
    return `fas fa-${valor}`;
  }

  cargarTiposCategoria(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_TIPOS_CATEGORIA });
  }

  abrirModalTipos(): void {
    this.mostrarModalTipos = true;
    this.modoEdicionTipo = false;
    this.tipoSeleccionado = null;
    this.tipoForm.reset({ color: '#3B82F6' });
    this.tipoForm.get('valor')?.enable();
  }

  cerrarModalTipos(): void {
    this.mostrarModalTipos = false;
    this.tipoSeleccionado = null;
    this.tipoForm.reset();
    this.modoEdicionTipo = false;
  }

  editarTipo(tipo: TipoCategoria): void {
    this.modoEdicionTipo = true;
    this.tipoSeleccionado = tipo;
    this.tipoForm.patchValue({
      valor: tipo.valor,
      etiqueta: tipo.etiqueta,
      icono: tipo.icono,
      color: tipo.color
    });
    this.tipoForm.get('valor')?.disable();
  }

  guardarTipo(): void {
    if (this.tipoForm.invalid) {
      Object.keys(this.tipoForm.controls).forEach(key => {
        this.tipoForm.get(key)?.markAsTouched();
      });
      return;
    }

    const datosTipo = this.tipoForm.getRawValue();

    if (this.modoEdicionTipo && this.tipoSeleccionado) {
      const datosActualizar: TipoCategoriaActualizar = {
        etiqueta: datosTipo.etiqueta,
        icono: datosTipo.icono,
        color: datosTipo.color
      };

      this.tipoCategoriaService.actualizarTipo(this.tipoSeleccionado.id, datosActualizar).subscribe({
        next: () => {
          this.mensaje = 'Tipo actualizado correctamente';
          this.queryClient.invalidateQueries({ queryKey: QK_TIPOS_CATEGORIA });
          this.cerrarModalTipos();
          this.ocultarMensaje(3000);
        },
        error: (error) => {
          this.error = error.error?.detail || 'Error al actualizar tipo';
          this.ocultarMensaje(5000);
        }
      });
    } else {
      const nuevoTipo: TipoCategoriaCrear = datosTipo;

      this.tipoCategoriaService.crearTipo(nuevoTipo).subscribe({
        next: () => {
          this.mensaje = 'Tipo creado correctamente';
          this.queryClient.invalidateQueries({ queryKey: QK_TIPOS_CATEGORIA });
          this.cerrarModalTipos();
          this.ocultarMensaje(3000);
        },
        error: (error) => {
          this.error = error.error?.detail || 'Error al crear tipo';
          this.ocultarMensaje(5000);
        }
      });
    }
  }

  eliminarTipo(tipo: TipoCategoria): void {
    if (confirm(`¿Eliminar el tipo "${tipo.etiqueta}"?`)) {
      this.tipoCategoriaService.eliminarTipo(tipo.id).subscribe({
        next: () => {
          this.mensaje = 'Tipo eliminado correctamente';
          this.queryClient.invalidateQueries({ queryKey: QK_TIPOS_CATEGORIA });
          this.ocultarMensaje(3000);
        },
        error: (error) => {
          this.error = error.error?.detail || 'Error al eliminar tipo';
          this.ocultarMensaje(5000);
        }
      });
    }
  }

  cancelarEdicionTipo(): void {
    this.modoEdicionTipo = false;
    this.tipoSeleccionado = null;
    this.tipoForm.reset({ color: '#3B82F6' });
    this.tipoForm.get('valor')?.enable();
  }

  abrirFormTipoInline(): void {
    this.mostrarFormTipoInline = true;
    this.tipoForm.reset({ color: '#3B82F6', icono: '', valor: '', etiqueta: '' });
    this.tipoForm.get('valor')?.enable();
  }

  cancelarFormTipoInline(): void {
    this.mostrarFormTipoInline = false;
    this.tipoForm.reset({ color: '#3B82F6' });
    this.tipoForm.get('valor')?.enable();
  }

  guardarTipoInline(): void {
    if (this.tipoForm.invalid) {
      Object.keys(this.tipoForm.controls).forEach(key => {
        this.tipoForm.get(key)?.markAsTouched();
      });
      return;
    }

    const datos = this.tipoForm.getRawValue() as TipoCategoriaCrear;

    this.tipoCategoriaService.crearTipo(datos).subscribe({
      next: () => {
        this.tipoCategoriaService.listarTipos(false).subscribe({
          next: (tipos) => {
            this.tiposCategoria = tipos;
            this.queryClient.setQueryData(QK_TIPOS_CATEGORIA, tipos);
            const nuevo = tipos.find(t => t.valor === datos.valor);
            if (nuevo) {
              this.categoriaForm.patchValue({
                tipo_id: nuevo.id,
                icono: nuevo.icono,
                color: nuevo.color
              });
            }
            this.mostrarFormTipoInline = false;
            this.tipoForm.reset({ color: '#3B82F6' });
            this.mensaje = 'Tipo creado y seleccionado';
            this.ocultarMensaje(3000);
          }
        });
      },
      error: (error) => {
        this.error = error.error?.detail || 'Error al crear tipo';
        this.ocultarMensaje(5000);
      }
    });
  }

  cargarCategorias(): void {
    this.error = null;
    this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
  }

  aplicarFiltros(): void {
    let resultado = [...this.categorias];

    if (!this.mostrarInactivas) {
      resultado = resultado.filter(c => c.activa);
    }

    if (this.tipoFiltro && this.tipoFiltro !== '') {
      resultado = resultado.filter(c => c.tipo_id === Number(this.tipoFiltro));
    }

    if (this.textoBusqueda.trim()) {
      const busqueda = this.textoBusqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.nombre.toLowerCase().includes(busqueda) ||
        (c.tipo_etiqueta && c.tipo_etiqueta.toLowerCase().includes(busqueda)) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(busqueda))
      );
    }

    this.categoriasFiltradas = resultado;
  }

  onBuscar(): void {
    this.aplicarFiltros();
  }

  onCambiarFiltroTipo(): void {
    this.aplicarFiltros();
  }

  toggleMostrarInactivas(): void {
    this.mostrarInactivas = !this.mostrarInactivas;
    this.aplicarFiltros();
  }

  sincronizarConDataset(): void {
    if (confirm('¿Sincronizar todas las categorías con el dataset? Esto creará categorías dataset faltantes.')) {
      this.error = null;

      this.categoriaService.sincronizarDataset().subscribe({
        next: (response) => {
          if (response.exito) {
            this.mensaje = response.mensaje;
            this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
          }
          this.ocultarMensaje(5000);
        },
        error: (error) => {
          this.error = error.error?.detail || 'Error al sincronizar';
          this.ocultarMensaje(5000);
        }
      });
    }
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.categoriaSeleccionada = null;
    this.mostrarFormTipoInline = false;
    this.tipoForm.reset({ color: '#3B82F6' });

    const maxOrden = this.categorias.length > 0
      ? Math.max(...this.categorias.map(c => c.orden))
      : 0;

    this.categoriaForm.reset({
      nombre: '',
      tipo_id: null,
      descripcion: '',
      icono: '',
      color: '#3B82F6',
      orden: maxOrden + 1,
      nivel_requerido: 1,
      activa: true
    });

    this.mostrarModal = true;
  }

  abrirModalEditar(categoria: Categoria): void {
    this.modoEdicion = true;
    this.categoriaSeleccionada = categoria;
    this.mostrarFormTipoInline = false;
    this.tipoForm.reset({ color: '#3B82F6' });

    this.categoriaForm.patchValue({
      nombre: categoria.nombre,
      tipo_id: categoria.tipo_id,
      descripcion: categoria.descripcion,
      icono: categoria.icono,
      color: categoria.color,
      orden: categoria.orden,
      nivel_requerido: categoria.nivel_requerido,
      activa: categoria.activa
    });

    this.categoriaForm.markAsPristine();
    this.categoriaForm.markAsUntouched();

    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.categoriaSeleccionada = null;
    this.mostrarFormTipoInline = false;
    this.categoriaForm.reset();
    this.categoriaForm.markAsPristine();
    this.categoriaForm.markAsUntouched();
  }

  seleccionarTipoCategoria(tipoId: number): void {
    const tipo = this.tiposCategoria.find(t => t.id === tipoId);
    if (tipo) {
      this.categoriaForm.patchValue({
        tipo_id: tipoId,
        icono: tipo.icono,
        color: tipo.color
      });
    }
  }

  guardarCategoria(): void {
    if (this.categoriaForm.invalid) {
      Object.keys(this.categoriaForm.controls).forEach(key => {
        const control = this.categoriaForm.get(key);
        if (control) {
          control.markAsTouched();
          control.markAsDirty();
        }
      });
      return;
    }

    this.error = null;

    if (this.modoEdicion && this.categoriaSeleccionada) {
      this.actualizarCategoria();
    } else {
      this.crearCategoria();
    }
  }

  private crearCategoria(): void {
    const nuevaCategoria: CategoriaCrear = {
      nombre: this.categoriaForm.value.nombre,
      tipo_id: this.categoriaForm.value.tipo_id,
      descripcion: this.categoriaForm.value.descripcion || undefined,
      icono: this.categoriaForm.value.icono || undefined,
      color: this.categoriaForm.value.color,
      orden: this.categoriaForm.value.orden,
      nivel_requerido: this.categoriaForm.value.nivel_requerido
    };

    this.categoriaService.crearCategoria(nuevaCategoria).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.mensaje = respuesta.mensaje;
          this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
          this.cerrarModal();
          this.ocultarMensaje(3000);
        }
      },
      error: (error) => {
        this.error = error.error?.detail || 'Error al crear categoría';
        this.ocultarMensaje(5000);
      }
    });
  }

  private actualizarCategoria(): void {
    if (!this.categoriaSeleccionada) return;

    const datosActualizar: CategoriaActualizar = this.categoriaForm.value;

    this.categoriaService.actualizarCategoria(this.categoriaSeleccionada.id, datosActualizar).subscribe({
      next: (respuesta) => {
        if (respuesta.exito) {
          this.mensaje = respuesta.mensaje;
          this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
          this.cerrarModal();
          this.ocultarMensaje(3000);
        }
      },
      error: (error) => {
        this.error = error.error?.detail || 'Error al actualizar categoría';
        this.ocultarMensaje(5000);
      }
    });
  }

  cambiarEstado(categoria: Categoria): void {
    const accion = categoria.activa ? 'desactivar' : 'activar';

    if (confirm(`¿Está seguro de ${accion} la categoría "${categoria.nombre}"?`)) {
      this.categoriaService.cambiarEstadoCategoria(categoria.id).subscribe({
        next: (respuesta) => {
          if (respuesta.exito) {
            this.mensaje = respuesta.mensaje;
            this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
            this.ocultarMensaje(3000);
          }
        },
        error: (error) => {
          this.error = error.error?.detail || 'Error al cambiar estado';
          this.ocultarMensaje(5000);
        }
      });
    }
  }

  eliminarCategoria(categoria: Categoria): void {
    const totalLecciones = categoria.total_lecciones || 0;
    let mensaje = `¿Está seguro de eliminar la categoría "${categoria.nombre}"?`;

    if (totalLecciones > 0) {
      mensaje += `\n\nEsta categoría tiene ${totalLecciones} lecciones asociadas y será desactivada en lugar de eliminarse.`;
    }

    if (confirm(mensaje)) {
      const forzar = totalLecciones > 0;

      this.categoriaService.eliminarCategoria(categoria.id, forzar).subscribe({
        next: (respuesta) => {
          if (respuesta.exito) {
            this.mensaje = respuesta.mensaje;
            this.queryClient.invalidateQueries({ queryKey: QK_CATEGORIAS });
            this.ocultarMensaje(3000);
          }
        },
        error: (error) => {
          this.error = error.error?.detail || 'Error al eliminar categoría';
          this.ocultarMensaje(5000);
        }
      });
    }
  }

  private ocultarMensaje(tiempo: number): void {
    setTimeout(() => {
      this.mensaje = null;
      this.error = null;
    }, tiempo);
  }

  obtenerColorTipo(tipoId: number): string {
    const tipoEncontrado = this.tiposCategoria.find(t => t.id === tipoId);
    return tipoEncontrado?.color || '#6B7280';
  }

  obtenerEtiquetaTipo(tipoId: number): string {
    const tipoEncontrado = this.tiposCategoria.find(t => t.id === tipoId);
    return tipoEncontrado?.etiqueta || 'Desconocido';
  }

  get f() {
    return this.categoriaForm.controls;
  }

  get ft() {
    return this.tipoForm.controls;
  }

  get totalActivas(): number {
    return this.categorias.filter(c => c.activa).length;
  }

  get totalInactivas(): number {
    return this.categorias.filter(c => !c.activa).length;
  }
}
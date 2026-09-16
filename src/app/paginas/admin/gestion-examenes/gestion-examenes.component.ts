import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom, Subscription } from 'rxjs';
import { ExamenesAdminService, ExamenAdmin, Leccion } from '../../../servicios/examenes-admin.service';
import Swal from 'sweetalert2';

const QK_LECCIONES = ['leccionesExamenes'] as const;
const QK_EXAMENES = ['examenes'] as const;

const STALE_LECCIONES = 5 * 60 * 1000;
const STALE_EXAMENES = 30 * 1000;

@Component({
  selector: 'app-gestion-examenes',
  templateUrl: './gestion-examenes.component.html',
  styleUrls: ['./gestion-examenes.component.scss'],
  standalone: false
})
export class GestionExamenesComponent implements OnInit, OnDestroy {
  examenes: ExamenAdmin[] = [];
  examenesFiltrados: ExamenAdmin[] = [];
  lecciones: Leccion[] = [];
  cargando: boolean = false;

  mostrarModal: boolean = false;
  modoEdicion: boolean = false;
  examenSeleccionado: ExamenAdmin | null = null;
  guardando: boolean = false;

  formularioExamen!: FormGroup;

  filtros = {
    buscar: '',
    tipo: '',
    activo: undefined as boolean | undefined,
    leccion_id: undefined as number | undefined
  };

  private tipoSubscription?: Subscription;
  private queryClient = injectQueryClient();

  private leccionesQuery = injectQuery(() => ({
    queryKey: QK_LECCIONES,
    queryFn: () => firstValueFrom(this.examenesAdminService.obtenerLecciones()),
    staleTime: STALE_LECCIONES
  }));

  private examenesQuery = injectQuery(() => ({
    queryKey: QK_EXAMENES,
    queryFn: () => firstValueFrom(this.examenesAdminService.listarExamenes()),
    staleTime: STALE_EXAMENES
  }));

  constructor(
    private examenesAdminService: ExamenesAdminService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.crearFormulario();

    effect(() => {
      const response = this.leccionesQuery.data();
      if (response?.exito && response.datos) {
        this.lecciones = response.datos.filter(leccion => leccion.activa);
      }
    });

    effect(() => {
      if (this.leccionesQuery.isError()) {
        const error = this.leccionesQuery.error() as any;
        console.error('Error al cargar lecciones:', error);
        if (error?.status !== 404) {
          Swal.fire('Error', 'No se pudieron cargar las lecciones', 'error');
        }
      }
    });

    effect(() => {
      const response = this.examenesQuery.data();
      if (response?.exito && response.datos) {
        this.examenes = response.datos;
        this.aplicarFiltros();
      } else if (response && !response.exito) {
        this.examenes = [];
      }
    });

    effect(() => {
      if (this.examenesQuery.isError()) {
        const error = this.examenesQuery.error() as any;
        console.error('Error al cargar autoevaluaciones:', error);
        this.examenes = [];
        if (error?.status !== 404) {
          Swal.fire('Error', 'No se pudieron cargar las autoevaluaciones', 'error');
        }
      }
    });
  }

  get cargandoLecciones(): boolean {
    return this.leccionesQuery.isPending();
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id'] && params['id'] !== 'crear') {
        const examenId = parseInt(params['id']);
        if (!isNaN(examenId)) {
          this.cargarExamenParaEditar(examenId);
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.tipoSubscription) {
      this.tipoSubscription.unsubscribe();
    }
  }

  crearFormulario(): void {
    this.formularioExamen = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      tipo: ['nivel', Validators.required],
      nivel: [1, [Validators.min(1), Validators.max(10)]],
      leccion_id: [null, [Validators.required, Validators.min(1)]],
      orden: [1, [Validators.required, Validators.min(1)]],
      clases_requeridas: [0, [Validators.min(0)]],
      requiere_todas_clases: [false],
      tiempo_limite: [30, [Validators.min(1)]],
      puntuacion_minima: [70, [Validators.required, Validators.min(0), Validators.max(100)]]
    });

    this.tipoSubscription = this.formularioExamen.get('tipo')?.valueChanges.subscribe(tipo => {
      this.actualizarValidacionNivel(tipo);
    }) as Subscription;

    this.formularioExamen.get('leccion_id')?.valueChanges.subscribe(leccionId => {
      if (leccionId) {
        this.actualizarOrdenSugerido(leccionId);
      }
    });

    this.actualizarValidacionNivel('nivel');
  }

  private actualizarValidacionNivel(tipo: string): void {
    const nivelControl = this.formularioExamen.get('nivel');

    if (tipo === 'nivel') {
      nivelControl?.setValidators([Validators.required, Validators.min(1), Validators.max(10)]);
      nivelControl?.enable();
      if (!nivelControl?.value) {
        nivelControl?.setValue(1);
      }
    } else {
      nivelControl?.clearValidators();
      nivelControl?.setValue(null);
      nivelControl?.disable();
    }
    nivelControl?.updateValueAndValidity();
  }

  actualizarOrdenSugerido(leccionId: number): void {
    const examenesLeccion = this.examenes.filter(e => e.leccion_id === leccionId);
    const maxOrden = examenesLeccion.length > 0
      ? Math.max(...examenesLeccion.map(e => e.orden || 0))
      : 0;

    if (!this.modoEdicion) {
      this.formularioExamen.patchValue({
        orden: maxOrden + 1
      });
    }
  }

  cargarLecciones(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_LECCIONES });
  }

  cargarExamenParaEditar(examenId: number): void {
    this.cargando = true;
    this.examenesAdminService.obtenerExamen(examenId).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.editarExamen(response.datos);
        } else {
          Swal.fire('Error', response.mensaje || 'No se pudo cargar el examen para editar', 'error');
          this.router.navigate(['/admin/examenes']);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar examen:', error);
        this.cargando = false;
        let mensaje = 'No se pudo cargar el examen';
        if (error.status === 404) {
          mensaje = 'Examen no encontrado';
        }
        Swal.fire('Error', mensaje, 'error');
        this.router.navigate(['/admin/examenes']);
      }
    });
  }

  cargarExamenes(): void {
    this.queryClient.invalidateQueries({ queryKey: QK_EXAMENES });
  }

  aplicarFiltros(): void {
    if (!this.examenes || this.examenes.length === 0) {
      this.examenesFiltrados = [];
      return;
    }

    this.examenesFiltrados = this.examenes.filter(examen => {
      if (this.filtros.buscar) {
        const busqueda = this.filtros.buscar.toLowerCase();
        const titulo = examen.titulo?.toLowerCase() || '';
        const descripcion = examen.descripcion?.toLowerCase() || '';
        if (!titulo.includes(busqueda) && !descripcion.includes(busqueda)) {
          return false;
        }
      }

      if (this.filtros.tipo && examen.tipo !== this.filtros.tipo) {
        return false;
      }

      if (this.filtros.activo !== undefined && examen.activo !== this.filtros.activo) {
        return false;
      }

      if (this.filtros.leccion_id && examen.leccion_id !== this.filtros.leccion_id) {
        return false;
      }

      return true;
    });

    this.examenesFiltrados.sort((a, b) => {
      if (a.leccion_id !== b.leccion_id) {
        return (a.leccion_id || 0) - (b.leccion_id || 0);
      }
      return (a.orden || 0) - (b.orden || 0);
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      buscar: '',
      tipo: '',
      activo: undefined,
      leccion_id: undefined
    };
    this.aplicarFiltros();
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.examenSeleccionado = null;

    this.formularioExamen.reset({
      tipo: 'nivel',
      nivel: 1,
      orden: 1,
      clases_requeridas: 0,
      requiere_todas_clases: false,
      tiempo_limite: 30,
      puntuacion_minima: 70,
      leccion_id: null
    });

    this.actualizarValidacionNivel('nivel');
    this.mostrarModal = true;
  }

  editarExamen(examen: ExamenAdmin): void {
    this.modoEdicion = true;
    this.examenSeleccionado = examen;

    this.actualizarValidacionNivel(examen.tipo || 'nivel');

    this.formularioExamen.patchValue({
      titulo: examen.titulo || '',
      descripcion: examen.descripcion || '',
      tipo: examen.tipo || 'nivel',
      nivel: examen.nivel || 1,
      leccion_id: examen.leccion_id || null,
      orden: examen.orden || 1,
      clases_requeridas: examen.clases_requeridas || 0,
      requiere_todas_clases: examen.requiere_todas_clases || false,
      tiempo_limite: examen.tiempo_limite || 30,
      puntuacion_minima: examen.puntuacion_minima || 70
    });

    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.modoEdicion = false;
    this.examenSeleccionado = null;

    this.formularioExamen.reset({
      tipo: 'nivel',
      tiempo_limite: 30,
      puntuacion_minima: 70
    });
    this.formularioExamen.get('nivel')?.enable();

    if (this.route.snapshot.params['id']) {
      this.router.navigate(['/admin/examenes']);
    }
  }

  guardarExamen(): void {
    this.marcarControlesComoTouched();

    if (!this.esFormularioValido()) {
      Swal.fire('Error', 'Complete todos los campos obligatorios correctamente', 'warning');
      return;
    }

    const leccionId = this.formularioExamen.get('leccion_id')?.value;
    if (!leccionId) {
      Swal.fire('Error', 'Debe seleccionar una lección', 'warning');
      return;
    }

    this.guardando = true;

    const datos = { ...this.formularioExamen.value };

    const operacion = this.modoEdicion && this.examenSeleccionado
      ? this.examenesAdminService.actualizarExamen(this.examenSeleccionado.id!, datos)
      : this.examenesAdminService.crearExamen(datos);

    operacion.subscribe({
      next: (response) => {
        this.guardando = false;

        if (response.exito) {
          Swal.fire({
            icon: 'success',
            title: this.modoEdicion ? 'Autoevaluacion Actualizada' : 'Autoevaluacion Creada',
            text: response.mensaje,
            timer: 2000,
            showConfirmButton: false
          }).then(() => {
            this.cerrarModal();
            this.queryClient.invalidateQueries({ queryKey: QK_EXAMENES });
          });
        } else {
          Swal.fire('Error', response.mensaje || 'Error al guardar la autoevaluacion', 'error');
        }
      },
      error: (error) => {
        this.guardando = false;
        console.error('Error al guardar autoevaluacion:', error);

        let mensajeError = 'No se pudo guardar la autoevaluacion';
        if (error.error?.detail) {
          mensajeError = error.error.detail;
        } else if (error.error?.mensaje) {
          mensajeError = error.error.mensaje;
        } else if (error.status === 404) {
          mensajeError = 'Recurso no encontrado. Verifique que la lección existe.';
        } else if (error.status === 500) {
          mensajeError = 'Error interno del servidor. Intente nuevamente.';
        }

        Swal.fire('Error', mensajeError, 'error');
      }
    });
  }

  private marcarControlesComoTouched(): void {
    Object.keys(this.formularioExamen.controls).forEach(key => {
      const control = this.formularioExamen.get(key);
      control?.markAsTouched();
    });
  }

  toggleActivo(examen: ExamenAdmin): void {
    const nuevoEstado = !examen.activo;

    this.examenesAdminService.actualizarExamen(examen.id!, {
      activo: nuevoEstado
    }).subscribe({
      next: (response) => {
        if (response.exito) {
          examen.activo = nuevoEstado;
          this.queryClient.invalidateQueries({ queryKey: QK_EXAMENES });
          Swal.fire({
            icon: 'success',
            title: nuevoEstado ? 'Autoevaluacion Activada' : 'Autoevaluacion Desactivada',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          Swal.fire('Error', response.mensaje || 'Error al cambiar estado', 'error');
        }
      },
      error: (error) => {
        console.error('Error al cambiar estado:', error);
        Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
      }
    });
  }

  verDetalles(examen: ExamenAdmin): void {
    this.router.navigate(['/admin/examenes', examen.id]);
  }

  gestionarPreguntas(examen: ExamenAdmin): void {
    this.router.navigate(['/admin/examenes', examen.id, 'preguntas']);
  }

  eliminarExamen(examen: ExamenAdmin): void {
    Swal.fire({
      title: '¿Eliminar Autoevaluacion?',
      text: `Se eliminará "${examen.titulo}" y todas sus preguntas`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.examenesAdminService.eliminarExamen(examen.id!).subscribe({
          next: (response) => {
            if (response.exito) {
              Swal.fire('Eliminado', 'La autoevaluacion ha sido eliminada', 'success');
              this.queryClient.invalidateQueries({ queryKey: QK_EXAMENES });
            } else {
              Swal.fire('Error', response.mensaje || 'Error al eliminar', 'error');
            }
          },
          error: (error) => {
            console.error('Error al eliminar:', error);
            Swal.fire('Error', 'No se pudo eliminar la autoevaluacion', 'error');
          }
        });
      }
    });
  }

  obtenerNombreLeccion(leccionId: number): string {
    const leccion = this.lecciones.find(l => l.id === leccionId);
    return leccion ? leccion.titulo : 'Sin lección';
  }

  mostrarError(controlName: string): boolean {
    const control = this.formularioExamen.get(controlName);
    return control ? (control.invalid && control.touched) : false;
  }

  getMensajeError(controlName: string): string {
    const control = this.formularioExamen.get(controlName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    if (control.errors['min']) {
      return `El valor mínimo es ${control.errors['min'].min}`;
    }
    if (control.errors['max']) {
      return `El valor máximo es ${control.errors['max'].max}`;
    }

    return 'Campo inválido';
  }

  mostrarCampoNivel(): boolean {
    return this.formularioExamen.get('tipo')?.value === 'nivel';
  }

  esFormularioValido(): boolean {
    const tipo = this.formularioExamen.get('tipo')?.value;

    if (tipo === 'nivel') {
      return this.formularioExamen.valid;
    }

    const controlesRequeridos = ['titulo', 'tipo', 'puntuacion_minima', 'leccion_id', 'orden'];
    return controlesRequeridos.every(control =>
      this.formularioExamen.get(control)?.valid
    );
  }

  get examenesPorLeccion(): { [leccionId: number]: ExamenAdmin[] } {
    return this.examenesFiltrados.reduce((acc, examen) => {
      const leccionId = examen.leccion_id || 0;
      if (!acc[leccionId]) {
        acc[leccionId] = [];
      }
      acc[leccionId].push(examen);
      return acc;
    }, {} as { [leccionId: number]: ExamenAdmin[] });
  }
}
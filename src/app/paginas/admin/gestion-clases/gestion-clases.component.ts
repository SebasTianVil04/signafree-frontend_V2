import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LeccionesService } from '../../../servicios/lecciones.service';
import { Clase, ClaseActualizar, ClaseCrear, ClasesService } from '../../../servicios/clase.service';


@Component({
  selector: 'app-gestion-clases',
  templateUrl: './gestion-clases.component.html',
  styleUrls: ['./gestion-clases.component.scss'],
  standalone: false
})
export class GestionClasesComponent implements OnInit {
  leccionId!: number;
  leccion: any = null;
  clases: Clase[] = [];
  clasesFiltradas: Clase[] = [];
  cargando = false;
  error: string = '';
  mensaje: string = '';

  mostrarModal = false;
  modoEdicion = false;
  claseSeleccionada: Clase | null = null;

  filtros = {
    busqueda: '',
    activa: undefined as boolean | undefined
  };

  formulario: ClaseCrear = {
    leccion_id: 0,
    titulo: '',
    descripcion: '',
    contenido_texto: '',
    sena: '',
    tipo_video: 'youtube',
    video_url: '',
    video_id: '',
    imagen_referencia: '',
    gif_demostracion: '',
    orden: 1,
    duracion_estimada: 10,
    tips: '',
    errores_comunes: '',
    requiere_practica: true,
    intentos_minimos: 3,
    precision_minima: 0.7,
    activa: true
  };

  tiposVideo = [
    { valor: 'youtube', etiqueta: 'YouTube' },
    { valor: 'google_drive', etiqueta: 'Google Drive' },
    { valor: 'vimeo', etiqueta: 'Vimeo' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clasesService: ClasesService,
    private leccionesService: LeccionesService
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.leccionId = +params['leccionId'];
      if (this.leccionId) {
        this.formulario.leccion_id = this.leccionId;
        this.cargarLeccion();
        this.cargarClases();
      }
    });
  }

  cargarLeccion(): void {
    this.leccionesService.obtenerLeccion(this.leccionId).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.leccion = response.datos;
        }
      },
      error: (err) => {
        console.error('Error al cargar lección:', err);
        this.error = 'No se pudo cargar la información de la lección';
      }
    });
  }

  cargarClases(): void {
    this.cargando = true;
    this.error = '';

    this.clasesService.obtenerClasesDeLeccion(this.leccionId).subscribe({
      next: (response) => {
        this.cargando = false;
        if (response.exito && response.datos) {
          this.clases = response.datos.sort((a, b) => a.orden - b.orden);
          this.clasesFiltradas = [...this.clases];
        } else {
          this.error = response.mensaje || 'Error al cargar clases';
          this.clases = [];
          this.clasesFiltradas = [];
        }
      },
      error: (err) => {
        this.cargando = false;
        this.error = err.error?.detail || err.error?.mensaje || 'Error al cargar clases';
        this.clases = [];
        this.clasesFiltradas = [];
        console.error('Error:', err);
      }
    });
  }

  aplicarFiltros(): void {
    this.clasesFiltradas = this.clases.filter(clase => {
      const cumpleBusqueda = !this.filtros.busqueda ||
        clase.titulo.toLowerCase().includes(this.filtros.busqueda.toLowerCase()) ||
        (clase.descripcion && clase.descripcion.toLowerCase().includes(this.filtros.busqueda.toLowerCase()));

      const cumpleActiva = this.filtros.activa === undefined ||
        clase.activa === this.filtros.activa;

      return cumpleBusqueda && cumpleActiva;
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      busqueda: '',
      activa: undefined
    };
    this.aplicarFiltros();
  }

  abrirModalNueva(): void {
    this.modoEdicion = false;
    this.claseSeleccionada = null;
    this.resetearFormulario();
    this.mostrarModal = true;
  }

  abrirModalEditar(clase: Clase): void {
    this.modoEdicion = true;
    this.claseSeleccionada = clase;
    this.cargarDatosFormulario(clase);
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.resetearFormulario();
    this.claseSeleccionada = null;
    this.error = '';
  }

  resetearFormulario(): void {
    this.formulario = {
      leccion_id: this.leccionId,
      titulo: '',
      descripcion: '',
      contenido_texto: '',
      sena: '',
      tipo_video: 'youtube',
      video_url: '',
      video_id: '',
      imagen_referencia: '',
      gif_demostracion: '',
      orden: this.clases.length + 1,
      duracion_estimada: 10,
      tips: '',
      errores_comunes: '',
      requiere_practica: true,
      intentos_minimos: 3,
      precision_minima: 0.7,
      activa: true
    };
  }

  cargarDatosFormulario(clase: Clase): void {
    this.formulario = {
      leccion_id: this.leccionId,
      titulo: clase.titulo,
      descripcion: clase.descripcion || '',
      contenido_texto: clase.contenido_texto || '',
      sena: clase.sena || '',
      tipo_video: clase.tipo_video,
      video_url: clase.video_url || '',
      video_id: clase.video_id || '',
      imagen_referencia: clase.imagen_referencia || '',
      gif_demostracion: clase.gif_demostracion || '',
      orden: clase.orden,
      duracion_estimada: clase.duracion_estimada || 10,
      tips: clase.tips || '',
      errores_comunes: clase.errores_comunes || '',
      requiere_practica: clase.requiere_practica,
      intentos_minimos: clase.intentos_minimos,
      precision_minima: clase.precision_minima,
      activa: clase.activa
    };
  }

  validarFormulario(): boolean {
    this.error = '';

    // Validar título
    if (!this.formulario.titulo || this.formulario.titulo.trim().length < 3) {
      this.error = 'El título debe tener al menos 3 caracteres';
      return false;
    }

    // Validar seña si requiere práctica
    if (this.formulario.requiere_practica) {
      // Verificar que la seña no sea null, undefined o string vacío
      if (!this.formulario.sena || this.formulario.sena.trim().length === 0) {
        this.error = 'La seña es obligatoria cuando se requiere práctica';
        return false;
      }
    }

    // Validar orden
    if (!this.formulario.orden || this.formulario.orden < 1) {
      this.error = 'El orden debe ser mayor a 0';
      return false;
    }

    return true;
  }

  guardarClase(): void {
    if (!this.validarFormulario()) {
      return;
    }

    // Preparar datos para enviar
    const datosParaEnviar = { ...this.formulario };

    // CRÍTICO: Asegurar que los campos vacíos sean null en lugar de strings vacíos
    const camposOpcionales = [
      'descripcion', 'contenido_texto', 'sena', 'video_url', 'video_id',
      'imagen_referencia', 'gif_demostracion', 'tips', 'errores_comunes'
    ];

    camposOpcionales.forEach(campo => {
      const valor = (datosParaEnviar as any)[campo];
      if (valor === '' || (typeof valor === 'string' && valor.trim() === '')) {
        (datosParaEnviar as any)[campo] = null;
      }
    });

    console.log('Datos del formulario ANTES de limpiar:', this.formulario);
    console.log('Datos del formulario DESPUÉS de limpiar:', datosParaEnviar);
    console.log('Requiere práctica:', datosParaEnviar.requiere_practica);
    console.log('Seña:', datosParaEnviar.sena);
    console.log('Seña type:', typeof datosParaEnviar.sena);
    console.log('Seña === null:', datosParaEnviar.sena === null);
    console.log('Seña === "":', datosParaEnviar.sena === '');

    const operacion = this.modoEdicion && this.claseSeleccionada?.id
      ? this.clasesService.actualizarClase(this.claseSeleccionada.id, datosParaEnviar as ClaseActualizar)
      : this.clasesService.crearClase(datosParaEnviar);

    operacion.subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = response.mensaje || (this.modoEdicion ? 'Clase actualizada exitosamente' : 'Clase creada exitosamente');
          this.cerrarModal();
          this.cargarClases();

          setTimeout(() => {
            this.mensaje = '';
          }, 3000);
        } else {
          this.error = response.mensaje || 'Error al guardar clase';
        }
      },
      error: (err) => {
        console.error('Error completo:', err);
        console.error('Error detail:', err.error);
        console.error('Error mensaje:', err.error?.mensaje);
        this.error = err.error?.detail || err.error?.mensaje || 'Error al guardar clase';
      }
    });
  }

  eliminarClase(clase: Clase): void {
    if (!clase.id) return;

    if (!confirm(`¿Estás seguro de eliminar la clase "${clase.titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.clasesService.eliminarClase(clase.id).subscribe({
      next: (response) => {
        if (response.exito) {
          this.mensaje = 'Clase eliminada exitosamente';
          this.cargarClases();

          setTimeout(() => {
            this.mensaje = '';
          }, 3000);
        } else {
          this.error = response.mensaje || 'Error al eliminar clase';
        }
      },
      error: (err) => {
        this.error = err.error?.detail || err.error?.mensaje || 'Error al eliminar clase';
        console.error('Error:', err);
      }
    });
  }

  toggleActiva(clase: Clase): void {
    if (!clase.id) return;

    const nuevoEstado = !clase.activa;

    this.clasesService.actualizarClase(clase.id, { activa: nuevoEstado }).subscribe({
      next: (response) => {
        if (response.exito) {
          clase.activa = nuevoEstado;
          this.mensaje = `Clase ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente`;

          setTimeout(() => {
            this.mensaje = '';
          }, 3000);
        } else {
          this.error = response.mensaje || 'Error al cambiar estado';
        }
      },
      error: (err) => {
        this.error = err.error?.detail || err.error?.mensaje || 'Error al cambiar estado';
        console.error('Error:', err);
      }
    });
  }

  extraerVideoId(): void {
    const url = this.formulario.video_url;

    if (!url) {
      this.error = 'Por favor, ingresa primero la URL del video';
      return;
    }

    const videoId = this.clasesService.extraerVideoId(url, this.formulario.tipo_video);

    if (videoId) {
      this.formulario.video_id = videoId;
      this.mensaje = 'ID del video extraído exitosamente';
      this.error = '';

      setTimeout(() => {
        this.mensaje = '';
      }, 2000);
    } else {
      this.error = 'No se pudo extraer el ID del video. Verifica que la URL sea correcta.';
    }
  }

  volver(): void {
    this.router.navigate(['/admin/lecciones']);
  }

  get tituloLeccion(): string {
    return this.leccion?.titulo || 'Lección';
  }

  get categoriaNombre(): string {
    if (!this.leccion?.categoria) return '';

    const categorias: { [key: string]: string } = {
      'abecedario': 'Abecedario',
      'numeros': 'Números',
      'saludos': 'Saludos'
    };

    return categorias[this.leccion.categoria] || this.leccion.categoria;
  }
}
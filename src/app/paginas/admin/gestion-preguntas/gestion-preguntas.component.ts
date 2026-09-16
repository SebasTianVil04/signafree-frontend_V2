// src/app/paginas/admin/gestion-preguntas/gestion-preguntas.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamenesAdminService, PreguntaExamen } from '../../../servicios/examenes-admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gestion-preguntas',
  templateUrl: './gestion-preguntas.component.html',
  styleUrls: ['./gestion-preguntas.component.scss'],
  standalone: false
})
export class GestionPreguntasComponent implements OnInit {
  examenId!: number;
  examen: any = null;
  preguntas: PreguntaExamen[] = [];
  cargando: boolean = false;

  // Modal
  mostrarModal: boolean = false;
  modoEdicion: boolean = false;
  preguntaSeleccionada: PreguntaExamen | null = null;
  guardando: boolean = false;

  // Formulario
  formularioPregunta!: FormGroup;
  opcionesMultiple: any = { a: '', b: '', c: '', d: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examenesAdminService: ExamenesAdminService,
    private fb: FormBuilder
  ) {
    this.crearFormulario();
  }

  ngOnInit(): void {
    this.examenId = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarExamen();
  }

  crearFormulario(): void {
    this.formularioPregunta = this.fb.group({
      pregunta: ['', Validators.required],
      tipo_pregunta: ['reconocimiento', Validators.required],
      sena_esperada: [''],
      imagen_sena: [''],
      respuesta_correcta: [''],
      puntos: [10, [Validators.required, Validators.min(1)]],
      orden: [1, [Validators.required, Validators.min(1)]]
    });

    // Validaciones condicionales
    this.formularioPregunta.get('tipo_pregunta')?.valueChanges.subscribe(tipo => {
      this.actualizarValidaciones(tipo);
    });
  }

  actualizarValidaciones(tipo: string): void {
    const senaControl = this.formularioPregunta.get('sena_esperada');
    const respuestaControl = this.formularioPregunta.get('respuesta_correcta');

    // Limpiar validaciones anteriores
    senaControl?.clearValidators();
    respuestaControl?.clearValidators();

    if (tipo === 'reconocimiento') {
      senaControl?.setValidators(Validators.required);
    } else if (tipo === 'multiple' || tipo === 'verdadero_falso') {
      respuestaControl?.setValidators(Validators.required);
    }

    senaControl?.updateValueAndValidity();
    respuestaControl?.updateValueAndValidity();
  }

  cargarExamen(): void {
    this.cargando = true;
    
    this.examenesAdminService.obtenerExamen(this.examenId).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.examen = response.datos;
          this.preguntas = response.datos.preguntas || [];
          this.preguntas.sort((a, b) => a.orden - b.orden);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar examen:', error);
        Swal.fire('Error', 'No se pudo cargar el examen', 'error');
        this.router.navigate(['/admin/examenes']);
        this.cargando = false;
      }
    });
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.preguntaSeleccionada = null;
    this.opcionesMultiple = { a: '', b: '', c: '', d: '' };
    
    this.formularioPregunta.reset({
      tipo_pregunta: 'reconocimiento',
      puntos: 10,
      orden: this.preguntas.length + 1
    });
    
    this.mostrarModal = true;
  }

  editarPregunta(pregunta: PreguntaExamen): void {
    this.modoEdicion = true;
    this.preguntaSeleccionada = pregunta;
    
    this.formularioPregunta.patchValue({
      pregunta: pregunta.pregunta,
      tipo_pregunta: pregunta.tipo_pregunta,
      sena_esperada: pregunta.sena_esperada,
      imagen_sena: pregunta.imagen_sena,
      respuesta_correcta: pregunta.respuesta_correcta,
      puntos: pregunta.puntos,
      orden: pregunta.orden
    });

    if (pregunta.tipo_pregunta === 'multiple' && pregunta.opciones) {
      this.opcionesMultiple = { ...pregunta.opciones };
    }
    
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.modoEdicion = false;
    this.preguntaSeleccionada = null;
    this.formularioPregunta.reset();
    this.opcionesMultiple = { a: '', b: '', c: '', d: '' };
  }

  guardarPregunta(): void {
    if (this.formularioPregunta.invalid) {
      Swal.fire('Error', 'Complete todos los campos obligatorios', 'warning');
      return;
    }

    this.guardando = true;
    const datos: any = {
      ...this.formularioPregunta.value,
      examen_id: this.examenId
    };

    // Agregar opciones si es múltiple
    if (datos.tipo_pregunta === 'multiple') {
      datos.opciones = { ...this.opcionesMultiple };
    }

    const operacion = this.modoEdicion && this.preguntaSeleccionada
      ? this.examenesAdminService.actualizarPregunta(this.preguntaSeleccionada.id!, datos)
      : this.examenesAdminService.crearPregunta(datos);

    operacion.subscribe({
      next: (response) => {
        if (response.exito) {
          Swal.fire({
            icon: 'success',
            title: this.modoEdicion ? 'Pregunta Actualizada' : 'Pregunta Creada',
            timer: 1500,
            showConfirmButton: false
          });
          
          this.cerrarModal();
          this.cargarExamen();
        }
        this.guardando = false;
      },
      error: (error) => {
        console.error('Error al guardar pregunta:', error);
        Swal.fire('Error', 'No se pudo guardar la pregunta', 'error');
        this.guardando = false;
      }
    });
  }

  moverPregunta(pregunta: PreguntaExamen, direccion: 'arriba' | 'abajo'): void {
    const index = this.preguntas.findIndex(p => p.id === pregunta.id);
    if (index === -1) return;

    const nuevoOrden = direccion === 'arriba' ? pregunta.orden - 1 : pregunta.orden + 1;
    
    if (nuevoOrden < 1 || nuevoOrden > this.preguntas.length) return;

    this.examenesAdminService.actualizarPregunta(pregunta.id!, {
      orden: nuevoOrden
    }).subscribe({
      next: () => {
        this.cargarExamen();
      },
      error: (error) => {
        console.error('Error al mover pregunta:', error);
        Swal.fire('Error', 'No se pudo mover la pregunta', 'error');
      }
    });
  }

  eliminarPregunta(pregunta: PreguntaExamen): void {
    Swal.fire({
      title: '¿Eliminar Pregunta?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.examenesAdminService.eliminarPregunta(pregunta.id!).subscribe({
          next: (response) => {
            if (response.exito) {
              Swal.fire('Eliminado', 'Pregunta eliminada exitosamente', 'success');
              this.cargarExamen();
            }
          },
          error: (error) => {
            console.error('Error al eliminar:', error);
            Swal.fire('Error', 'No se pudo eliminar la pregunta', 'error');
          }
        });
      }
    });
  }

  calcularPuntosTotales(): number {
    return this.preguntas.reduce((total, p) => total + p.puntos, 0);
  }

  getTipoLabel(tipo: string): string {
    const tipos: any = {
      'reconocimiento': 'Reconocimiento',
      'multiple': 'Opción Múltiple',
      'verdadero_falso': 'Verdadero/Falso'
    };
    return tipos[tipo] || tipo;
  }

  getOpcionesArray(opciones: any): { key: string, value: string }[] {
    if (!opciones) return [];
    return Object.keys(opciones).map(key => ({
      key: key,
      value: opciones[key]
    }));
  }

  volver(): void {
    this.router.navigate(['/admin/examenes']);
  }
}
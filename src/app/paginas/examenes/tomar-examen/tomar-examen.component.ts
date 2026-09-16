import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamenService } from '../../../servicios/examen.service';
import Swal from 'sweetalert2';
import { CamaraReconocimientoExamenComponent } from '../../reconocimiento/camara-reconocimiento-examen/camara-reconocimiento-examen.component';

interface RespuestaExamen {
  preguntaId: string;
  respuestaUsuario: string | null;
  tipoRespuesta: 'reconocimiento' | 'multiple' | 'verdadero_falso';
  timestamp: number;
  respondida: boolean;
}

@Component({
  selector: 'app-tomar-examen',
  templateUrl: './tomar-examen.component.html',
  styleUrls: ['./tomar-examen.component.scss'],
  standalone: false 
})
export class TomarExamenComponent implements OnInit, OnDestroy {
  @ViewChild(CamaraReconocimientoExamenComponent) camaraComponent?: CamaraReconocimientoExamenComponent;

  examenId!: number;
  examen: any = null;
  cargando: boolean = false;

  examenIniciado: boolean = false;
  examenCompletado: boolean = false;

  preguntas: any[] = [];
  preguntaActualIndex: number = 0;
  respuestas: Map<string, RespuestaExamen> = new Map();
  respuestaSeleccionada: string = '';

  tiempoLimite: number = 0;
  tiempoRestante: number = 0;
  intervaloTimer: any;
  tiempoInicio: number = 0;

  resultado: any = null;

  mostrarCamara: boolean = false;
  cambiandoPregunta: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examenService: ExamenService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.examenId = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarExamen();
  }

  ngOnDestroy(): void {
    console.log('🗑️ ngOnDestroy - TomarExamenComponent');
    this.detenerTimer();
    this.detenerCamaraCompletamenteSincrono();
  }

  private detenerCamaraCompletamenteSincrono(): void {
    console.log('🛑🛑🛑 DETENCIÓN SÍNCRONA DE CÁMARA');
    
    if (this.camaraComponent) {
      console.log('📹 Componente de cámara encontrado, deteniendo...');
      this.camaraComponent.detenerTodo();
      console.log('✅ Llamada a detenerTodo() completada');
    } else {
      console.log('⚠️ No hay componente de cámara para detener');
    }
    
    this.mostrarCamara = false;
  }

  cargarExamen(): void {
    this.cargando = true;

    this.examenService.obtenerExamen(this.examenId).subscribe({
      next: (response) => {
        if (response.exito && response.datos) {
          this.examen = response.datos;
          this.preguntas = response.datos.preguntas || [];
          this.tiempoLimite = (response.datos.tiempo_limite || 30) * 60;
          console.log('✅ Examen cargado:', this.examen);
          console.log('📋 Preguntas:', this.preguntas);
        } else {
          console.error('❌ Error: Examen no encontrado', response);
          Swal.fire('Error', 'No se pudo cargar el examen', 'error');
          this.router.navigate(['/examenes']);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar examen:', error);
        Swal.fire('Error', 'No se pudo cargar el examen', 'error');
        this.router.navigate(['/examenes']);
        this.cargando = false;
      }
    });
  }

  iniciarExamen(): void {
    Swal.fire({
      title: '¿Iniciar Examen?',
      text: 'Una vez iniciado, el tiempo comenzará a correr',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Iniciar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.examenIniciado = true;
        this.tiempoRestante = this.tiempoLimite;
        this.tiempoInicio = Date.now();
        this.iniciarTimer();

        this.respuestas.clear();
        this.preguntaActualIndex = 0;
        
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => {
              this.mostrarCamara = this.preguntaActual?.tipo_pregunta === 'reconocimiento';
              this.cdr.detectChanges();
              console.log('🎬 Examen iniciado. Preguntas:', this.preguntas.length);
              console.log('📷 Mostrar cámara:', this.mostrarCamara);
            });
          }, 100);
        });
      }
    });
  }

  iniciarTimer(): void {
    this.intervaloTimer = setInterval(() => {
      this.tiempoRestante--;

      if (this.tiempoRestante <= 0) {
        this.finalizarExamenPorTiempo();
      }
    }, 1000);
  }

  detenerTimer(): void {
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }

  finalizarExamenPorTiempo(): void {
    this.detenerTimer();
    Swal.fire({
      title: 'Tiempo Agotado',
      text: 'El tiempo del examen ha finalizado',
      icon: 'warning',
      confirmButtonText: 'Ver Resultados'
    }).then(() => {
      this.presentarExamen();
    });
  }

  get preguntaActual(): any {
    return this.preguntas[this.preguntaActualIndex] || null;
  }

  get progresoExamen(): number {
    if (!this.preguntas.length) return 0;
    return ((this.preguntaActualIndex + 1) / this.preguntas.length) * 100;
  }

  get tiempoFormateado(): string {
    const minutos = Math.floor(this.tiempoRestante / 60);
    const segundos = this.tiempoRestante % 60;
    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  }

  async cambiarPregunta(index: number): Promise<void> {
    if (index >= 0 && index < this.preguntas.length && !this.cambiandoPregunta) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 INICIANDO CAMBIO A PREGUNTA ${index + 1}`);
      console.log(`${'='.repeat(60)}\n`);
      
      this.cambiandoPregunta = true;

      // PASO 1: Detener cámara y ocultar componente
      console.log('📍 PASO 1: Detener y ocultar cámara');
      this.detenerCamaraCompletamenteSincrono();
      this.mostrarCamara = false;
      
      // CRÍTICO: Forzar detección de cambios para que Angular destruya el componente
      this.cdr.detectChanges();

      // PASO 2: Esperar destrucción completa (más tiempo en Angular 12)
      console.log('📍 PASO 2: Esperando destrucción del componente (600ms)');
      await this.esperarTick(600);

      // PASO 3: Actualizar pregunta actual
      console.log('📍 PASO 3: Actualizando índice de pregunta');
      this.preguntaActualIndex = index;
      this.respuestaSeleccionada = '';

      const preguntaId = this.preguntaActual.id.toString();
      const respuestaGuardada = this.respuestas.get(preguntaId);
      if (respuestaGuardada?.respuestaUsuario) {
        this.respuestaSeleccionada = respuestaGuardada.respuestaUsuario;
      }

      console.log(`📝 Pregunta actual: ${this.preguntaActual.pregunta}`);
      console.log(`📝 Tipo: ${this.preguntaActual.tipo_pregunta}`);

      // CRÍTICO: Forzar detección de cambios para renderizar nueva pregunta
      this.cdr.detectChanges();

      // PASO 4: Si es pregunta de reconocimiento, mostrar cámara después de un delay
      if (this.preguntaActual?.tipo_pregunta === 'reconocimiento') {
        console.log('📍 PASO 4: Pregunta de reconocimiento, esperando para mostrar cámara (700ms)');
        await this.esperarTick(700);
        
        // CRÍTICO: Usar NgZone para asegurar detección de cambios
        this.ngZone.run(() => {
          this.mostrarCamara = true;
          this.cdr.detectChanges();
          console.log('📷 Cámara mostrada para pregunta de reconocimiento');
        });
      } else {
        console.log('📍 PASO 4: Pregunta de opción múltiple/verdadero-falso');
      }

      this.cambiandoPregunta = false;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ CAMBIO A PREGUNTA ${index + 1} COMPLETADO`);
      console.log(`${'='.repeat(60)}\n`);
    }
  }

  private esperarTick(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  detenerCamara(): void {
    console.log('🔴 detenerCamara() público llamado');
    this.detenerCamaraCompletamenteSincrono();
  }

  async preguntaAnterior(): Promise<void> {
    if (this.preguntaActualIndex > 0 && !this.cambiandoPregunta) {
      await this.cambiarPregunta(this.preguntaActualIndex - 1);
    }
  }

  async preguntaSiguiente(): Promise<void> {
    if (this.preguntaActualIndex < this.preguntas.length - 1 && !this.cambiandoPregunta) {
      await this.cambiarPregunta(this.preguntaActualIndex + 1);
    }
  }

  procesarRespuestaReconocimiento(resultado: any): void {
    console.log('📥 Resultado reconocimiento recibido:', resultado);

    if (resultado.exito && resultado.sena_reconocida) {
      const preguntaId = this.preguntaActual.id.toString();

      const respuesta: RespuestaExamen = {
        preguntaId: preguntaId,
        respuestaUsuario: resultado.sena_reconocida,
        tipoRespuesta: 'reconocimiento',
        timestamp: Date.now(),
        respondida: true
      };

      this.respuestas.set(preguntaId, respuesta);

      Swal.fire({
        title: 'Respuesta Registrada',
        html: `
          <div style="text-align: center;">
            <div style="font-size: 3rem; color: #27ae60; margin: 1rem 0;">
              <i class="bi bi-check-circle-fill"></i>
            </div>
            <p style="font-size: 1.2rem; margin: 1rem 0;">
              Seña <strong>"${resultado.sena_reconocida}"</strong> capturada correctamente
            </p>
            <p style="color: #7f8c8d; margin-top: 1rem;">
              <i class="bi bi-info-circle"></i> Puedes cambiar de pregunta usando los botones de navegación
            </p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Entendido',
        showCancelButton: this.preguntaActualIndex < this.preguntas.length - 1,
        cancelButtonText: 'Siguiente Pregunta'
      }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
          this.avanzarSiguientePregunta();
        }
      });
    } else {
      Swal.fire({
        title: 'Tiempo Agotado',
        html: `
          <div style="text-align: center;">
            <div style="font-size: 3rem; color: #e74c3c; margin: 1rem 0;">
              <i class="bi bi-exclamation-triangle"></i>
            </div>
            <p>No se detectó la seña dentro del tiempo límite</p>
            <p style="color: #7f8c8d; margin-top: 1rem;">
              La pregunta quedará sin respuesta a menos que reintentes
            </p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Reintentar',
        cancelButtonText: 'Siguiente'
      }).then((result) => {
        if (result.isConfirmed) {
          this.reiniciarPreguntaActual();
        } else {
          const preguntaId = this.preguntaActual.id.toString();
          const respuesta: RespuestaExamen = {
            preguntaId: preguntaId,
            respuestaUsuario: null,
            tipoRespuesta: 'reconocimiento',
            timestamp: Date.now(),
            respondida: false
          };
          this.respuestas.set(preguntaId, respuesta);

          this.avanzarSiguientePregunta();
        }
      });
    }
  }

  async reiniciarPreguntaActual(): Promise<void> {
    console.log('🔄 Reiniciando pregunta actual');
    
    this.detenerCamaraCompletamenteSincrono();
    this.mostrarCamara = false;
    this.cdr.detectChanges();

    await this.esperarTick(600);

    this.ngZone.run(() => {
      this.mostrarCamara = true;
      this.cdr.detectChanges();
      console.log('📷 Cámara reiniciada');
    });
  }

  async avanzarSiguientePregunta(): Promise<void> {
    if (this.preguntaActualIndex < this.preguntas.length - 1) {
      await this.cambiarPregunta(this.preguntaActualIndex + 1);
    } else {
      this.finalizarExamen();
    }
  }

  obtenerOpcionesPregunta(pregunta: any): { key: string, value: string }[] {
    if (!pregunta.opciones) return [];

    return Object.keys(pregunta.opciones).map(key => ({
      key: key,
      value: pregunta.opciones[key]
    }));
  }

  // CRÍTICO: TrackBy function para Angular 12
  trackByKey(index: number, item: any): string {
    return item.key;
  }

  seleccionarOpcion(opcion: string): void {
    console.log('🎯 Opción seleccionada:', opcion);
    
    // CRÍTICO: Usar NgZone para asegurar detección en Angular 12
    this.ngZone.run(() => {
      this.respuestaSeleccionada = opcion;
      this.cdr.detectChanges();
      console.log('✅ Opción actualizada en el estado');
    });
  }

  confirmarRespuesta(): void {
    if (!this.respuestaSeleccionada) {
      Swal.fire('Atención', 'Selecciona una opción', 'warning');
      return;
    }

    const preguntaId = this.preguntaActual.id.toString();
    const respuesta: RespuestaExamen = {
      preguntaId: preguntaId,
      respuestaUsuario: this.respuestaSeleccionada,
      tipoRespuesta: this.preguntaActual.tipo_pregunta,
      timestamp: Date.now(),
      respondida: true
    };

    this.respuestas.set(preguntaId, respuesta);
    this.respuestaSeleccionada = '';

    if (this.preguntaActualIndex < this.preguntas.length - 1) {
      Swal.fire({
        title: 'Respuesta Guardada',
        text: '¿Deseas continuar con la siguiente pregunta?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Siguiente',
        cancelButtonText: 'Quedarme aquí',
        timer: 3000
      }).then((result) => {
        if (result.isConfirmed || result.dismiss === Swal.DismissReason.timer) {
          this.avanzarSiguientePregunta();
        }
      });
    } else {
      Swal.fire({
        title: 'Última Pregunta Respondida',
        text: '¿Deseas finalizar el examen?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Finalizar',
        cancelButtonText: 'Revisar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.finalizarExamen();
        }
      });
    }
  }

  finalizarExamen(): void {
    const preguntasRespondidas = this.respuestas.size;
    const totalPreguntas = this.preguntas.length;

    if (preguntasRespondidas < totalPreguntas) {
      Swal.fire({
        title: '¿Finalizar Examen?',
        html: `
          <div style="text-align: center;">
            <p>Has respondido <strong>${preguntasRespondidas}</strong> de <strong>${totalPreguntas}</strong> preguntas</p>
            <p style="color: #e74c3c; margin-top: 1rem;">
              <i class="bi bi-exclamation-triangle"></i> 
              Las preguntas sin responder se contarán como incorrectas
            </p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Finalizar de todas formas',
        cancelButtonText: 'Continuar respondiendo'
      }).then((result) => {
        if (result.isConfirmed) {
          this.presentarExamen();
        }
      });
    } else {
      Swal.fire({
        title: '¿Finalizar Examen?',
        text: 'Has respondido todas las preguntas. ¿Deseas enviar tus respuestas?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enviar',
        cancelButtonText: 'Revisar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.presentarExamen();
        }
      });
    }
  }

  presentarExamen(): void {
    this.detenerTimer();
    this.detenerCamaraCompletamenteSincrono();

    const tiempoEmpleado = Math.floor((Date.now() - this.tiempoInicio) / 1000);

    const respuestasParaEnviar: { [key: string]: string } = {};
    this.respuestas.forEach((respuesta, preguntaId) => {
      respuestasParaEnviar[preguntaId] = respuesta.respuestaUsuario || '';
    });

    console.log('📤 Enviando respuestas:', respuestasParaEnviar);
    console.log('⏱️ Tiempo empleado:', tiempoEmpleado);

    this.examenService.presentarExamen(
      this.examenId,
      respuestasParaEnviar,
      tiempoEmpleado
    ).subscribe({
      next: (response) => {
        console.log('✅ Respuesta del examen:', response);

        if (response.exito && response.datos) {
          this.resultado = response.datos;
          this.examenCompletado = true;
          this.examenIniciado = false;

          if (this.resultado.aprobado) {
            Swal.fire({
              title: '¡Felicitaciones!',
              text: `Has aprobado con ${this.resultado.porcentaje}%`,
              icon: 'success',
              confirmButtonText: 'Ver Resultados'
            });
          } else {
            Swal.fire({
              title: 'No Aprobado',
              text: `Obtuviste ${this.resultado.porcentaje}%. Necesitas ${this.resultado.puntuacion_minima}% para aprobar`,
              icon: 'error',
              confirmButtonText: 'Ver Resultados'
            });
          }
        } else {
          Swal.fire('Error', response.mensaje || 'Error al procesar el examen', 'error');
        }
      },
      error: (error) => {
        console.error('❌ Error al presentar examen:', error);
        Swal.fire('Error', 'No se pudo enviar el examen', 'error');
      }
    });
  }

  formatearTiempo(segundos: number): string {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}m ${segs}s`;
  }

  volverALista(): void {
    this.router.navigate(['/examenes']);
  }

  verDetalles(): void {
    this.router.navigate(['/examenes', this.examenId, 'resultados']);
  }

  reiniciarExamen(): void {
    Swal.fire({
      title: '¿Reiniciar Examen?',
      text: 'Podrás volver a intentarlo',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reiniciar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.detenerCamaraCompletamenteSincrono();
        
        this.examenIniciado = false;
        this.examenCompletado = false;
        this.preguntaActualIndex = 0;
        this.respuestas.clear();
        this.respuestaSeleccionada = '';
        this.resultado = null;
        this.mostrarCamara = false;
        this.cambiandoPregunta = false;
      }
    });
  }

  continuarLeccion(): void {
    this.router.navigate(['/lecciones']);
  }

  estaRespondida(preguntaId: number): boolean {
    return this.respuestas.has(preguntaId.toString());
  }

  get contadorRespuestas(): number {
    return this.respuestas.size;
  }
}
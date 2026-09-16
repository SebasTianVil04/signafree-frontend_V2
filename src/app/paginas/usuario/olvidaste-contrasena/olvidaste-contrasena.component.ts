import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { AutenticacionService } from '../../../servicios/autenticacion.service';


@Component({
  selector: 'app-olvidaste-contrasena',
  templateUrl: './olvidaste-contrasena.component.html',
  styleUrls: ['./olvidaste-contrasena.component.scss'],
  standalone: false
})
export class OlvidasteContrasenaComponent implements OnInit {
  formularioRecuperacion!: FormGroup;
  
  cargando = false;
  enviado = false;
  error: string | null = null;
  emailEnviado = '';

  constructor(
    private formBuilder: FormBuilder,
    private autenticacionService: AutenticacionService,
    private notificaciones: NotificacionesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    
    if (this.autenticacionService.estaAutenticado()) {
      this.router.navigate(['/dashboard']);
    }
  }

  private inicializarFormulario(): void {
    this.formularioRecuperacion = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() {
    return this.formularioRecuperacion.get('email');
  }

  onSubmit(): void {
    if (this.formularioRecuperacion.invalid) {
      this.marcarCamposComoTocados();
      return;
    }

    const email = this.formularioRecuperacion.value.email.trim().toLowerCase();
    
    this.cargando = true;
    this.error = null;

    this.autenticacionService.verificarEmailExiste(email).subscribe({
      next: (respuesta) => {
        if (!respuesta.existe) {
          this.cargando = false;
          this.error = 'El correo electrónico no está registrado en nuestro sistema';
          this.notificaciones.mostrarError(this.error);
          return;
        }

        if (respuesta.activo === false) {
          this.cargando = false;
          this.error = 'La cuenta está desactivada. Contacta al administrador';
          this.notificaciones.mostrarError(this.error);
          return;
        }

        this.solicitarRecuperacion(email);
      },
      error: () => {
        this.cargando = false;
        this.error = 'Error al verificar el correo electrónico';
        this.notificaciones.mostrarError(this.error);
      }
    });
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.formularioRecuperacion.controls).forEach(key => {
      this.formularioRecuperacion.get(key)?.markAsTouched();
    });
  }

  private solicitarRecuperacion(email: string): void {
    this.autenticacionService.solicitarRecuperacion({ email }).subscribe({
      next: (respuesta) => {
        this.emailEnviado = email;
        this.enviado = true;
        this.cargando = false;
        this.formularioRecuperacion.reset();
        
        this.notificaciones.mostrarExito('Email de recuperación enviado');
      },
      error: (mensajeError: string) => {
        this.cargando = false;
        this.error = mensajeError;
        this.notificaciones.mostrarError(mensajeError);
      }
    });
  }

  tieneErrorCampo(nombreCampo: string): boolean {
    const campo = this.formularioRecuperacion.get(nombreCampo);
    return !!(campo?.invalid && (campo?.dirty || campo?.touched));
  }

  obtenerErrorCampo(nombreCampo: string): string {
    const campo = this.formularioRecuperacion.get(nombreCampo);
    
    if (campo?.errors) {
      if (campo.errors['required']) {
        return 'Este campo es obligatorio';
      }
      if (campo.errors['email']) {
        return 'Ingresa un email válido';
      }
    }
    
    return '';
  }

  volverAlLogin(): void {
    this.router.navigate(['/login']);
  }

  reintentarEnvio(): void {
    this.enviado = false;
    this.error = null;
    this.emailEnviado = '';
  }

  onEmailInput(): void {
    this.error = null;
  }
}
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
      this.router.navigate(['/inicio']);
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

    this.autenticacionService.solicitarRecuperacion({ email }).subscribe({
      next: () => {
        this.cargando = false;
        this.emailEnviado = email;
        this.enviado = true;
        this.formularioRecuperacion.reset();
        this.notificaciones.mostrarExito('Si el email está registrado, recibirás un enlace en unos minutos');
      },
      error: (error) => {
        this.cargando = false;
        const status = error?.status ?? error?.error?.status ?? null;

        if (status === 0) {
          this.error = 'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (status === 429) {
          this.error = 'Demasiadas solicitudes. Espera unos minutos antes de reintentar.';
        } else if (status && status >= 500) {
          this.error = 'Error del servidor. Inténtalo más tarde.';
        } else if (status === 400) {
          this.error = 'El correo ingresado no es válido.';
        } else {
          this.error = 'No se pudo enviar la solicitud. Inténtalo nuevamente.';
        }

        this.notificaciones.mostrarError(this.error!);
      }
    });
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.formularioRecuperacion.controls).forEach(key => {
      this.formularioRecuperacion.get(key)?.markAsTouched();
    });
  }

  tieneErrorCampo(nombreCampo: string): boolean {
    const campo = this.formularioRecuperacion.get(nombreCampo);
    return !!(campo?.invalid && (campo?.dirty || campo?.touched));
  }

  obtenerErrorCampo(nombreCampo: string): string {
    const campo = this.formularioRecuperacion.get(nombreCampo);

    if (campo?.errors) {
      if (campo.errors['required']) return 'Este campo es obligatorio';
      if (campo.errors['email']) return 'Ingresa un email válido';
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
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfirmarRecuperacion } from '../../../modelos/usuario.model';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { AutenticacionService } from '../../../servicios/autenticacion.service';


@Component({
  selector: 'app-restablecer-contrasena',
  templateUrl: './restablecer-contrasena.component.html',
  styleUrls: ['./restablecer-contrasena.component.scss'],
  standalone: false
})
export class RestablecerContrasenaComponent implements OnInit, OnDestroy {

  formularioRestablecer!: FormGroup;
  cargando = false;
  verificandoToken = true;
  tokenValido = false;
  completado = false;
  error: string | null = null;
  mostrarAlertaError = false;

  token: string | null = null;
  emailAsociado: string = '';
  mostrarPassword = false;
  mostrarConfirmarPassword = false;
  private subscripciones: Subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private autenticacionService: AutenticacionService,
    private notificaciones: NotificacionesService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.inicializarFormulario();
    this.obtenerTokenDeUrl();

    if (this.autenticacionService.estaAutenticado()) {
      this.router.navigate(['/dashboard']);
      return;
    }
  }

  ngOnDestroy(): void {
    this.subscripciones.unsubscribe();
  }

  private inicializarFormulario(): void {
    this.formularioRestablecer = this.formBuilder.group({
      password_nueva: ['', [
        Validators.required,
        Validators.minLength(8),
        this.validadorFortalezaPassword.bind(this)
      ]],
      confirmar_password: ['', [Validators.required]]
    }, { validators: this.validadorPasswordsCoinciden.bind(this) });
  }

  private validadorFortalezaPassword(control: AbstractControl) {
    if (!control.value) return null;
    const validacion = this.autenticacionService.validarPassword(control.value);
    if (!validacion.esValida) {
      return { passwordDebil: { errores: validacion.errores } };
    }
    return null;
  }

  private validadorPasswordsCoinciden(group: AbstractControl) {
    const password = group.get('password_nueva');
    const confirmarPassword = group.get('confirmar_password');
    if (!password || !confirmarPassword) return null;
    if (password.value !== confirmarPassword.value) {
      return { passwordsNoCoinciden: true };
    }
    return null;
  }

  private obtenerTokenDeUrl(): void {
    const subs = this.route.params.subscribe(params => {
      this.token = params['token'];
      if (!this.token) {
        this.error = 'Token de recuperación no encontrado en la URL';
        this.verificandoToken = false;
        this.tokenValido = false;
        return;
      }
      this.verificarToken();
    });
    this.subscripciones.add(subs);
  }

  private verificarToken(): void {
    if (!this.token) {
      this.error = 'Token no válido';
      this.verificandoToken = false;
      return;
    }
    const subs = this.autenticacionService.verificarTokenRecuperacion(this.token).subscribe({
      next: (respuesta: any) => {
        this.tokenValido = true;
        this.verificandoToken = false;
        this.emailAsociado = respuesta.email;
        this.error = null;
        this.mostrarAlertaError = false;
        this.autenticacionService.guardarTokenRecuperacion(this.token!);
      },
      error: (mensajeError: string) => {
        this.tokenValido = false;
        this.verificandoToken = false;
        this.error = mensajeError;
        this.mostrarAlertaError = true;
      }
    });
    this.subscripciones.add(subs);
  }

  get passwordNueva() {
    return this.formularioRestablecer.get('password_nueva');
  }

  get confirmarPassword() {
    return this.formularioRestablecer.get('confirmar_password');
  }

  onSubmit(): void {
    this.error = null;
    this.mostrarAlertaError = false;

    if (!this.puedeEnviar()) return;

    this.cargando = true;
    const datosConfirmacion: ConfirmarRecuperacion = {
      token: this.token!,
      password_nueva: this.formularioRestablecer.value.password_nueva
    };

    this.autenticacionService.confirmarRecuperacion(datosConfirmacion).subscribe({
      next: (respuesta) => {
        this.completado = true;
        this.cargando = false;
        this.error = null;
        this.mostrarAlertaError = false;
        this.autenticacionService.limpiarTokenRecuperacion();
        this.formularioRestablecer.reset();

        this.notificaciones.mostrarExito('Contraseña restablecida exitosamente');

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (mensajeError: string) => {
        this.cargando = false;

        this.error = mensajeError;
        this.mostrarAlertaError = true;

        this.notificaciones.mostrarError(mensajeError);

        setTimeout(() => {
          const alertElement = document.querySelector('.alert-error');
          if (alertElement) {
            alertElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
      }
    });
  }

  tieneErrorCampo(nombreCampo: string): boolean {
    const campo = this.formularioRestablecer.get(nombreCampo);
    return !!campo?.invalid && (campo?.dirty || campo?.touched);
  }

  obtenerErrorCampo(nombreCampo: string): string {
    const campo = this.formularioRestablecer.get(nombreCampo);
    if (campo?.errors) {
      if (campo.errors?.['required']) return 'Este campo es obligatorio';
      if (campo.errors?.['minlength']) return `Mínimo ${campo.errors['minlength'].requiredLength} caracteres`;
      if (campo.errors?.['passwordDebil']) return 'Contraseña insegura: ' + campo.errors['passwordDebil'].errores.join(', ');
      const formErrors = this.formularioRestablecer.errors;
      if (formErrors?.['passwordsNoCoinciden'] && nombreCampo === 'confirmar_password') {
        return 'Las contraseñas no coinciden';
      }
    }
    return '';
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  toggleMostrarConfirmarPassword(): void {
    this.mostrarConfirmarPassword = !this.mostrarConfirmarPassword;
  }

  volverAlLogin(): void {
    this.router.navigate(['/login']);
  }

  solicitarNuevoToken(): void {
    this.router.navigate(['/olvidaste-contrasena']);
  }

  obtenerFortalezaPassword(): 'debil' | 'medio' | 'fuerte' {
    const password = this.passwordNueva?.value;
    if (!password) return 'debil';
    const validacion = this.autenticacionService.validarPassword(password);
    const errores = validacion.errores.length;
    if (errores === 0) return 'fuerte';
    else if (errores <= 2) return 'medio';
    else return 'debil';
  }

  obtenerSugerenciasPassword(): string[] {
    const password = this.passwordNueva?.value;
    if (!password) return [];
    const validacion = this.autenticacionService.validarPassword(password);
    return validacion.errores;
  }

  puedeEnviar(): boolean {
    return this.formularioRestablecer.valid &&
      !this.cargando &&
      !this.completado &&
      this.tokenValido;
  }

  obtenerProgresoFortaleza(): number {
    const password = this.passwordNueva?.value;
    if (!password) return 0;
    const validacion = this.autenticacionService.validarPassword(password);
    const totalRequisitos = 5;
    const requisitosCompletos = totalRequisitos - validacion.errores.length;
    return Math.round((requisitosCompletos / totalRequisitos) * 100);
  }

  limpiarFormulario(): void {
    this.formularioRestablecer.reset();
    this.error = null;
    this.mostrarAlertaError = false;
    this.completado = false;
  }

  cerrarAlerta(): void {
    this.error = null;
    this.mostrarAlertaError = false;
  }
}
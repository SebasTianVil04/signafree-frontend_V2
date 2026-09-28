import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { ValidadoresPersonalizados } from '../../../utilidades/validadores';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  cargando = false;
  mostrarPassword = false;
  returnUrl: string = '/inicio';
  errorMensaje: string = '';

  constructor(
    private fb: FormBuilder,
    private autenticacionService: AutenticacionService,
    private notificaciones: NotificacionesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.configurarLimpiezaErroresServidor();
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/inicio';

    if (this.autenticacionService.estaAutenticado()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  inicializarFormulario(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, ValidadoresPersonalizados.validarEmail()]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  configurarLimpiezaErroresServidor(): void {
    this.loginForm.get('email')?.valueChanges.subscribe(() => {
      const control = this.loginForm.get('email');
      if (control?.errors?.['incorrecto']) {
        const errores = { ...control.errors };
        delete errores['incorrecto'];
        control.setErrors(Object.keys(errores).length ? errores : null);
      }
      if (this.errorMensaje) {
        this.errorMensaje = '';
      }
    });

    this.loginForm.get('password')?.valueChanges.subscribe(() => {
      const control = this.loginForm.get('password');
      if (control?.errors?.['incorrecto']) {
        const errores = { ...control.errors };
        delete errores['incorrecto'];
        control.setErrors(Object.keys(errores).length ? errores : null);
      }
      if (this.errorMensaje) {
        this.errorMensaje = '';
      }
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  onSubmit(): void {
    this.errorMensaje = '';

    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.controls[key].markAsTouched();
      });
      this.notificaciones.mostrarAdvertencia('Por favor, completa todos los campos correctamente');
      return;
    }

    this.cargando = true;

    this.autenticacionService.login(this.loginForm.value).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        this.notificaciones.mostrarExito('Inicio de sesión exitoso');
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        console.error('Error en login:', error);
        this.cargando = false;

        const mensaje =
          (typeof error === 'string' ? error : null) ||
          (typeof error?.error === 'string' ? error.error : null) ||
          error?.error?.mensaje ||
          error?.error?.message ||
          error?.error?.detail ||
          error?.message ||
          'Credenciales incorrectas. Verifica tu correo y contraseña.';

        const mensajeLower = String(mensaje).toLowerCase();
        const status = error?.status ?? error?.error?.status ?? null;

        this.errorMensaje = mensaje;

        if (
          mensajeLower.includes('contraseña') ||
          mensajeLower.includes('password') ||
          mensajeLower.includes('credenciales') ||
          mensajeLower.includes('incorrectos')
        ) {
          this.notificaciones.mostrarError('Contraseña incorrecta. Inténtalo de nuevo.');
          this.loginForm.get('password')?.setErrors({ incorrecto: true });

        } else if (
          mensajeLower.includes('correo') ||
          mensajeLower.includes('email') ||
          mensajeLower.includes('encontrado') ||
          mensajeLower.includes('no existe')
        ) {
          this.notificaciones.mostrarError('Correo no encontrado. Verifica tu email o regístrate.');
          this.loginForm.get('email')?.setErrors({ incorrecto: true });

        } else if (
          mensajeLower.includes('inactivo') ||
          mensajeLower.includes('deshabilitado') ||
          mensajeLower.includes('bloqueado')
        ) {
          this.notificaciones.mostrarAdvertencia('Tu cuenta está inactiva o bloqueada. Contacta al soporte.');

        } else if (status === 401 || status === 403) {
          this.notificaciones.mostrarError('Credenciales incorrectas. Verifica tu correo y contraseña.');

        } else if (status === 400) {
          this.notificaciones.mostrarError(mensaje);

        } else if (status === 0) {
          this.notificaciones.mostrarError('No se pudo conectar con el servidor. Verifica tu conexión.');

        } else if (status && status >= 500) {
          this.notificaciones.mostrarError('Error del servidor. Inténtalo más tarde.');

        } else {
          this.notificaciones.mostrarError(mensaje);
        }
      }
    });
  }

  irARegistro(): void {
    this.router.navigate(['/registro']);
  }

  irAOlvideContrasena(): void {
    this.router.navigate(['/olvide-contrasena']);
  }

  limpiarError(): void {
    this.errorMensaje = '';
  }
}
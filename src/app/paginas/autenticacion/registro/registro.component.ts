import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { ValidadoresPersonalizados } from '../../../utilidades/validadores';
import { RegistroRequest } from '../../../modelos/usuario.model';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
  standalone: false
})
export class RegistroComponent implements OnInit {
  registroForm!: FormGroup;
  cargando = false;
  mostrarPassword = false;
  mostrarConfirmarPassword = false;

  constructor(
    private fb: FormBuilder,
    private autenticacionService: AutenticacionService,
    private notificaciones: NotificacionesService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.inicializarFormulario();
    this.configurarLimpiezaErroresServidor();
  }

  inicializarFormulario(): void {
    this.registroForm = this.fb.group({
      nombre_usuario: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30),
        Validators.pattern(/^[a-zA-Z0-9_]+$/)
      ]],
      email: ['', [Validators.required, ValidadoresPersonalizados.validarEmail()]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        ValidadoresPersonalizados.validarFortalezaPassword()
      ]],
      confirmar_password: ['', Validators.required]
    }, {
      validators: ValidadoresPersonalizados.validarPasswordsIguales('password', 'confirmar_password')
    });
  }

  configurarLimpiezaErroresServidor(): void {
    this.registroForm.get('email')?.valueChanges.subscribe(() => {
      const control = this.registroForm.get('email');
      if (control?.errors?.['emailRegistrado']) {
        const errores = { ...control.errors };
        delete errores['emailRegistrado'];
        control.setErrors(Object.keys(errores).length ? errores : null);
      }
    });

    this.registroForm.get('nombre_usuario')?.valueChanges.subscribe(() => {
      const control = this.registroForm.get('nombre_usuario');
      if (control?.errors?.['usuarioRegistrado']) {
        const errores = { ...control.errors };
        delete errores['usuarioRegistrado'];
        control.setErrors(Object.keys(errores).length ? errores : null);
      }
    });
  }

  get f() {
    return this.registroForm.controls;
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  toggleMostrarConfirmarPassword(): void {
    this.mostrarConfirmarPassword = !this.mostrarConfirmarPassword;
  }

  obtenerFortalezaPassword(): string {
    const password = this.registroForm.get('password')?.value;
    if (!password) return 'debil';

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score === 5) return 'fuerte';
    if (score >= 3) return 'medio';
    return 'debil';
  }

  obtenerProgresoFortaleza(): number {
    const password = this.registroForm.get('password')?.value;
    if (!password) return 0;

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    return (score / 5) * 100;
  }

  onSubmit(): void {
    Object.keys(this.registroForm.controls).forEach(key => {
      this.registroForm.controls[key].markAsTouched();
    });

    if (this.registroForm.invalid) {
      this.notificaciones.mostrarAdvertencia('Por favor completa todos los campos requeridos correctamente');
      return;
    }

    this.cargando = true;

    const formData = this.registroForm.getRawValue();

    const datosRegistro: RegistroRequest = {
      nombre_usuario: formData.nombre_usuario.trim(),
      email: formData.email.toLowerCase().trim(),
      password: formData.password
    };

    this.autenticacionService.registro(datosRegistro).subscribe({
      next: (respuesta) => {
        this.notificaciones.mostrarExito('Registro exitoso. Bienvenido a SignaFree');
        this.cargando = false;
        this.router.navigate(['/inicio']);
      },
      error: (error) => {
        console.error('Error en registro:', error);
        this.cargando = false;

        const mensaje =
          (typeof error === 'string' ? error : null) ||
          (typeof error?.error === 'string' ? error.error : null) ||
          error?.error?.mensaje ||
          error?.error?.message ||
          error?.error?.detail ||
          error?.message ||
          'Ocurrió un error inesperado al registrar la cuenta';

        const mensajeLower = String(mensaje).toLowerCase();
        const status = error?.status ?? error?.error?.status ?? null;

        if (
          mensajeLower.includes('email') &&
          (mensajeLower.includes('registrado') ||
            mensajeLower.includes('ya existe') ||
            mensajeLower.includes('duplicado'))
        ) {
          this.notificaciones.mostrarError('El email ya está registrado. Intenta con otro o inicia sesión.');
          this.registroForm.get('email')?.setErrors({ emailRegistrado: true });

        } else if (
          (mensajeLower.includes('nombre') || mensajeLower.includes('usuario')) &&
          (mensajeLower.includes('registrado') ||
            mensajeLower.includes('ya existe') ||
            mensajeLower.includes('en uso') ||
            mensajeLower.includes('duplicado'))
        ) {
          this.notificaciones.mostrarError('El nombre de usuario ya está en uso. Elige otro.');
          this.registroForm.get('nombre_usuario')?.setErrors({ usuarioRegistrado: true });

        } else if (status === 400) {
          this.notificaciones.mostrarError(mensaje);

        } else if (status === 401 || status === 403) {
          this.notificaciones.mostrarError('No tienes permisos para realizar esta acción.');

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

  irALogin(): void {
    this.router.navigate(['/login']);
  }
}
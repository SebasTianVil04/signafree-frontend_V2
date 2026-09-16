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
      this.notificaciones.mostrarError('Por favor, completa todos los campos correctamente');
      return;
    }

    this.cargando = true;

    this.autenticacionService.login(this.loginForm.value).subscribe({
      next: (respuesta) => {
        this.notificaciones.mostrarExito('Inicio de sesión exitoso');
        this.router.navigate([this.returnUrl]);
      },
      error: (mensajeError: string) => {
        this.cargando = false;
        this.errorMensaje = mensajeError;
        this.notificaciones.mostrarError(mensajeError);
        
        if (mensajeError.toLowerCase().includes('contraseña') ||
            mensajeError.toLowerCase().includes('incorrectos')) {
          this.loginForm.get('password')?.setErrors({ 'incorrecto': true });
        } else if (mensajeError.toLowerCase().includes('correo') ||
                   mensajeError.toLowerCase().includes('encontrado')) {
          this.loginForm.get('email')?.setErrors({ 'incorrecto': true });
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
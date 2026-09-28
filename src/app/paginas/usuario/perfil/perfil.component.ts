import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { injectMutation, injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { UsuariosService } from '../../../servicios/usuarios.service';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { Usuario } from '../../../modelos/usuario.model';
import { ValidadoresPersonalizados } from '../../../utilidades/validadores';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  standalone: false
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private autenticacionService = inject(AutenticacionService);
  private usuariosService = inject(UsuariosService);
  private notificaciones = inject(NotificacionesService);
  private queryClient = injectQueryClient();

  perfilForm!: FormGroup;
  passwordForm!: FormGroup;
  editando = false;
  cambiandoPassword = false;
  mostrarPasswordActual = false;
  mostrarPasswordNueva = false;
  mostrarPasswordConfirmar = false;

  private perfilQuery = injectQuery(() => ({
    queryKey: ['perfil'],
    queryFn: () => lastValueFrom(this.usuariosService.obtenerPerfil())
  }));

  usuario = computed<Usuario | null>(() => this.perfilQuery.data() ?? null);
  cargandoPerfil = computed(() => this.perfilQuery.isPending());

  private actualizarPerfilMutation = injectMutation(() => ({
    mutationFn: (datos: { nombre_usuario: string }) =>
      lastValueFrom(this.usuariosService.actualizarPerfil(datos)),
    onSuccess: (respuesta: any) => {
      this.notificaciones.mostrarExito(respuesta.mensaje || 'Perfil actualizado correctamente');
      if (respuesta.datos) {
        this.autenticacionService.actualizarUsuarioLocal(respuesta.datos);
      }
      this.queryClient.invalidateQueries({ queryKey: ['perfil'] });
      this.editando = false;
      this.perfilForm.get('nombre_usuario')?.disable();
    },
    onError: (error: any) => {
      this.notificaciones.mostrarError(error.error?.detail || 'Error al actualizar el perfil');
    }
  }));

  private cambiarPasswordMutation = injectMutation(() => ({
    mutationFn: (datos: { password_actual: string; password_nueva: string }) =>
      lastValueFrom(this.usuariosService.cambiarPassword(datos)),
    onSuccess: () => {
      this.notificaciones.mostrarExito('Contraseña actualizada correctamente');
      this.cambiandoPassword = false;
      this.passwordForm.reset();
    },
    onError: (error: any) => {
      this.notificaciones.mostrarError(error.error?.detail || 'Error al cambiar la contraseña');
    }
  }));

  guardandoPerfil = computed(() => this.actualizarPerfilMutation.isPending());
  cambiandoPasswordEnCurso = computed(() => this.cambiarPasswordMutation.isPending());

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      if (usuario) {
        this.cargarDatosEnFormulario(usuario);
      }
    });
  }

  ngOnInit(): void {
    this.inicializarFormularios();
  }

  inicializarFormularios(): void {
    this.perfilForm = this.fb.group({
      nombre_usuario: [{ value: '', disabled: true }, [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30),
        Validators.pattern(/^[a-zA-Z0-9_]+$/)
      ]]
    });

    this.passwordForm = this.fb.group({
      password_actual: ['', Validators.required],
      password_nueva: ['', [
        Validators.required,
        Validators.minLength(8),
        ValidadoresPersonalizados.validarFortalezaPassword()
      ]],
      confirmar_password: ['', Validators.required]
    }, {
      validators: ValidadoresPersonalizados.validarPasswordsIguales('password_nueva', 'confirmar_password')
    });
  }

  get nombreRol(): string {
    const usuario = this.usuario();
    if (!usuario) return '';
    if (usuario.es_admin) return 'Administrador';
    return usuario.rol?.nombre || 'Usuario';
  }

  get estadoCuenta(): string {
    const usuario = this.usuario();
    if (!usuario) return '';
    return usuario.activo ? 'Activa' : 'Desactivada';
  }

  get estadoVerificacion(): string {
    const usuario = this.usuario();
    if (!usuario) return '';
    return usuario.verificado ? 'Verificado' : 'Sin verificar';
  }

  private cargarDatosEnFormulario(usuario: Usuario): void {
    this.perfilForm.patchValue({
      nombre_usuario: usuario.nombre_usuario || ''
    });
  }

  toggleEditar(): void {
    this.editando = !this.editando;

    if (this.editando) {
      this.perfilForm.get('nombre_usuario')?.enable();
    } else {
      this.perfilForm.get('nombre_usuario')?.disable();
      const usuario = this.usuario();
      if (usuario) {
        this.cargarDatosEnFormulario(usuario);
      }
    }
  }

  guardarCambios(): void {
    if (this.guardandoPerfil()) {
      return;
    }

    const nombreUsuarioControl = this.perfilForm.get('nombre_usuario');
    nombreUsuarioControl?.markAsTouched();

    if (nombreUsuarioControl?.invalid) {
      this.notificaciones.mostrarAdvertencia('El nombre de usuario no es válido');
      return;
    }

    this.actualizarPerfilMutation.mutate({
      nombre_usuario: (nombreUsuarioControl?.value || '').trim()
    });
  }

  cambiarPassword(): void {
    if (this.cambiandoPasswordEnCurso()) {
      return;
    }

    if (this.passwordForm.invalid) {
      Object.keys(this.passwordForm.controls).forEach(key => {
        this.passwordForm.controls[key].markAsTouched();
      });
      return;
    }

    this.cambiarPasswordMutation.mutate({
      password_actual: this.passwordForm.get('password_actual')?.value,
      password_nueva: this.passwordForm.get('password_nueva')?.value
    });
  }

  toggleCambiarPassword(): void {
    this.cambiandoPassword = !this.cambiandoPassword;
    if (!this.cambiandoPassword) {
      this.passwordForm.reset();
    }
  }

  get iniciales(): string {
    const usuario = this.usuario();
    if (!usuario?.nombre_usuario) return '';
    return usuario.nombre_usuario.substring(0, 2).toUpperCase();
  }

  obtenerErroresPassword(): string[] {
    const errores: string[] = [];
    const passwordControl = this.passwordForm.get('password_nueva');

    if (passwordControl?.errors) {
      if (passwordControl.errors['longitudMinima']) errores.push('Mínimo 8 caracteres');
      if (passwordControl.errors['faltaMayuscula']) errores.push('Al menos una mayúscula');
      if (passwordControl.errors['faltaMinuscula']) errores.push('Al menos una minúscula');
      if (passwordControl.errors['faltaNumero']) errores.push('Al menos un número');
      if (passwordControl.errors['faltaCaracterEspecial']) errores.push('Al menos un carácter especial');
    }

    return errores;
  }
}
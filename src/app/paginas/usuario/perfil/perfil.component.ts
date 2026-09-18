import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { injectMutation, injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { UsuariosService } from '../../../servicios/usuarios.service';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { Usuario, TipoUsuario, CODIGOS_PAIS, CodigoPais } from '../../../modelos/usuario.model';
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
  maxLongitudTelefono: number = 15;

  codigosPais: CodigoPais[] = CODIGOS_PAIS;

  private longitudesPorPais: { [key: string]: number } = {
    '+51': 9,
    '+1': 10,
    '+34': 9,
    '+52': 10,
    '+54': 11,
    '+55': 11,
    '+56': 9,
    '+57': 10,
    '+593': 9,
    '+58': 10
  };

  private perfilQuery = injectQuery(() => ({
    queryKey: ['perfil'],
    queryFn: () => lastValueFrom(this.usuariosService.obtenerPerfil())
  }));

  usuario = computed<Usuario | null>(() => this.perfilQuery.data() ?? null);
  cargandoPerfil = computed(() => this.perfilQuery.isPending());

  private actualizarPerfilMutation = injectMutation(() => ({
    mutationFn: (datos: any) => lastValueFrom(this.usuariosService.actualizarPerfil(datos)),
    onSuccess: (respuesta: any) => {
      this.notificaciones.mostrarExito(respuesta.mensaje || 'Perfil actualizado correctamente');
      if (respuesta.datos) {
        this.autenticacionService.actualizarUsuarioLocal(respuesta.datos);
      }
      this.queryClient.invalidateQueries({ queryKey: ['perfil'] });
      this.editando = false;
      this.deshabilitarCamposEditables();
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
    this.actualizarMaxLongitudTelefono();
  }

  actualizarMaxLongitudTelefono(): void {
    const codigoPais = this.perfilForm.get('codigo_pais')?.value || '+51';
    this.maxLongitudTelefono = this.longitudesPorPais[codigoPais] || 15;
  }

  onCodigoPaisChange(): void {
    this.actualizarMaxLongitudTelefono();
    const numeroActual = this.perfilForm.get('telefono')?.value || '';
    if (numeroActual.length > this.maxLongitudTelefono) {
      this.perfilForm.get('telefono')?.setValue(
        numeroActual.substring(0, this.maxLongitudTelefono)
      );
    }
  }

  validarSoloNumeros(event: any): void {
    const input = event.target;
    const valor = input.value;
    const soloNumeros = valor.replace(/\D/g, '');
    if (valor !== soloNumeros) {
      input.value = soloNumeros;
      this.perfilForm.get('telefono')?.setValue(soloNumeros);
    }
  }

  inicializarFormularios(): void {
    this.perfilForm = this.fb.group({
      tipo_usuario: [{ value: '', disabled: true }],
      documento: [{ value: '', disabled: true }],
      nombres: [{ value: '', disabled: true }],
      apellidos: [{ value: '', disabled: true }],
      email: [{ value: '', disabled: true }],
      codigo_pais: [{ value: '+51', disabled: true }],
      telefono: [{ value: '', disabled: true }],
      fecha_nacimiento: [{ value: '', disabled: true }],
      direccion: [{ value: '', disabled: true }]
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

  private cargarDatosEnFormulario(usuario: Usuario): void {
    let documento = '';
    if (usuario.tipo_usuario === 'extranjero') {
      documento = usuario.pasaporte || 'Sin pasaporte';
    } else {
      documento = usuario.dni || 'Sin DNI';
    }

    let apellidosCompletos = '';
    if (usuario.apellidos) {
      apellidosCompletos = usuario.apellidos;
    } else if (usuario.apellido_paterno || usuario.apellido_materno) {
      apellidosCompletos = `${usuario.apellido_paterno || ''} ${usuario.apellido_materno || ''}`.trim();
    }

    let codigoPais = '+51';
    let numeroTelefono = '';

    if (usuario.telefono) {
      codigoPais = this.autenticacionService.extraerCodigoPais(usuario.telefono);
      numeroTelefono = this.autenticacionService.extraerNumeroTelefono(usuario.telefono);
    }

    let fechaNacimiento = '';
    if (usuario.fecha_nacimiento) {
      fechaNacimiento = this.formatearFechaParaInput(usuario.fecha_nacimiento);
    }

    const tipoUsuarioTexto = this.obtenerTextoTipoUsuario(usuario.tipo_usuario);

    this.perfilForm.patchValue({
      tipo_usuario: tipoUsuarioTexto || 'No especificado',
      documento: documento,
      nombres: usuario.nombres || '',
      apellidos: apellidosCompletos || '',
      email: usuario.email || '',
      codigo_pais: codigoPais,
      telefono: numeroTelefono,
      fecha_nacimiento: fechaNacimiento,
      direccion: usuario.direccion || ''
    });

    this.actualizarMaxLongitudTelefono();
  }

  obtenerTextoTipoUsuario(tipo: TipoUsuario | undefined): string {
    switch (tipo) {
      case 'peruano_mayor':
        return 'Peruano Mayor de Edad';
      case 'peruano_menor':
        return 'Peruano Menor de Edad';
      case 'extranjero':
        return 'Extranjero';
      default:
        return 'No especificado';
    }
  }

  formatearFechaParaInput(fecha: any): string {
    if (!fecha) return '';

    try {
      let fechaObj: Date;

      if (typeof fecha === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          return fecha;
        }
        fechaObj = new Date(fecha);
      } else if (fecha instanceof Date) {
        fechaObj = fecha;
      } else {
        return '';
      }

      if (isNaN(fechaObj.getTime())) {
        return '';
      }

      const year = fechaObj.getFullYear();
      const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const day = String(fechaObj.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  private deshabilitarCamposEditables(): void {
    this.perfilForm.get('codigo_pais')?.disable();
    this.perfilForm.get('telefono')?.disable();
    this.perfilForm.get('fecha_nacimiento')?.disable();
    this.perfilForm.get('direccion')?.disable();
  }

  toggleEditar(): void {
    this.editando = !this.editando;

    if (this.editando) {
      this.perfilForm.get('codigo_pais')?.enable();
      this.perfilForm.get('telefono')?.enable();
      this.perfilForm.get('fecha_nacimiento')?.enable();
      this.perfilForm.get('direccion')?.enable();
    } else {
      this.deshabilitarCamposEditables();
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

    const codigoPaisControl = this.perfilForm.get('codigo_pais');
    const telefonoControl = this.perfilForm.get('telefono');
    const fechaNacimientoControl = this.perfilForm.get('fecha_nacimiento');
    const direccionControl = this.perfilForm.get('direccion');

    codigoPaisControl?.markAsTouched();
    telefonoControl?.markAsTouched();
    fechaNacimientoControl?.markAsTouched();
    direccionControl?.markAsTouched();

    const codigoPais = codigoPaisControl?.value || '+51';
    const numeroTelefono = telefonoControl?.value || '';

    const telefonoCompleto = this.autenticacionService.obtenerTelefonoCompleto(codigoPais, numeroTelefono);

    if (telefonoCompleto) {
      const soloNumeros = numeroTelefono.replace(/\D/g, '');
      const longitudEsperada = this.longitudesPorPais[codigoPais];

      if (longitudEsperada && soloNumeros.length !== longitudEsperada) {
        this.notificaciones.mostrarAdvertencia(
          `El número para ${codigoPais} debe tener exactamente ${longitudEsperada} dígitos`
        );
        return;
      }

      if (!this.autenticacionService.validarTelefono(telefonoCompleto)) {
        this.notificaciones.mostrarAdvertencia('El formato del teléfono no es válido');
        return;
      }
    }

    this.actualizarPerfilMutation.mutate({
      telefono: telefonoCompleto,
      fecha_nacimiento: fechaNacimientoControl?.value || null,
      direccion: direccionControl?.value || null
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
    if (!usuario) return '';
    const nombres = usuario.nombres?.charAt(0) || '';
    const apellidoPaterno = usuario.apellido_paterno?.charAt(0) || '';
    return (nombres + apellidoPaterno).toUpperCase();
  }

  get documentoLabel(): string {
    const usuario = this.usuario();
    if (!usuario) return 'Documento';
    return usuario.tipo_usuario === 'extranjero' ? 'Pasaporte' : 'DNI';
  }

  get telefonoFormateado(): string {
    const usuario = this.usuario();
    if (!usuario?.telefono) return 'No especificado';
    return this.autenticacionService.formatearTelefono(usuario.telefono);
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
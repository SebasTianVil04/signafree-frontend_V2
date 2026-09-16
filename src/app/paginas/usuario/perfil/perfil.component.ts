import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { UsuariosService } from '../../../servicios/usuarios.service';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { Usuario, TipoUsuario, CODIGOS_PAIS, CodigoPais, ValidacionUtils } from '../../../modelos/usuario.model';
import { ValidadoresPersonalizados } from '../../../utilidades/validadores';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  standalone : false
})
export class PerfilComponent implements OnInit {
  perfilForm!: FormGroup;
  passwordForm!: FormGroup;
  usuario: Usuario | null = null;
  cargando = false;
  editando = false;
  cambiandoPassword = false;
  mostrarPasswordActual = false;
  mostrarPasswordNueva = false;
  mostrarPasswordConfirmar = false;
  maxLongitudTelefono: number = 15;

  // Códigos de país para teléfonos
  codigosPais: CodigoPais[] = CODIGOS_PAIS;

  constructor(
    private fb: FormBuilder,
    private autenticacionService: AutenticacionService,
    private usuariosService: UsuariosService,
    private notificaciones: NotificacionesService
  ) { }

  ngOnInit(): void {
    this.inicializarFormularios();
    this.cargarPerfilDesdeServidor();
    this.actualizarMaxLongitudTelefono();
  }

  private longitudesPorPais: { [key: string]: number } = {
    '+51': 9,   // Perú
    '+1': 10,   // USA/Canadá
    '+34': 9,   // España
    '+52': 10,  // México
    '+54': 11,  // Argentina
    '+55': 11,  // Brasil
    '+56': 9,   // Chile
    '+57': 10,  // Colombia
    '+593': 9,  // Ecuador
    '+58': 10   // Venezuela
  };

  actualizarMaxLongitudTelefono(): void {
    const codigoPais = this.perfilForm.get('codigo_pais')?.value || '+51';
    this.maxLongitudTelefono = this.longitudesPorPais[codigoPais] || 15;
  }

  onCodigoPaisChange(): void {
    this.actualizarMaxLongitudTelefono();
    // Limpiar el número si excede la nueva longitud
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
    // Remover cualquier carácter que no sea número
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

  cargarPerfilDesdeServidor(): void {
    this.cargando = true;

    this.usuariosService.obtenerPerfil().subscribe({
      next: (usuario) => {
        console.log('Perfil cargado:', usuario);
        this.usuario = usuario;
        this.cargarDatosEnFormulario();
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.notificaciones.mostrarError('Error al cargar el perfil');
        this.cargando = false;
      }
    });
  }

  cargarDatosEnFormulario(): void {
    if (!this.usuario) {
      console.error('No hay usuario para cargar');
      return;
    }

    console.log('Usuario a cargar:', this.usuario);
    console.log('Teléfono del usuario:', this.usuario.telefono);

    // Determinar el documento según tipo de usuario
    let documento = '';
    if (this.usuario.tipo_usuario === 'extranjero') {
      documento = this.usuario.pasaporte || 'Sin pasaporte'; // Cambiado
    } else {
      documento = this.usuario.dni || 'Sin DNI';
    }

    // Combinar apellidos
    let apellidosCompletos = '';
    if (this.usuario.apellidos) {
      apellidosCompletos = this.usuario.apellidos;
    } else if (this.usuario.apellido_paterno || this.usuario.apellido_materno) {
      apellidosCompletos = `${this.usuario.apellido_paterno || ''} ${this.usuario.apellido_materno || ''}`.trim();
    }

    // Extraer código de país y número del teléfono
    let codigoPais = '+51';
    let numeroTelefono = '';

    if (this.usuario.telefono) {
      codigoPais = this.autenticacionService.extraerCodigoPais(this.usuario.telefono);
      numeroTelefono = this.autenticacionService.extraerNumeroTelefono(this.usuario.telefono);

      console.log('Teléfono completo:', this.usuario.telefono);
      console.log('Código de país extraído:', codigoPais);
      console.log('Número extraído:', numeroTelefono);
    }

    // Formatear fecha de nacimiento
    let fechaNacimiento = '';
    if (this.usuario.fecha_nacimiento) {
      fechaNacimiento = this.formatearFechaParaInput(this.usuario.fecha_nacimiento);
    }

    // Obtener texto del tipo de usuario
    const tipoUsuarioTexto = this.obtenerTextoTipoUsuario(this.usuario.tipo_usuario);

    // Cargar valores en el formulario
    this.perfilForm.patchValue({
      tipo_usuario: tipoUsuarioTexto || 'No especificado',
      documento: documento,
      nombres: this.usuario.nombres || '',
      apellidos: apellidosCompletos || '',
      email: this.usuario.email || '',
      codigo_pais: codigoPais,
      telefono: numeroTelefono,
      fecha_nacimiento: fechaNacimiento,
      direccion: this.usuario.direccion || ''
    });

    console.log('Valores cargados en formulario:', {
      codigo_pais: codigoPais,
      telefono: numeroTelefono,
      telefonoCompleto: this.usuario.telefono
    });
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
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return '';
    }
  }

  toggleEditar(): void {
    this.editando = !this.editando;

    if (this.editando) {
      // Habilitar solo campos editables
      this.perfilForm.get('codigo_pais')?.enable();
      this.perfilForm.get('telefono')?.enable();
      this.perfilForm.get('fecha_nacimiento')?.enable();
      this.perfilForm.get('direccion')?.enable();
    } else {
      // Deshabilitar campos y recargar datos originales
      this.perfilForm.get('codigo_pais')?.disable();
      this.perfilForm.get('telefono')?.disable();
      this.perfilForm.get('fecha_nacimiento')?.disable();
      this.perfilForm.get('direccion')?.disable();
      this.cargarDatosEnFormulario();
    }
  }

  guardarCambios(): void {
    // Marcar campos como tocados
    const codigoPaisControl = this.perfilForm.get('codigo_pais');
    const telefonoControl = this.perfilForm.get('telefono');
    const fechaNacimientoControl = this.perfilForm.get('fecha_nacimiento');
    const direccionControl = this.perfilForm.get('direccion');

    if (codigoPaisControl) codigoPaisControl.markAsTouched();
    if (telefonoControl) telefonoControl.markAsTouched();
    if (fechaNacimientoControl) fechaNacimientoControl.markAsTouched();
    if (direccionControl) direccionControl.markAsTouched();

    const codigoPais = this.perfilForm.get('codigo_pais')?.value || '+51';
    const numeroTelefono = this.perfilForm.get('telefono')?.value || '';

    const telefonoCompleto = this.autenticacionService.obtenerTelefonoCompleto(codigoPais, numeroTelefono);

    // Validar longitud específica del país
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

    this.cargando = true;

    const datosActualizar: any = {
      telefono: telefonoCompleto,
      fecha_nacimiento: this.perfilForm.get('fecha_nacimiento')?.value || null,
      direccion: this.perfilForm.get('direccion')?.value || null,
    };

    console.log('Enviando actualización:', datosActualizar);

    this.usuariosService.actualizarPerfil(datosActualizar).subscribe({
      next: (respuesta) => {
        console.log('Respuesta del servidor:', respuesta);
        this.notificaciones.mostrarExito(respuesta.mensaje || 'Perfil actualizado correctamente');

        // Actualizar usuario local con los datos del servidor
        if (respuesta.datos) {
          this.usuario = respuesta.datos;
          this.autenticacionService.actualizarUsuarioLocal(this.usuario);
          console.log('Usuario actualizado localmente:', this.usuario);
        }

        this.editando = false;
        this.perfilForm.get('codigo_pais')?.disable();
        this.perfilForm.get('telefono')?.disable();
        this.perfilForm.get('fecha_nacimiento')?.disable();
        this.perfilForm.get('direccion')?.disable();

        // Recargar perfil desde el servidor para asegurar sincronización
        this.cargarPerfilDesdeServidor();

        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al actualizar:', error);
        this.notificaciones.mostrarError(
          error.error?.detail || 'Error al actualizar el perfil'
        );
        this.cargando = false;
      }
    });
  }

  cambiarPassword(): void {
    if (this.passwordForm.invalid) {
      Object.keys(this.passwordForm.controls).forEach(key => {
        this.passwordForm.controls[key].markAsTouched();
      });
      return;
    }

    this.cargando = true;

    const datos = {
      password_actual: this.passwordForm.get('password_actual')?.value,
      password_nueva: this.passwordForm.get('password_nueva')?.value
    };

    this.usuariosService.cambiarPassword(datos).subscribe({
      next: () => {
        this.notificaciones.mostrarExito('Contraseña actualizada correctamente');
        this.cambiandoPassword = false;
        this.passwordForm.reset();
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  toggleCambiarPassword(): void {
    this.cambiandoPassword = !this.cambiandoPassword;
    if (!this.cambiandoPassword) {
      this.passwordForm.reset();
    }
  }

  get iniciales(): string {
    if (!this.usuario) return '';
    const nombres = this.usuario.nombres?.charAt(0) || '';
    const apellidoPaterno = this.usuario.apellido_paterno?.charAt(0) || '';
    return (nombres + apellidoPaterno).toUpperCase();
  }

  get documentoLabel(): string {
    if (!this.usuario) return 'Documento';
    return this.usuario.tipo_usuario === 'extranjero' ? 'Pasaporte' : 'DNI'; // Cambiado
  }

  get telefonoFormateado(): string {
    if (!this.usuario?.telefono) return 'No especificado';
    return this.autenticacionService.formatearTelefono(this.usuario.telefono);
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
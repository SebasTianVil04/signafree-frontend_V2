import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacionService } from '../../../servicios/autenticacion.service';
import { ApiPeruService } from '../../../servicios/api-peru.service';
import { NotificacionesService } from '../../../servicios/notificaciones.service';
import { ValidadoresPersonalizados } from '../../../utilidades/validadores';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import type { Instance } from 'flatpickr/dist/types/instance';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
  standalone: false
})
export class RegistroComponent implements OnInit, AfterViewInit, OnDestroy {
  registroForm!: FormGroup;
  nacionalidad: 'peruano' | 'extranjero' = 'peruano';
  edadPeruano: 'mayor' | 'menor' = 'mayor';
  tipoUsuario: 'peruano_mayor' | 'peruano_menor' | 'extranjero' = 'peruano_mayor';
  cargando = false;
  cargandoDni = false;
  mostrarPassword = false;
  mostrarConfirmarPassword = false;
  dniVerificado = false;

  private flatpickrInstance?: Instance | Instance[];

  private readonly EDAD_MINIMA = 6;
  private readonly EDAD_MAYORIA = 18;

  // Códigos de país con longitudes específicas
  codigosPais = [
    { codigo: '+51', pais: 'Perú', flag: '🇵🇪', longitud: 9 },
    { codigo: '+1', pais: 'Estados Unidos', flag: '🇺🇸', longitud: 10 },
    { codigo: '+34', pais: 'España', flag: '🇪🇸', longitud: 9 },
    { codigo: '+54', pais: 'Argentina', flag: '🇦🇷', longitud: 10 },
    { codigo: '+56', pais: 'Chile', flag: '🇨🇱', longitud: 9 },
    { codigo: '+57', pais: 'Colombia', flag: '🇨🇴', longitud: 10 },
    { codigo: '+52', pais: 'México', flag: '🇲🇽', longitud: 10 },
    { codigo: '+55', pais: 'Brasil', flag: '🇧🇷', longitud: 11 },
    { codigo: '+593', pais: 'Ecuador', flag: '🇪🇨', longitud: 9 },
    { codigo: '+58', pais: 'Venezuela', flag: '🇻🇪', longitud: 10 }
  ];

  maxLongitudTelefono = 9; 

  constructor(
    private fb: FormBuilder,
    private autenticacionService: AutenticacionService,
    private apiPeruService: ApiPeruService,
    private notificaciones: NotificacionesService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.inicializarFormulario();
  }

  ngAfterViewInit(): void {
    const fechaMinima = new Date();
    fechaMinima.setFullYear(fechaMinima.getFullYear() - this.EDAD_MINIMA);

    this.flatpickrInstance = flatpickr("#fecha_nacimiento", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      locale: Spanish,
      allowInput: true,
      maxDate: fechaMinima, 
      minDate: new Date(1900, 0, 1),
      onChange: (selectedDates, dateStr) => {
        this.registroForm.get('fecha_nacimiento')?.setValue(dateStr);
        this.registroForm.get('fecha_nacimiento')?.markAsTouched();
        setTimeout(() => this.verificarEdadCoincide(), 100);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.flatpickrInstance) {
      if (Array.isArray(this.flatpickrInstance)) {
        this.flatpickrInstance.forEach(instance => instance.destroy());
      } else {
        this.flatpickrInstance.destroy();
      }
    }
  }

  inicializarFormulario(): void {
    this.registroForm = this.fb.group({
      nacionalidad: ['peruano', Validators.required],
      edad_peruano: ['mayor', Validators.required],
      dni: [''],
      pasaporte: [''], 
      nombres: ['', Validators.required],
      apellidos: ['', Validators.required],
      email: ['', [Validators.required, ValidadoresPersonalizados.validarEmail()]],
      codigo_pais: ['+51', Validators.required],
      telefono: [''],
      fecha_nacimiento: ['', [Validators.required]],
      direccion: [''],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        ValidadoresPersonalizados.validarFortalezaPassword()
      ]],
      confirmar_password: ['', Validators.required]
    }, {
      validators: ValidadoresPersonalizados.validarPasswordsIguales('password', 'confirmar_password')
    });

    this.registroForm.get('fecha_nacimiento')?.setValidators([
      Validators.required,
      this.validarEdadSegunTipo.bind(this)
    ]);

    // Escuchar cambios en código de país
    this.registroForm.get('codigo_pais')?.valueChanges.subscribe(() => {
      this.actualizarMaxLongitudTelefono();
    });

    this.registroForm.get('nacionalidad')?.valueChanges.subscribe(nacionalidad => {
      this.nacionalidad = nacionalidad;
      this.actualizarTipoUsuario();
      if (nacionalidad === 'peruano') {
        this.registroForm.get('codigo_pais')?.setValue('+51');
      }
    });

    this.registroForm.get('edad_peruano')?.valueChanges.subscribe(edad => {
      this.edadPeruano = edad;
      this.actualizarTipoUsuario();
      setTimeout(() => {
        const fechaControl = this.registroForm.get('fecha_nacimiento');
        if (fechaControl?.value) {
          fechaControl.updateValueAndValidity();
          this.verificarEdadCoincide();
        }
      }, 100);
    });

    this.registroForm.get('fecha_nacimiento')?.valueChanges.subscribe(() => {
      setTimeout(() => this.verificarEdadCoincide(), 100);
    });

    this.actualizarTipoUsuario();
  }

  actualizarMaxLongitudTelefono(): void {
    const codigoPais = this.registroForm.get('codigo_pais')?.value;
    const pais = this.codigosPais.find(p => p.codigo === codigoPais);
    this.maxLongitudTelefono = pais?.longitud || 15;

    // Limpiar teléfono si excede la nueva longitud
    const telefonoActual = this.registroForm.get('telefono')?.value || '';
    if (telefonoActual.length > this.maxLongitudTelefono) {
      this.registroForm.get('telefono')?.setValue(
        telefonoActual.substring(0, this.maxLongitudTelefono)
      );
    }
  }

  validarSoloNumeros(event: any): void {
    const input = event.target;
    const valor = input.value;
    const soloNumeros = valor.replace(/\D/g, '');
    if (valor !== soloNumeros) {
      input.value = soloNumeros;
      this.registroForm.get('telefono')?.setValue(soloNumeros);
    }
  }

  actualizarTipoUsuario(): void {
    if (this.nacionalidad === 'peruano') {
      this.tipoUsuario = this.edadPeruano === 'mayor' ? 'peruano_mayor' : 'peruano_menor';
    } else {
      this.tipoUsuario = 'extranjero';
    }
    this.actualizarValidacionesPorTipo(this.tipoUsuario);
  }

  actualizarValidacionesPorTipo(tipo: string): void {
    const dniControl = this.registroForm.get('dni');
    const pasaporteControl = this.registroForm.get('pasaporte');
    const nombresControl = this.registroForm.get('nombres');
    const apellidosControl = this.registroForm.get('apellidos');
    const fechaNacimientoControl = this.registroForm.get('fecha_nacimiento');

    dniControl?.clearValidators();
    pasaporteControl?.clearValidators();
    dniControl?.setValue('');
    pasaporteControl?.setValue('');

    if (tipo === 'peruano_mayor') {
      dniControl?.setValidators([Validators.required, ValidadoresPersonalizados.validarDni()]);
      nombresControl?.disable();
      apellidosControl?.disable();
      nombresControl?.setValue('');
      apellidosControl?.setValue('');
      this.dniVerificado = false;
    } else if (tipo === 'peruano_menor') {
      dniControl?.setValidators([ValidadoresPersonalizados.validarDni()]);
      nombresControl?.enable();
      apellidosControl?.enable();
      this.dniVerificado = true;
    } else if (tipo === 'extranjero') {
      pasaporteControl?.setValidators([
        Validators.required, 
        Validators.minLength(6),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Z0-9\-\s]+$/i)
      ]);
      nombresControl?.enable();
      apellidosControl?.enable();
      this.dniVerificado = true;
    }

    dniControl?.updateValueAndValidity();
    pasaporteControl?.updateValueAndValidity();

    if (fechaNacimientoControl?.value) {
      fechaNacimientoControl.updateValueAndValidity();
    }
  }


  validarEdadSegunTipo(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const fechaNacimiento = new Date(control.value);
    if (isNaN(fechaNacimiento.getTime())) return null;

    const edad = this.calcularEdad(control.value);

    if (edad < this.EDAD_MINIMA) {
      return { 
        edadMinima: true, 
        mensaje: `Debes tener al menos ${this.EDAD_MINIMA} años para registrarte` 
      };
    }

    // Validación según tipo de usuario
    if (this.tipoUsuario === 'peruano_menor' && edad >= this.EDAD_MAYORIA) {
      return { 
        edadNoCoincide: true, 
        mensaje: `Debe ser menor de ${this.EDAD_MAYORIA} años (tienes ${edad} años)` 
      };
    }

    if (this.tipoUsuario === 'peruano_mayor' && edad < this.EDAD_MAYORIA) {
      return { 
        edadNoCoincide: true, 
        mensaje: `Debe ser mayor de ${this.EDAD_MAYORIA} años (tienes ${edad} años)` 
      };
    }

    if (this.tipoUsuario === 'extranjero' && edad < this.EDAD_MAYORIA) {
      return { 
        edadNoCoincide: true, 
        mensaje: `Los extranjeros deben ser mayores de ${this.EDAD_MAYORIA} años (tienes ${edad} años)` 
      };
    }

    return null;
  }

  calcularEdad(fechaNacimiento: string): number {
    const fecha = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const mesActual = hoy.getMonth();
    const mesNacimiento = fecha.getMonth();

    if (mesActual < mesNacimiento ||
      (mesActual === mesNacimiento && hoy.getDate() < fecha.getDate())) {
      edad--;
    }

    return edad;
  }


  verificarEdadCoincide(): void {
    const fechaControl = this.registroForm.get('fecha_nacimiento');
    if (!fechaControl?.value) return;

    const edad = this.calcularEdad(fechaControl.value);

    // Validación de edad mínima
    if (edad < this.EDAD_MINIMA) {
      this.notificaciones.mostrarError(
        `Lo sentimos, debes tener al menos ${this.EDAD_MINIMA} años para usar SignaFree.`
      );
      return;
    }

    // Validaciones según tipo de usuario
    if (fechaControl.errors?.['edadNoCoincide']) {
      if (this.tipoUsuario === 'peruano_menor') {
        this.notificaciones.mostrarAdvertencia(
          `Tienes ${edad} años. Por favor, selecciona "Mayor de Edad" o corrige tu fecha de nacimiento.`
        );
      } else if (this.tipoUsuario === 'peruano_mayor') {
        this.notificaciones.mostrarAdvertencia(
          `Tienes ${edad} años. Por favor, selecciona "Menor de Edad" o corrige tu fecha de nacimiento.`
        );
      } else if (this.tipoUsuario === 'extranjero') {
        this.notificaciones.mostrarAdvertencia(
          `Tienes ${edad} años. Los extranjeros deben ser mayores de ${this.EDAD_MAYORIA} años.`
        );
      }
    }
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

  get f() {
    return this.registroForm.controls;
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  toggleMostrarConfirmarPassword(): void {
    this.mostrarConfirmarPassword = !this.mostrarConfirmarPassword;
  }

  verificarDni(): void {
    const dni = this.f['dni'].value;

    if (!dni || this.f['dni'].invalid) {
      this.notificaciones.mostrarError('Por favor, ingrese un DNI válido');
      return;
    }

    this.cargandoDni = true;
    this.dniVerificado = false;

    this.apiPeruService.obtenerDatosPorDni(dni).subscribe({
      next: (datos) => {
        const apellidosCompletos = `${datos.apellidoPaterno} ${datos.apellidoMaterno}`;

        this.registroForm.patchValue({
          nombres: datos.nombres,
          apellidos: apellidosCompletos
        });

        this.f['nombres'].enable();
        this.f['apellidos'].enable();

        this.dniVerificado = true;
        this.cargandoDni = false;
        this.notificaciones.mostrarExito('DNI verificado correctamente');
      },
      error: (error) => {
        this.notificaciones.mostrarError('No se pudo verificar el DNI. Verifique el número ingresado.');
        this.cargandoDni = false;
      }
    });
  }

  onSubmit(): void {
    Object.keys(this.registroForm.controls).forEach(key => {
      this.registroForm.controls[key].markAsTouched();
    });

    if (this.registroForm.invalid) {
      const fechaControl = this.registroForm.get('fecha_nacimiento');
      if (fechaControl?.errors?.['edadMinima']) {
        this.notificaciones.mostrarError(
          `Debes tener al menos ${this.EDAD_MINIMA} años para registrarte en SignaFree`
        );
        return;
      }

      this.notificaciones.mostrarAdvertencia('Por favor completa todos los campos requeridos correctamente');
      return;
    }

    if (this.tipoUsuario === 'peruano_mayor' && !this.dniVerificado) {
      this.notificaciones.mostrarAdvertencia('Por favor, verifique su DNI primero');
      return;
    }

    // Validar longitud de teléfono si se proporcionó
    const telefono = this.registroForm.get('telefono')?.value;
    if (telefono && telefono.trim() !== '') {
      const codigoPais = this.registroForm.get('codigo_pais')?.value;
      const pais = this.codigosPais.find(p => p.codigo === codigoPais);
      const soloNumeros = telefono.replace(/\D/g, '');

      if (pais && soloNumeros.length !== pais.longitud) {
        this.notificaciones.mostrarAdvertencia(
          `El teléfono para ${pais.pais} debe tener exactamente ${pais.longitud} dígitos`
        );
        return;
      }
    }

    this.cargando = true;

    const formData = this.registroForm.getRawValue();
    const apellidosArray = formData.apellidos.trim().split(/\s+/);

    let fechaNacimientoISO = null;
    if (formData.fecha_nacimiento) {
      const fecha = new Date(formData.fecha_nacimiento);

      if (isNaN(fecha.getTime())) {
        this.notificaciones.mostrarError('La fecha de nacimiento no es válida.');
        this.cargando = false;
        return;
      }

      fechaNacimientoISO = fecha.toISOString().split('T')[0];
    }

    const telefonoCompleto = formData.telefono && formData.telefono.trim() !== ''
      ? `${formData.codigo_pais}${formData.telefono.replace(/\D/g, '')}`
      : null;

    const datosRegistro = {
      tipo_usuario: this.tipoUsuario,
      email: formData.email.toLowerCase().trim(),
      password: formData.password,
      dni: this.tipoUsuario !== 'extranjero' ? (formData.dni || null) : null,
      pasaporte: this.tipoUsuario === 'extranjero' ? formData.pasaporte : null,
      nombres: formData.nombres.trim(),
      apellido_paterno: apellidosArray[0] || '',
      apellido_materno: apellidosArray[1] || '',
      telefono: telefonoCompleto,
      fecha_nacimiento: fechaNacimientoISO,
      direccion: formData.direccion || null
    };

    console.log('Datos a enviar:', datosRegistro);

    this.autenticacionService.registro(datosRegistro).subscribe({
      next: (respuesta) => {
        console.log('Registro exitoso:', respuesta);
        this.notificaciones.mostrarExito('Registro exitoso. Bienvenido a SignaFree');
        this.router.navigate(['/inicio']);
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error en registro:', error);
        this.cargando = false;
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }

  deberaMostrarHelpTextTelefono(): boolean {
    const telefonoControl = this.registroForm.get('telefono');

    if (!telefonoControl) {
      return false;
    }

    const telefono = telefonoControl.value;
    const touched = telefonoControl.touched;

    if (!touched) {
      return false;
    }

    if (!telefono || telefono.trim() === '') {
      return false;
    }

    const soloNumeros = telefono.replace(/\D/g, '');

    return soloNumeros.length > 0 && soloNumeros.length !== this.maxLongitudTelefono;
  }
}
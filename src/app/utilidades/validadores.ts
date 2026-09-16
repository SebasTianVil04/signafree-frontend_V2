import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class ValidadoresPersonalizados {
  
  // Validar DNI peruano (8 dígitos)
  static validarDni(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const dniValido = /^\d{8}$/.test(control.value);
      return dniValido ? null : { dniInvalido: true };
    };
  }

  // Validar que las contraseñas coincidan
  static validarPasswordsIguales(passwordField: string, confirmarPasswordField: string): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const password = formGroup.get(passwordField)?.value;
      const confirmarPassword = formGroup.get(confirmarPasswordField)?.value;

      if (!password || !confirmarPassword) {
        return null;
      }

      return password === confirmarPassword ? null : { passwordsNoCoinciden: true };
    };
  }

  // Validar fortaleza de contraseña
  static validarFortalezaPassword(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const password = control.value;
      const errors: ValidationErrors = {};

      // Mínimo 8 caracteres
      if (password.length < 8) {
        errors['longitudMinima'] = true;
      }

      // Al menos una mayúscula
      if (!/[A-Z]/.test(password)) {
        errors['faltaMayuscula'] = true;
      }

      // Al menos una minúscula
      if (!/[a-z]/.test(password)) {
        errors['faltaMinuscula'] = true;
      }

      // Al menos un número
      if (!/\d/.test(password)) {
        errors['faltaNumero'] = true;
      }

      return Object.keys(errors).length > 0 ? errors : null;
    };
  }

  // Validar email
  static validarEmail(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const emailValido = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(control.value);
      return emailValido ? null : { emailInvalido: true };
    };
  }

  // Validar teléfono peruano (9 dígitos, empieza con 9)
  static validarTelefono(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const telefonoValido = /^9\d{8}$/.test(control.value);
      return telefonoValido ? null : { telefonoInvalido: true };
    };
  }

  // Validar fecha de nacimiento (mayor de edad)
  static validarMayorEdad(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const fechaNacimiento = new Date(control.value);
      const hoy = new Date();
      let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
      const mes = hoy.getMonth() - fechaNacimiento.getMonth();

      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
        edad--;
      }

      return edad >= 18 ? null : { menorDeEdad: true };
    };
  }
}
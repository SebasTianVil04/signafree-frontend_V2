import { Component } from '@angular/core';

interface RedSocial {
  nombre: string;
  icono: string;
  url: string;
}

interface Enlace {
  nombre: string;
  url: string;
}

interface GrupoEnlaces {
  recursos: Enlace[];
  soporte: Enlace[];
  legal: Enlace[];
}

@Component({
  selector: 'app-pie-pagina',
  templateUrl: './pie-pagina.component.html',
  styleUrls: ['./pie-pagina.component.scss'],
  standalone: false
})
export class PiePaginaComponent {
  readonly anioActual: number = new Date().getFullYear();

  readonly redesSociales: RedSocial[] = [
    { nombre: 'Facebook', icono: '📘', url: '#' },
    { nombre: 'Twitter', icono: '🐦', url: '#' },
    { nombre: 'Instagram', icono: '📷', url: '#' },
    { nombre: 'YouTube', icono: '📺', url: '#' }
  ];

  readonly enlaces: GrupoEnlaces = {
    recursos: [
      { nombre: 'Diccionario LSP', url: '#' },
      { nombre: 'Guía de Aprendizaje', url: '#' },
      { nombre: 'Videos Tutoriales', url: '#' },
      { nombre: 'Blog', url: '#' }
    ],
    soporte: [
      { nombre: 'Centro de Ayuda', url: '#' },
      { nombre: 'Preguntas Frecuentes', url: '#' },
      { nombre: 'Contacto', url: '#' },
      { nombre: 'Reportar Problema', url: '#' }
    ],
    legal: [
      { nombre: 'Términos y Condiciones', url: '#' },
      { nombre: 'Política de Privacidad', url: '#' },
      { nombre: 'Cookies', url: '#' },
      { nombre: 'Accesibilidad', url: '#' }
    ]
  };
}
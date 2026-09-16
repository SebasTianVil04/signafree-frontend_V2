import { Component, EventEmitter, Input, Output } from '@angular/core';

export const ICONOS_DISPONIBLES: string[] = [
  'fa-hand-paper', 'fa-hand-point-right', 'fa-hand-peace', 'fa-hand-scissors',
  'fa-hands', 'fa-sign-language', 'fa-deaf', 'fa-comments',
  'fa-font', 'fa-language', 'fa-book', 'fa-book-open',
  'fa-graduation-cap', 'fa-pencil-alt', 'fa-chalkboard-teacher',
  'fa-star', 'fa-heart', 'fa-smile', 'fa-child',
  'fa-users', 'fa-user-friends', 'fa-home', 'fa-utensils',
  'fa-tint', 'fa-first-aid', 'fa-hospital', 'fa-ambulance',
  'fa-exclamation-triangle', 'fa-shield-alt', 'fa-lock',
  'fa-list-ol', 'fa-hashtag', 'fa-calculator',
  'fa-palette', 'fa-paint-brush', 'fa-sun', 'fa-cloud',
  'fa-tree', 'fa-paw', 'fa-car', 'fa-plane',
  'fa-gamepad', 'fa-music', 'fa-film', 'fa-camera',
  'fa-map-marker-alt', 'fa-globe', 'fa-flag', 'fa-thumbs-up'
];

@Component({
  selector: 'app-icon-picker',
  templateUrl: './icon-picker.component.html',
  styleUrls: ['./icon-picker.component.scss'],
  standalone: false
})
export class IconPickerComponent {
  @Input() iconoSeleccionado: string = '';
  @Output() iconoSeleccionadoChange = new EventEmitter<string>();

  abierto: boolean = false;
  filtro: string = '';
  iconos: string[] = ICONOS_DISPONIBLES;

  get iconosFiltrados(): string[] {
    if (!this.filtro.trim()) return this.iconos;
    const termino = this.filtro.trim().toLowerCase().replace(/\s+/g, '-');
    return this.iconos.filter(icono => icono.includes(termino));
  }

  toggleAbierto(): void {
    this.abierto = !this.abierto;
  }

  seleccionar(icono: string): void {
    this.iconoSeleccionado = icono;
    this.iconoSeleccionadoChange.emit(icono);
    this.abierto = false;
    this.filtro = '';
  }

  quitarIcono(): void {
    this.iconoSeleccionado = '';
    this.iconoSeleccionadoChange.emit('');
  }
}
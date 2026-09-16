import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AutenticacionService } from '../../servicios/autenticacion.service';
import { Usuario } from '../../modelos/usuario.model';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss'],
  standalone: false 
})
export class InicioComponent implements OnInit {
  usuario: Usuario | null = null;

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
   this.usuario = this.autenticacionService.usuarioActualValor;
  }

  cerrarSesion(): void {
    this.autenticacionService.logout();
  }
}
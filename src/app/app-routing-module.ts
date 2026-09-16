import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './paginas/autenticacion/login/login.component';
import { RegistroComponent } from './paginas/autenticacion/registro/registro.component';

import { InicioComponent } from './paginas/inicio/inicio.component';
import { PerfilComponent } from './paginas/usuario/perfil/perfil.component';
import { ProgresoComponent } from './paginas/usuario/progreso/progreso.component';
import { OlvidasteContrasenaComponent } from './paginas/usuario/olvidaste-contrasena/olvidaste-contrasena.component';
import { RestablecerContrasenaComponent } from './paginas/usuario/restablecer-contrasena/restablecer-contrasena.component';

import { ListaLeccionesComponent } from './paginas/lecciones/lista-lecciones/lista-lecciones.component';
import { DetalleLeccionComponent } from './paginas/lecciones/detalle-leccion/detalle-leccion.component';
import { PracticaLeccionComponent } from './paginas/lecciones/practica-leccion/practica-leccion.component';
import { ClaseVistaComponent } from './paginas/lecciones/clase-vista/clase-vista.component';

import { ListaExamenesComponent } from './paginas/examenes/lista-examenes/lista-examenes.component';
import { TomarExamenComponent } from './paginas/examenes/tomar-examen/tomar-examen.component';
import { ResultadosExamenComponent } from './paginas/examenes/resultados-examen/resultados-examen.component';

import { PanelAdminComponent } from './paginas/admin/panel-admin/panel-admin.component';
import { GestionUsuariosComponent } from './paginas/admin/gestion-usuarios/gestion-usuarios.component';
import { GestionLeccionesComponent } from './paginas/admin/gestion-lecciones/gestion-lecciones.component';
import { EstadisticasAdminComponent } from './paginas/admin/estadisticas-admin/estadisticas-admin.component';
import { EntrenamientoModeloComponent } from './paginas/admin/entrenamiento-modelo/entrenamiento-modelo.component';
import { TraductorComponent } from './paginas/traductor/traductor.component';
import { GestionImagenesDatasetComponent } from './paginas/admin/gestion-imagenes-dataset/gestion-imagenes-dataset.component';
import { GestionClasesComponent } from './paginas/admin/gestion-clases/gestion-clases.component';
import { GestionExamenesComponent } from './paginas/admin/gestion-examenes/gestion-examenes.component';
import { GestionPreguntasComponent } from './paginas/admin/gestion-preguntas/gestion-preguntas.component';
import { DetalleExamenComponent } from './paginas/admin/detalle-examen/detalle-examen.component';
import { GestionCategoriasComponent } from './paginas/admin/gestion-categorias/gestion-categorias.component';
import { CapturaUnificadaComponent } from './paginas/admin/captura-unificada/captura-unificada.component';

import { AuthGuard } from './guardias/auth.guard';
import { NoAuthGuard } from './guardias/no-auth.guard';
import { AdminGuard } from './guardias/admin.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [NoAuthGuard],
    data: { title: 'Iniciar Sesión' }
  },
  {
    path: 'registro',
    component: RegistroComponent,
    canActivate: [NoAuthGuard],
    data: { title: 'Registro' }
  },
  {
    path: 'olvide-contrasena',
    component: OlvidasteContrasenaComponent,
    canActivate: [NoAuthGuard],
    data: { title: 'Recuperar Contraseña' }
  },
  {
    path: 'restablecer-contrasena/:token',
    component: RestablecerContrasenaComponent,
    canActivate: [NoAuthGuard],
    data: { title: 'Restablecer Contraseña' }
  },

  {
    path: 'inicio',
    component: InicioComponent,
    canActivate: [AuthGuard],
    data: { title: 'Inicio' }
  },
  {
    path: 'perfil',
    component: PerfilComponent,
    canActivate: [AuthGuard],
    data: { title: 'Mi Perfil' }
  },
  {
    path: 'progreso',
    component: ProgresoComponent,
    canActivate: [AuthGuard],
    data: { title: 'Mi Progreso' }
  },

  {
    path: 'lecciones',
    children: [
      { path: '', component: ListaLeccionesComponent },
      { path: ':id', component: DetalleLeccionComponent },
      { path: ':id/practica', component: PracticaLeccionComponent },
      { path: ':leccionId/clase/:claseId', component: ClaseVistaComponent }
    ]
  },

  {
    path: 'examenes',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: ListaExamenesComponent, data: { title: 'Exámenes' } },
      { path: ':id/tomar', component: TomarExamenComponent, data: { title: 'Tomar Examen' } },
      { path: ':id/resultados', component: ResultadosExamenComponent, data: { title: 'Resultados del Examen' } }
    ]
  },

  {
    path: 'admin',
    canActivate: [AuthGuard, AdminGuard],
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      { path: 'panel', component: PanelAdminComponent, data: { titulo: 'Panel de Administración' } },
      { path: 'usuarios', component: GestionUsuariosComponent, data: { titulo: 'Gestión de Usuarios' } },
      { path: 'lecciones', component: GestionLeccionesComponent, data: { title: 'Gestión de Lecciones' } },
      { path: 'lecciones/:leccionId/clases', component: GestionClasesComponent },
      { path: 'imagenes', component: GestionImagenesDatasetComponent, data: { title: 'Gestión de Imágenes' } },
      { path: 'entrenamiento', component: EntrenamientoModeloComponent, data: { title: 'Entrenamiento del Modelo' } },
      { path: 'estadisticas', component: EstadisticasAdminComponent, data: { title: 'Estadísticas' } },
      { path: 'traductor', component: TraductorComponent, data: { title: 'Traductor' } },
      { path: 'captura-unificada', component: CapturaUnificadaComponent },
      { path: 'categorias', component: GestionCategoriasComponent },
      { path: 'examenes', component: GestionExamenesComponent },
      { path: 'examenes/crear', component: GestionExamenesComponent },
      { path: 'examenes/:id', component: DetalleExamenComponent },
      { path: 'examenes/:id/editar', component: GestionExamenesComponent },
      { path: 'examenes/:id/preguntas', component: GestionPreguntasComponent }
    ]
  },

  {
    path: '**',
    redirectTo: '/login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'top',
      useHash: false
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
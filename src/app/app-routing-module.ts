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
import { GestionRolesComponent } from './paginas/admin/gestion-roles/gestion-roles.component';
import { GestionMenuComponent } from './paginas/admin/gestion-menu/gestion-menu.component';

import { AuthGuard } from './guardias/auth.guard';
import { NoAuthGuard } from './guardias/no-auth.guard';
import { PermisoGuard } from './guardias/permiso.guard';

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
    canActivate: [AuthGuard, PermisoGuard],
    data: { title: 'Mi Perfil', permiso: 'usuarios.ver_perfil' }
  },
  {
    path: 'progreso',
    component: ProgresoComponent,
    canActivate: [AuthGuard, PermisoGuard],
    data: { title: 'Mi Progreso', permiso: 'usuarios.ver_progreso' }
  },

  {
    path: 'lecciones',
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        component: ListaLeccionesComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'lecciones.ver' }
      },
      {
        path: ':id',
        component: DetalleLeccionComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'lecciones.ver' }
      },
      {
        path: ':id/practica',
        component: PracticaLeccionComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'practicas.registrar' }
      },
      {
        path: ':leccionId/clase/:claseId',
        component: ClaseVistaComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'lecciones.ver' }
      }
    ]
  },

  {
    path: 'examenes',
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        component: ListaExamenesComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Exámenes', permiso: 'examenes.ver' }
      },
      {
        path: ':id/tomar',
        component: TomarExamenComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Tomar Examen', permiso: 'examenes.ver' }
      },
      {
        path: ':id/resultados',
        component: ResultadosExamenComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Resultados del Examen', permiso: 'examenes.ver' }
      }
    ]
  },

  {
    path: 'admin',
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },

      {
        path: 'panel',
        component: PanelAdminComponent,
        canActivate: [PermisoGuard],
        data: { titulo: 'Panel de Administración', permiso: 'admin.dashboard.ver' }
      },
      {
        path: 'usuarios',
        component: GestionUsuariosComponent,
        canActivate: [PermisoGuard],
        data: { titulo: 'Gestión de Usuarios', permiso: 'admin.usuarios.listar' }
      },
      {
        path: 'roles',
        component: GestionRolesComponent,
        canActivate: [PermisoGuard],
        data: { titulo: 'Gestión de Roles', permiso: 'admin.roles.gestionar' }
      },
      {
        path: 'menu',
        component: GestionMenuComponent,
        canActivate: [PermisoGuard],
        data: { titulo: 'Gestión de Menú', permiso: 'admin.menu.gestionar' }
      },
      {
        path: 'lecciones',
        component: GestionLeccionesComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Gestión de Lecciones', permiso: 'admin.lecciones.gestionar' }
      },
      {
        path: 'lecciones/:leccionId/clases',
        component: GestionClasesComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.lecciones.gestionar' }
      },
      {
        path: 'imagenes',
        component: GestionImagenesDatasetComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Gestión de Imágenes', permiso: 'dataset.gestionar' }
      },
      {
        path: 'entrenamiento',
        component: EntrenamientoModeloComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Entrenamiento del Modelo', permiso: 'modelos.gestionar' }
      },
      {
        path: 'estadisticas',
        component: EstadisticasAdminComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Estadísticas', permiso: 'admin.reportes.ver' }
      },
      {
        path: 'traductor',
        component: TraductorComponent,
        canActivate: [PermisoGuard],
        data: { title: 'Traductor', permiso: 'traductor.usar' }
      },
      {
        path: 'captura-unificada',
        component: CapturaUnificadaComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'captura.gestionar' }
      },
      {
        path: 'categorias',
        component: GestionCategoriasComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.categorias.gestionar' }
      },
      {
        path: 'examenes',
        component: GestionExamenesComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.examenes.gestionar' }
      },
      {
        path: 'examenes/crear',
        component: GestionExamenesComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.examenes.gestionar' }
      },
      {
        path: 'examenes/:id',
        component: DetalleExamenComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.examenes.gestionar' }
      },
      {
        path: 'examenes/:id/editar',
        component: GestionExamenesComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.examenes.gestionar' }
      },
      {
        path: 'examenes/:id/preguntas',
        component: GestionPreguntasComponent,
        canActivate: [PermisoGuard],
        data: { permiso: 'admin.examenes.gestionar' }
      }
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
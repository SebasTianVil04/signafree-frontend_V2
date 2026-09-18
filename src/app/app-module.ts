import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';

import { AppRoutingModule } from './app-routing-module';

import { App } from './app';

import { LoginComponent } from './paginas/autenticacion/login/login.component';
import { RegistroComponent } from './paginas/autenticacion/registro/registro.component';
import { InicioComponent } from './paginas/inicio/inicio.component';
import { EncabezadoComponent } from './paginas/compartidos/encabezado/encabezado.component';
import { PiePaginaComponent } from './paginas/compartidos/pie-pagina/pie-pagina.component';
import { NavegacionComponent } from './paginas/compartidos/navegacion/navegacion.component';
import { ModalConfirmacionComponent } from './paginas/compartidos/modal-confirmacion/modal-confirmacion.component';
import { TarjetaProgresoComponent } from './paginas/compartidos/tarjeta-progreso/tarjeta-progreso.component';
import { NotificacionesComponent } from './paginas/compartidos/notificaciones/notificaciones.component';

import { VisualizadorPuntosComponent } from './paginas/reconocimiento/visualizador-puntos/visualizador-puntos.component';
import { ResultadoReconocimientoComponent } from './paginas/reconocimiento/resultado-reconocimiento/resultado-reconocimiento.component';
import { CamaraReconocimientoComponent } from './paginas/reconocimiento/camara-reconocimiento/camara-reconocimiento.component';
import { CamaraReconocimientoExamenComponent } from './paginas/reconocimiento/camara-reconocimiento-examen/camara-reconocimiento-examen.component';

import { GraficoProgresoComponent } from './paginas/graficos/grafico-progreso/grafico-progreso.component';
import { GraficoEstadisticasComponent } from './paginas/graficos/grafico-estadisticas/grafico-estadisticas.component';
import { GraficoCircularComponent } from './paginas/graficos/grafico-circular/grafico-circular.component';

import { ListaLeccionesComponent } from './paginas/lecciones/lista-lecciones/lista-lecciones.component';
import { DetalleLeccionComponent } from './paginas/lecciones/detalle-leccion/detalle-leccion.component';
import { PracticaLeccionComponent } from './paginas/lecciones/practica-leccion/practica-leccion.component';
import { ClaseVistaComponent } from './paginas/lecciones/clase-vista/clase-vista.component';

import { ListaExamenesComponent } from './paginas/examenes/lista-examenes/lista-examenes.component';
import { TomarExamenComponent } from './paginas/examenes/tomar-examen/tomar-examen.component';
import { ResultadosExamenComponent } from './paginas/examenes/resultados-examen/resultados-examen.component';

import { PerfilComponent } from './paginas/usuario/perfil/perfil.component';
import { ProgresoComponent } from './paginas/usuario/progreso/progreso.component';
import { CertificadosComponent } from './paginas/usuario/certificados/certificados.component';
import { OlvidasteContrasenaComponent } from './paginas/usuario/olvidaste-contrasena/olvidaste-contrasena.component';
import { RestablecerContrasenaComponent } from './paginas/usuario/restablecer-contrasena/restablecer-contrasena.component';

import { PanelAdminComponent } from './paginas/admin/panel-admin/panel-admin.component';
import { GestionUsuariosComponent } from './paginas/admin/gestion-usuarios/gestion-usuarios.component';
import { GestionLeccionesComponent } from './paginas/admin/gestion-lecciones/gestion-lecciones.component';
import { EntrenamientoModeloComponent } from './paginas/admin/entrenamiento-modelo/entrenamiento-modelo.component';
import { EstadisticasAdminComponent } from './paginas/admin/estadisticas-admin/estadisticas-admin.component';
import { GestionImagenesDatasetComponent } from './paginas/admin/gestion-imagenes-dataset/gestion-imagenes-dataset.component';
import { GestionClasesComponent } from './paginas/admin/gestion-clases/gestion-clases.component';
import { GestionExamenesComponent } from './paginas/admin/gestion-examenes/gestion-examenes.component';
import { GestionPreguntasComponent } from './paginas/admin/gestion-preguntas/gestion-preguntas.component';
import { DetalleExamenComponent } from './paginas/admin/detalle-examen/detalle-examen.component';
import { GestionCategoriasComponent } from './paginas/admin/gestion-categorias/gestion-categorias.component';
import { CapturaUnificadaComponent } from './paginas/admin/captura-unificada/captura-unificada.component';
import { GestionRolesComponent } from './paginas/admin/gestion-roles/gestion-roles.component';

import { TraductorComponent } from './paginas/traductor/traductor.component';

import { SafePipe } from './pipes/safe.pipe';
import { TienePermisoDirective } from './directivas/tiene-permiso.directive';

import { AuthInterceptor } from './interceptores/auth.interceptor';
import { ErrorInterceptor } from './interceptores/error.interceptor';
import { LoadingInterceptor } from './interceptores/loading.interceptor';

import { AuthGuard } from './guardias/auth.guard';
import { NoAuthGuard } from './guardias/no-auth.guard';

import { TraductorService } from './servicios/traductor.service';
import { HandDetectionService } from './servicios/hand-detection.service';
import { RecursosSenasService } from './servicios/recursos-senas.service';
import { ClasesService } from './servicios/clase.service';
import { LeccionesService } from './servicios/lecciones.service';
import { NotificacionesService } from './servicios/notificaciones.service';
import { BrowserModule } from '@angular/platform-browser';
import { IconPickerComponent } from './componentes/icon-picker/icon-picker.component';
import { GestionMenuComponent } from './paginas/admin/gestion-menu/gestion-menu.component';

@NgModule({
  declarations: [
    App,
    LoginComponent,
    RegistroComponent,
    InicioComponent,
    EncabezadoComponent,
    PiePaginaComponent,
    NavegacionComponent,
    ModalConfirmacionComponent,
    TarjetaProgresoComponent,
    VisualizadorPuntosComponent,
    ResultadoReconocimientoComponent,
    GraficoProgresoComponent,
    GraficoEstadisticasComponent,
    GraficoCircularComponent,
    ListaLeccionesComponent,
    DetalleLeccionComponent,
    PracticaLeccionComponent,
    ListaExamenesComponent,
    TomarExamenComponent,
    ResultadosExamenComponent,
    PerfilComponent,
    ProgresoComponent,
    CertificadosComponent,
    PanelAdminComponent,
    GestionUsuariosComponent,
    GestionLeccionesComponent,
    EntrenamientoModeloComponent,
    EstadisticasAdminComponent,
    OlvidasteContrasenaComponent,
    RestablecerContrasenaComponent,
    TraductorComponent,
    GestionImagenesDatasetComponent,
    GestionClasesComponent,
    ClaseVistaComponent,
    CamaraReconocimientoComponent,
    NotificacionesComponent,
    SafePipe,
    GestionExamenesComponent,
    GestionPreguntasComponent,
    DetalleExamenComponent,
    GestionCategoriasComponent,
    CapturaUnificadaComponent,
    CamaraReconocimientoExamenComponent,
    IconPickerComponent,
    GestionRolesComponent,
    GestionMenuComponent,
    TienePermisoDirective
  ],
  imports: [
    BrowserModule,
    CommonModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [
    TraductorService,
    HandDetectionService,
    ClasesService,
    LeccionesService,
    NotificacionesService,
    RecursosSenasService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    AuthGuard,
    NoAuthGuard,
    provideTanStackQuery(new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000 }
      }
    }))
  ],
  bootstrap: [App]
})
export class AppModule { }
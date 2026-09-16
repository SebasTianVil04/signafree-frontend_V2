import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { forkJoin, firstValueFrom } from 'rxjs';
import { Clase, LeccionesService } from '../../../servicios/lecciones.service';
import { ProgresoService } from '../../../servicios/progreso.service';
import { CategoriaDB, Leccion } from '../../../modelos/leccion.model';

@Component({
  selector: 'app-detalle-leccion',
  templateUrl: './detalle-leccion.component.html',
  styleUrls: ['./detalle-leccion.component.scss'],
  standalone: false
})
export class DetalleLeccionComponent implements OnInit {
  leccion: Leccion | null = null;
  clases: Clase[] = [];

  cargando = true;
  error: string | null = null;
  leccionAnteriorCompleta: boolean = false;
  verificandoProgreso: boolean = true;

  tabActiva: 'info' | 'clases' | 'progreso' = 'clases';

  categoriasQuery = injectQuery(() => ({
    queryKey: ['categorias'],
    queryFn: () => firstValueFrom(this.leccionesService.obtenerCategorias(true)),
    staleTime: Infinity,
  }));

  get categorias(): CategoriaDB[] {
    const res = this.categoriasQuery.data();
    return res?.exito && res.datos ? res.datos : [];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private leccionesService: LeccionesService,
    private progresoService: ProgresoService,
    private cdr: ChangeDetectorRef,
    private queryClient: QueryClient
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) {
        this.cargarLeccion(id);
      } else {
        this.error = 'ID de lección inválido';
        this.cargando = false;
        this.verificandoProgreso = false;
      }
    });
  }

  cargarLeccion(id: number): void {
    this.cargando = true;
    this.verificandoProgreso = true;
    this.error = null;

    this.queryClient.fetchQuery({
      queryKey: ['leccion', id],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerLeccion(id)),
      staleTime: Infinity
    }).then(response => {
      if (response.exito && response.datos) {
        this.leccion = { ...response.datos };
        this.verificarProgresoLeccionAnterior(this.leccion);
      } else {
        this.error = response.mensaje || 'Error al cargar la lección';
        this.cargando = false;
        this.verificandoProgreso = false;
      }
    }).catch(err => {
      this.error = err.error?.detail || 'Error al cargar la lección.';
      this.cargando = false;
      this.verificandoProgreso = false;
    });
  }

  verificarProgresoLeccionAnterior(leccion: Leccion): void {
    if (!leccion.leccion_previa_id) {
      this.leccionAnteriorCompleta = true;
      leccion.bloqueada = false;

      this.cargarClases(leccion.id!);
      return;
    }

    this.progresoService.obtenerProgresoLeccion(leccion.leccion_previa_id).subscribe({
      next: (progreso) => {
        this.leccionAnteriorCompleta = progreso.completada;
        leccion.bloqueada = !progreso.completada;

        this.cdr.detectChanges();
        this.cargarClases(leccion.id!);
      },
      error: (err) => {
        this.leccionAnteriorCompleta = false;
        leccion.bloqueada = true;

        this.cdr.detectChanges();
        this.cargarClases(leccion.id!);
      }
    });
  }

  cargarClases(leccionId: number): void {
    this.queryClient.fetchQuery({
      queryKey: ['clases-leccion', leccionId],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerClasesDeLeccion(leccionId)),
      staleTime: Infinity
    }).then(response => {
      if (response.exito && response.datos) {
        this.clases = response.datos
          .filter(clase => clase.activa)
          .sort((a, b) => a.orden - b.orden)
          .map(clase => ({ ...clase }));

        this.cargarProgresoClases();
      } else {
        this.finalizarCarga();
      }
    }).catch(() => {
      this.finalizarCarga();
    });
  }

  cargarProgresoClases(): void {
    if (this.leccion?.bloqueada) {
      this.clases.forEach(clase => {
        (clase as any).bloqueada = true;
        (clase as any).completada = false;
      });
      this.finalizarCarga();
      return;
    }

    const totalClases = this.clases.length;

    if (totalClases === 0) {
      this.finalizarCarga();
      return;
    }

    const observables = this.clases.map(clase =>
      this.progresoService.obtenerProgresoClase(clase.id!)
    );

    forkJoin(observables).subscribe({
      next: (progresos) => {
        progresos.forEach((progreso, index) => {
          (this.clases[index] as any).completada = progreso.completada;

          if (index === 0) {
            (this.clases[index] as any).bloqueada = this.leccion?.bloqueada || false;
          } else {
            (this.clases[index] as any).bloqueada = !(this.clases[index - 1] as any).completada;
          }
        });

        this.finalizarCarga();
      },
      error: (err) => {
        this.clases.forEach((clase, index) => {
          (clase as any).completada = false;
          (clase as any).bloqueada = index > 0;
        });

        this.finalizarCarga();
      }
    });
  }

  finalizarCarga(): void {
    this.cargando = false;
    this.verificandoProgreso = false;

    this.cdr.detectChanges();
  }

  volver(): void {
    this.router.navigate(['/lecciones']);
  }

  obtenerColorNivel(nivel: number): string {
    const colores: Record<number, string> = {
      1: '#4CAF50',
      2: '#FF9800',
      3: '#F44336'
    };
    return colores[nivel] || '#757575';
  }

  obtenerGradienteNivel(nivel: number): string {
    const gradientes: Record<number, string> = {
      1: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      2: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      3: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    };
    return gradientes[nivel] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }

  obtenerEtiquetaNivel(nivel: number): string {
    const mapeo: Record<number, string> = {
      1: 'Principiante',
      2: 'Intermedio',
      3: 'Avanzado'
    };
    return mapeo[nivel] || 'Desconocido';
  }

  cambiarTab(tab: 'info' | 'clases' | 'progreso'): void {
    this.tabActiva = tab;
  }

  iniciarLeccion(): void {
    if (!this.leccion?.id) {
      return;
    }

    if (!this.leccion.activa) {
      alert('Esta lección no está activa actualmente');
      return;
    }

    if (this.leccion.bloqueada) {
      this.mostrarMensajeBloqueo();
      return;
    }

    if (this.clases.length > 0) {
      const primeraClase = this.clases[0];
      this.router.navigate(['/lecciones', this.leccion.id, 'clase', primeraClase.id]);
    } else {
      this.router.navigate(['/lecciones', this.leccion.id, 'practica']);
    }
  }

  comenzarClase(clase: Clase): void {
    const claseBloqueada = (clase as any).bloqueada;

    if (claseBloqueada) {
      if (this.leccion?.bloqueada) {
        this.mostrarMensajeBloqueo();
      } else {
        alert('Debes completar las clases anteriores primero');
      }
      return;
    }

    if (!this.leccion?.id || !clase.id) {
      return;
    }

    this.router.navigate(['/lecciones', this.leccion.id, 'clase', clase.id]);
  }

  mostrarMensajeBloqueo(): void {
    if (this.leccion?.leccion_previa_id) {
      alert(`Debes completar la lección anterior antes de acceder a esta lección.`);
    } else {
      alert('Esta lección está bloqueada. Completa los requisitos necesarios.');
    }
  }

  verClase(clase: Clase): void {
    this.comenzarClase(clase);
  }

  obtenerPorcentajeProgreso(): number {
    if (!this.leccion?.progreso) return 0;
    return this.leccion.progreso.mejor_precision * 100;
  }

  porcentajeClasesCompletadas(): number {
    if (!this.leccion?.progreso) return 0;
    return this.leccion.progreso.porcentaje_completado || 0;
  }

  obtenerColorProgreso(): string {
    const porcentaje = this.obtenerPorcentajeProgreso();
    if (porcentaje >= 90) return '#4CAF50';
    if (porcentaje >= 70) return '#FF9800';
    return '#F44336';
  }

  esCompletada(): boolean {
    return this.leccion?.progreso?.completada || false;
  }

  tieneEstrellaDorada(): boolean {
    return this.leccion?.progreso?.tiene_estrella_dorada || false;
  }

  obtenerTextoBoton(): string {
    if (this.leccion?.bloqueada) return 'Bloqueada';
    if (!this.leccion?.activa) return 'No disponible';
    if (this.esCompletada()) return 'Repasar lección';
    return 'Comenzar lección';
  }

  get senaLeccion(): string {
    return this.leccion?.sena || 'N/A';
  }

  get categoriaNombre(): string {
    if (!this.leccion?.categoria_id) return 'Sin categoría';
    const categoria = this.categorias.find(c => c.id === this.leccion!.categoria_id);
    return categoria?.nombre || 'Sin categoría';
  }

  get totalClases(): number {
    return this.clases.length;
  }

  get duracionTotal(): number {
    return this.clases.reduce((total, clase) => total + (clase.duracion || 0), 0);
  }

  get clasesCompletadas(): number {
    if (!this.leccion?.progreso) return 0;
    return this.leccion.progreso.clases_completadas;
  }

  get estrellasObtenidas(): number {
    if (!this.leccion?.progreso) return 0;
    return this.leccion.progreso.estrellas;
  }

  get mensajeBloqueo(): string {
    if (this.leccion?.bloqueada && this.leccion.leccion_previa_id) {
      return `Completa la lección anterior para desbloquear esta lección.`;
    }
    return 'Esta lección está bloqueada. Completa los requisitos necesarios.';
  }

  get mostrarAlertaBloqueo(): boolean {
    return !this.verificandoProgreso && (this.leccion?.bloqueada || false);
  }

  actualizarEstado(): void {
    if (this.leccion?.id) {
      this.cargarLeccion(this.leccion.id);
    }
  }
}
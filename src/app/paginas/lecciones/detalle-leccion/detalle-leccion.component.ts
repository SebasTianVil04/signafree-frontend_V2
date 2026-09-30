import { Component, DestroyRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Clase, LeccionesService } from '../../../servicios/lecciones.service';
import { ProgresoService } from '../../../servicios/progreso.service';
import { CategoriaDB, Leccion } from '../../../modelos/leccion.model';

type TabLeccion = 'info' | 'clases' | 'progreso';

const STALE_LECCION_MS = 60 * 1000;

const COLORES_NIVEL: Record<number, string> = {
  1: '#4CAF50',
  2: '#FF9800',
  3: '#F44336'
};

const GRADIENTES_NIVEL: Record<number, string> = {
  1: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  2: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  3: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
};

const ETIQUETAS_NIVEL: Record<number, string> = {
  1: 'Principiante',
  2: 'Intermedio',
  3: 'Avanzado'
};

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
  cargandoClases = true;
  error: string | null = null;
  leccionAnteriorCompleta = false;
  verificandoProgreso = true;

  tabActiva: TabLeccion = 'clases';

  categoriasQuery = injectQuery(() => ({
    queryKey: ['categorias'],
    queryFn: () => firstValueFrom(this.leccionesService.obtenerCategorias(true)),
    staleTime: Infinity,
  }));

  private cargaActual = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private leccionesService: LeccionesService,
    private progresoService: ProgresoService,
    private cdr: ChangeDetectorRef,
    private queryClient: QueryClient,
    private destroyRef: DestroyRef
  ) {
    this.destroyRef.onDestroy(() => {
      this.cargaActual++;
    });
  }

  get categorias(): CategoriaDB[] {
    const res = this.categoriasQuery.data();
    return res?.exito && res.datos ? res.datos : [];
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('id'));

      if (Number.isInteger(id) && id > 0) {
        this.cargarLeccion(id);
      } else {
        this.cargaActual++;
        this.error = 'ID de lección inválido';
        this.finalizarCarga();
      }
    });
  }

  async cargarLeccion(id: number): Promise<void> {
    const carga = ++this.cargaActual;
    const mismaLeccion = this.leccion?.id === id;

    this.error = null;

    if (!mismaLeccion) {
      this.cargando = true;
      this.cargandoClases = true;
      this.verificandoProgreso = true;
      this.leccion = null;
      this.clases = [];
      this.leccionAnteriorCompleta = false;
    }

    const pLeccion = this.queryClient.fetchQuery({
      queryKey: ['leccion', id],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerLeccion(id)),
      staleTime: STALE_LECCION_MS
    });

    const pClases = this.queryClient.fetchQuery({
      queryKey: ['clases-leccion', id],
      queryFn: () => firstValueFrom(this.leccionesService.obtenerClasesDeLeccion(id)),
      staleTime: STALE_LECCION_MS
    }).catch(() => null);

    const pProgreso = firstValueFrom(
      this.leccionesService.obtenerProgresoClases(id).pipe(catchError(() => of(null)))
    );

    try {
      const respLeccion = await pLeccion;
      if (carga !== this.cargaActual) return;

      if (!respLeccion.exito || !respLeccion.datos) {
        this.error = respLeccion.mensaje || 'Error al cargar la lección';
        this.finalizarCarga();
        return;
      }

      const leccion = { ...respLeccion.datos } as Leccion;
      const pBloqueo = this.resolverBloqueo(leccion);

      if (!mismaLeccion) {
        this.leccion = leccion;
        this.cargando = false;
        this.cdr.detectChanges();
      }

      const [respClases, respProgreso] = await Promise.all([pClases, pProgreso, pBloqueo]);
      if (carga !== this.cargaActual) return;

      const clases = respClases?.exito && respClases.datos
        ? respClases.datos
            .filter(clase => clase.activa)
            .sort((a, b) => a.orden - b.orden)
            .map(clase => ({ ...clase }))
        : [];

      const completadas = new Set(
        (respProgreso?.datos?.clases ?? [])
          .filter(item => item.completada)
          .map(item => item.clase_id)
      );

      clases.forEach((clase, index) => {
        if (leccion.bloqueada) {
          clase.bloqueada = true;
          clase.completada = false;
        } else {
          clase.completada = completadas.has(clase.id!);
          clase.bloqueada = index > 0 && !clases[index - 1].completada;
        }
      });

      this.leccion = leccion;
      this.clases = clases;
      this.finalizarCarga();
    } catch (err: any) {
      if (carga !== this.cargaActual) return;

      const detalle = err?.error?.detail;
      this.error = typeof detalle === 'string' ? detalle : 'Error al cargar la lección.';
      this.finalizarCarga();
    }
  }

  private async resolverBloqueo(leccion: Leccion): Promise<void> {
    if (!leccion.leccion_previa_id) {
      this.leccionAnteriorCompleta = true;
      leccion.bloqueada = false;
      return;
    }

    try {
      const progreso = await firstValueFrom(
        this.progresoService.obtenerProgresoLeccion(leccion.leccion_previa_id)
      );
      this.leccionAnteriorCompleta = !!progreso.completada;
      leccion.bloqueada = !progreso.completada;
    } catch {
      this.leccionAnteriorCompleta = false;
      leccion.bloqueada = true;
    }
  }

  finalizarCarga(): void {
    this.cargando = false;
    this.cargandoClases = false;
    this.verificandoProgreso = false;
    this.cdr.detectChanges();
  }

  volver(): void {
    this.router.navigate(['/lecciones']);
  }

  obtenerColorNivel(nivel: number): string {
    return COLORES_NIVEL[nivel] || '#757575';
  }

  obtenerGradienteNivel(nivel: number): string {
    return GRADIENTES_NIVEL[nivel] || GRADIENTES_NIVEL[1];
  }

  obtenerEtiquetaNivel(nivel: number): string {
    return ETIQUETAS_NIVEL[nivel] || 'Desconocido';
  }

  cambiarTab(tab: TabLeccion): void {
    this.tabActiva = tab;
  }

  iniciarLeccion(): void {
    if (!this.leccion?.id) return;

    if (!this.leccion.activa) {
      alert('Esta lección no está activa actualmente');
      return;
    }

    if (this.leccion.bloqueada) {
      this.mostrarMensajeBloqueo();
      return;
    }

    const primeraClase = this.clases[0];
    if (primeraClase?.id) {
      this.router.navigate(['/lecciones', this.leccion.id, 'clase', primeraClase.id]);
    } else {
      this.router.navigate(['/lecciones', this.leccion.id, 'practica']);
    }
  }

  comenzarClase(clase: Clase): void {
    if (clase.bloqueada) {
      if (this.leccion?.bloqueada) {
        this.mostrarMensajeBloqueo();
      } else {
        alert('Debes completar las clases anteriores primero');
      }
      return;
    }

    if (!this.leccion?.id || !clase.id) return;

    this.router.navigate(['/lecciones', this.leccion.id, 'clase', clase.id]);
  }

  mostrarMensajeBloqueo(): void {
    alert(
      this.leccion?.leccion_previa_id
        ? 'Debes completar la lección anterior antes de acceder a esta lección.'
        : 'Esta lección está bloqueada. Completa los requisitos necesarios.'
    );
  }

  verClase(clase: Clase): void {
    this.comenzarClase(clase);
  }

  obtenerPorcentajeProgreso(): number {
    return (this.leccion?.progreso?.mejor_precision ?? 0) * 100;
  }

  porcentajeClasesCompletadas(): number {
    return this.leccion?.progreso?.porcentaje_completado || 0;
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
    if (this.verificandoProgreso) return 'Verificando...';
    if (this.leccion?.bloqueada) return 'Bloqueada';
    if (!this.leccion?.activa) return 'No disponible';
    if (this.esCompletada()) return 'Repasar lección';
    return 'Comenzar lección';
  }

  get senaLeccion(): string {
    return this.leccion?.sena || 'N/A';
  }

  get categoriaNombre(): string {
    const categoriaId = this.leccion?.categoria_id;
    if (!categoriaId) return 'Sin categoría';
    return this.categorias.find(c => c.id === categoriaId)?.nombre || 'Sin categoría';
  }

  get totalClases(): number {
    return this.clases.length;
  }

  get duracionTotal(): number {
    return this.clases.reduce((total, clase) => total + (clase.duracion_estimada || 0), 0);
  }

  get clasesCompletadas(): number {
    return this.leccion?.progreso?.clases_completadas ?? 0;
  }

  get estrellasObtenidas(): number {
    return this.leccion?.progreso?.estrellas ?? 0;
  }

  get mensajeBloqueo(): string {
    return this.leccion?.bloqueada && this.leccion.leccion_previa_id
      ? 'Completa la lección anterior para desbloquear esta lección.'
      : 'Esta lección está bloqueada. Completa los requisitos necesarios.';
  }

  get mostrarAlertaBloqueo(): boolean {
    return !this.verificandoProgreso && (this.leccion?.bloqueada || false);
  }

  actualizarEstado(): void {
    const id = this.leccion?.id;
    if (!id) return;

    this.queryClient.invalidateQueries({ queryKey: ['leccion', id] });
    this.queryClient.invalidateQueries({ queryKey: ['clases-leccion', id] });
    this.cargarLeccion(id);
  }
}
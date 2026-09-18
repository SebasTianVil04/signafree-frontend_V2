import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Directive({
    selector: '[appTienePermiso]',
    standalone: false
})
export class TienePermisoDirective implements OnInit, OnDestroy {
    private codigos: string[] = [];
    private destroy$ = new Subject<void>();
    private visible = false;

    @Input() set appTienePermiso(valor: string | string[]) {
        this.codigos = Array.isArray(valor) ? valor : [valor];
        this.actualizar();
    }

    constructor(
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef,
        private authService: AutenticacionService
    ) { }

    ngOnInit(): void {
        this.authService.cargarUsuarioSiEsNecesario().subscribe();
        this.authService.usuarioActual
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.actualizar());
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private actualizar(): void {
        const permitido = this.codigos.length > 0
            && this.authService.tieneAlgunPermiso(...this.codigos);

        if (permitido && !this.visible) {
            this.viewContainer.createEmbeddedView(this.templateRef);
            this.visible = true;
        } else if (!permitido && this.visible) {
            this.viewContainer.clear();
            this.visible = false;
        }
    }
}
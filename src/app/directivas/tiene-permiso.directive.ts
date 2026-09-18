import { Directive, Input, TemplateRef, ViewContainerRef, OnInit } from '@angular/core';
import { AutenticacionService } from '../servicios/autenticacion.service';

@Directive({
    selector: '[appTienePermiso]',
    standalone: false
})
export class TienePermisoDirective implements OnInit {
    private codigos: string[] = [];

    @Input() set appTienePermiso(valor: string | string[]) {
        this.codigos = Array.isArray(valor) ? valor : [valor];
    }

    constructor(
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef,
        private authService: AutenticacionService
    ) { }

    ngOnInit(): void {
        this.viewContainer.clear();
        if (this.authService.tieneAlgunPermiso(...this.codigos)) {
            this.viewContainer.createEmbeddedView(this.templateRef);
        }
    }
}
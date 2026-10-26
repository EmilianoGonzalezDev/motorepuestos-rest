import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/components/icon';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page grid min-h-[60dvh] place-items-center py-16 text-center">
      <div>
        <p class="font-display text-[8rem] leading-none font-extrabold text-brand-600">404</p>
        <h1 class="text-4xl font-extrabold uppercase">Te saliste de la ruta</h1>
        <p class="mt-2 text-muted">La página que buscás no existe o cambió de lugar.</p>
        <div class="mt-6 flex justify-center gap-3">
          <a routerLink="/" class="btn btn-primary"><app-icon name="home" [size]="16" /> Ir al inicio</a>
          <a routerLink="/productos" class="btn btn-secondary">Ver catálogo</a>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundPage {}

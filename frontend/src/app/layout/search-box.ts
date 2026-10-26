import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { CatalogApi } from '../core/api/store.api';
import { SearchSuggestion } from '../core/models/api.models';
import { Icon } from '../shared/components/icon';
import { ProductImage } from '../shared/components/ui';
import { ArsPipe } from '../shared/pipes';

/** Header search with debounced autocomplete and keyboard navigation. */
@Component({
  selector: 'app-search-box',
  imports: [FormsModule, Icon, ProductImage, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '(document:click)': 'onDocumentClick($event)' },
  template: `
    <form role="search" (ngSubmit)="submit()" class="relative">
      <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input #input type="search" name="q" autocomplete="off" placeholder="Buscá repuestos, cascos, aceites…"
             class="input rounded-full! pl-10" [ngModel]="term()" (ngModelChange)="onInput($event)"
             (focus)="open.set(suggestions().length > 0)" (keydown)="onKeydown($event)"
             role="combobox" aria-autocomplete="list" [attr.aria-expanded]="open()" aria-controls="search-suggestions" />
    </form>

    @if (open() && suggestions().length) {
      <ul id="search-suggestions" role="listbox"
          class="card absolute inset-x-0 top-full z-40 mt-2 max-h-96 overflow-y-auto p-1.5 shadow-pop animate-pop-in">
        @for (s of suggestions(); track s.id; let i = $index) {
          <li role="option" [attr.aria-selected]="i === active()">
            <button type="button" (mousedown)="$event.preventDefault()" (click)="goTo(s)"
                    class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition"
                    [class.bg-surface-2]="i === active()" (mouseenter)="active.set(i)">
              <app-product-image [src]="s.imageUrl" [alt]="s.name" [padded]="false" class="size-11 shrink-0 rounded-lg" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ s.name }}</span>
                <span class="block text-xs text-muted">{{ s.categoryName }}</span>
              </span>
              <span class="text-sm font-semibold">{{ s.price | ars }}</span>
            </button>
          </li>
        }
        <li>
          <button type="button" (mousedown)="$event.preventDefault()" (click)="submit()"
                  class="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-brand-600 hover:bg-surface-2">
            Ver todos los resultados para "{{ term() }}"
          </button>
        </li>
      </ul>
    }
  `,
})
export class SearchBox {
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly typed = new Subject<string>();

  protected readonly term = signal('');
  protected readonly suggestions = signal<SearchSuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly active = signal(-1);

  constructor() {
    this.typed
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => (q.trim().length < 2 ? of([]) : this.api.suggestions(q.trim()).pipe(catchError(() => of([]))))),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.suggestions.set(list);
        this.active.set(-1);
        this.open.set(list.length > 0);
      });
  }

  protected onInput(value: string): void {
    this.term.set(value);
    this.typed.next(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.open.set(true);
      this.active.update((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active.update((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (event.key === 'Enter' && this.open() && this.active() >= 0) {
      event.preventDefault();
      this.goTo(this.suggestions()[this.active()]);
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected goTo(s: SearchSuggestion): void {
    this.close();
    void this.router.navigate(['/productos', s.id]);
  }

  protected submit(): void {
    const q = this.term().trim();
    this.close();
    void this.router.navigate(['/productos'], { queryParams: { q: q || null } });
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private close(): void {
    this.open.set(false);
    this.input().nativeElement.blur();
  }
}

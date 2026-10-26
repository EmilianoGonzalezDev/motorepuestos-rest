import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, scan, startWith, switchMap } from 'rxjs';
import { CatalogApi } from '../../core/api/store.api';
import { CatalogQuery, CatalogSort, Paged, ProductCard as ProductCardModel } from '../../core/models/api.models';
import { Icon } from '../../shared/components/icon';
import { ProductCard, ProductCardSkeleton } from '../../shared/components/product-card';
import { EmptyState, Pagination } from '../../shared/components/ui';
import { ArsPipe } from '../../shared/pipes';

interface LoadState {
  loading: boolean;
  data: Paged<ProductCardModel> | null;
  error: boolean;
}

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'Newest', label: 'Más nuevos' },
  { value: 'PriceAsc', label: 'Menor precio' },
  { value: 'PriceDesc', label: 'Mayor precio' },
  { value: 'NameAsc', label: 'Nombre (A-Z)' },
];

/**
 * Storefront listing. All filters live in the URL (?q=&categoria=&min=&max=&orden=&pagina=) so
 * results are shareable and the back button works; query params bind straight to inputs.
 */
@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, RouterLink, Icon, ProductCard, ProductCardSkeleton, Pagination, EmptyState, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-b border-line bg-surface">
      <div class="container-page py-8">
        <nav class="mb-2 flex items-center gap-1 text-xs text-muted">
          <a routerLink="/" class="hover:text-fg">Inicio</a> <app-icon name="chevron-right" [size]="12" /> <span>Catálogo</span>
        </nav>
        <h1 class="text-4xl font-extrabold uppercase">{{ heading() }}</h1>
        <p class="mt-1 text-sm text-muted">
          @if (state().data; as data) { {{ data.totalItems }} producto{{ data.totalItems === 1 ? '' : 's' }} } @else { Buscando… }
        </p>
      </div>
    </div>

    <div class="container-page grid gap-8 py-8 lg:grid-cols-[260px_1fr]">
      <!-- Filters -->
      <aside class="space-y-6 lg:block" [class.hidden]="!filtersOpen()">
        <div class="card p-4">
          <h2 class="mb-3 text-lg font-bold uppercase">Categorías</h2>
          <ul class="space-y-0.5 text-sm">
            <li>
              <button class="filter-link" [class.active]="!categoryId()" (click)="apply({ categoria: null })">
                Todas <span class="text-muted">{{ totalProducts() }}</span>
              </button>
            </li>
            @for (c of categories(); track c.id) {
              <li>
                <button class="filter-link" [class.active]="categoryId() === c.id" (click)="apply({ categoria: c.id })">
                  {{ c.name }} <span class="text-muted">{{ c.productCount }}</span>
                </button>
              </li>
            }
          </ul>
        </div>

        <div class="card p-4">
          <h2 class="mb-3 text-lg font-bold uppercase">Precio</h2>
          @if (priceRange(); as range) {
            <p class="mb-3 text-xs text-muted">Entre {{ range.min | ars }} y {{ range.max | ars }}</p>
          }
          <form class="space-y-3" (ngSubmit)="applyPrice()">
            <div class="grid grid-cols-2 gap-2">
              <input class="input" type="number" min="0" placeholder="Mínimo" name="min" [(ngModel)]="minDraft" />
              <input class="input" type="number" min="0" placeholder="Máximo" name="max" [(ngModel)]="maxDraft" />
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm flex-1" type="submit">Aplicar</button>
              @if (min() || max()) {
                <button class="btn btn-secondary btn-sm" type="button" (click)="clearPrice()">Limpiar</button>
              }
            </div>
          </form>
        </div>
      </aside>

      <!-- Results -->
      <section>
        <div class="mb-5 flex flex-wrap items-center gap-2">
          <button class="btn btn-secondary btn-sm lg:hidden" (click)="filtersOpen.set(!filtersOpen())">
            <app-icon name="sliders" [size]="15" /> Filtros
          </button>
          @if (q()) {
            <span class="badge bg-brand-500/10 py-1 text-brand-700 dark:text-brand-300">
              "{{ q() }}" <button (click)="apply({ q: null })" aria-label="Quitar búsqueda"><app-icon name="x" [size]="13" /></button>
            </span>
          }
          @if (categoryName(); as name) {
            <span class="badge bg-surface-2 py-1">
              {{ name }} <button (click)="apply({ categoria: null })" aria-label="Quitar categoría"><app-icon name="x" [size]="13" /></button>
            </span>
          }
          <label class="ml-auto flex items-center gap-2 text-sm text-muted">
            Ordenar
            <select class="input w-auto py-2" [ngModel]="sort()" (ngModelChange)="apply({ orden: $event })">
              @for (o of sortOptions; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </label>
        </div>

        @if (state().loading && !state().data) {
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
            @for (i of skeletons; track i) { <app-product-card-skeleton /> }
          </div>
        } @else if (state().error) {
          <app-empty-state icon="circle-alert" title="No pudimos cargar el catálogo" message="Revisá tu conexión e intentá nuevamente." />
        } @else if (state().data; as data) {
          @if (data.items.length === 0) {
            <div class="card">
              <app-empty-state icon="search" title="Sin resultados" message="Probá con otras palabras o quitá algunos filtros.">
                <a routerLink="/productos" class="btn btn-primary">Ver todo el catálogo</a>
              </app-empty-state>
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3" [class.opacity-60]="state().loading">
              @for (p of data.items; track p.id) { <app-product-card [product]="p" /> }
            </div>
            <div class="mt-10">
              <app-pagination [page]="data.page" [totalPages]="data.totalPages" (pageChange)="apply({ pagina: $event }, false)" />
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .filter-link {
      display: flex; width: 100%; justify-content: space-between; border-radius: 0.6rem; padding: 0.45rem 0.65rem;
      text-align: left; transition: background-color 0.15s;
    }
    .filter-link:hover { background: var(--color-surface-2); }
    .filter-link.active { background: color-mix(in oklch, var(--color-brand-500) 14%, transparent); font-weight: 600; color: var(--color-brand-700); }
    :host-context(.dark) .filter-link.active { color: var(--color-brand-300); }
  `,
})
export class CatalogPage {
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);

  // Query params (bound by withComponentInputBinding)
  readonly q = input<string>();
  readonly categoria = input<string>();
  readonly min = input<string>();
  readonly max = input<string>();
  readonly orden = input<string>();
  readonly pagina = input<string>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletons = Array.from({ length: 9 }, (_, i) => i);
  protected readonly filtersOpen = signal(false);
  protected minDraft: number | null = null;
  protected maxDraft: number | null = null;

  protected readonly categoryId = computed(() => toNumber(this.categoria()));
  protected readonly sort = computed<CatalogSort>(() =>
    SORT_OPTIONS.some((o) => o.value === this.orden()) ? (this.orden() as CatalogSort) : 'Newest',
  );

  private readonly query = computed<CatalogQuery>(() => ({
    page: toNumber(this.pagina()) ?? 1,
    pageSize: 12,
    categoryId: this.categoryId(),
    search: this.q()?.trim() || null,
    minPrice: toNumber(this.min()),
    maxPrice: toNumber(this.max()),
    sort: this.sort(),
  }));

  protected readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly totalProducts = computed(() => this.categories().reduce((sum, c) => sum + c.productCount, 0));
  protected readonly categoryName = computed(() => this.categories().find((c) => c.id === this.categoryId())?.name ?? null);
  protected readonly heading = computed(() => (this.q() ? `Resultados para "${this.q()}"` : (this.categoryName() ?? 'Catálogo')));

  protected readonly priceRange = toSignal(
    toObservable(this.categoryId).pipe(switchMap((id) => this.api.priceRange(id).pipe(catchError(() => of(null))))),
  );

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) =>
        this.api.products(query).pipe(
          map((data): LoadState => ({ loading: false, data, error: false })),
          catchError(() => of<LoadState>({ loading: false, data: null, error: true })),
          startWith<LoadState>({ loading: true, data: null, error: false }),
        ),
      ),
      // Keep showing the previous page (dimmed) while the next one loads.
      scan((prev, next) => (next.loading ? { ...next, data: prev.data } : next)),
    ),
    { initialValue: { loading: true, data: null, error: false } as LoadState },
  );

  constructor() {
    effect(() => {
      this.minDraft = toNumber(this.min());
      this.maxDraft = toNumber(this.max());
    });
  }

  /** Updates the URL; any filter change resets to page 1 unless told otherwise. */
  protected apply(params: Record<string, string | number | null>, resetPage = true): void {
    void this.router.navigate([], {
      queryParams: { ...(resetPage ? { pagina: null } : {}), ...params },
      queryParamsHandling: 'merge',
    });
    if (!resetPage) window.scrollTo({ top: 0, behavior: 'smooth' });
    this.filtersOpen.set(false);
  }

  protected applyPrice(): void {
    this.apply({ min: this.minDraft || null, max: this.maxDraft || null });
  }

  protected clearPrice(): void {
    this.apply({ min: null, max: null });
  }
}

function toNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

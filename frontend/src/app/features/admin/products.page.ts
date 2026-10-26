import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, of, startWith, switchMap } from 'rxjs';
import { AdminApi, ProductListQuery } from '../../core/api/admin.api';
import { errorMessage } from '../../core/http/http-utils';
import { CategoryOption, ProductAdmin, ProductListResponse, ProductSortBy, SortDirection } from '../../core/models/api.models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Pagination, ProductImage } from '../../shared/components/ui';
import { ArsPipe } from '../../shared/pipes';

@Component({
  selector: 'app-admin-products-page',
  imports: [RouterLink, FormsModule, Icon, EmptyState, Pagination, ProductImage, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-4xl font-extrabold uppercase">Productos</h1><p class="text-sm text-muted">Catálogo, precios y stock</p></div>
      <a routerLink="/admin/productos/nuevo" class="btn btn-primary"><app-icon name="plus" [size]="16" /> Nuevo producto</a>
    </div>

    <div class="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_200px_160px_auto]">
      <div class="relative">
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input class="input pl-10" placeholder="Buscar producto…" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(1)" />
      </div>
      <select class="input" [ngModel]="categoryId()" (ngModelChange)="categoryId.set($event); page.set(1)">
        <option [ngValue]="null">Todas las categorías</option>
        @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
      </select>
      <select class="input" [ngModel]="status()" (ngModelChange)="status.set($event); page.set(1)">
        <option value="All">Todos</option><option value="Active">Activos</option><option value="Inactive">Inactivos</option>
      </select>
      <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm font-medium"
             [class.border-brand-500]="lowStockOnly()">
        <input type="checkbox" class="size-4 accent-brand-600" [ngModel]="lowStockOnly()" (ngModelChange)="lowStockOnly.set($event); page.set(1)" />
        Solo stock bajo
      </label>
    </div>

    @if (result(); as r) {
      @if (r === 'error') {
        <div class="card"><app-empty-state icon="circle-alert" title="No pudimos cargar los productos" /></div>
      } @else if (r.products.items.length === 0) {
        <div class="card"><app-empty-state icon="boxes" title="No hay productos" message="Probá cambiando los filtros." /></div>
      } @else {
        <div class="card overflow-x-auto">
          <table class="table-base min-w-[860px]">
            <thead>
              <tr>
                <th>Producto</th>
                <th><button class="sort" (click)="sort('Category')">Categoría {{ arrow('Category') }}</button></th>
                <th class="text-right"><button class="sort" (click)="sort('Price')">Precio {{ arrow('Price') }}</button></th>
                <th class="text-center"><button class="sort" (click)="sort('Stock')">Stock {{ arrow('Stock') }}</button></th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of r.products.items; track p.id) {
                <tr [class.opacity-60]="!p.isActive">
                  <td>
                    <div class="flex items-center gap-3">
                      <app-product-image [src]="p.imageUrl" [alt]="p.name" [padded]="false" class="size-12 shrink-0 rounded-lg border border-line" />
                      <a [routerLink]="['/admin/productos', p.id]" class="line-clamp-2 max-w-xs font-medium hover:text-brand-600">{{ p.name }}</a>
                    </div>
                  </td>
                  <td class="text-muted">{{ p.categoryName }} @if (!p.categoryIsActive) { <span class="badge bg-zinc-500/15 text-zinc-600">inactiva</span> }</td>
                  <td class="text-right font-semibold">{{ p.price | ars }}</td>
                  <td class="text-center">
                    @if (editingStock() === p.id) {
                      <input #stockInput type="number" min="0" class="input w-24 py-1.5 text-center" [ngModel]="stockDraft()" (ngModelChange)="stockDraft.set($event)"
                             (keydown.enter)="saveStock(p)" (keydown.escape)="editingStock.set(null)" (blur)="saveStock(p)" autofocus />
                    } @else {
                      <button class="badge cursor-text" [class]="p.stock === 0 ? 'bg-red-500/15 text-red-700 dark:text-red-300' : p.isLowStock ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'"
                              title="Click para editar el stock" (click)="startEditStock(p)">{{ p.stock }}</button>
                    }
                  </td>
                  <td><span class="badge" [class]="p.isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300'">{{ p.isActive ? 'Activo' : 'Inactivo' }}</span></td>
                  <td class="text-right whitespace-nowrap">
                    <a [routerLink]="['/admin/productos', p.id]" class="btn-icon inline-flex size-9" aria-label="Editar"><app-icon name="pencil" [size]="16" /></a>
                    <button class="btn-icon size-9" (click)="toggle(p)" [attr.aria-label]="p.isActive ? 'Dar de baja' : 'Dar de alta'">
                      <app-icon [name]="p.isActive ? 'eye-off' : 'eye'" [size]="16" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-center text-xs text-muted">{{ r.products.totalItems }} producto{{ r.products.totalItems === 1 ? '' : 's' }} · Stock bajo: {{ r.lowStockThreshold }} o menos</p>
        <div class="mt-4"><app-pagination [page]="r.products.page" [totalPages]="r.products.totalPages" (pageChange)="page.set($event)" /></div>
      }
    } @else {
      <div class="space-y-2">@for (i of [1, 2, 3, 4, 5, 6]; track i) { <div class="skeleton h-16"></div> }</div>
    }
  `,
  styles: `.sort { font: inherit; text-transform: inherit; letter-spacing: inherit; } .sort:hover { color: var(--color-fg); }`,
})
export class AdminProductsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** ?stockBajo=1 comes from the dashboard. */
  readonly stockBajo = input<string>();

  protected readonly search = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly status = signal<'All' | 'Active' | 'Inactive'>('All');
  protected readonly lowStockOnly = signal(false);
  protected readonly sortBy = signal<ProductSortBy>('Name');
  protected readonly sortDir = signal<SortDirection>('Asc');
  protected readonly page = signal(1);
  protected readonly categories = toSignal(this.api.categoryOptions(), { initialValue: [] as CategoryOption[] });

  protected readonly editingStock = signal<number | null>(null);
  protected readonly stockDraft = signal(0);
  private readonly reload = signal(0);

  private readonly query = computed<ProductListQuery>(() => ({
    page: this.page(),
    pageSize: 10,
    search: this.search().trim() || null,
    categoryId: this.categoryId(),
    status: this.status(),
    lowStockOnly: this.lowStockOnly() || undefined,
    sortBy: this.sortBy(),
    sortDir: this.sortDir(),
  }));

  protected readonly result = toSignal(
    toObservable(computed(() => ({ query: this.query(), reload: this.reload() }))).pipe(
      debounceTime(250),
      switchMap(({ query }) =>
        this.api.products(query).pipe(
          catchError(() => of('error' as const)),
          startWith(undefined),
        ),
      ),
    ),
  ) as import('@angular/core').Signal<ProductListResponse | 'error' | undefined>;

  constructor() {
    effect(() => {
      if (this.stockBajo()) this.lowStockOnly.set(true);
    });
  }

  protected sort(by: ProductSortBy): void {
    if (this.sortBy() === by) this.sortDir.update((d) => (d === 'Asc' ? 'Desc' : 'Asc'));
    else {
      this.sortBy.set(by);
      this.sortDir.set('Asc');
    }
  }

  protected arrow(by: ProductSortBy): string {
    return this.sortBy() === by ? (this.sortDir() === 'Asc' ? '↑' : '↓') : '';
  }

  protected startEditStock(p: ProductAdmin): void {
    this.stockDraft.set(p.stock);
    this.editingStock.set(p.id);
  }

  protected saveStock(p: ProductAdmin): void {
    if (this.editingStock() !== p.id) return;
    this.editingStock.set(null);
    const stock = Math.max(0, Math.floor(Number(this.stockDraft()) || 0));
    if (stock === p.stock) return;

    this.api.setProductStock(p.id, stock).subscribe({
      next: () => {
        this.toast.success('Stock actualizado', `${p.name}: ${stock} unidades`);
        this.reload.update((n) => n + 1);
      },
      error: (err) => this.toast.error('No se pudo actualizar el stock', errorMessage(err)),
    });
  }

  protected async toggle(p: ProductAdmin): Promise<void> {
    const next = !p.isActive;
    if (!next && !(await this.confirm.confirm({
      title: `¿Dar de baja "${p.name}"?`,
      message: 'Dejará de mostrarse en la tienda. Podés volver a darlo de alta cuando quieras.',
      confirmText: 'Dar de baja',
      danger: true,
    }))) return;

    this.api.setProductStatus(p.id, next).subscribe({
      next: () => {
        this.toast.success(next ? 'Producto dado de alta' : 'Producto dado de baja');
        this.reload.update((n) => n + 1);
      },
      error: (err) => this.toast.error('No se pudo actualizar el producto', errorMessage(err)),
    });
  }
}

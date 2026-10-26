import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { CategoryAdmin } from '../../core/models/api.models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { EmptyState, FieldError, Modal, Pagination, Spinner } from '../../shared/components/ui';
import { availabilityValidator } from '../../shared/validators';

@Component({
  selector: 'app-admin-categories-page',
  imports: [FormsModule, ReactiveFormsModule, Icon, Modal, EmptyState, FieldError, Pagination, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-4xl font-extrabold uppercase">Categorías</h1><p class="text-sm text-muted">Organizan el catálogo de la tienda</p></div>
      <button class="btn btn-primary" (click)="openForm(null)"><app-icon name="plus" [size]="16" /> Nueva categoría</button>
    </div>

    <div class="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
      <div class="relative">
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input class="input pl-10" placeholder="Buscar categoría…" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(1)" />
      </div>
      <select class="input" [ngModel]="filter()" (ngModelChange)="filter.set($event); page.set(1)">
        <option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option>
      </select>
    </div>

    @if (result(); as r) {
      @if (r === 'error') {
        <div class="card"><app-empty-state icon="circle-alert" title="No pudimos cargar las categorías" /></div>
      } @else if (r.items.length === 0) {
        <div class="card"><app-empty-state icon="tags" title="No hay categorías" /></div>
      } @else {
        <div class="card overflow-x-auto">
          <table class="table-base min-w-[560px]">
            <thead><tr><th>Nombre</th><th class="text-center">Productos</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (c of r.items; track c.id) {
                <tr [class.opacity-60]="!c.isActive">
                  <td class="font-medium">{{ c.name }}</td>
                  <td class="text-center text-muted">{{ c.activeProductCount }} <span class="text-xs">/ {{ c.productCount }}</span></td>
                  <td><span class="badge" [class]="c.isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300'">{{ c.isActive ? 'Activa' : 'Inactiva' }}</span></td>
                  <td class="text-right whitespace-nowrap">
                    <button class="btn-icon size-9" (click)="openForm(c)" aria-label="Editar"><app-icon name="pencil" [size]="16" /></button>
                    <button class="btn-icon size-9" (click)="toggle(c)" [attr.aria-label]="c.isActive ? 'Dar de baja' : 'Dar de alta'"><app-icon [name]="c.isActive ? 'eye-off' : 'eye'" [size]="16" /></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4"><app-pagination [page]="r.page" [totalPages]="r.totalPages" (pageChange)="page.set($event)" /></div>
      }
    } @else {
      <div class="space-y-2">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-14"></div> }</div>
    }

    @if (formOpen()) {
      <app-modal [title]="editing() ? 'Editar categoría' : 'Nueva categoría'" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
          <div>
            <label class="label" for="cat-name">Nombre</label>
            <div class="relative">
              <input id="cat-name" class="input pr-10" formControlName="name" maxlength="100" autofocus />
              @if (form.controls.name.pending) { <app-spinner [size]="16" class="absolute top-1/2 right-3 -translate-y-1/2 text-muted" /> }
              @else if (form.controls.name.valid && form.controls.name.value) { <app-icon name="circle-check" [size]="18" class="absolute top-1/2 right-3 -translate-y-1/2 text-emerald-500" /> }
            </div>
            <app-field-error [control]="form.controls.name" />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving() || form.pending">@if (saving()) { <app-spinner [size]="15" /> } Guardar</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class AdminCategoriesPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly search = signal('');
  protected readonly filter = signal<'all' | 'active' | 'inactive'>('all');
  protected readonly page = signal(1);
  private readonly reload = signal(0);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<CategoryAdmin | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.maxLength(100)],
      [availabilityValidator((name) => this.api.categoryNameAvailable(name, this.editing()?.id).pipe(map((r) => r.available)), 'nameTaken')],
    ],
  });

  private readonly query = computed(() => ({
    page: this.page(),
    pageSize: 10,
    search: this.search().trim() || null,
    isActive: this.filter() === 'all' ? null : this.filter() === 'active',
    reload: this.reload(),
  }));

  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      switchMap(({ reload: _reload, ...q }) =>
        this.api.categories(q).pipe(
          catchError(() => of('error' as const)),
          startWith(undefined),
        ),
      ),
    ),
  );

  protected openForm(category: CategoryAdmin | null): void {
    this.editing.set(category);
    this.form.reset({ name: category?.name ?? '' });
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    const { name } = this.form.getRawValue();
    const editing = this.editing();
    const request = editing ? this.api.updateCategory(editing.id, name) : this.api.createCategory(name);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.reload.update((n) => n + 1);
        this.toast.success(editing ? 'Categoría actualizada' : 'Categoría creada');
      },
      error: (err) => {
        this.saving.set(false);
        if (!applyServerErrors(this.form, err)) this.toast.error('No se pudo guardar', errorMessage(err));
      },
    });
  }

  protected async toggle(c: CategoryAdmin): Promise<void> {
    const next = !c.isActive;
    if (!next && !(await this.confirm.confirm({
      title: `¿Dar de baja "${c.name}"?`,
      message: 'Dejará de mostrarse en la tienda.',
      confirmText: 'Dar de baja',
      danger: true,
    }))) return;

    this.api.setCategoryStatus(c.id, next).subscribe({
      next: () => {
        this.toast.success(next ? 'Categoría dada de alta' : 'Categoría dada de baja');
        this.reload.update((n) => n + 1);
      },
      error: (err) => this.toast.warning('No se pudo actualizar', errorMessage(err)),
    });
  }
}

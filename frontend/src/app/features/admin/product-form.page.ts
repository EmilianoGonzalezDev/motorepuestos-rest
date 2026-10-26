import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/api/admin.api';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { CategoryOption, ProductAdminDetail } from '../../core/models/api.models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { RichTextEditor } from '../../shared/components/rich-text-editor';
import { FieldError, ProductImage, Spinner } from '../../shared/components/ui';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

@Component({
  selector: 'app-product-form-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, FieldError, ProductImage, RichTextEditor, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/productos" class="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
      <app-icon name="arrow-left" [size]="15" /> Productos
    </a>
    <h1 class="mb-6 text-4xl font-extrabold uppercase">{{ isEdit() ? 'Editar producto' : 'Nuevo producto' }}</h1>

    @if (loading()) {
      <div class="skeleton h-96"></div>
    } @else {
      <form class="grid gap-6 lg:grid-cols-[1fr_320px]" [formGroup]="form" (ngSubmit)="save()">
        <section class="card space-y-5 p-6">
          <div>
            <label class="label" for="name">Nombre</label>
            <input id="name" class="input" formControlName="name" maxlength="150" />
            <app-field-error [control]="form.controls.name" />
          </div>
          <div>
            <label class="label">Descripción</label>
            <app-rich-text-editor formControlName="description" />
            <app-field-error [control]="form.controls.description" />
          </div>
        </section>

        <aside class="space-y-6">
          <section class="card space-y-4 p-6">
            <div>
              <label class="label" for="category">Categoría</label>
              <select id="category" class="input" formControlName="categoryId">
                <option [ngValue]="0" disabled>Seleccioná…</option>
                @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}{{ c.isActive ? '' : ' (inactiva)' }}</option> }
              </select>
              <app-field-error [control]="form.controls.categoryId" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label" for="price">Precio</label>
                <div class="relative">
                  <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
                  <input id="price" type="number" min="0" step="0.01" class="input pl-7" formControlName="price" />
                </div>
                <app-field-error [control]="form.controls.price" />
              </div>
              <div>
                <label class="label" for="stock">Stock</label>
                <input id="stock" type="number" min="0" step="1" class="input" formControlName="stock" />
                <app-field-error [control]="form.controls.stock" />
              </div>
            </div>
          </section>

          <section class="card space-y-3 p-6">
            <h2 class="text-lg font-bold uppercase">Imagen</h2>
            <app-product-image [src]="preview() ?? imageUrl()" [alt]="form.controls.name.value" class="aspect-square rounded-xl border border-line" />
            @if (isEdit()) {
              <label class="btn btn-secondary w-full cursor-pointer">
                @if (uploading()) { <app-spinner [size]="15" /> } @else { <app-icon name="upload" [size]="16" /> }
                {{ imageUrl() ? 'Reemplazar imagen' : 'Subir imagen' }}
                <input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" (change)="onFile($event)" [disabled]="uploading()" />
              </label>
              @if (imageUrl()) {
                <button type="button" class="btn btn-ghost w-full text-red-600" (click)="removeImage()"><app-icon name="trash" [size]="16" /> Quitar imagen</button>
              }
              <p class="text-xs text-muted">JPG, PNG, WEBP o GIF · máx. 3 MB</p>
            } @else {
              <p class="text-xs text-muted">Podrás subir la imagen una vez creado el producto.</p>
            }
          </section>

          <div class="flex gap-3">
            <button class="btn btn-primary flex-1 py-3" type="submit" [disabled]="saving()">
              @if (saving()) { <app-spinner [size]="15" /> } @else { <app-icon name="save" [size]="16" /> } Guardar
            </button>
            <a routerLink="/admin/productos" class="btn btn-secondary py-3">Cancelar</a>
          </div>
        </aside>
      </form>
    }
  `,
})
export class ProductFormPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** Route param :id (absent when creating). */
  readonly id = input<string>();
  protected readonly isEdit = computed(() => !!this.id());

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly categories = signal<CategoryOption[]>([]);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly preview = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(20000)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(0), Validators.max(9_999_999_999)]],
    stock: [0, [Validators.required, Validators.min(0), Validators.max(9_999_999)]],
  });

  constructor() {
    queueMicrotask(() => this.init());
  }

  private init(): void {
    const id = this.id() ? Number(this.id()) : null;

    if (id === null) {
      this.api.categoryOptions().subscribe((c) => {
        this.categories.set(c);
        this.loading.set(false);
      });
      return;
    }

    this.api.product(id).subscribe({
      next: (product) => {
        this.fill(product);
        this.api.categoryOptions(product.categoryId).subscribe((c) => {
          this.categories.set(c);
          this.loading.set(false);
        });
      },
      error: (err) => {
        this.toast.error('No se pudo cargar el producto', errorMessage(err));
        void this.router.navigate(['/admin/productos']);
      },
    });
  }

  private fill(p: ProductAdminDetail): void {
    this.form.setValue({ name: p.name, description: p.description, categoryId: p.categoryId, price: p.price, stock: p.stock });
    this.imageUrl.set(p.imageUrl);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const id = this.id() ? Number(this.id()) : null;
    const request = id === null ? this.api.createProduct(value) : this.api.updateProduct(id, value);

    request.subscribe({
      next: (product) => {
        this.saving.set(false);
        this.toast.success(id === null ? 'Producto creado' : 'Producto actualizado');
        // After creating, stay on the edit screen so the image can be uploaded right away.
        void this.router.navigate(id === null ? ['/admin/productos', product.id] : ['/admin/productos']);
      },
      error: (err) => {
        this.saving.set(false);
        if (!applyServerErrors(this.form, err)) this.toast.error('No se pudo guardar', errorMessage(err));
      },
    });
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.id()) return;

    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.warning('La imagen es muy pesada', 'El máximo es 3 MB.');
      return;
    }

    this.preview.set(URL.createObjectURL(file));
    this.uploading.set(true);
    this.api.uploadProductImage(Number(this.id()), file).subscribe({
      next: (res) => {
        this.imageUrl.set(res.imageUrl);
        this.preview.set(null);
        this.uploading.set(false);
        this.toast.success('Imagen actualizada');
      },
      error: (err) => {
        this.preview.set(null);
        this.uploading.set(false);
        this.toast.error('No se pudo subir la imagen', errorMessage(err));
      },
    });
  }

  protected async removeImage(): Promise<void> {
    if (!(await this.confirm.confirm({ title: '¿Quitar la imagen?', confirmText: 'Quitar', danger: true }))) return;
    this.api.deleteProductImage(Number(this.id())).subscribe({
      next: () => {
        this.imageUrl.set(null);
        this.toast.success('Imagen eliminada');
      },
      error: (err) => this.toast.error('No se pudo quitar la imagen', errorMessage(err)),
    });
  }
}

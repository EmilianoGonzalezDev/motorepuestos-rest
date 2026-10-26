import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/api/admin.api';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { FieldError, Spinner } from '../../shared/components/ui';

@Component({
  selector: 'app-admin-settings-page',
  imports: [ReactiveFormsModule, Icon, FieldError, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-4xl font-extrabold uppercase">Configuración</h1>

    <div class="grid gap-6 xl:grid-cols-2">
      <form class="card space-y-4 p-6" [formGroup]="form" (ngSubmit)="saveSettings()">
        <div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600"><app-icon name="alert" /></span>
          <h2 class="text-2xl font-bold uppercase">Alerta de stock bajo</h2></div>
        <p class="text-sm text-muted">Los productos con esta cantidad de unidades o menos se marcan como "stock bajo" en el listado, el dashboard y la tienda ("Últimas unidades").</p>
        <div>
          <label class="label" for="threshold">Umbral (unidades)</label>
          <input id="threshold" type="number" min="1" max="9999" class="input max-w-40" formControlName="lowStockThreshold" />
          <app-field-error [control]="form.controls.lowStockThreshold" />
        </div>
        <button class="btn btn-primary" [disabled]="savingSettings() || form.pristine">
          @if (savingSettings()) { <app-spinner [size]="15" /> } @else { <app-icon name="save" [size]="16" /> } Guardar
        </button>
      </form>
    </div>
  `,
})
export class AdminSettingsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    lowStockThreshold: [5, [Validators.required, Validators.min(1), Validators.max(9999)]],
  });
  protected readonly savingSettings = signal(false);

  constructor() {
    this.api.settings().subscribe((s) => this.form.reset({ lowStockThreshold: s.lowStockThreshold }));
  }

  protected saveSettings(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.savingSettings.set(true);
    this.api.updateSettings(this.form.getRawValue()).subscribe({
      next: (s) => {
        this.form.reset({ lowStockThreshold: s.lowStockThreshold });
        this.savingSettings.set(false);
        this.toast.success('Configuración guardada');
      },
      error: (err) => {
        this.savingSettings.set(false);
        if (!applyServerErrors(this.form, err)) this.toast.error('No se pudo guardar', errorMessage(err));
      },
    });
  }
}

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/api/admin.api';
import { AuthService } from '../../core/auth/auth.service';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { BackupInfo } from '../../core/models/api.models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { FieldError, Spinner } from '../../shared/components/ui';

@Component({
  selector: 'app-admin-settings-page',
  imports: [DatePipe, ReactiveFormsModule, Icon, FieldError, Spinner],
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

      <section class="card space-y-4 p-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-600"><app-icon name="database" /></span>
            <h2 class="text-2xl font-bold uppercase">Backups</h2></div>
          <button class="btn btn-primary btn-sm" (click)="createBackup()" [disabled]="creating()">
            @if (creating()) { <app-spinner [size]="14" /> } @else { <app-icon name="plus" [size]="15" /> } Crear backup
          </button>
        </div>
        <p class="text-sm text-muted">Backups nativos de SQL Server (<code>BACKUP DATABASE … COPY_ONLY</code>). Restaurar reemplaza todos los datos actuales.</p>

        @if (backups().length === 0) {
          <p class="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">Todavía no hay backups.</p>
        } @else {
          <ul class="divide-y divide-line rounded-xl border border-line">
            @for (b of backups(); track b.fileName) {
              <li class="flex items-center gap-3 p-3">
                <app-icon name="database" class="text-muted" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ b.fileName }}</p>
                  <p class="text-xs text-muted">{{ b.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ size(b.sizeBytes) }}</p>
                </div>
                @if (auth.isSuperAdmin()) {
                  <button class="btn btn-secondary btn-sm" (click)="restore(b)" [disabled]="restoring()">
                    <app-icon name="refresh" [size]="14" /> Restaurar
                  </button>
                }
              </li>
            }
          </ul>
          @if (!auth.isSuperAdmin()) { <p class="text-xs text-muted">Solo el super administrador puede restaurar backups.</p> }
        }
      </section>
    </div>
  `,
})
export class AdminSettingsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    lowStockThreshold: [5, [Validators.required, Validators.min(1), Validators.max(9999)]],
  });
  protected readonly savingSettings = signal(false);
  protected readonly backups = signal<BackupInfo[]>([]);
  protected readonly creating = signal(false);
  protected readonly restoring = signal(false);

  constructor() {
    this.api.settings().subscribe((s) => this.form.reset({ lowStockThreshold: s.lowStockThreshold }));
    this.loadBackups();
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

  protected createBackup(): void {
    this.creating.set(true);
    this.api.createBackup().subscribe({
      next: (b) => {
        this.creating.set(false);
        this.toast.success('Backup creado', b.fileName);
        this.loadBackups();
      },
      error: (err) => {
        this.creating.set(false);
        this.toast.error('No se pudo crear el backup', errorMessage(err));
      },
    });
  }

  protected async restore(b: BackupInfo): Promise<void> {
    const ok = await this.confirm.confirm({
      title: '¿Restaurar este backup?',
      message: `Se reemplazarán TODOS los datos actuales por los del backup ${b.fileName}. Esta acción no se puede deshacer.`,
      confirmText: 'Restaurar',
      danger: true,
    });
    if (!ok) return;

    this.restoring.set(true);
    this.api.restoreBackup(b.fileName).subscribe({
      next: () => {
        this.restoring.set(false);
        this.toast.success('Base de datos restaurada', 'Volvé a iniciar sesión si ves datos inconsistentes.');
      },
      error: (err) => {
        this.restoring.set(false);
        this.toast.error('No se pudo restaurar', errorMessage(err));
      },
    });
  }

  protected size(bytes: number): string {
    return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private loadBackups(): void {
    this.api.backups().subscribe({ next: (list) => this.backups.set(list), error: () => this.backups.set([]) });
  }
}

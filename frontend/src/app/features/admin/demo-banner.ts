import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { AuthService } from '../../core/auth/auth.service';
import { DemoStore } from '../../core/demo/demo.store';
import { errorMessage } from '../../core/http/http-utils';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { Spinner } from '../../shared/components/ui';

/** Back-office notice for the public demo, with the button that puts the data back to its initial state. */
@Component({
  selector: 'app-demo-admin-banner',
  imports: [DatePipe, Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.enabled()) {
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm sm:px-6">
        <app-icon name="sparkles" [size]="16" class="text-amber-600" />
        <p class="min-w-0 flex-1">
          <strong class="font-semibold">Modo demo:</strong> cualquier visitante puede modificar estos datos. Se restablecen solos cada {{ demo.resetIntervalHours() }} h.
          @if (demo.lastResetAt(); as last) {
            <span class="text-muted">Último restablecimiento: {{ last | date: 'dd/MM HH:mm' }}.</span>
          }
        </p>
        <button class="btn btn-secondary btn-sm" (click)="reset()" [disabled]="resetting()">
          @if (resetting()) { <app-spinner [size]="14" /> } @else { <app-icon name="refresh" [size]="14" /> } Restablecer datos demo
        </button>
      </div>
    }
  `,
})
export class DemoAdminBanner {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly demo = inject(DemoStore);
  protected readonly resetting = signal(false);

  protected async reset(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: '¿Restablecer los datos de la demo?',
      message: 'Se borrarán los pedidos, productos, categorías y cuentas creadas por los visitantes, y se volverán a cargar los datos iniciales. Vas a tener que volver a ingresar.',
      confirmText: 'Restablecer',
      danger: true,
    });
    if (!ok) return;

    this.resetting.set(true);
    try {
      await firstValueFrom(this.api.resetDemo());
    } catch (err) {
      this.resetting.set(false);
      if (err instanceof HttpErrorResponse && err.status === 409) this.toast.warning('Restablecimiento en curso', errorMessage(err));
      else if (!(err instanceof HttpErrorResponse && err.status === 429)) this.toast.error('No se pudo restablecer', errorMessage(err));
      return;
    }

    // Every session was closed by the reset (accounts are recreated), including this one.
    await this.demo.load();
    await firstValueFrom(this.auth.logout());
    this.resetting.set(false);
    this.toast.success('Datos de la demo restablecidos', 'Volvé a ingresar con una cuenta demo.');
    void this.router.navigate(['/ingresar']);
  }
}

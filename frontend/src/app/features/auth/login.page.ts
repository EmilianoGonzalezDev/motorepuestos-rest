import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DemoStore } from '../../core/demo/demo.store';
import { errorMessage } from '../../core/http/http-utils';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { FieldError, Spinner } from '../../shared/components/ui';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, FieldError, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page grid min-h-[70dvh] place-items-center py-12">
      <div class="w-full max-w-md">
        <div class="card p-8 animate-pop-in">
          <h1 class="text-4xl font-extrabold uppercase">Ingresar</h1>
          <p class="mt-1 text-sm text-muted">Accedé para comprar y seguir tus pedidos.</p>

          <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
            <div>
              <label class="label" for="email">Email</label>
              <div class="relative">
                <app-icon name="mail" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input id="email" type="email" class="input pl-10" formControlName="email" autocomplete="email" placeholder="tu@email.com" />
              </div>
              <app-field-error [control]="form.controls.email" />
            </div>
            <div>
              <label class="label" for="password">Contraseña</label>
              <div class="relative">
                <app-icon name="lock" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input id="password" [type]="showPassword() ? 'text' : 'password'" class="input px-10" formControlName="password" autocomplete="current-password" />
                <button type="button" class="absolute top-1/2 right-3 -translate-y-1/2 text-muted hover:text-fg"
                        (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </div>
              <app-field-error [control]="form.controls.password" />
            </div>

            @if (error()) {
              <p class="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
                <app-icon name="circle-alert" [size]="16" /> {{ error() }}
              </p>
            }

            <button class="btn btn-primary w-full py-3" type="submit" [disabled]="loading()">
              @if (loading()) { <app-spinner /> } Ingresar
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-muted">
            ¿No tenés cuenta? <a routerLink="/registro" [queryParams]="{ returnUrl: returnUrl() }" class="font-semibold text-brand-600 hover:underline">Registrate</a>
          </p>
        </div>

        @if (demo.enabled()) {
          <div class="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm">
            <p class="flex items-center gap-2 font-semibold"><app-icon name="sparkles" [size]="16" class="text-brand-600" /> Acceso rápido a la demo</p>
            <p class="mt-1 mb-3 text-xs text-muted">Ingresá con un clic. Contraseña de todas las cuentas: <code>{{ demo.password() }}</code></p>
            <div class="grid gap-2 sm:grid-cols-3">
              @for (d of demo.accounts(); track d.email) {
                <button type="button" class="btn btn-secondary btn-sm flex-col items-center py-2" (click)="loginAs(d.email)" [disabled]="loading()"
                        [attr.aria-label]="'Ingresar como ' + d.label">
                  <span class="font-semibold">{{ d.label }}</span>
                  <span class="max-w-full truncate text-[11px] font-normal text-muted">{{ d.email }}</span>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly returnUrl = input<string>();

  protected readonly demo = inject(DemoStore);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected loginAs(email: string): void {
    this.form.setValue({ email, password: this.demo.password() ?? '' });
    this.submit();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: (user) => {
        this.toast.success(`¡Hola, ${user.fullName.split(' ')[0]}!`);
        const fallback = user.role === 'Client' ? '/' : '/admin';
        void this.router.navigateByUrl(this.safeReturnUrl() ?? fallback);
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'Email o contraseña incorrectos.'));
        this.loading.set(false);
      },
    });
  }

  /** Only local paths are allowed as return URLs (prevents open redirects). */
  private safeReturnUrl(): string | null {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { FieldError, Spinner } from '../../shared/components/ui';
import { matchFields, passwordScore, passwordStrength } from '../../shared/validators';

@Component({
  selector: 'app-password-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-2 flex gap-1">
      @for (i of [0, 1, 2, 3]; track i) {
        <span class="h-1.5 flex-1 rounded-full transition-colors" [class]="i < score() ? color() : 'bg-surface-2'"></span>
      }
    </div>
    <p class="mt-1 text-xs text-muted">{{ label() }}</p>
  `,
})
export class PasswordMeter {
  readonly value = input('');
  protected readonly score = computed(() => passwordScore(this.value()));
  protected readonly color = computed(() => ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'][this.score()]);
  protected readonly label = computed(() => ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'][this.score()]);
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, FieldError, Spinner, PasswordMeter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page grid min-h-[70dvh] place-items-center py-12">
      <div class="card w-full max-w-md p-8 animate-pop-in">
        <h1 class="text-4xl font-extrabold uppercase">Crear cuenta</h1>
        <p class="mt-1 text-sm text-muted">Registrate para comprar y seguir tus pedidos.</p>

        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <div>
            <label class="label" for="fullName">Nombre completo</label>
            <input id="fullName" class="input" formControlName="fullName" autocomplete="name" maxlength="150" />
            <app-field-error [control]="form.controls.fullName" />
          </div>
          <div>
            <label class="label" for="email">Email</label>
            <input id="email" type="email" class="input" formControlName="email" autocomplete="email" maxlength="150" />
            <app-field-error [control]="form.controls.email" />
          </div>
          <div>
            <label class="label" for="password">Contraseña</label>
            <input id="password" type="password" class="input" formControlName="password" autocomplete="new-password" />
            <app-password-meter [value]="passwordValue()" />
            <app-field-error [control]="form.controls.password" />
          </div>
          <div>
            <label class="label" for="repeat">Repetir contraseña</label>
            <input id="repeat" type="password" class="input" formControlName="repeatPassword" autocomplete="new-password" />
            <app-field-error [control]="form.controls.repeatPassword" />
          </div>

          @if (error()) {
            <p class="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
              <app-icon name="circle-alert" [size]="16" /> {{ error() }}
            </p>
          }

          <button class="btn btn-primary w-full py-3" type="submit" [disabled]="loading()">
            @if (loading()) { <app-spinner /> } Crear cuenta
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-muted">
          ¿Ya tenés cuenta? <a routerLink="/ingresar" class="font-semibold text-brand-600 hover:underline">Ingresá</a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly returnUrl = input<string>();
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      fullName: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      password: ['', [Validators.required, passwordStrength]],
      repeatPassword: ['', Validators.required],
    },
    { validators: matchFields('password', 'repeatPassword') },
  );

  protected readonly passwordValue = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const { fullName, email, password } = this.form.getRawValue();

    this.auth.register(fullName, email, password).subscribe({
      next: (user) => {
        this.toast.success('¡Cuenta creada!', `Bienvenido/a, ${user.fullName.split(' ')[0]}.`);
        const url = this.returnUrl();
        void this.router.navigateByUrl(url && url.startsWith('/') && !url.startsWith('//') ? url : '/');
      },
      error: (err) => {
        if (!applyServerErrors(this.form, err)) this.error.set(errorMessage(err));
        else if (err?.error?.code === 'auth.email_taken') this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}

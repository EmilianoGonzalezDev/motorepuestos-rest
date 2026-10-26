import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthApi } from '../../core/api/store.api';
import { AuthService } from '../../core/auth/auth.service';
import { DemoStore } from '../../core/demo/demo.store';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { FieldError, Spinner } from '../../shared/components/ui';
import { RolePipe } from '../../shared/pipes';
import { matchFields, passwordStrength } from '../../shared/validators';
import { PasswordMeter } from '../auth/register.page';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, Icon, FieldError, Spinner, RolePipe, PasswordMeter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.isCurrentUserDemo()) {
      <div class="mb-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <app-icon name="lock" [size]="18" class="mt-0.5 text-amber-600" />
        <div>
          <p class="font-semibold">Cuenta demo de solo lectura</p>
          <p class="text-muted">Para que la demo funcione para todos, el nombre, el email y la contraseña de las cuentas demo no se pueden cambiar. Registrá una cuenta propia para probar estas funciones.</p>
        </div>
      </div>
    }
    <div class="grid gap-6 lg:grid-cols-2">
      <form class="card space-y-4 p-6" [formGroup]="profile" (ngSubmit)="saveProfile()">
        <div class="flex items-center gap-4">
          <span class="grid size-14 place-items-center rounded-2xl bg-brand-500/15 font-display text-2xl font-bold text-brand-700 dark:text-brand-300">
            {{ auth.user()?.fullName?.charAt(0) }}
          </span>
          <div>
            <h2 class="text-2xl font-bold uppercase">Datos personales</h2>
            @if (auth.user(); as u) { <span class="badge bg-surface-2">{{ u.role | role }}</span> }
          </div>
        </div>
        <div>
          <label class="label" for="fullName">Nombre completo</label>
          <input id="fullName" class="input" formControlName="fullName" maxlength="150" />
          <app-field-error [control]="profile.controls.fullName" />
        </div>
        <div>
          <label class="label" for="email">Email</label>
          <input id="email" type="email" class="input" formControlName="email" maxlength="150" />
          <app-field-error [control]="profile.controls.email" />
        </div>
        <button class="btn btn-primary" [disabled]="savingProfile() || profile.pristine">
          @if (savingProfile()) { <app-spinner /> } @else { <app-icon name="save" [size]="16" /> } Guardar cambios
        </button>
      </form>

      <form class="card space-y-4 p-6" [formGroup]="password" (ngSubmit)="changePassword()">
        <h2 class="text-2xl font-bold uppercase">Cambiar contraseña</h2>
        <p class="text-sm text-muted">Por seguridad, se cerrarán tus sesiones en otros dispositivos.</p>
        <div>
          <label class="label" for="current">Contraseña actual</label>
          <input id="current" type="password" class="input" formControlName="currentPassword" autocomplete="current-password" />
          <app-field-error [control]="password.controls.currentPassword" />
        </div>
        <div>
          <label class="label" for="new">Nueva contraseña</label>
          <input id="new" type="password" class="input" formControlName="newPassword" autocomplete="new-password" />
          <app-password-meter [value]="newPasswordValue()" />
          <app-field-error [control]="password.controls.newPassword" />
        </div>
        <div>
          <label class="label" for="repeat">Repetir nueva contraseña</label>
          <input id="repeat" type="password" class="input" formControlName="repeatPassword" autocomplete="new-password" />
          <app-field-error [control]="password.controls.repeatPassword" />
        </div>
        <button class="btn btn-primary" [disabled]="savingPassword() || password.disabled">
          @if (savingPassword()) { <app-spinner /> } @else { <app-icon name="lock" [size]="16" /> } Actualizar contraseña
        </button>
      </form>
    </div>
  `,
})
export class ProfilePage {
  private readonly api = inject(AuthApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthService);
  protected readonly demo = inject(DemoStore);

  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);

  protected readonly profile = this.fb.group({
    fullName: [this.auth.user()?.fullName ?? '', [Validators.required, Validators.maxLength(150)]],
    email: [this.auth.user()?.email ?? '', [Validators.required, Validators.email, Validators.maxLength(150)]],
  });

  protected readonly password = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordStrength]],
      repeatPassword: ['', Validators.required],
    },
    { validators: matchFields('newPassword', 'repeatPassword') },
  );

  protected readonly newPasswordValue = toSignal(this.password.controls.newPassword.valueChanges, { initialValue: '' });

  constructor() {
    // The API rejects these changes for demo accounts anyway; disabling the forms explains it up front.
    effect(() => {
      const readOnly = this.demo.isCurrentUserDemo();
      for (const form of [this.profile, this.password]) {
        if (readOnly) form.disable();
        else form.enable();
      }
    });
  }

  protected saveProfile(): void {
    if (this.profile.invalid) return this.profile.markAllAsTouched();
    this.savingProfile.set(true);
    const { fullName, email } = this.profile.getRawValue();

    this.api.updateProfile(fullName, email).subscribe({
      next: (user) => {
        this.auth.updateUser(user);
        this.profile.markAsPristine();
        this.savingProfile.set(false);
        this.toast.success('Datos actualizados');
      },
      error: (err) => {
        if (!applyServerErrors(this.profile, err)) this.toast.error('No se pudieron guardar los datos', errorMessage(err));
        this.savingProfile.set(false);
      },
    });
  }

  protected changePassword(): void {
    if (this.password.invalid) return this.password.markAllAsTouched();
    this.savingPassword.set(true);
    const { currentPassword, newPassword } = this.password.getRawValue();

    this.api.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.password.reset();
        this.savingPassword.set(false);
        this.toast.success('Contraseña actualizada', 'Cerramos tus otras sesiones.');
      },
      error: (err) => {
        if (!applyServerErrors(this.password, err)) this.toast.error('No se pudo cambiar la contraseña', errorMessage(err));
        this.savingPassword.set(false);
      },
    });
  }
}

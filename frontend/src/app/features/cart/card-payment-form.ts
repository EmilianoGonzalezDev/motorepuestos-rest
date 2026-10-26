import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Icon } from '../../shared/components/icon';
import { FieldError } from '../../shared/components/ui';
import { cardExpiryValidator, cardNumberValidator, formatCardNumber, formatExpiry, testCard } from '../../shared/card';

/**
 * Simulated card payment for the demo. The fields are validated in the browser and never sent:
 * the order is placed with the payment type only. autocomplete is off so the browser doesn't
 * offer a real saved card.
 */
@Component({
  selector: 'app-card-payment-form',
  imports: [ReactiveFormsModule, Icon, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-5 space-y-4 rounded-2xl border border-line p-4" [formGroup]="form">
      <div class="flex gap-3 rounded-xl bg-amber-500/10 p-3 text-sm">
        <app-icon name="info" [size]="18" class="mt-0.5 shrink-0 text-amber-600" />
        <p><strong class="font-semibold">Pago simulado:</strong> no se realiza ningún cobro y los datos de la tarjeta no se envían al servidor. No ingreses datos reales.</p>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" (click)="fillTestCard()">
        <app-icon name="sparkles" [size]="15" /> Completar con tarjeta de prueba
      </button>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="card-holder">Nombre como figura en la tarjeta</label>
          <input id="card-holder" class="input" formControlName="holder" maxlength="60" autocomplete="off" />
          <app-field-error [control]="form.controls.holder" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="card-number">Número de tarjeta</label>
          <div class="relative">
            <app-icon name="credit-card" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input id="card-number" class="input pl-10 tabular-nums" formControlName="number" inputmode="numeric" maxlength="23"
                   autocomplete="off" placeholder="0000 0000 0000 0000" (input)="format('number')" />
          </div>
          <app-field-error [control]="form.controls.number" />
        </div>
        <div>
          <label class="label" for="card-expiry">Vencimiento</label>
          <input id="card-expiry" class="input tabular-nums" formControlName="expiry" inputmode="numeric" maxlength="5"
                 autocomplete="off" placeholder="MM/AA" (input)="format('expiry')" />
          <app-field-error [control]="form.controls.expiry" />
        </div>
        <div>
          <label class="label" for="card-cvc">Código de seguridad</label>
          <input id="card-cvc" type="password" class="input tabular-nums" formControlName="cvc" inputmode="numeric" maxlength="4"
                 autocomplete="off" placeholder="123" />
          <app-field-error [control]="form.controls.cvc" />
        </div>
      </div>
    </div>
  `,
})
export class CardPaymentForm {
  protected readonly form = inject(NonNullableFormBuilder).group({
    holder: ['', [Validators.required, Validators.maxLength(60)]],
    number: ['', [Validators.required, cardNumberValidator]],
    expiry: ['', [Validators.required, cardExpiryValidator()]],
    cvc: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  /** Shows every error and returns whether the card can be "charged". */
  validate(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }

  protected fillTestCard(): void {
    this.form.setValue(testCard());
  }

  protected format(field: 'number' | 'expiry'): void {
    const control = this.form.controls[field];
    const formatted = field === 'number' ? formatCardNumber(control.value) : formatExpiry(control.value);
    if (formatted !== control.value) control.setValue(formatted);
  }
}

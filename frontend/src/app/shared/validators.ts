import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';

/** Same rule as the API: 8+ chars with at least one letter and one digit. */
export const passwordStrength: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value as string) ?? '';
  if (!value) return null;
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) ? null : { passwordStrength: true };
};

/** Group validator: `field` must equal `matchField`; the error is set on `matchField`. */
export function matchFields(field: string, matchField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field);
    const b = group.get(matchField);
    if (!a || !b) return null;
    const mismatch = !!b.value && a.value !== b.value;
    const errors = { ...(b.errors ?? {}) };
    if (mismatch) errors['mismatch'] = true;
    else delete errors['mismatch'];
    b.setErrors(Object.keys(errors).length ? errors : null);
    return null;
  };
}

/** Debounced async validator that asks the API whether a value is available. */
export function availabilityValidator(check: (value: string) => Observable<boolean>, errorKey: string): AsyncValidatorFn {
  return (control: AbstractControl) => {
    const value = ((control.value as string) ?? '').trim();
    if (!value) return of(null);
    return timer(350).pipe(
      switchMap(() => check(value)),
      map((available) => (available ? null : { [errorKey]: true })),
      catchError(() => of(null)),
    );
  };
}

/** Password strength 0-4 for the meter shown while typing. */
export function passwordScore(value: string): number {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

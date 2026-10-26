import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';
import { ProblemDetails } from '../models/api.models';

/** Builds HttpParams skipping null/undefined/empty values; arrays become repeated keys. */
export function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params = params.append(key, String(item));
    } else {
      params = params.set(key, String(value));
    }
  }
  return params;
}

export function problemOf(error: unknown): ProblemDetails | null {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return error.error as ProblemDetails;
  }
  return null;
}

/** Human message for an API error (ProblemDetails title or a generic fallback). */
export function errorMessage(error: unknown, fallback = 'Ocurrió un error. Intentá nuevamente.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'No se pudo conectar con el servidor.';
    if (error.status === 429) return 'Demasiados intentos. Esperá un minuto e intentá nuevamente.';
  }
  return problemOf(error)?.title ?? fallback;
}

/**
 * Copies server-side validation errors (ProblemDetails.errors, camelCase keys) into the matching
 * form controls so they render next to each field. Returns true if any was applied.
 */
export function applyServerErrors(form: FormGroup, error: unknown): boolean {
  const errors = problemOf(error)?.errors;
  if (!errors) return false;

  let applied = false;
  for (const [field, messages] of Object.entries(errors)) {
    const control = form.get(field);
    if (control && messages.length) {
      control.setErrors({ ...(control.errors ?? {}), server: messages[0] });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}

/** First validation message for a control (used by <app-field-error>). */
export function controlErrorMessage(control: AbstractControl | null): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) return null;
  const e = control.errors;
  if (e['server']) return e['server'];
  if (e['required']) return 'Este campo es obligatorio.';
  if (e['email']) return 'Ingresá un email válido.';
  if (e['minlength']) return `Debe tener al menos ${e['minlength'].requiredLength} caracteres.`;
  if (e['maxlength']) return `No puede superar los ${e['maxlength'].requiredLength} caracteres.`;
  if (e['min']) return `El valor mínimo es ${e['min'].min}.`;
  if (e['max']) return `El valor máximo es ${e['max'].max}.`;
  if (e['pattern']) return 'El formato no es válido.';
  if (e['passwordStrength']) return 'Usá al menos 8 caracteres, con letras y números.';
  if (e['mismatch']) return 'Las contraseñas no coinciden.';
  if (e['nameTaken']) return 'Ya existe una categoría con ese nombre.';
  return 'Valor inválido.';
}

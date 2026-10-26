import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { applyServerErrors, controlErrorMessage, errorMessage, toParams } from './http-utils';

describe('toParams', () => {
  it('skips empty values and repeats array keys', () => {
    const params = toParams({ page: 2, search: '', categoryId: null, statuses: ['Pending', 'Prepared'], flag: false });

    expect(params.get('page')).toBe('2');
    expect(params.has('search')).toBe(false);
    expect(params.has('categoryId')).toBe(false);
    expect(params.getAll('statuses')).toEqual(['Pending', 'Prepared']);
    expect(params.get('flag')).toBe('false');
  });
});

describe('errorMessage', () => {
  it('prefers the ProblemDetails title', () => {
    const error = new HttpErrorResponse({ status: 409, error: { title: 'No hay stock suficiente' } });
    expect(errorMessage(error)).toBe('No hay stock suficiente');
  });

  it('explains connectivity and rate limit problems', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('conectar');
    expect(errorMessage(new HttpErrorResponse({ status: 429 }))).toContain('Demasiados');
  });

  it('falls back to a generic message', () => {
    expect(errorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});

describe('applyServerErrors', () => {
  it('puts server validation messages on the matching controls', () => {
    const form = new FormGroup({ email: new FormControl(''), name: new FormControl('') });
    const error = new HttpErrorResponse({ status: 400, error: { errors: { email: ['Ya está registrado'] } } });

    expect(applyServerErrors(form, error)).toBe(true);
    expect(controlErrorMessage(form.controls['email'])).toBe('Ya está registrado');
    expect(form.controls['name'].errors).toBeNull();
  });

  it('returns false when the response has no field errors', () => {
    const form = new FormGroup({ email: new FormControl('') });
    expect(applyServerErrors(form, new HttpErrorResponse({ status: 500 }))).toBe(false);
  });
});

describe('controlErrorMessage', () => {
  it('stays silent until the control is touched', () => {
    const control = new FormControl('', { nonNullable: true });
    control.setErrors({ required: true });
    expect(controlErrorMessage(control)).toBeNull();

    control.markAsTouched();
    expect(controlErrorMessage(control)).toBe('Este campo es obligatorio.');
  });
});

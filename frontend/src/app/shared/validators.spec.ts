import { FormControl, FormGroup } from '@angular/forms';
import { matchFields, passwordScore, passwordStrength } from './validators';

describe('passwordStrength', () => {
  it.each([
    ['Abcdef12', true],
    ['abcdefgh', false],
    ['12345678', false],
    ['Ab1', false],
  ])('%s -> valid=%s', (value, valid) => {
    expect(passwordStrength(new FormControl(value)) === null).toBe(valid);
  });

  it('ignores empty values (required handles those)', () => {
    expect(passwordStrength(new FormControl(''))).toBeNull();
  });
});

describe('matchFields', () => {
  const build = (a: string, b: string) =>
    new FormGroup({ password: new FormControl(a), repeat: new FormControl(b) }, { validators: matchFields('password', 'repeat') });

  it('flags the second control when values differ', () => {
    expect(build('Abcdef12', 'Abcdef13').controls['repeat'].errors).toEqual({ mismatch: true });
  });

  it('clears the error when they match', () => {
    const group = build('Abcdef12', 'x');
    group.controls['repeat'].setValue('Abcdef12');
    expect(group.controls['repeat'].errors).toBeNull();
  });
});

describe('passwordScore', () => {
  it('grows with length, mixed case and symbols', () => {
    expect(passwordScore('abc')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Abcdefgh1234')).toBe(3);
    expect(passwordScore('Abcdefgh12!4')).toBe(4);
  });
});

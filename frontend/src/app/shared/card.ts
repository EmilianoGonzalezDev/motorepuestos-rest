import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Helpers for the simulated card payment of the demo checkout. Card data is validated in the
 * browser only and never leaves it: the order is placed with the payment type alone.
 */

const onlyDigits = (value: string | null | undefined): string => (value ?? '').replace(/\D/g, '');

/** "4242424242424242" -> "4242 4242 4242 4242" (up to 19 digits). */
export function formatCardNumber(value: string): string {
  return onlyDigits(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" -> "12/28". */
export function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** 13-19 digits that pass the Luhn checksum. */
export function isValidCardNumber(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** "MM/AA" -> month and four-digit year, or null when the format is wrong. */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? { month, year: 2000 + Number(match[2]) } : null;
}

/** A card is valid through the last day of its expiry month. */
export function isExpired(month: number, year: number, now: Date): boolean {
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

export const cardNumberValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  !control.value || isValidCardNumber(control.value) ? null : { cardNumber: true };

export function cardExpiryValidator(now: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const expiry = parseExpiry(control.value);
    if (!expiry) return { cardExpiry: true };
    return isExpired(expiry.month, expiry.year, now()) ? { cardExpired: true } : null;
  };
}

/** Well-known test number (Visa 4242…) with an expiry two years ahead. */
export function testCard(now = new Date()): { holder: string; number: string; expiry: string; cvc: string } {
  const year = String((now.getFullYear() + 2) % 100).padStart(2, '0');
  return { holder: 'Juan Pérez', number: '4242 4242 4242 4242', expiry: `12/${year}`, cvc: '123' };
}

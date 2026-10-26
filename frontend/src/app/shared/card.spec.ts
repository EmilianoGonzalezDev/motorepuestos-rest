import { FormControl } from '@angular/forms';
import { cardExpiryValidator, formatCardNumber, formatExpiry, isExpired, isValidCardNumber, testCard } from './card';

describe('card helpers', () => {
  it('groups the card number in blocks of four', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('4242-42a')).toBe('4242 42');
    expect(formatExpiry('1228')).toBe('12/28');
  });

  it('validates numbers with the Luhn checksum', () => {
    expect(isValidCardNumber('4242 4242 4242 4242')).toBe(true);
    expect(isValidCardNumber('4242 4242 4242 4241')).toBe(false);
    expect(isValidCardNumber('4242')).toBe(false);
  });

  it('treats a card as valid through its expiry month', () => {
    const now = new Date(2026, 9, 26); // October 2026
    expect(isExpired(10, 2026, now)).toBe(false);
    expect(isExpired(9, 2026, now)).toBe(true);
    expect(isExpired(1, 2025, now)).toBe(true);
  });

  it('reports malformed and expired dates', () => {
    const validator = cardExpiryValidator(() => new Date(2026, 9, 26));
    expect(validator(new FormControl('13/28'))).toEqual({ cardExpiry: true });
    expect(validator(new FormControl('09/26'))).toEqual({ cardExpired: true });
    expect(validator(new FormControl('12/28'))).toBeNull();
  });

  it('builds a test card that passes every check', () => {
    const now = new Date(2026, 9, 26);
    const card = testCard(now);
    expect(isValidCardNumber(card.number)).toBe(true);
    expect(cardExpiryValidator(() => now)(new FormControl(card.expiry))).toBeNull();
  });
});

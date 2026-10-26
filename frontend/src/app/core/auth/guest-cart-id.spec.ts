import { GuestCartId } from './guest-cart-id';

describe('GuestCartId', () => {
  beforeEach(() => localStorage.clear());

  it('peek never creates an id', () => {
    const guest = new GuestCartId();
    expect(guest.peek()).toBeNull();
    expect(localStorage.getItem('mr_cart_id')).toBeNull();
  });

  it('value creates a stable GUID that peek can see', () => {
    const guest = new GuestCartId();
    const id = guest.value;

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(guest.value).toBe(id);
    expect(guest.peek()).toBe(id);
  });

  it('reset forgets the id so the next guest cart starts fresh', () => {
    const guest = new GuestCartId();
    const first = guest.value;

    guest.reset();

    expect(guest.peek()).toBeNull();
    expect(guest.value).not.toBe(first);
  });
});

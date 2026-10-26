import { ArsPipe, OrderStatusPipe, PaymentPipe, TimeAgoPipe } from './pipes';

describe('ArsPipe', () => {
  const pipe = new ArsPipe();

  it('formats Argentine pesos without decimals', () => {
    expect(pipe.transform(24000).replace(/\s/g, ' ')).toMatch(/^\$ ?24\.000$/);
  });

  it('returns an empty string for missing values', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});

describe('label pipes', () => {
  it('translates order statuses', () => {
    const pipe = new OrderStatusPipe();
    expect(pipe.transform('Pending')).toBe('Pendiente');
    expect(pipe.transform('Cancelled')).toBe('Cancelado');
  });

  it('translates payment types', () => {
    expect(new PaymentPipe().transform('BankTransfer')).toBe('Transferencia bancaria');
  });
});

describe('TimeAgoPipe', () => {
  it('describes past dates relatively', () => {
    const pipe = new TimeAgoPipe();
    const threeHoursAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(pipe.transform(threeHoursAgo)).toContain('3');
    expect(pipe.transform(null)).toBe('');
  });
});

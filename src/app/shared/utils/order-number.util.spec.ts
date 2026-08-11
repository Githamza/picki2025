import { generateOrderNumber, shortOrderNumber } from './order-number.util';

describe('generateOrderNumber', () => {
  it('formats as YYMMDD-XXXXXX with a 6-digit random suffix', () => {
    const number = generateOrderNumber(new Date(2026, 7, 7)); // 2026-08-07
    expect(number).toMatch(/^260807-\d{6}$/);
  });

  it('pads the date segments', () => {
    const number = generateOrderNumber(new Date(2026, 0, 3)); // 2026-01-03
    expect(number.startsWith('260103-')).toBeTrue();
  });

  it('pads the random suffix to 6 digits', () => {
    spyOn(Math, 'random').and.returnValue(0);
    expect(generateOrderNumber(new Date(2026, 7, 7))).toBe('260807-000000');
  });

  it('uses the full 6-digit space', () => {
    spyOn(Math, 'random').and.returnValue(0.9999999);
    expect(generateOrderNumber(new Date(2026, 7, 7))).toBe('260807-999999');
  });

  it('defaults to today when no date is given', () => {
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    expect(generateOrderNumber().startsWith(yy)).toBeTrue();
  });
});

describe('shortOrderNumber', () => {
  it('keeps the last 3 digits of the suffix', () => {
    expect(shortOrderNumber('260811-123456')).toBe('456');
  });

  it('ignores non-digit characters', () => {
    expect(shortOrderNumber('A-1042')).toBe('042');
  });

  it('falls back to the raw value when there are no digits', () => {
    expect(shortOrderNumber('SANS-CHIFFRES')).toBe('SANS-CHIFFRES');
  });
});

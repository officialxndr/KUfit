import { describe, it, expect } from '@jest/globals';
import {
  toDisplay, toKg, mlToDisplay, toMl, cmToFeetInches, feetInchesToCm, formatHeight, cmToDisplay, formatWeight, formatVolume,
} from '@/lib/units';

describe('weight', () => {
  it('converts kg ↔ lb and rounds the display to 0.1', () => {
    expect(toDisplay(100, 'IMPERIAL')).toBe(220.5);
    expect(toDisplay(72.46, 'METRIC')).toBe(72.5);
    expect(toKg(220.462, 'IMPERIAL')).toBeCloseTo(100, 3);
    expect(toKg(80, 'METRIC')).toBe(80);
  });

  it('formats weight and training volume', () => {
    expect(formatWeight(100, 'METRIC')).toBe('100 kg');
    expect(formatVolume(10_000, 'IMPERIAL')).toBe('22.0k lbs');
    expect(formatVolume(400, 'METRIC')).toBe('400 kg');
  });
});

describe('volume', () => {
  it('converts ml ↔ US fl oz', () => {
    expect(mlToDisplay(2000, 'IMPERIAL')).toBe(68);
    expect(toMl(8, 'IMPERIAL')).toBeCloseTo(236.6, 1);
  });
});

describe('height', () => {
  it('round-trips feet/inches', () => {
    expect(feetInchesToCm(5, 10)).toBe(177.8);
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 });
  });

  it(`never shows 12 inches (182.5 cm is 6'0", not 5'12")`, () => {
    expect(formatHeight(182.5, 'IMPERIAL')).toBe(`6'0"`);
    expect(cmToDisplay(182.5, 'IMPERIAL')).toBe(`6'0"`);
    expect(formatHeight(177.8, 'IMPERIAL')).toBe(`5'10"`);
    expect(formatHeight(180, 'METRIC')).toBe('180 cm');
  });
});

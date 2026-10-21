import { describe, expect, it } from 'vitest';
import { mergePieces } from '../voice';

describe('mergePieces (dictation without repeats)', () => {
  it('Android: each piece repeats the session so far', () => {
    expect(mergePieces(['remind me', 'remind me to call', 'Remind me to call the bank on Friday'])).toBe('Remind me to call the bank on Friday');
  });
  it('Android: a piece sent twice is kept once', () => {
    expect(mergePieces(['call the bank', 'call the bank', 'call the bank tomorrow'])).toBe('call the bank tomorrow');
  });
  it('desktop: separate pieces are joined', () => {
    expect(mergePieces(['call the bank', 'about the mortgage'])).toBe('call the bank about the mortgage');
  });
  it('the phrase in progress extends the finished text', () => {
    expect(mergePieces(['buy milk', 'buy milk and bre'])).toBe('buy milk and bre');
  });
  it('ignores punctuation and case when comparing', () => {
    expect(mergePieces(['Plătește factura.', 'plătește factura la EDF'])).toBe('plătește factura la EDF');
  });
  it('empty pieces are ignored', () => {
    expect(mergePieces(['', '  ', 'hello'])).toBe('hello');
  });
});

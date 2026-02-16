import { describe, it, expect } from 'vitest';
import { buildDeviceAuthPayload } from '../deviceIdentity';

describe('buildDeviceAuthPayload', () => {
  const baseParams = {
    deviceId: 'abc123',
    clientId: 'pinchchat-xyz',
    clientMode: 'webchat',
    role: 'operator',
    scopes: ['operator.chat', 'operator.admin'],
    signedAtMs: 1700000000000,
    token: 'mytoken',
  };

  it('builds v1 payload without nonce', () => {
    const result = buildDeviceAuthPayload(baseParams);
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator|operator.chat,operator.admin|1700000000000|mytoken',
    );
  });

  it('builds v2 payload with nonce', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, nonce: 'nonce42' });
    expect(result).toBe(
      'v2|abc123|pinchchat-xyz|webchat|operator|operator.chat,operator.admin|1700000000000|mytoken|nonce42',
    );
  });

  it('handles null token', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, token: null });
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator|operator.chat,operator.admin|1700000000000|',
    );
  });

  it('handles empty scopes', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, scopes: [] });
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator||1700000000000|mytoken',
    );
  });

  it('handles null nonce as v1', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, nonce: null });
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator|operator.chat,operator.admin|1700000000000|mytoken',
    );
  });

  it('handles undefined nonce as v1', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, nonce: undefined });
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator|operator.chat,operator.admin|1700000000000|mytoken',
    );
  });

  it('handles single scope', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, scopes: ['operator.chat'] });
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator|operator.chat|1700000000000|mytoken',
    );
  });

  it('handles empty nonce string as v2', () => {
    const result = buildDeviceAuthPayload({ ...baseParams, nonce: '' });
    // Empty string is falsy, so version should be v1
    expect(result).toBe(
      'v1|abc123|pinchchat-xyz|webchat|operator|operator.chat,operator.admin|1700000000000|mytoken',
    );
  });
});

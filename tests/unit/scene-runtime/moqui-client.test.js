'use strict';

const MoquiClient = require('../../../lib/scene-runtime/moqui-client');

describe('MoquiClient', () => {
  test('retries 429 responses and eventually succeeds', async () => {
    const client = new MoquiClient({
      baseUrl: 'http://localhost:8080',
      credentials: { username: 'demo', password: 'demo' },
      retryCount: 2,
      retryDelay: 0
    });

    client._httpRequest = jest
      .fn()
      .mockResolvedValueOnce({
        statusCode: 429,
        headers: { 'retry-after': '0' },
        body: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too Many Requests'
          }
        }
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: { ok: true }
      });

    const result = await client.request('GET', '/api/v1/entities/OrderHeader');

    expect(client._httpRequest).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      data: { ok: true },
      meta: {}
    });
  });

  test('returns RATE_LIMITED after retry budget is exhausted', async () => {
    const client = new MoquiClient({
      baseUrl: 'http://localhost:8080',
      credentials: { username: 'demo', password: 'demo' },
      retryCount: 1,
      retryDelay: 0
    });

    client._httpRequest = jest
      .fn()
      .mockResolvedValue({
        statusCode: 429,
        headers: { 'retry-after': '0' },
        body: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too Many Requests'
          }
        }
      });

    const result = await client.request('GET', '/api/v1/entities/OrderHeader');

    expect(client._httpRequest).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.error).toEqual(expect.objectContaining({
      code: 'RATE_LIMITED'
    }));
  });

  test('retries retryable network errors and eventually succeeds', async () => {
    const client = new MoquiClient({
      baseUrl: 'http://localhost:8080',
      credentials: { username: 'demo', password: 'demo' },
      retryCount: 2,
      retryDelay: 0
    });

    const networkError = new Error('socket reset');
    networkError.code = 'ECONNRESET';

    client._httpRequest = jest
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: { success: true, data: { id: 'order-1' } }
      });

    const result = await client.request('GET', '/api/v1/entities/OrderHeader');

    expect(client._httpRequest).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      data: { id: 'order-1' }
    });
  });
});
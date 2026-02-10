const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY = 1000;

const RETRYABLE_NETWORK_ERRORS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH'
];

function isRetryableNetworkError(error) {
  if (!error || !error.code) {
    return false;
  }

  return RETRYABLE_NETWORK_ERRORS.includes(error.code);
}

function isRetryableStatusCode(statusCode) {
  return statusCode >= 500 && statusCode <= 599;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQueryString(query) {
  if (!query || typeof query !== 'object') {
    return '';
  }

  const parts = [];

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

class MoquiClient {
  /**
   * @param {Object} config - Adapter_Config object
   * @param {string} config.baseUrl - Moqui instance root URL
   * @param {Object} config.credentials - { username, password }
   * @param {number} [config.timeout=30000] - Request timeout in ms
   * @param {number} [config.retryCount=2] - Max retry attempts for retryable errors
   * @param {number} [config.retryDelay=1000] - Delay between retries in ms
   */
  constructor(config = {}) {
    this.config = {
      baseUrl: String(config.baseUrl || '').replace(/\/+$/, ''),
      credentials: config.credentials || {},
      timeout: typeof config.timeout === 'number' ? config.timeout : DEFAULT_TIMEOUT,
      retryCount: typeof config.retryCount === 'number' ? config.retryCount : DEFAULT_RETRY_COUNT,
      retryDelay: typeof config.retryDelay === 'number' ? config.retryDelay : DEFAULT_RETRY_DELAY
    };

    this.accessToken = null;
    this.refreshTokenValue = null;
    this.authenticated = false;
  }

  /**
   * Low-level HTTP request using Node.js built-in http/https.
   * @param {string} method - HTTP method
   * @param {string} fullUrl - Complete URL to request
   * @param {Object} [options] - { body, headers, timeout }
   * @returns {Promise<{ statusCode, headers, body }>}
   */
  async _httpRequest(method, fullUrl, options = {}) {
    return new Promise((resolve, reject) => {
      let parsedUrl;

      try {
        parsedUrl = new URL(fullUrl);
      } catch (error) {
        reject(new Error(`Invalid URL: ${fullUrl}`));
        return;
      }

      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;
      const timeout = typeof options.timeout === 'number' ? options.timeout : this.config.timeout;

      const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      };

      let bodyData = null;

      if (options.body !== undefined && options.body !== null) {
        bodyData = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
        requestHeaders['Content-Length'] = Buffer.byteLength(bodyData);
      }

      const requestOptions = {
        method: method.toUpperCase(),
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: requestHeaders
      };

      let timedOut = false;
      const req = transport.request(requestOptions, (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (timedOut) {
            return;
          }

          const rawBody = Buffer.concat(chunks).toString('utf8');
          let parsedBody;

          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : null;
          } catch (error) {
            parsedBody = rawBody;
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody
          });
        });
      });

      if (timeout > 0) {
        req.setTimeout(timeout, () => {
          timedOut = true;
          req.destroy();
          reject(Object.assign(new Error(`Request timed out after ${timeout}ms`), { code: 'TIMEOUT' }));
        });
      }

      req.on('error', (error) => {
        if (timedOut) {
          return;
        }

        reject(error);
      });

      if (bodyData) {
        req.write(bodyData);
      }

      req.end();
    });
  }

  /**
   * Authenticate with Moqui and store JWT token pair.
   * POST /api/v1/auth/login { username, password }
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async login() {
    const url = `${this.config.baseUrl}/api/v1/auth/login`;
    const { username, password } = this.config.credentials;

    try {
      const response = await this._httpRequest('POST', url, {
        body: { username, password }
      });

      if (response.statusCode === 200 && response.body) {
        const body = response.body;

        if (body.accessToken && body.refreshToken) {
          this.accessToken = body.accessToken;
          this.refreshTokenValue = body.refreshToken;
          this.authenticated = true;
          return { success: true };
        }

        if (body.data && body.data.accessToken && body.data.refreshToken) {
          this.accessToken = body.data.accessToken;
          this.refreshTokenValue = body.data.refreshToken;
          this.authenticated = true;
          return { success: true };
        }
      }

      const errorMessage = (response.body && response.body.error && response.body.error.message)
        || (response.body && response.body.message)
        || `Login failed with status ${response.statusCode}`;

      this.accessToken = null;
      this.refreshTokenValue = null;
      this.authenticated = false;

      return { success: false, error: errorMessage };
    } catch (error) {
      this.accessToken = null;
      this.refreshTokenValue = null;
      this.authenticated = false;

      if (error.code === 'TIMEOUT') {
        return { success: false, error: `Login timed out after ${this.config.timeout}ms` };
      }

      if (isRetryableNetworkError(error)) {
        return { success: false, error: `Network error: ${error.message} (${url})` };
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh access token using stored refresh token.
   * POST /api/v1/auth/refresh { refreshToken }
   * @returns {Promise<boolean>} true if refresh succeeded
   */
  async refreshToken() {
    if (!this.refreshTokenValue) {
      return false;
    }

    const url = `${this.config.baseUrl}/api/v1/auth/refresh`;

    try {
      const response = await this._httpRequest('POST', url, {
        body: { refreshToken: this.refreshTokenValue }
      });

      if (response.statusCode === 200 && response.body) {
        const body = response.body;

        if (body.accessToken) {
          this.accessToken = body.accessToken;

          if (body.refreshToken) {
            this.refreshTokenValue = body.refreshToken;
          }

          this.authenticated = true;
          return true;
        }

        if (body.data && body.data.accessToken) {
          this.accessToken = body.data.accessToken;

          if (body.data.refreshToken) {
            this.refreshTokenValue = body.data.refreshToken;
          }

          this.authenticated = true;
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Invalidate current token pair.
   * POST /api/v1/auth/logout
   * @returns {Promise<void>}
   */
  async logout() {
    if (!this.accessToken) {
      this.authenticated = false;
      return;
    }

    const url = `${this.config.baseUrl}/api/v1/auth/logout`;

    try {
      await this._httpRequest('POST', url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
    } catch (error) {
      // Ignore logout errors silently
    }

    this.accessToken = null;
    this.refreshTokenValue = null;
    this.authenticated = false;
  }

  /**
   * Send authenticated HTTP request with retry logic.
   * Automatically handles 401 → refresh → retry flow.
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} path - API path (e.g., '/api/v1/entities/OrderHeader')
   * @param {Object} [options] - { body, query, headers }
   * @returns {Promise<Object>} Result object with success/error info
   */
  async request(method, path, options = {}) {
    const queryString = buildQueryString(options.query);
    const fullUrl = `${this.config.baseUrl}${path}${queryString}`;

    const requestHeaders = {
      ...(options.headers || {})
    };

    if (this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const requestOptions = {
      body: options.body,
      headers: requestHeaders,
      timeout: this.config.timeout
    };

    let lastError = null;
    const maxAttempts = this.config.retryCount + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await delay(this.config.retryDelay);
      }

      try {
        // Update auth header in case token was refreshed
        if (this.accessToken) {
          requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const response = await this._httpRequest(method, fullUrl, requestOptions);

        // Handle 401 — try refresh then re-login
        if (response.statusCode === 401) {
          const handled = await this._handle401();

          if (handled) {
            // Update auth header and retry the request once
            requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
            const retryResponse = await this._httpRequest(method, fullUrl, requestOptions);

            if (retryResponse.statusCode === 401) {
              return {
                success: false,
                error: {
                  code: 'AUTH_FAILED',
                  message: 'Authentication failed after token refresh and re-login'
                }
              };
            }

            return this._normalizeResponse(retryResponse);
          }

          return {
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: 'Authentication failed — token refresh and re-login both failed'
            }
          };
        }

        // Retry on 5xx
        if (isRetryableStatusCode(response.statusCode)) {
          lastError = {
            success: false,
            error: {
              code: 'MOQUI_ERROR',
              message: `Server error: ${response.statusCode}`,
              details: response.body
            }
          };
          continue;
        }

        // Success or non-retryable error
        return this._normalizeResponse(response);
      } catch (error) {
        if (error.code === 'TIMEOUT') {
          return {
            success: false,
            error: {
              code: 'TIMEOUT',
              message: `Request timed out after ${this.config.timeout}ms`
            }
          };
        }

        if (isRetryableNetworkError(error)) {
          lastError = {
            success: false,
            error: {
              code: 'NETWORK_ERROR',
              message: `Network error: ${error.message} (${fullUrl})`
            }
          };
          continue;
        }

        // Non-retryable error
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: `${error.message} (${fullUrl})`
          }
        };
      }
    }

    // All retries exhausted — return last error
    return lastError || {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Request failed after ${maxAttempts} attempts`
      }
    };
  }

  /**
   * Handle 401 response: try refresh → if fails try re-login.
   * @returns {Promise<boolean>} true if authentication was restored
   * @private
   */
  async _handle401() {
    // Step 1: Try token refresh
    const refreshed = await this.refreshToken();

    if (refreshed) {
      return true;
    }

    // Step 2: Try full re-login
    const loginResult = await this.login();

    return loginResult.success;
  }

  /**
   * Normalize an HTTP response into a standard result object.
   * @param {Object} response - { statusCode, headers, body }
   * @returns {Object} Normalized result
   * @private
   */
  _normalizeResponse(response) {
    const body = response.body;

    // If the body is already in Moqui response format
    if (body && typeof body === 'object' && typeof body.success === 'boolean') {
      return body;
    }

    // Successful HTTP status
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {
        success: true,
        data: body,
        meta: {}
      };
    }

    // Error HTTP status
    const errorInfo = (body && typeof body === 'object' && body.error) || {};

    return {
      success: false,
      error: {
        code: errorInfo.code || `HTTP_${response.statusCode}`,
        message: errorInfo.message || `Request failed with status ${response.statusCode}`,
        details: errorInfo.details || body
      }
    };
  }

  /**
   * Check if client is authenticated (has valid token pair).
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.authenticated && this.accessToken !== null;
  }

  /**
   * Dispose client resources and logout.
   * @returns {Promise<void>}
   */
  async dispose() {
    try {
      await this.logout();
    } catch (error) {
      // Ignore errors during dispose — silently clean up
    }

    this.accessToken = null;
    this.refreshTokenValue = null;
    this.authenticated = false;
  }
}

module.exports = MoquiClient;

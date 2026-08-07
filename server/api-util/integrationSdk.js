const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

/**
 * The Integration API client. Server-side only, always.
 *
 * This is a much bigger key than the Marketplace client secret already in .env. That one is
 * scoped by the acting user - Sharetribe enforces what they may see and do. This one is not
 * scoped at all: it reads and writes every listing, user and transaction in the marketplace
 * as operator. Sharetribe's own docs put it plainly - the Integration API "only has full
 * access or no access".
 *
 * It exists here because two things the alert fan-out must do are impossible without it:
 * finding who is watching an event (transactions.query only ever returns the requesting
 * user's own) and running operator transitions (the Marketplace API cannot).
 */

// A REACT_APP_ prefix is the one mistake that would be catastrophic and silent: Create React
// App inlines every REACT_APP_* variable into the browser bundle, so an operator-level
// secret would be readable by every visitor with no error anywhere. Fail the boot instead.
const forbiddenPrefixed = Object.keys(process.env).filter(
  k => k.startsWith('REACT_APP_') && k.includes('INTEGRATION')
);
if (forbiddenPrefixed.length > 0) {
  throw new Error(
    `Integration API credentials must never be REACT_APP_ prefixed - that publishes them ` +
      `into the browser bundle. Rename these and rotate them, they are compromised: ` +
      `${forbiddenPrefixed.join(', ')}`
  );
}

const CLIENT_ID = process.env.SHARETRIBE_INTEGRATION_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET;

/**
 * True when the Integration API is configured. Callers should check this rather than
 * assume: a deploy without these variables should degrade visibly, not throw on boot.
 */
exports.hasIntegrationSdk = () => !!CLIENT_ID && !!CLIENT_SECRET;

let cached = null;

/**
 * Returns the Integration SDK, or null when unconfigured.
 *
 * Rate limiters are attached from the start. Sharetribe recommends the production limiters
 * even in production, and the fan-out is the one place that issues a burst of commands -
 * one operator transition per watcher. Concurrency limiting is built into the SDK itself
 * from 1.9.0 onwards; these cover the request-rate side.
 */
exports.getIntegrationSdk = () => {
  if (!exports.hasIntegrationSdk()) {
    return null;
  }
  if (cached) {
    return cached;
  }
  const { util } = sharetribeIntegrationSdk;
  cached = sharetribeIntegrationSdk.createInstance({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    queryLimiter: util.createRateLimiter(util.prodQueryLimiterConfig),
    commandLimiter: util.createRateLimiter(util.prodCommandLimiterConfig),
  });
  return cached;
};

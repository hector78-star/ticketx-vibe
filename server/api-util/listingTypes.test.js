const fs = require('fs');
const path = require('path');

const { TICKET_LISTING_TYPE, EVENT_LISTING_TYPE, OTHER_LISTING_TYPE } = require('./listingTypes');

/**
 * server/ and src/ are separate module trees, so the listing type identifiers have to be
 * written out in both. This test is what stops them drifting.
 *
 * It matters more than a normal duplication check because the identifiers do not say what
 * they are: tickets are 'sell-products' and everything else is 'sell-other'. If someone
 * renames the client constant, the server keeps filtering on the old string, the Sharetribe
 * query returns an empty set rather than an error, and every watcher alert silently stops.
 * Nothing in production would surface that. This does, at build time.
 */
describe('listing type identifiers stay in sync with the client config', () => {
  const configPath = path.join(__dirname, '..', '..', 'src', 'config', 'configListing.js');
  const source = fs.readFileSync(configPath, 'utf8');

  // Read the literal out of the export rather than importing it: configListing.js is ESM
  // with JSX-era syntax that this CommonJS/node test environment will not parse.
  const literalFor = name => {
    const match = source.match(new RegExp(`export const ${name}\\s*=\\s*'([^']+)'`));
    return match ? match[1] : null;
  };

  it('finds the constants it is checking (guards against the regex silently missing)', () => {
    expect(literalFor('TICKET_LISTING_TYPE')).not.toBeNull();
    expect(literalFor('EVENT_LISTING_TYPE')).not.toBeNull();
    expect(literalFor('OTHER_LISTING_TYPE')).not.toBeNull();
  });

  it('TICKET_LISTING_TYPE matches configListing.js', () => {
    expect(TICKET_LISTING_TYPE).toBe(literalFor('TICKET_LISTING_TYPE'));
  });

  it('EVENT_LISTING_TYPE matches configListing.js', () => {
    expect(EVENT_LISTING_TYPE).toBe(literalFor('EVENT_LISTING_TYPE'));
  });

  it('OTHER_LISTING_TYPE matches configListing.js', () => {
    expect(OTHER_LISTING_TYPE).toBe(literalFor('OTHER_LISTING_TYPE'));
  });

  it('the three types are distinct, so a ticket is never mistaken for other goods', () => {
    const all = [TICKET_LISTING_TYPE, EVENT_LISTING_TYPE, OTHER_LISTING_TYPE];
    expect(new Set(all).size).toBe(3);
  });

  it('tickets are sell-products, which is the whole reason this file exists', () => {
    // Pinned deliberately. If this ever legitimately changes, the failure should make
    // someone read the comment in listingTypes.js before updating both sides.
    expect(TICKET_LISTING_TYPE).toBe('sell-products');
  });
});

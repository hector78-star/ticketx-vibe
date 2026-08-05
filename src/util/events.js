/**
 * TicketX event catalog.
 *
 * An event is a listing of type 'event' authored by the admin account. Ticket listings point at
 * one through publicData.eventId. Everything that needs to read the catalog goes through here so
 * the querying rules live in exactly one place.
 */
import { createImageVariantConfig } from './sdkLoader';
import { EVENT_LISTING_TYPE, TICKET_LISTING_TYPE } from '../config/configListing';

/**
 * The curating account.
 *
 * Admin curates the catalog, but sellers may also add an event on the fly when theirs is missing -
 * a missing event would otherwise block a sale entirely. Seller-created events go live immediately
 * and are flagged (publicData.curated === false) so admin can adopt or tidy them later.
 *
 * This id therefore no longer gates what the catalog returns. It gates the admin Events tab and
 * marks which events are admin-curated.
 */
export const ADMIN_USER_ID = process.env.REACT_APP_ADMIN_USER_ID;

export const hasAdminConfigured = () => !!ADMIN_USER_ID;

const EVENT_FIELDS = [
  'title',
  'description',
  'deleted',
  'state',
  'publicData.listingType',
  'publicData.eventDate',
  'publicData.eventTime',
  'publicData.venue',
  'publicData.faceValue',
  'publicData.lastSoldPrice',
  'publicData.curated',
];

// Event images are reused wherever a ticket is rendered, including the listing page's gallery, so
// they must be fetched with the same variants a listing would be. Requesting only the card
// variants leaves the gallery with no variant it can render and the image breaks.
const imageParams = (config, variantPrefix = 'listing-card') => {
  const { aspectWidth = 1, aspectHeight = 1 } = config?.layout?.listingImage || {};
  const aspectRatio = aspectHeight / aspectWidth;
  return {
    'fields.image': [
      // Scaled variants, used by the listing page gallery
      'variants.scaled-small',
      'variants.scaled-medium',
      'variants.scaled-large',
      'variants.scaled-xlarge',
      // Cropped variants, used by listing cards
      `variants.${variantPrefix}`,
      `variants.${variantPrefix}-2x`,
    ],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
    'limit.images': 1,
  };
};

/**
 * Query the curated event catalog.
 *
 * pub_listingType is indexed by Sharetribe by default, so this needs no custom search schema.
 * Both admin-curated and seller-created events are returned - a seller must be able to find an
 * event another seller just added.
 */
export const queryEvents = (sdk, config, params = {}) => {
  return sdk.listings.query({
    pub_listingType: EVENT_LISTING_TYPE,
    include: ['images'],
    'fields.listing': EVENT_FIELDS,
    ...imageParams(config),
    ...params,
  });
};

// How much of the ticket inventory to scan when collecting one event's tickets. 5 x 100 = 500
// tickets, which is far beyond what this marketplace holds today.
export const TICKET_SCAN_PAGE_SIZE = 100;
export const MAX_TICKET_SCAN_PAGES = 5;

/**
 * Query the tickets on sale for one event, cheapest first.
 *
 * Filtering by pub_eventId does NOT work, and this was verified rather than assumed: querying
 * with a deliberately invalid eventId returned the full ticket list instead of nothing. The API
 * accepts the parameter and silently ignores it, because Sharetribe holds no search index for the
 * key and an index cannot be created from local config.
 *
 * So the association is resolved client-side: page through ticket listings and keep the ones whose
 * publicData.eventId matches. The '-price' sort still runs server-side across all tickets, and
 * filtering a sorted list preserves its order, so results stay correctly ordered - this does not
 * degrade into sorting one page in isolation.
 *
 * The limitation is reach, not correctness: beyond MAX_TICKET_SCAN_PAGES x TICKET_SCAN_PAGE_SIZE
 * tickets, later ones stop being seen. `scannedEverything` in the return value reports whether the
 * whole inventory was covered. The real fix is a search index on eventId, set through Sharetribe
 * CLI or Console; once that exists, this reverts to a one-line server-side filter.
 */
export const queryTicketsForEvent = async (sdk, config, eventId, params = {}) => {
  const responses = [];
  const matched = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await sdk.listings.query({
      pub_listingType: TICKET_LISTING_TYPE,
      // configSearch.js already defines '-price' as the "lowest price" sort.
      sort: '-price',
      perPage: TICKET_SCAN_PAGE_SIZE,
      page,
      include: ['author', 'images'],
      'fields.listing': [
        'title',
        'price',
        'deleted',
        'state',
        'publicData.listingType',
        'publicData.eventId',
      ],
      'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
      ...imageParams(config),
      ...params,
    });

    responses.push(response);
    totalPages = response.data.meta?.totalPages ?? 1;
    matched.push(
      ...response.data.data.filter(l => l.attributes?.publicData?.eventId === eventId)
    );
    page += 1;
  } while (page <= totalPages && page <= MAX_TICKET_SCAN_PAGES);

  return { responses, listings: matched, scannedEverything: totalPages <= MAX_TICKET_SCAN_PAGES };
};

/**
 * Format a YYYYMMDD integer as a readable date. Listing fields have no date type, so the catalog
 * stores dates as sortable integers - see the eventDate field in configListing.js.
 */
export const formatEventDate = (yyyymmdd, locale = 'en-GB') => {
  if (!yyyymmdd) {
    return null;
  }
  const s = String(yyyymmdd);
  if (s.length !== 8) {
    return null;
  }
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6));
  const day = Number(s.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

/**
 * Format integer minor units as currency. Face value and last-sold are plain integers rather than
 * Sharetribe Money objects, because they are guidance shown to a seller and never transacted.
 */
export const formatPence = (pence, currency = 'GBP', locale = 'en-GB') => {
  if (pence == null || Number.isNaN(Number(pence))) {
    return null;
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(pence) / 100);
};

/** Pull the catalog fields off an event listing into a flat shape for rendering and autofill. */
export const eventSummary = listing => {
  if (!listing) {
    return null;
  }
  const { title } = listing.attributes || {};
  const pd = listing.attributes?.publicData || {};
  return {
    id: listing.id?.uuid,
    title,
    eventDate: pd.eventDate,
    eventTime: pd.eventTime,
    venue: pd.venue,
    faceValue: pd.faceValue,
    lastSoldPrice: pd.lastSoldPrice,
    // false for events a seller added on the fly; admin can adopt them later.
    curated: pd.curated !== false,
    authorId: listing.author?.id?.uuid,
  };
};

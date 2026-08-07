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
  'publicData.soldCount',
  'publicData.curated',
];

/** Today as the same sortable YYYYMMDD integer that eventDate uses. */
export const todayAsEventDate = (now = new Date()) =>
  now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

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
 * Query the curated event catalog, soonest event first.
 *
 * pub_listingType is indexed by Sharetribe by default. eventDate needs a search schema, which is
 * set (`flex-cli search set --key eventDate --type long --scope public`); without it the API
 * accepts `sort` and `pub_eventDate` and silently ignores both, which is how this previously ended
 * up rendering the catalog in creation order.
 *
 * NOTE the sort direction. In Sharetribe a bare field name sorts DESCENDING and the '-' prefix
 * sorts ASCENDING - the opposite of the usual convention, and why configSearch.js labels '-price'
 * as "lowest price". Soonest-first is therefore '-pub_eventDate', verified against the live API.
 *
 * Events that have already happened are excluded by default: a resale catalog led by last term's
 * balls is worse than useless. Pass `includePast: true` for the admin view, which has to be able
 * to see and tidy everything.
 */
export const queryEvents = (sdk, config, params = {}) => {
  const { includePast = false, ...rest } = params;
  // Fetching explicit ids is a lookup, not a browse: EventPage resolves one event this way, and
  // applying the date filter there would 404 the page for any event that has already happened.
  const isLookup = !!rest.ids;
  const fromToday = includePast || isLookup ? {} : { pub_eventDate: `${todayAsEventDate()},` };
  return sdk.listings.query({
    pub_listingType: EVENT_LISTING_TYPE,
    sort: '-pub_eventDate',
    ...fromToday,
    // author so the UI can tell whether the current user created this event: Sharetribe
    // refuses transactions where customer and listing author are the same person, which
    // includes setting an alert on an event you added yourself.
    include: ['author', 'images'],
    'fields.listing': EVENT_FIELDS,
    ...imageParams(config),
    ...rest,
  });
};

// Tickets shown on one event page. 100 is the API's maximum page size; an event with more tickets
// than this needs pagination in the UI, not a bigger number here.
export const TICKETS_PER_PAGE = 100;

/**
 * Query the tickets on sale for one event, cheapest first.
 *
 * This used to page through the whole ticket inventory and match eventId client-side, because
 * `pub_eventId` was silently ignored: Sharetribe accepts an unindexed filter and returns
 * everything. A search schema now exists for the key, so the filter is real:
 *
 *   flex-cli search set --key eventId --type enum --scope public -m <marketplace>
 *
 * Verified against the live API rather than assumed - a deliberately invalid eventId returns 0
 * results where it previously returned the full catalog. That test is the only reliable way to
 * tell a working filter from an ignored one, so use it if this ever looks wrong again.
 *
 * The old scan capped out at 500 tickets; this has no such ceiling.
 */
const TICKET_CARD_FIELDS = [
  'title',
  'price',
  'deleted',
  'state',
  'publicData.listingType',
  'publicData.eventId',
  'publicData.ticketType',
  'publicData.ticketPlatform',
];

// profile.publicData carries the seller's published reputation - see SELLER_STATS_KEY in
// util/sellerStats.js. Without it every ticket card would need its own reviews request.
const TICKET_AUTHOR_FIELDS = [
  'profile.displayName',
  'profile.abbreviatedName',
  'profile.publicData',
];

/**
 * Tickets for any of the given events, cheapest first.
 *
 * `pub_eventId` has an `enum` schema, and enum filters take a comma-separated list with OR
 * semantics, so a set of events costs one request rather than one per event.
 */
export const queryTicketsForEvents = async (sdk, config, eventIds, params = {}) => {
  const ids = (eventIds || []).filter(Boolean);
  if (ids.length === 0) {
    return { responses: [], listings: [] };
  }

  const response = await sdk.listings.query({
    pub_listingType: TICKET_LISTING_TYPE,
    pub_eventId: ids.join(','),
    // Sold tickets are still published listings - selling one drops its stock to 0, it does
    // not close or delete it - so without this a sold ticket sits in the list at its old
    // price forever. Every caller of this function wants tickets somebody can actually buy:
    // the event page's list and the browse page's "other tickets" both come through here.
    //
    // stockMode is left at its default of 'strict', which is what we want. Tickets always
    // have stock defined (the ticket listing type is multipleItems), so strict matches them,
    // and anything without stock is not a ticket and has no business in this result.
    minStock: 1,
    // configSearch.js already defines '-price' as the "lowest price" sort.
    sort: '-price',
    perPage: TICKETS_PER_PAGE,
    include: ['author', 'images'],
    'fields.listing': TICKET_CARD_FIELDS,
    'fields.user': TICKET_AUTHOR_FIELDS,
    ...imageParams(config),
    ...params,
  });

  // Belt and braces. The server-side filter is doing the real work, but a missing search schema
  // fails *silently* - the API accepts pub_eventId and returns everything - so this asserts the
  // result rather than trusting it. If the index is ever unset, callers show nothing instead of
  // showing every ticket on the marketplace under one event.
  const wanted = new Set(ids);
  const listings = response.data.data.filter(l => wanted.has(l.attributes?.publicData?.eventId));

  return { responses: [response], listings };
};

export const queryTicketsForEvent = async (sdk, config, eventId, params = {}) => {
  const { responses, listings } = await queryTicketsForEvents(sdk, config, [eventId], params);
  const totalPages = responses[0]?.data?.meta?.totalPages ?? 1;
  return { responses, listings, scannedEverything: totalPages <= 1 };
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
    // Admin-maintained. null and 0 mean different things here (not tracked vs none sold), so this
    // deliberately does not coerce to a number.
    soldCount: pd.soldCount,
    // false for events a seller added on the fly; admin can adopt them later.
    curated: pd.curated !== false,
    authorId: listing.author?.id?.uuid,
  };
};

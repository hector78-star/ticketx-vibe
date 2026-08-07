/**
 * Listing type identifiers and the publicData keys the server filters on.
 *
 * WHY THIS FILE DUPLICATES src/config/configListing.js
 *
 * server/ and src/ are separate module trees - server code never imports from src, and the
 * client bundle is built by webpack while the server runs as plain CommonJS. So the values
 * cannot be shared; they have to be written out twice.
 *
 * That is dangerous here in a specific way. The ticket listing type is identified by the
 * string 'sell-products', a leftover from the upstream template, and "everything else" is
 * 'sell-other'. Neither name says what it is. Anyone writing a server-side filter from
 * memory reaches for 'ticket', the query matches nothing, no error is raised, and the
 * feature silently does nothing - the same class of failure as the unindexed pub_ filters
 * in HANDOFF.md §5.3.
 *
 * listingTypes.test.js reads configListing.js and fails if these drift apart. That test is
 * the actual protection; this comment is only the explanation.
 */

// Tickets. Named 'sell-products' upstream - it is NOT a generic products type.
exports.TICKET_LISTING_TYPE = 'sell-products';

// The curated event catalogue. Tickets point at one of these through publicData.eventId.
exports.EVENT_LISTING_TYPE = 'event';

// Everything that is not a ticket: t-shirts, textbooks, whatever else students sell.
exports.OTHER_LISTING_TYPE = 'sell-other';

/**
 * publicData keys the server reads.
 *
 * Every ticket carries ONLY eventId - the denormalised title/date/venue that EventPicker
 * writes onto the form are configured for the EVENT listing type, so the save path strips
 * them from tickets (HANDOFF.md §5.5). Resolve everything else through the event.
 */
exports.PUBLIC_DATA_KEYS = {
  listingType: 'listingType',
  eventId: 'eventId',
};

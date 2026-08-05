/////////////////////////////////////////////////////////
// Configurations related to listing.                  //
// Main configuration here is the extended data config //
/////////////////////////////////////////////////////////

// Note: The listingFields come from listingFields asset nowadays by default.
//       To use this built-in configuration, you need to change the overwrite from configHelper.js
//       (E.g. use mergeDefaultTypesAndFieldsForDebugging func)

/**
 * Configuration options for listing fields (custom extended data fields):
 * - key:                           Unique key for the extended data field.
 * - scope (optional):              Scope of the extended data can be 'public', 'private', or 'metadata'.
 *                                  Default value: 'public'.
 *                                  Note: listing doesn't support 'protected' scope atm.
 * - schemaType (optional):         Schema for this extended data field.
 *                                  This is relevant when rendering components and querying listings.
 *                                  Possible values: 'enum', 'multi-enum', 'text', 'long', 'boolean'.
 * - enumOptions (optional):        Options shown for 'enum' and 'multi-enum' extended data.
 *                                  These are used to render options for inputs and filters on
 *                                  EditListingPage, ListingPage, and SearchPage.
 * - listingTypeConfig (optional):  Relationship configuration against listing types.
 *   - limitToListingTypeIds:         Indicator whether this listing field is relevant to a limited set of listing types.
 *   - listingTypeIds:                An array of listing types, for which this custom listing field is
 *                                    relevant and should be added. This is mandatory if limitToListingTypeIds is true.
 * - categoryConfig (optional):     Relationship configuration against categories.
 *   - limitToCategoryIds:            Indicator whether this listing field is relevant to a limited set of categories.
 *   - categoryIds:                   An array of categories, for which this custom listing field is
 *                                    relevant and should be added. This is mandatory if limitToCategoryIds is true.
 * - filterConfig:                  Filter configuration for listings query.
 *    - indexForSearch (optional):    If set as true, it is assumed that the extended data key has
 *                                    search index in place. I.e. the key can be used to filter
 *                                    listing queries (then scope needs to be 'public').
 *                                    Note: Sharetribe CLI can be used to set search index for the key:
 *                                    https://www.sharetribe.com/docs/references/extended-data/#search-schema
 *                                    Read more about filtering listings with public data keys from API Reference:
 *                                    https://www.sharetribe.com/api-reference/marketplace.html#extended-data-filtering
 *                                    Default value: false,
 *   - filterType:                    Sometimes a single schemaType can be rendered with different filter components.
 *                                    For 'enum' schema, filterType can be 'SelectSingleFilter' or 'SelectMultipleFilter'
 *   - label:                         Label for the filter, if the field can be used as query filter
 *   - searchMode (optional):         Search mode for indexed data with multi-enum schema.
 *                                    Possible values: 'has_all' or 'has_any'.
 *   - group:                         SearchPageWithMap has grouped filters. Possible values: 'primary' or 'secondary'.
 * - showConfig:                    Configuration for rendering listing. (How the field should be shown.)
 *   - label:                         Label for the saved data.
 *   - isDetail                       Can be used to hide detail row (of type enum, boolean, or long) from listing page.
 *                                    Default value: true,
 * - saveConfig:                    Configuration for adding and modifying extended data fields.
 *   - label:                         Label for the input field.
 *   - placeholderMessage (optional): Default message for user input.
 *   - isRequired (optional):         Is the field required for providers to fill
 *   - requiredMessage (optional):    Message for those fields, which are mandatory.
 */
// TicketX: the event catalog.
//
// An event is a listing of type 'event' authored by the admin account. A ticket listing points
// at one via publicData.eventId. Admin curates events; sellers only ever pick from them.
//
// Money fields are stored as integer minor units (pence) to match how Sharetribe handles money
// and to keep them clear of float rounding.
export const TICKET_LISTING_TYPE = 'sell-products';
export const EVENT_LISTING_TYPE = 'event';

export const listingFields = [
  // ---------------------------------------------------------------------------
  // Event fields. Admin-facing: these render as inputs when the admin account
  // creates an event, and as details on the event page.
  // ---------------------------------------------------------------------------
  {
    key: 'eventDate',
    scope: 'public',
    schemaType: 'long',
    // Listing fields have no date type, so the date is a sortable integer in YYYYMMDD form
    // (20260914 = 14 Sep 2026). Free text could not be ordered chronologically and epoch
    // milliseconds could not realistically be typed by a human.
    numberConfig: { minimum: 20000101, maximum: 21001231 },
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [EVENT_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Date' },
    showConfig: { label: 'Date', isDetail: true },
    saveConfig: {
      label: 'Event date (YYYYMMDD)',
      placeholderMessage: 'e.g. 20260914 for 14 Sep 2026',
      isRequired: true,
      requiredMessage: 'An event needs a date.',
    },
  },
  {
    key: 'eventTime',
    scope: 'public',
    schemaType: 'text',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [EVENT_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Start time' },
    showConfig: { label: 'Start time', isDetail: true },
    saveConfig: { label: 'Start time', placeholderMessage: 'e.g. 19:30' },
  },
  {
    key: 'venue',
    scope: 'public',
    schemaType: 'text',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [EVENT_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Venue' },
    showConfig: { label: 'Venue', isDetail: true },
    saveConfig: {
      label: 'Venue',
      placeholderMessage: 'e.g. O2 Academy Bristol',
      isRequired: true,
      requiredMessage: 'An event needs a venue.',
    },
  },
  {
    key: 'faceValue',
    scope: 'public',
    schemaType: 'long',
    numberConfig: { minimum: 0, maximum: 1000000 },
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [EVENT_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Face value' },
    showConfig: { label: 'Face value', isDetail: true },
    saveConfig: {
      label: 'Face value in pence',
      placeholderMessage: 'e.g. 4500 for £45.00',
      isRequired: true,
      requiredMessage: 'Sellers need a face value to price against.',
    },
  },
  {
    key: 'lastSoldPrice',
    scope: 'public',
    schemaType: 'long',
    numberConfig: { minimum: 0, maximum: 1000000 },
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [EVENT_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Last sold for' },
    showConfig: { label: 'Last sold for', isDetail: true },
    saveConfig: {
      label: 'Last sold price in pence',
      placeholderMessage: 'e.g. 6000 for £60.00',
      // Left optional: a freshly curated event has no sale history yet.
      isRequired: false,
    },
  },

  // ---------------------------------------------------------------------------
  // Ticket fields. Written by the event picker, never typed by a seller, so they
  // are excluded from the generic custom-field renderer in EditListingDetailsForm.
  // ---------------------------------------------------------------------------
  {
    key: 'eventId',
    scope: 'public',
    schemaType: 'text',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    // Deliberately no filterConfig. SearchPage's FilterComponent has no branch for schemaType
    // 'text', so marking this indexed registers a filter it cannot render and crashes the page.
    // Nothing is lost: the event page queries the SDK directly rather than through SearchPage,
    // and the server-side search index is a Sharetribe-side concern that local config cannot
    // create in any case.
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Event' },
    showConfig: { label: 'Event', isDetail: false },
    saveConfig: { label: 'Event' },
  },
  {
    // Mandatory. Drives which attestation the seller must give, and tells the buyer what they are
    // getting - not how it is delivered, since handover is identical for all three.
    key: 'ticketType',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'mobile-transfer', label: 'Mobile transfer' },
      { option: 'pdf', label: 'Electronic (PDF)' },
      { option: 'physical', label: 'Physical' },
    ],
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    filterConfig: {
      indexForSearch: false,
      showFilter: false,
      label: 'Ticket type',
      filterType: 'SelectSingleFilter',
    },
    showConfig: { label: 'Ticket type', isDetail: true },
    saveConfig: {
      label: 'What kind of ticket is it?',
      isRequired: true,
      requiredMessage: 'Choose the kind of ticket you are selling.',
    },
  },
  {
    // Mobile transfer only: which provider the ticket lives on.
    key: 'ticketPlatform',
    scope: 'public',
    schemaType: 'text',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Ticket platform' },
    showConfig: { label: 'Transfers on', isDetail: true },
    saveConfig: { label: 'Which platform is the ticket on?' },
  },
  {
    key: 'transferabilityConfirmed',
    scope: 'public',
    schemaType: 'boolean',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Transferability confirmed' },
    showConfig: { label: 'Seller confirmed transferable', isDetail: false },
    saveConfig: { label: 'Transferability confirmed' },
  },
  {
    key: 'pdfAttestationConfirmed',
    scope: 'public',
    schemaType: 'boolean',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'PDF attestation' },
    showConfig: { label: 'Seller attested to PDF validity', isDetail: false },
    saveConfig: { label: 'PDF attestation' },
  },
  {
    key: 'physicalHandoverAcknowledged',
    scope: 'public',
    schemaType: 'boolean',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'Handover acknowledged' },
    showConfig: { label: 'Seller acknowledged handover', isDetail: false },
    saveConfig: { label: 'Handover acknowledgement' },
  },
  {
    // PRIVATE scope. Listing private data is readable only by the listing's author (and operator),
    // never by other users, so putting the number here keeps it off the public listing. Revealing
    // it to a buyer after purchase needs a server-side endpoint that checks for a paid transaction
    // - see the note in EditListingTicketFields.js. Storing it publicly would expose every
    // seller's phone number to anyone browsing, which is exactly what must not happen.
    key: 'whatsappNumber',
    scope: 'private',
    schemaType: 'text',
    listingTypeConfig: { limitToListingTypeIds: true, listingTypeIds: [TICKET_LISTING_TYPE] },
    filterConfig: { indexForSearch: false, showFilter: false, label: 'WhatsApp number' },
    showConfig: { label: 'WhatsApp number', isDetail: false },
    saveConfig: { label: 'Your WhatsApp number' },
  },
];

// Ticket type values. Handover is identical for all three - buyer and seller arrange it between
// themselves in the message thread or over WhatsApp - so the type drives the attestations the
// seller must give, not a delivery mechanism.
export const TICKET_TYPE_MOBILE = 'mobile-transfer';
export const TICKET_TYPE_PDF = 'pdf';
export const TICKET_TYPE_PHYSICAL = 'physical';

// Ticket fields that the event picker fills in from the chosen event. They are kept out of the
// seller-facing form entirely: sellers choose an event, they do not retype its details.
export const AUTOFILLED_TICKET_FIELDS = [
  'eventId',
  'eventTitle',
  'eventDate',
  'eventTime',
  'venue',
];

// Ticket fields rendered by EditListingTicketFields rather than the generic renderer, because they
// branch on the chosen ticket type: a seller should only be asked to attest to the thing they are
// actually selling.
export const BRANCHED_TICKET_FIELDS = [
  'ticketType',
  'ticketPlatform',
  'transferabilityConfirmed',
  'pdfAttestationConfirmed',
  'physicalHandoverAcknowledged',
  'whatsappNumber',
];

// Reference: the listing field shapes shipped with the template, kept as documentation.
//
  // {
  //   "scope": "public",
  //   "label": "Gears",
  //   "key": "gears",
  //   "schemaType": "long",
  //   "numberConfig": {
  //     "minimum": 1,
  //     "maximum": 24
  //   },
  //   "filterConfig": {
  //     "indexForSearch": true,
  //     "group": "primary",
  //     "label": "Gears"
  //   }
  // }
  // {
  //   key: 'bikeType',
  //   scope: 'public',
  //   schemaType: 'enum',
  //   enumOptions: [
  //     { option: 'city-bikes', label: 'City bikes' },
  //     { option: 'electric-bikes', label: 'Electric bikes' },
  //     { option: 'mountain-bikes', label: 'Mountain bikes' },
  //     { option: 'childrens-bikes', label: "Children's bikes" },
  //   ],
  //   categoryConfig: {
  //     limitToCategoryIds: true,
  //     categoryIds: ['cats'],
  //   },
  //   filterConfig: {
  //     showFilter: true,
  //     filterType: 'SelectMultipleFilter', //'SelectSingleFilter',
  //     label: 'Bike type',
  //     group: 'primary',
  //   },
  //   showConfig: {
  //     label: 'Bike type',
  //     isDetail: true,
  //   },
  //   saveConfig: {
  //     label: 'Bike type',
  //     placeholderMessage: 'Select an option…',
  //     isRequired: true,
  //     requiredMessage: 'You need to select a bike type.',
  //   },
  // },
  // {
  //   key: 'tire',
  //   scope: 'public',
  //   schemaType: 'enum',
  //   enumOptions: [
  //     { option: '29', label: '29' },
  //     { option: '28', label: '28' },
  //     { option: '27', label: '27' },
  //     { option: '26', label: '26' },
  //     { option: '24', label: '24' },
  //     { option: '20', label: '20' },
  //     { option: '18', label: '18' },
  //   ],
  //   filterConfig: {
  //     showFilter: true,
  //     label: 'Tire size',
  //     group: 'secondary',
  //   },
  //   showConfig: {
  //     label: 'Tire size',
  //     isDetail: true,
  //   },
  //   saveConfig: {
  //     label: 'Tire size',
  //     placeholderMessage: 'Select an option…',
  //     isRequired: true,
  //     requiredMessage: 'You need to select a tire size.',
  //   },
  // },
  // {
  //   key: 'brand',
  //   scope: 'public',
  //   schemaType: 'enum',
  //   enumOptions: [
  //     { option: 'cube', label: 'Cube' },
  //     { option: 'diamant', label: 'Diamant' },
  //     { option: 'ghost', label: 'GHOST' },
  //     { option: 'giant', label: 'Giant' },
  //     { option: 'kalkhoff', label: 'Kalkhoff' },
  //     { option: 'kona', label: 'Kona' },
  //     { option: 'otler', label: 'Otler' },
  //     { option: 'vermont', label: 'Vermont' },
  //   ],
  //   filterConfig: {
  //     showFilter: true,
  //     label: 'Brand',
  //     group: 'secondary',
  //   },
  //   showConfig: {
  //     label: 'Brand',
  //     isDetail: true,
  //   },
  //   saveConfig: {
  //     label: 'Brand',
  //     placeholderMessage: 'Select an option…',
  //     isRequired: true,
  //     requiredMessage: 'You need to select a brand.',
  //   },
  // },
  // {
  //   key: 'accessories',
  //   scope: 'public',
  //   schemaType: 'multi-enum',
  //   enumOptions: [
  //     { option: 'bell', label: 'Bell' },
  //     { option: 'lights', label: 'Lights' },
  //     { option: 'lock', label: 'Lock' },
  //     { option: 'mudguard', label: 'Mudguard' },
  //   ],
  //   filterConfig: {
  //     showFilter: true,
  //     label: 'Accessories',
  //     searchMode: 'has_all',
  //     group: 'secondary',
  //   },
  //   showConfig: {
  //     label: 'Accessories',
  //   },
  //   saveConfig: {
  //     label: 'Accessories',
  //     placeholderMessage: 'Select an option…',
  //     isRequired: false,
  //   },
  // },
  // // An example of how to use transaction type specific custom fields and private data.
  // {
  //   key: 'note',
  //   scope: 'public',
  //   schemaType: 'text',
  //   listingTypeConfig: {
  //     limitToListingTypeIds: true,
  //     listingTypeIds: ['product-selling'],
  //   },
  //   showConfig: {
  //     label: 'Extra notes',
  //   },
  //   saveConfig: {
  //     label: 'Extra notes',
  //     placeholderMessage: 'Some public extra note about this bike...',
  //   },
  // },
  // {
  //   key: 'privatenote',
  //   scope: 'private',
  //   schemaType: 'text',
  //   listingTypeConfig: {
  //     limitToListingTypeIds: true,
  //     listingTypeIds: ['daily-booking'],
  //   },
  //   saveConfig: {
  //     label: 'Private notes',
  //     placeholderMessage: 'Some private note about this bike...',
  //   },
  // },

///////////////////////////////////////////////////////////////////////
// Configurations related to listing types and transaction processes //
///////////////////////////////////////////////////////////////////////

// A presets of supported listing configurations
//
// Note 1: The listingTypes come from listingTypes asset nowadays by default.
//         To use this built-in configuration, you need to change the overwrite from configHelper.js
//         (E.g. use mergeDefaultTypesAndFieldsForDebugging func)
// Note 2: transaction type is part of listing type. It defines what transaction process and units
//         are used when transaction is created against a specific listing.

/**
 * Configuration options for listing experience:
 * - listingType:         Unique string. This will be saved to listing's public data on
 *                        EditListingWizard.
 * - label                Label for the listing type. Used as microcopy for options to select
 *                        listing type in EditListingWizard.
 * - transactionType      Set of configurations how this listing type will behave when transaction is
 *                        created.
 *   - process              Transaction process.
 *                          The process must match one of the processes that this client app can handle
 *                          (check src/util/transactions/transaction.js) and the process must also exists in correct
 *                          marketplace environment.
 *   - alias                Valid alias for the aforementioned process. This will be saved to listing's
 *                          public data as transctionProcessAlias and transaction is initiated with this.
 *   - unitType             Unit type is mainly used as pricing unit. This will be saved to
 *                          transaction's protected data.
 *                          Recommendation: don't use same unit types in completely different processes
 *                          ('item' sold should not be priced the same as 'item' booked).
 * - stockType            This is relevant only to listings using default-purchase process.
 *                        If set to 'oneItem', stock management is not showed and the listing is
 *                        considered unique (stock = 1).
 *                        Possible values: 'oneItem', 'multipleItems', 'infiniteOneItem', and 'infiniteMultipleItems'.
 *                        Default: 'multipleItems'.
 * - availabilityType     This is relevant only to listings using default-booking process.
 *                        If set to 'oneSeat', seat management is not showed and the listing is
 *                        considered per person (seat = 1).
 *                        Possible values: 'oneSeat' and 'multipleSeats'.
 *                        Default: 'oneSeat'.
 * - priceVariations      This is relevant only to listings using default-booking process.
 *   - enabled:             If set to true, price variations are enabled.
 *                          Default: false.
 * - defaultListingFields These are tied to transaction processes. Different processes have different flags.
 *                        E.g. default-inquiry can toggle price and location to true/false value to indicate,
 *                        whether price (or location) tab should be shown. If defaultListingFields.price is not
 *                        explicitly set to _false_, price will be shown.
 *                        If the location or pickup is not used, listing won't be returned with location search.
 *                        Use keyword search as main search type if location is not enforced.
 *                        The payoutDetails flag allows provider to bypass setting of payout details.
 *                        Note: customers can't order listings, if provider has not set payout details! Monitor
 *                        providers who have not set payout details and contact them to ensure that they add the details.
 * - transactionFields    You can define an array of custom transaction fields for each listing type. Each transaction field
 *                        should have the following attributes:
 *                        - key (string)
 *                        - label (string)
 *                        - showTo (string, options: 'customer', 'provider'). Option 'provider' is only used for negotiation process.
 *                        - schemaType (string, options: 'enum', 'multi-enum', 'text', 'long', 'boolean', 'youtubeVideoUrl')
 *                        - saveConfig (object, optional,  { required: true })
 *                        - schema specific attributes:
 *                          - numberConfig (object, for schemaType: 'long'): { minimum: number, maximum: number }
 *                          - enumOptions (array, for schemaType: 'enum', 'multi-enum'): [{ label: string, option: string }]
 * - messagingOptions     Options for the messaging experience
 *  - fileAttachments:    - if set to true, uploading file attachments to messages is enabled. Marketplace level access control
 *                          configuration may still disable uploading and downloading files, even if enabled in the listing type.
 */

export const listingTypes = [
  // TicketX: the curated event catalog.
  //
  // Only the 'event' type is declared locally. The five types configured in Console
  // (sell-products and friends) come through the hosted asset untouched - union() in
  // configHelpers.js lets local entries win by key, so restating them here would silently
  // override Console.
  //
  // An event is a catalog entry, never a thing anyone buys: default-inquiry is the lightest
  // process available and price, stock and availability are all switched off. Images are on
  // so the /events grid has something to show.
  {
    listingType: EVENT_LISTING_TYPE,
    label: 'Event',
    transactionType: {
      process: 'default-inquiry',
      alias: 'default-inquiry/release-1',
      unitType: 'inquiry',
    },
    defaultListingFields: {
      title: true,
      description: true,
      images: true,
      price: false,
      stock: false,
      availability: false,
      location: false,
      payoutDetails: false,
      shipping: false,
      pickup: false,
      files: false,
    },
  },

  // // Here are some examples of listingTypes
  // // TODO: SearchPage does not work well if both booking and product selling are used at the same time
  // {
  //   listingType: 'daily-booking',
  //   label: 'Daily booking',
  //   transactionType: {
  //     process: 'default-booking',
  //     alias: 'default-booking/release-1',
  //     unitType: 'day',
  //   },
  //   availabilityType: 'oneSeat',
  //   defaultListingFields: {
  //     location: true,
  //     payoutDetails: true,
  //   },
  //   transactionFields: [
  //     {
  //       showTo: 'customer',
  //       label: 'Extra requests for the hosts',
  //       key: 'requests',
  //       schemaType: 'text',
  //     },
  //     {
  //       showTo: 'customer',
  //       label: 'Are you traveling with minors?',
  //       key: 'minors',
  //       schemaType: 'boolean',
  //     },
  //     {
  //       showTo: 'customer',
  //       numberConfig: {
  //         minimum: 1,
  //         maximum: 10,
  //       },
  //       label: 'How many people are staying at the venue',
  //       key: 'peopleStaying',
  //       schemaType: 'long',
  //       saveConfig: {
  //         required: true,
  //       },
  //     },
  //     {
  //       showTo: 'customer',
  //       enumOptions: [
  //         {
  //           label: 'Morning cleanup (10am-12am)',
  //           option: 'morning',
  //         },
  //         {
  //           label: 'Afternoon cleanup (2pm-4pm)',
  //           option: 'afternoon',
  //         },
  //       ],
  //       label: 'Schedule preference',
  //       key: 'schedulePreference',
  //       schemaType: 'enum',
  //     },
  //     {
  //       showTo: 'customer',
  //       enumOptions: [
  //         {
  //           label: 'Vegetarian',
  //           option: 'vegetarian',
  //         },
  //         {
  //           label: 'Vegan',
  //           option: 'vegan',
  //         },
  //         {
  //           label: 'Gluten free',
  //           option: 'glutenFree',
  //         },
  //         {
  //           label: 'No caffeine',
  //           option: 'decaf',
  //         },
  //         {
  //           label: 'Nut free',
  //           option: 'nutFree',
  //         },
  //         {
  //           label: 'Dairy free',
  //           option: 'dairyFree',
  //         },
  //       ],
  //       label: 'Dietary preferences',
  //       key: 'dietaryPreferences',
  //       schemaType: 'multi-enum',
  //     },
  //   ],
  //   messagingOptions	{ fileAttachments: false }
  // },
  // {
  //   listingType: 'nightly-booking',
  //   label: 'Nightly booking',
  //   transactionType: {
  //     process: 'default-booking',
  //     alias: 'default-booking/release-1',
  //     unitType: 'night',
  //   },
  // },
  // {
  //   listingType: 'hourly-booking',
  //   label: 'Hourly booking',
  //   transactionType: {
  //     process: 'default-booking',
  //     alias: 'default-booking/release-1',
  //     unitType: 'hour',
  //   },
  // },
  // {
  //   listingType: 'product-selling',
  //   label: 'Sell bicycles',
  //   transactionType: {
  //     process: 'default-purchase',
  //     alias: 'default-purchase/release-1',
  //     unitType: 'item',
  //   },
  //   stockType: 'multipleItems',
  //   defaultListingFields: {
  //     shipping: true,
  //     pickup: true,
  //     payoutDetails: true,
  //   },
  // },
  // {
  //   listingType: 'inquiry',
  //   label: 'Inquiry',
  //   transactionType: {
  //     process: 'default-inquiry',
  //     alias: 'default-inquiry/release-1',
  //     unitType: 'inquiry',
  //   },
  //   defaultListingFields: {
  //     price: false,
  //     location: true,
  //   },
  // },
  //   {
  //   label: 'Digital file upload',
  //   listingType: 'digital-file',
  //   transactionType: {
  //     process: 'default-download',
  //     alias: 'default-download/release-1',
  //     unitType: 'file',
  //   },
  //   transactionFields: [
  //     {
  //       label: 'Arbitrary field',
  //       key: 'arbitrary',
  //       schemaType: 'shortText',
  //       showTo: 'customer',
  //       helpText: 'A text field with a 70 char limit',
  //     },
  //   ],
  //   defaultListingFields: {
  //     description: true,
  //     availability: false,
  //     payoutDetails: true,
  //     images: false,
  //     pickup: false,
  //     title: true,
  //     shipping: false,
  //     location: false,
  //     price: true,
  //     stock: false,
  //   },
  // },
];

// SearchPage can enforce listing query to only those listings with valid listingType
// However, it only works if you have set 'enum' type search schema for the public data fields
//   - listingType
//
//  Similar setup could be expanded to 2 other extended data fields:
//   - transactionProcessAlias
//   - unitType
//
// Read More:
// https://www.sharetribe.com/docs/how-to/manage-search-schemas-with-flex-cli/#adding-listing-search-schemas
export const enforceValidListingType = false;

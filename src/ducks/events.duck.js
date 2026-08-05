import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as log from '../util/log';
import { storableError } from '../util/errors';
import { addMarketplaceEntities } from './marketplaceData.duck';
import { queryEvents, hasAdminConfigured } from '../util/events';
import { EVENT_LISTING_TYPE } from '../config/configListing';

/**
 * TicketX event catalog.
 *
 * The curated list is small by nature - an admin hand-curates it - so the whole catalog is fetched
 * in one page and held in the store. The seller's event picker and the /events browse grid both
 * read from here rather than querying separately.
 */
const MAX_EVENT_COUNT = 100;

const fetchEventsPayloadCreator = async (arg, thunkAPI) => {
  const { extra: sdk, rejectWithValue, dispatch } = thunkAPI;
  const { config } = arg || {};

  if (!hasAdminConfigured()) {
    // Not an error worth logging to the error service: it is a configuration step, and the UI
    // surfaces it as a setup message rather than a failure.
    return rejectWithValue(
      storableError(new Error('REACT_APP_ADMIN_USER_ID is not set, so no events can be listed.'))
    );
  }

  return queryEvents(sdk, config, { perPage: MAX_EVENT_COUNT, page: 1 })
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      return { listingIds: response.data.data.map(l => l.id) };
    })
    .catch(error => {
      log.error(error, 'events-fetch-failed');
      return rejectWithValue(storableError(error));
    });
};

export const fetchEvents = createAsyncThunk('events/fetchEvents', fetchEventsPayloadCreator);

/**
 * Let a seller add an event that is missing from the catalog.
 *
 * A missing event would otherwise dead-end the sale, so this publishes immediately. It is marked
 * curated: false, which is what tells the admin Events tab it is a candidate to adopt - and what
 * keeps "admin curates the catalog" true in substance even though sellers can contribute to it.
 */
export const createSellerEvent = createAsyncThunk(
  'events/createSellerEvent',
  async ({ values, config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const response = await sdk.ownListings.create(
        {
          title: values.title,
          description: values.title,
          publicData: {
            listingType: EVENT_LISTING_TYPE,
            transactionProcessAlias: 'default-inquiry/release-1',
            unitType: 'inquiry',
            eventDate: values.eventDate,
            eventTime: values.eventTime || null,
            venue: values.venue,
            // Sellers do not set pricing guidance - they have no basis for it and it would be
            // their own asking price talking. Admin fills these in when adopting the event.
            faceValue: null,
            lastSoldPrice: null,
            curated: false,
          },
        },
        { expand: true, include: ['images'] }
      );
      dispatch(addMarketplaceEntities(response));
      return { listing: response.data.data };
    } catch (error) {
      log.error(error, 'seller-event-create-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

const eventsSlice = createSlice({
  name: 'events',
  initialState: {
    listingIds: [],
    fetched: false,
    inProgress: false,
    error: null,
    creating: false,
    createError: null,
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchEvents.pending, state => {
        state.inProgress = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.inProgress = false;
        state.fetched = true;
        state.listingIds = action.payload.listingIds;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.inProgress = false;
        state.fetched = false;
        state.error = action.payload;
      })
      .addCase(createSellerEvent.pending, state => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createSellerEvent.fulfilled, (state, action) => {
        state.creating = false;
        // Put it at the top of the catalog so the seller sees what they just added.
        state.listingIds = [action.payload.listing.id, ...state.listingIds];
      })
      .addCase(createSellerEvent.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      });
  },
});

export default eventsSlice.reducer;

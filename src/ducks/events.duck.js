import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as log from '../util/log';
import { storableError } from '../util/errors';
import { addMarketplaceEntities } from './marketplaceData.duck';
import { queryEvents, hasAdminConfigured } from '../util/events';

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

const eventsSlice = createSlice({
  name: 'events',
  initialState: {
    listingIds: [],
    fetched: false,
    inProgress: false,
    error: null,
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
      });
  },
});

export default eventsSlice.reducer;

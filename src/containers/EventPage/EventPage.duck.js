import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as log from '../../util/log';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { queryTicketsForEvent, queryEvents } from '../../util/events';

/**
 * One event and every ticket on sale for it, cheapest first.
 */
const fetchEventPagePayloadCreator = async (arg, thunkAPI) => {
  const { extra: sdk, rejectWithValue, dispatch } = thunkAPI;
  const { eventId, config } = arg;

  try {
    // The event itself goes through queryEvents so it inherits the admin-author filter: an
    // 'event' listing created by anyone other than the curating account must not resolve here
    // either, or the restriction would be bypassable simply by knowing a URL.
    const eventResponse = await queryEvents(sdk, config, { ids: [eventId] });
    dispatch(addMarketplaceEntities(eventResponse));
    const event = eventResponse.data.data[0];

    if (!event) {
      return { eventId: null, ticketIds: [], notFound: true };
    }

    // queryTicketsForEvent pages through the inventory and filters client-side, because the
    // pub_eventId filter is silently ignored by the API. It hands back every raw response so the
    // entities still land in the store, plus the subset that actually belongs to this event.
    const { responses, listings } = await queryTicketsForEvent(sdk, config, eventId);
    responses.forEach(response => dispatch(addMarketplaceEntities(response)));

    return {
      eventId: event.id,
      ticketIds: listings.map(l => l.id),
      notFound: false,
    };
  } catch (error) {
    log.error(error, 'event-page-fetch-failed', { eventId });
    return rejectWithValue(storableError(error));
  }
};

export const fetchEventPage = createAsyncThunk(
  'eventPage/fetchEventPage',
  fetchEventPagePayloadCreator
);

const eventPageSlice = createSlice({
  name: 'eventPage',
  initialState: {
    eventId: null,
    ticketIds: [],
    notFound: false,
    inProgress: false,
    error: null,
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchEventPage.pending, state => {
        state.inProgress = true;
        state.error = null;
        state.notFound = false;
      })
      .addCase(fetchEventPage.fulfilled, (state, action) => {
        state.inProgress = false;
        state.eventId = action.payload.eventId;
        state.ticketIds = action.payload.ticketIds;
        state.notFound = action.payload.notFound;
      })
      .addCase(fetchEventPage.rejected, (state, action) => {
        state.inProgress = false;
        state.error = action.payload;
      });
  },
});

export const loadData = (params, search, config) => dispatch => {
  return dispatch(fetchEventPage({ eventId: params.id, config }));
};

export default eventPageSlice.reducer;

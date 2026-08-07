import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { storableError } from '../util/errors';
import * as log from '../util/log';

/**
 * Event alerts: which events this user is waiting on a ticket for.
 *
 * A watch is a free transaction against the EVENT listing. That is not decoration - a
 * Sharetribe notification can only be addressed to the customer or provider OF THAT
 * TRANSACTION, so making the watcher a customer is the only way the platform will ever
 * email them. See ext/transaction-processes/default-watch.
 *
 * The alias is passed explicitly rather than read from the listing. transactionProcessAlias
 * is stored per-listing and is a contract between listing, marketplace and client app, not
 * something the API enforces; transactions/initiate takes processAlias as a parameter. So
 * event listings stay on default-inquiry for their own unused flow and are never made
 * "transactable", which keeps an OrderPanel off a catalogue page. configListing.js carries
 * the same note against the EVENT type.
 *
 * State is keyed by event listing id so the browse card, the event page and the alerts list
 * all read the same answer, and an optimistic flip on one is visible on the others.
 */
export const WATCH_PROCESS_ALIAS = 'default-watch/release-1';
export const WATCH_TRANSITION = 'transition/watch';
export const UNWATCH_TRANSITION = 'transition/unwatch';

/**
 * Stand-in id held while a watch is being created.
 *
 * The optimistic flip needs `byEventId[eventId]` to be truthy before the server has told us
 * the real transaction id, so this sits there in the meantime. It is NOT a transaction id
 * and must never reach the API - `unwatchEvent` refuses it explicitly. WatchButton also
 * blocks clicks while a request is pending, but that guard lives in a component and would
 * not travel to a second caller; this one is structural.
 */
export const OPTIMISTIC_WATCH_ID = 'optimistic';

const WATCH_PROCESS = 'default-watch';
const WATCHING_STATE = 'state/watching';

// Where an intent survives a trip through signup. Tapping "alert me" while signed out sends
// you to signup; without this the watch would be silently dropped on the way back, which is
// the moment a fresher is most likely to be signing up in the first place.
const PENDING_KEY = 'ticketx_pending_watch_event_id';

export const readPendingWatch = () => {
  try {
    return window?.sessionStorage?.getItem(PENDING_KEY) || null;
  } catch (e) {
    return null;
  }
};

export const setPendingWatch = eventId => {
  try {
    window?.sessionStorage?.setItem(PENDING_KEY, eventId);
  } catch (e) {
    // Private browsing and similar. Losing the intent is survivable; throwing is not.
  }
};

export const clearPendingWatch = () => {
  try {
    window?.sessionStorage?.removeItem(PENDING_KEY);
  } catch (e) {
    // as above
  }
};

export const fetchWatches = createAsyncThunk(
  'watch/fetch',
  async (_arg, { extra: sdk, rejectWithValue }) => {
    try {
      // only: 'order' - the watcher is the customer of their own watch. Filtered here rather
      // than in the query because transactions.query has no process filter, and this user's
      // real purchases must never be mistaken for watches.
      const response = await sdk.transactions.query({
        only: 'order',
        perPage: 100,
        include: ['listing'],
      });

      const byEventId = {};
      response.data.data.forEach(tx => {
        const isWatch = tx.attributes?.processName === WATCH_PROCESS;
        const isActive = tx.attributes?.state === WATCHING_STATE;
        const listingId = tx.relationships?.listing?.data?.id?.uuid;
        if (isWatch && isActive && listingId) {
          byEventId[listingId] = tx.id.uuid;
        }
      });
      return { byEventId };
    } catch (error) {
      log.error(error, 'watch-fetch-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

export const watchEvent = createAsyncThunk(
  'watch/watch',
  async ({ eventId }, { extra: sdk, rejectWithValue }) => {
    try {
      const response = await sdk.transactions.initiate(
        {
          processAlias: WATCH_PROCESS_ALIAS,
          transition: WATCH_TRANSITION,
          params: { listingId: eventId },
        },
        { expand: true }
      );
      return { eventId, transactionId: response.data.data.id.uuid };
    } catch (error) {
      // Log the API's own error codes, not just the HTTP status. A bare "409" is
      // indistinguishable between "you already watch this", "you authored this listing"
      // and "that alias does not resolve", and those need very different responses.
      const apiCodes = (error?.data?.errors || []).map(e => e.code).join(', ');
      log.error(error, 'watch-create-failed', { eventId, apiCodes });
      return rejectWithValue({ eventId, error: storableError(error) });
    }
  }
);

export const unwatchEvent = createAsyncThunk(
  'watch/unwatch',
  async ({ eventId, transactionId }, { extra: sdk, rejectWithValue }) => {
    // Never transition against the placeholder. If the create is still in flight there is
    // no real id yet, and sending 'optimistic' would produce a malformed request whose 400
    // says nothing useful. Rejecting here restores the watch to its on state (see the
    // rejected reducer), which is accurate: the create has not failed, it has not finished.
    if (!transactionId || transactionId === OPTIMISTIC_WATCH_ID) {
      const error = new Error(
        `Cannot unwatch ${eventId}: the watch is still being created, so it has no transaction id yet.`
      );
      log.error(error, 'watch-remove-too-early', { eventId });
      return rejectWithValue({ eventId, error: storableError(error) });
    }
    try {
      await sdk.transactions.transition({
        id: transactionId,
        transition: UNWATCH_TRANSITION,
        params: {},
      });
      return { eventId };
    } catch (error) {
      log.error(error, 'watch-remove-failed', { eventId });
      return rejectWithValue({ eventId, error: storableError(error) });
    }
  }
);

const initialState = {
  // eventListingId -> watch transaction id
  byEventId: {},
  // eventListingId -> true while a watch or unwatch is in flight
  pending: {},
  fetched: false,
  error: null,
};

const watchSlice = createSlice({
  name: 'watch',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchWatches.fulfilled, (state, action) => {
        state.byEventId = action.payload.byEventId;
        state.fetched = true;
      })
      .addCase(fetchWatches.rejected, (state, action) => {
        state.fetched = true;
        state.error = action.payload;
      })

      // Optimistic on both directions: the control flips the moment it is tapped, because
      // waiting on a round trip reads as a broken button on a bad connection. The rejected
      // cases below put it back.
      .addCase(watchEvent.pending, (state, action) => {
        const { eventId } = action.meta.arg;
        state.pending[eventId] = true;
        state.byEventId[eventId] = state.byEventId[eventId] || OPTIMISTIC_WATCH_ID;
      })
      .addCase(watchEvent.fulfilled, (state, action) => {
        const { eventId, transactionId } = action.payload;
        state.pending[eventId] = false;
        state.byEventId[eventId] = transactionId;
      })
      .addCase(watchEvent.rejected, (state, action) => {
        // meta.arg, not payload: it is present however the thunk failed, including on a
        // throw that never reached rejectWithValue.
        const { eventId } = action.meta.arg;
        state.pending[eventId] = false;
        delete state.byEventId[eventId];
        state.error = action.payload?.error || null;
      })

      .addCase(unwatchEvent.pending, (state, action) => {
        const { eventId } = action.meta.arg;
        state.pending[eventId] = true;
        // Remove the key rather than setting it undefined, so "is this watched" stays a
        // simple presence check everywhere that reads it.
        delete state.byEventId[eventId];
      })
      .addCase(unwatchEvent.fulfilled, (state, action) => {
        const { eventId } = action.payload;
        state.pending[eventId] = false;
        delete state.byEventId[eventId];
      })
      .addCase(unwatchEvent.rejected, (state, action) => {
        // Put the watch back. The optimistic delete above threw away the transaction id,
        // so restore it from the argument - without this a failed unwatch would look like
        // it worked and the user would keep getting alerts they thought they had stopped.
        const { eventId, transactionId } = action.meta.arg;
        state.pending[eventId] = false;
        if (transactionId) {
          state.byEventId[eventId] = transactionId;
        } else {
          // Assigning undefined would leave the key present, and every reader here treats
          // presence as "watched". Delete instead so the check stays honest.
          delete state.byEventId[eventId];
        }
        state.error = action.payload?.error || null;
      });
  },
});

export default watchSlice.reducer;

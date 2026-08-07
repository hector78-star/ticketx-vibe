import reducer, { watchEvent, unwatchEvent, OPTIMISTIC_WATCH_ID } from './watch.duck';

/**
 * The optimistic flip writes a placeholder id into byEventId so the control can flip before
 * the server answers. That placeholder is not a transaction id and must never reach the API.
 *
 * WatchButton blocks clicks while a request is pending, which is why this never fired in
 * practice - but that guard lives in a component and would not travel to a second caller.
 * These tests pin the structural guard in the duck itself.
 */

const initial = reducer(undefined, { type: '@@INIT' });

// Build the action shapes createAsyncThunk produces, so the reducers are exercised the way
// the real dispatch does rather than through a hand-rolled approximation.
const pendingAction = (thunk, arg) => ({ type: thunk.pending.type, meta: { arg } });
const rejectedAction = (thunk, arg, payload) => ({
  type: thunk.rejected.type,
  meta: { arg },
  payload,
});
const fulfilledAction = (thunk, arg, payload) => ({
  type: thunk.fulfilled.type,
  meta: { arg },
  payload,
});

describe('watch duck — optimistic placeholder', () => {
  it('holds the placeholder while a watch is being created', () => {
    const state = reducer(initial, pendingAction(watchEvent, { eventId: 'event-a' }));

    expect(state.byEventId['event-a']).toBe(OPTIMISTIC_WATCH_ID);
    expect(state.pending['event-a']).toBe(true);
  });

  it('replaces the placeholder with the real id once the server answers', () => {
    let state = reducer(initial, pendingAction(watchEvent, { eventId: 'event-a' }));
    state = reducer(
      state,
      fulfilledAction(
        watchEvent,
        { eventId: 'event-a' },
        { eventId: 'event-a', transactionId: 'tx-real' }
      )
    );

    expect(state.byEventId['event-a']).toBe('tx-real');
    expect(state.pending['event-a']).toBe(false);
  });

  it('removes the placeholder entirely when the watch fails', () => {
    let state = reducer(initial, pendingAction(watchEvent, { eventId: 'event-a' }));
    state = reducer(state, rejectedAction(watchEvent, { eventId: 'event-a' }, null));

    expect('event-a' in state.byEventId).toBe(false);
  });
});

describe('watch duck — unwatch never sends the placeholder', () => {
  const runThunk = async arg => {
    const sdk = { transactions: { transition: jest.fn() } };
    const dispatch = jest.fn();
    const getState = () => ({});
    // createAsyncThunk's payload creator is invoked with (arg, thunkAPI).
    const action = unwatchEvent(arg);
    await action(dispatch, getState, sdk);
    return sdk;
  };

  it('refuses to call the API with the placeholder id', async () => {
    const sdk = await runThunk({ eventId: 'event-a', transactionId: OPTIMISTIC_WATCH_ID });

    expect(sdk.transactions.transition).not.toHaveBeenCalled();
  });

  it('refuses to call the API with no id at all', async () => {
    const sdk = await runThunk({ eventId: 'event-a', transactionId: undefined });

    expect(sdk.transactions.transition).not.toHaveBeenCalled();
  });

  it('leaves the watch showing as on when unwatch is rejected too early', () => {
    // The create is still in flight: it has not failed, so the control must stay "Alerts on".
    let state = reducer(initial, pendingAction(watchEvent, { eventId: 'event-a' }));
    state = reducer(
      state,
      pendingAction(unwatchEvent, { eventId: 'event-a', transactionId: OPTIMISTIC_WATCH_ID })
    );
    state = reducer(
      state,
      rejectedAction(unwatchEvent, { eventId: 'event-a', transactionId: OPTIMISTIC_WATCH_ID }, null)
    );

    expect(state.byEventId['event-a']).toBe(OPTIMISTIC_WATCH_ID);
    expect(state.pending['event-a']).toBe(false);
  });

  it('does not leave an undefined value behind when there was no id to restore', () => {
    // A key present with an undefined value would read as "watched" to every presence check.
    let state = reducer(initial, pendingAction(unwatchEvent, { eventId: 'event-a' }));
    state = reducer(state, rejectedAction(unwatchEvent, { eventId: 'event-a' }, null));

    expect('event-a' in state.byEventId).toBe(false);
  });
});

describe('watch duck — unwatch with a real id', () => {
  it('calls the API and clears the entry', async () => {
    const sdk = { transactions: { transition: jest.fn().mockResolvedValue({}) } };
    const arg = { eventId: 'event-a', transactionId: 'tx-real' };
    await unwatchEvent(arg)(jest.fn(), () => ({}), sdk);

    expect(sdk.transactions.transition).toHaveBeenCalledTimes(1);
    const sent = sdk.transactions.transition.mock.calls[0][0];
    expect(sent.id).toBe('tx-real');
    expect(sent.transition).toBe('transition/unwatch');

    const state = reducer(
      { ...initial, byEventId: { 'event-a': 'tx-real' } },
      fulfilledAction(unwatchEvent, arg, { eventId: 'event-a' })
    );
    expect('event-a' in state.byEventId).toBe(false);
  });
});

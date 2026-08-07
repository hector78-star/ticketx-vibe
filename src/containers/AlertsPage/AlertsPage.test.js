import { selectStillWatched } from './AlertsPage';

/**
 * Regression test for the stale-row bug.
 *
 * The Alerts page fetched its own list of watch transactions, while the alert control read
 * from the shared watch state. Turning an alert off updated the shared state - so the button
 * flipped to "Alert me" - but nothing told this page's list, so the row stayed on screen
 * inviting you to view an event you had just stopped watching. It only went on reload.
 *
 * Reproduced in the browser before fixing:
 *   BEFORE : rows=2 buttons=[Alerts on, Alerts on]
 *   AFTER  : rows=2 buttons=[Alert me,  Alerts on]   <- row stayed, button flipped
 *   RELOAD : rows=1 buttons=[Alerts on]
 *
 * The first test below is the one that matters: it fails if the filter is dropped and the
 * page goes back to rendering whatever it fetched.
 */

const tx = (txId, eventId) => ({
  id: { uuid: txId },
  listing: eventId ? { id: { uuid: eventId } } : null,
});

describe('selectStillWatched', () => {
  it('drops a transaction whose event is no longer watched', () => {
    const loaded = [tx('tx-1', 'event-starfields'), tx('tx-2', 'event-reading')];
    // Starfields has just been unwatched, so the shared state no longer holds it.
    const watched = { 'event-reading': 'tx-2' };

    const result = selectStillWatched(loaded, watched);

    expect(result.map(t => t.id.uuid)).toEqual(['tx-2']);
  });

  it('keeps every transaction that is still watched', () => {
    const loaded = [tx('tx-1', 'event-a'), tx('tx-2', 'event-b')];
    const watched = { 'event-a': 'tx-1', 'event-b': 'tx-2' };

    expect(selectStillWatched(loaded, watched)).toHaveLength(2);
  });

  it('treats an optimistic placeholder as watched, so the row survives the round trip', () => {
    // watchEvent.pending writes the string 'optimistic' until the real id arrives. The row
    // must not blink out and back in while that request is in flight.
    const loaded = [tx('tx-1', 'event-a')];

    expect(selectStillWatched(loaded, { 'event-a': 'optimistic' })).toHaveLength(1);
  });

  it('returns nothing when the shared watch state is empty', () => {
    expect(selectStillWatched([tx('tx-1', 'event-a')], {})).toEqual([]);
  });

  it('drops a transaction with no listing rather than throwing', () => {
    // A transaction can arrive before its included listing is denormalised.
    expect(selectStillWatched([tx('tx-1', null)], { 'event-a': 'tx-9' })).toEqual([]);
  });

  it('survives undefined inputs', () => {
    expect(selectStillWatched(undefined, undefined)).toEqual([]);
    expect(selectStillWatched(null, {})).toEqual([]);
  });
});

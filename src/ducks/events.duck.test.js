import reducer, { searchEvents } from './events.duck';

// hasAdminConfigured() reads this at import time in util/events.
process.env.REACT_APP_ADMIN_USER_ID = process.env.REACT_APP_ADMIN_USER_ID || 'admin-user';

const config = { layout: { listingImage: { aspectWidth: 1, aspectHeight: 1 } } };

const event = (id, title, curated) => ({
  id: { uuid: id },
  attributes: {
    title,
    publicData: { listingType: 'event', ...(curated === false ? { curated: false } : {}) },
  },
});

const ticket = (id, eventId) => ({
  id: { uuid: id },
  attributes: { publicData: { eventId, listingType: 'sell-products' } },
});

/** Returns events on the first call and tickets on the second, mirroring searchEvents' two steps. */
const sdkReturning = (events, tickets) => {
  const query = jest
    .fn()
    .mockResolvedValueOnce({ data: { data: events, meta: { totalPages: 1 } } })
    .mockResolvedValueOnce({ data: { data: tickets, meta: { totalPages: 1 } } });
  return { sdk: { listings: { query } }, query };
};

const run = async (sdk, args = {}) => {
  const dispatch = jest.fn();
  const thunk = searchEvents({ keywords: '', config, ...args });
  return thunk(dispatch, () => ({}), sdk);
};

describe('searchEvents', () => {
  // A curated event is one result a buyer wants, however many people are reselling for it. A
  // seller-created event has no curated detail to show, so its tickets surface directly instead of
  // behind an empty landing page.
  it('separates curated events from seller-created ones', async () => {
    const { sdk } = sdkReturning(
      [event('e1', 'Starfields'), event('e2', 'Someone House Party', false)],
      [ticket('t1', 'e2')]
    );

    const action = await run(sdk);

    expect(action.payload.eventIds.map(i => i.uuid)).toEqual(['e1']);
    expect(action.payload.directTicketIds.map(i => i.uuid)).toEqual(['t1']);
  });

  // Admin-curated events have no `curated` key at all, so absence must mean curated - not the
  // reverse, which would hide the entire catalog behind the "other tickets" section.
  it('treats a missing curated flag as curated', async () => {
    const { sdk } = sdkReturning([event('e1', 'Opening Ball')], []);
    const action = await run(sdk);
    expect(action.payload.eventIds.map(i => i.uuid)).toEqual(['e1']);
    expect(action.payload.directTicketIds).toEqual([]);
  });

  it('does not go looking for tickets when every event is curated', async () => {
    const { sdk, query } = sdkReturning([event('e1', 'Starfields')], []);
    await run(sdk);
    // Events query only - no second request for seller-created tickets.
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('passes the keyword through to the events query', async () => {
    const { sdk, query } = sdkReturning([], []);
    await run(sdk, { keywords: 'starfields' });
    expect(query.mock.calls[0][0].keywords).toEqual('starfields');
  });

  it('omits the keyword parameter entirely when the search is empty', async () => {
    const { sdk, query } = sdkReturning([], []);
    await run(sdk, { keywords: '' });
    expect(query.mock.calls[0][0]).not.toHaveProperty('keywords');
  });
});

describe('events reducer', () => {
  // The seller's event picker reads state.events.listingIds. A buyer's search must never narrow it.
  it('keeps search results out of the full catalog used by the event picker', () => {
    const withCatalog = {
      ...reducer(undefined, { type: '@@INIT' }),
      listingIds: [{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }],
    };

    const next = reducer(withCatalog, {
      type: searchEvents.fulfilled.type,
      payload: { keywords: 'ball', eventIds: [{ uuid: 'a' }], directTicketIds: [] },
    });

    expect(next.listingIds.map(i => i.uuid)).toEqual(['a', 'b', 'c']);
    expect(next.search.eventIds.map(i => i.uuid)).toEqual(['a']);
    expect(next.search.keywords).toEqual('ball');
  });
});

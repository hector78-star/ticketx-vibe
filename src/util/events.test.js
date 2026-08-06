import {
  queryEvents,
  queryTicketsForEvent,
  queryTicketsForEvents,
  todayAsEventDate,
} from './events';

const config = { layout: { listingImage: { aspectWidth: 1, aspectHeight: 1 } } };

const fakeSdk = (listings = []) => {
  const query = jest.fn().mockResolvedValue({
    data: { data: listings, meta: { totalPages: 1, totalItems: listings.length } },
  });
  return { sdk: { listings: { query } }, query };
};

const ticket = (id, eventId) => ({
  id: { uuid: id },
  attributes: { publicData: { eventId, listingType: 'ticket' } },
});

describe('todayAsEventDate', () => {
  // Event dates are YYYYMMDD integers, not timestamps - see the eventDate field in configListing.
  it('formats a date as a sortable YYYYMMDD integer', () => {
    expect(todayAsEventDate(new Date(2026, 7, 6))).toEqual(20260806);
    expect(todayAsEventDate(new Date(2026, 0, 1))).toEqual(20260101);
    expect(todayAsEventDate(new Date(2026, 11, 31))).toEqual(20261231);
  });
});

describe('queryEvents', () => {
  // Sharetribe inverts the usual convention: a bare field name sorts descending and '-' sorts
  // ascending. Getting this backwards silently lists the furthest-away event first.
  it('sorts soonest-first using the ascending prefix', async () => {
    const { sdk, query } = fakeSdk();
    await queryEvents(sdk, config);
    expect(query.mock.calls[0][0].sort).toEqual('-pub_eventDate');
  });

  it('excludes events that have already happened', async () => {
    const { sdk, query } = fakeSdk();
    await queryEvents(sdk, config);
    const params = query.mock.calls[0][0];
    expect(params.pub_eventDate).toEqual(`${todayAsEventDate()},`);
  });

  it('includes past events when asked, for the admin view', async () => {
    const { sdk, query } = fakeSdk();
    await queryEvents(sdk, config, { includePast: true });
    expect(query.mock.calls[0][0].pub_eventDate).toBeUndefined();
    // includePast must not leak through as an API parameter.
    expect(query.mock.calls[0][0].includePast).toBeUndefined();
  });

  // EventPage resolves a single event by id. Applying the date filter there would 404 the page for
  // any event that has already taken place.
  it('does not apply the date filter when looking up explicit ids', async () => {
    const { sdk, query } = fakeSdk();
    await queryEvents(sdk, config, { ids: ['event-1'] });
    const params = query.mock.calls[0][0];
    expect(params.pub_eventDate).toBeUndefined();
    expect(params.ids).toEqual(['event-1']);
  });
});

describe('queryTicketsForEvent', () => {
  it('filters by eventId server-side rather than scanning the catalog', async () => {
    const { sdk, query } = fakeSdk([ticket('t1', 'event-1')]);
    await queryTicketsForEvent(sdk, config, 'event-1');

    expect(query).toHaveBeenCalledTimes(1);
    const params = query.mock.calls[0][0];
    expect(params.pub_eventId).toEqual('event-1');
    expect(params.sort).toEqual('-price');
  });

  it('requests the fields the ticket card needs', async () => {
    const { sdk, query } = fakeSdk();
    await queryTicketsForEvent(sdk, config, 'event-1');
    const params = query.mock.calls[0][0];

    expect(params['fields.listing']).toEqual(expect.arrayContaining(['publicData.ticketType']));
    // Seller reputation is read off the author's profile; without this every card costs a request.
    expect(params['fields.user']).toEqual(expect.arrayContaining(['profile.publicData']));
  });

  // An unindexed pub_ filter is accepted and ignored, returning everything. That failure is silent,
  // so the result is asserted rather than trusted.
  it('discards anything the server returns that belongs to another event', async () => {
    const { sdk } = fakeSdk([
      ticket('t1', 'event-1'),
      ticket('t2', 'other-event'),
      ticket('t3', 'event-1'),
    ]);
    const { listings } = await queryTicketsForEvent(sdk, config, 'event-1');
    expect(listings.map(l => l.id.uuid)).toEqual(['t1', 't3']);
  });
});

describe('queryTicketsForEvents', () => {
  // pub_eventId has an enum schema, and enum filters take a comma-separated list with OR
  // semantics - so a set of events costs one request, not one per event.
  it('fetches tickets for several events in a single request', async () => {
    const { sdk, query } = fakeSdk([ticket('t1', 'e1'), ticket('t2', 'e2')]);
    const { listings } = await queryTicketsForEvents(sdk, config, ['e1', 'e2']);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].pub_eventId).toEqual('e1,e2');
    expect(listings).toHaveLength(2);
  });

  it('makes no request at all when there are no events to look up', async () => {
    const { sdk, query } = fakeSdk();
    const { listings } = await queryTicketsForEvents(sdk, config, []);
    expect(query).not.toHaveBeenCalled();
    expect(listings).toEqual([]);
  });

  it('drops tickets belonging to events that were not asked for', async () => {
    const { sdk } = fakeSdk([ticket('t1', 'e1'), ticket('t2', 'unrelated')]);
    const { listings } = await queryTicketsForEvents(sdk, config, ['e1']);
    expect(listings.map(l => l.id.uuid)).toEqual(['t1']);
  });
});

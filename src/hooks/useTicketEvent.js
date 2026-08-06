import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useConfiguration } from '../context/configurationContext';
import { getListingsById } from '../ducks/marketplaceData.duck';
import { fetchEvents } from '../ducks/events.duck';
import { eventSummary, hasAdminConfigured } from '../util/events';

/**
 * The event a ticket belongs to.
 *
 * Tickets carry only `publicData.eventId`. The event's title, date and venue live on the event
 * listing, and they are resolved here rather than copied onto the ticket at listing time.
 *
 * That is deliberate. configListing declares AUTOFILLED_TICKET_FIELDS - eventTitle, eventDate,
 * eventTime, venue - and EventPicker does write all of them onto the form, but those fields are
 * configured for the EVENT listing type only, so the save path strips them and no ticket in the
 * marketplace actually carries them. Resolving through eventId is also the better answer even if
 * that were fixed: an admin correcting a venue would otherwise leave a stale copy on every ticket
 * already listed for it.
 *
 * Reads the same cached catalog as useEventImages, so a page showing a ticket pays for one query
 * whether it needs the photo, the details, or both.
 */
export const useTicketEvent = listing => {
  const dispatch = useDispatch();
  const config = useConfiguration();

  const eventId = listing?.attributes?.publicData?.eventId;

  const { listingIds, fetched, inProgress } = useSelector(state => state.events) || {};
  const marketplaceData = useSelector(state => state.marketplaceData);

  // Only reach for the catalog when there is a ticket on screen that needs it.
  const needsCatalog = !!eventId && hasAdminConfigured();

  useEffect(() => {
    if (needsCatalog && !fetched && !inProgress) {
      dispatch(fetchEvents({ config }));
    }
  }, [dispatch, config, needsCatalog, fetched, inProgress]);

  const events = useMemo(() => getListingsById({ marketplaceData }, listingIds || []), [
    marketplaceData,
    listingIds,
  ]);

  return useMemo(() => {
    if (!eventId) {
      return null;
    }
    const match = events.find(e => e.id?.uuid === eventId);
    return match ? eventSummary(match) : null;
  }, [events, eventId]);
};

export default useTicketEvent;

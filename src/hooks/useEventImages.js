import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useConfiguration } from '../context/configurationContext';
import { getListingsById } from '../ducks/marketplaceData.duck';
import { fetchEvents } from '../ducks/events.duck';
import { hasAdminConfigured } from '../util/events';

/**
 * Curated event imagery, keyed by event id.
 *
 * Tickets carry no images of their own - sellers have no photo step - so anywhere a ticket is
 * rendered it borrows its event's photo. The whole catalog is fetched once and cached in the
 * events duck, so this costs one query no matter how many tickets are on screen; the alternative,
 * resolving each ticket's event individually, would be a request per card.
 */
export const useEventImages = (listings = []) => {
  const dispatch = useDispatch();
  const config = useConfiguration();

  const { listingIds, fetched, inProgress } = useSelector(state => state.events) || {};
  const marketplaceData = useSelector(state => state.marketplaceData);
  const events = useMemo(() => getListingsById({ marketplaceData }, listingIds || []), [
    marketplaceData,
    listingIds,
  ]);

  // Only fetch the catalog when something on screen actually needs it. Fetching on every listing
  // render would pull the whole catalog for pages showing no tickets at all - and would make test
  // suites issue live queries, since REACT_APP_ADMIN_USER_ID is read under test too.
  const needsEvents = useMemo(() => listings.some(l => !!l?.attributes?.publicData?.eventId), [
    listings,
  ]);

  useEffect(() => {
    if (needsEvents && !fetched && !inProgress && hasAdminConfigured()) {
      dispatch(fetchEvents({ config }));
    }
  }, [dispatch, config, needsEvents, fetched, inProgress]);

  return useMemo(() => {
    return events.reduce((byId, event) => {
      const id = event?.id?.uuid;
      return id ? { ...byId, [id]: event.images || [] } : byId;
    }, {});
  }, [events]);
};

/**
 * Swap a ticket's images for its event's.
 *
 * The event's photo wins outright rather than acting as a fallback: imagery is an admin-dictated
 * event detail, so a ticket created before the photo step was removed must not keep showing the
 * seller's own picture. Listings that are not tickets pass through untouched.
 */
export const withEventImage = (listing, imagesByEventId) => {
  const eventId = listing?.attributes?.publicData?.eventId;
  if (!eventId) {
    return listing;
  }
  const images = imagesByEventId?.[eventId];
  return images?.length ? { ...listing, images } : listing;
};

import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { eventSummary, formatEventDate } from '../../util/events';
import {
  fetchWatches,
  watchEvent,
  readPendingWatch,
  clearPendingWatch,
} from '../../ducks/watch.duck';

import {
  Page,
  LayoutSingleColumn,
  EventStats,
  WatchButton,
  H1,
  H2,
  TicketCard,
  NamedLink,
  ResponsiveImage,
} from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import NotFoundPage from '../NotFoundPage/NotFoundPage';

import css from './EventPage.module.css';

/**
 * Every ticket on sale for one event, cheapest first.
 *
 * The sort is applied server-side by queryTicketsForEvent, so pagination stays correct - sorting
 * only the current page client-side would put a cheap ticket on page two above an expensive one
 * on page one.
 */
export const EventPageComponent = () => {
  const config = useConfiguration();
  const dispatch = useDispatch();

  // See EventsPage: the alert control needs to know what is already watched.
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const watchesFetched = useSelector(state => state.watch.fetched);
  useEffect(() => {
    if (isAuthenticated && !watchesFetched) {
      dispatch(fetchWatches());
    }
  }, [dispatch, isAuthenticated, watchesFetched]);

  // A watch intended before signing up. Tapping "alert me" signed out sends you to signup;
  // this is the other half, applied once you land back. Without it the intent is dropped at
  // exactly the moment a new student was motivated enough to act.
  useEffect(() => {
    if (!isAuthenticated || !watchesFetched) return;
    const pendingId = readPendingWatch();
    if (pendingId) {
      clearPendingWatch();
      dispatch(watchEvent({ eventId: pendingId }));
    }
  }, [dispatch, isAuthenticated, watchesFetched]);

  const { eventId, ticketIds, notFound, inProgress, error } = useSelector(state => state.eventPage);
  // Derive under useMemo: getListingsById returns a new array each call.
  const marketplaceData = useSelector(state => state.marketplaceData);
  const events = useMemo(() => getListingsById({ marketplaceData }, eventId ? [eventId] : []), [
    marketplaceData,
    eventId,
  ]);
  const tickets = useMemo(() => getListingsById({ marketplaceData }, ticketIds), [
    marketplaceData,
    ticketIds,
  ]);

  const eventListing = events[0];
  const event = eventSummary(eventListing);

  if (notFound) {
    return <NotFoundPage staticContext={{}} />;
  }

  const date = event ? formatEventDate(event.eventDate) : null;

  const ticketsBody = error ? (
    <p className={css.notice}>
      <FormattedMessage id="EventPage.error" />
    </p>
  ) : inProgress ? (
    <p className={css.notice}>
      <FormattedMessage id="EventPage.loading" />
    </p>
  ) : tickets.length === 0 ? (
    <p className={css.notice}>
      <FormattedMessage id="EventPage.noTickets" />
    </p>
  ) : (
    // No image substitution here any more. Tickets borrow the event photo elsewhere in the app,
    // but on this page the event is already pictured above, so repeating it on every card made
    // identical tiles whose only difference was the price. TicketCard shows what differs instead.
    <ul className={css.ticketGrid}>
      {tickets.map(listing => (
        <TicketCard
          key={listing.id.uuid}
          className={css.ticketCard}
          listing={listing}
          faceValue={event?.faceValue}
        />
      ))}
    </ul>
  );

  return (
    <Page title={event?.title || ''} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        {event ? (
          <div className={css.header}>
            <div className={css.headerImageWrapper}>
              <ResponsiveImage
                rootClassName={css.headerImage}
                alt={event.title}
                image={eventListing.images?.[0]}
                variants={['listing-card', 'listing-card-2x']}
              />
            </div>
            <div className={css.headerBody}>
              <H1 className={css.eventTitle}>{event.title}</H1>
              <p className={css.eventMeta}>
                {[date, event.eventTime, event.venue].filter(Boolean).join(' · ')}
              </p>
              {/* Shared with the browse card and the listing flow's EventPicker, so the same
                  numbers read the same way wherever a seller or buyer meets them. The zero
                  semantics that used to be documented here now live in the component: sold
                  shows at 0 because "none sold yet" is a real answer, waiting hides at 0
                  because nobody waiting is not worth stating.

                  keepSoldOnMobile because this page has the room the card does not - sold is
                  the stat dropped at 390px on the grid. */}
              <EventStats
                className={css.guidance}
                faceValue={event.faceValue}
                lastSoldPrice={event.lastSoldPrice}
                soldCount={event.soldCount}
                watcherCount={event.watcherCount}
                currency={config.currency}
                keepSoldOnMobile
              />
              <div className={css.headerActions}>
                <NamedLink className={css.sellCta} name="NewListingPage">
                  <FormattedMessage id="EventPage.sellCta" />
                </NamedLink>
                <WatchButton
                  eventId={event.id}
                  eventTitle={event.title}
                  eventAuthorId={event.authorId}
                />
              </div>
            </div>
          </div>
        ) : null}

        <H2 className={css.ticketsHeading}>
          <FormattedMessage id="EventPage.ticketsHeading" />
          {tickets.length > 0 ? (
            <span className={css.ticketCount}>
              <FormattedMessage id="EventPage.ticketCount" values={{ count: tickets.length }} />
            </span>
          ) : null}
        </H2>
        {ticketsBody}
      </LayoutSingleColumn>
    </Page>
  );
};

export default EventPageComponent;

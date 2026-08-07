import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { createSlug } from '../../util/urlHelpers';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { searchEvents } from '../../ducks/events.duck';
import {
  fetchWatches,
  watchEvent,
  readPendingWatch,
  clearPendingWatch,
} from '../../ducks/watch.duck';
import { eventSummary, formatEventDate, hasAdminConfigured } from '../../util/events';

import {
  Page,
  LayoutSingleColumn,
  EventStats,
  WatchButton,
  H1,
  H3,
  NamedLink,
  ResponsiveImage,
  TicketCard,
} from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './EventsPage.module.css';

/**
 * Browsing tickets, which works differently from browsing anything else on the marketplace.
 *
 * Tickets are searched by event, not by listing: fifty people reselling for the same ball is one
 * thing a buyer is looking for, not fifty. So a curated event appears once, with its photo and
 * pricing guidance, and opens to the tickets on sale for it.
 *
 * Seller-created events skip that. They exist because somebody needed an event the catalog did not
 * have, so there is nothing curated to show and usually one ticket behind them - their listings
 * appear directly in the results instead of behind an empty landing page.
 */
/**
 * One event in the browse grid.
 *
 * The card is deliberately NOT a link. It used to be - the whole thing was wrapped in a
 * NamedLink - which meant the only thing that looked tappable was nothing at all, and any
 * control placed inside it had to fight the parent with stopPropagation. Naming the two
 * actions explicitly fixes both: a buyer can see what the card does, and there are no
 * nested interactive elements to work around.
 *
 * Layout follows the approved mockup at
 * ~/.gstack/projects/hector78-star-ticketx-vibe/designs/event-card-watch-20260807/variant-B.png
 */
const EventCard = props => {
  const { event, listing, currency } = props;
  const intl = useIntl();
  const date = formatEventDate(event.eventDate);
  const firstImage = listing.images?.[0];
  const slug = createSlug(event.title || 'event');
  const linkParams = { id: event.id, slug };

  return (
    <article className={css.card}>
      <NamedLink className={css.cardImageLink} name="EventPage" params={linkParams} tabIndex={-1}>
        <div className={css.cardImageWrapper}>
          <ResponsiveImage
            rootClassName={css.cardImage}
            alt={event.title}
            image={firstImage}
            variants={['listing-card', 'listing-card-2x']}
          />
        </div>
      </NamedLink>

      <div className={css.cardBody}>
        <H3 className={css.cardTitle}>
          <NamedLink className={css.cardTitleLink} name="EventPage" params={linkParams}>
            {event.title}
          </NamedLink>
        </H3>
        <p className={css.cardMeta}>
          {[date, event.eventTime, event.venue].filter(Boolean).join(' · ')}
        </p>

        <EventStats
          className={css.cardStats}
          faceValue={event.faceValue}
          lastSoldPrice={event.lastSoldPrice}
          soldCount={event.soldCount}
          watcherCount={event.watcherCount}
          currency={currency}
        />

        <div className={css.cardActions}>
          {/* Named with the event so a screen reader tabbing a grid of twelve cards hears
              which one each control belongs to, rather than "view tickets" twelve times. */}
          {/* The approved design shows a ticket count here ("View 4 tickets"). The count of
              AVAILABLE tickets is not on this page - events are listed here and tickets are
              fetched per event on EventPage - and soldCount is a different number. Plumbing
              it through is a separate data change; the label stays honest until then. */}
          <NamedLink
            className={css.cardPrimaryAction}
            name="EventPage"
            params={linkParams}
            aria-label={intl.formatMessage(
              { id: 'EventsPage.viewTicketsFor' },
              { title: event.title }
            )}
          >
            <FormattedMessage id="EventsPage.viewTickets" />
          </NamedLink>
          <WatchButton eventId={event.id} eventTitle={event.title} eventAuthorId={event.authorId} />
        </div>
      </div>
    </article>
  );
};

const SearchBox = props => {
  const { initialValue, onSearch } = props;
  const intl = useIntl();
  const [value, setValue] = useState(initialValue);

  // Keep the box in step when the URL changes underneath it (back button, a shared link).
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const submit = e => {
    e.preventDefault();
    onSearch(value.trim());
  };

  return (
    <form className={css.searchForm} onSubmit={submit} role="search">
      <input
        className={css.searchInput}
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={intl.formatMessage({ id: 'EventsPage.searchPlaceholder' })}
        aria-label={intl.formatMessage({ id: 'EventsPage.searchPlaceholder' })}
      />
      <button className={css.searchButton} type="submit">
        <FormattedMessage id="EventsPage.searchButton" />
      </button>
      {initialValue ? (
        <button className={css.clearButton} type="button" onClick={() => onSearch('')}>
          <FormattedMessage id="EventsPage.clearSearch" />
        </button>
      ) : null}
    </form>
  );
};

export const EventsPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();

  const keywords = new URLSearchParams(location.search).get('keywords') || '';

  const { eventIds, directTicketIds, fetched, inProgress, error } = useSelector(
    state => state.events.search
  );
  // getListingsById denormalises into a fresh array each call, so selecting it directly makes
  // every store update look like a change. Select the slice, derive under useMemo.
  const marketplaceData = useSelector(state => state.marketplaceData);
  const events = useMemo(() => getListingsById({ marketplaceData }, eventIds), [
    marketplaceData,
    eventIds,
  ]);
  const directTickets = useMemo(() => getListingsById({ marketplaceData }, directTicketIds), [
    marketplaceData,
    directTicketIds,
  ]);

  useEffect(() => {
    if (hasAdminConfigured()) {
      dispatch(searchEvents({ keywords, config }));
    }
  }, [dispatch, config, keywords]);

  // Which events this user already has alerts on, so the control renders in the right state
  // rather than flashing "alert me" on something they are already watching. Fetched once.
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

  const onSearch = next => {
    const search = next ? `?keywords=${encodeURIComponent(next)}` : '';
    history.push(`/events${search}`);
  };

  const title = intl.formatMessage(
    { id: 'EventsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const hasResults = events.length > 0 || directTickets.length > 0;

  const body = !hasAdminConfigured() ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.adminNotConfigured" />
    </p>
  ) : error ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.error" />
    </p>
  ) : inProgress && !hasResults ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.loading" />
    </p>
  ) : fetched && !hasResults ? (
    <p className={css.notice}>
      <FormattedMessage
        id={keywords ? 'EventsPage.noResults' : 'EventsPage.noEvents'}
        values={{ keywords }}
      />
    </p>
  ) : (
    <>
      {events.length > 0 ? (
        <div className={css.grid}>
          {events.map(listing => {
            const event = eventSummary(listing);
            return event ? (
              <EventCard
                key={event.id}
                event={event}
                listing={listing}
                currency={config.currency}
              />
            ) : null;
          })}
        </div>
      ) : null}

      {directTickets.length > 0 ? (
        <section className={css.directSection}>
          <H3 className={css.directHeading}>
            <FormattedMessage id="EventsPage.directTicketsHeading" />
          </H3>
          <p className={css.directSubtitle}>
            <FormattedMessage id="EventsPage.directTicketsSubtitle" />
          </p>
          <ul className={css.ticketGrid}>
            {directTickets.map(listing => (
              <TicketCard key={listing.id.uuid} listing={listing} showEventName />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );

  return (
    <Page title={title} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <H1 className={css.title}>
          <FormattedMessage id="EventsPage.title" />
        </H1>
        <p className={css.subtitle}>
          <FormattedMessage id="EventsPage.subtitle" />
        </p>
        <SearchBox initialValue={keywords} onSearch={onSearch} />
        {body}
      </LayoutSingleColumn>
    </Page>
  );
};

export default EventsPageComponent;

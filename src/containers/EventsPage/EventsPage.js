import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { createSlug } from '../../util/urlHelpers';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { searchEvents } from '../../ducks/events.duck';
import { eventSummary, formatEventDate, formatPence, hasAdminConfigured } from '../../util/events';

import {
  Page,
  LayoutSingleColumn,
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
const EventCard = props => {
  const { event, listing, currency } = props;
  const date = formatEventDate(event.eventDate);
  const lastSold = formatPence(event.lastSoldPrice, currency);
  const faceValue = formatPence(event.faceValue, currency);
  const firstImage = listing.images?.[0];

  return (
    <NamedLink
      className={css.card}
      name="EventPage"
      params={{ id: event.id, slug: createSlug(event.title || 'event') }}
    >
      <div className={css.cardImageWrapper}>
        <ResponsiveImage
          rootClassName={css.cardImage}
          alt={event.title}
          image={firstImage}
          variants={['listing-card', 'listing-card-2x']}
        />
      </div>
      <div className={css.cardBody}>
        <H3 className={css.cardTitle}>{event.title}</H3>
        <p className={css.cardMeta}>
          {[date, event.eventTime, event.venue].filter(Boolean).join(' · ')}
        </p>
        <p className={css.cardPrices}>
          <span className={css.cardPriceLabel}>
            <FormattedMessage id="EventPage.faceValue" />
          </span>{' '}
          <span className={css.cardPriceValue}>{faceValue || '—'}</span>
          <span className={css.cardPriceSep}>·</span>
          <span className={css.cardPriceLabel}>
            <FormattedMessage id="EventPage.lastSold" />
          </span>{' '}
          <span className={css.cardPriceValue}>
            {lastSold || <FormattedMessage id="EventPage.noSalesYet" />}
          </span>
          {typeof event.soldCount === 'number' ? (
            <>
              <span className={css.cardPriceSep}>·</span>
              <span className={css.cardPriceLabel}>
                <FormattedMessage id="EventPage.soldCount" />
              </span>{' '}
              <span className={css.cardPriceValue}>{event.soldCount}</span>
            </>
          ) : null}
        </p>
      </div>
    </NamedLink>
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
              <TicketCard key={listing.id.uuid} listing={listing} />
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

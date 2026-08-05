import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { createSlug } from '../../util/urlHelpers';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { fetchEvents } from '../../ducks/events.duck';
import {
  eventSummary,
  formatEventDate,
  formatPence,
  hasAdminConfigured,
} from '../../util/events';

import { Page, LayoutSingleColumn, H1, H3, NamedLink, ResponsiveImage } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './EventsPage.module.css';

/**
 * TicketX event browse grid.
 *
 * The StubHub shape: browse events first, then drill into one to see the tickets on sale for it.
 * The main /s search stays listing-first for anything else on the marketplace.
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
        </p>
      </div>
    </NamedLink>
  );
};

export const EventsPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const { listingIds, fetched, inProgress, error } = useSelector(state => state.events);
  // getListingsById denormalises into a fresh array each call, so selecting it directly makes
  // every store update look like a change. Select the slice, derive under useMemo.
  const marketplaceData = useSelector(state => state.marketplaceData);
  const listings = useMemo(() => getListingsById({ marketplaceData }, listingIds), [
    marketplaceData,
    listingIds,
  ]);

  useEffect(() => {
    if (!fetched && !inProgress && hasAdminConfigured()) {
      dispatch(fetchEvents({ config }));
    }
  }, [dispatch, config, fetched, inProgress]);

  const title = intl.formatMessage(
    { id: 'EventsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const body = !hasAdminConfigured() ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.adminNotConfigured" />
    </p>
  ) : error ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.error" />
    </p>
  ) : inProgress && listings.length === 0 ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.loading" />
    </p>
  ) : fetched && listings.length === 0 ? (
    <p className={css.notice}>
      <FormattedMessage id="EventsPage.noEvents" />
    </p>
  ) : (
    <div className={css.grid}>
      {listings.map(listing => {
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
        {body}
      </LayoutSingleColumn>
    </Page>
  );
};

export default EventsPageComponent;

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { eventSummary, formatEventDate, formatPence } from '../../util/events';

import {
  Page,
  LayoutSingleColumn,
  H1,
  H2,
  ListingCard,
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
  const intl = useIntl();
  const config = useConfiguration();

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
  const faceValue = event ? formatPence(event.faceValue, config.currency) : null;
  const lastSold = event ? formatPence(event.lastSoldPrice, config.currency) : null;

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
    <div className={css.ticketGrid}>
      {tickets.map(listing => (
        <ListingCard
          key={listing.id.uuid}
          className={css.ticketCard}
          listing={listing}
          showAuthorInfo={true}
        />
      ))}
    </div>
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
              <dl className={css.guidance}>
                <div className={css.guidanceRow}>
                  <dt className={css.guidanceTerm}>
                    <FormattedMessage id="EventPage.faceValue" />
                  </dt>
                  <dd className={css.guidanceValue}>{faceValue || '—'}</dd>
                </div>
                <div className={css.guidanceRow}>
                  <dt className={css.guidanceTerm}>
                    <FormattedMessage id="EventPage.lastSold" />
                  </dt>
                  <dd className={css.guidanceValue}>
                    {lastSold || intl.formatMessage({ id: 'EventPage.noSalesYet' })}
                  </dd>
                </div>
              </dl>
              <NamedLink className={css.sellCta} name="NewListingPage">
                <FormattedMessage id="EventPage.sellCta" />
              </NamedLink>
            </div>
          </div>
        ) : null}

        <H2 className={css.ticketsHeading}>
          <FormattedMessage id="EventPage.ticketsHeading" />
          {tickets.length > 0 ? (
            <span className={css.ticketCount}>
              <FormattedMessage
                id="EventPage.ticketCount"
                values={{ count: tickets.length }}
              />
            </span>
          ) : null}
        </H2>
        {ticketsBody}
      </LayoutSingleColumn>
    </Page>
  );
};

export default EventPageComponent;

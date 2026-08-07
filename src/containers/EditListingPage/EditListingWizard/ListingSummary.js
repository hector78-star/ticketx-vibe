import React from 'react';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { formatEventDate } from '../../../util/events';
import { useTicketEvent } from '../../../hooks/useTicketEvent';
import {
  TICKET_TYPE_MOBILE,
  TICKET_TYPE_PDF,
  TICKET_TYPE_PHYSICAL,
} from '../../../config/configListing';

import css from './ListingSummary.module.css';

/**
 * What the seller has said so far, shown on the last step of the listing flow.
 *
 * This started life as a running panel beside every question. That was rejected - "including left
 * hand side is nice idea but too much - maybe have that at a summary screen at end of listing
 * flow" - so it appears once, at the point where the seller is about to name a price and wants to
 * see what they are pricing.
 *
 * The event's date and venue are resolved through eventId rather than read off the draft: the
 * autofilled copies are stripped on save, so the draft carries only the id. See useTicketEvent.
 */
const TICKET_TYPE_LABELS = {
  [TICKET_TYPE_MOBILE]: 'EditListingTicketFields.typeMobile',
  [TICKET_TYPE_PDF]: 'EditListingTicketFields.typePdf',
  [TICKET_TYPE_PHYSICAL]: 'EditListingTicketFields.typePhysical',
};

const Row = props => {
  const { labelId, children } = props;
  if (!children) {
    return null;
  }
  return (
    <div className={css.row}>
      <dt className={css.label}>
        <FormattedMessage id={labelId} />
      </dt>
      <dd className={css.value}>{children}</dd>
    </div>
  );
};

const ListingSummary = props => {
  const { listing } = props;
  const intl = useIntl();
  const event = useTicketEvent(listing);

  const { title, description, publicData } = listing?.attributes || {};
  const { ticketType, ticketPlatform } = publicData || {};

  const typeLabelId = TICKET_TYPE_LABELS[ticketType];
  const typeLabel = typeLabelId ? intl.formatMessage({ id: typeLabelId }) : null;

  // Date and venue only exist once the catalog has loaded. Rather than hold the whole summary back
  // on a network round trip, the rows that are ready render and the rest fill in.
  const when = [formatEventDate(event?.eventDate), event?.eventTime].filter(Boolean).join(' · ');

  return (
    <div className={css.root}>
      <h3 className={css.heading}>
        <FormattedMessage id="ListingSummary.heading" />
      </h3>
      <dl className={css.rows}>
        <Row labelId="ListingSummary.event">{title}</Row>
        <Row labelId="ListingSummary.when">{when || null}</Row>
        <Row labelId="ListingSummary.venue">{event?.venue}</Row>
        <Row labelId="ListingSummary.ticketType">
          {typeLabel ? (
            <>
              {typeLabel}
              {ticketPlatform ? <span className={css.muted}> · {ticketPlatform}</span> : null}
            </>
          ) : null}
        </Row>
        <Row labelId="ListingSummary.description">{description}</Row>
      </dl>
    </div>
  );
};

export default ListingSummary;

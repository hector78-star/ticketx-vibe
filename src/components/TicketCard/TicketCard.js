import React from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import { createSlug } from '../../util/urlHelpers';

import { NamedLink, SellerReputation } from '../../components';

import css from './TicketCard.module.css';

const { Money } = sdkTypes;

/**
 * One ticket on an event page.
 *
 * Deliberately NOT the generic ListingCard. Every ticket for an event borrows that event's photo
 * and repeats its title, so a grid of ListingCards showed the same picture and the same words over
 * and over, with the price as the only difference. The event is already pictured and named at the
 * top of the page; repeating it per card is noise.
 *
 * What a buyer actually chooses between is here instead: what kind of ticket it is, who is selling
 * it, whether that seller can be trusted, and what the price means relative to face value.
 */

/** Ticket type is an enum in configListing.js; fall back to the raw value for unknown options. */
const TICKET_TYPE_LABEL_IDS = {
  'mobile-transfer': 'TicketCard.ticketType.mobileTransfer',
  pdf: 'TicketCard.ticketType.pdf',
  physical: 'TicketCard.ticketType.physical',
};

const SellerLine = props => {
  const { author } = props;
  const name = author?.attributes?.profile?.displayName;

  return (
    <div className={css.seller}>
      <span className={css.sellerName}>
        {name || <FormattedMessage id="TicketCard.unknownSeller" />}
      </span>
      {/* Shared with the listing page so browsing and buying cannot show different reputations. */}
      <SellerReputation user={author} />
    </div>
  );
};

/**
 * Price against face value.
 *
 * Shown because the marketplace's whole pitch to buyers is that they save money, and a bare price
 * gives them no way to check that. Over face value is called out rather than hidden - if a seller
 * is charging a premium the buyer should see it at the point of choosing, not after.
 */
const PriceLine = props => {
  const { price, faceValue, intl } = props;

  const formatted = price ? formatMoney(intl, price) : null;
  // faceValue is stored in pence, price is a Money in subunits - same unit, so comparable directly.
  const hasComparison = price && typeof faceValue === 'number' && faceValue > 0;
  const diff = hasComparison ? price.amount - faceValue : 0;

  const noteClass = diff > 0 ? css.priceOver : diff < 0 ? css.priceUnder : css.priceAt;
  const noteId =
    diff > 0
      ? 'TicketCard.overFaceValue'
      : diff < 0
      ? 'TicketCard.underFaceValue'
      : 'TicketCard.atFaceValue';

  return (
    <div className={css.priceBlock}>
      <span className={css.price}>{formatted || '—'}</span>
      {hasComparison ? (
        <span className={noteClass}>
          <FormattedMessage
            id={noteId}
            values={{
              // formatMoney rejects anything that is not a Money instance, so the difference has
              // to be constructed as one rather than spread off the price.
              amount: formatMoney(intl, new Money(Math.abs(diff), price.currency)),
            }}
          />
        </span>
      ) : null}
    </div>
  );
};

/**
 * @param {Object} props
 * @param {Object} props.listing ticket listing, with `author` included
 * @param {number?} props.faceValue the event's face value in pence, for the price comparison
 * @param {boolean} props.showEventName render the event this ticket is for
 * @param {string?} props.className
 */
const TicketCard = props => {
  const { listing, faceValue, showEventName = false, className } = props;
  const intl = useIntl();

  const { title, price, publicData } = listing?.attributes || {};
  const ticketType = publicData?.ticketType;
  const ticketTypeLabelId = TICKET_TYPE_LABEL_IDS[ticketType];

  return (
    <li className={classNames(css.card, className)}>
      <NamedLink
        className={css.link}
        name="ListingPage"
        params={{ id: listing.id.uuid, slug: createSlug(title || '') }}
      >
        {/* The event page does not need this - the event is pictured and titled directly
            above - but the browse page lists tickets for seller-created events with no event
            header anywhere, where an unnamed ticket is just a price with no context. The
            ticket's title IS the event name: EventPicker sets it when the seller picks. */}
        {showEventName && title ? <p className={css.eventName}>{title}</p> : null}

        <div className={css.top}>
          <span className={css.ticketType}>
            {ticketTypeLabelId ? (
              <FormattedMessage id={ticketTypeLabelId} />
            ) : (
              ticketType || <FormattedMessage id="TicketCard.ticketType.unknown" />
            )}
          </span>
          {publicData?.ticketPlatform ? (
            <span className={css.platform}>{publicData.ticketPlatform}</span>
          ) : null}
        </div>

        <PriceLine price={price} faceValue={faceValue} intl={intl} />

        <SellerLine author={listing.author} />

        <span className={css.cta}>
          <FormattedMessage id="TicketCard.view" />
        </span>
      </NamedLink>
    </li>
  );
};

export default TicketCard;

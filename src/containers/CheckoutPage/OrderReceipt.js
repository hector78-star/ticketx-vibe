import React from 'react';

import { FormattedMessage } from '../../util/reactIntl';
import { formatEventDate } from '../../util/events';
import { readSellerStats } from '../../util/sellerStats';
import {
  TICKET_TYPE_MOBILE,
  TICKET_TYPE_PDF,
  TICKET_TYPE_PHYSICAL,
} from '../../config/configListing';

import css from './OrderReceipt.module.css';

/**
 * The order, as a receipt.
 *
 * The approved checkout direction: one narrow column, label left and value right, a hairline under
 * every row, so the whole thing reads as a single document rather than a page of panels. Approved
 * after four rounds - the rejected alternatives are worth knowing because they will look tempting
 * again:
 *
 * - The escrow promise as a giant headline. "Screaming you can trust us is not the way."
 * - A two-column layout with the journey beside the summary. "Too much going on."
 * - The journey flattened into receipt rows. It stopped reading as a sequence.
 * - Face value shown against the price. Deliberately absent: the buyer already saw it on the
 *   ticket card and the event page and chose this ticket. Repeating it here reads as "you are
 *   being overcharged" at the exact moment they are asked to commit.
 *
 * The escrow promise is carried by the journey, not by a badge or a slogan.
 */

const TICKET_TYPE_LABEL_IDS = {
  [TICKET_TYPE_MOBILE]: 'OrderReceipt.ticketType.mobileTransfer',
  [TICKET_TYPE_PDF]: 'OrderReceipt.ticketType.pdf',
  [TICKET_TYPE_PHYSICAL]: 'OrderReceipt.ticketType.physical',
};

const Row = props => {
  const { labelId, children } = props;
  return (
    <div className={css.row}>
      <dt className={css.label}>
        <FormattedMessage id={labelId} />
      </dt>
      <dd className={css.value}>{children}</dd>
    </div>
  );
};

/**
 * Where the money is, in three steps.
 *
 * Kept as its own section with rules above and below rather than as more receipt rows: it is a
 * sequence, and rendering it in the same label/value rhythm as "Venue" made it read as more order
 * detail instead of as something that happens over time.
 */
const Journey = props => {
  const { providerName } = props;
  return (
    <ol className={css.journey}>
      {[1, 2, 3].map(n => (
        <li key={n} className={n === 1 ? css.stepCurrent : css.step}>
          <span className={css.stepMark} aria-hidden="true">
            {n}
          </span>
          <span className={css.stepBody}>
            <span className={css.stepTitle}>
              <FormattedMessage
                id={`OrderReceipt.step${n}.title`}
                values={{ name: providerName }}
              />
            </span>
            <span className={css.stepDetail}>
              <FormattedMessage
                id={`OrderReceipt.step${n}.detail`}
                values={{ name: providerName }}
              />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
};

const SellerValue = props => {
  const { author, providerName } = props;
  const stats = readSellerStats(author);
  const isVerified = stats?.isVerified === true;
  const hasRating = stats && stats.averageRating != null && stats.reviewCount > 0;

  return (
    <>
      <span className={css.sellerName}>{providerName}</span>
      <span className={isVerified ? css.verified : css.unverified}>
        <FormattedMessage id={isVerified ? 'OrderReceipt.verified' : 'OrderReceipt.unverified'} />
      </span>
      <span className={css.sellerStats}>
        {hasRating ? (
          <FormattedMessage
            id="OrderReceipt.rating"
            values={{ rating: stats.averageRating.toFixed(1), count: stats.completedSalesCount }}
          />
        ) : (
          <FormattedMessage id="OrderReceipt.noRating" />
        )}
      </span>
    </>
  );
};

/**
 * @param {Object} props
 * @param {string} props.title the page title, rendered as the H1 - the page needs exactly one
 *   heading naming it, and inventing a second "Your order" above it would be two names for one page
 * @param {React.ReactNode} [props.breakdown] the itemised OrderBreakdown
 * @param {string} [props.breakdownTitle] heading for the breakdown section
 * @param {Object} props.listing the ticket (or other listing) being bought
 * @param {Object} [props.event] resolved event summary, when the listing is a ticket
 * @param {string} props.providerName seller's display name
 * @param {string} [props.totalPriceFormatted] the order total, ALREADY formatted by the caller via
 *   getFormattedTotalPrice - it is a display string, not a Money, so this must not reformat it
 */
const OrderReceipt = props => {
  const {
    title,
    breakdown,
    breakdownTitle,
    listing,
    event,
    providerName,
    totalPriceFormatted,
  } = props;

  const publicData = listing?.attributes?.publicData || {};
  const ticketTypeLabelId = TICKET_TYPE_LABEL_IDS[publicData.ticketType];
  // A ticket resolves an event; anything else on the marketplace does not, and must not get blank
  // Event / Date / Venue rows.
  const isTicket = !!publicData.eventId;
  const date = event ? formatEventDate(event.eventDate) : null;

  return (
    <section className={css.root}>
      <h1 className={css.heading}>{title}</h1>

      <dl className={css.rows}>
        {isTicket ? (
          <>
            <Row labelId="OrderReceipt.event">{event?.title || listing?.attributes?.title}</Row>
            {date ? (
              <Row labelId="OrderReceipt.date">
                {[date, event?.eventTime].filter(Boolean).join(' · ')}
              </Row>
            ) : null}
            {event?.venue ? <Row labelId="OrderReceipt.venue">{event.venue}</Row> : null}
          </>
        ) : (
          <Row labelId="OrderReceipt.item">{listing?.attributes?.title}</Row>
        )}

        {ticketTypeLabelId ? (
          <Row labelId="OrderReceipt.ticket">
            <FormattedMessage id={ticketTypeLabelId} />
          </Row>
        ) : null}

        <Row labelId="OrderReceipt.seller">
          <SellerValue author={listing?.author} providerName={providerName} />
        </Row>
      </dl>

      <Journey providerName={providerName} />

      {/* The itemised breakdown. A ticket is a single line item, so the approved design showed only
          a total - but a booking is nights times rate plus fees, and dropping the itemisation would
          leave a buyer unable to see what they are paying for. It carries its own total. */}
      {breakdown ? (
        <div className={css.breakdown}>
          <h2 className={css.breakdownHeading}>{breakdownTitle}</h2>
          {breakdown}
        </div>
      ) : totalPriceFormatted ? (
        <div className={css.totalRow}>
          <span className={css.totalLabel}>
            <FormattedMessage id="OrderReceipt.total" />
          </span>
          <span className={css.totalValue}>{totalPriceFormatted}</span>
        </div>
      ) : null}
    </section>
  );
};

export default OrderReceipt;

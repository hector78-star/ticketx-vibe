import React from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { formatPence } from '../../util/events';

import css from './EventStats.module.css';

/**
 * The event statistics row: face value, last sold, tickets sold, people waiting.
 *
 * This owns four things that were previously duplicated wherever the numbers appeared:
 * which stats exist, their labels, how they are formatted, and which ones survive on a
 * phone. Extracting it before adding the waiting count was deliberate - the row appears
 * on the browse card, the event page and the listing flow's EventPicker, so a fourth
 * inline copy was three copies too many.
 *
 * Layout follows the approved mockup (event-card-watch-20260807/variant-B.png): small
 * tracked label above a larger value, entries divided by thin vertical rules.
 *
 *   FACE VALUE │ LAST SOLD │ SOLD │ WAITING
 *   £45        │ £52       │ 3    │ 23
 *
 * At 390px there is not room for four stats plus the two card controls, so `sold` is
 * dropped there and lives on the event page instead. Face value against last sold is
 * the anti-gouging comparison the product is built on, and waiting is the social
 * signal, which leaves sold as the one that earns its place least.
 *
 * @component
 * @param {Object} props
 * @param {number?} props.faceValue in pence
 * @param {number?} props.lastSoldPrice in pence
 * @param {number?} props.soldCount
 * @param {number?} props.watcherCount people waiting for a ticket
 * @param {string} props.currency
 * @param {boolean} props.keepSoldOnMobile render sold at every width (event page)
 * @param {string?} props.className
 */
const EventStats = props => {
  const {
    faceValue,
    lastSoldPrice,
    soldCount,
    watcherCount,
    currency = 'GBP',
    keepSoldOnMobile = false,
    className,
  } = props;
  const intl = useIntl();

  const faceValueText = formatPence(faceValue, currency);
  const lastSoldText = formatPence(lastSoldPrice, currency);

  // The two counts have deliberately different zero semantics.
  //
  // soldCount: 0 is a real answer - "none sold yet" - and must show. undefined means
  // nobody is tracking it, and inventing "0 sold" for an event nobody has counted would
  // be a lie. This reasoning predates the component; it was documented on EventPage.
  //
  // watcherCount: 0 renders as absence. Nobody waiting is not a fact worth stating, and
  // a literal "0 waiting" reads as a dead event on exactly the page that needs to look
  // alive during launch week.
  const hasSold = typeof soldCount === 'number';
  const hasWatchers = typeof watcherCount === 'number' && watcherCount > 0;

  return (
    <dl className={classNames(css.root, className)}>
      <div className={css.stat}>
        <dt className={css.label}>
          <FormattedMessage id="EventStats.faceValue" />
        </dt>
        <dd className={css.value}>{faceValueText || '—'}</dd>
      </div>

      <div className={css.stat}>
        <dt className={css.label}>
          <FormattedMessage id="EventStats.lastSold" />
        </dt>
        <dd className={css.value}>
          {lastSoldText || <FormattedMessage id="EventStats.noSalesYet" />}
        </dd>
      </div>

      {hasSold ? (
        <div className={classNames(css.stat, { [css.statMobileHidden]: !keepSoldOnMobile })}>
          <dt className={css.label}>
            <FormattedMessage id="EventStats.soldCount" />
          </dt>
          <dd className={css.value}>{intl.formatNumber(soldCount)}</dd>
        </div>
      ) : null}

      {hasWatchers ? (
        <div className={css.stat}>
          <dt className={css.label}>
            <FormattedMessage id="EventStats.waiting" />
          </dt>
          <dd className={css.value}>{intl.formatNumber(watcherCount)}</dd>
        </div>
      ) : null}
    </dl>
  );
};

export default EventStats;

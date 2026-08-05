import React from 'react';

import { FormattedMessage } from '../../../util/reactIntl';
import { TICKET_LISTING_TYPE } from '../../../config/configListing';

import css from './HandoverPanel.module.css';

/**
 * Post-purchase handover.
 *
 * Handover happens off-platform, so this panel is the only place the app tells either party what
 * to do next. Coordination runs through the in-app thread: Sharetribe sends a built-in "New
 * message" email to the recipient of every message, so neither party has to sit on the page
 * waiting, and no phone number needs collecting or disclosing.
 */
const HandoverPanel = props => {
  const { isProvider, listing } = props;

  const publicData = listing?.attributes?.publicData || {};
  const isTicket = publicData.listingType === TICKET_LISTING_TYPE;
  const ticketType = publicData.ticketType;

  const buyerBodyId = !isTicket
    ? 'HandoverPanel.buyerBodyOther'
    : ticketType === 'mobile-transfer'
    ? 'HandoverPanel.buyerBodyMobile'
    : ticketType === 'pdf'
    ? 'HandoverPanel.buyerBodyPdf'
    : 'HandoverPanel.buyerBodyPhysical';

  return (
    <section className={css.root}>
      <h3 className={css.heading}>
        <FormattedMessage
          id={isProvider ? 'HandoverPanel.sellerHeading' : 'HandoverPanel.buyerHeading'}
        />
      </h3>
      <p className={css.body}>
        <FormattedMessage
          id={
            isProvider
              ? isTicket
                ? 'HandoverPanel.sellerBodyTicket'
                : 'HandoverPanel.sellerBodyOther'
              : buyerBodyId
          }
        />
      </p>
      <p className={css.note}>
        <FormattedMessage id="HandoverPanel.emailNote" />
      </p>
    </section>
  );
};

export default HandoverPanel;

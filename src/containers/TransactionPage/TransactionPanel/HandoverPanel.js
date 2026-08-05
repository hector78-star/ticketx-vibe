import React, { useState } from 'react';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { TICKET_LISTING_TYPE } from '../../../config/configListing';

import css from './HandoverPanel.module.css';

/**
 * Post-purchase handover.
 *
 * Handover happens off-platform, so this panel is the only place the app tells either party what
 * to do next. The in-app thread is the primary channel; WhatsApp is the fallback for when a seller
 * is not replying here.
 *
 * On revealing the seller's number: it is deliberately shared by the seller rather than disclosed
 * automatically. Automatic disclosure is not reachable from this codebase - the number lives in the
 * listing's private data, which only its author can read; the server cannot read it either, since
 * the trusted SDK still acts as the requesting user and the Integration API is not set up; and the
 * transaction process has no reveal action and no provider-actor transition carrying protected
 * data. Seller-consented sharing needs none of that, and is better privacy besides: the number goes
 * to one buyer who has paid, at the moment the seller chooses.
 */

// Deliberately loose: sellers write numbers as "07700 900123", "+44 7700 900123", "44-7700-900123".
// Requires at least 9 digits so prices and dates in the thread are not mistaken for phone numbers.
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/;

const digitsOnly = value => (value || '').replace(/\D/g, '');

/** Build a wa.me link. Assumes a UK number when no country code is present. */
const waLink = raw => {
  let digits = digitsOnly(raw);
  if (!digits) return null;
  if (digits.startsWith('0')) {
    digits = `44${digits.slice(1)}`;
  }
  return `https://wa.me/${digits}`;
};

/** Find a number the provider has posted into the thread. */
const findSharedNumber = (messages, providerId) => {
  if (!messages?.length || !providerId) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const senderId = m?.sender?.id?.uuid;
    if (senderId !== providerId) continue;
    const match = PHONE_RE.exec(m?.attributes?.content || '');
    if (match) return match[1].trim();
  }
  return null;
};

const HandoverPanel = props => {
  const {
    isProvider,
    listing,
    provider,
    messages,
    ownWhatsappNumber,
    onSendMessage,
    transactionId,
  } = props;
  const intl = useIntl();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const listingType = listing?.attributes?.publicData?.listingType;
  const isTicket = listingType === TICKET_LISTING_TYPE;
  const ticketType = listing?.attributes?.publicData?.ticketType;

  const sharedNumber = findSharedNumber(messages, provider?.id?.uuid);

  const shareNumber = async () => {
    if (!ownWhatsappNumber || sending) return;
    setSending(true);
    try {
      await onSendMessage(
        transactionId,
        intl.formatMessage(
          { id: 'HandoverPanel.shareMessage' },
          { number: ownWhatsappNumber }
        )
      );
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  // ---- Seller ------------------------------------------------------------
  if (isProvider) {
    return (
      <section className={css.root}>
        <h3 className={css.heading}>
          <FormattedMessage id="HandoverPanel.sellerHeading" />
        </h3>
        <p className={css.body}>
          <FormattedMessage
            id={isTicket ? 'HandoverPanel.sellerBodyTicket' : 'HandoverPanel.sellerBodyOther'}
          />
        </p>

        {ownWhatsappNumber ? (
          sharedNumber || sent ? (
            <p className={css.shared}>
              <FormattedMessage id="HandoverPanel.sellerAlreadyShared" />
            </p>
          ) : (
            <>
              <p className={css.numberRow}>
                <span className={css.numberLabel}>
                  <FormattedMessage id="HandoverPanel.yourNumber" />
                </span>
                <span className={css.number}>{ownWhatsappNumber}</span>
              </p>
              <button
                type="button"
                className={css.primaryButton}
                onClick={shareNumber}
                disabled={sending}
              >
                <FormattedMessage id="HandoverPanel.shareButton" />
              </button>
              <p className={css.note}>
                <FormattedMessage id="HandoverPanel.shareNote" />
              </p>
            </>
          )
        ) : (
          <p className={css.note}>
            <FormattedMessage id="HandoverPanel.sellerNoNumber" />
          </p>
        )}
      </section>
    );
  }

  // ---- Buyer -------------------------------------------------------------
  const link = sharedNumber ? waLink(sharedNumber) : null;

  return (
    <section className={css.root}>
      <h3 className={css.heading}>
        <FormattedMessage id="HandoverPanel.buyerHeading" />
      </h3>
      <p className={css.body}>
        <FormattedMessage
          id={
            isTicket
              ? ticketType === 'mobile-transfer'
                ? 'HandoverPanel.buyerBodyMobile'
                : ticketType === 'pdf'
                ? 'HandoverPanel.buyerBodyPdf'
                : 'HandoverPanel.buyerBodyPhysical'
              : 'HandoverPanel.buyerBodyOther'
          }
        />
      </p>

      {link ? (
        <>
          <p className={css.numberRow}>
            <span className={css.numberLabel}>
              <FormattedMessage id="HandoverPanel.sellerNumber" />
            </span>
            <span className={css.number}>{sharedNumber}</span>
          </p>
          <a className={css.primaryButton} href={link} target="_blank" rel="noopener noreferrer">
            <FormattedMessage id="HandoverPanel.whatsappButton" />
          </a>
          <p className={css.note}>
            <FormattedMessage id="HandoverPanel.buyerWhatsappNote" />
          </p>
        </>
      ) : (
        <p className={css.note}>
          <FormattedMessage id="HandoverPanel.buyerNoNumberYet" />
        </p>
      )}
    </section>
  );
};

export default HandoverPanel;

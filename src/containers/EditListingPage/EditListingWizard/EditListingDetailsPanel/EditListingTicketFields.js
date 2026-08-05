import React from 'react';
import { useFormState } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { required } from '../../../../util/validators';
import { FieldSelect, FieldTextInput, FieldCheckbox } from '../../../../components';
import {
  TICKET_TYPE_MOBILE,
  TICKET_TYPE_PDF,
  TICKET_TYPE_PHYSICAL,
} from '../../../../config/configListing';

import css from './EditListingTicketFields.module.css';

/**
 * Ticket type, its attestation, and the seller's WhatsApp number.
 *
 * The three types differ only in what the seller is attesting to. Handover itself is identical:
 * buyer and seller arrange it in the message thread or over WhatsApp, so there is no delivery
 * method to choose and no PDF to upload at listing time.
 */
const TICKET_TYPE_OPTIONS = [
  { value: TICKET_TYPE_MOBILE, labelId: 'EditListingTicketFields.typeMobile' },
  { value: TICKET_TYPE_PDF, labelId: 'EditListingTicketFields.typePdf' },
  { value: TICKET_TYPE_PHYSICAL, labelId: 'EditListingTicketFields.typePhysical' },
];

const Attestation = props => {
  const { id, name, headingId, bodyId, labelId, intl } = props;
  return (
    <div className={css.attestation}>
      <h4 className={css.attestationHeading}>
        <FormattedMessage id={headingId} />
      </h4>
      <p className={css.attestationBody}>
        <FormattedMessage id={bodyId} />
      </p>
      <FieldCheckbox
        id={id}
        name={name}
        label={intl.formatMessage({ id: labelId })}
        value={true}
        validate={required(intl.formatMessage({ id: 'EditListingTicketFields.attestationRequired' }))}
      />
    </div>
  );
};

const EditListingTicketFields = props => {
  const { formId } = props;
  const intl = useIntl();
  const { values } = useFormState({ subscription: { values: true } });
  const ticketType = values.pub_ticketType;

  return (
    <div className={css.root}>
      <FieldSelect
        id={`${formId}pub_ticketType`}
        name="pub_ticketType"
        className={css.field}
        label={intl.formatMessage({ id: 'EditListingTicketFields.typeLabel' })}
        validate={required(intl.formatMessage({ id: 'EditListingTicketFields.typeRequired' }))}
      >
        <option disabled value="">
          {intl.formatMessage({ id: 'EditListingTicketFields.typePlaceholder' })}
        </option>
        {TICKET_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {intl.formatMessage({ id: opt.labelId })}
          </option>
        ))}
      </FieldSelect>

      {ticketType === TICKET_TYPE_MOBILE ? (
        <>
          <FieldTextInput
            id={`${formId}pub_ticketPlatform`}
            name="pub_ticketPlatform"
            className={css.field}
            type="text"
            label={intl.formatMessage({ id: 'EditListingTicketFields.platformLabel' })}
            placeholder={intl.formatMessage({
              id: 'EditListingTicketFields.platformPlaceholder',
            })}
            validate={required(
              intl.formatMessage({ id: 'EditListingTicketFields.platformRequired' })
            )}
          />
          <Attestation
            id={`${formId}pub_transferabilityConfirmed`}
            name="pub_transferabilityConfirmed"
            headingId="EditListingTicketFields.transferHeading"
            bodyId="EditListingTicketFields.transferBody"
            labelId="EditListingTicketFields.transferLabel"
            intl={intl}
          />
        </>
      ) : null}

      {ticketType === TICKET_TYPE_PDF ? (
        <Attestation
          id={`${formId}pub_pdfAttestationConfirmed`}
          name="pub_pdfAttestationConfirmed"
          headingId="EditListingTicketFields.pdfHeading"
          bodyId="EditListingTicketFields.pdfBody"
          labelId="EditListingTicketFields.pdfLabel"
          intl={intl}
        />
      ) : null}

      {ticketType === TICKET_TYPE_PHYSICAL ? (
        <Attestation
          id={`${formId}pub_physicalHandoverAcknowledged`}
          name="pub_physicalHandoverAcknowledged"
          headingId="EditListingTicketFields.physicalHeading"
          bodyId="EditListingTicketFields.physicalBody"
          labelId="EditListingTicketFields.physicalLabel"
          intl={intl}
        />
      ) : null}

      {/*
        Stored in the listing's PRIVATE data, so it is never part of the public listing and is not
        visible to anyone browsing. Surfacing it to a buyer once they have paid still needs a
        server-side endpoint that verifies a completed transaction before returning it - that piece
        is not built yet, so today the number is captured and kept private, not yet revealed.
      */}
      <FieldTextInput
        id={`${formId}priv_whatsappNumber`}
        name="priv_whatsappNumber"
        className={css.field}
        type="text"
        label={intl.formatMessage({ id: 'EditListingTicketFields.whatsappLabel' })}
        placeholder={intl.formatMessage({ id: 'EditListingTicketFields.whatsappPlaceholder' })}
        validate={required(intl.formatMessage({ id: 'EditListingTicketFields.whatsappRequired' }))}
      />
      <p className={css.privacyNote}>
        <FormattedMessage id="EditListingTicketFields.whatsappPrivacy" />
      </p>

      <p className={css.handoverNote}>
        <FormattedMessage id="EditListingTicketFields.handoverNote" />
      </p>
    </div>
  );
};

export default EditListingTicketFields;

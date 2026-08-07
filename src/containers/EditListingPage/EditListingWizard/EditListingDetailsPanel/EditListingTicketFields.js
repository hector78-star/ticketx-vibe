import React from 'react';
import { useFormState } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { required } from '../../../../util/validators';
import { PillChoice, FieldTextInput, FieldCheckbox } from '../../../../components';
import {
  TICKET_TYPE_MOBILE,
  TICKET_TYPE_PDF,
  TICKET_TYPE_PHYSICAL,
} from '../../../../config/configListing';

import css from './EditListingTicketFields.module.css';

/**
 * Ticket type and its attestation.
 *
 * The three types differ only in what the seller is attesting to. Handover itself is identical:
 * buyer and seller arrange it in the in-app message thread, so there is no delivery method to
 * choose and no PDF to upload at listing time.
 *
 * Following flow 5.3, each stage appears only once the one before it is answered, so a seller sees
 * one question at a time instead of a wall of fields. The underlying form is unchanged - this is
 * disclosure, not a different submission model.
 */
const TICKET_TYPE_OPTIONS = [
  {
    value: TICKET_TYPE_MOBILE,
    labelId: 'EditListingTicketFields.typeMobile',
    hintId: 'EditListingTicketFields.typeMobileHint',
  },
  {
    value: TICKET_TYPE_PDF,
    labelId: 'EditListingTicketFields.typePdf',
    hintId: 'EditListingTicketFields.typePdfHint',
  },
  {
    value: TICKET_TYPE_PHYSICAL,
    labelId: 'EditListingTicketFields.typePhysical',
    hintId: 'EditListingTicketFields.typePhysicalHint',
  },
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
        validate={required(
          intl.formatMessage({ id: 'EditListingTicketFields.attestationRequired' })
        )}
      />
    </div>
  );
};

/**
 * @param {Object} props
 * @param {'type'|'attestation'} props.stage which step of the flow is on screen. Type and
 *   attestation used to render together; the approved flow gives each its own screen, so this
 *   renders one or the other rather than both.
 * @param {Function} [props.onTypeChosen] called after a type is picked, to advance the flow
 */
const EditListingTicketFields = props => {
  const { formId, stage = 'type', onTypeChosen } = props;
  const intl = useIntl();
  const { values } = useFormState({ subscription: { values: true } });
  const ticketType = values.pub_ticketType;

  if (stage === 'type') {
    return (
      <div className={css.root}>
        <PillChoice
          id={`${formId}pub_ticketType`}
          name="pub_ticketType"
          className={css.field}
          options={TICKET_TYPE_OPTIONS.map(opt => ({
            value: opt.value,
            label: intl.formatMessage({ id: opt.labelId }),
            hint: intl.formatMessage({ id: opt.hintId }),
          }))}
          onSelect={onTypeChosen}
          validate={required(intl.formatMessage({ id: 'EditListingTicketFields.typeRequired' }))}
        />
      </div>
    );
  }

  return (
    <div className={css.root}>
      {ticketType === TICKET_TYPE_MOBILE ? (
        <>
          <FieldTextInput
            id={`${formId}pub_ticketPlatform`}
            name="pub_ticketPlatform"
            className={css.field}
            labelClassName={css.fieldLabel}
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

      <p className={css.handoverNote}>
        <FormattedMessage id="EditListingTicketFields.handoverNote" />
      </p>
    </div>
  );
};

export default EditListingTicketFields;

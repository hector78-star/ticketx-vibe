import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, useFormState } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { useConfiguration } from '../../../../context/configurationContext';
import { getListingsById } from '../../../../ducks/marketplaceData.duck';
import { fetchEvents } from '../../../../ducks/events.duck';
import {
  eventSummary,
  formatEventDate,
  formatPence,
  hasAdminConfigured,
} from '../../../../util/events';
import { FieldSelect } from '../../../../components';

import css from './EventPicker.module.css';

/**
 * Curated-event picker for ticket listings.
 *
 * Sellers do not describe an event, they choose one. Picking an event writes its details into the
 * form - eventId plus a denormalised copy of title, date, time and venue - and generates the
 * listing title. That keeps every ticket for the same event described identically, which is what
 * makes grouping them on an event page trustworthy.
 *
 * The face value and last sold price are shown as pricing guidance only. They are never written to
 * the ticket: they belong to the event, and the admin keeps them current there.
 */
const EventPicker = props => {
  const { formId } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const form = useForm();
  const { values } = useFormState({ subscription: { values: true } });

  const { listingIds, fetched, inProgress, error } = useSelector(state => state.events);
  // Derive under useMemo: getListingsById returns a new array each call.
  const marketplaceData = useSelector(state => state.marketplaceData);
  const events = useMemo(() => getListingsById({ marketplaceData }, listingIds), [
    marketplaceData,
    listingIds,
  ]);

  useEffect(() => {
    if (!fetched && !inProgress && hasAdminConfigured()) {
      dispatch(fetchEvents({ config }));
    }
  }, [dispatch, config, fetched, inProgress]);

  const summaries = events.map(eventSummary).filter(Boolean);
  const selected = summaries.find(e => e.id === values.pub_eventId);

  // Copy the chosen event's details onto the ticket. Sellers never type these, so the fields are
  // excluded from the generic renderer in EditListingDetailsForm.
  const onSelectEvent = eventId => {
    const chosen = summaries.find(e => e.id === eventId);
    if (!chosen) {
      return;
    }
    form.batch(() => {
      form.change('pub_eventId', chosen.id);
      form.change('pub_eventTitle', chosen.title);
      form.change('pub_eventDate', chosen.eventDate);
      form.change('pub_eventTime', chosen.eventTime);
      form.change('pub_venue', chosen.venue);
      form.change('title', chosen.title);
    });
  };

  if (!hasAdminConfigured()) {
    return (
      <p className={css.setupNotice}>
        <FormattedMessage id="EventPicker.adminNotConfigured" />
      </p>
    );
  }

  if (error) {
    return (
      <p className={css.error}>
        <FormattedMessage id="EventPicker.fetchFailed" />
      </p>
    );
  }

  if (inProgress && summaries.length === 0) {
    return (
      <p className={css.loading}>
        <FormattedMessage id="EventPicker.loading" />
      </p>
    );
  }

  if (fetched && summaries.length === 0) {
    return (
      <p className={css.setupNotice}>
        <FormattedMessage id="EventPicker.noEvents" />
      </p>
    );
  }

  const faceValue = formatPence(selected?.faceValue, config.currency);
  const lastSold = formatPence(selected?.lastSoldPrice, config.currency);

  return (
    <div className={css.root}>
      <FieldSelect
        id={`${formId}pub_eventId`}
        name="pub_eventId"
        className={css.select}
        label={intl.formatMessage({ id: 'EventPicker.label' })}
        validate={value =>
          value ? undefined : intl.formatMessage({ id: 'EventPicker.required' })
        }
        onChange={onSelectEvent}
      >
        <option disabled value="">
          {intl.formatMessage({ id: 'EventPicker.placeholder' })}
        </option>
        {summaries.map(event => {
          const date = formatEventDate(event.eventDate);
          const parts = [event.title, date, event.venue].filter(Boolean);
          return (
            <option key={event.id} value={event.id}>
              {parts.join(' — ')}
            </option>
          );
        })}
      </FieldSelect>

      {selected ? (
        <div className={css.guidance}>
          <h4 className={css.guidanceHeading}>
            <FormattedMessage id="EventPicker.guidanceHeading" />
          </h4>
          <dl className={css.guidanceList}>
            <div className={css.guidanceRow}>
              <dt className={css.guidanceTerm}>
                <FormattedMessage id="EventPicker.faceValue" />
              </dt>
              <dd className={css.guidanceValue}>{faceValue || '—'}</dd>
            </div>
            <div className={css.guidanceRow}>
              <dt className={css.guidanceTerm}>
                <FormattedMessage id="EventPicker.lastSold" />
              </dt>
              <dd className={css.guidanceValue}>
                {lastSold || intl.formatMessage({ id: 'EventPicker.noSalesYet' })}
              </dd>
            </div>
          </dl>
          <p className={css.guidanceNote}>
            <FormattedMessage id="EventPicker.guidanceNote" />
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default EventPicker;

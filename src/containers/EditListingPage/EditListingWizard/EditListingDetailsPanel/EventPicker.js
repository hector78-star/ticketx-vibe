import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, useFormState } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { useConfiguration } from '../../../../context/configurationContext';
import { getListingsById } from '../../../../ducks/marketplaceData.duck';
import { fetchEvents, createSellerEvent } from '../../../../ducks/events.duck';
import { eventSummary, formatEventDate, formatPence } from '../../../../util/events';
import { fuzzySearch } from '../../../../util/fuzzyMatch';
import { Button } from '../../../../components';

import css from './EventPicker.module.css';

/**
 * Curated-event picker for ticket listings.
 *
 * Sellers do not describe an event, they choose one. Picking an event writes its details into the
 * form - eventId plus a denormalised copy of title, date, time and venue - and generates the
 * listing title. That keeps every ticket for the same event described identically, which is what
 * makes grouping them on an event page trustworthy.
 *
 * Search is fuzzy because sellers type "reading fest" and "readingfestival", not the exact
 * catalogue wording. If nothing matches, they can add the event themselves rather than being
 * dead-ended: a missing event would otherwise block the sale entirely.
 *
 * Face value and last sold price are pricing guidance only. They are never written to the ticket -
 * they belong to the event, where admin keeps them current.
 */
const MAX_SUGGESTIONS = 8;

const EMPTY_NEW_EVENT = { title: '', eventDate: '', eventTime: '', venue: '' };

const toNumberOrNull = value => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const CreateEventForm = props => {
  const { onCreated, onCancel } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const { creating, createError } = useSelector(state => state.events);
  const [values, setValues] = useState(EMPTY_NEW_EVENT);

  const dateValid = /^\d{8}$/.test(String(values.eventDate));
  const canSubmit = !!values.title.trim() && dateValid && !!values.venue.trim();

  const field = (key, labelId, placeholder, type = 'text') => (
    <label className={css.newField} htmlFor={`new-event-${key}`}>
      <span className={css.newFieldLabel}>
        <FormattedMessage id={labelId} />
      </span>
      <input
        id={`new-event-${key}`}
        className={css.newInput}
        type={type}
        value={values[key]}
        placeholder={placeholder}
        onChange={e => setValues({ ...values, [key]: e.target.value })}
      />
    </label>
  );

  const onSubmit = async () => {
    const action = await dispatch(
      createSellerEvent({
        values: {
          title: values.title.trim(),
          eventDate: toNumberOrNull(values.eventDate),
          eventTime: values.eventTime.trim(),
          venue: values.venue.trim(),
        },
        config,
      })
    );
    const listing = action.payload?.listing;
    if (listing) {
      onCreated(eventSummary(listing));
      setValues(EMPTY_NEW_EVENT);
    }
  };

  const datePreview = formatEventDate(toNumberOrNull(values.eventDate));

  return (
    <div className={css.createBox}>
      <h4 className={css.createHeading}>
        <FormattedMessage id="EventPicker.createHeading" />
      </h4>
      <p className={css.createBody}>
        <FormattedMessage id="EventPicker.createBody" />
      </p>
      {field('title', 'EventPicker.createName', 'e.g. Opening Ball 2026')}
      <div className={css.newFieldRow}>
        {field('eventDate', 'EventPicker.createDate', '20260914', 'number')}
        {field('eventTime', 'EventPicker.createTime', '19:30')}
      </div>
      {datePreview ? <p className={css.datePreview}>{datePreview}</p> : null}
      {field('venue', 'EventPicker.createVenue', 'e.g. Lower College Lawn')}
      {createError ? (
        <p className={css.error}>
          <FormattedMessage id="EventPicker.createFailed" />
        </p>
      ) : null}
      <div className={css.createActions}>
        <Button
          className={css.createButton}
          onClick={onSubmit}
          disabled={!canSubmit}
          inProgress={creating}
        >
          <FormattedMessage id="EventPicker.createSubmit" />
        </Button>
        <button type="button" className={css.linkButton} onClick={onCancel}>
          <FormattedMessage id="EventPicker.createCancel" />
        </button>
      </div>
    </div>
  );
};

const EventPicker = props => {
  const { formId } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const form = useForm();
  const { values } = useFormState({ subscription: { values: true } });

  const { listingIds, fetched, inProgress, error } = useSelector(state => state.events);
  const marketplaceData = useSelector(state => state.marketplaceData);
  const events = useMemo(() => getListingsById({ marketplaceData }, listingIds), [
    marketplaceData,
    listingIds,
  ]);

  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!fetched && !inProgress) {
      dispatch(fetchEvents({ config }));
    }
  }, [dispatch, config, fetched, inProgress]);

  const summaries = useMemo(() => events.map(eventSummary).filter(Boolean), [events]);
  const selected = summaries.find(e => e.id === values.pub_eventId);

  const suggestions = useMemo(
    () => fuzzySearch(summaries, query, e => `${e.title} ${e.venue || ''}`, MAX_SUGGESTIONS),
    [summaries, query]
  );

  const selectEvent = chosen => {
    if (!chosen) return;
    form.batch(() => {
      form.change('pub_eventId', chosen.id);
      form.change('pub_eventTitle', chosen.title);
      form.change('pub_eventDate', chosen.eventDate);
      form.change('pub_eventTime', chosen.eventTime);
      form.change('pub_venue', chosen.venue);
      form.change('title', chosen.title);
    });
    setQuery('');
    setIsCreating(false);
  };

  const clearSelection = () => {
    form.batch(() => {
      form.change('pub_eventId', undefined);
      form.change('pub_eventTitle', undefined);
      form.change('title', undefined);
    });
  };

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

  // Selected state: show what was chosen plus the pricing guidance, with a way back.
  if (selected) {
    const faceValue = formatPence(selected.faceValue, config.currency);
    const lastSold = formatPence(selected.lastSoldPrice, config.currency);
    const date = formatEventDate(selected.eventDate);

    return (
      <div className={css.root}>
        <div className={css.selected}>
          <div>
            <p className={css.selectedTitle}>{selected.title}</p>
            <p className={css.selectedMeta}>
              {[date, selected.eventTime, selected.venue].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button type="button" className={css.linkButton} onClick={clearSelection}>
            <FormattedMessage id="EventPicker.change" />
          </button>
        </div>

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
      </div>
    );
  }

  return (
    <div className={css.root}>
      <label className={css.searchLabel} htmlFor={`${formId}eventSearch`}>
        <FormattedMessage id="EventPicker.label" />
      </label>
      <input
        id={`${formId}eventSearch`}
        className={css.searchInput}
        type="text"
        autoComplete="off"
        value={query}
        placeholder={intl.formatMessage({ id: 'EventPicker.searchPlaceholder' })}
        onChange={e => {
          setQuery(e.target.value);
          setIsCreating(false);
        }}
      />

      {suggestions.length > 0 ? (
        <ul className={css.suggestions}>
          {suggestions.map(event => {
            const date = formatEventDate(event.eventDate);
            return (
              <li key={event.id}>
                <button
                  type="button"
                  className={css.suggestion}
                  onClick={() => selectEvent(event)}
                >
                  <span className={css.suggestionTitle}>{event.title}</span>
                  <span className={css.suggestionMeta}>
                    {[date, event.venue].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={css.noMatches}>
          {query ? (
            <FormattedMessage id="EventPicker.noMatches" values={{ query }} />
          ) : (
            <FormattedMessage id="EventPicker.noEvents" />
          )}
        </p>
      )}

      {isCreating ? (
        <CreateEventForm onCreated={selectEvent} onCancel={() => setIsCreating(false)} />
      ) : (
        <button type="button" className={css.linkButton} onClick={() => setIsCreating(true)}>
          <FormattedMessage id="EventPicker.createPrompt" />
        </button>
      )}
    </div>
  );
};

export default EventPicker;

import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { eventSummary, formatEventDate, formatPence, ADMIN_USER_ID } from '../../util/events';
import {
  fetchAdminEvents,
  updateEvent,
  createEvent,
  setEventImage,
} from './AdminEventsPage.duck';

import { Page, LayoutSingleColumn, H1, H2, Button, ResponsiveImage } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import NotFoundPage from '../NotFoundPage/NotFoundPage';

import css from './AdminEventsPage.module.css';

const EMPTY_EVENT = {
  title: '',
  eventDate: '',
  eventTime: '',
  venue: '',
  faceValue: '',
  lastSoldPrice: '',
  soldCount: '',
};

/** Numbers come back from inputs as strings; the API expects integers or null. */
const toNumberOrNull = value => {
  if (value === '' || value == null) {
    return null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const normaliseValues = values => ({
  title: values.title?.trim(),
  eventDate: toNumberOrNull(values.eventDate),
  eventTime: values.eventTime?.trim() || null,
  venue: values.venue?.trim() || null,
  faceValue: toNumberOrNull(values.faceValue),
  lastSoldPrice: toNumberOrNull(values.lastSoldPrice),
  soldCount: toNumberOrNull(values.soldCount),
});

const EventFields = props => {
  const { values, onChange, idPrefix, currency } = props;
  const intl = useIntl();

  const field = (key, labelId, placeholder, type = 'text') => (
    <label className={css.field} htmlFor={`${idPrefix}-${key}`}>
      <span className={css.fieldLabel}>
        <FormattedMessage id={labelId} />
      </span>
      <input
        id={`${idPrefix}-${key}`}
        className={css.input}
        type={type}
        value={values[key] ?? ''}
        placeholder={placeholder}
        onChange={e => onChange({ ...values, [key]: e.target.value })}
      />
    </label>
  );

  const faceValuePreview = formatPence(toNumberOrNull(values.faceValue), currency);
  const lastSoldPreview = formatPence(toNumberOrNull(values.lastSoldPrice), currency);
  const datePreview = formatEventDate(toNumberOrNull(values.eventDate));

  return (
    <div className={css.fields}>
      {field('title', 'AdminEventsPage.fieldTitle', 'Reading Festival 2026')}
      <div className={css.fieldRow}>
        {field('eventDate', 'AdminEventsPage.fieldDate', '20260914', 'number')}
        {field('eventTime', 'AdminEventsPage.fieldTime', '19:30')}
      </div>
      {datePreview ? <p className={css.preview}>{datePreview}</p> : null}
      {field('venue', 'AdminEventsPage.fieldVenue', 'Richfield Avenue, Reading')}
      <div className={css.fieldRow}>
        {field('faceValue', 'AdminEventsPage.fieldFaceValue', '4500', 'number')}
        {field('lastSoldPrice', 'AdminEventsPage.fieldLastSold', '6000', 'number')}
      </div>
      {field('soldCount', 'AdminEventsPage.fieldSoldCount', '120', 'number')}
      <p className={css.preview}>
        {intl.formatMessage(
          { id: 'AdminEventsPage.pricePreview' },
          { faceValue: faceValuePreview || '—', lastSold: lastSoldPreview || '—' }
        )}
      </p>
    </div>
  );
};

const EventRow = props => {
  const { listing, config } = props;
  const dispatch = useDispatch();
  const savingId = useSelector(state => state.adminEvents.savingId);
  const summary = eventSummary(listing);
  const listingId = listing.id;

  const [values, setValues] = useState({
    title: summary.title ?? '',
    eventDate: summary.eventDate ?? '',
    eventTime: summary.eventTime ?? '',
    venue: summary.venue ?? '',
    faceValue: summary.faceValue ?? '',
    lastSoldPrice: summary.lastSoldPrice ?? '',
    soldCount: summary.soldCount ?? '',
  });

  const isSaving = savingId === listingId.uuid;

  const onSave = () => {
    dispatch(updateEvent({ listingId, values: normaliseValues(values), config }));
  };

  const onPickImage = e => {
    const file = e.target.files?.[0];
    if (file) {
      dispatch(setEventImage({ listingId, file, config }));
    }
  };

  return (
    <li className={css.row}>
      <div className={css.rowImage}>
        <ResponsiveImage
          rootClassName={css.image}
          alt={summary.title}
          image={listing.images?.[0]}
          variants={['listing-card', 'listing-card-2x']}
        />
        <label className={css.imageButton}>
          <FormattedMessage id="AdminEventsPage.changePhoto" />
          <input type="file" accept="image/*" className={css.fileInput} onChange={onPickImage} />
        </label>
      </div>
      <div className={css.rowBody}>
        <EventFields
          values={values}
          onChange={setValues}
          idPrefix={listingId.uuid}
          currency={config.currency}
        />
        <Button className={css.saveButton} onClick={onSave} inProgress={isSaving}>
          <FormattedMessage id="AdminEventsPage.save" />
        </Button>
      </div>
    </li>
  );
};

const CreateEventForm = props => {
  const { config } = props;
  const dispatch = useDispatch();
  const savingId = useSelector(state => state.adminEvents.savingId);
  const [values, setValues] = useState(EMPTY_EVENT);
  const [file, setFile] = useState(null);

  const isSaving = savingId === 'new';
  const canSubmit = !!values.title?.trim() && !!values.eventDate && !!values.venue?.trim();

  const onCreate = async () => {
    const action = await dispatch(createEvent({ values: normaliseValues(values), config }));
    const newId = action.payload?.listingId;
    if (newId && file) {
      dispatch(setEventImage({ listingId: newId, file, config }));
    }
    setValues(EMPTY_EVENT);
    setFile(null);
  };

  return (
    <section className={css.createSection}>
      <H2 className={css.createHeading}>
        <FormattedMessage id="AdminEventsPage.createHeading" />
      </H2>
      <EventFields
        values={values}
        onChange={setValues}
        idPrefix="new-event"
        currency={config.currency}
      />
      <label className={css.field}>
        <span className={css.fieldLabel}>
          <FormattedMessage id="AdminEventsPage.fieldPhoto" />
        </span>
        <input
          type="file"
          accept="image/*"
          className={css.input}
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <Button
        className={css.saveButton}
        onClick={onCreate}
        disabled={!canSubmit}
        inProgress={isSaving}
      >
        <FormattedMessage id="AdminEventsPage.create" />
      </Button>
    </section>
  );
};

/**
 * Admin-only curation of the event catalog.
 *
 * Everything an event needs is editable here, so curating no longer means walking the generic
 * listing wizard to change one number.
 */
export const AdminEventsPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const currentUser = useSelector(state => state.user?.currentUser);
  const { listingIds, fetched, inProgress, error, saveError } = useSelector(
    state => state.adminEvents
  );
  const marketplaceData = useSelector(state => state.marketplaceData);
  const events = useMemo(() => getListingsById({ marketplaceData }, listingIds), [
    marketplaceData,
    listingIds,
  ]);

  const isAdmin = !!ADMIN_USER_ID && currentUser?.id?.uuid === ADMIN_USER_ID;

  useEffect(() => {
    if (isAdmin && !fetched && !inProgress) {
      dispatch(fetchAdminEvents({ config }));
    }
  }, [dispatch, config, isAdmin, fetched, inProgress]);

  // Anyone who is not the curating account gets a 404 rather than a "forbidden" page: the tab's
  // existence is not information a normal user needs.
  if (currentUser && !isAdmin) {
    return <NotFoundPage staticContext={{}} />;
  }

  return (
    <Page title={intl.formatMessage({ id: 'AdminEventsPage.title' })} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <H1 className={css.heading}>
          <FormattedMessage id="AdminEventsPage.title" />
        </H1>
        <p className={css.subtitle}>
          <FormattedMessage id="AdminEventsPage.subtitle" />
        </p>

        {saveError ? (
          <p className={css.error}>
            <FormattedMessage id="AdminEventsPage.saveFailed" />
          </p>
        ) : null}

        <CreateEventForm config={config} />

        <H2 className={css.listHeading}>
          <FormattedMessage id="AdminEventsPage.existingHeading" />
        </H2>

        {error ? (
          <p className={css.error}>
            <FormattedMessage id="AdminEventsPage.fetchFailed" />
          </p>
        ) : inProgress && events.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="AdminEventsPage.loading" />
          </p>
        ) : events.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="AdminEventsPage.noEvents" />
          </p>
        ) : (
          <ul className={css.list}>
            {events.map(listing => (
              <EventRow key={listing.id.uuid} listing={listing} config={config} />
            ))}
          </ul>
        )}
      </LayoutSingleColumn>
    </Page>
  );
};

export default AdminEventsPageComponent;

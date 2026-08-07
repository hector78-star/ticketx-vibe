import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { FormattedMessage } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getMarketplaceEntities, addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { createImageVariantConfig } from '../../util/sdkLoader';
import { storableError } from '../../util/errors';
import * as log from '../../util/log';
import { eventSummary, formatEventDate } from '../../util/events';
import { fetchWatches } from '../../ducks/watch.duck';

import {
  Page,
  LayoutSingleColumn,
  EventStats,
  WatchButton,
  H1,
  NamedLink,
  ResponsiveImage,
} from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './AlertsPage.module.css';

/**
 * Events this student is waiting on a ticket for.
 *
 * The counterpart to My tickets: that page is what you own, this is what you are waiting for.
 * It exists mainly so that turning alerts off has a findable home. An opt-out nobody can find
 * is a weak opt-out, and under PECR that matters as well as being bad manners.
 *
 * A watch is modelled as a free transaction on the EVENT listing (see
 * ext/transaction-processes/default-watch). That is not a flourish: a Sharetribe notification
 * can only be addressed to the customer or provider OF THAT TRANSACTION, so making the watcher
 * a customer is the only way the platform will email them at all.
 *
 * Until default-watch is pushed to the marketplace this list is always empty, and the empty
 * state below is what everybody sees. That state is doing real work, not holding a place.
 */
const WATCH_PROCESS = 'default-watch';
const WATCHING_STATE = 'state/watching';

export const fetchAlerts = createAsyncThunk(
  'alerts/fetch',
  async ({ config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const { aspectWidth = 1, aspectHeight = 1, variantPrefix = 'listing-card' } =
        config?.layout?.listingImage || {};
      const aspectRatio = aspectHeight / aspectWidth;

      // only: 'order' because the watcher is the customer of their own watch.
      const response = await sdk.transactions.query({
        only: 'order',
        perPage: 100,
        include: ['listing', 'listing.images'],
        'fields.image': [`variants.${variantPrefix}`, `variants.${variantPrefix}-2x`],
        ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
        ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
        'limit.images': 1,
      });
      dispatch(addMarketplaceEntities(response));

      // Filtered here rather than in the query: transactions.query has no process filter, and
      // this account's other transactions are real purchases we must not show on this page.
      const watchIds = response.data.data
        .filter(tx => tx.attributes?.processName === WATCH_PROCESS)
        .filter(tx => tx.attributes?.state === WATCHING_STATE)
        .map(tx => tx.id);

      return { transactionIds: watchIds };
    } catch (error) {
      log.error(error, 'alerts-fetch-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState: { transactionIds: [], inProgress: false, error: null },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchAlerts.pending, state => {
        state.inProgress = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.inProgress = false;
        state.transactionIds = action.payload.transactionIds;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.inProgress = false;
        state.error = action.payload;
      });
  },
});

export const alertsReducer = alertsSlice.reducer;

/**
 * Which of the loaded watch transactions are still watched.
 *
 * This page fetches its own transactions, but whether a watch is still ON lives in the
 * shared watch state, because that is what the alert control writes to. Those were two
 * answers to one question and they drifted: turning an alert off flipped the button while
 * this page kept rendering the row from its own list, so the page invited you to view an
 * event you had just stopped watching, until a reload.
 *
 * Pure and exported so the regression test can pin it without mounting the page.
 *
 * @param {Array} loadedTransactions denormalised watch transactions, each with `listing`
 * @param {Object} watchedEventIds map of event listing id -> watch transaction id
 */
export const selectStillWatched = (loadedTransactions, watchedEventIds = {}) =>
  (loadedTransactions || []).filter(tx => {
    const eventId = tx?.listing?.id?.uuid;
    return !!eventId && !!watchedEventIds[eventId];
  });

const AlertRow = props => {
  const { tx, currency } = props;
  const eventListing = tx.listing;
  const event = eventSummary(eventListing);
  if (!event) return null;

  const date = formatEventDate(event.eventDate);
  const linkParams = { id: event.id, slug: event.title ? event.title : 'event' };

  return (
    <li className={css.row}>
      <div className={css.rowImageWrapper}>
        <ResponsiveImage
          rootClassName={css.rowImage}
          alt={event.title}
          image={eventListing.images?.[0]}
          variants={['listing-card', 'listing-card-2x']}
        />
      </div>

      <div className={css.rowBody}>
        <h2 className={css.rowTitle}>{event.title}</h2>
        <p className={css.rowMeta}>
          {[date, event.eventTime, event.venue].filter(Boolean).join(' · ')}
        </p>

        <EventStats
          className={css.rowStats}
          faceValue={event.faceValue}
          lastSoldPrice={event.lastSoldPrice}
          soldCount={event.soldCount}
          watcherCount={event.watcherCount}
          currency={currency}
          keepSoldOnMobile
        />

        <div className={css.rowActions}>
          <NamedLink className={css.rowPrimaryAction} name="EventPage" params={linkParams}>
            <FormattedMessage id="AlertsPage.viewEvent" />
          </NamedLink>
          {/* Same control as the browse card and the event page. Turning an alert off from
              the list it appears in is the whole reason this page exists. */}
          <WatchButton eventId={event.id} eventTitle={event.title} eventAuthorId={event.authorId} />
        </div>
      </div>
    </li>
  );
};

export const AlertsPageComponent = () => {
  const config = useConfiguration();
  const dispatch = useDispatch();

  const { transactionIds, inProgress, error } = useSelector(state => state.alerts);
  const marketplaceData = useSelector(state => state.marketplaceData);

  // Which events are still watched comes from the SHARED watch state, not from this page's
  // own fetch. Those are two answers to one question, and they drifted: turning an alert off
  // updated the shared state so the button flipped, while this page kept rendering the row
  // from its own list. The page contradicted itself - a row inviting you to view an event you
  // had just stopped watching - until a reload. Reproduced before fixing.
  //
  // Deriving from the shared state also means the duck's optimistic flip removes the row the
  // instant it is tapped, with no round trip.
  const watchedEventIds = useSelector(state => state.watch.byEventId);

  const watchesFetched = useSelector(state => state.watch.fetched);

  const transactions = useMemo(() => {
    const loaded = getMarketplaceEntities(
      { marketplaceData },
      transactionIds.map(id => ({ id, type: 'transaction' }))
    );
    return selectStillWatched(loaded, watchedEventIds);
  }, [marketplaceData, transactionIds, watchedEventIds]);

  useEffect(() => {
    dispatch(fetchAlerts({ config }));
    // Also populate the shared watch state, so WatchButton on each row knows it is on.
    dispatch(fetchWatches());
  }, [dispatch, config]);

  const body = error ? (
    <p className={css.notice}>
      <FormattedMessage id="AlertsPage.error" />
    </p>
  ) : // Wait for BOTH fetches. The rows come from this page's fetch but are filtered by the
  // shared watch state, so if fetchAlerts resolves first the list is briefly empty and the
  // empty state flashes before the rows arrive.
  (inProgress || !watchesFetched) && transactions.length === 0 ? (
    <p className={css.notice}>
      <FormattedMessage id="AlertsPage.loading" />
    </p>
  ) : transactions.length === 0 ? (
    // The empty state is the page most people will see, so it leads somewhere rather than
    // apologising. Browse is the action; the explanation is one line under it.
    <div className={css.empty}>
      <p className={css.emptyLead}>
        <FormattedMessage id="AlertsPage.emptyLead" />
      </p>
      <p className={css.emptyBody}>
        <FormattedMessage id="AlertsPage.emptyBody" />
      </p>
      <NamedLink className={css.emptyAction} name="EventsPage">
        <FormattedMessage id="AlertsPage.emptyAction" />
      </NamedLink>
    </div>
  ) : (
    <ul className={css.list}>
      {transactions.map(tx => (
        <AlertRow key={tx.id.uuid} tx={tx} currency={config.currency} />
      ))}
    </ul>
  );

  return (
    <Page title="Alerts" scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <H1 className={css.title}>
          <FormattedMessage id="AlertsPage.title" />
        </H1>
        <p className={css.subtitle}>
          <FormattedMessage id="AlertsPage.subtitle" />
        </p>
        {body}
      </LayoutSingleColumn>
    </Page>
  );
};

export default AlertsPageComponent;

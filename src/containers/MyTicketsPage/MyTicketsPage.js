import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { formatMoney } from '../../util/currency';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { createImageVariantConfig } from '../../util/sdkLoader';
import { storableError } from '../../util/errors';
import * as log from '../../util/log';
import { saleProgress, buyerActionPending } from '../../util/sellerStats';
import { formatEventDate } from '../../util/events';
import { useEventImages, withEventImage } from '../../hooks/useEventImages';

import { Page, LayoutSingleColumn, H1, NamedLink, ResponsiveImage } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './MyTicketsPage.module.css';

/**
 * Everything the buyer has bought, and where each purchase has got to.
 *
 * Distinct from Inbox, which is conversations. This answers "what have I got, and do I still need
 * to do something about it" - the something usually being confirming receipt so the seller is paid.
 */
export const fetchMyTickets = createAsyncThunk(
  'myTickets/fetch',
  async ({ config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const {
        aspectWidth = 1,
        aspectHeight = 1,
        variantPrefix = 'listing-card',
      } = config?.layout?.listingImage || {};
      const aspectRatio = aspectHeight / aspectWidth;

      const response = await sdk.transactions.query({
        only: 'order',
        perPage: 100,
        include: ['listing', 'listing.images', 'provider'],
        'fields.image': [`variants.${variantPrefix}`, `variants.${variantPrefix}-2x`],
        ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
        ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
        'limit.images': 1,
      });
      dispatch(addMarketplaceEntities(response));
      return { transactionIds: response.data.data.map(t => t.id) };
    } catch (error) {
      log.error(error, 'my-tickets-fetch-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

const myTicketsSlice = createSlice({
  name: 'myTickets',
  initialState: { transactionIds: [], inProgress: false, error: null },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchMyTickets.pending, state => {
        state.inProgress = true;
        state.error = null;
      })
      .addCase(fetchMyTickets.fulfilled, (state, action) => {
        state.inProgress = false;
        state.transactionIds = action.payload.transactionIds;
      })
      .addCase(fetchMyTickets.rejected, (state, action) => {
        state.inProgress = false;
        state.error = action.payload;
      });
  },
});

export const myTicketsReducer = myTicketsSlice.reducer;

const TicketCard = props => {
  const { tx, eventImages } = props;
  const intl = useIntl();
  // Tickets have no images of their own; they show the curated event's photo.
  const listing = withEventImage(tx.listing, eventImages);
  const publicData = listing?.attributes?.publicData || {};
  const progress = saleProgress(tx);
  const eventDate = formatEventDate(publicData.eventDate);

  // Confirming receipt is the buyer's one outstanding action, so say so plainly while it applies.
  // It applies both before and after the seller marks delivery - the buyer can confirm from either.
  const needsAction = buyerActionPending(progress);

  return (
    <li className={css.card}>
      <div className={css.thumb}>
        <ResponsiveImage
          rootClassName={css.image}
          alt={listing?.attributes?.title}
          image={listing?.images?.[0]}
          variants={['listing-card', 'listing-card-2x']}
        />
      </div>
      <div className={css.body}>
        <p className={css.cardTitle}>
          {listing?.attributes?.title || <FormattedMessage id="MyTickets.deletedListing" />}
        </p>
        <p className={css.cardMeta}>
          {[eventDate, publicData.eventTime, publicData.venue].filter(Boolean).join(' · ') ||
            intl.formatDate(tx.attributes.createdAt, { day: 'numeric', month: 'short' })}
        </p>
        <p className={css.statusRow}>
          <span className={progress.key === 'disputed' ? css.statusDisputed : css.status}>
            <FormattedMessage id={`MyTickets.status.${progress.key}`} />
          </span>
          {tx.attributes.payinTotal ? (
            <span className={css.amount}>{formatMoney(intl, tx.attributes.payinTotal)}</span>
          ) : null}
        </p>
        {needsAction ? (
          <p className={css.actionNote}>
            <FormattedMessage id="MyTickets.confirmPrompt" />
          </p>
        ) : null}
        <NamedLink className={css.cardLink} name="OrderDetailsPage" params={{ id: tx.id.uuid }}>
          <FormattedMessage id="MyTickets.viewOrder" />
        </NamedLink>
      </div>
    </li>
  );
};

export const MyTicketsPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const { transactionIds, inProgress } = useSelector(state => state.myTickets);
  const marketplaceData = useSelector(state => state.marketplaceData);
  const transactions = useMemo(
    () =>
      getMarketplaceEntities(
        { marketplaceData },
        (transactionIds || []).map(id => ({ id, type: 'transaction' }))
      ),
    [marketplaceData, transactionIds]
  );

  const eventImages = useEventImages(transactions.map(tx => tx.listing).filter(Boolean));

  useEffect(() => {
    dispatch(fetchMyTickets({ config }));
  }, [dispatch, config]);

  return (
    <Page title={intl.formatMessage({ id: 'MyTickets.title' })} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <H1 className={css.title}>
          <FormattedMessage id="MyTickets.title" />
        </H1>
        <p className={css.subtitle}>
          <FormattedMessage id="MyTickets.subtitle" />
        </p>

        {inProgress && transactions.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="MyTickets.loading" />
          </p>
        ) : transactions.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="MyTickets.empty" />
          </p>
        ) : (
          <ul className={css.list}>
            {transactions.map(tx => (
              <TicketCard key={tx.id.uuid} tx={tx} eventImages={eventImages} />
            ))}
          </ul>
        )}
      </LayoutSingleColumn>
    </Page>
  );
};

export default MyTicketsPageComponent;

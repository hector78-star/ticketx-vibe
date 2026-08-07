import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as log from '../../util/log';
import { storableError } from '../../util/errors';
import { denormalisedResponseEntities } from '../../util/data';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { createImageVariantConfig } from '../../util/sdkLoader';
import {
  computeSellerStats,
  isCompletedSale,
  readSellerStats,
  sellerStatsChanged,
  sellerStatsPayload,
  SELLER_STATS_KEY,
} from '../../util/sellerStats';

/**
 * Data behind the seller pages: the seller's own listings, their sales, and their reputation.
 */
const imageParams = config => {
  const { aspectWidth = 1, aspectHeight = 1, variantPrefix = 'listing-card' } =
    config?.layout?.listingImage || {};
  const aspectRatio = aspectHeight / aspectWidth;
  return {
    'fields.image': [`variants.${variantPrefix}`, `variants.${variantPrefix}-2x`],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
    'limit.images': 1,
  };
};

/** Listings that still have something left to sell. */
export const fetchCurrentListings = createAsyncThunk(
  'sell/fetchCurrentListings',
  async ({ config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const response = await sdk.ownListings.query({
        // published covers 'active'; a part-sold listing is still published with stock remaining.
        states: ['published'],
        perPage: 100,
        include: ['images', 'currentStock'],
        ...imageParams(config),
      });
      dispatch(addMarketplaceEntities(response));
      return { listingIds: response.data.data.map(l => l.id) };
    } catch (error) {
      log.error(error, 'sell-fetch-listings-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

/** Every transaction where a buyer has paid, plus the reputation derived from them. */
export const fetchSales = createAsyncThunk(
  'sell/fetchSales',
  async ({ config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const response = await sdk.transactions.query({
        only: 'sale',
        perPage: 100,
        include: ['listing', 'listing.images', 'customer', 'customer.profileImage'],
        ...imageParams(config),
      });
      dispatch(addMarketplaceEntities(response));
      const txs = denormalisedResponseEntities(response);

      const currentUser = await sdk.currentUser.show();
      const userId = currentUser.data.data.id;
      const reviewsResponse = await sdk.reviews.query({
        subject_id: userId,
        state: 'public',
        type: 'ofProvider',
      });
      const reviews = denormalisedResponseEntities(reviewsResponse);

      const completedSalesCount = txs.filter(isCompletedSale).length;
      const stats = computeSellerStats(reviews, completedSalesCount);

      // Publish reputation to the seller's own profile so buyers can see it on a ticket card.
      // See the note on SELLER_STATS_KEY: nobody else can derive a completed-sales count for this
      // user, so the seller's own session is the only place it can come from. Skipped when nothing
      // changed, and never allowed to fail the page - this is a side effect of loading sales, not
      // the point of it.
      try {
        const fresh = sellerStatsPayload(stats);
        if (sellerStatsChanged(readSellerStats(currentUser.data.data), fresh)) {
          await sdk.currentUser.updateProfile({ publicData: { [SELLER_STATS_KEY]: fresh } });
        }
      } catch (e) {
        log.error(e, 'sell-publish-seller-stats-failed');
      }

      return {
        transactionIds: response.data.data.map(t => t.id),
        stats,
      };
    } catch (error) {
      log.error(error, 'sell-fetch-sales-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

/** Price and quantity are the only things editable from Current listings. */
export const updateListingPriceAndStock = createAsyncThunk(
  'sell/updateListingPriceAndStock',
  async (
    { listingId, price, oldTotal, newTotal, config },
    { extra: sdk, dispatch, rejectWithValue }
  ) => {
    try {
      if (price) {
        await sdk.ownListings.update({ id: listingId, price });
      }
      const stockChanged = typeof newTotal === 'number' && newTotal !== oldTotal;
      if (stockChanged) {
        await sdk.stock.compareAndSet({ listingId, oldTotal, newTotal });
      }
      // Re-show so the card reflects both the new price and the new stock.
      const response = await sdk.ownListings.show({
        id: listingId,
        include: ['images', 'currentStock'],
        ...imageParams(config),
      });
      dispatch(addMarketplaceEntities(response));
      return { listingId };
    } catch (error) {
      log.error(error, 'sell-update-listing-failed', { listingId: listingId?.uuid });
      return rejectWithValue(storableError(error));
    }
  }
);

/**
 * Sharetribe has no listing delete - closing is the equivalent, and is the right behaviour anyway:
 * completed transactions must keep pointing at the listing they were for.
 */
export const closeListing = createAsyncThunk(
  'sell/closeListing',
  async ({ listingId }, { extra: sdk, rejectWithValue }) => {
    try {
      await sdk.ownListings.close({ id: listingId });
      return { listingId: listingId.uuid };
    } catch (error) {
      log.error(error, 'sell-close-listing-failed', { listingId: listingId?.uuid });
      return rejectWithValue(storableError(error));
    }
  }
);

const initialState = {
  listingIds: [],
  transactionIds: [],
  stats: null,
  listingsInProgress: false,
  salesInProgress: false,
  savingId: null,
  error: null,
};

const sellSlice = createSlice({
  name: 'sell',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchCurrentListings.pending, state => {
        state.listingsInProgress = true;
        state.error = null;
      })
      .addCase(fetchCurrentListings.fulfilled, (state, action) => {
        state.listingsInProgress = false;
        state.listingIds = action.payload.listingIds;
      })
      .addCase(fetchCurrentListings.rejected, (state, action) => {
        state.listingsInProgress = false;
        state.error = action.payload;
      })
      .addCase(fetchSales.pending, state => {
        state.salesInProgress = true;
        state.error = null;
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.salesInProgress = false;
        state.transactionIds = action.payload.transactionIds;
        state.stats = action.payload.stats;
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.salesInProgress = false;
        state.error = action.payload;
      })
      .addCase(updateListingPriceAndStock.pending, (state, action) => {
        state.savingId = action.meta.arg.listingId?.uuid;
      })
      .addCase(updateListingPriceAndStock.fulfilled, state => {
        state.savingId = null;
      })
      .addCase(updateListingPriceAndStock.rejected, (state, action) => {
        state.savingId = null;
        state.error = action.payload;
      })
      .addCase(closeListing.fulfilled, (state, action) => {
        state.listingIds = state.listingIds.filter(id => id.uuid !== action.payload.listingId);
      });
  },
});

export const loadDataCurrentListings = (params, search, config) => dispatch =>
  dispatch(fetchCurrentListings({ config }));

export const loadDataSales = (params, search, config) => dispatch =>
  dispatch(fetchSales({ config }));

export default sellSlice.reducer;

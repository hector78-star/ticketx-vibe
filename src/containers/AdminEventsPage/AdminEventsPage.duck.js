import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as log from '../../util/log';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { createImageVariantConfig } from '../../util/sdkLoader';
import { EVENT_LISTING_TYPE } from '../../config/configListing';

/**
 * Admin-side curation of the event catalog.
 *
 * Uses ownListings rather than the public listings endpoint, so drafts and unpublished events are
 * visible to the admin too - the public queryEvents in util/events.js deliberately only sees what
 * a visitor would see.
 */
const EVENT_FIELDS = [
  'title',
  'description',
  'state',
  'publicData.listingType',
  'publicData.eventDate',
  'publicData.eventTime',
  'publicData.venue',
  'publicData.faceValue',
  'publicData.lastSoldPrice',
  'publicData.soldCount',
];

const imageQueryParams = config => {
  const { aspectWidth = 1, aspectHeight = 1, variantPrefix = 'listing-card' } =
    config?.layout?.listingImage || {};
  const aspectRatio = aspectHeight / aspectWidth;
  return {
    'fields.image': [`variants.${variantPrefix}`, `variants.${variantPrefix}-2x`],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
  };
};

export const fetchAdminEvents = createAsyncThunk(
  'adminEvents/fetch',
  async ({ config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const response = await sdk.ownListings.query({
        pub_listingType: EVENT_LISTING_TYPE,
        perPage: 100,
        include: ['images'],
        'fields.listing': EVENT_FIELDS,
        ...imageQueryParams(config),
      });
      dispatch(addMarketplaceEntities(response));
      return { listingIds: response.data.data.map(l => l.id) };
    } catch (error) {
      log.error(error, 'admin-events-fetch-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

/** Save edits to one event. Only the fields the admin can change are sent. */
export const updateEvent = createAsyncThunk(
  'adminEvents/update',
  async ({ listingId, values, config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const response = await sdk.ownListings.update(
        {
          id: listingId,
          title: values.title,
          publicData: {
            eventDate: values.eventDate,
            eventTime: values.eventTime,
            venue: values.venue,
            faceValue: values.faceValue,
            lastSoldPrice: values.lastSoldPrice,
            soldCount: values.soldCount,
          },
        },
        {
          expand: true,
          include: ['images'],
          'fields.listing': EVENT_FIELDS,
          ...imageQueryParams(config),
        }
      );
      dispatch(addMarketplaceEntities(response));
      return { listingId };
    } catch (error) {
      log.error(error, 'admin-event-update-failed', { listingId: listingId?.uuid });
      return rejectWithValue(storableError(error));
    }
  }
);

/**
 * Create a curated event.
 *
 * ownListings.create publishes straight away, which is what curation wants: an event is a catalog
 * entry, so there is no draft stage worth stepping through.
 */
export const createEvent = createAsyncThunk(
  'adminEvents/create',
  async ({ values, imageId, config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const response = await sdk.ownListings.create(
        {
          title: values.title,
          description: values.description || values.title,
          ...(imageId ? { images: [imageId] } : {}),
          publicData: {
            listingType: EVENT_LISTING_TYPE,
            transactionProcessAlias: 'default-inquiry/release-1',
            unitType: 'inquiry',
            eventDate: values.eventDate,
            eventTime: values.eventTime,
            venue: values.venue,
            faceValue: values.faceValue,
            lastSoldPrice: values.lastSoldPrice,
            soldCount: values.soldCount,
          },
        },
        {
          expand: true,
          include: ['images'],
          'fields.listing': EVENT_FIELDS,
          ...imageQueryParams(config),
        }
      );
      dispatch(addMarketplaceEntities(response));
      return { listingId: response.data.data.id };
    } catch (error) {
      log.error(error, 'admin-event-create-failed');
      return rejectWithValue(storableError(error));
    }
  }
);

/** Upload a photo and attach it to an event. Admin owns the imagery for every event. */
export const setEventImage = createAsyncThunk(
  'adminEvents/setImage',
  async ({ listingId, file, config }, { extra: sdk, dispatch, rejectWithValue }) => {
    try {
      const uploaded = await sdk.images.upload({ image: file }, { expand: true });
      const imageId = uploaded.data.data.id;
      const response = await sdk.ownListings.update(
        { id: listingId, images: [imageId] },
        {
          expand: true,
          include: ['images'],
          'fields.listing': EVENT_FIELDS,
          ...imageQueryParams(config),
        }
      );
      dispatch(addMarketplaceEntities(response));
      return { listingId };
    } catch (error) {
      log.error(error, 'admin-event-image-failed', { listingId: listingId?.uuid });
      return rejectWithValue(storableError(error));
    }
  }
);

const initialState = {
  listingIds: [],
  fetched: false,
  inProgress: false,
  error: null,
  savingId: null,
  saveError: null,
};

const adminEventsSlice = createSlice({
  name: 'adminEvents',
  initialState,
  reducers: {},
  extraReducers: builder => {
    const savePending = (state, action) => {
      state.savingId = action.meta.arg.listingId?.uuid || 'new';
      state.saveError = null;
    };
    const saveSettled = state => {
      state.savingId = null;
    };
    const saveFailed = (state, action) => {
      state.savingId = null;
      state.saveError = action.payload;
    };

    builder
      .addCase(fetchAdminEvents.pending, state => {
        state.inProgress = true;
        state.error = null;
      })
      .addCase(fetchAdminEvents.fulfilled, (state, action) => {
        state.inProgress = false;
        state.fetched = true;
        state.listingIds = action.payload.listingIds;
      })
      .addCase(fetchAdminEvents.rejected, (state, action) => {
        state.inProgress = false;
        state.error = action.payload;
      })
      .addCase(updateEvent.pending, savePending)
      .addCase(updateEvent.fulfilled, saveSettled)
      .addCase(updateEvent.rejected, saveFailed)
      .addCase(setEventImage.pending, savePending)
      .addCase(setEventImage.fulfilled, saveSettled)
      .addCase(setEventImage.rejected, saveFailed)
      .addCase(createEvent.pending, savePending)
      .addCase(createEvent.fulfilled, (state, action) => {
        state.savingId = null;
        state.listingIds = [action.payload.listingId, ...state.listingIds];
      })
      .addCase(createEvent.rejected, saveFailed);
  },
});

export const loadData = (params, search, config) => dispatch => {
  return dispatch(fetchAdminEvents({ config }));
};

export default adminEventsSlice.reducer;

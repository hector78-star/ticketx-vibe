import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { types as sdkTypes } from '../../util/sdkLoader';
import { formatMoney } from '../../util/currency';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { EVENT_LISTING_TYPE } from '../../config/configListing';
import { computeSellerStats } from '../../util/sellerStats';
import {
  fetchCurrentListings,
  fetchSales,
  updateListingPriceAndStock,
  closeListing,
} from './SellPage.duck';

import { Page, LayoutSingleColumn, H1, Button, NamedLink, ResponsiveImage } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import SellerStatsHeader from './SellerStatsHeader';

import css from './CurrentListingsPage.module.css';

const { Money } = sdkTypes;

/**
 * Everything the seller still has for sale, editable in place.
 *
 * Only price and quantity are editable here, per the spec: anything else is a change to what is
 * being sold, which belongs in the listing flow. Both edits take effect immediately on the buyer
 * side, since they write straight to the listing and its stock.
 */
const ListingRow = props => {
  const { listing, config, currency } = props;
  const dispatch = useDispatch();
  const intl = useIntl();
  const savingId = useSelector(state => state.sell.savingId);

  const listingId = listing.id;
  const currentStock = listing.currentStock?.attributes?.quantity ?? 0;
  const priceAmount = listing.attributes.price?.amount ?? 0;

  const [price, setPrice] = useState((priceAmount / 100).toFixed(2));
  const [quantity, setQuantity] = useState(String(currentStock));
  const [confirmingClose, setConfirmingClose] = useState(false);

  const isSaving = savingId === listingId.uuid;
  const newTotal = Number(quantity);
  const newAmount = Math.round(Number(price) * 100);

  // Quantity cannot go below what has already been sold - those tickets are spoken for. Stock only
  // tracks what remains, so the floor here is zero: dropping to zero simply stops further sales.
  const quantityValid = Number.isInteger(newTotal) && newTotal >= 0 && newTotal <= 15;
  const priceValid = Number.isFinite(newAmount) && newAmount > 0;
  const dirty = newAmount !== priceAmount || newTotal !== currentStock;

  const onSave = () => {
    if (!dirty || !quantityValid || !priceValid) return;
    dispatch(
      updateListingPriceAndStock({
        listingId,
        price: newAmount !== priceAmount ? new Money(newAmount, currency) : null,
        oldTotal: currentStock,
        newTotal,
        config,
      })
    );
  };

  return (
    <li className={css.row}>
      <div className={css.thumb}>
        <ResponsiveImage
          rootClassName={css.image}
          alt={listing.attributes.title}
          image={listing.images?.[0]}
          variants={['listing-card', 'listing-card-2x']}
        />
      </div>

      <div className={css.rowBody}>
        <NamedLink
          className={css.rowTitle}
          name="ListingPage"
          params={{ id: listingId.uuid, slug: listing.attributes.title || 'listing' }}
        >
          {listing.attributes.title}
        </NamedLink>
        <p className={css.rowMeta}>
          {listing.attributes.publicData?.venue ||
            intl.formatMessage({ id: 'CurrentListings.noVenue' })}
          {' · '}
          <FormattedMessage id="CurrentListings.remaining" values={{ count: currentStock }} />
        </p>

        <div className={css.editRow}>
          <label className={css.field}>
            <span className={css.fieldLabel}>
              <FormattedMessage id="CurrentListings.price" />
            </span>
            <input
              className={css.input}
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </label>
          <label className={css.field}>
            <span className={css.fieldLabel}>
              <FormattedMessage id="CurrentListings.quantity" />
            </span>
            <input
              className={css.input}
              type="number"
              min="0"
              max="15"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
          </label>
          <Button
            type="button"
            className={css.saveButton}
            onClick={onSave}
            disabled={!dirty || !quantityValid || !priceValid}
            inProgress={isSaving}
          >
            <FormattedMessage id="CurrentListings.save" />
          </Button>
        </div>

        {!quantityValid || !priceValid ? (
          <p className={css.error}>
            <FormattedMessage id="CurrentListings.invalid" />
          </p>
        ) : null}

        {confirmingClose ? (
          <p className={css.confirmRow}>
            <FormattedMessage id="CurrentListings.confirmDelete" />{' '}
            <button
              type="button"
              className={css.dangerLink}
              onClick={() => dispatch(closeListing({ listingId }))}
            >
              <FormattedMessage id="CurrentListings.confirmYes" />
            </button>{' '}
            <button
              type="button"
              className={css.link}
              onClick={() => setConfirmingClose(false)}
            >
              <FormattedMessage id="CurrentListings.confirmNo" />
            </button>
          </p>
        ) : (
          <button type="button" className={css.dangerLink} onClick={() => setConfirmingClose(true)}>
            <FormattedMessage id="CurrentListings.delete" />
          </button>
        )}
      </div>

      <div className={css.priceTag}>
        {formatMoney(intl, listing.attributes.price || new Money(0, currency))}
      </div>
    </li>
  );
};

export const CurrentListingsPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const { listingIds, listingsInProgress, stats, salesInProgress } = useSelector(
    state => state.sell
  );
  const marketplaceData = useSelector(state => state.marketplaceData);
  // ownListings.query returns entities of type 'ownListing', not 'listing' - looking them up as
  // 'listing' silently yields nothing, which is exactly how this page first rendered empty.
  const listings = useMemo(() => {
    const all = getMarketplaceEntities(
      { marketplaceData },
      (listingIds || []).map(id => ({ id, type: 'ownListing' }))
    );
    // Events are catalog entries the seller may have added, not things they are selling.
    return all.filter(l => l?.attributes?.publicData?.listingType !== EVENT_LISTING_TYPE);
  }, [marketplaceData, listingIds]);

  useEffect(() => {
    dispatch(fetchCurrentListings({ config }));
    // Reputation is shown here too, and it comes from the sales query.
    dispatch(fetchSales({ config }));
  }, [dispatch, config]);

  return (
    <Page title={intl.formatMessage({ id: 'CurrentListings.title' })} scrollingDisabled={false}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <SellerStatsHeader
          stats={stats || computeSellerStats([], 0)}
          inProgress={salesInProgress && !stats}
        />

        <H1 className={css.title}>
          <FormattedMessage id="CurrentListings.title" />
        </H1>
        <p className={css.subtitle}>
          <FormattedMessage id="CurrentListings.subtitle" />
        </p>

        {listingsInProgress && listings.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="CurrentListings.loading" />
          </p>
        ) : listings.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="CurrentListings.empty" />
          </p>
        ) : (
          <ul className={css.list}>
            {listings.map(listing => (
              <ListingRow
                key={listing.id.uuid}
                listing={listing}
                config={config}
                currency={config.currency}
              />
            ))}
          </ul>
        )}
      </LayoutSingleColumn>
    </Page>
  );
};

export default CurrentListingsPageComponent;

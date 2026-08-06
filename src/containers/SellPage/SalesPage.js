import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { formatMoney } from '../../util/currency';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { computeSellerStats, saleProgress, isPaidTransaction } from '../../util/sellerStats';
import { fetchSales } from './SellPage.duck';

import { Page, LayoutSingleColumn, H1, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';
import SellerStatsHeader from './SellerStatsHeader';

import css from './SalesPage.module.css';

/**
 * One card per sale, each showing where the money has got to.
 *
 * A flexible-mode listing sold in parts produces one transaction per part-sale, so it appears here
 * once per sale rather than once per listing - which is the point of tracking payouts rather than
 * listings.
 */
// Bar colour per stage of the payout. Keyed by tone rather than by state so the mapping lives in
// one place (sellerStats) and this component only has to paint what it is handed.
const FILL_CLASS = {
  sold: css.trackFillSold,
  delivered: css.trackFillDelivered,
  confirmed: css.trackFillConfirmed,
  disputed: css.trackFillDisputed,
  canceled: css.trackFillCanceled,
};

// Stages that get a line of explanation under the bar - the two where a seller's next question is
// "so where is my money?".
const HAS_NOTE = ['confirmed', 'disputed'];

const ProgressTracker = props => {
  const { progress } = props;

  return (
    <div className={css.tracker}>
      <div className={css.trackBg}>
        <div
          className={FILL_CLASS[progress.tone] || css.trackFillSold}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className={css.trackLabels}>
        <span className={css.trackPercent}>{progress.percent}%</span>
        <span className={progress.key === 'disputed' ? css.statusDisputed : css.status}>
          <FormattedMessage id={`SalesPage.status.${progress.key}`} />
        </span>
      </div>
      {HAS_NOTE.includes(progress.key) ? (
        <p className={progress.key === 'disputed' ? css.noteDisputed : css.note}>
          <FormattedMessage id={`SalesPage.note.${progress.key}`} />
        </p>
      ) : null}
    </div>
  );
};

export const SaleCard = props => {
  const { tx } = props;
  const intl = useIntl();
  const progress = saleProgress(tx);
  const listing = tx.listing;
  const customer = tx.customer;
  const total = tx.attributes.payinTotal;

  return (
    <li className={css.card}>
      <div className={css.cardHead}>
        <div>
          <p className={css.cardTitle}>
            {listing?.attributes?.title || <FormattedMessage id="SalesPage.deletedListing" />}
          </p>
          <p className={css.cardMeta}>
            <FormattedMessage
              id="SalesPage.soldTo"
              values={{ name: customer?.attributes?.profile?.displayName || '—' }}
            />
            {' · '}
            {intl.formatDate(tx.attributes.createdAt, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className={css.cardAmount}>{total ? formatMoney(intl, total) : '—'}</div>
      </div>

      <ProgressTracker progress={progress} />

      <NamedLink className={css.cardLink} name="SaleDetailsPage" params={{ id: tx.id.uuid }}>
        <FormattedMessage id="SalesPage.viewSale" />
      </NamedLink>
    </li>
  );
};

export const SalesPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const { transactionIds, salesInProgress, stats } = useSelector(state => state.sell);
  const marketplaceData = useSelector(state => state.marketplaceData);
  const transactions = useMemo(
    () =>
      getMarketplaceEntities(
        { marketplaceData },
        (transactionIds || []).map(id => ({ id, type: 'transaction' }))
      )
        // Only sales where a buyer actually paid. An abandoned checkout is not a sale.
        .filter(isPaidTransaction),
    [marketplaceData, transactionIds]
  );

  useEffect(() => {
    dispatch(fetchSales({ config }));
  }, [dispatch, config]);

  return (
    <Page title={intl.formatMessage({ id: 'SalesPage.title' })} scrollingDisabled={false}>
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
          <FormattedMessage id="SalesPage.title" />
        </H1>
        <p className={css.subtitle}>
          <FormattedMessage id="SalesPage.subtitle" />
        </p>

        {salesInProgress && transactions.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="SalesPage.loading" />
          </p>
        ) : transactions.length === 0 ? (
          <p className={css.notice}>
            <FormattedMessage id="SalesPage.empty" />
          </p>
        ) : (
          <ul className={css.list}>
            {transactions.map(tx => (
              <SaleCard key={tx.id.uuid} tx={tx} />
            ))}
          </ul>
        )}
      </LayoutSingleColumn>
    </Page>
  );
};

export default SalesPageComponent;

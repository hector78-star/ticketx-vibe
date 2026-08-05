import React from 'react';

import { FormattedMessage } from '../../util/reactIntl';

import css from './SellerStatsHeader.module.css';

/**
 * Rating, review count and verified status, shown top-left on both seller pages.
 *
 * Verified is rendered separately from the rating rather than replacing it: an unverified seller
 * still shows their rating and sales count, so a new seller reads as "new", not "untrustworthy".
 */
const SellerStatsHeader = props => {
  const { stats, inProgress } = props;
  const { averageRating, reviewCount, completedSalesCount, isVerified } = stats || {};

  if (inProgress) {
    return (
      <div className={css.root}>
        <span className={css.loading}>
          <FormattedMessage id="SellerStats.loading" />
        </span>
      </div>
    );
  }

  return (
    <div className={css.root}>
      <div className={css.ratingBlock}>
        <span className={css.stars} aria-hidden="true">
          {averageRating != null ? '★'.repeat(Math.round(averageRating)).padEnd(5, '☆') : '☆☆☆☆☆'}
        </span>
        <span className={css.ratingText}>
          {averageRating != null ? (
            <FormattedMessage
              id="SellerStats.rating"
              values={{ rating: averageRating.toFixed(1), count: reviewCount }}
            />
          ) : (
            <FormattedMessage id="SellerStats.noReviews" />
          )}
        </span>
      </div>

      <span className={css.sales}>
        <FormattedMessage id="SellerStats.sales" values={{ count: completedSalesCount || 0 }} />
      </span>

      <span className={isVerified ? css.verified : css.unverified}>
        <FormattedMessage id={isVerified ? 'SellerStats.verified' : 'SellerStats.unverified'} />
      </span>
    </div>
  );
};

export default SellerStatsHeader;

import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../util/reactIntl';
import { readSellerStats } from '../../util/sellerStats';

import css from './SellerReputation.module.css';

/**
 * A seller's rating and verified status, wherever a buyer is deciding whether to trust them.
 *
 * Used on both the ticket card and the listing page author section, so the two cannot drift apart.
 * A buyer who sees "Verified · 4.6 ★" while browsing must see the same thing on the page where
 * they actually hand over money.
 *
 * Reads reputation published to the seller's own profile - see SELLER_STATS_KEY in
 * util/sellerStats.js for why it lives there rather than being computed on demand. A seller with
 * nothing published reads as new and unverified, which understates rather than overstates them.
 *
 * @param {Object} props
 * @param {Object} props.user the seller (a listing's author)
 * @param {boolean} [props.showSales] also show the completed sales count - worth the space on the
 *   listing page, too noisy on a card in a grid
 */
const SellerReputation = props => {
  const { user, showSales = false, className, rootClassName } = props;
  const stats = readSellerStats(user);

  const hasRating = stats && stats.averageRating != null && stats.reviewCount > 0;
  const isVerified = stats?.isVerified === true;

  return (
    <span className={classNames(rootClassName || css.root, className)}>
      <span className={isVerified ? css.verified : css.unverified}>
        <FormattedMessage
          id={isVerified ? 'SellerReputation.verified' : 'SellerReputation.unverified'}
        />
      </span>

      <span className={css.rating}>
        {hasRating ? (
          <FormattedMessage
            id="SellerReputation.rating"
            values={{ rating: stats.averageRating.toFixed(1), count: stats.reviewCount }}
          />
        ) : (
          <FormattedMessage id="SellerReputation.noRating" />
        )}
      </span>

      {showSales && stats && stats.completedSalesCount > 0 ? (
        <span className={css.sales}>
          <FormattedMessage
            id="SellerReputation.sales"
            values={{ count: stats.completedSalesCount }}
          />
        </span>
      ) : null}
    </span>
  );
};

export default SellerReputation;

import { getProcess, resolveLatestProcessName } from '../transactions/transaction';

/**
 * Seller reputation, per the spec's definition.
 *
 * A seller is **verified** if and only if they have >= 3 completed sales AND an average rating
 * >= 3.5. Verified status is computed, never stored, and is shown *separately* from the rating and
 * sales count - an unverified seller still displays both, because hiding them would punish new
 * sellers twice.
 */
export const VERIFIED_MIN_SALES = 3;
export const VERIFIED_MIN_RATING = 3.5;

/**
 * Resolve a transaction's process state.
 *
 * Transactions carry `lastTransition`, not a state - `attributes.processState` does not exist.
 * Reading it and falling back to substring matching on the transition name gets things wrong in
 * both directions: "transition/auto-complete" does not contain "completed" so a paid-out sale
 * looked pending, and "transition/mark-received-from-disputed" contains "disputed" so a dispute
 * resolved in the seller's favour still looked disputed. The process graph maps transitions to
 * states properly, so use it.
 */
export const transactionState = tx => {
  const processName = resolveLatestProcessName(tx?.attributes?.processName);
  if (!processName || !tx?.attributes?.lastTransition) {
    return null;
  }
  try {
    return getProcess(processName).getState(tx);
  } catch (e) {
    return null;
  }
};

/** States that mean the sale went all the way through. */
const COMPLETED_STATES = ['completed', 'reviewed', 'reviewed-by-customer', 'reviewed-by-provider'];

export const isCompletedSale = tx => COMPLETED_STATES.includes(transactionState(tx));

/**
 * Where a seller's reputation lives so that *other* people can see it.
 *
 * Reputation needs a completed-sales count, and the Marketplace API will not give you one for
 * anybody but yourself - `transactions.query` is scoped to the requesting user, and there is no
 * Integration API set up. So a buyer looking at a ticket cannot compute whether that seller is
 * verified.
 *
 * The way round it: the seller's own client already computes the figure when they open their sales
 * page, so it publishes the result to their profile's public data. Anyone can then read reputation
 * straight off a listing's author with no extra request - which also keeps ticket lists to a single
 * query rather than one per seller.
 *
 * The trade-off is staleness: a seller who never opens their dashboard publishes nothing and reads
 * as new. That is the honest failure direction - it understates a good seller rather than
 * overstating an unproven one. Replace this with an Integration API job if one is ever set up.
 */
export const SELLER_STATS_KEY = 'sellerStats';

/** Reputation as published on a user's profile, or null when they have never published any. */
export const readSellerStats = user => {
  const stats = user?.attributes?.profile?.publicData?.[SELLER_STATS_KEY];
  if (!stats || typeof stats !== 'object') {
    return null;
  }
  const { averageRating, reviewCount, completedSalesCount, isVerified } = stats;
  return {
    averageRating: typeof averageRating === 'number' ? averageRating : null,
    reviewCount: typeof reviewCount === 'number' ? reviewCount : 0,
    completedSalesCount: typeof completedSalesCount === 'number' ? completedSalesCount : 0,
    isVerified: isVerified === true,
  };
};

/** Only the four figures, rounded, so a rerun with unchanged reputation writes nothing. */
export const sellerStatsPayload = stats => ({
  averageRating:
    typeof stats?.averageRating === 'number' ? Math.round(stats.averageRating * 100) / 100 : null,
  reviewCount: stats?.reviewCount || 0,
  completedSalesCount: stats?.completedSalesCount || 0,
  isVerified: stats?.isVerified === true,
});

export const sellerStatsChanged = (published, fresh) => {
  const a = published || {};
  const b = fresh || {};
  return (
    a.averageRating !== b.averageRating ||
    a.reviewCount !== b.reviewCount ||
    a.completedSalesCount !== b.completedSalesCount ||
    a.isVerified !== b.isVerified
  );
};

/**
 * @param {Array} reviews reviews where the seller is the subject
 * @param {number} completedSalesCount
 */
export const computeSellerStats = (reviews = [], completedSalesCount = 0) => {
  const ratings = reviews
    .map(r => r?.attributes?.rating)
    .filter(n => typeof n === 'number' && !Number.isNaN(n));

  const reviewCount = ratings.length;
  const averageRating =
    reviewCount > 0 ? ratings.reduce((sum, n) => sum + n, 0) / reviewCount : null;

  const isVerified =
    completedSalesCount >= VERIFIED_MIN_SALES &&
    averageRating != null &&
    averageRating >= VERIFIED_MIN_RATING;

  return { averageRating, reviewCount, completedSalesCount, isVerified };
};

/**
 * Where a transaction sits in the money's journey, for the payout progress tracker.
 *
 * sold (funds held) -> delivered (seller says handed over) -> confirmed (buyer confirmed receipt,
 * payout created). `tone` drives the bar colour: yellow, orange, green respectively.
 *
 * disputed is deliberately not a point on that line - it is a branch off it, shown red, because the
 * payout is frozen rather than progressing. canceled is included because the process auto-cancels
 * after 14 days, so a refunded sale is a real outcome, not an edge case; showing it as `sold` would
 * tell a seller money is still coming when it has already gone back to the buyer.
 *
 * Everything from `received` onwards collapses into `confirmed`. The payout is created on
 * mark-received, and `auto-complete` fires immediately after it, so `received` and `completed` are
 * indistinguishable in practice and splitting them would only ever show one of them.
 */
export const SALE_PROGRESS = {
  sold: { key: 'sold', percent: 25, tone: 'sold' },
  delivered: { key: 'delivered', percent: 60, tone: 'delivered' },
  confirmed: { key: 'confirmed', percent: 100, tone: 'confirmed' },
  disputed: { key: 'disputed', percent: 60, tone: 'disputed' },
  canceled: { key: 'canceled', percent: 100, tone: 'canceled' },
};

const STATE_TO_PROGRESS = {
  // Money captured and held; the seller has not said they handed the ticket over.
  purchased: SALE_PROGRESS.sold,
  // Seller marked it delivered; waiting on the buyer.
  delivered: SALE_PROGRESS.delivered,
  // Buyer confirmed receipt (or it auto-released): payout created.
  received: SALE_PROGRESS.confirmed,
  completed: SALE_PROGRESS.confirmed,
  reviewed: SALE_PROGRESS.confirmed,
  'reviewed-by-customer': SALE_PROGRESS.confirmed,
  'reviewed-by-provider': SALE_PROGRESS.confirmed,
  // Branches.
  disputed: SALE_PROGRESS.disputed,
  canceled: SALE_PROGRESS.canceled,
  'payment-expired': SALE_PROGRESS.canceled,
};

export const saleProgress = tx => {
  const state = transactionState(tx);
  return STATE_TO_PROGRESS[state] || SALE_PROGRESS.sold;
};

/** States where the buyer still has something to do: confirm receipt, or dispute. */
export const buyerActionPending = progress =>
  progress?.key === 'sold' || progress?.key === 'delivered';

/** True once a buyer has paid - i.e. the transaction belongs on the sales/payouts list. */
export const isPaidTransaction = tx => {
  const state = transactionState(tx);
  return !!state && !['initial', 'inquiry', 'pending-payment', 'payment-expired'].includes(state);
};

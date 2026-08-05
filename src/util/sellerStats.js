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

/** Transaction states that count as a completed sale for reputation purposes. */
const COMPLETED_SALE_STATES = ['received', 'completed', 'reviewed', 'reviewed-by-customer', 'reviewed-by-provider'];

export const isCompletedSale = tx => {
  const state = tx?.attributes?.processState || tx?.attributes?.lastTransition || '';
  return COMPLETED_SALE_STATES.some(s => String(state).includes(s));
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
 * Where a transaction sits in the money's journey, for the progress tracker.
 *
 * pending (funds held) -> confirmed (receipt confirmed or auto-released) -> closed (paid out).
 * disputed is deliberately not a point on that line: it is a branch, shown distinctly.
 */
export const SALE_PROGRESS = {
  pending: { key: 'pending', percent: 33 },
  confirmed: { key: 'confirmed', percent: 66 },
  closed: { key: 'closed', percent: 100 },
  disputed: { key: 'disputed', percent: 66 },
  canceled: { key: 'canceled', percent: 100 },
};

export const saleProgress = tx => {
  const state = String(tx?.attributes?.processState || '');
  const lastTransition = String(tx?.attributes?.lastTransition || '');
  const blob = `${state} ${lastTransition}`;

  if (blob.includes('dispute')) return SALE_PROGRESS.disputed;
  if (blob.includes('cancel')) return SALE_PROGRESS.canceled;
  // 'reviewed' states come after completion, so they are closed too.
  if (blob.includes('completed') || blob.includes('reviewed')) return SALE_PROGRESS.closed;
  if (blob.includes('received')) return SALE_PROGRESS.confirmed;
  return SALE_PROGRESS.pending;
};

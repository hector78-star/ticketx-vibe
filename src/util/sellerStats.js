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
 * disputed is deliberately not a point on that line: it is a branch, shown distinctly. canceled is
 * included because the process auto-cancels after 14 days, so it is a real outcome, not an edge.
 */
export const SALE_PROGRESS = {
  pending: { key: 'pending', percent: 33 },
  confirmed: { key: 'confirmed', percent: 66 },
  closed: { key: 'closed', percent: 100 },
  disputed: { key: 'disputed', percent: 66 },
  canceled: { key: 'canceled', percent: 100 },
};

const STATE_TO_PROGRESS = {
  // Money captured and held; nobody has confirmed anything yet.
  purchased: SALE_PROGRESS.pending,
  delivered: SALE_PROGRESS.pending,
  // Buyer confirmed receipt (or it auto-released): payout triggered.
  received: SALE_PROGRESS.confirmed,
  // Terminal, paid out.
  completed: SALE_PROGRESS.closed,
  reviewed: SALE_PROGRESS.closed,
  'reviewed-by-customer': SALE_PROGRESS.closed,
  'reviewed-by-provider': SALE_PROGRESS.closed,
  // Branches.
  disputed: SALE_PROGRESS.disputed,
  canceled: SALE_PROGRESS.canceled,
  'payment-expired': SALE_PROGRESS.canceled,
};

export const saleProgress = tx => {
  const state = transactionState(tx);
  return STATE_TO_PROGRESS[state] || SALE_PROGRESS.pending;
};

/** True once a buyer has paid - i.e. the transaction belongs on the sales/payouts list. */
export const isPaidTransaction = tx => {
  const state = transactionState(tx);
  return !!state && !['initial', 'inquiry', 'pending-payment', 'payment-expired'].includes(state);
};

import { saleProgress, buyerActionPending, isPaidTransaction } from './sellerStats';

const tx = lastTransition => ({
  id: { uuid: 'tx-id' },
  type: 'transaction',
  attributes: { processName: 'default-purchase', lastTransition: lastTransition },
});

describe('saleProgress', () => {
  it('maps a paid-but-not-handed-over sale to sold/yellow', () => {
    const progress = saleProgress(tx('transition/confirm-payment'));
    expect(progress.key).toEqual('sold');
    expect(progress.tone).toEqual('sold');
  });

  it('maps a seller-marked delivery to delivered/orange, distinct from sold', () => {
    const progress = saleProgress(tx('transition/mark-delivered'));
    expect(progress.key).toEqual('delivered');
    expect(progress.tone).toEqual('delivered');
    expect(progress.percent).toBeGreaterThan(saleProgress(tx('transition/confirm-payment')).percent);
  });

  it('maps a dispute to disputed/red from either state it can be raised in', () => {
    expect(saleProgress(tx('transition/dispute')).tone).toEqual('disputed');
    expect(saleProgress(tx('transition/dispute-from-purchased')).tone).toEqual('disputed');
  });

  // auto-complete fires immediately after the payout is created, so a confirmed sale is almost
  // always found in `completed` rather than `received`. Both must read as confirmed, or the green
  // state would never actually be shown.
  it('treats everything from receipt onwards as confirmed/green', () => {
    ['transition/mark-received', 'transition/mark-received-from-purchased'].forEach(t => {
      expect(saleProgress(tx(t)).tone).toEqual('confirmed');
    });
    expect(saleProgress(tx('transition/auto-complete')).tone).toEqual('confirmed');
    expect(saleProgress(tx('transition/expire-review-period')).tone).toEqual('confirmed');
  });

  // A refunded sale must not look like money still on its way.
  it('maps an auto-cancelled sale to canceled, not sold', () => {
    expect(saleProgress(tx('transition/auto-cancel')).key).toEqual('canceled');
  });

  it('resolves a dispute settled in the seller favour as confirmed, not disputed', () => {
    expect(saleProgress(tx('transition/mark-received-from-disputed')).tone).toEqual('confirmed');
  });
});

describe('buyerActionPending', () => {
  it('is true wherever the buyer can still confirm receipt', () => {
    expect(buyerActionPending(saleProgress(tx('transition/confirm-payment')))).toBe(true);
    expect(buyerActionPending(saleProgress(tx('transition/mark-delivered')))).toBe(true);
  });

  it('is false once receipt is confirmed, disputed or cancelled', () => {
    expect(buyerActionPending(saleProgress(tx('transition/mark-received')))).toBe(false);
    expect(buyerActionPending(saleProgress(tx('transition/dispute')))).toBe(false);
    expect(buyerActionPending(saleProgress(tx('transition/auto-cancel')))).toBe(false);
  });
});

describe('isPaidTransaction', () => {
  it('excludes abandoned checkouts and includes paid sales', () => {
    expect(isPaidTransaction(tx('transition/request-payment'))).toBe(false);
    expect(isPaidTransaction(tx('transition/expire-payment'))).toBe(false);
    expect(isPaidTransaction(tx('transition/confirm-payment'))).toBe(true);
  });
});

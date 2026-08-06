import { createUser, createListing, createTransaction, fakeIntl } from '../../util/testData';
import {
  TX_TRANSITION_ACTOR_CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER,
  getProcess,
} from '../../transactions/transaction';

import { getStateData } from './TransactionPage.stateData';

const noop = () => null;
const process = getProcess('default-purchase');
const { transitions } = process;

const makeTx = lastTransition =>
  createTransaction({
    id: 'tx-dispute',
    customer: createUser('customer'),
    provider: createUser('provider'),
    listing: createListing('listing-item', {
      publicData: {
        listingType: 'sell-bikes',
        transactionProcessAlias: 'default-purchase/release-1',
        unitType: 'item',
      },
    }),
    processName: 'default-purchase',
    lastTransition,
    lastTransitionedAt: new Date(Date.UTC(2026, 6, 1)),
  });

const stateDataFor = (lastTransition, transactionRole, nextTransitionNames) =>
  getStateData(
    {
      transaction: makeTx(lastTransition),
      transactionRole,
      nextTransitions: nextTransitionNames
        ? nextTransitionNames.map(name => ({ attributes: { name } }))
        : null,
      intl: fakeIntl,
      transitionInProgress: false,
      transitionError: null,
      onTransition: noop,
      sendReviewInProgress: false,
      sendReviewError: null,
      onOpenReviewModal: noop,
    },
    process
  );

// Handover happens in the message thread, so sellers routinely never mark an order delivered. That
// left a buyer in `purchased` able to confirm receipt but with no way to contest - the gap this
// covers.
describe('purchase process: buyer dispute in the purchased state', () => {
  it('offers dispute alongside confirm receipt when the process allows it', () => {
    const stateData = stateDataFor(transitions.CONFIRM_PAYMENT, TX_TRANSITION_ACTOR_CUSTOMER, [
      transitions.MARK_RECEIVED_FROM_PURCHASED,
      transitions.DISPUTE_FROM_PURCHASED,
    ]);

    expect(stateData.processState).toEqual('purchased');
    expect(stateData.primaryButtonProps).toBeTruthy();
    expect(stateData.showDispute).toBe(true);
    expect(stateData.disputeTransitionName).toEqual(transitions.DISPUTE_FROM_PURCHASED);
  });

  // The transition only exists once process.edn has been pushed with `flex-cli process push`.
  // Until then the button must stay hidden rather than fail on click.
  it('hides dispute when the deployed process does not offer the transition', () => {
    const stateData = stateDataFor(transitions.CONFIRM_PAYMENT, TX_TRANSITION_ACTOR_CUSTOMER, [
      transitions.MARK_RECEIVED_FROM_PURCHASED,
    ]);

    expect(stateData.showDispute).toBe(false);
    expect(stateData.primaryButtonProps).toBeTruthy();
  });

  it('hides dispute when next transitions have not loaded', () => {
    const stateData = stateDataFor(
      transitions.CONFIRM_PAYMENT,
      TX_TRANSITION_ACTOR_CUSTOMER,
      null
    );
    expect(stateData.showDispute).toBe(false);
  });

  it('does not offer the seller a dispute button', () => {
    const stateData = stateDataFor(transitions.CONFIRM_PAYMENT, TX_TRANSITION_ACTOR_PROVIDER, [
      transitions.MARK_DELIVERED,
    ]);
    expect(stateData.showDispute).toBeFalsy();
  });

  // The delivered-state dispute predates this change and is deliberately left ungated, so an
  // unrelated nextTransitions failure cannot take away a path that already works.
  it('still offers dispute in the delivered state, with its own transition', () => {
    const stateData = stateDataFor(transitions.MARK_DELIVERED, TX_TRANSITION_ACTOR_CUSTOMER, null);

    expect(stateData.processState).toEqual('delivered');
    expect(stateData.showDispute).toBe(true);
    expect(stateData.disputeTransitionName).toEqual(transitions.DISPUTE);
  });
});

describe('purchase process graph', () => {
  it('routes dispute-from-purchased into the disputed state', () => {
    expect(process.getState(makeTx(transitions.DISPUTE_FROM_PURCHASED))).toEqual('disputed');
  });
});

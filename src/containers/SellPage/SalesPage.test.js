import React from 'react';
import '@testing-library/jest-dom';

import { types as sdkTypes } from '../../util/sdkLoader';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import { SaleCard } from './SalesPage';

const { screen } = testingLibrary;
const { Money, UUID } = sdkTypes;

const fakeSale = lastTransition => ({
  id: new UUID('tx-1'),
  type: 'transaction',
  attributes: {
    processName: 'default-purchase',
    lastTransition,
    createdAt: new Date('2026-07-01T12:00:00Z'),
    payinTotal: new Money(2500, 'GBP'),
  },
  listing: { id: new UUID('l-1'), attributes: { title: 'Starfields ticket' } },
  customer: { id: new UUID('u-1'), attributes: { profile: { displayName: 'Buyer' } } },
});

describe('SaleCard', () => {
  // Regression: the card linked to a route name that does not exist ("SalePage" rather than
  // "SaleDetailsPage"). pathByRouteName throws on an unknown name, so a single sale took down the
  // whole Sales and payouts page - and only for sellers who had actually sold something, which is
  // why an empty account looked fine.
  it('links to the sale details route without throwing', () => {
    render(<SaleCard tx={fakeSale('transition/confirm-payment')} />);
    expect(screen.getByText('SalesPage.viewSale').closest('a')).toHaveAttribute(
      'href',
      '/sale/tx-1'
    );
  });

  it('shows the sold status and no payout note while funds are held', () => {
    render(<SaleCard tx={fakeSale('transition/confirm-payment')} />);
    expect(screen.getByText('SalesPage.status.sold')).toBeInTheDocument();
    expect(screen.queryByText('SalesPage.note.confirmed')).not.toBeInTheDocument();
  });

  it('explains the payout timing once receipt is confirmed', () => {
    render(<SaleCard tx={fakeSale('transition/mark-received')} />);
    expect(screen.getByText('SalesPage.status.confirmed')).toBeInTheDocument();
    expect(screen.getByText('SalesPage.note.confirmed')).toBeInTheDocument();
  });

  it('explains that a dispute pauses the payout', () => {
    render(<SaleCard tx={fakeSale('transition/dispute-from-purchased')} />);
    expect(screen.getByText('SalesPage.status.disputed')).toBeInTheDocument();
    expect(screen.getByText('SalesPage.note.disputed')).toBeInTheDocument();
  });
});

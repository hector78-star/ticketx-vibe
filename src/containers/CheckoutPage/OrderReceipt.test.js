import React from 'react';
import '@testing-library/jest-dom';

import { types as sdkTypes } from '../../util/sdkLoader';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import OrderReceipt from './OrderReceipt';

const { screen } = testingLibrary;
const { UUID } = sdkTypes;

const seller = sellerStats => ({
  id: new UUID('u1'),
  type: 'user',
  attributes: {
    profile: { displayName: 'Hector B', publicData: sellerStats ? { sellerStats } : {} },
  },
});

const ticket = ({ eventId = 'e1', ticketType = 'pdf', author } = {}) => ({
  id: new UUID('t1'),
  type: 'listing',
  attributes: {
    title: 'Starfields',
    publicData: { eventId, ticketType, listingType: 'sell-products' },
  },
  author: author || seller(),
});

const event = {
  id: 'e1',
  title: 'Starfields',
  eventDate: 20260914,
  eventTime: '19:00',
  venue: 'Lower College Lawn',
};

const renderReceipt = props =>
  render(
    <OrderReceipt
      title="Complete order"
      listing={ticket()}
      event={event}
      providerName="Hector B"
      totalPriceFormatted="£70.00"
      {...props}
    />
  );

describe('OrderReceipt', () => {
  it('renders the page title as the only h1', () => {
    renderReceipt();
    expect(screen.getByRole('heading', { level: 1, name: 'Complete order' })).toBeInTheDocument();
  });

  it('shows the event, date, venue and ticket type for a ticket', () => {
    renderReceipt();
    expect(screen.getByText('Starfields')).toBeInTheDocument();
    expect(screen.getByText('Lower College Lawn')).toBeInTheDocument();
    expect(screen.getByText('OrderReceipt.ticketType.pdf')).toBeInTheDocument();
  });

  // The checkout serves every listing type, not just tickets. A non-ticket must not get blank
  // Event / Date / Venue rows.
  it('shows an item row instead of event rows for a non-ticket listing', () => {
    // null, not undefined - a default parameter would swallow undefined and re-supply 'e1'.
    renderReceipt({ listing: ticket({ eventId: null, ticketType: null }), event: null });
    expect(screen.getByText('OrderReceipt.item')).toBeInTheDocument();
    expect(screen.queryByText('OrderReceipt.event')).not.toBeInTheDocument();
    expect(screen.queryByText('OrderReceipt.venue')).not.toBeInTheDocument();
  });

  // The event is resolved asynchronously through the events duck, so the receipt renders before it
  // arrives and must not show a bare "Date" label with nothing after it.
  it('omits date and venue while the event is still resolving', () => {
    renderReceipt({ event: null });
    expect(screen.queryByText('OrderReceipt.date')).not.toBeInTheDocument();
    expect(screen.queryByText('OrderReceipt.venue')).not.toBeInTheDocument();
    // The event name still shows, because the ticket's own title carries it.
    expect(screen.getByText('Starfields')).toBeInTheDocument();
  });

  it('states the escrow journey in three steps', () => {
    renderReceipt();
    expect(screen.getByText('OrderReceipt.step1.title')).toBeInTheDocument();
    expect(screen.getByText('OrderReceipt.step2.title')).toBeInTheDocument();
    expect(screen.getByText('OrderReceipt.step3.title')).toBeInTheDocument();
  });

  it('shows a verified seller as verified', () => {
    const author = seller({
      averageRating: 4.6,
      reviewCount: 9,
      completedSalesCount: 12,
      isVerified: true,
    });
    renderReceipt({ listing: ticket({ author }) });
    expect(screen.getByText('OrderReceipt.verified')).toBeInTheDocument();
  });

  it('treats a seller with no published stats as unverified', () => {
    renderReceipt();
    expect(screen.getByText('OrderReceipt.unverified')).toBeInTheDocument();
    expect(screen.getByText('OrderReceipt.noRating')).toBeInTheDocument();
  });

  it('shows a plain total when there is no itemised breakdown', () => {
    renderReceipt();
    expect(screen.getByText('£70.00')).toBeInTheDocument();
  });

  // A ticket is one line item, so a bare total is honest. A booking is nights x rate plus fees, and
  // the itemisation has to survive - the breakdown carries its own total, so the plain total row
  // must step aside rather than duplicating it.
  it('prefers the itemised breakdown over the plain total row', () => {
    renderReceipt({
      breakdown: <div data-testid="breakdown">line items</div>,
      breakdownTitle: 'Order breakdown',
    });
    expect(screen.getByTestId('breakdown')).toBeInTheDocument();
    expect(screen.queryByText('OrderReceipt.total')).not.toBeInTheDocument();
  });
});

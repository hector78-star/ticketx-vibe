import React from 'react';
import '@testing-library/jest-dom';

import { types as sdkTypes } from '../../util/sdkLoader';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import TicketCard from './TicketCard';

const { screen } = testingLibrary;
const { Money, UUID } = sdkTypes;

const seller = (displayName, sellerStats) => ({
  id: new UUID('u1'),
  type: 'user',
  attributes: { profile: { displayName, publicData: sellerStats ? { sellerStats } : {} } },
});

const ticket = ({ price = 7000, ticketType = 'pdf', author, platform } = {}) => ({
  id: new UUID('t1'),
  type: 'listing',
  attributes: {
    title: 'Starfields',
    price: new Money(price, 'GBP'),
    publicData: { ticketType, ...(platform ? { ticketPlatform: platform } : {}) },
  },
  author: author || seller('Hector B'),
});

describe('TicketCard', () => {
  it('shows the ticket type rather than repeating the event name', () => {
    render(<TicketCard listing={ticket({ ticketType: 'mobile-transfer' })} faceValue={5000} />);
    expect(screen.getByText('TicketCard.ticketType.mobileTransfer')).toBeInTheDocument();
  });

  // Legacy tickets predate the ticketType field - the two live Starfields listings have no
  // publicData.ticketType at all. They must still render.
  it('falls back gracefully when a listing has no ticket type', () => {
    render(<TicketCard listing={ticket({ ticketType: null })} faceValue={5000} />);
    expect(screen.getByText('TicketCard.ticketType.unknown')).toBeInTheDocument();
  });

  // The marketplace tells buyers they save money, so a premium is stated plainly at the point of
  // choosing rather than left for them to work out.
  it('calls out a price above face value', () => {
    render(<TicketCard listing={ticket({ price: 7000 })} faceValue={5000} />);
    expect(screen.getByText('TicketCard.overFaceValue')).toBeInTheDocument();
  });

  it('calls out a price below face value', () => {
    render(<TicketCard listing={ticket({ price: 4000 })} faceValue={5000} />);
    expect(screen.getByText('TicketCard.underFaceValue')).toBeInTheDocument();
  });

  it('says so when the price matches face value exactly', () => {
    render(<TicketCard listing={ticket({ price: 5000 })} faceValue={5000} />);
    expect(screen.getByText('TicketCard.atFaceValue')).toBeInTheDocument();
  });

  it('omits the comparison when the event has no face value', () => {
    render(<TicketCard listing={ticket({ price: 7000 })} faceValue={undefined} />);
    expect(screen.queryByText('TicketCard.overFaceValue')).not.toBeInTheDocument();
    expect(screen.queryByText('TicketCard.atFaceValue')).not.toBeInTheDocument();
  });

  it('shows the seller name and their published reputation', () => {
    const author = seller('Hector B', {
      averageRating: 4.5,
      reviewCount: 8,
      completedSalesCount: 5,
      isVerified: true,
    });
    render(<TicketCard listing={ticket({ author })} faceValue={5000} />);

    expect(screen.getByText('Hector B')).toBeInTheDocument();
    expect(screen.getByText('SellerReputation.verified')).toBeInTheDocument();
    expect(screen.getByText('SellerReputation.rating')).toBeInTheDocument();
  });

  // A seller who has never opened their sales page publishes nothing. Reading as new is the honest
  // failure direction - it understates a good seller rather than overstating an unproven one.
  it('treats a seller with no published stats as unverified with no rating', () => {
    render(<TicketCard listing={ticket()} faceValue={5000} />);
    expect(screen.getByText('SellerReputation.unverified')).toBeInTheDocument();
    expect(screen.getByText('SellerReputation.noRating')).toBeInTheDocument();
  });

  it('links to the listing page', () => {
    render(<TicketCard listing={ticket()} faceValue={5000} />);
    expect(screen.getByText('TicketCard.view').closest('a')).toHaveAttribute(
      'href',
      '/l/starfields/t1'
    );
  });
});

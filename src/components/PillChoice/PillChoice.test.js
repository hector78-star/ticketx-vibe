import React from 'react';
import '@testing-library/jest-dom';
import { Form } from 'react-final-form';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import PillChoice from './PillChoice';

const { screen, userEvent, waitFor } = testingLibrary;

const OPTIONS = [
  { value: 'mobile-transfer', label: 'Mobile transfer', hint: 'Sent through the ticket app' },
  { value: 'pdf', label: 'Electronic (PDF)' },
  { value: 'physical', label: 'Physical' },
];

const renderPills = ({ initialValues, onSelect, advanceDelay } = {}) =>
  render(
    <Form onSubmit={() => {}} initialValues={initialValues}>
      {() => (
        <PillChoice
          name="ticketType"
          legend="What kind of ticket is it?"
          options={OPTIONS}
          onSelect={onSelect}
          advanceDelay={advanceDelay}
        />
      )}
    </Form>
  );

describe('PillChoice', () => {
  it('renders every option as a radio in one group', () => {
    renderPills();
    expect(screen.getByRole('radio', { name: /Mobile transfer/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Electronic/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Physical/ })).toBeInTheDocument();
  });

  // Concern 1. The flow auto-advances, so a seller sees their choice for a moment and then the
  // next question. Coming back to a draft, the pill has to still read as chosen or they cannot
  // tell whether the answer was kept.
  it('shows the stored answer as selected when returning to a part-filled draft', () => {
    renderPills({ initialValues: { ticketType: 'pdf' } });

    expect(screen.getByRole('radio', { name: /Electronic/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Mobile transfer/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Physical/ })).not.toBeChecked();
  });

  it('keeps selection driven by form state, not local state', async () => {
    renderPills({ initialValues: { ticketType: 'mobile-transfer' } });

    await userEvent.click(screen.getByRole('radio', { name: /Physical/ }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Physical/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Mobile transfer/ })).not.toBeChecked();
    });
  });

  // The advance is deferred so the choice registers visually first. Firing immediately is the
  // behaviour that was explicitly rejected.
  it('does not advance instantly on selection', async () => {
    const onSelect = jest.fn();
    renderPills({ onSelect, advanceDelay: 250 });

    await userEvent.click(screen.getByRole('radio', { name: /Physical/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('advances with the chosen value after the highlight beat', async () => {
    const onSelect = jest.fn();
    renderPills({ onSelect, advanceDelay: 20 });

    await userEvent.click(screen.getByRole('radio', { name: /Physical/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('physical'));
  });

  it('records the choice even when there is nothing to advance to', async () => {
    renderPills();
    await userEvent.click(screen.getByRole('radio', { name: /Electronic/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Electronic/ })).toBeChecked());
  });

  it('shows the per-option hint', () => {
    renderPills();
    expect(screen.getByText('Sent through the ticket app')).toBeInTheDocument();
  });
});

import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Field } from 'react-final-form';

import css from './PillChoice.module.css';

/**
 * A single-select control rendered as outlined capsule pills.
 *
 * From the approved sell-flow direction (variant-D): pills in a row, selection shown as a purple
 * OUTLINE rather than a solid fill. The solid-fill execution was tried and rejected - at full width
 * it was the loudest thing on a page whose whole system is hairlines.
 *
 * Two things this has to get right that a mockup cannot show:
 *
 * 1. SELECTION SURVIVES LEAVING AND COMING BACK. The flow auto-advances, so a seller sees their
 *    choice for a moment and then the next question. If they navigate back and the pill no longer
 *    reads as chosen, they cannot tell whether the answer was kept. Selection is therefore derived
 *    from form state on every render and never held in local component state - come back a week
 *    later to a draft and the right pill is still lit.
 *
 * 2. A ROW OF PILLS DOES NOT SURVIVE A PHONE. This audience is mobile-heavy. Below 600px the pills
 *    become full-width stacked rows - still outlined, never filled - so they stay one-per-line and
 *    comfortably past the 44px touch minimum instead of wrapping into ragged fragments.
 *
 * Built on radio inputs rather than buttons so keyboard and screen-reader behaviour is the
 * platform's, not a reimplementation: arrow keys move within the group, the group has one tab stop,
 * and the selected option is announced.
 *
 * @param {Object} props
 * @param {string} props.name form field name
 * @param {Array} props.options [{ value, label, hint? }]
 * @param {string} props.legend visible group label
 * @param {Function} [props.onSelect] called with the value after the highlight beat, for callers
 *   that advance a step. Omit for a plain in-place control.
 * @param {number} [props.advanceDelay] ms to hold the highlight before onSelect fires
 */
const PillChoice = props => {
  const {
    name,
    options,
    legend,
    hint,
    onSelect,
    advanceDelay = 250,
    validate,
    id,
    className,
  } = props;

  // Purely presentational: the pill that was just tapped, held briefly so the choice registers
  // visually before anything moves. Never the source of truth for what is selected.
  const [flashing, setFlashing] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleChoose = value => {
    if (!onSelect) {
      return;
    }
    setFlashing(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFlashing(null);
      onSelect(value);
    }, advanceDelay);
  };

  return (
    <Field
      name={name}
      validate={validate}
      subscription={{ value: true, error: true, touched: true }}
    >
      {({ input, meta }) => {
        const showError = meta.touched && meta.error;
        return (
          <fieldset className={classNames(css.root, className)} id={id}>
            <legend className={css.legend}>{legend}</legend>
            {hint ? <p className={css.hint}>{hint}</p> : null}

            <div className={css.pills} role="radiogroup">
              {options.map(opt => {
                // Selection read from form state every render - see note 1 above.
                const isSelected = input.value === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={classNames(css.pill, {
                      [css.pillSelected]: isSelected,
                      [css.pillFlashing]: flashing === opt.value,
                    })}
                  >
                    <input
                      className={css.input}
                      type="radio"
                      name={input.name}
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => {
                        input.onChange(opt.value);
                        handleChoose(opt.value);
                      }}
                      onBlur={input.onBlur}
                      onFocus={input.onFocus}
                    />
                    <span className={css.pillLabel}>{opt.label}</span>
                    {opt.hint ? <span className={css.pillHint}>{opt.hint}</span> : null}
                  </label>
                );
              })}
            </div>

            {showError ? <p className={css.error}>{meta.error}</p> : null}
          </fieldset>
        );
      }}
    </Field>
  );
};

export default PillChoice;

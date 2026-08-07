import React from 'react';

import { FormattedMessage } from '../../../util/reactIntl';

import css from './ListingStepChrome.module.css';

/**
 * The frame around one step of the listing flow.
 *
 * From the approved sell-flow direction (variant-D): a thin progress bar flush to the top edge,
 * "STEP N OF 5" on the left with Back on the right, then one large question owning the screen. The
 * rejected alternatives are worth remembering, because they will look reasonable again:
 *
 * - A running summary of the listing beside every question. "Too much" - it belongs on a summary
 *   screen at the end instead.
 * - The ticket-stub illustration as the centrepiece. "Too much again."
 * - A solid filled selection state. "Looks kinda crappy" at full width.
 *
 * TOTAL_STEPS is five: event, ticket type, attestation, description, price. The first four are
 * stages inside the wizard's Details tab; price is the Pricing tab. The count spans both because a
 * seller experiences one flow, not two tabs.
 */
export const TOTAL_STEPS = 5;

const ListingStepChrome = props => {
  // `as` sets the question's heading level. The question is the only heading on a step, so where
  // the panel above has dropped its own it becomes the h1; where the panel keeps one, h2.
  const { step, questionId, hintId, onBack, as: Question = 'h2', children } = props;

  const pct = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className={css.root}>
      {/* Flush to the top edge of the content column, not inset - it reads as the page's own
          progress rather than as another element on it. */}
      <div className={css.track} role="presentation">
        <div className={css.fill} style={{ width: `${pct}%` }} />
      </div>

      <div className={css.chrome}>
        <span className={css.stepLabel}>
          <FormattedMessage id="ListingStepChrome.stepOf" values={{ step, total: TOTAL_STEPS }} />
        </span>
        {onBack ? (
          <button type="button" className={css.back} onClick={onBack}>
            <FormattedMessage id="ListingStepChrome.back" />
          </button>
        ) : null}
      </div>

      <Question className={css.question}>
        <FormattedMessage id={questionId} />
      </Question>
      {hintId ? (
        <p className={css.hint}>
          <FormattedMessage id={hintId} />
        </p>
      ) : null}

      <div className={css.body}>{children}</div>
    </div>
  );
};

export default ListingStepChrome;

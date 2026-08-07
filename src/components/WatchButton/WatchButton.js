import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { watchEvent, unwatchEvent, setPendingWatch } from '../../ducks/watch.duck';
import { pathByRouteName } from '../../util/routes';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';

import css from './WatchButton.module.css';

/**
 * "Alert me" / "Alerts on" for one event.
 *
 * Optimistic on purpose. The control flips the instant it is tapped rather than waiting for
 * the server, because on a bad connection - which is most of St Andrews - a control that sits
 * there doing nothing reads as broken, and people tap it again. The duck puts it back if the
 * request fails.
 *
 * Signed out, this routes to signup and remembers which event you were on, so the watch is
 * applied when you come back. Freshers week is exactly when someone taps this before they
 * have an account, and dropping the intent would waste the one moment they were motivated.
 *
 * The label carries the event title as an accessible name. A browse grid renders twelve of
 * these, and "alert me" twelve times tells a screen reader user nothing about which is which.
 */
const WatchButton = props => {
  const { eventId, eventTitle, eventAuthorId, className, quiet = true } = props;
  const dispatch = useDispatch();
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const routeConfiguration = useRouteConfiguration();

  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const currentUserId = useSelector(state => state.user.currentUser?.id?.uuid);
  const transactionId = useSelector(state => state.watch.byEventId[eventId]);
  const isPending = useSelector(state => !!state.watch.pending[eventId]);

  const isWatching = !!transactionId;

  // Sharetribe refuses a transaction where the customer and the listing author are the same
  // person (transaction-same-author-and-customer), and a watch IS a transaction against the
  // event listing. So you cannot set an alert on an event you created. That covers the admin
  // account, which authors every curated event, and any seller who added their own.
  //
  // Verified against the live API, not inferred: clicking this as the admin returned 409
  // transaction-same-author-and-customer.
  //
  // Rendering nothing beats rendering a control that always fails. Guarded on both ids
  // being known, so a missing authorId never hides the button from someone who could use it.
  const isOwnEvent = !!eventAuthorId && !!currentUserId && eventAuthorId === currentUserId;
  if (isOwnEvent) {
    return null;
  }

  const onClick = e => {
    // The control can sit inside other clickable chrome; never let the tap travel.
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      setPendingWatch(eventId);
      // The return address goes in router history state, NOT the query string.
      // AuthenticationPage reads `location.state?.from` and nothing else, so a ?from=
      // parameter is silently ignored and the user lands on the homepage after signing
      // up - taking the pending watch with it, because the effect that applies it only
      // runs on the events pages. Routes.js:201 and four other call sites already do it
      // this way; matching them is what keeps this from drifting again.
      //
      // search and hash are included so returning to a filtered browse page keeps the
      // filter the user had applied.
      history.push({
        pathname: pathByRouteName('SignupPage', routeConfiguration),
        state: { from: `${location.pathname}${location.search}${location.hash}` },
      });
      return;
    }

    if (isPending) return;

    if (isWatching) {
      dispatch(unwatchEvent({ eventId, transactionId }));
    } else {
      dispatch(watchEvent({ eventId }));
    }
  };

  const labelId = isWatching ? 'WatchButton.watching' : 'WatchButton.watch';
  const ariaId = isWatching ? 'WatchButton.watchingAria' : 'WatchButton.watchAria';

  return (
    <button
      type="button"
      className={classNames(
        quiet ? css.quiet : css.loud,
        { [css.isWatching]: isWatching },
        className
      )}
      onClick={onClick}
      aria-pressed={isWatching}
      aria-label={intl.formatMessage({ id: ariaId }, { title: eventTitle || '' })}
    >
      <FormattedMessage id={labelId} />
    </button>
  );
};

export default WatchButton;

import React from 'react';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';

import { Page, LayoutSingleColumn, H1, H2, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './SellPage.module.css';

/**
 * The seller's hub: three doors, matching flow 5.4 of user_flows.md.
 *
 * Deliberately a landing page rather than a dashboard full of data. A seller arriving here either
 * wants to list something, change something they have listed, or find out where their money is -
 * and those are three different journeys, not one screen.
 */
const OPTIONS = [
  {
    name: 'NewListingPage',
    titleId: 'SellPage.newListingTitle',
    bodyId: 'SellPage.newListingBody',
  },
  {
    name: 'ManageListingsPage',
    titleId: 'SellPage.currentListingsTitle',
    bodyId: 'SellPage.currentListingsBody',
  },
  {
    // Sales and payouts live in the existing Inbox "sales" tab, which already lists every
    // transaction where this user is the provider. Pointing at it beats building a second,
    // divergent view of the same data.
    name: 'InboxPage',
    params: { tab: 'sales' },
    titleId: 'SellPage.salesTitle',
    bodyId: 'SellPage.salesBody',
  },
];

export const SellPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();

  return (
    <Page
      title={intl.formatMessage(
        { id: 'SellPage.schemaTitle' },
        { marketplaceName: config.marketplaceName }
      )}
      scrollingDisabled={false}
    >
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <H1 className={css.title}>
          <FormattedMessage id="SellPage.title" />
        </H1>

        <div className={css.options}>
          {OPTIONS.map(opt => (
            <NamedLink
              key={opt.name + (opt.params?.tab || '')}
              className={css.option}
              name={opt.name}
              params={opt.params}
            >
              <H2 className={css.optionTitle}>
                <FormattedMessage id={opt.titleId} />
              </H2>
              <p className={css.optionBody}>
                <FormattedMessage id={opt.bodyId} />
              </p>
            </NamedLink>
          ))}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default SellPageComponent;

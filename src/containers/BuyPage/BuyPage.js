import React from 'react';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { OTHER_LISTING_TYPE } from '../../config/configListing';

import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './BuyPage.module.css';

/**
 * The step between "buy" and browsing.
 *
 * Tickets and everything else are genuinely different products with different browsing models -
 * tickets are searched by event, the rest by listing - so they get different pages. Asking which
 * one here is one extra click that saves a buyer landing in the wrong search and having to work out
 * why it does not behave the way they expect.
 */
const Choice = props => {
  const { variant, index, linkName, linkParams } = props;

  return (
    <NamedLink className={css.choice} name={linkName} params={linkParams}>
      <span className={css.index}>{index}</span>
      <span className={css.choiceInner}>
        <span className={css.choiceTitle}>
          <FormattedMessage id={`BuyPage.${variant}.title`} />
        </span>
        <span className={css.choiceLead}>
          <FormattedMessage id={`BuyPage.${variant}.lead`} />
        </span>
        <span className={css.choiceAction}>
          <FormattedMessage id={`BuyPage.${variant}.action`} />
          <span className={css.arrow} aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </NamedLink>
  );
};

export const BuyPageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();

  return (
    <Page
      title={intl.formatMessage(
        { id: 'BuyPage.schemaTitle' },
        { marketplaceName: config.marketplaceName }
      )}
      scrollingDisabled={false}
    >
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <div className={css.header}>
          <p className={css.eyebrow}>
            <FormattedMessage id="BuyPage.eyebrow" />
          </p>
          <h1 className={css.title}>
            <FormattedMessage id="BuyPage.title" />
          </h1>
        </div>

        <div className={css.choices}>
          <Choice variant="tickets" index="01" linkName="EventsPage" />
          <Choice
            variant="everythingElse"
            index="02"
            linkName="SearchPageWithListingType"
            linkParams={{ listingType: OTHER_LISTING_TYPE }}
          />
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BuyPageComponent;

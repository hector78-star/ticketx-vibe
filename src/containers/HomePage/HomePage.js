import React from 'react';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';

import { Page, LayoutSingleColumn, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import { useRevealOnScroll } from './useRevealOnScroll';

import css from './HomePage.module.css';

/**
 * The homepage.
 *
 * This replaces the Console-hosted PageBuilder landing page. A split buy/sell entry and a
 * scroll-driven 3D reveal are not things PageBuilder can express, so the page is coded. The old
 * hosted page still exists in Console and LandingPage.js is untouched - switching back is a
 * one-line change in routeConfiguration.js.
 *
 * The shape is deliberately two doors and nothing else above the fold. Every visitor is here to do
 * one of exactly two things, and asking them which is a faster route to the right page than a hero
 * paragraph they will not read.
 */

/** One half of the split. Buy and sell are peers - neither is the "real" action. */
const Door = props => {
  const { variant, index, linkName, linkParams } = props;

  return (
    <NamedLink
      className={variant === 'buy' ? css.doorBuy : css.doorSell}
      name={linkName}
      params={linkParams}
    >
      <span className={css.doorIndex}>{index}</span>
      <span className={css.doorInner}>
        {/* h2, not a span. The two doors are the page's real section headings, and marking them up
            as text left the document outline starting at the how-it-works heading. */}
        <h2 className={css.doorTitle}>
          <FormattedMessage id={`HomePage.${variant}.title`} />
        </h2>
        <span className={css.doorLead}>
          <FormattedMessage id={`HomePage.${variant}.lead`} />
        </span>
        <span className={css.doorAction}>
          <FormattedMessage id={`HomePage.${variant}.action`} />
          <span className={css.doorArrow} aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </NamedLink>
  );
};

/**
 * The page's h1.
 *
 * Visually hidden because the design's first line is deliberately the word "Buy" at 132px, not a
 * sentence. But a page with no h1 has no name: the outline started at the doors, and anyone
 * arriving by screen reader or search engine got no statement of what this site is.
 */
const PageTitle = () => (
  <h1 className={css.visuallyHiddenTitle}>
    <FormattedMessage id="HomePage.h1" />
  </h1>
);

/**
 * One step of the payment flow, tilted away from the reader until it scrolls into view.
 *
 * The 3D is a shared perspective on the parent plus rotateX here, so the row of steps reads as one
 * surface rotating rather than three unrelated cards. Each step is delayed slightly more than the
 * last so they resolve in reading order.
 */
const Step = props => {
  const { number, delay } = props;
  const [ref, revealed] = useRevealOnScroll();

  return (
    <li
      ref={ref}
      className={revealed ? css.stepRevealed : css.step}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className={css.stepNumber}>{number}</span>
      <h3 className={css.stepTitle}>
        <FormattedMessage id={`HomePage.step${number}.title`} />
      </h3>
      <p className={css.stepBody}>
        <FormattedMessage id={`HomePage.step${number}.body`} />
      </p>
    </li>
  );
};

const Assurance = props => {
  const { id } = props;
  const [ref, revealed] = useRevealOnScroll();

  return (
    <li ref={ref} className={revealed ? css.assuranceRevealed : css.assurance}>
      <FormattedMessage id={id} />
    </li>
  );
};

export const HomePageComponent = () => {
  const intl = useIntl();
  const config = useConfiguration();

  const [howRef, howRevealed] = useRevealOnScroll({ threshold: 0.1 });

  return (
    <Page
      title={intl.formatMessage(
        { id: 'HomePage.schemaTitle' },
        { marketplaceName: config.marketplaceName }
      )}
      description={intl.formatMessage({ id: 'HomePage.schemaDescription' })}
      scrollingDisabled={false}
    >
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        mainColumnClassName={css.main}
      >
        <PageTitle />

        <section className={css.split}>
          <Door variant="buy" index="01" linkName="BuyPage" />
          <Door variant="sell" index="02" linkName="NewListingPage" />
        </section>

        <section className={css.how} ref={howRef}>
          <div className={css.howHeader}>
            <p className={css.eyebrow}>
              <FormattedMessage id="HomePage.how.eyebrow" />
            </p>
            <h2 className={howRevealed ? css.howTitleRevealed : css.howTitle}>
              <FormattedMessage id="HomePage.how.title" />
            </h2>
          </div>

          <ol className={css.steps}>
            <Step number={1} delay={0} />
            <Step number={2} delay={90} />
            <Step number={3} delay={180} />
          </ol>

          <ul className={css.assurances}>
            <Assurance id="HomePage.assurance.escrow" />
            <Assurance id="HomePage.assurance.students" />
            <Assurance id="HomePage.assurance.dispute" />
          </ul>
        </section>
      </LayoutSingleColumn>
    </Page>
  );
};

export default HomePageComponent;

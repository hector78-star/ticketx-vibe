import React from 'react';
import ListingImageGallery from './ListingImageGallery/ListingImageGallery';

import css from './ListingPage.module.css';

/**
 * The listing's photos.
 *
 * The gallery itself is skipped when there are none. Tickets carry no photo of their own - they
 * borrow the event's - so a seller-created event without an image yet produced a large grey
 * "NO IMAGE" slab as the first thing on the page. An absent photo should be absent, not announced.
 *
 * The <section> stays either way: carousel mode is defined by rendering this section rather than a
 * hero, and that structural contract holds whether or not there is anything to show inside it.
 */
const SectionGallery = props => {
  const { listing, variantPrefix } = props;
  const images = listing.images;
  const imageVariants = ['scaled-small', 'scaled-medium', 'scaled-large', 'scaled-xlarge'];
  const thumbnailVariants = [variantPrefix, `${variantPrefix}-2x`, `${variantPrefix}-4x`];
  return (
    <section className={css.productGallery} data-testid="carousel">
      {images && images.length > 0 ? (
        <ListingImageGallery
          images={images}
          imageVariants={imageVariants}
          thumbnailVariants={thumbnailVariants}
        />
      ) : null}
    </section>
  );
};

export default SectionGallery;

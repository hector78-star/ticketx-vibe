import React, { useState, useEffect } from 'react';
import { Field, Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';

// Import util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { displayDescription } from '../../../../util/configHelpers.js';
import { useConfiguration } from '../../../../context/configurationContext.js';
import { EXTENDED_DATA_SCHEMA_TYPES, propTypes } from '../../../../util/types';
import {
  isFieldForCategory,
  isFieldForListingType,
  isValidCurrencyForTransactionProcess,
} from '../../../../util/fieldHelpers';
import { maxLength, required, composeValidators } from '../../../../util/validators';

// Import shared components
import {
  Form,
  Button,
  FieldSelect,
  FieldTextInput,
  Heading,
  CustomExtendedDataField,
} from '../../../../components';
// Import modules from this directory
import EventPicker from './EventPicker';
import EditListingTicketFields from './EditListingTicketFields';
import ListingStepChrome from '../ListingStepChrome';
import css from './EditListingDetailsForm.module.css';

import {
  AUTOFILLED_TICKET_FIELDS,
  BRANCHED_TICKET_FIELDS,
  TICKET_LISTING_TYPE,
  TICKET_TYPE_MOBILE,
  TICKET_TYPE_PDF,
  TICKET_TYPE_PHYSICAL,
} from '../../../../config/configListing';

const TITLE_MAX_LENGTH = 60;

/**
 * The ticket flow's four questions on the Details tab. Price is step 5, over on the Pricing tab.
 *
 * Steps 1 and 2 are choices and advance on their own. Steps 3 and 4 keep an explicit Continue,
 * because there is no moment at which the app can know a seller has finished typing a sentence or
 * ticked the box they meant to tick - auto-advancing there would either fire too early or trap
 * them.
 */
const TICKET_STEPS = {
  1: {
    questionId: 'EditListingDetailsForm.stepEventQuestion',
    hintId: 'EditListingDetailsForm.stepEventHint',
  },
  2: {
    questionId: 'EditListingDetailsForm.stepTypeQuestion',
    hintId: 'EditListingDetailsForm.stepTypeHint',
  },
  3: {
    questionId: 'EditListingDetailsForm.stepAttestQuestion',
    hintId: 'EditListingDetailsForm.stepAttestHint',
  },
  4: {
    questionId: 'EditListingDetailsForm.stepDescriptionQuestion',
    hintId: 'EditListingDetailsForm.stepDescriptionHint',
  },
};

// FieldCheckbox is used both standalone and inside checkbox groups, so a ticked box arrives here as
// either `true` or a one-element array depending on which. Accept both rather than betting on one.
const isChecked = value => (Array.isArray(value) ? value.length > 0 : !!value);

// Whether step 3 is satisfied. Each ticket type attests to a different thing, so what counts as
// "done" branches the same way the fields do.
const ticketAttestationDone = values => {
  const type = values.pub_ticketType;
  if (type === TICKET_TYPE_MOBILE) {
    return !!values.pub_ticketPlatform && isChecked(values.pub_transferabilityConfirmed);
  }
  if (type === TICKET_TYPE_PDF) {
    return isChecked(values.pub_pdfAttestationConfirmed);
  }
  if (type === TICKET_TYPE_PHYSICAL) {
    return isChecked(values.pub_physicalHandoverAcknowledged);
  }
  return false;
};

// Where to open the flow: the first unanswered question. A seller editing a saved listing lands on
// the last step rather than being walked through four screens they already filled in.
const furthestTicketStep = values => {
  if (!values.pub_eventId) return 1;
  if (!values.pub_ticketType) return 2;
  if (!ticketAttestationDone(values)) return 3;
  return 4;
};

// Show various error messages
const ErrorMessage = props => {
  const { fetchErrors } = props;
  const { updateListingError, createListingDraftError, showListingsError } = fetchErrors || {};
  const errorMessage = updateListingError ? (
    <FormattedMessage id="EditListingDetailsForm.updateFailed" />
  ) : createListingDraftError ? (
    <FormattedMessage id="EditListingDetailsForm.createListingDraftError" />
  ) : showListingsError ? (
    <FormattedMessage id="EditListingDetailsForm.showListingFailed" />
  ) : null;

  if (errorMessage) {
    return <p className={css.error}>{errorMessage}</p>;
  }
  return null;
};

// Hidden input field
const FieldHidden = props => {
  const { name } = props;
  return (
    <Field id={name} name={name} type="hidden" className={css.unitTypeHidden}>
      {fieldRenderProps => <input {...fieldRenderProps?.input} />}
    </Field>
  );
};

// Field component that either allows selecting listing type (if multiple types are available)
// or just renders hidden fields:
// - listingType              Set of predefined configurations for each listing type
// - transactionProcessAlias  Initiate correct transaction against Marketplace API
// - unitType                 Main use case: pricing unit
const FieldSelectListingType = props => {
  const {
    name,
    listingTypes,
    hasPredefinedListingType,
    hideSelect,
    onListingTypeChange,
    formApi,
    formId,
    intl,
  } = props;
  const hasMultipleListingTypes = listingTypes?.length > 1 && !hideSelect;

  const handleOnChange = value => {
    const selectedListingType = listingTypes.find(config => config.listingType === value);
    formApi.change('transactionProcessAlias', selectedListingType.transactionProcessAlias);
    formApi.change('unitType', selectedListingType.unitType);

    if (onListingTypeChange) {
      onListingTypeChange(selectedListingType);
    }
  };
  const getListingTypeLabel = listingType => {
    const listingTypeConfig = listingTypes.find(config => config.listingType === listingType);
    return listingTypeConfig ? listingTypeConfig.label : listingType;
  };

  return hasMultipleListingTypes && !hasPredefinedListingType ? (
    <>
      <FieldSelect
        id={formId ? `${formId}.${name}` : name}
        name={name}
        className={css.listingTypeSelect}
        label={intl.formatMessage({ id: 'EditListingDetailsForm.listingTypeLabel' })}
        validate={required(
          intl.formatMessage({ id: 'EditListingDetailsForm.listingTypeRequired' })
        )}
        onChange={handleOnChange}
      >
        <option disabled value="">
          {intl.formatMessage({ id: 'EditListingDetailsForm.listingTypePlaceholder' })}
        </option>
        {listingTypes.map(config => {
          const type = config.listingType;
          return (
            <option key={type} value={type}>
              {config.label}
            </option>
          );
        })}
      </FieldSelect>
      <FieldHidden name="transactionProcessAlias" />
      <FieldHidden name="unitType" />
    </>
  ) : hasMultipleListingTypes && hasPredefinedListingType ? (
    <div className={css.listingTypeSelect}>
      <Heading as="h5" rootClassName={css.selectedLabel}>
        {intl.formatMessage({ id: 'EditListingDetailsForm.listingTypeLabel' })}
      </Heading>
      <p className={css.selectedValue}>{getListingTypeLabel(formApi.getFieldState(name)?.value)}</p>
      <FieldHidden name={name} />
      <FieldHidden name="transactionProcessAlias" />
      <FieldHidden name="unitType" />
    </div>
  ) : (
    <>
      <FieldHidden name={name} />
      <FieldHidden name="transactionProcessAlias" />
      <FieldHidden name="unitType" />
    </>
  );
};

// Finds the correct subcategory within the given categories array based on the provided categoryIdToFind.
const findCategoryConfig = (categories, categoryIdToFind) => {
  return categories?.find(category => category.id === categoryIdToFind);
};

/**
 * Recursively render subcategory field inputs if there are subcategories available.
 * This function calls itself with updated props to render nested category fields.
 * The select field is used for choosing a category or subcategory.
 */
const CategoryField = props => {
  const { currentCategoryOptions, level, values, prefix, handleCategoryChange, intl } = props;

  const currentCategoryKey = `${prefix}${level}`;

  const categoryConfig = findCategoryConfig(currentCategoryOptions, values[`${prefix}${level}`]);

  return (
    <>
      {currentCategoryOptions ? (
        <FieldSelect
          key={currentCategoryKey}
          id={currentCategoryKey}
          name={currentCategoryKey}
          className={css.listingTypeSelect}
          onChange={event => handleCategoryChange(event, level, currentCategoryOptions)}
          label={intl.formatMessage(
            { id: 'EditListingDetailsForm.categoryLabel' },
            { categoryLevel: currentCategoryKey }
          )}
          validate={required(
            intl.formatMessage(
              { id: 'EditListingDetailsForm.categoryRequired' },
              { categoryLevel: currentCategoryKey }
            )
          )}
        >
          <option disabled value="">
            {intl.formatMessage(
              { id: 'EditListingDetailsForm.categoryPlaceholder' },
              { categoryLevel: currentCategoryKey }
            )}
          </option>

          {currentCategoryOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </FieldSelect>
      ) : null}

      {categoryConfig?.subcategories?.length > 0 ? (
        <CategoryField
          currentCategoryOptions={categoryConfig.subcategories}
          level={level + 1}
          values={values}
          prefix={prefix}
          handleCategoryChange={handleCategoryChange}
          intl={intl}
        />
      ) : null}
    </>
  );
};

const FieldSelectCategory = props => {
  useEffect(() => {
    checkIfInitialValuesExist();
  }, []);

  const { prefix, listingCategories, formApi, intl, setAllCategoriesChosen, values } = props;

  // Counts the number of selected categories in the form values based on the given prefix.
  const countSelectedCategories = () => {
    return Object.keys(values).filter(key => key.startsWith(prefix)).length;
  };

  // Checks if initial values exist for categories and sets the state accordingly.
  // If initial values exist, it sets `allCategoriesChosen` state to true; otherwise, it sets it to false
  const checkIfInitialValuesExist = () => {
    const count = countSelectedCategories(values, prefix);
    setAllCategoriesChosen(count > 0);
  };

  // If a parent category changes, clear all child category values
  const handleCategoryChange = (category, level, currentCategoryOptions) => {
    const selectedCatLenght = countSelectedCategories();
    if (level < selectedCatLenght) {
      for (let i = selectedCatLenght; i > level; i--) {
        formApi.change(`${prefix}${i}`, null);
      }
    }
    const categoryConfig = findCategoryConfig(currentCategoryOptions, category).subcategories;
    setAllCategoriesChosen(!categoryConfig || categoryConfig.length === 0);
  };

  return (
    <CategoryField
      currentCategoryOptions={listingCategories}
      level={1}
      values={values}
      prefix={prefix}
      handleCategoryChange={handleCategoryChange}
      intl={intl}
    />
  );
};

// Add collect data for listing fields (both publicData and privateData) based on configuration
const AddListingFields = props => {
  const { listingType, listingFieldsConfig, selectedCategories, formId, intl } = props;
  const targetCategoryIds = Object.values(selectedCategories);

  const fields = listingFieldsConfig.reduce((pickedFields, fieldConfig) => {
    const { key, schemaType, scope } = fieldConfig || {};
    const namespacedKey = scope === 'public' ? `pub_${key}` : `priv_${key}`;

    const isKnownSchemaType = EXTENDED_DATA_SCHEMA_TYPES.includes(schemaType);
    const isProviderScope = ['public', 'private'].includes(scope);
    const isTargetListingType = isFieldForListingType(listingType, fieldConfig);
    const isTargetCategory = isFieldForCategory(targetCategoryIds, fieldConfig);
    // TicketX: the event picker writes these, so rendering them here too would give the seller a
    // free-text box for details they are supposed to be choosing, not typing.
    const isAutofilledByEventPicker =
      listingType === TICKET_LISTING_TYPE && AUTOFILLED_TICKET_FIELDS.includes(key);
    // Rendered by EditListingTicketFields instead, which branches on the chosen ticket type.
    const isBranchedTicketField =
      listingType === TICKET_LISTING_TYPE && BRANCHED_TICKET_FIELDS.includes(key);

    return isKnownSchemaType &&
      isProviderScope &&
      isTargetListingType &&
      isTargetCategory &&
      !isAutofilledByEventPicker &&
      !isBranchedTicketField
      ? [
          ...pickedFields,
          <CustomExtendedDataField
            key={namespacedKey}
            name={namespacedKey}
            fieldConfig={fieldConfig}
            defaultRequiredMessage={intl.formatMessage({
              id: 'EditListingDetailsForm.defaultRequiredMessage',
            })}
            formId={formId}
          />,
        ]
      : pickedFields;
  }, []);

  return <>{fields}</>;
};

// Return configuration for given listingType
const getListingTypeConfig = (config, listingType) => {
  return config.listing.listingTypes?.find(config => config.listingType === listingType);
};

/**
 * Form that asks title, description, transaction process and unit type for pricing
 * In addition, it asks about custom fields according to marketplace-custom-config.js
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.formId] - The form id
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {boolean} props.updated - Whether the form is updated
 * @param {boolean} props.updateInProgress - Whether the update is in progress
 * @param {Object} props.fetchErrors - The fetch errors object
 * @param {propTypes.error} [props.fetchErrors.createListingDraftError] - The create listing draft error
 * @param {propTypes.error} [props.fetchErrors.showListingsError] - The show listings error
 * @param {propTypes.error} [props.fetchErrors.updateListingError] - The update listing error
 * @param {Function} props.pickSelectedCategories - The pick selected categories function
 * @param {Array<Object>} props.selectableListingTypes - The selectable listing types
 * @param {boolean} props.hasPredefinedListingType - Whether the listing type is already saved or predefined through URL
 * @param {propTypes.listingFields} props.listingFieldsConfig - The listing fields config
 * @param {string} props.listingCurrency - The listing currency
 * @param {string} props.saveActionMsg - The save action message
 * @param {boolean} [props.autoFocus] - Whether the form should autofocus
 * @param {Function} props.onListingTypeChange - The listing type change function
 * @param {Function} props.onSubmit - The submit function
 * @returns {JSX.Element}
 */
const EditListingDetailsForm = props => (
  <FinalForm
    {...props}
    mutators={{ ...arrayMutators }}
    render={formRenderProps => {
      const {
        autoFocus,
        className,
        disabled,
        ready,
        formId = 'EditListingDetailsForm',
        form: formApi,
        handleSubmit,
        onListingTypeChange,
        invalid,
        pristine,
        marketplaceCurrency,
        marketplaceName,
        selectableListingTypes,
        selectableCategories,
        hasPredefinedListingType = false,
        pickSelectedCategories,
        categoryPrefix,
        saveActionMsg,
        updated,
        updateInProgress,
        fetchErrors,
        listingFieldsConfig = [],
        listingCurrency,
        values,
      } = formRenderProps;

      const intl = useIntl();
      const { listingType, transactionProcessAlias, unitType } = values;
      const [allCategoriesChosen, setAllCategoriesChosen] = useState(false);

      // TicketX: ticket listings get the curated event picker instead of a free-text title. The
      // title is generated from the chosen event, so the two must never both be on screen.
      const isTicketListing = listingType === TICKET_LISTING_TYPE;

      // One question per screen, rather than the stack of revealed stages this used to be. Stages
      // that accumulate still end up as a wall of fields by the last one; the approved flow shows
      // exactly one and lets the seller step back through them.
      //
      // Held in state rather than derived from values, because those diverge the moment a seller
      // presses Back: their answers are all still there, and deriving the step from them would
      // bounce them straight forward again. Lazy initial value so it is read once on mount - the
      // wizard remounts this panel when the tab changes, which is when resuming should re-evaluate.
      const [ticketStep, setTicketStep] = useState(() => furthestTicketStep(values));
      const attestationDone = ticketAttestationDone(values);

      const titleRequiredMessage = intl.formatMessage({
        id: 'EditListingDetailsForm.titleRequired',
      });
      const maxLengthMessage = intl.formatMessage(
        { id: 'EditListingDetailsForm.maxLength' },
        {
          maxLength: TITLE_MAX_LENGTH,
        }
      );

      // Determine the currency to validate:
      // - If editing an existing listing, use the listing's currency.
      // - If creating a new listing, fall back to the default marketplace currency.
      const currencyToCheck = listingCurrency || marketplaceCurrency;

      // Verify if the selected listing type's transaction process supports the chosen currency.
      // This checks compatibility between the transaction process
      // and the marketplace or listing currency.
      const isCompatibleCurrency = isValidCurrencyForTransactionProcess(
        transactionProcessAlias,
        currencyToCheck
      );

      const maxLength60Message = maxLength(maxLengthMessage, TITLE_MAX_LENGTH);

      const hasCategories = selectableCategories && selectableCategories.length > 0;
      const showCategories = listingType && hasCategories;

      const showTitle = hasCategories ? allCategoriesChosen : listingType;

      const config = useConfiguration();
      const listingTypeConfig = getListingTypeConfig(config, listingType);
      const showDescriptionMaybe = displayDescription(listingTypeConfig);
      const showDescription = hasCategories
        ? allCategoriesChosen && showDescriptionMaybe
        : showDescriptionMaybe;

      const showListingFields = hasCategories ? allCategoriesChosen : listingType;

      const classes = classNames(css.root, className);
      const submitReady = (updated && pristine) || ready;
      const submitInProgress = updateInProgress;
      const hasMandatoryListingTypeData = listingType && transactionProcessAlias && unitType;
      // Only the step on screen has its fields mounted, so final-form's `invalid` reflects that step
      // alone - the attestation's validator is not running by the time the seller reaches step 4.
      // Re-check the earlier answers here so an incomplete ticket cannot be saved.
      const ticketFlowComplete = !isTicketListing || (attestationDone && !!values.description);
      const submitDisabled =
        invalid ||
        disabled ||
        submitInProgress ||
        !hasMandatoryListingTypeData ||
        !isCompatibleCurrency ||
        !ticketFlowComplete;

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <ErrorMessage fetchErrors={fetchErrors} />

          {/* Choosing a type IS step zero of the ticket flow, so once it is chosen the select has
              done its job. Leaving it on screen put a second control above every question - and a
              second hairline rule directly above the progress bar - on screens designed to ask one
              thing. It renders as hidden fields instead, which keeps listingType,
              transactionProcessAlias and unitType registered and submitted. Step 1's Back clears
              the type, which brings the select straight back. */}
          <FieldSelectListingType
            name="listingType"
            listingTypes={selectableListingTypes}
            hasPredefinedListingType={hasPredefinedListingType}
            hideSelect={isTicketListing}
            onListingTypeChange={onListingTypeChange}
            formApi={formApi}
            formId={formId}
            intl={intl}
          />

          {showCategories && isCompatibleCurrency && (
            <FieldSelectCategory
              values={values}
              prefix={categoryPrefix}
              listingCategories={selectableCategories}
              formApi={formApi}
              intl={intl}
              allCategoriesChosen={allCategoriesChosen}
              setAllCategoriesChosen={setAllCategoriesChosen}
            />
          )}

          {isTicketListing && isCompatibleCurrency && (
            <ListingStepChrome
              step={ticketStep}
              questionId={TICKET_STEPS[ticketStep].questionId}
              hintId={TICKET_STEPS[ticketStep].hintId}
              // The panel suppresses its own "Listing details" heading while this flow is on
              // screen, so the step's question is the page's h1. Without this the page had no
              // h1 at all - a screen-reader user landing here got a document with no title.
              as="h1"
              onBack={
                ticketStep > 1
                  ? () => setTicketStep(ticketStep - 1)
                  : // Step 1 is the first question, but not the first choice: the seller got here by
                    // picking "Sell a ticket". Back undoes that, which is the only way out now that
                    // the type select is not permanently on screen.
                    () => {
                      formApi.change('listingType', undefined);
                      formApi.change('transactionProcessAlias', undefined);
                      formApi.change('unitType', undefined);
                    }
              }
            >
              {ticketStep === 1 ? (
                <EventPicker formId={formId} onSelect={() => setTicketStep(2)} />
              ) : null}

              {ticketStep === 2 ? (
                <EditListingTicketFields
                  formId={formId}
                  stage="type"
                  onTypeChosen={() => setTicketStep(3)}
                />
              ) : null}

              {ticketStep === 3 ? (
                <>
                  <EditListingTicketFields formId={formId} stage="attestation" />
                  <Button
                    // type="button", not submit: this advances within the Details tab. Submitting
                    // here would save a half-finished listing and jump to Pricing.
                    type="button"
                    className={css.stepButton}
                    disabled={!attestationDone}
                    onClick={() => setTicketStep(4)}
                  >
                    <FormattedMessage id="EditListingDetailsForm.stepContinue" />
                  </Button>
                </>
              ) : null}

              {ticketStep === 4 ? (
                <FieldTextInput
                  id={`${formId}description`}
                  name="description"
                  className={css.description}
                  type="textarea"
                  // The step's question is the visible label, so the textarea needs its accessible
                  // name spelled out - a placeholder is not one.
                  aria-label={intl.formatMessage({
                    id: 'EditListingDetailsForm.stepDescriptionQuestion',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'EditListingDetailsForm.descriptionPlaceholder',
                  })}
                  validate={required(
                    intl.formatMessage({
                      id: 'EditListingDetailsForm.descriptionRequired',
                    })
                  )}
                  autoFocus
                />
              ) : null}
            </ListingStepChrome>
          )}

          {showTitle && isCompatibleCurrency && !isTicketListing && (
            <FieldTextInput
              id={`${formId}title`}
              name="title"
              className={css.title}
              type="text"
              label={intl.formatMessage({ id: 'EditListingDetailsForm.title' })}
              placeholder={intl.formatMessage({
                id: 'EditListingDetailsForm.titlePlaceholder',
              })}
              maxLength={TITLE_MAX_LENGTH}
              validate={composeValidators(required(titleRequiredMessage), maxLength60Message)}
              autoFocus={autoFocus}
            />
          )}

          {showDescription && isCompatibleCurrency && !isTicketListing && (
            <FieldTextInput
              id={`${formId}description`}
              name="description"
              className={css.description}
              type="textarea"
              label={intl.formatMessage({ id: 'EditListingDetailsForm.description' })}
              placeholder={intl.formatMessage({
                id: 'EditListingDetailsForm.descriptionPlaceholder',
              })}
              validate={required(
                intl.formatMessage({
                  id: 'EditListingDetailsForm.descriptionRequired',
                })
              )}
            />
          )}

          {showListingFields && isCompatibleCurrency && (
            <AddListingFields
              listingType={listingType}
              listingFieldsConfig={listingFieldsConfig}
              selectedCategories={pickSelectedCategories(values)}
              formId={formId}
              intl={intl}
            />
          )}

          {!isCompatibleCurrency && listingType && (
            <p className={css.error}>
              <FormattedMessage
                id="EditListingDetailsForm.incompatibleCurrency"
                values={{ marketplaceName, marketplaceCurrency }}
              />
            </p>
          )}

          {/* Steps 1-3 of the ticket flow carry their own advance, so the tab's save button would
              be a second, contradictory way forward. It belongs on the last step only. */}
          {!isTicketListing || ticketStep === 4 ? (
            <Button
              className={css.submitButton}
              type="submit"
              inProgress={submitInProgress}
              disabled={submitDisabled}
              ready={submitReady}
            >
              {saveActionMsg}
            </Button>
          ) : null}
        </Form>
      );
    }}
  />
);

export default EditListingDetailsForm;

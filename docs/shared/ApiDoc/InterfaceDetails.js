import PropTypes from "prop-types";
import React from "react";
import {
  ApiDocHeading,
  DocBlock,
  PropertySignatureTable,
  useApiDocContext,
} from ".";
export function InterfaceDetails({
  canonicalReference,
  headingLevel,
  link,
  customPropertyOrder,
}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  return (
    <>
      <ApiDocHeading
        canonicalReference={canonicalReference}
        headingLevel={headingLevel}
        link={link}
      />
      <DocBlock canonicalReference={canonicalReference} />
      <PropertySignatureTable
        showHeaders
        canonicalReference={canonicalReference}
        customOrder={customPropertyOrder}
        idPrefix={item.displayName.toLowerCase()}
      />
    </>
  );
}

InterfaceDetails.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  link: PropTypes.bool,
  customPropertyOrder: PropTypes.arrayOf(PropTypes.string),
};

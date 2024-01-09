import PropTypes from "prop-types";
import React from "react";
import { ApiDocHeading, DocBlock } from ".";

export function PropertyDetails({ canonicalReference, headingLevel }) {
  return (
    <>
      <ApiDocHeading
        canonicalReference={canonicalReference}
        headingLevel={headingLevel}
      />
      <DocBlock
        canonicalReference={canonicalReference}
        remark
        remarkCollapsible
        example
      />
    </>
  );
}

PropertyDetails.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  customParameterOrder: PropTypes.arrayOf(PropTypes.string),
};

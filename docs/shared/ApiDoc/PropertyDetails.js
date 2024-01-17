import PropTypes from "prop-types";
import React from "react";
import { ApiDocHeading, DocBlock } from ".";

export function PropertyDetails({ canonicalReference, headingLevel }) {
  return (
    <>
      <ApiDocHeading
        canonicalReference={canonicalReference}
        headingLevel={headingLevel}
        since
      />
      <DocBlock
        canonicalReference={canonicalReference}
        remark
        remarksCollapsible
        example
        deprecated
      />
    </>
  );
}

PropertyDetails.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
};

import PropTypes from "prop-types";
import React from "react";
import { ApiDocHeading, DocBlock, ParameterTable, useApiDocContext } from ".";

export function FunctionSignature({
  canonicalReference,
  parameterTypes = false,
  name = true,
  arrow = false,
}) {
  const getItem = useApiDocContext();
  const { displayName, parameters, returnType } = getItem(canonicalReference);

  return (
    <>
      {name ? displayName : ""}(
      {parameters
        .map((p) => {
          let pStr = p.name;
          if (p.optional) {
            pStr += "?";
          }
          if (parameterTypes) {
            pStr += ": " + p.type;
          }
          return pStr;
        })
        .join(", ")}
      ){arrow ? " =>" : ":"} {returnType}
    </>
  );
}

FunctionSignature.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  parameterTypes: PropTypes.bool,
  name: PropTypes.bool,
  arrow: PropTypes.bool,
};

export function FunctionDetails({
  canonicalReference,
  customParameterOrder,
  headingLevel,
}) {
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
      <ParameterTable
        canonicalReference={canonicalReference}
        customOrder={customParameterOrder}
      />
    </>
  );
}

FunctionDetails.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  customParameterOrder: PropTypes.arrayOf(PropTypes.string),
};

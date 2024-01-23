import PropTypes from "prop-types";
import React from "react";
import { useMDXComponents } from "@mdx-js/react";
import {
  ApiDocHeading,
  SubHeading,
  DocBlock,
  ParameterTable,
  useApiDocContext,
  PropertySignatureTable,
  SourceLink,
  Example,
  getInterfaceReference,
} from ".";
import { GridItem } from "@chakra-ui/react";
export function FunctionSignature({
  canonicalReference,
  parameterTypes = false,
  name = true,
  arrow = false,
  highlight = false,
}) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const { displayName, parameters, returnType } = getItem(canonicalReference);

  let paramSignature = parameters
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
    .join(",\n  ");

  if (paramSignature) {
    paramSignature = "\n  " + paramSignature + "\n";
  }

  const signature = `${arrow ? "" : "function "}${
    name ? displayName : ""
  }(${paramSignature})${arrow ? " =>" : ":"} ${returnType}`;

  return highlight ?
      <MDX.pre language="ts">
        <code className="language-ts">{signature}</code>
      </MDX.pre>
    : signature;
}

FunctionSignature.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  parameterTypes: PropTypes.bool,
  name: PropTypes.bool,
  arrow: PropTypes.bool,
  highlight: PropTypes.bool,
};

export function ReturnType({ canonicalReference }) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  const interfaceReference = getInterfaceReference(
    item.returnType,
    item,
    getItem
  );
  return (
    <>
      {item.comment?.returns}
      <MDX.pre language="ts">
        <code className="language-ts">{item.returnType}</code>
      </MDX.pre>
      {interfaceReference ?
        <details>
          <GridItem as="summary" className="row">
            Show/hide child attributes
          </GridItem>
          <PropertySignatureTable
            canonicalReference={interfaceReference.canonicalReference}
            idPrefix={`${item.displayName.toLowerCase()}-result`}
          />
        </details>
      : null}
    </>
  );
}
ReturnType.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
};

export function FunctionDetails({
  canonicalReference,
  customParameterOrder,
  headingLevel,
  result,
}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  return (
    <>
      <ApiDocHeading
        canonicalReference={canonicalReference}
        headingLevel={headingLevel}
        since
      />
      <DocBlock canonicalReference={canonicalReference} deprecated remarks />
      {item.comment?.examples.length == 0 ? null : (
        <>
          <SubHeading
            canonicalReference={canonicalReference}
            headingLevel={headingLevel + 1}
          >
            Example
          </SubHeading>
          <Example canonicalReference={canonicalReference} />
        </>
      )}
      <SubHeading
        canonicalReference={canonicalReference}
        headingLevel={headingLevel + 1}
      >
        Signature
      </SubHeading>
      <FunctionSignature
        canonicalReference={canonicalReference}
        parameterTypes
        highlight
      />
      <SourceLink canonicalReference={canonicalReference} />
      {item.parameters.length == 0 ? null : (
        <>
          <SubHeading
            canonicalReference={canonicalReference}
            headingLevel={headingLevel + 1}
          >
            Parameters
          </SubHeading>
          <ParameterTable
            canonicalReference={canonicalReference}
            customOrder={customParameterOrder}
          />
        </>
      )}
      {(
        result === false || (result === undefined && item.returnType === "void")
      ) ?
        null
      : <>
          <SubHeading
            canonicalReference={canonicalReference}
            headingLevel={headingLevel + 1}
          >
            Result
          </SubHeading>
          {result || <ReturnType canonicalReference={canonicalReference} />}
        </>}
    </>
  );
}

FunctionDetails.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  customParameterOrder: PropTypes.arrayOf(PropTypes.string),
  result: PropTypes.oneOfType([PropTypes.bool, PropTypes.node]),
};

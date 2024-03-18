import { useMDXComponents } from "@mdx-js/react";

import PropTypes from "prop-types";
import React, { useMemo } from "react";
import {
  DocBlock,
  FunctionSignature,
  useApiDocContext,
  ApiDocHeading,
} from ".";
import { GridItem, Text } from "@chakra-ui/react";
import { ResponsiveGrid } from "./ResponsiveGrid";
import { groupItems } from "./sortWithCustomOrder";

export function PropertySignatureTable({
  canonicalReference,
  prefix = "",
  showHeaders = false,
  display = "parent",
  customOrder = [],
  idPrefix = "",
  genericNames,
}) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  const Wrapper = display === "parent" ? ResponsiveGrid : React.Fragment;
  const groupedProperties = useMemo(
    () => groupItems(item.properties.map(getItem), customOrder),
    [item.properties, getItem, customOrder]
  );
  if (item.childrenIncomplete) {
    console.warn(
      "Warning: some properties might be missing from the table due to complex inheritance!",
      item.childrenIncompleteDetails
    );
  }

  const replaceGenericNames = React.useMemo(() => {
    if (!genericNames) return (str) => str;

    const replacements = {};
    item.typeParameters.forEach((p, i) => {
      if (genericNames[i] === p.name) return;
      replacements[p.name] = genericNames[i];
    });
    if (!Object.values(replacements).length) return (str) => str;

    const genericReplacementRegex = new RegExp(
      `\\b(${Object.keys(replacements).join("|")})\\b`,
      "g"
    );
    function replace(match) {
      return replacements[match] || match;
    }
    return function replaceGenericNames(str) {
      return str.replace(genericReplacementRegex, replace);
    };
  });

  return (
    <>
      {item.childrenIncomplete ?
        <GridItem className="row">
          <br />
          (Warning: some properties might be missing from the table due to
          complex inheritance!)
        </GridItem>
      : null}

      <Wrapper>
        {showHeaders ?
          <>
            <GridItem className="first cell heading">Name / Type</GridItem>
            <GridItem className="cell heading">Description</GridItem>
          </>
        : null}
        {Object.entries(groupedProperties).map(
          ([groupName, sortedProperties]) => (
            <React.Fragment key={groupName}>
              {groupName ?
                <GridItem className="row heading">{groupName}</GridItem>
              : null}
              {sortedProperties.map((property) => (
                <React.Fragment key={property.id}>
                  <GridItem
                    className="first cell"
                    fontSize="md"
                    sx={{ code: { bg: "none", p: 0 } }}
                  >
                    <ApiDocHeading
                      canonicalReference={property.canonicalReference}
                      fontSize="lg"
                      as={Text}
                      since
                      prefix={
                        prefix ?
                          <MDX.inlineCode color="gray.400">
                            {prefix}
                          </MDX.inlineCode>
                        : null
                      }
                      suffix={property.optional ? <em> (optional)</em> : null}
                      id={
                        idPrefix ?
                          `${idPrefix}-${property.displayName.toLowerCase()}`
                        : undefined
                      }
                    />
                    <MDX.inlineCode color="tertiary">
                      {property.kind === "MethodSignature" ?
                        <FunctionSignature
                          canonicalReference={property.canonicalReference}
                          name={false}
                          parameterTypes
                          arrow
                        />
                      : replaceGenericNames(property.type)}
                    </MDX.inlineCode>
                  </GridItem>
                  <GridItem className="cell" fontSize="md" lineHeight="base">
                    <DocBlock
                      canonicalReference={property.canonicalReference}
                      deprecated
                      summary
                      remarks
                      remarkCollapsible
                      releaseTag
                    />
                  </GridItem>
                </React.Fragment>
              ))}
            </React.Fragment>
          )
        )}
      </Wrapper>
    </>
  );
}

PropertySignatureTable.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  idPrefix: PropTypes.string.isRequired,
  prefix: PropTypes.string,
  showHeaders: PropTypes.bool,
  display: PropTypes.oneOf(["parent", "child"]),
  customOrder: PropTypes.arrayOf(PropTypes.string),
  genericNames: PropTypes.arrayOf(PropTypes.string),
};

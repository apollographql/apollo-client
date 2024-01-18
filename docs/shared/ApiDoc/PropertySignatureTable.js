import { useMDXComponents } from "@mdx-js/react";

import PropTypes from "prop-types";
import React, { useMemo } from "react";
import { DocBlock, FunctionSignature, useApiDocContext } from ".";
import { GridItem, Text, chakra } from "@chakra-ui/react";
import { ResponsiveGrid } from "./ResponsiveGrid";

export function PropertySignatureTable({
  canonicalReference,
  prefix = "",
  showHeaders = true,
  display = "parent",
  customOrder = [],
}) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const Wrapper = display === "parent" ? ResponsiveGrid : React.Fragment;

  const sortedProperties = useMemo(
    () =>
      item.properties.map(getItem).sort((a, b) => {
        const aIndex = customOrder.indexOf(a.displayName);
        const bIndex = customOrder.indexOf(b.displayName);
        if (aIndex >= 0 && bIndex >= 0) {
          return aIndex - bIndex;
        } else if (aIndex >= 0) {
          return -1;
        } else if (bIndex >= 0) {
          return 1;
        } else {
          return a.displayName.localeCompare(b.displayName);
        }
      }),
    [item.properties, getItem, customOrder]
  );

  return (
    <>
      {showHeaders ?
        <GridItem className="row">
          <chakra.h6
            className="fullWidth"
            mb="4"
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="sm"
            letterSpacing="wider"
          >
            Properties
          </chakra.h6>
        </GridItem>
      : null}
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

        {sortedProperties.map((property) => (
          <React.Fragment key={property.id}>
            <GridItem
              className="first cell"
              fontSize="md"
              sx={{ code: { bg: "none", p: 0 } }}
            >
              <chakra.h6 fontSize="lg" mb="1" mr="1">
                <MDX.inlineCode>
                  <Text color="gray.400" as="span">
                    {prefix}
                  </Text>
                  {property.displayName}
                </MDX.inlineCode>
                {property.optional ?
                  <em> (optional)</em>
                : null}
              </chakra.h6>
              <MDX.inlineCode color="tertiary">
                {property.kind === "MethodSignature" ?
                  <FunctionSignature
                    canonicalReference={property.canonicalReference}
                    name={false}
                    parameterTypes
                    arrow
                  />
                : property.type}
              </MDX.inlineCode>
            </GridItem>
            <GridItem className="cell" fontSize="md" lineHeight="base">
              <DocBlock canonicalReference={property.canonicalReference} />
            </GridItem>
          </React.Fragment>
        ))}
      </Wrapper>
    </>
  );
}

PropertySignatureTable.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  prefix: PropTypes.string,
  showHeaders: PropTypes.bool,
  display: PropTypes.oneOf(["parent", "child"]),
  customOrder: PropTypes.arrayOf(PropTypes.string),
};

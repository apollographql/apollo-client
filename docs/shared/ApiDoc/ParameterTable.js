import { useMDXComponents } from "@mdx-js/react";

import PropTypes from "prop-types";
import React from "react";
import { GridItem, Text } from "@chakra-ui/react";
import { PropertySignatureTable, useApiDocContext } from ".";
import { ResponsiveGrid } from "./ResponsiveGrid";

export function ParameterTable({ canonicalReference }) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  if (item.parameters.length === 0) return null;

  return (
    <>
      <ResponsiveGrid>
        <GridItem className="first cell heading">Name / Type</GridItem>
        <GridItem className="cell heading">Description</GridItem>

        {item.parameters.map((parameter) => {
          const interfaceReference =
            parameter.primaryCanonicalReference?.endsWith(":interface") ?
              parameter.primaryCanonicalReference
            : undefined;
          const id = `${item.displayName.toLowerCase()}-parameters-${parameter.name.toLowerCase()}`;

          return (
            <React.Fragment key={id}>
              <GridItem
                className="first cell"
                fontSize="md"
                sx={{ code: { bg: "none", p: 0 } }}
                borderBottom={interfaceReference ? "none" : undefined}
              >
                <MDX.PrimaryLink href={`#${id}`} id={id}>
                  <Text fontSize="lg" mb="1">
                    <MDX.inlineCode>{parameter.name}</MDX.inlineCode>
                    {parameter.optional ?
                      <em> (optional)</em>
                    : null}
                  </Text>
                </MDX.PrimaryLink>
                <MDX.inlineCode color="tertiary">
                  {parameter.type}
                </MDX.inlineCode>
              </GridItem>
              <GridItem
                className="cell"
                fontSize="md"
                lineHeight="base"
                borderBottom={interfaceReference ? "none" : undefined}
              >
                {parameter.comment && (
                  <MDX.MDXRenderer>{parameter.comment}</MDX.MDXRenderer>
                )}
              </GridItem>
              {interfaceReference && (
                <details>
                  <GridItem as="summary" className="row">
                    Show/hide child attributes
                  </GridItem>
                  <PropertySignatureTable
                    canonicalReference={interfaceReference}
                    genericNames={parameter.primaryGenericArguments}
                    display="child"
                    idPrefix={id}
                  />
                </details>
              )}
            </React.Fragment>
          );
        })}
      </ResponsiveGrid>
    </>
  );
}

ParameterTable.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  showHeaders: PropTypes.bool,
};

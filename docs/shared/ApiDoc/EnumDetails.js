import { useMDXComponents } from "@mdx-js/react";

import PropTypes from "prop-types";
import React, { useMemo } from "react";
import { DocBlock, useApiDocContext, ApiDocHeading, SectionHeading } from ".";
import { GridItem, Text } from "@chakra-ui/react";
import { ResponsiveGrid } from "./ResponsiveGrid";
import { sortWithCustomOrder } from "./sortWithCustomOrder";

export function EnumDetails({
  canonicalReference,
  headingLevel,
  customOrder = [],
}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  const sortedMembers = useMemo(
    () => item.members.map(getItem).sort(sortWithCustomOrder(customOrder)),
    [item.members, getItem, customOrder]
  );

  return (
    <>
      <ApiDocHeading
        canonicalReference={canonicalReference}
        headingLevel={headingLevel}
      />
      <DocBlock canonicalReference={canonicalReference} />

      <GridItem className="row">
        <SectionHeading>Enumeration Members</SectionHeading>
      </GridItem>

      <ResponsiveGrid columns="1fr">
        {sortedMembers.map((member) => (
          <GridItem
            className="cell"
            fontSize="md"
            sx={{ code: { bg: "none", p: 0 } }}
            key={member.id}
          >
            <ApiDocHeading
              canonicalReference={member.canonicalReference}
              fontSize="lg"
              mb="1"
              mr="1"
              as={Text}
              since
              id={`${item.displayName.toLowerCase()}-member-${member.displayName.toLowerCase()}`}
            />
            <DocBlock
              canonicalReference={member.canonicalReference}
              summary
              remarks
              remarksCollapsible
              example
              deprecated
            />
          </GridItem>
        ))}
      </ResponsiveGrid>
    </>
  );
}

EnumDetails.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  customOrder: PropTypes.arrayOf(PropTypes.string),
};

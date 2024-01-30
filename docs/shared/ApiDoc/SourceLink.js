import { useMDXComponents } from "@mdx-js/react";
import PropTypes from "prop-types";
import React from "react";
import { Text } from "@chakra-ui/react";
import { useApiDocContext } from "./Context";

export function SourceLink({ canonicalReference }) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  return item.file ?
      <Text fontWeight="normal" size="sm">
        <MDX.PrimaryLink
          href={`https://github.com/apollographql/apollo-client/blob/main/${item.file}`}
          isExternal
        >
          ({item.file})
        </MDX.PrimaryLink>
      </Text>
    : null;
}
SourceLink.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
};

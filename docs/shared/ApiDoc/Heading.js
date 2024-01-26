import { useMDXComponents } from "@mdx-js/react";
import PropTypes from "prop-types";
import React from "react";
import { Box, Heading } from "@chakra-ui/react";
import { FunctionSignature } from ".";
import { useApiDocContext } from "./Context";

const levels = {
  2: "xl",
  3: "lg",
  4: "md",
  5: "sm",
  6: "xs",
};

export function ApiDocHeading({
  canonicalReference,
  headingLevel,
  link = true,
}) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const heading =
    (
      item.kind === "MethodSignature" ||
      item.kind === "Function" ||
      item.kind === "Method"
    ) ?
      <FunctionSignature
        canonicalReference={canonicalReference}
        parameterTypes={false}
      />
    : item.displayName;
  return (
    <Box pt="4">
      <Heading
        as={`h${headingLevel}`}
        size={levels[String(headingLevel)]}
        fontFamily="mono"
        title={item.displayName}
        id={item.displayName}
      >
        {link ?
          <MDX.PrimaryLink href={`#${item.displayName}`}>
            {heading}
          </MDX.PrimaryLink>
        : heading}
      </Heading>
      {item.file && (
        <Heading as="h6" fontWeight="normal" size="sm" mt="2">
          <MDX.PrimaryLink
            href={`https://github.com/apollographql/apollo-client/blob/main/${item.file}`}
            isExternal
          >
            ({item.file})
          </MDX.PrimaryLink>
        </Heading>
      )}
    </Box>
  );
}
ApiDocHeading.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  link: PropTypes.bool,
};

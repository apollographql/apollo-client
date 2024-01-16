import { useMDXComponents } from "@mdx-js/react";
import PropTypes from "prop-types";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { FunctionSignature } from ".";
import { useApiDocContext } from "./Context";

export function Heading({ headingLevel, link, children, ...props }) {
  const MDX = useMDXComponents();
  let heading = children;

  if (link) {
    heading = (
      <MDX.PrimaryLink href={`#${props.id}`}>{heading}</MDX.PrimaryLink>
    );
  }
  const Tag = MDX[`h${headingLevel}`];

  return <Tag {...props}>{heading}</Tag>;
}
Heading.propTypes = {
  headingLevel: PropTypes.number.isRequired,
  link: PropTypes.bool,
  children: PropTypes.node.isRequired,
  id: PropTypes.string,
};

export function SubHeading({ canonicalReference, ...props }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  return (
    <Heading
      id={
        props.id ||
        `${item.displayName}-${props.title || props.children}`.toLowerCase()
      }
      {...props}
    />
  );
}
SubHeading.propTypes = {
  ...Heading.propTypes,
  canonicalReference: PropTypes.string.isRequired,
};

export function ApiDocHeading({
  canonicalReference,
  headingLevel,
  link = false,
  signature = false,
  since = false,
}) {
  const MDX = useMDXComponents();
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  let heading =
    (
      signature &&
      (item.kind === "MethodSignature" ||
        item.kind === "Function" ||
        item.kind === "Method")
    ) ?
      <FunctionSignature
        canonicalReference={canonicalReference}
        parameterTypes={false}
      />
    : <MDX.inlineCode>{item.displayName}</MDX.inlineCode>;

  heading = (
    <Heading
      headingLevel={headingLevel}
      title={item.displayName}
      id={item.displayName.toLowerCase()}
      link={link}
      minVersion={since && item.comment?.since ? item.comment.since : undefined}
    >
      {heading}
    </Heading>
  );

  return <Box pt="4">{heading}</Box>;
}
ApiDocHeading.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number.isRequired,
  link: PropTypes.bool,
  signature: PropTypes.bool,
  since: PropTypes.bool,
};

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

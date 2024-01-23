import { useMDXComponents } from "@mdx-js/react";
import PropTypes from "prop-types";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { FunctionSignature } from ".";
import { useApiDocContext } from "./Context";

export function Heading({
  headingLevel,
  link,
  children,
  as,
  minVersion,
  ...props
}) {
  const MDX = useMDXComponents();
  let heading = children;

  if (link) {
    heading = (
      <MDX.PrimaryLink href={`#${props.id}`}>{heading}</MDX.PrimaryLink>
    );
  }
  if (as != undefined && headingLevel != undefined) {
    throw new Error(
      "Heading: Cannot specify both `as` and `headingLevel` at the same time."
    );
  }
  const Tag = as ? as : MDX[`h${headingLevel}`];

  return (
    <Tag {...props}>
      {heading}
      {minVersion ?
        <MDX.MinVersionTag minVersion={minVersion} />
      : null}
    </Tag>
  );
}
Heading.propTypes = {
  headingLevel: PropTypes.number,
  link: PropTypes.bool,
  children: PropTypes.node.isRequired,
  id: PropTypes.string,
  as: PropTypes.any,
  minVersion: PropTypes.string,
};

export function SubHeading({
  canonicalReference,
  headingLevel,
  link = typeof headingLevel === "number" && headingLevel <= 4,
  ...props
}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);

  return (
    <Heading
      id={
        link ?
          `${item.displayName}-${props.title || props.children}`.toLowerCase()
        : undefined
      }
      link={link}
      headingLevel={headingLevel}
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
  link = typeof headingLevel === "number" && headingLevel <= 4,
  signature = false,
  since = false,
  prefix = "",
  suffix = "",
  ...props
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

  return (
    <Box pt={typeof headingLevel === "number" && headingLevel <= 4 ? 4 : 0}>
      <Heading
        headingLevel={headingLevel}
        id={link ? item.displayName.toLowerCase() : undefined}
        link={link}
        minVersion={
          since && item.comment?.since ? item.comment.since : undefined
        }
        {...props}
      >
        {prefix}
        {heading}
        {suffix}
      </Heading>
    </Box>
  );
}
ApiDocHeading.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  headingLevel: PropTypes.number,
  link: PropTypes.bool,
  signature: PropTypes.bool,
  since: PropTypes.bool,
  prefix: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  suffix: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
};

export function SectionHeading(props) {
  return (
    <Text
      className="fullWidth"
      mb="4"
      fontWeight="bold"
      textTransform="uppercase"
      fontSize="sm"
      letterSpacing="wider"
      {...props}
    />
  );
}
SectionHeading.propTypes = Text.propTypes;

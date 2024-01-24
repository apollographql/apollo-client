import PropTypes from "prop-types";
import React from "react";
import { Stack } from "@chakra-ui/react";
import { useApiDocContext } from ".";
import { useMDXComponents } from "@mdx-js/react";

export function DocBlock({
  canonicalReference,
  summary = true,
  remarks = false,
  example = false,
  remarksCollapsible = false,
  deprecated = false,
}) {
  return (
    <Stack spacing="4">
      {deprecated && <Deprecated canonicalReference={canonicalReference} />}
      {summary && <Summary canonicalReference={canonicalReference} />}
      {remarks && (
        <Remarks
          collapsible={remarksCollapsible}
          canonicalReference={canonicalReference}
        />
      )}
      {example && <Example canonicalReference={canonicalReference} />}
    </Stack>
  );
}

DocBlock.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  summary: PropTypes.bool,
  remarks: PropTypes.bool,
  example: PropTypes.bool,
  remarksCollapsible: PropTypes.bool,
  deprecated: PropTypes.bool,
};

function MaybeCollapsible({ collapsible, children }) {
  return (
    collapsible ?
      children ?
        <details>
          <summary>Read more...</summary>
          {children}
        </details>
      : null
    : children
  );
}
MaybeCollapsible.propTypes = {
  collapsible: PropTypes.bool,
  children: PropTypes.node,
};

export function Deprecated({ canonicalReference, collapsible = false }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const MDX = useMDXComponents();
  const value = item.comment?.deprecated;
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      <MDX.blockquote>
        <p>⚠️ Deprecated</p>
        <MDX.MDXRenderer>{value}</MDX.MDXRenderer>
      </MDX.blockquote>
    </MaybeCollapsible>
  );
}
Deprecated.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
};

export function Summary({ canonicalReference, collapsible = false }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const MDX = useMDXComponents();
  const value = item.comment?.summary;
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      {value && <MDX.MDXRenderer>{value}</MDX.MDXRenderer>}
    </MaybeCollapsible>
  );
}
Summary.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
};

export function Remarks({ canonicalReference, collapsible = false }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const MDX = useMDXComponents();
  const value = item.comment?.remarks?.replace(/^@remarks/g, "");
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      {value && <MDX.MDXRenderer>{value}</MDX.MDXRenderer>}
    </MaybeCollapsible>
  );
}
Remarks.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
};

export function Example({
  canonicalReference,
  collapsible = false,
  index = 0,
}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const MDX = useMDXComponents();
  const value = item.comment?.examples[index];
  if (!value) return null;
  return (
    <>
      <MaybeCollapsible collapsible={collapsible}>
        {value && <MDX.MDXRenderer>{value}</MDX.MDXRenderer>}
      </MaybeCollapsible>
    </>
  );
}
Example.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
  index: PropTypes.number,
};

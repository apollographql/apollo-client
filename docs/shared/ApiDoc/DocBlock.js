import PropTypes from "prop-types";
import React from "react";
import { Stack } from "@chakra-ui/react";
import { mdToReact } from "./mdToReact";
import { useApiDocContext } from ".";

export function DocBlock({
  canonicalReference,
  summary = true,
  remarks = false,
  example = false,
  remarkCollapsible = true,
  since = true,
  deprecated = true,
}) {
  return (
    <Stack spacing="4">
      {/** TODO: @since, @deprecated etc. */}
      {deprecated && <Deprecated canonicalReference={canonicalReference} />}
      {since && <Since canonicalReference={canonicalReference} />}
      {summary && <Summary canonicalReference={canonicalReference} />}
      {remarks && (
        <Remarks
          collapsible={remarkCollapsible}
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
  remarkCollapsible: PropTypes.bool,
  since: PropTypes.bool,
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

/**
 * Might still need more work on the Gatsby side to get this to work.
 */
export function Deprecated({ canonicalReference, collapsible = false }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const value = item.comment?.deprecated;
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      <b>{mdToReact(value)}</b>
    </MaybeCollapsible>
  );
}
Deprecated.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
};

/**
 * Might still need more work on the Gatsby side to get this to work.
 */
export function Since({ canonicalReference, collapsible = false }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const value = item.comment?.since;
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      <i>Added to Apollo Client in version {value}</i>
    </MaybeCollapsible>
  );
}
Since.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
};

export function Summary({ canonicalReference, collapsible = false }) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  const value = item.comment?.summary;
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      {mdToReact(value)}
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
  const value = item.comment?.remarks?.replace(/^@remarks/g, "");
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      {mdToReact(value)}
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
  const value = item.comment?.examples[index];
  if (!value) return null;
  return (
    <MaybeCollapsible collapsible={collapsible}>
      <b>{mdToReact(value)}</b>
    </MaybeCollapsible>
  );
}
Example.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
  index: PropTypes.number,
};

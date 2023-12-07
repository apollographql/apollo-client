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
      {deprecated && (
        <DocPiece deprecated canonicalReference={canonicalReference} />
      )}
      {since && <DocPiece since canonicalReference={canonicalReference} />}
      {summary && <DocPiece summary canonicalReference={canonicalReference} />}
      {remarks && (
        <DocPiece
          remarks
          collapsible={remarkCollapsible}
          canonicalReference={canonicalReference}
        />
      )}
      {example && <DocPiece example canonicalReference={canonicalReference} />}
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

export function DocPiece({
  canonicalReference,
  summary = false,
  remarks = false,
  example = false,
  since = false,
  deprecated = false,
  collapsible = false,
}) {
  const getItem = useApiDocContext();
  const item = getItem(canonicalReference);
  let jsx = null;

  switch (true) {
    case deprecated: {
      const value = item.comment?.deprecated;
      jsx = value ? <b>{mdToReact(value)}</b> : null;
      break;
    }
    case since: {
      const value = item.comment?.since;
      jsx =
        value /* TODO schema */ ?
          <i>Added to Apollo Client in version {value}</i>
        : null;
      break;
    }
    case summary: {
      const value = item.comment?.summary;
      jsx = value ? mdToReact(value) : null;
      break;
    }
    case remarks: {
      const value = item.comment?.remarks?.replace(/^@remarks/g, "");
      jsx = value ? mdToReact(value) : null;
      break;
    }
    case example !== false: {
      // special case: `example`: 0 references the first example, so we can't check for a truthy value
      // `true` will be interpreted as `0` here
      const value =
        item.comment?.examples[Number.isInteger(example) ? example : 0];
      jsx = value ? <b>{mdToReact(value)}</b> : null;
      break;
    }
    default:
      throw new Error(
        "You need to call `DocPiece` with  one of the following props:" +
          "`summary`, `remarks`, `example`, `since`, `deprecated`"
      );
  }
  return (
    collapsible ?
      jsx ?
        <details>
          <summary>Read more...</summary>
          {jsx}
        </details>
      : null
    : jsx
  );
}
DocPiece.propTypes = {
  canonicalReference: PropTypes.string.isRequired,
  collapsible: PropTypes.bool,
  summary: PropTypes.bool,
  remarks: PropTypes.bool,
  example: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  since: PropTypes.bool,
  deprecated: PropTypes.bool,
};

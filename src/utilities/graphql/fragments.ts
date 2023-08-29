import { invariant, newInvariantError } from "../globals/index.js";

import type {
  DocumentNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionNode,
} from "graphql";

// TODO(brian): A hack until this issue is resolved (https://github.com/graphql/graphql-js/issues/3356)
type Kind = any;
type OperationTypeNode = any;
/**
 * Returns a query document which adds a single query operation that only
 * spreads the target fragment inside of it.
 *
 * So for example a document of:
 *
 * ```graphql
 * fragment foo on Foo { a b c }
 * ```
 *
 * Turns into:
 *
 * ```graphql
 * { ...foo }
 *
 * fragment foo on Foo { a b c }
 * ```
 *
 * The target fragment will either be the only fragment in the document, or a
 * fragment specified by the provided `fragmentName`. If there is more than one
 * fragment, but a `fragmentName` was not defined then an error will be thrown.
 */
export function getFragmentQueryDocument(
  document: DocumentNode,
  fragmentName?: string
): DocumentNode {
  let actualFragmentName = fragmentName;

  // Build an array of all our fragment definitions that will be used for
  // validations. We also do some validations on the other definitions in the
  // document while building this list.
  const fragments: Array<FragmentDefinitionNode> = [];
  document.definitions.forEach((definition) => {
    // Throw an error if we encounter an operation definition because we will
    // define our own operation definition later on.
    if (definition.kind === "OperationDefinition") {
      throw newInvariantError(
        `Found a %s operation%s. ` +
          "No operations are allowed when using a fragment as a query. Only fragments are allowed.",
        definition.operation,
        definition.name ? ` named '${definition.name.value}'` : ""
      );
    }
    // Add our definition to the fragments array if it is a fragment
    // definition.
    if (definition.kind === "FragmentDefinition") {
      fragments.push(definition);
    }
  });

  // If the user did not give us a fragment name then let us try to get a
  // name from a single fragment in the definition.
  if (typeof actualFragmentName === "undefined") {
    invariant(
      fragments.length === 1,
      `Found %s fragments. \`fragmentName\` must be provided when there is not exactly 1 fragment.`,
      fragments.length
    );
    actualFragmentName = fragments[0].name.value;
  }

  // Generate a query document with an operation that simply spreads the
  // fragment inside of it.
  const query: DocumentNode = {
    ...document,
    definitions: [
      {
        kind: "OperationDefinition" as Kind,
        // OperationTypeNode is an enum
        operation: "query" as OperationTypeNode,
        selectionSet: {
          kind: "SelectionSet" as Kind,
          selections: [
            {
              kind: "FragmentSpread" as Kind,
              name: {
                kind: "Name" as Kind,
                value: actualFragmentName,
              },
            },
          ],
        },
      },
      ...document.definitions,
    ],
  };

  return query;
}

/**
 * This is an interface that describes a map from fragment names to fragment definitions.
 */
export interface FragmentMap {
  [fragmentName: string]: FragmentDefinitionNode;
}

export type FragmentMapFunction = (
  fragmentName: string
) => FragmentDefinitionNode | null;

// Utility function that takes a list of fragment definitions and makes a hash out of them
// that maps the name of the fragment to the fragment definition.
export function createFragmentMap(
  fragments: FragmentDefinitionNode[] = []
): FragmentMap {
  const symTable: FragmentMap = {};
  fragments.forEach((fragment) => {
    symTable[fragment.name.value] = fragment;
  });
  return symTable;
}

export function getFragmentFromSelection(
  selection: SelectionNode,
  fragmentMap?: FragmentMap | FragmentMapFunction
): InlineFragmentNode | FragmentDefinitionNode | null {
  switch (selection.kind) {
    case "InlineFragment":
      return selection;
    case "FragmentSpread": {
      const fragmentName = selection.name.value;
      if (typeof fragmentMap === "function") {
        return fragmentMap(fragmentName);
      }
      const fragment = fragmentMap && fragmentMap[fragmentName];
      invariant(fragment, `No fragment named %s`, fragmentName);
      return fragment || null;
    }
    default:
      return null;
  }
}

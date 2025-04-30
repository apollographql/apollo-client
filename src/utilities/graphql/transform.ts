import type {
  ArgumentNode,
  ASTNode,
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  VariableDefinitionNode,
} from "graphql";
import { Kind, visit } from "graphql";

import { isField } from "./storeUtils.js";

type RemoveNodeConfig<N> = {
  name?: string;
  test?: (node: N) => boolean;
  remove?: boolean;
};

export type GetNodeConfig<N> = {
  name?: string;
  test?: (node: N) => boolean;
};

export type RemoveDirectiveConfig = RemoveNodeConfig<DirectiveNode>;
export type GetDirectiveConfig = GetNodeConfig<DirectiveNode>;
export type RemoveArgumentsConfig = RemoveNodeConfig<ArgumentNode>;
export type GetFragmentSpreadConfig = GetNodeConfig<FragmentSpreadNode>;
export type RemoveFragmentDefinitionConfig =
  RemoveNodeConfig<FragmentDefinitionNode>;
export type RemoveVariableDefinitionConfig =
  RemoveNodeConfig<VariableDefinitionNode>;

const TYPENAME_FIELD: FieldNode = {
  kind: Kind.FIELD,
  name: {
    kind: Kind.NAME,
    value: "__typename",
  },
};

function getDirectiveMatcher(
  configs: (RemoveDirectiveConfig | GetDirectiveConfig)[]
) {
  const names = new Map<string, RemoveDirectiveConfig | GetDirectiveConfig>();

  const tests = new Map<
    (directive: DirectiveNode) => boolean,
    RemoveDirectiveConfig | GetDirectiveConfig
  >();

  configs.forEach((directive) => {
    if (directive) {
      if (directive.name) {
        names.set(directive.name, directive);
      } else if (directive.test) {
        tests.set(directive.test, directive);
      }
    }
  });

  return (directive: DirectiveNode) => {
    let config = names.get(directive.name.value);
    if (!config && tests.size) {
      tests.forEach((testConfig, test) => {
        if (test(directive)) {
          config = testConfig;
        }
      });
    }
    return config;
  };
}

export const addTypenameToDocument = Object.assign(
  function <TNode extends ASTNode>(doc: TNode): TNode {
    return visit(doc, {
      SelectionSet: {
        enter(node, _key, parent) {
          // Don't add __typename to OperationDefinitions.
          if (
            parent &&
            (parent as OperationDefinitionNode).kind ===
              Kind.OPERATION_DEFINITION
          ) {
            return;
          }

          // No changes if no selections.
          const { selections } = node;
          if (!selections) {
            return;
          }

          // If selections already have a __typename, or are part of an
          // introspection query, do nothing.
          const skip = selections.some((selection) => {
            return (
              isField(selection) &&
              (selection.name.value === "__typename" ||
                selection.name.value.lastIndexOf("__", 0) === 0)
            );
          });
          if (skip) {
            return;
          }

          // If this SelectionSet is @export-ed as an input variable, it should
          // not have a __typename field (see issue #4691).
          const field = parent as FieldNode;
          if (
            isField(field) &&
            field.directives &&
            field.directives.some((d) => d.name.value === "export")
          ) {
            return;
          }

          // Create and return a new SelectionSet with a __typename Field.
          return {
            ...node,
            selections: [...selections, TYPENAME_FIELD],
          };
        },
      },
    });
  },
  {
    added(field: FieldNode): boolean {
      return field === TYPENAME_FIELD;
    },
  }
);

function hasDirectivesInSelectionSet(
  directives: GetDirectiveConfig[],
  selectionSet: SelectionSetNode | undefined,
  nestedCheck = true
): boolean {
  return (
    !!selectionSet &&
    selectionSet.selections &&
    selectionSet.selections.some((selection) =>
      hasDirectivesInSelection(directives, selection, nestedCheck)
    )
  );
}

function hasDirectivesInSelection(
  directives: GetDirectiveConfig[],
  selection: SelectionNode,
  nestedCheck = true
): boolean {
  if (!isField(selection)) {
    return true;
  }

  if (!selection.directives) {
    return false;
  }

  return (
    selection.directives.some(getDirectiveMatcher(directives)) ||
    (nestedCheck &&
      hasDirectivesInSelectionSet(
        directives,
        selection.selectionSet,
        nestedCheck
      ))
  );
}

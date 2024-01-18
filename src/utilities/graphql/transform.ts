import { invariant } from "../globals/index.js";

import type {
  DocumentNode,
  SelectionNode,
  SelectionSetNode,
  OperationDefinitionNode,
  FieldNode,
  DirectiveNode,
  FragmentDefinitionNode,
  ArgumentNode,
  FragmentSpreadNode,
  VariableDefinitionNode,
  ASTNode,
  ASTVisitFn,
  InlineFragmentNode,
} from "graphql";
import { visit, Kind } from "graphql";

import {
  checkDocument,
  getOperationDefinition,
  getFragmentDefinition,
  getFragmentDefinitions,
  getMainDefinition,
} from "./getFromAST.js";
import { isField } from "./storeUtils.js";
import type { FragmentMap } from "./fragments.js";
import { createFragmentMap } from "./fragments.js";
import { isArray, isNonEmptyArray } from "../common/arrays.js";

// https://github.com/graphql/graphql-js/blob/8d7c8fccf5a9846a50785de04abda58a7eb13fc0/src/language/visitor.ts#L20-L23
interface EnterLeaveVisitor<TVisitedNode extends ASTNode> {
  readonly enter?: ASTVisitFn<TVisitedNode>;
  readonly leave?: ASTVisitFn<TVisitedNode>;
}

export type RemoveNodeConfig<N> = {
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
export type RemoveFragmentSpreadConfig = RemoveNodeConfig<FragmentSpreadNode>;
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

function isEmpty(
  op: OperationDefinitionNode | FragmentDefinitionNode,
  fragmentMap: FragmentMap
): boolean {
  return (
    !op ||
    op.selectionSet.selections.every(
      (selection) =>
        selection.kind === Kind.FRAGMENT_SPREAD &&
        isEmpty(fragmentMap[selection.name.value], fragmentMap)
    )
  );
}

function nullIfDocIsEmpty(doc: DocumentNode) {
  return (
      isEmpty(
        getOperationDefinition(doc) || getFragmentDefinition(doc),
        createFragmentMap(getFragmentDefinitions(doc))
      )
    ) ?
      null
    : doc;
}

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

// Helper interface and function used by removeDirectivesFromDocument to keep
// track of variable references and fragments spreads found within a given
// operation or fragment definition.
interface InternalInUseInfo {
  variables: Set<string>;
  fragmentSpreads: Set<string>;
  // Set to true when we deliberately remove a fragment definition, so we can
  // make sure also to remove dangling ...spreads that refer to it.
  removed?: boolean;
  // Populated by the populateTransitiveVars helper function below.
  transitiveVars?: Set<string>;
}
function makeInUseGetterFunction<TKey>(defaultKey: TKey) {
  const map = new Map<TKey, InternalInUseInfo>();

  return function inUseGetterFunction(
    key: TKey = defaultKey
  ): InternalInUseInfo {
    let inUse = map.get(key);
    if (!inUse) {
      map.set(
        key,
        (inUse = {
          // Variable and fragment spread names used directly within this
          // operation or fragment definition, as identified by key. These sets
          // will be populated during the first traversal of the document in
          // removeDirectivesFromDocument below.
          variables: new Set(),
          fragmentSpreads: new Set(),
        })
      );
    }
    return inUse;
  };
}

export function removeDirectivesFromDocument(
  directives: RemoveDirectiveConfig[],
  doc: DocumentNode
): DocumentNode | null {
  checkDocument(doc);

  // Passing empty strings to makeInUseGetterFunction means we handle anonymous
  // operations as if their names were "". Anonymous fragment definitions are
  // not supposed to be possible, but the same default naming strategy seems
  // appropriate for that case as well.
  const getInUseByOperationName = makeInUseGetterFunction<string>("");
  const getInUseByFragmentName = makeInUseGetterFunction<string>("");
  const getInUse = (
    ancestors: readonly (ASTNode | readonly ASTNode[])[]
  ): InternalInUseInfo | null => {
    for (
      let p = 0, ancestor: ASTNode | readonly ASTNode[];
      p < ancestors.length && (ancestor = ancestors[p]);
      ++p
    ) {
      if (isArray(ancestor)) continue;
      if (ancestor.kind === Kind.OPERATION_DEFINITION) {
        // If an operation is anonymous, we use the empty string as its key.
        return getInUseByOperationName(ancestor.name && ancestor.name.value);
      }
      if (ancestor.kind === Kind.FRAGMENT_DEFINITION) {
        return getInUseByFragmentName(ancestor.name.value);
      }
    }
    invariant.error(`Could not find operation or fragment`);
    return null;
  };

  let operationCount = 0;
  for (let i = doc.definitions.length - 1; i >= 0; --i) {
    if (doc.definitions[i].kind === Kind.OPERATION_DEFINITION) {
      ++operationCount;
    }
  }

  const directiveMatcher = getDirectiveMatcher(directives);
  const shouldRemoveField = (nodeDirectives: FieldNode["directives"]) =>
    isNonEmptyArray(nodeDirectives) &&
    nodeDirectives
      .map(directiveMatcher)
      .some(
        (config: RemoveDirectiveConfig | undefined) => config && config.remove
      );

  const originalFragmentDefsByPath = new Map<string, FragmentDefinitionNode>();

  // Any time the first traversal of the document below makes a change like
  // removing a fragment (by returning null), this variable should be set to
  // true. Once it becomes true, it should never be set to false again. If this
  // variable remains false throughout the traversal, then we can return the
  // original doc immediately without any modifications.
  let firstVisitMadeChanges = false;

  const fieldOrInlineFragmentVisitor: EnterLeaveVisitor<
    FieldNode | InlineFragmentNode
  > = {
    enter(node) {
      if (shouldRemoveField(node.directives)) {
        firstVisitMadeChanges = true;
        return null;
      }
    },
  };

  const docWithoutDirectiveSubtrees = visit(doc, {
    // These two AST node types share the same implementation, defined above.
    Field: fieldOrInlineFragmentVisitor,
    InlineFragment: fieldOrInlineFragmentVisitor,

    VariableDefinition: {
      enter() {
        // VariableDefinition nodes do not count as variables in use, though
        // they do contain Variable nodes that might be visited below. To avoid
        // counting variable declarations as usages, we skip visiting the
        // contents of this VariableDefinition node by returning false.
        return false;
      },
    },

    Variable: {
      enter(node, _key, _parent, _path, ancestors) {
        const inUse = getInUse(ancestors);
        if (inUse) {
          inUse.variables.add(node.name.value);
        }
      },
    },

    FragmentSpread: {
      enter(node, _key, _parent, _path, ancestors) {
        if (shouldRemoveField(node.directives)) {
          firstVisitMadeChanges = true;
          return null;
        }
        const inUse = getInUse(ancestors);
        if (inUse) {
          inUse.fragmentSpreads.add(node.name.value);
        }
        // We might like to remove this FragmentSpread by returning null here if
        // the corresponding FragmentDefinition node is also going to be removed
        // by the logic below, but we can't control the relative order of those
        // events, so we have to postpone the removal of dangling FragmentSpread
        // nodes until after the current visit of the document has finished.
      },
    },

    FragmentDefinition: {
      enter(node, _key, _parent, path) {
        originalFragmentDefsByPath.set(JSON.stringify(path), node);
      },
      leave(node, _key, _parent, path) {
        const originalNode = originalFragmentDefsByPath.get(
          JSON.stringify(path)
        );
        if (node === originalNode) {
          // If the FragmentNode received by this leave function is identical to
          // the one received by the corresponding enter function (above), then
          // the visitor must not have made any changes within this
          // FragmentDefinition node. This fragment definition may still be
          // removed if there are no ...spread references to it, but it won't be
          // removed just because it has only a __typename field.
          return node;
        }

        if (
          // This logic applies only if the document contains one or more
          // operations, since removing all fragments from a document containing
          // only fragments makes the document useless.
          operationCount > 0 &&
          node.selectionSet.selections.every(
            (selection) =>
              selection.kind === Kind.FIELD &&
              selection.name.value === "__typename"
          )
        ) {
          // This is a somewhat opinionated choice: if a FragmentDefinition ends
          // up having no fields other than __typename, we remove the whole
          // fragment definition, and later prune ...spread references to it.
          getInUseByFragmentName(node.name.value).removed = true;
          firstVisitMadeChanges = true;
          return null;
        }
      },
    },

    Directive: {
      leave(node) {
        // If a matching directive is found, remove the directive itself. Note
        // that this does not remove the target (field, argument, etc) of the
        // directive, but only the directive itself.
        if (directiveMatcher(node)) {
          firstVisitMadeChanges = true;
          return null;
        }
      },
    },
  });

  if (!firstVisitMadeChanges) {
    // If our first pass did not change anything about the document, then there
    // is no cleanup we need to do, and we can return the original doc.
    return doc;
  }

  // Utility for making sure inUse.transitiveVars is recursively populated.
  // Because this logic assumes inUse.fragmentSpreads has been completely
  // populated and inUse.removed has been set if appropriate,
  // populateTransitiveVars must be called after that information has been
  // collected by the first traversal of the document.
  const populateTransitiveVars = (inUse: InternalInUseInfo) => {
    if (!inUse.transitiveVars) {
      inUse.transitiveVars = new Set(inUse.variables);
      if (!inUse.removed) {
        inUse.fragmentSpreads.forEach((childFragmentName) => {
          populateTransitiveVars(
            getInUseByFragmentName(childFragmentName)
          ).transitiveVars!.forEach((varName) => {
            inUse.transitiveVars!.add(varName);
          });
        });
      }
    }
    return inUse;
  };

  // Since we've been keeping track of fragment spreads used by particular
  // operations and fragment definitions, we now need to compute the set of all
  // spreads used (transitively) by any operations in the document.
  const allFragmentNamesUsed = new Set<string>();
  docWithoutDirectiveSubtrees.definitions.forEach((def) => {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      populateTransitiveVars(
        getInUseByOperationName(def.name && def.name.value)
      ).fragmentSpreads.forEach((childFragmentName) => {
        allFragmentNamesUsed.add(childFragmentName);
      });
    } else if (
      def.kind === Kind.FRAGMENT_DEFINITION &&
      // If there are no operations in the document, then all fragment
      // definitions count as usages of their own fragment names. This heuristic
      // prevents accidentally removing all fragment definitions from the
      // document just because it contains no operations that use the fragments.
      operationCount === 0 &&
      !getInUseByFragmentName(def.name.value).removed
    ) {
      allFragmentNamesUsed.add(def.name.value);
    }
  });
  // Now that we have added all fragment spreads used by operations to the
  // allFragmentNamesUsed set, we can complete the set by transitively adding
  // all fragment spreads used by those fragments, and so on.
  allFragmentNamesUsed.forEach((fragmentName) => {
    // Once all the childFragmentName strings added here have been seen already,
    // the top-level allFragmentNamesUsed.forEach loop will terminate.
    populateTransitiveVars(
      getInUseByFragmentName(fragmentName)
    ).fragmentSpreads.forEach((childFragmentName) => {
      allFragmentNamesUsed.add(childFragmentName);
    });
  });

  const fragmentWillBeRemoved = (fragmentName: string) =>
    !!(
      // A fragment definition will be removed if there are no spreads that refer
      // to it, or the fragment was explicitly removed because it had no fields
      // other than __typename.
      (
        !allFragmentNamesUsed.has(fragmentName) ||
        getInUseByFragmentName(fragmentName).removed
      )
    );

  const enterVisitor: EnterLeaveVisitor<
    FragmentSpreadNode | FragmentDefinitionNode
  > = {
    enter(node) {
      if (fragmentWillBeRemoved(node.name.value)) {
        return null;
      }
    },
  };

  return nullIfDocIsEmpty(
    visit(docWithoutDirectiveSubtrees, {
      // If the fragment is going to be removed, then leaving any dangling
      // FragmentSpread nodes with the same name would be a mistake.
      FragmentSpread: enterVisitor,

      // This is where the fragment definition is actually removed.
      FragmentDefinition: enterVisitor,

      OperationDefinition: {
        leave(node) {
          // Upon leaving each operation in the depth-first AST traversal, prune
          // any variables that are declared by the operation but unused within.
          if (node.variableDefinitions) {
            const usedVariableNames = populateTransitiveVars(
              // If an operation is anonymous, we use the empty string as its key.
              getInUseByOperationName(node.name && node.name.value)
            ).transitiveVars!;

            // According to the GraphQL spec, all variables declared by an
            // operation must either be used by that operation or used by some
            // fragment included transitively into that operation:
            // https://spec.graphql.org/draft/#sec-All-Variables-Used
            //
            // To stay on the right side of this validation rule, if/when we
            // remove the last $var references from an operation or its fragments,
            // we must also remove the corresponding $var declaration from the
            // enclosing operation. This pruning applies only to operations and
            // not fragment definitions, at the moment. Fragments may be able to
            // declare variables eventually, but today they can only consume them.
            if (usedVariableNames.size < node.variableDefinitions.length) {
              return {
                ...node,
                variableDefinitions: node.variableDefinitions.filter((varDef) =>
                  usedVariableNames.has(varDef.variable.name.value)
                ),
              };
            }
          }
        },
      },
    })
  );
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

const connectionRemoveConfig = {
  test: (directive: DirectiveNode) => {
    const willRemove = directive.name.value === "connection";
    if (willRemove) {
      if (
        !directive.arguments ||
        !directive.arguments.some((arg) => arg.name.value === "key")
      ) {
        invariant.warn(
          "Removing an @connection directive even though it does not have a key. " +
            "You may want to use the key parameter to specify a store key."
        );
      }
    }

    return willRemove;
  },
};

export function removeConnectionDirectiveFromDocument(doc: DocumentNode) {
  return removeDirectivesFromDocument(
    [connectionRemoveConfig],
    checkDocument(doc)
  );
}

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

function getArgumentMatcher(config: RemoveArgumentsConfig[]) {
  return function argumentMatcher(argument: ArgumentNode) {
    return config.some(
      (aConfig: RemoveArgumentsConfig) =>
        argument.value &&
        argument.value.kind === Kind.VARIABLE &&
        argument.value.name &&
        (aConfig.name === argument.value.name.value ||
          (aConfig.test && aConfig.test(argument)))
    );
  };
}

export function removeArgumentsFromDocument(
  config: RemoveArgumentsConfig[],
  doc: DocumentNode
): DocumentNode | null {
  const argMatcher = getArgumentMatcher(config);

  return nullIfDocIsEmpty(
    visit(doc, {
      OperationDefinition: {
        enter(node) {
          return {
            ...node,
            // Remove matching top level variables definitions.
            variableDefinitions:
              node.variableDefinitions ?
                node.variableDefinitions.filter(
                  (varDef) =>
                    !config.some(
                      (arg) => arg.name === varDef.variable.name.value
                    )
                )
              : [],
          };
        },
      },

      Field: {
        enter(node) {
          // If `remove` is set to true for an argument, and an argument match
          // is found for a field, remove the field as well.
          const shouldRemoveField = config.some(
            (argConfig) => argConfig.remove
          );

          if (shouldRemoveField) {
            let argMatchCount = 0;
            if (node.arguments) {
              node.arguments.forEach((arg) => {
                if (argMatcher(arg)) {
                  argMatchCount += 1;
                }
              });
            }

            if (argMatchCount === 1) {
              return null;
            }
          }
        },
      },

      Argument: {
        enter(node) {
          // Remove all matching arguments.
          if (argMatcher(node)) {
            return null;
          }
        },
      },
    })
  );
}

export function removeFragmentSpreadFromDocument(
  config: RemoveFragmentSpreadConfig[],
  doc: DocumentNode
): DocumentNode | null {
  function enter(
    node: FragmentSpreadNode | FragmentDefinitionNode
  ): null | void {
    if (config.some((def) => def.name === node.name.value)) {
      return null;
    }
  }

  return nullIfDocIsEmpty(
    visit(doc, {
      FragmentSpread: { enter },
      FragmentDefinition: { enter },
    })
  );
}

// If the incoming document is a query, return it as is. Otherwise, build a
// new document containing a query operation based on the selection set
// of the previous main operation.
export function buildQueryFromSelectionSet(
  document: DocumentNode
): DocumentNode {
  const definition = getMainDefinition(document);
  const definitionOperation = (<OperationDefinitionNode>definition).operation;

  if (definitionOperation === "query") {
    // Already a query, so return the existing document.
    return document;
  }

  // Build a new query using the selection set of the main operation.
  const modifiedDoc = visit(document, {
    OperationDefinition: {
      enter(node) {
        return {
          ...node,
          operation: "query",
        };
      },
    },
  });
  return modifiedDoc;
}

// Remove fields / selection sets that include an @client directive.
export function removeClientSetsFromDocument(
  document: DocumentNode
): DocumentNode | null {
  checkDocument(document);

  let modifiedDoc = removeDirectivesFromDocument(
    [
      {
        test: (directive: DirectiveNode) => directive.name.value === "client",
        remove: true,
      },
    ],
    document
  );

  return modifiedDoc;
}

// Implements a style of query merging in which two queries are merged together
// under one root query and given aliases. It doesn't do deep merging, i.e. queries
// are merged at top level into one bigger query - we don't eliminate fields based on
// whether or not they are present in both queries.

import {
  OperationDefinition,
  Field,
  FragmentDefinition,
  FragmentSpread,
  InlineFragment,
  Document,
  SelectionSet,
  VariableDefinition,
  Variable,
  Argument,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinitions,
} from './getFromAST';

// Merges multiple queries into a single document. Starts out with an empty root
// query.
export function mergeQueries(childQueries: Document[]): Document {
  let rootQuery: Document = createEmptyRootQuery();

  childQueries.forEach((childQuery, childQueryIndex) => {
    rootQuery = addQueryToRoot(rootQuery, childQuery, childQueryIndex);
  });

  return rootQuery;
}

// Takes a query to add to a root query and aliases the child query's top-level
// field names.
export function addQueryToRoot(rootQuery: Document,
                               childQuery: Document,
                               childQueryIndex: number)
: Document {
  const aliasName = getQueryAliasName(getQueryDefinition(childQuery), childQueryIndex);
  const aliasedChild = applyAliasNameToDocument(childQuery, aliasName);
  const aliasedChildQueryDef = getQueryDefinition(aliasedChild);
  const aliasedChildFragmentDefs = getFragmentDefinitions(aliasedChild);
  const rootQueryDef = getQueryDefinition(rootQuery);

  rootQuery.definitions = rootQuery.definitions.concat(aliasedChildFragmentDefs);
  rootQueryDef.selectionSet.selections =
    rootQueryDef.selectionSet.selections.concat(aliasedChildQueryDef.selectionSet.selections);
  rootQueryDef.variableDefinitions =
    rootQueryDef.variableDefinitions.concat(aliasedChildQueryDef.variableDefinitions);

  return rootQuery;
}

export function createEmptyRootQuery(rootQuery?: string): Document {
  if (!rootQuery) {
    rootQuery = '__composed';
  }
  return {
    kind: 'Document',
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: 'query',
        name: {
          kind: 'Name',
          value: rootQuery,
        },
        variableDefinitions: [],
        directives: [],
        selectionSet: {
          kind: 'SelectionSet',
          selections: [],
        },
      },
    ],
  };
}

// Recursively steps through the query tree and renames the query fragment spreads to
// their aliased names.
export function renameFragmentSpreads(selSet: SelectionSet, aliasName: string): SelectionSet {
  if (selSet && selSet.selections) {
    selSet.selections = selSet.selections.map((selection) => {
      if (selection.kind === 'FragmentSpread') {
        const fragmentSpread = selection as FragmentSpread;
        fragmentSpread.name.value = getFragmentAliasName(fragmentSpread, aliasName);
        return fragmentSpread;
      } else {
        const withSelSet = selection as (InlineFragment | Field);
        withSelSet.selectionSet = renameFragmentSpreads(withSelSet.selectionSet, aliasName);
        return selection;
      }
    });
  }
  return selSet;
}

export function renameVariables(selSet: SelectionSet, aliasName: string): SelectionSet {
  if (selSet && selSet.selections) {
    selSet.selections = selSet.selections.map((selection) => {
      if (selection.kind === 'Field') {
        const field = selection as Field;
        if (field.arguments) {
          field.arguments = field.arguments.map((argument) => {
            if (argument.kind === 'Argument' &&
               (argument as Argument).value.kind === 'Variable') {
              const varx = argument.value as Variable;
              (argument.value as Variable).name.value = getVarAliasName(varx, aliasName);
            }
            return argument;
          });
        }
        field.selectionSet = renameVariables(field.selectionSet, aliasName);
        return field;
      } else if (selection.kind === 'InlineFragment') {
        const inlineFragment = selection as InlineFragment;
        inlineFragment.selectionSet = renameVariables(inlineFragment.selectionSet, aliasName);
        return inlineFragment;
      }
      return selection;
    });
  }
  return selSet;
}

export function applyAliasNameToVarDef(vDef: VariableDefinition, aliasName: string)
: VariableDefinition {
  vDef.variable.name.value = getVarAliasName(vDef.variable, aliasName);
  return vDef;
}

export function applyAliasNameToDocument(document: Document, aliasName: string): Document {
  //replace the fragment spread names
  document.definitions = document.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition' || definition.kind === 'FragmentDefinition') {
      const qDef = definition as (OperationDefinition | FragmentDefinition);
      qDef.selectionSet = renameFragmentSpreads(qDef.selectionSet, aliasName);
      qDef.selectionSet = renameVariables(qDef.selectionSet, aliasName);
      return qDef;
    } else {
      return definition;
    }
  });

  // replace the definitions within the document with the aliased versions
  // of those definitions.
  let currStartIndex = 0;
  document.definitions = document.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition' &&
        (definition as OperationDefinition).operation === 'query') {
      const queryDef = definition as OperationDefinition;
      if (queryDef.variableDefinitions) {
        queryDef.variableDefinitions = queryDef.variableDefinitions.map((vDef) => {
          return applyAliasNameToVarDef(vDef, aliasName);
        });
      }
      const retDef = applyAliasNameToQuery(queryDef, aliasName, currStartIndex);
      currStartIndex += queryDef.selectionSet.selections.length;
      return retDef;
    } else if (definition.kind === 'FragmentDefinition') {
      const fragmentDef = definition as FragmentDefinition;
      const retDef = applyAliasNameToFragment(fragmentDef, aliasName, currStartIndex);
      currStartIndex += fragmentDef.selectionSet.selections.length;
      return retDef;
    } else {
      throw new Error('Cannot apply alias names to documents that contain mutations.');
    }
  });
  return document;
}

export function applyAliasNameToFragment(fragment: FragmentDefinition,
                                         aliasName: string,
                                         startIndex: number)
: FragmentDefinition {
  fragment.name.value = getFragmentAliasName(fragment, aliasName);
  fragment.selectionSet.selections =
    applyAliasNameToSelections(fragment.selectionSet.selections, aliasName, startIndex);
  return fragment;
}

// Applies the alias name to the top level fields of a query.
export function applyAliasNameToQuery(childQuery: OperationDefinition,
                                      aliasName: string,
                                      startIndex: number)
: OperationDefinition {
  childQuery.selectionSet.selections =
    applyAliasNameToSelections(childQuery.selectionSet.selections, aliasName, startIndex);
  return childQuery;
}

export function getVarAliasName(varx: Variable, aliasName: string): string {
  return `${aliasName}__${varx.name.value}`;
}

export function getFragmentAliasName(fragment: FragmentDefinition | FragmentSpread,
                                     queryAliasName: string): string {
  return `${queryAliasName}__${fragment.name.value}`;
}

// Returns an alias name for the query using the query's index
// within a list of queries and the query object. For example, if a
// query's name is "listOfAuthors" and has index "3", the name will
// be "__listOfAuthors__queryIndex_3".
export function getQueryAliasName(childQuery: OperationDefinition,
                                  childQueryIndex: number) {
  let childQueryName = '';
  if (childQuery.name) {
    childQueryName = childQuery.name.value;
  }

  return `__${childQueryName}__queryIndex_${childQueryIndex}`;
}

export function aliasField(field: Field, alias: string): Field {
  field.alias = {
    kind: 'Name',
    value: alias,
  };
  return field;
}

export function addPrefixToQuery(prefix: string, query: OperationDefinition): OperationDefinition {
  if (query.name) {
    query.name.value = prefix + query.name.value;
  }
  return query;
}

export function addPrefixToVariables(prefix: string,
                                     variables: { [key: string]: any })
: { [key: string]: any } {
  const newVariables: { [key: string]: any } = {};
  Object.keys(variables).forEach((variableName) => {
    newVariables[prefix + variableName] = variables[variableName];
  });
  return newVariables;
}

function applyAliasNameToSelections(selections: (Field | FragmentSpread | InlineFragment)[],
                                    aliasName: string, startIndex: number)
: (Field | FragmentSpread | InlineFragment)[] {
  return selections.map((selection, selectionIndex) => {
    if (selection.kind === 'Field') {
      return aliasField(selection as Field,
                        `${aliasName}__fieldIndex_${selectionIndex + startIndex}`);
    } else if (selection.kind === 'InlineFragment') {
      const inlineFragment = selection as InlineFragment;
      inlineFragment.selectionSet.selections  =
        applyAliasNameToSelections(inlineFragment.selectionSet.selections,
                                   aliasName,
                                   selectionIndex + startIndex);
      return inlineFragment;
    } else {
      return selection;
    }
  });
}

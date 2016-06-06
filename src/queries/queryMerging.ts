// Implements a style of query merging in which two queries are merged together
// under one root query and given aliases.

import {
  OperationDefinition,
  Field,
} from 'graphql';

// Takes a query to add to a root query and aliases the child query's top-level
// field names.
export function addQueryToRoot(rootQuery: OperationDefinition,
                               childQuery: OperationDefinition,
                               childQueryIndex: Number): OperationDefinition {
  const childAliasName = getQueryAliasName(childQuery, childQueryIndex);
  const aliasedChildQuery = applyAliasName(childQuery, childAliasName);
  rootQuery.selectionSet.selections =
    rootQuery.selectionSet.selections.concat(aliasedChildQuery.selectionSet.selections);
  return rootQuery;
}

// Applies the alias name to the top level fields of a query.
export function applyAliasName(childQuery: OperationDefinition,
                               aliasName: string): OperationDefinition {
  let selections = childQuery.selectionSet.selections;
  childQuery.selectionSet.selections = selections.map((selection, selectionIndex) => {
    if (selection.kind === 'Field') {
      return aliasField(selection as Field, `${aliasName}__fieldIndex_${selectionIndex}`);
    } else {
      return selection;
    }
  });

  return childQuery;
}

// Returns an alias name for the query using the query's index
// within a list of queries and the query object. For example, if a
// query's name is "listOfAuthors" and has index "3", the name will
// be "__listOfAuthors__queryIndex_3".
export function getQueryAliasName(childQuery: OperationDefinition,
                                  childQueryIndex: Number) {
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

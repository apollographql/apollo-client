// Implements a style of query merging in which two queries are merged together
// under one root query and given aliases.

import {
  OperationDefinition,
  Field,
  FragmentDefinition,
  FragmentSpread,
  InlineFragment,
  Document,
  SelectionSet,
} from 'graphql';

// Takes a query to add to a root query and aliases the child query's top-level
// field names.
export function addQueryToRoot(rootQuery: OperationDefinition,
                               childQuery: OperationDefinition,
                               childQueryIndex: number)
: OperationDefinition {
  const childAliasName = getQueryAliasName(childQuery, childQueryIndex);
  const aliasedChildQuery = applyAliasNameToQuery(childQuery, childAliasName, 0);
  rootQuery.selectionSet.selections =
    rootQuery.selectionSet.selections.concat(aliasedChildQuery.selectionSet.selections);
  return rootQuery;
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

export function applyAliasNameToDocument(document: Document,
                                         aliasName: string)
: Document {

  // replace the definitions within the document with the aliased versions
  // of those definitions.
  document.definitions = document.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition' || definition.kind === 'FragmentDefinition') {
      const qDef = definition as (OperationDefinition | FragmentDefinition);
      qDef.selectionSet = this.renameFragmentSpreads(qDef.selectionSet, aliasName);
      return qDef;
    } else {
      return definition;
    }
  });

  let currStartIndex = 0;
  document.definitions = document.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition' &&
        (definition as OperationDefinition).operation === 'query') {
      const queryDef = definition as OperationDefinition;
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
    } else {
      return selection;
    }
  });
}

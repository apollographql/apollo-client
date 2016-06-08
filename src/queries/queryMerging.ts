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
  GraphQLResult,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinitions,
} from './getFromAST';

import {
  Request,
} from '../networkInterface';

import assign = require('lodash.assign');
import cloneDeep = require('lodash.clonedeep');

// Merges requests together.
// NOTE: This is pretty much the only function from this file that should be
// called from a network interface. It guarantees that the requests you pass in
// will remain unchanged.
export function mergeRequests(childRequests: Request[]): Request {
  childRequests = cloneDeep(childRequests);
  let rootQuery: Document = createEmptyRootQuery();
  let rootVariables: { [key: string]: any };

  childRequests.forEach((childRequest, childRequestIndex) => {
    rootQuery = addQueryToRoot(rootQuery, childRequest.query, childRequestIndex);
    if (childRequest.variables) {
      rootVariables = addVariablesToRoot(rootVariables,
                                         childRequest.variables,
                                         childRequest.query,
                                         childRequestIndex);
    }
  });

  let rootRequest: Request = {
    debugName: '__composed',
    query: rootQuery,
    variables: rootVariables,
  };

  return rootRequest;
}

export function unpackMergedResult(result: GraphQLResult, childRequests: Request[])
: GraphQLResult[] {

  const resultData = result.data;
  const resultArray: GraphQLResult[] = new Array(childRequests.length);
  const fieldMaps = createFieldMapsForRequests(childRequests);

  Object.keys(resultData).forEach((dataKey) => {
    const data: { [key: string]: any } = {};
    const queryInfo = parseKey(dataKey);
    const childRequestIndex = queryInfo.queryIndex;
    const fieldMap = fieldMaps[childRequestIndex];
    const field = fieldMap[queryInfo.fieldIndex];
    data[field.name.value] = resultData[dataKey];
    resultArray[childRequestIndex] = { data };
  });

  return resultArray;
}

export function createFieldMapsForRequests(requests: Request[])
: { [ index: number ]: Field }[] {
  const res = new Array(requests.length);
  requests.forEach((request, requestIndex) => {
    const queryDef = getQueryDefinition(request.query);
    const fragmentDefs = getFragmentDefinitions(request.query);
    const fieldMap = {};
    [queryDef, ...fragmentDefs].forEach((def) => {
      assign(fieldMap, createFieldMap(def.selectionSet.selections).fieldMap);
    });
    res[requestIndex] = fieldMap;
  });
  return res;
}

// Returns a map that goes from a field index to a particular selection within a
// request. We need this thing because inline fragments make it so that we
// can't just index into the SelectionSet.selections array given the field index.
// Also returns the next index to be used (this is used internally since the function
// is recursive).
export function createFieldMap(selections: (Field | InlineFragment | FragmentSpread)[],
                               startIndex?: number)
: { fieldMap: { [ index: number ]: Field }, newIndex: number } {

  if (!startIndex) {
    startIndex = 0;
  }
  let fieldMap: { [ index: number ]: Field } = {};
  let currIndex = startIndex;
  selections.forEach((selection) => {
    if (selection.kind === 'Field') {
      fieldMap[currIndex] = (selection as Field);
      currIndex += 1;
    } else if (selection.kind === 'InlineFragment') {
      const inlineFragment = selection as InlineFragment;
      const ret = createFieldMap(inlineFragment.selectionSet.selections, currIndex);
      assign(fieldMap, ret.fieldMap);
      currIndex = ret.newIndex;
    }
  });

  return {
    fieldMap,
    newIndex: currIndex,
  };
}

// Takes a key that looks like this: __queryName__queryIndex_0__fieldIndex_1: __typename
// And turns it into information like this { queryIndex: 0, fieldIndex: 1 }
export function parseKey(key: string): { queryIndex: number, fieldIndex: number } {
  const pieces = key.split('__');
  const queryIndexPiece = pieces[2].split('_');
  const fieldIndexPiece = pieces[3].split('_');

  return {
    queryIndex: parseInt(queryIndexPiece[1], 10),
    fieldIndex: parseInt(fieldIndexPiece[1], 10),
  };
}

// Merges multiple queries into a single document. Starts out with an empty root
// query.
export function mergeQueries(childQueries: Document[]): Document {
  let rootQuery: Document = createEmptyRootQuery();

  childQueries.forEach((childQuery, childQueryIndex) => {
    rootQuery = addQueryToRoot(rootQuery, childQuery, childQueryIndex);
  });

  return rootQuery;
}

// Adds a variable object to an existing variable object by aliasing names to
// prevent conflicts.
export function addVariablesToRoot(rootVariables: { [key: string]: any },
                         childVariables: { [key: string]: any },
                         childQuery: Document,
                         childQueryIndex: number)
: { [key: string]: any } {
  const aliasName = getQueryAliasName(getQueryDefinition(childQuery), childQueryIndex);
  const aliasedChildVariables = addPrefixToVariables(aliasName + '__', childVariables);
  return assign({}, rootVariables, aliasedChildVariables);
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

function _applyAliasNameToSelections(selections: (Field | FragmentSpread | InlineFragment)[],
                                     aliasName: string, startIndex: number)
: { res: (Field | FragmentSpread | InlineFragment)[], newIndex: number } {

  let currIndex = startIndex;
  const res = selections.map((selection) => {
    if (selection.kind === 'Field') {
      const aliasedField = aliasField(selection as Field,
                        `${aliasName}__fieldIndex_${currIndex}`);
      currIndex += 1;
      return aliasedField;
    } else if (selection.kind === 'InlineFragment') {
      const inlineFragment = selection as InlineFragment;
      const ret = _applyAliasNameToSelections(inlineFragment.selectionSet.selections,
                                              aliasName,
                                              currIndex);
      inlineFragment.selectionSet.selections = ret.res;
      currIndex = ret.newIndex;
      return inlineFragment;
    } else {
      return selection;
    }
  });

  return {
    res,
    newIndex: currIndex,
  };
}

function applyAliasNameToSelections(selections: (Field | FragmentSpread | InlineFragment)[],
                                    aliasName: string, startIndex: number)
: (Field | FragmentSpread | InlineFragment)[] {
  const ret = _applyAliasNameToSelections(selections, aliasName, startIndex);
  return ret.res;
}

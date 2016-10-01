// Implements a style of query merging in which two queries are merged together
// under one root query and given aliases. It doesn't do deep merging, i.e. queries
// are merged at top level into one bigger query - we don't eliminate fields based on
// whether or not they are present in both queries.

// How merging GraphQL documents works (at a high level):
//
// We determine an alias name for the whole query using getOperationDefinitionName. This looks
// like: "___queryName___requestIndex_0" where 0 represents the index of the request
// a list of requests.
//
// Then, this alias name is prepended to top-level field names and each field is given
// a field index. For example "author" might turn into
// "___queryName___requestIndex_0___fieldIndex_0___author".
//
// We apply essentially the same procedure for fields within fragments. We also rename
// fragments in order to prevent fragment collisions once the query documents are merged.
// For example, a fragment named "authorDetails" might turn into
// "___queryName___requestIndex_0___authorDetails". Since fragments are renamed, fragment spreads
// must also be renamed within the query.
//
// Variables are also renamed. We simply prepend the query alias name to the variable name, i.e.
// "___queryName___requestIndex_0___variableName".
//
// Finally, we take these queries with aliased names and put them under the same RootQuery.
// We also expose unpackMergedResult which allows us to take a result returned for a merged
// query and unpack it into the results that it is composed of.

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
  FragmentMap,
  createFragmentMap,
} from '../queries/getFromAST';

import {
  Request,
} from './networkInterface';

import {
  resultKeyNameFromField,
} from '../data/storeUtils';

import assign = require('lodash.assign');
import cloneDeep = require('lodash.clonedeep');
import isArray = require('lodash.isarray');
import isNull = require('lodash.isnull');
import isUndefined = require('lodash.isundefined');

// Merges requests together.
// NOTE: This is pretty much the only function from this file that should be
// called from outside of this file. It guarantees that the requests you pass in
// will remain unchanged.
export function mergeRequests(requests: Request[]): Request {
  // NOTE: subsequent calls actually modify the request object and/or GQL document.
  // So, to avoid changing the request passed in, we clone the whole request tree.
  let rootQueryDoc: Document = createEmptyRootQueryDoc();
  let rootVariables: { [key: string]: any };

  requests.forEach((request, requestIndex) => {
    request = cloneDeep(request);
    rootQueryDoc = addQueryToRoot(rootQueryDoc, request.query, requestIndex);
    if (request.variables) {
      rootVariables = addVariablesToRoot(
        rootVariables,
        request.variables,
        request.query,
        requestIndex
      );
    }
  });

  let rootRequest: Request = {
    debugName: '___composed',
    query: rootQueryDoc,
    variables: rootVariables,
  };

  return rootRequest;
}

export function unpackMergedResult(
  result: GraphQLResult,
  childRequests: Request[]
): GraphQLResult[] {

  const resultArray: GraphQLResult[] = childRequests.map((request, index) => {
    const { unpackedData } = unpackDataForRequest({
      request,
      data: result.data,
      selectionSet: getQueryDefinition(request.query).selectionSet,
      queryIndex: index,
      startIndex: 0,
      fragmentMap: createFragmentMap(getFragmentDefinitions(request.query)),
      topLevel: true,
    });

    return assign({}, result, { data: unpackedData });
  });

  return resultArray;
}

export type UnpackOptions = {
  request: Request,
  data: Object,
  selectionSet?: SelectionSet,
  queryIndex: number,
  startIndex: number,
  fragmentMap: FragmentMap,
  topLevel: boolean,
}

// This method takes a particular request and extracts the fields that the query asks for out of
// a merged request. It does this by recursively stepping through the query, figuring out what
// the names of fields would be aliased to and then reading those fields out of of the merged result.
//
// Because of the way we do aliasing, each query only gets the data it asks for and there's never
// any confusion as to which piece of data belongs to which query.
export function unpackDataForRequest({
  request,
  data,
  selectionSet,
  queryIndex,
  startIndex,
  fragmentMap,
  topLevel,
}: UnpackOptions): {
  newIndex: number,
  unpackedData: Object,
} {
  // This is the base case of the the recursion. If there's no selection set, we
  // just return an empty result key map.
  if (!selectionSet) {
    return {
      newIndex: startIndex,
      unpackedData: {},
    };
  }

  const unpackedData = {};
  let currIndex = startIndex;
  selectionSet.selections.forEach((selection) => {
    if (selection.kind === 'Field') {
      const field = selection as Field;
      // If this is a field, then the data key is just the aliased field name and the unpacked
      // result key is the name of the field.
      const realName = resultKeyNameFromField(field);
      const aliasName = getOperationDefinitionName(getQueryDefinition(request.query), queryIndex);
      const stringKey = topLevel ? `${aliasName}___fieldIndex_${currIndex}` : realName;
      if (topLevel) {
        currIndex += 1;
      }

      const childData = isNull(data) ? null : (data as any)[stringKey];
      let resData = childData;
      if (field.selectionSet && field.selectionSet.selections.length > 0) {
        const fieldOpts = {
          request,
          data: childData,
          selectionSet: field.selectionSet,
          queryIndex,
          fragmentMap,
          startIndex: currIndex,
          topLevel: false,
        };

        if (isNull(childData)) {
          const selectionRet = unpackDataForRequest(assign(fieldOpts, {
            startIndex: currIndex,
          }) as UnpackOptions);
          currIndex = selectionRet.newIndex;
          resData = childData;
        } else if (isArray(childData)) {
          const resUnpacked: any[] = [];
          let newIndex = 0;

          childData.forEach((dataObject: any) => {
            const selectionRet = unpackDataForRequest(assign(fieldOpts, {
              data: dataObject,
              startIndex: currIndex,
            }) as UnpackOptions);

            newIndex = selectionRet.newIndex;
            resUnpacked.push(selectionRet.unpackedData);
          });

          currIndex = newIndex;
          resData = resUnpacked;
        } else {
          const selectionRet = unpackDataForRequest(assign(fieldOpts, { startIndex: currIndex }) as UnpackOptions);
          // Create keys for internal fragments
          resData = selectionRet.unpackedData;
          currIndex = selectionRet.newIndex;
        }
      }

      if (!isUndefined(childData)) {
        (unpackedData as any)[realName] = resData;
      }
    } else if (selection.kind === 'InlineFragment') {
      // If this is an inline fragment, then we recursively resolve the fields within the
      // inline fragment.
      const inlineFragment = selection as InlineFragment;
      const ret = unpackDataForRequest({
        request,
        data,
        selectionSet: inlineFragment.selectionSet,
        queryIndex,
        startIndex: currIndex,
        fragmentMap,
        topLevel,
      });
      assign(unpackedData, ret.unpackedData);
      currIndex = ret.newIndex;
    } else if (selection.kind === 'FragmentSpread') {
      // if this is a fragment spread, then we look up the fragment within the fragment map.
      // Then, we recurse on the fragment's selection set. Finally, the data key will be a
      // serialized version of the fragment name to the new result keys.
      const fragmentSpread = (selection as FragmentSpread);
      const fragment = fragmentMap[fragmentSpread.name.value];
      const fragmentRet = unpackDataForRequest({
        request,
        data,
        selectionSet: fragment.selectionSet,
        queryIndex,
        startIndex: currIndex,
        fragmentMap,
        topLevel: true,
      });
      assign(unpackedData, fragmentRet.unpackedData);
      currIndex = fragmentRet.newIndex;
    }
  });

  return {
    newIndex: currIndex,
    unpackedData,
  };
}

// Merges multiple queries into a single document. Starts out with an empty root
// query. Used primarily to unit test addQueryToRoot.
// Note: this method does NOT guarantee that the child query documents will remain
// unchanged.
export function mergeQueryDocuments(childQueryDocs: Document[]): Document {
  let rootQueryDoc: Document = createEmptyRootQueryDoc();

  childQueryDocs.forEach((childQueryDoc, childQueryDocIndex) => {
    rootQueryDoc = addQueryToRoot(rootQueryDoc, childQueryDoc, childQueryDocIndex);
  });

  return rootQueryDoc;
}

// Adds a variable object to an existing variable object by aliasing names to
// prevent conflicts.
export function addVariablesToRoot(rootVariables: { [key: string]: any },
  childVariables: { [key: string]: any },
  childQueryDoc: Document,
  childQueryDocIndex: number): { [key: string]: any } {
  const aliasName = getOperationDefinitionName(getQueryDefinition(childQueryDoc), childQueryDocIndex);
  const aliasedChildVariables = addPrefixToVariables(aliasName + '___', childVariables);
  return assign({}, rootVariables, aliasedChildVariables);
}

// Takes a query to add to a root query and aliases the child query's top-level
// field names.
export function addQueryToRoot(rootQueryDoc: Document,
  childQueryDoc: Document,
  childQueryDocIndex: number): Document {
  const aliasName = getOperationDefinitionName(getQueryDefinition(childQueryDoc), childQueryDocIndex);
  const aliasedChild = applyAliasNameToDocument(childQueryDoc, aliasName);
  const aliasedChildQueryDef = getQueryDefinition(aliasedChild);
  const aliasedChildFragmentDefs = getFragmentDefinitions(aliasedChild);
  const rootQueryDef = getQueryDefinition(rootQueryDoc);

  rootQueryDoc.definitions = rootQueryDoc.definitions.concat(aliasedChildFragmentDefs);
  rootQueryDef.selectionSet.selections =
    rootQueryDef.selectionSet.selections.concat(aliasedChildQueryDef.selectionSet.selections);
  rootQueryDef.variableDefinitions =
    rootQueryDef.variableDefinitions.concat(aliasedChildQueryDef.variableDefinitions);

  return rootQueryDoc;
}

export function createEmptyRootQueryDoc(rootQueryName?: string): Document {
  if (!rootQueryName) {
    rootQueryName = '___composed';
  }
  return {
    kind: 'Document',
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: 'query',
        name: {
          kind: 'Name',
          value: rootQueryName,
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

function renameVariablesInArgument(argument: Argument, aliasName: string): Argument {
  if (argument.kind === 'Argument' &&
      (argument as Argument).value.kind === 'Variable') {
    const varx = argument.value as Variable;
    (argument.value as Variable).name.value = getVariableAliasName(varx, aliasName);
  }
  return argument;
}

export function renameVariables(selSet: SelectionSet, aliasName: string): SelectionSet {
  if (selSet && selSet.selections) {
    selSet.selections = selSet.selections.map((selection) => {
      if (selection.kind === 'Field') {
        const field = selection as Field;
        if (field.arguments) {
          field.arguments = field.arguments.map(argument =>
            renameVariablesInArgument(argument, aliasName)
          );
        }
        if (field.directives) {
          field.directives = field.directives.map((directive) => {
            if (directive.arguments) {
              directive.arguments = directive.arguments.map(argument =>
                renameVariablesInArgument(argument, aliasName)
              );
            }
            return directive;
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

export function applyAliasNameToVariableDefinition(vDef: VariableDefinition, aliasName: string)
: VariableDefinition {
  if (containsMarker(vDef.variable.name.value)) {
    throw new Error(`Variable definition for ${vDef.variable.name.value} contains "___"`);
  }

  vDef.variable.name.value = getVariableAliasName(vDef.variable, aliasName);
  return vDef;
}

export function applyAliasNameToDocument(document: Document, aliasName: string): Document {
  //replace the fragment spread names
  document.definitions = document.definitions.map((definition) => {
    const operationOrFragmentDef =
      definition as (OperationDefinition | FragmentDefinition);
    operationOrFragmentDef.selectionSet =
      renameFragmentSpreads(operationOrFragmentDef.selectionSet, aliasName);
    operationOrFragmentDef.selectionSet =
      renameVariables(operationOrFragmentDef.selectionSet, aliasName);
    return operationOrFragmentDef;
  });

  // replace the definitions within the document with the aliased versions
  // of those definitions.
  let currStartIndex = 0;
  document.definitions = document.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition' &&
        (definition as OperationDefinition).operation === 'query') {
      const operationDef = definition as OperationDefinition;
      if (operationDef.variableDefinitions) {
        operationDef.variableDefinitions =
          operationDef.variableDefinitions.map((vDef) => {
            return applyAliasNameToVariableDefinition(vDef, aliasName);
          });
      }
      const retDef = applyAliasNameToTopLevelFields(operationDef, aliasName, currStartIndex);
      currStartIndex += operationDef.selectionSet.selections.length;
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

export function applyAliasNameToFragment(fragment: FragmentDefinition, aliasName: string,
  startIndex: number): FragmentDefinition {
  if (containsMarker(fragment.name.value)) {
    throw new Error(`Fragment ${fragment.name.value} contains "___"`);
  }

  fragment.name.value = getFragmentAliasName(fragment, aliasName);
  fragment.selectionSet.selections =
    applyAliasNameToSelections(fragment.selectionSet.selections, aliasName, startIndex).res;
  return fragment;
}

// Applies the alias name to the top level fields of a query.
export function applyAliasNameToTopLevelFields(childQuery: OperationDefinition, aliasName: string,
  startIndex: number): OperationDefinition {
  childQuery.selectionSet.selections =
    applyAliasNameToSelections(childQuery.selectionSet.selections, aliasName, startIndex).res;
  return childQuery;
}

export function getVariableAliasName(varNode: Variable, aliasName: string): string {
  return `${aliasName}___${varNode.name.value}`;
}

export function getFragmentAliasName(fragment: FragmentDefinition | FragmentSpread,
  queryAliasName: string): string {
  return `${queryAliasName}___${fragment.name.value}`;
}

// Returns an alias name for the query using the query's index
// within a list of queries and the query object. For example, if a
// query's name is "listOfAuthors" and has index "3", the name will
// be "___listOfAuthors___requestIndex_3".
export function getOperationDefinitionName(operationDef: OperationDefinition,
  requestIndex: number): string {
  let operationDefName = '';
  if (operationDef.name) {
    operationDefName = operationDef.name.value;
  }

  return `___${operationDefName}___requestIndex_${requestIndex}`;
}

export function aliasField(field: Field, alias: string): Field {
  if (containsMarker(field.name.value)) {
    throw new Error(`Field ${field.name.value} contains "___".`);
  }
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
  aliasName: string, startIndex: number): {
    res: (Field | FragmentSpread | InlineFragment)[],
    newIndex: number
  } {
  let currIndex = startIndex;
  const res = selections.map((selection) => {
    if (selection.kind === 'Field') {
      const aliasedField = aliasField(selection as Field,
                        `${aliasName}___fieldIndex_${currIndex}`);
      currIndex += 1;
      return aliasedField;
    } else if (selection.kind === 'InlineFragment') {
      const inlineFragment = selection as InlineFragment;
      const ret =
        applyAliasNameToSelections(
          inlineFragment.selectionSet.selections,
          aliasName,
          currIndex
        );
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

// Checks if the name of something starts with the separating marker (i.e. "___")
function containsMarker(name: string) {
  return name.indexOf('___') > -1;
}

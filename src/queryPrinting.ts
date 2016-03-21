/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />

import { print } from 'graphql';

export function printNodeQuery({
  id,
  typeName,
  selectionSet,
}) {
  const queryDocumentAst = {
    kind: 'Document',
    definitions: [
      nodeQueryDefinition({
        id,
        typeName,
        selectionSet,
      }),
    ],
  };

  return print(queryDocumentAst);
}

function nodeQueryDefinition({
  id,
  typeName,
  selectionSet,
}) {
  return {
    kind: 'OperationDefinition',
    operation: 'query',
    name: null,
    variableDefinitions: null,
    directives: [],
    selectionSet: {
      kind: 'SelectionSet',
      selections: [
        {
          kind: 'Field',
          alias: null,
          name: {
            kind: 'Name',
            value: 'node',
          },
          arguments: [
            {
              kind: 'Argument',
              name: {
                kind: 'Name',
                value: 'id',
              },
              value: {
                kind: 'StringValue',
                value: id,
              },
            },
          ],
          directives: [],
          selectionSet: {
            kind: 'SelectionSet',
            selections: [
              inlineFragmentSelection({
                typeName,
                selectionSet,
              }),
            ],
          },
        },
      ],
    },
  };
}

function inlineFragmentSelection({
  typeName,
  selectionSet,
}) {
  return {
    kind: 'InlineFragment',
    typeCondition: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: typeName,
      },
    },
    directives: [],
    selectionSet,
  };
}

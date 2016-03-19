import { print } from 'graphql/language';

export function selectionSetToNodeQueryDefinition({
  id,
  selectionSet,
}) {
  const queryDocumentAst = {
    kind: 'Document',
    definitions: [
      {
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
              selectionSet,
            },
          ],
        },
      },
    ],
  };

  return print(queryDocumentAst);
}

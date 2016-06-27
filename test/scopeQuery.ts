import { assert } from 'chai';
import { scopeSelectionSetToResultPath } from '../src/data/scopeQuery';

import {
  createFragmentMap,
  getFragmentDefinitions,
  getQueryDefinition,
  getMutationDefinition,
  getFragmentDefinition,
  FragmentMap,
} from '../src/queries/getFromAST';

import gql from 'graphql-tag';

import {
  print,
  Document,
} from 'graphql';

// To test:
// 1. basic
// 2. aliases
// 3. arguments
// 4. fragments

describe('scoping selection set', () => {
  it('scopes a basic selection set', () => {
    testScope(
      gql`
        {
          a {
            b
          }
        }
      `,
      gql`
        {
          b
        }
      `,
      ['a']
    );
  });
});

function extractMainSelectionSet(doc) {
  let mainDefinition;

  try {
    mainDefinition = getQueryDefinition(doc);
  } catch (e) {
    try {
      mainDefinition = getMutationDefinition(doc);
    } catch (e) {
      try {
        mainDefinition = getFragmentDefinition(doc);
      } catch (e) {
        throw new Error('Could not find query, mutation, or fragment in document.');
      }
    }
  }

  return mainDefinition.selectionSet;
}

function scope(doc: Document, path: (string | number)[]) {
  const fragmentMap = createFragmentMap(getFragmentDefinitions(doc));

  const selectionSet = extractMainSelectionSet(doc);

  return scopeSelectionSetToResultPath({
    selectionSet,
    fragmentMap,
    path,
  });
}

function testScope(firstDoc, secondDoc, path) {
  assert.equal(
    print(scope(firstDoc, path)).trim(),
    print(secondDoc).trim()
  );
}

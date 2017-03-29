import { assert } from 'chai';
import gql from 'graphql-tag';
import { Store } from '../src/store';
import ApolloClient from '../src/ApolloClient';
import { IntrospectionFragmentMatcher } from '../src/data/fragmentMatcher';

import mockQueryManager from './mocks/mockQueryManager';

describe('IntrospectionFragmentMatcher', () => {

  const introspectionQuery = gql`{
    __schema {
      types {
        kind
        name
        possibleTypes {
          name
        }
      }
    }
  }`;

  it('will throw an error if match is called if it is not ready', () => {
    const ifm = new IntrospectionFragmentMatcher();
    assert.throws( () => (ifm.match as any)(), /called before/ );
  });

  it('can be seeded with an introspection query result', () => {
    const ifm = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: {
        __schema: {
          types: [{
            kind: 'UNION',
            name: 'Item',
            possibleTypes: [{
              name: 'ItemA',
            }, {
              name: 'ItemB',
            }],
          }],
        },
      },
    });

    const store = {
      'a': {
        __typename: 'ItemB',
      },
    };

    const idValue = {
      type: 'id',
      id: 'a',
      generated: false,
    };

    const readStoreContext = {
      store,
      returnPartialData: false,
      hasMissingField: false,
      customResolvers: {},
    };

    assert.equal(ifm.match(idValue as any, 'Item', readStoreContext), true );
    assert.equal(ifm.match(idValue as any, 'NotAnItem', readStoreContext), false );
  });
});

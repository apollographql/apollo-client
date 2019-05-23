import { IntrospectionFragmentMatcher } from '../fragmentMatcher';
import { defaultNormalizedCacheFactory } from '../objectCache';
import { ReadStoreContext } from '../types';
import { InMemoryCache } from '../inMemoryCache';
import gql from 'graphql-tag';

describe('FragmentMatcher', () => {
  it('can match against the root Query', () => {
    const cache = new InMemoryCache({
      addTypename: true,
    });

    const query = gql`
      query AllPeople {
        people {
          id
          name
        }
        ...PeopleTypes
      }
      fragment PeopleTypes on Query {
        __type(name: "Person") {
          name
          kind
        }
      }
    `;

    const data = {
      people: [
        {
          __typename: 'Person',
          id: 123,
          name: 'Ben',
        },
      ],
      __type: {
        __typename: '__Type',
        name: 'Person',
        kind: 'OBJECT',
      },
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });
});

describe('IntrospectionFragmentMatcher', () => {
  it('will throw an error if match is called if it is not ready', () => {
    const ifm = new IntrospectionFragmentMatcher();
    expect(() => (ifm.match as any)()).toThrowError(/called before/);
  });

  it('can be seeded with an introspection query result', () => {
    const ifm = new IntrospectionFragmentMatcher({
      introspectionQueryResultData: {
        __schema: {
          types: [
            {
              kind: 'UNION',
              name: 'Item',
              possibleTypes: [
                {
                  name: 'ItemA',
                },
                {
                  name: 'ItemB',
                },
              ],
            },
          ],
        },
      },
    });

    const store = defaultNormalizedCacheFactory({
      a: {
        __typename: 'ItemB',
      },
    });

    const idValue = {
      type: 'id',
      id: 'a',
      generated: false,
    };

    const readStoreContext = {
      store,
      returnPartialData: false,
      hasMissingField: false,
      cacheRedirects: {},
    } as ReadStoreContext;

    expect(ifm.match(idValue as any, 'Item', readStoreContext)).toBe(true);
    expect(ifm.match(idValue as any, 'NotAnItem', readStoreContext)).toBe(
      false,
    );
  });
});

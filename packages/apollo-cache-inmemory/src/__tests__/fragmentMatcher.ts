import { IntrospectionFragmentMatcher } from '../fragmentMatcher';
import { defaultNormalizedCacheFactory } from '../objectCache';
import { IdValue } from 'apollo-utilities';
import { ReadStoreContext } from '../types';

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

    const idValue: IdValue = {
      type: 'id',
      id: 'a',
      generated: false,
      typename: undefined,
    };

    const readStoreContext: ReadStoreContext = {
      store: defaultNormalizedCacheFactory({
        a: {
          __typename: 'ItemB',
        },
      }),
    } as any;

    expect(ifm.match(idValue, 'Item', readStoreContext)).toBe(true);
    expect(ifm.match(idValue, 'NotAnItem', readStoreContext)).toBe(false);
  });
});

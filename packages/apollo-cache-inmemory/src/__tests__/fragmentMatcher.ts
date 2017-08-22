import { IntrospectionFragmentMatcher } from '../fragmentMatcher';
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

    const store = {
      a: {
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

    expect(ifm.match(idValue as any, 'Item', readStoreContext)).toBe(true);
    expect(ifm.match(idValue as any, 'NotAnItem', readStoreContext)).toBe(
      false,
    );
  });
});

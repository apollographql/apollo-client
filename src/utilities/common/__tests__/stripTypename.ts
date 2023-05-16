import equal from '@wry/equality';
import { stripTypename } from '../stripTypename';

test('omits __typename from a shallow object', () => {
  expect(
    stripTypename({ __typename: 'Person', firstName: 'Foo', lastName: 'Bar' })
  ).toEqual({ firstName: 'Foo', lastName: 'Bar' });
});

test('omits __typename from arbitrarily nested object', () => {
  expect(
    stripTypename({
      __typename: 'Profile',
      user: {
        __typename: 'User',
        firstName: 'Foo',
        lastName: 'Bar',
        location: {
          __typename: 'Location',
          city: 'Denver',
          country: 'USA',
        },
      },
    })
  ).toEqual({
    user: {
      firstName: 'Foo',
      lastName: 'Bar',
      location: {
        city: 'Denver',
        country: 'USA',
      },
    },
  });
});

test('omits the __typename from arrays', () => {
  expect(
    stripTypename([
      { __typename: 'Todo', name: 'Take out trash' },
      { __typename: 'Todo', name: 'Clean room' },
    ])
  ).toEqual([{ name: 'Take out trash' }, { name: 'Clean room' }]);
});

test('omits __typename from arbitrarily nested arrays', () => {
  expect(
    stripTypename([
      [{ __typename: 'Foo', foo: 'foo' }],
      [{ __typename: 'Bar', bar: 'bar' }, [{ __typename: 'Baz', baz: 'baz' }]],
    ])
  ).toEqual([[{ foo: 'foo' }], [{ bar: 'bar' }, [{ baz: 'baz' }]]]);
});

test('returns primitives unchanged', () => {
  expect(stripTypename('a')).toBe('a');
  expect(stripTypename(1)).toBe(1);
  expect(stripTypename(true)).toBe(true);
  expect(stripTypename(null)).toBe(null);
  expect(stripTypename(undefined)).toBe(undefined);
});

test('keeps __typename for paths allowed by the `keep` option', () => {
  const variables = {
    __typename: 'Foo',
    bar: {
      __typename: 'Bar',
      aa: true,
    },
    baz: {
      __typename: 'Baz',
      bb: true,
    },
    deeply: {
      __typename: 'Deeply',
      nested: {
        __typename: 'Nested',
        value: 'value',
      },
    },
  };

  const result = stripTypename(variables, {
    keep: (path) => {
      if (equal(path, ['bar', '__typename'])) {
        return true;
      }

      if (equal(path, ['deeply'])) {
        return stripTypename.BREAK;
      }
    },
  });

  expect(result).toStrictEqual({
    bar: {
      __typename: 'Bar',
      aa: true,
    },
    baz: {
      bb: true,
    },
    deeply: {
      __typename: 'Deeply',
      nested: {
        __typename: 'Nested',
        value: 'value',
      },
    },
  });
});

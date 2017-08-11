import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';

import { assert } from 'chai';

import { getFragmentQueryDocument } from '../src/fragments';

describe('getFragmentQueryDocument', () => {
  it('will throw an error if there is an operation', () => {
    assert.throws(
      () =>
        getFragmentQueryDocument(
          gql`
            {
              a
              b
              c
            }
          `,
        ),
      'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.',
    );
    assert.throws(
      () =>
        getFragmentQueryDocument(
          gql`
            query {
              a
              b
              c
            }
          `,
        ),
      'Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed.',
    );
    assert.throws(
      () =>
        getFragmentQueryDocument(
          gql`
            query Named {
              a
              b
              c
            }
          `,
        ),
      "Found a query operation named 'Named'. No operations are allowed when using a fragment as a query. Only fragments are allowed.",
    );
    assert.throws(
      () =>
        getFragmentQueryDocument(
          gql`
            mutation Named {
              a
              b
              c
            }
          `,
        ),
      "Found a mutation operation named 'Named'. No operations are allowed when using a fragment as a query. " +
        'Only fragments are allowed.',
    );
    assert.throws(
      () =>
        getFragmentQueryDocument(
          gql`
            subscription Named {
              a
              b
              c
            }
          `,
        ),
      "Found a subscription operation named 'Named'. No operations are allowed when using a fragment as a query. " +
        'Only fragments are allowed.',
    );
  });

  it('will throw an error if there is not exactly one fragment but no `fragmentName`', () => {
    assert.throws(() => {
      getFragmentQueryDocument(gql`
        fragment foo on Foo {
          a
          b
          c
        }

        fragment bar on Bar {
          d
          e
          f
        }
      `);
    }, 'Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    assert.throws(() => {
      getFragmentQueryDocument(gql`
        fragment foo on Foo {
          a
          b
          c
        }

        fragment bar on Bar {
          d
          e
          f
        }

        fragment baz on Baz {
          g
          h
          i
        }
      `);
    }, 'Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
    assert.throws(() => {
      getFragmentQueryDocument(gql`
        scalar Foo
      `);
    }, 'Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment.');
  });

  it('will create a query document where the single fragment is spread in the root query', () => {
    assert.deepEqual(
      print(
        getFragmentQueryDocument(gql`
          fragment foo on Foo {
            a
            b
            c
          }
        `),
      ),
      print(gql`
        {
          ...foo
        }

        fragment foo on Foo {
          a
          b
          c
        }
      `),
    );
  });

  it('will create a query document where the named fragment is spread in the root query', () => {
    assert.deepEqual(
      print(
        getFragmentQueryDocument(
          gql`
            fragment foo on Foo {
              a
              b
              c
            }

            fragment bar on Bar {
              d
              e
              f
              ...foo
            }

            fragment baz on Baz {
              g
              h
              i
              ...foo
              ...bar
            }
          `,
          'foo',
        ),
      ),
      print(gql`
        {
          ...foo
        }

        fragment foo on Foo {
          a
          b
          c
        }

        fragment bar on Bar {
          d
          e
          f
          ...foo
        }

        fragment baz on Baz {
          g
          h
          i
          ...foo
          ...bar
        }
      `),
    );
    assert.deepEqual(
      print(
        getFragmentQueryDocument(
          gql`
            fragment foo on Foo {
              a
              b
              c
            }

            fragment bar on Bar {
              d
              e
              f
              ...foo
            }

            fragment baz on Baz {
              g
              h
              i
              ...foo
              ...bar
            }
          `,
          'bar',
        ),
      ),
      print(gql`
        {
          ...bar
        }

        fragment foo on Foo {
          a
          b
          c
        }

        fragment bar on Bar {
          d
          e
          f
          ...foo
        }

        fragment baz on Baz {
          g
          h
          i
          ...foo
          ...bar
        }
      `),
    );
    assert.deepEqual(
      print(
        getFragmentQueryDocument(
          gql`
            fragment foo on Foo {
              a
              b
              c
            }

            fragment bar on Bar {
              d
              e
              f
              ...foo
            }

            fragment baz on Baz {
              g
              h
              i
              ...foo
              ...bar
            }
          `,
          'baz',
        ),
      ),
      print(gql`
        {
          ...baz
        }

        fragment foo on Foo {
          a
          b
          c
        }

        fragment bar on Bar {
          d
          e
          f
          ...foo
        }

        fragment baz on Baz {
          g
          h
          i
          ...foo
          ...bar
        }
      `),
    );
  });
});

import { disableFragmentWarnings, gql } from "@apollo/client";
import { getFragmentQueryDocument } from "@apollo/client/utilities/internal";

// Turn off warnings for repeated fragment names
disableFragmentWarnings();

test("will throw an error if there is an operation", () => {
  expect(() =>
    getFragmentQueryDocument(gql`
      {
        a
        b
        c
      }
    `)
  ).toThrow(
    "Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed."
  );
  expect(() =>
    getFragmentQueryDocument(gql`
      query {
        a
        b
        c
      }
    `)
  ).toThrow(
    "Found a query operation. No operations are allowed when using a fragment as a query. Only fragments are allowed."
  );
  expect(() =>
    getFragmentQueryDocument(gql`
      query Named {
        a
        b
        c
      }
    `)
  ).toThrow(
    "Found a query operation named 'Named'. No operations are allowed when using a fragment as a query. Only fragments are allowed."
  );
  expect(() =>
    getFragmentQueryDocument(gql`
      mutation Named {
        a
        b
        c
      }
    `)
  ).toThrow(
    "Found a mutation operation named 'Named'. No operations are allowed when using a fragment as a query. " +
      "Only fragments are allowed."
  );
  expect(() =>
    getFragmentQueryDocument(gql`
      subscription Named {
        a
        b
        c
      }
    `)
  ).toThrow(
    "Found a subscription operation named 'Named'. No operations are allowed when using a fragment as a query. " +
      "Only fragments are allowed."
  );
});

test("will throw an error if there is not exactly one fragment but no `fragmentName`", () => {
  expect(() => {
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
  }).toThrow(
    "Found 2 fragments. `fragmentName` must be provided when there is not exactly 1 fragment."
  );
  expect(() => {
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
  }).toThrow(
    "Found 3 fragments. `fragmentName` must be provided when there is not exactly 1 fragment."
  );
  expect(() => {
    getFragmentQueryDocument(gql`
      scalar Foo
    `);
  }).toThrow(
    "Found 0 fragments. `fragmentName` must be provided when there is not exactly 1 fragment."
  );
});

test("will create a query document where the single fragment is spread in the root query", () => {
  expect(
    getFragmentQueryDocument(gql`
      fragment foo on Foo {
        a
        b
        c
      }
    `)
  ).toMatchDocument(gql`
    {
      ...foo
    }

    fragment foo on Foo {
      a
      b
      c
    }
  `);
});

test("will create a query document where the named fragment is spread in the root query", () => {
  expect(
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
      "foo"
    )
  ).toMatchDocument(gql`
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
  `);
  expect(
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
      "bar"
    )
  ).toMatchDocument(gql`
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
  `);
  expect(
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
      "baz"
    )
  ).toMatchDocument(gql`
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
  `);
});

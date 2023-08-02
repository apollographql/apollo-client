import { GraphQLError } from "graphql";
import { TypedDocumentNode, gql } from "../index";
import { equalByQuery } from "../equalByQuery";

describe("equalByQuery", () => {
  it("is importable and a function", () => {
    expect(typeof equalByQuery).toBe("function");
  });

  it("works with a basic single-field query", () => {
    const query = gql`
      query {
        hello
      }
    `;

    expect(
      equalByQuery(query, { data: { hello: "hi" } }, { data: { hello: "hi" } })
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { hello: "hi", unrelated: 1 } },
        { data: { hello: "hi", unrelated: 100 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(query, { data: { hello: "hi" } }, { data: { hello: "hey" } })
    ).toBe(false);

    expect(equalByQuery(query, { data: {} }, { data: { hello: "hi" } })).toBe(
      false
    );

    expect(equalByQuery(query, { data: { hello: "hi" } }, { data: {} })).toBe(
      false
    );

    expect(equalByQuery(query, { data: { hello: "hi" } }, { data: null })).toBe(
      false
    );

    expect(equalByQuery(query, { data: null }, { data: { hello: "hi" } })).toBe(
      false
    );

    expect(equalByQuery(query, { data: null }, { data: null })).toBe(true);

    expect(equalByQuery(query, { data: {} }, { data: {} })).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { unrelated: "whatever" } },
        { data: { unrelated: "no matter" } }
      )
    ).toBe(true);
  });

  it("is not confused by properties in different orders", () => {
    const query = gql`
      query {
        a
        b
        c
      }
    `;

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { b: 2, c: 3, a: 1 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { d: "bogus", a: 1, b: 2, c: 3 } },
        { data: { b: 2, c: 3, a: 1, d: "also bogus" } }
      )
    ).toBe(true);
  });

  it("respects the @nonreactive directive on fields", () => {
    const query = gql`
      query {
        a
        b
        c @nonreactive
      }
    `;

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 2, c: "different" } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: "different", b: 2, c: 4 } }
      )
    ).toBe(false);
  });

  describe("@skip and @include directives", () => {
    // The @skip and @include directives use query variables to determine
    // whether subtrees of the query should be executed at all, so they can
    // influence the comparison of results in ways similar to @nonreactive. The
    // key difference is that @skip and @include will be sent to the server,
    // whereas @nonreactive is a client-only directive, and does not prevent
    // execution of nonreactive fields/subtrees on the server.
    it("respects @skip directive, depending on variables", () => {
      const skipQuery = gql`
        query SkipC($condition: Boolean!) {
          a
          b
          c @skip(if: $condition)
        }
      `;

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2, c: 3 } },
          { data: { a: 1, b: 2, c: 3 } },
          { condition: false }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2, c: 3 } },
          { data: { a: 1, b: 2 } },
          { condition: false }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2, c: 3 } },
          { data: { a: 1, b: 2 } },
          { condition: true }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2, c: 3 } },
          { condition: false }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2, c: 3 } },
          { condition: true }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2 } },
          { condition: false }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          skipQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2 } },
          { condition: true }
        )
      ).toBe(true);
    });

    it("respects @include directive, depending on variables", () => {
      const includeQuery = gql`
        query IncludeC($condition: Boolean!) {
          a
          b
          c @include(if: $condition)
        }
      `;

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2, c: 3 } },
          { data: { a: 1, b: 2, c: 3 } },
          { condition: true }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2, c: 3 } },
          { data: { a: 1, b: 2 } },
          { condition: true }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2, c: 3 } },
          { data: { a: 1, b: 2 } },
          { condition: false }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2, c: 3 } },
          { condition: true }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2, c: 3 } },
          { condition: false }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2 } },
          { condition: true }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          includeQuery,
          { data: { a: 1, b: 2 } },
          { data: { a: 1, b: 2 } },
          { condition: false }
        )
      ).toBe(true);
    });
  });

  it("considers errors as well as data", () => {
    const query = gql`
      query {
        a
        b @nonreactive
        c
      }
    `;

    const data123 = { a: 1, b: 2, c: 3 };
    const oopsError = new GraphQLError("oops");
    const differentError = new GraphQLError("different");

    expect(
      equalByQuery(
        query,
        { data: data123 },
        { data: data123, errors: [oopsError] }
      )
    ).toBe(false);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [oopsError] },
        { data: data123 }
      )
    ).toBe(false);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [oopsError] },
        { data: data123, errors: [oopsError] }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [oopsError] },
        { data: data123, errors: [differentError] }
      )
    ).toBe(false);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [oopsError] },
        { data: data123, errors: [oopsError] }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [oopsError] },
        { data: { ...data123, b: 100 }, errors: [oopsError] }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [] },
        { data: data123, errors: [] }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: data123, errors: [] },
        { data: { ...data123, b: 100 }, errors: [] }
      )
    ).toBe(true);
  });

  it("respects the @nonreactive directive on inline fragments", () => {
    const query = gql`
      query {
        a
        ... @nonreactive {
          b
          c
        }
      }
    `;

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 30 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 10, b: 20, c: 30 } }
      )
    ).toBe(false);
  });

  it("respects the @nonreactive directive on named fragment ...spreads", () => {
    const query = gql`
      query {
        a
        ...BCFragment @nonreactive
      }

      fragment BCFragment on Query {
        b
        c
      }
    `;

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 2, c: 30 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 3 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 30 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 10, b: 20, c: 30 } }
      )
    ).toBe(false);
  });

  it("respects the @nonreactive directive on named fragment definitions", () => {
    const query = gql`
      query {
        a
        ...BCFragment
      }

      fragment BCFragment on Query @nonreactive {
        b
        c
      }
    `;

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 2, c: 30 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 3 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 30 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 10, b: 20, c: 30 } }
      )
    ).toBe(false);
  });

  it("traverses fragments without @nonreactive", () => {
    const query = gql`
      query {
        a
        ...BCFragment
      }

      fragment BCFragment on Query {
        b
        c
      }
    `;

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 2, c: 3 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { c: 3, a: 1, b: 2 } }
      )
    ).toBe(true);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 2, c: 30 } }
      )
    ).toBe(false);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 3 } }
      )
    ).toBe(false);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 1, b: 20, c: 30 } }
      )
    ).toBe(false);

    expect(
      equalByQuery(
        query,
        { data: { a: 1, b: 2, c: 3 } },
        { data: { a: 10, b: 20, c: 30 } }
      )
    ).toBe(false);
  });

  type Thing = {
    __typename: "Thing";
    id: string;
    stable: number;
    volatile: number;
  };

  it.each<TypedDocumentNode<Thing>>([
    gql`
      query {
        things {
          __typename
          id
          stable
          volatile @nonreactive
        }
      }
    `,
    gql`
      query {
        things {
          __typename
          id
          ...ThingDetails
        }
      }

      fragment ThingDetails on Thing {
        stable
        volatile @nonreactive
      }
    `,
    gql`
      query {
        things {
          __typename
          id
          ... on Thing {
            stable
            volatile @nonreactive
          }
        }
      }
    `,
    gql`
      query {
        things {
          __typename
          id
          stable
          ... on Thing @nonreactive {
            volatile
          }
        }
      }
    `,
    gql`
      query {
        things {
          __typename
          id
          stable
          ...Volatile @nonreactive
        }
      }

      fragment Volatile on Thing {
        volatile
      }
    `,
    gql`
      query {
        things {
          __typename
          id
          stable
          ... @nonreactive {
            volatile
          }
        }
      }
    `,
  ])(
    "iterates over array-valued result fields ignoring @nonreactive (%#)",
    (query) => {
      let nextVolatileIntegerPart = 0;
      const makeThing = (id: string, stable = 1): Thing => ({
        __typename: "Thing",
        id,
        stable,
        // Thing.volatile is always a different randomized number, which normally
        // would threatens any deep comparison of Thing objects. These test cases
        // demonstrate (among other things) that we can make the result comparison
        // insensitive to this volatility by marking the volatile field with the
        // @nonreactive directive.
        volatile: nextVolatileIntegerPart++ + Math.random(),
      });

      const makeThings = (
        lettersToSplit: string,
        stable: number = 1
      ): Thing[] => lettersToSplit.split("").map((id) => makeThing(id, stable));

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("abc") } },
          { data: { things: [makeThing("a"), makeThing("b"), makeThing("c")] } }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("abcdefg", 2) } },
          { data: { things: makeThings("abcdefg") } }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("abcdefg", 2) } },
          { data: { things: makeThings("abcdefg", 3) } }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("abcdefg", 3) } },
          { data: { things: makeThings("abcdefg", 3) } }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("ab", 2345) } },
          { data: { things: [makeThing("a"), makeThing("b", 2345)] } }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("ab", 3456) } },
          { data: { things: [makeThing("a", 3456), makeThing("b")] } }
        )
      ).toBe(false);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("ab", 3456) } },
          { data: { things: [makeThing("a", 3456), makeThing("b", 3456)] } }
        )
      ).toBe(true);

      expect(
        equalByQuery(
          query,
          { data: { things: makeThings("abc") } },
          { data: { things: "not an array" } }
        )
      ).toBe(false);

      expect(
        equalByQuery(query, { data: { things: {} } }, { data: { things: [] } })
      ).toBe(false);

      expect(
        equalByQuery(query, { data: { things: [] } }, { data: { things: {} } })
      ).toBe(false);

      expect(
        equalByQuery(query, { data: { things: [] } }, { data: { things: [] } })
      ).toBe(true);

      expect(
        equalByQuery(
          query,
          // There's nothing inherently array-like about the Query.things field as
          // it's represented in query syntax, since `query { things { id } }` could
          // (depending on the server/schema) return a single object for the things
          // field, rather than an array. Although this might seem like a strange
          // edge case to test, it demonstrates the equalByQuery function can handle
          // any combination of array/non-array values.
          { data: { things: {} } },
          { data: { things: {} } }
        )
      ).toBe(true);
    }
  );
});

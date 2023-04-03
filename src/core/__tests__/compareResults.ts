import { GraphQLError } from "graphql";
import { gql } from "../index";
import { compareResultsUsingQuery } from "../compareResults";

describe("compareResultsUsingQuery", () => {
  it("is importable and a function", () => {
    expect(typeof compareResultsUsingQuery).toBe("function");
  });

  it("works with a basic single-field query", () => {
    const query = gql`
      query {
        hello
      }
    `;

    expect(compareResultsUsingQuery(
      query,
      { data: { hello: "hi" } },
      { data: { hello: "hi" } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { hello: "hi", unrelated: 1 } },
      { data: { hello: "hi", unrelated: 100 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { hello: "hi" } },
      { data: { hello: "hey" } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: {} },
      { data: { hello: "hi" } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { hello: "hi" } },
      { data: {} },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { hello: "hi" } },
      { data: null },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: null },
      { data: { hello: "hi" } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: null },
      { data: null },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: {} },
      { data: {} },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { unrelated: "whatever" } },
      { data: { unrelated: "no matter" } },
    )).toBe(true);
  });

  it("is not confused by properties in different orders", () => {
    const query = gql`
      query {
        a
        b
        c
      }
    `;

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { b: 2, c: 3, a: 1 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { d: "bogus", a: 1, b: 2, c: 3 } },
      { data: { b: 2, c: 3, a: 1, d: "also bogus" } },
    )).toBe(true);
  });

  it("respects the @nonreactive directive on fields", () => {
    const query = gql`
      query {
        a
        b
        c @nonreactive
      }
    `;

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 2, c: "different" } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: "different", b: 2, c: 4 } },
    )).toBe(false);
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

    expect(compareResultsUsingQuery(
      query,
      { data: data123 },
      { data: data123, errors: [oopsError] },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [oopsError] },
      { data: data123 },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [oopsError] },
      { data: data123, errors: [oopsError] },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [oopsError] },
      { data: data123, errors: [differentError] },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [oopsError] },
      { data: data123, errors: [oopsError] },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [oopsError] },
      { data: { ...data123, b: 100 }, errors: [oopsError] },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [] },
      { data: data123, errors: [] },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: data123, errors: [] },
      { data: { ...data123, b: 100 }, errors: [] },
    )).toBe(true);
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

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 30 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 10, b: 20, c: 30 } },
    )).toBe(false);
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

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 2, c: 30 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 3 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 30 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 10, b: 20, c: 30 } },
    )).toBe(false);
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

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 2, c: 30 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 3 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 30 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 10, b: 20, c: 30 } },
    )).toBe(false);
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

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 2, c: 3 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { c: 3, a: 1, b: 2 } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 2, c: 30 } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 3 } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 1, b: 20, c: 30 } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { a: 1, b: 2, c: 3 } },
      { data: { a: 10, b: 20, c: 30 } },
    )).toBe(false);
  });

  it("iterates over array-valued result fields", () => {
    const query = gql`
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
    `;

    const makeThing = (id: string, stable = 1234) => ({
      __typename: "Thing",
      id,
      stable,
      volatile: Math.random(),
    });

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "abc".split("").map(id => makeThing(id)) } },
      { data: { things: [makeThing("a"), makeThing("b"), makeThing("c")] } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "abc".split("").map(id => makeThing(id)) } },
      { data: { things: "not an array" } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: {} } },
      { data: { things: [] } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: [] } },
      { data: { things: {} } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: [] } },
      { data: { things: [] } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: {} } },
      { data: { things: {} } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "ab".split("").map(id => makeThing(id)) } },
      { data: { things: [makeThing("a"), makeThing("b")] } },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "ab".split("").map(id => makeThing(id)) } },
      { data: { things: [makeThing("b"), makeThing("a")] } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "ab".split("").map(id => makeThing(id)) } },
      { data: { things: [makeThing("a"), makeThing("b", 2345)] } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "ab".split("").map(id => makeThing(id)) } },
      { data: { things: [makeThing("a", 3456), makeThing("b")] } },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { data: { things: "ab".split("").map(id => makeThing(id)) } },
      { data: { things: [makeThing("b"), makeThing("a")] } },
    )).toBe(false);
  });
});

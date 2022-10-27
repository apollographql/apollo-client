import { gql } from "../../../core";
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
      { hello: "hi" },
      { hello: "hi" },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { hello: "hi", unrelated: 1 },
      { hello: "hi", unrelated: 100 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { hello: "hi" },
      { hello: "hey" },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      {},
      { hello: "hi" },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { hello: "hi" },
      {},
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { hello: "hi" },
      null,
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      null,
      { hello: "hi" },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      null,
      null,
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      {},
      {},
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { unrelated: "whatever" },
      { unrelated: "no matter" },
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
      { a: 1, b: 2, c: 3 },
      { b: 2, c: 3, a: 1 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { d: "bogus", a: 1, b: 2, c: 3 },
      { b: 2, c: 3, a: 1, d: "also bogus" },
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
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, c: "different" },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: "different", b: 2, c: 4 },
    )).toBe(false);
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
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 30 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 20, c: 30 },
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
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, c: 30 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 3 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 30 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 20, c: 30 },
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
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, c: 30 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 3 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 30 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 20, c: 30 },
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
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, c: 3 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { c: 3, a: 1, b: 2 },
    )).toBe(true);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, c: 30 },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 3 },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 20, c: 30 },
    )).toBe(false);

    expect(compareResultsUsingQuery(
      query,
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 20, c: 30 },
    )).toBe(false);
  });
});

import { makeExecutableSchema } from "@graphql-tools/schema";
import { gql } from "graphql-tag";

import { execute } from "@apollo/client/link/core";
import { SchemaLink } from "@apollo/client/link/schema";
import { ObservableStream } from "@apollo/client/testing/internal";

const sampleQuery = gql`
  query SampleQuery {
    sampleQuery {
      id
    }
  }
`;

const typeDefs = `
type Stub {
  id: String
}

type Query {
  sampleQuery: Stub
}
`;

const schema = makeExecutableSchema({ typeDefs });

describe("SchemaLink", () => {
  it("raises warning if called with concat", () => {
    const link = new SchemaLink({ schema });
    const _warn = console.warn;
    console.warn = (...args) =>
      expect(args).toEqual([
        "You are calling concat on a terminating link, which will have no effect %o",
        link,
      ]);
    expect(link.concat((operation, forward) => forward(operation))).toEqual(
      link
    );
    console.warn = _warn;
  });

  it("throws if no arguments given", () => {
    expect(() => new (SchemaLink as any)()).toThrow();
  });

  it("correctly receives the constructor arguments", () => {
    let rootValue = {};
    let link = new SchemaLink({ schema, rootValue });
    expect(link.rootValue).toEqual(rootValue);
    expect(link.schema).toEqual(schema);
  });

  it("calls next and then complete", async () => {
    const link = new SchemaLink({ schema });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
  });

  it("calls error when fetch fails", async () => {
    const link = new SchemaLink({
      validate: true,
      schema: makeExecutableSchema({
        typeDefs,
        resolvers: {
          Query: {
            sampleQuery() {
              throw new Error("Unauthorized");
            },
          },
        },
      }),
    });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: { sampleQuery: null },
      errors: [{ message: "Unauthorized", path: ["sampleQuery"] }],
    });
  });

  it("supports query which is executed synchronously", async () => {
    const link = new SchemaLink({ schema });
    const introspectionQuery = gql`
      query IntrospectionQuery {
        __schema {
          types {
            name
          }
        }
      }
    `;
    const observable = execute(link, {
      query: introspectionQuery,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
  });

  it("passes operation context into execute with context function", async () => {
    const contextValue = { some: "value" };
    const contextProvider = jest.fn((operation) => operation.getContext());
    const resolvers = {
      Query: {
        sampleQuery: (root: any, args: any, context: any) => {
          expect(context).toEqual(contextValue);
        },
      },
    };
    const schemaWithResolvers = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    const link = new SchemaLink({
      schema: schemaWithResolvers,
      context: contextProvider,
    });
    const observable = execute(link, {
      query: sampleQuery,
      context: contextValue,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
    expect(contextProvider).toHaveBeenCalledTimes(1);
  });

  it("passes static context into execute", async () => {
    const contextValue = { some: "value" };
    const resolver = jest.fn((root, args, context) => {
      expect(context).toEqual(contextValue);
    });

    const resolvers = {
      Query: {
        sampleQuery: resolver,
      },
    };
    const schemaWithResolvers = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    const link = new SchemaLink({
      schema: schemaWithResolvers,
      context: contextValue,
    });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitNext();
    await expect(stream).toComplete();
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("reports errors for unknown queries", async () => {
    const link = new SchemaLink({
      validate: true,
      schema: makeExecutableSchema({
        typeDefs,
      }),
    });
    const observable = execute(link, {
      query: gql`
        query {
          unknown
        }
      `,
    });
    const stream = new ObservableStream(observable);
    await expect(stream).toEmitValue({
      errors: [{ message: 'Cannot query field "unknown" on type "Query".' }],
    });
  });
});

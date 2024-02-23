import * as React from "react";
import { ApolloClient, InMemoryCache, gql } from "../../core/index.js";
import { SchemaLink } from "../../link/schema/index.js";
import {
  createProfiler,
  renderWithClient,
  useTrackRenders,
} from "../internal/index.js";
import { proxiedSchema } from "./schemaProxy.js";
import { buildSchema } from "graphql";
import { useSuspenseQuery } from "../../react/index.js";
import { createMockSchema } from "../graphql-tools/utils.js";

const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    age: Int!
    name: String!
    image: UserImage!
    book: Book!
  }

  type Author {
    _id: ID!
    name: String!
    book: Book!
  }

  union UserImage = UserImageSolidColor | UserImageURL

  type UserImageSolidColor {
    color: String!
  }

  type UserImageURL {
    url: String!
  }

  scalar Date

  interface Book {
    id: ID!
    title: String
    publishedAt: Date
  }

  type TextBook implements Book {
    id: ID!
    title: String
    publishedAt: Date
    text: String
  }

  type ColoringBook implements Book {
    id: ID!
    title: String
    publishedAt: Date
    colors: [String]
  }

  type Query {
    viewer: User!
    userById(id: ID!): User!
    author: Author!
  }

  type Mutation {
    changeViewerName(newName: String!): User!
  }
`;

const schemaWithTypeDefs = buildSchema(typeDefs);

describe("schema proxy", () => {
  const _schema = createMockSchema(schemaWithTypeDefs, {
    ID: () => "1",
    Int: () => 42,
    String: () => "String",
    Date: () => new Date("January 1, 2024 01:00:00").toJSON().split("T")[0],
  });

  const schema = proxiedSchema(_schema, {
    Query: {
      viewer: () => ({
        name: "Jane Doe",
        book: {
          text: "Hello World",
          title: "The Book",
        },
      }),
    },
    Book: {
      __resolveType: (obj) => {
        if ("text" in obj) {
          return "TextBook";
        }
        if ("colors" in obj) {
          return "ColoringBook";
        }
        throw new Error("Could not resolve type");
      },
    },
  });

  it("should allow adding scalar mocks and resolvers", async () => {
    const Profiler = createProfiler({
      initialSnapshot: {
        result: null,
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new SchemaLink({
        schema,
      }),
    });

    const query = gql`
      query {
        viewer {
          id
          name
          age
          book {
            id
            title
            publishedAt
          }
        }
      }
    `;

    const Fallback = () => {
      useTrackRenders();
      return <div>Loading...</div>;
    };

    const App = () => {
      return (
        <React.Suspense fallback={<Fallback />}>
          <Child />
        </React.Suspense>
      );
    };

    const Child = () => {
      const result = useSuspenseQuery(query);

      useTrackRenders();

      Profiler.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    const { unmount } = renderWithClient(<App />, {
      client,
      wrapper: Profiler,
    });

    // initial suspended render
    await Profiler.takeRender();

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          name: "Jane Doe",
          book: {
            __typename: "TextBook",
            id: "1",
            publishedAt: "2024-01-01",
            title: "The Book",
          },
        },
      });
    }

    unmount();
  });

  it("should allow schema forking with .fork", async () => {
    const forkedSchema = schema.fork().withResolvers({
      Query: {
        viewer: () => ({
          book: {
            colors: ["red", "blue", "green"],
            title: "The Book",
          },
        }),
      },
    });

    const Profiler = createProfiler({
      initialSnapshot: {
        result: null,
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new SchemaLink({
        schema: forkedSchema,
      }),
    });

    const query = gql`
      query {
        viewer {
          id
          name
          age
          book {
            id
            title
            publishedAt
          }
        }
      }
    `;

    const Fallback = () => {
      useTrackRenders();
      return <div>Loading...</div>;
    };

    const App = () => {
      return (
        <React.Suspense fallback={<Fallback />}>
          <Child />
        </React.Suspense>
      );
    };

    const Child = () => {
      const result = useSuspenseQuery(query);

      useTrackRenders();

      Profiler.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    const { unmount } = renderWithClient(<App />, {
      client,
      wrapper: Profiler,
    });

    // initial suspended render
    await Profiler.takeRender();

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          // In our resolvers defined in this test, we omit name so it uses
          // the scalar default mock
          name: "String",
          book: {
            // locally overrode the resolver for the book field
            __typename: "ColoringBook",
            id: "1",
            publishedAt: "2024-01-01",
            title: "The Book",
          },
        },
      });
    }

    unmount();
  });

  it("should not pollute the original schema", async () => {
    const Profiler = createProfiler({
      initialSnapshot: {
        result: null,
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new SchemaLink({
        schema,
      }),
    });

    const query = gql`
      query {
        viewer {
          id
          name
          age
          book {
            id
            title
            publishedAt
          }
        }
      }
    `;

    const Fallback = () => {
      useTrackRenders();
      return <div>Loading...</div>;
    };

    const App = () => {
      return (
        <React.Suspense fallback={<Fallback />}>
          <Child />
        </React.Suspense>
      );
    };

    const Child = () => {
      const result = useSuspenseQuery(query);

      useTrackRenders();

      Profiler.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    const { unmount } = renderWithClient(<App />, {
      client,
      wrapper: Profiler,
    });

    // initial suspended render
    await Profiler.takeRender();

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          name: "Jane Doe",
          book: {
            __typename: "TextBook",
            id: "1",
            publishedAt: "2024-01-01",
            title: "The Book",
          },
        },
      });
    }

    unmount();
  });
});

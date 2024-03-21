import * as React from "react";
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  gql,
} from "../../core/index.js";
import type { TypedDocumentNode } from "../../core/index.js";
import {
  createProfiler,
  renderWithClient,
  useTrackRenders,
} from "../internal/index.js";
import { proxiedSchema } from "./schemaProxy.js";
import { buildSchema } from "graphql";
import type { UseSuspenseQueryResult } from "../../react/index.js";
import { useMutation, useSuspenseQuery } from "../../react/index.js";
import { createMockSchema } from "../graphql-tools/utils.js";
import userEvent from "@testing-library/user-event";
import { act, screen } from "@testing-library/react";
import { createMockFetch } from "./mockFetchWithSchema.js";

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

function createDefaultProfiler<TData = unknown>() {
  return createProfiler({
    initialSnapshot: {
      result: null as UseSuspenseQueryResult<TData> | null,
    },
  });
}

interface ViewerQueryData {
  viewer: {
    id: string;
    name: string;
    age: number;
    book: {
      id: string;
      title: string;
      publishedAt: string;
    };
  };
}

describe("schema proxy", () => {
  const schemaWithMocks = createMockSchema(schemaWithTypeDefs, {
    ID: () => "1",
    Int: () => 42,
    String: () => "String",
    Date: () => new Date("January 1, 2024 01:00:00").toJSON().split("T")[0],
  });

  const schema = proxiedSchema(schemaWithMocks, {
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
    const Profiler = createDefaultProfiler<ViewerQueryData>();
    const mockFetch = createMockFetch(schema);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch: mockFetch }),
    });

    const query: TypedDocumentNode<ViewerQueryData> = gql`
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

      expect(snapshot.result?.data).toEqual({
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
    const forkedSchema = schema.forkWithResolvers({
      Query: {
        viewer: () => ({
          book: {
            colors: ["red", "blue", "green"],
            title: "The Book",
          },
        }),
      },
    });

    const Profiler = createDefaultProfiler<ViewerQueryData>();
    const mockFetch = createMockFetch(forkedSchema);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch: mockFetch }),
    });

    const query: TypedDocumentNode<ViewerQueryData> = gql`
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

      expect(snapshot.result?.data).toEqual({
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
    const Profiler = createDefaultProfiler<ViewerQueryData>();
    const mockFetch = createMockFetch(schema);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch: mockFetch }),
    });

    const query: TypedDocumentNode<ViewerQueryData> = gql`
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

      expect(snapshot.result?.data).toEqual({
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

  it("should handle mutations", async () => {
    const query: TypedDocumentNode<ViewerQueryData> = gql`
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

    let name = "Jane Doe";

    const forkedSchema = schema.forkWithResolvers({
      Query: {
        viewer: () => ({
          book: {
            text: "Hello World",
            title: "The Book",
          },
        }),
      },
      User: {
        name: () => name,
      },
      Mutation: {
        changeViewerName: (_: any, { newName }: { newName: string }) => {
          name = newName;
          return {};
        },
      },
    });

    const Profiler = createDefaultProfiler<ViewerQueryData>();

    const mockFetch = createMockFetch(forkedSchema);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch: mockFetch }),
    });

    const mutation = gql`
      mutation {
        changeViewerName(newName: "Alexandre") {
          id
          name
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
      const [changeViewerName] = useMutation(mutation);

      useTrackRenders();

      Profiler.mergeSnapshot({
        result,
      } as Partial<{}>);

      return (
        <div>
          <button onClick={() => changeViewerName()}>Change name</button>
          Hello
        </div>
      );
    };

    const user = userEvent.setup();

    const { unmount } = renderWithClient(<App />, {
      client,
      wrapper: Profiler,
    });

    // initial suspended render
    await Profiler.takeRender();

    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          // In our resolvers defined in this test, we omit name so it uses
          // the scalar default mock
          name: "Jane Doe",
          book: {
            // locally overrode the resolver for the book field
            __typename: "TextBook",
            id: "1",
            publishedAt: "2024-01-01",
            title: "The Book",
          },
        },
      });
    }

    await act(() => user.click(screen.getByText("Change name")));

    // initial suspended render
    await Profiler.takeRender();
    {
      const { snapshot } = await Profiler.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          // In our resolvers defined in this test, we omit name so it uses
          // the scalar default mock
          name: "Alexandre",
          book: {
            // locally overrode the resolver for the book field
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

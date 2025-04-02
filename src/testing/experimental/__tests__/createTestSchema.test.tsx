import { screen } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  RenderStream,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import { buildSchema } from "graphql";
import * as React from "react";
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
} from "react-error-boundary";

import type { TypedDocumentNode } from "@apollo/client/core";
import {
  ApolloClient,
  CombinedGraphQLErrors,
  gql,
  InMemoryCache,
} from "@apollo/client/core";
import type { UseSuspenseQueryResult } from "@apollo/client/react";
import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import {
  createClientWrapper,
  spyOnConsole,
} from "@apollo/client/testing/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { createSchemaFetch } from "../createSchemaFetch.js";
import { createTestSchema } from "../createTestSchema.js";

const IS_REACT_19 = React.version.startsWith("19");

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

const uri = "https://localhost:3000/graphql";

function createDefaultProfiler<TData = unknown>() {
  return createRenderStream({
    initialSnapshot: {
      result: null as UseSuspenseQueryResult<TData> | null,
    },
  });
}

function createErrorProfiler<TData = unknown>() {
  return createRenderStream({
    initialSnapshot: {
      error: null as Error | null,
      result: null as UseSuspenseQueryResult<TData> | null,
    },
  });
}

function createTrackedErrorComponents<Snapshot extends { error: Error | null }>(
  renderStream: RenderStream<Snapshot>
) {
  function ErrorFallback({ error }: FallbackProps) {
    renderStream.mergeSnapshot({ error } as Partial<Snapshot>);

    return <div>Error</div>;
  }

  function ErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
      <ReactErrorBoundary FallbackComponent={ErrorFallback}>
        {children}
      </ReactErrorBoundary>
    );
  }

  return { ErrorBoundary };
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
  const schema = createTestSchema(schemaWithTypeDefs, {
    resolvers: {
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
    },
    scalars: {
      ID: () => "1",
      Int: () => 42,
      String: () => "String",
      Date: () => new Date("January 1, 2024 01:00:00").toJSON().split("T")[0],
    },
  });

  it("mocks scalars and resolvers", async () => {
    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    using _fetch = createSchemaFetch(schema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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

      renderStream.mergeSnapshot({
        result,
      });

      return <div>Hello</div>;
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

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
  });

  it("allows schema forking with .fork", async () => {
    const forkedSchema = schema.fork({
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              colors: ["red", "blue", "green"],
              title: "The Book",
            },
          }),
        },
      },
    });

    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    using _fetch = createSchemaFetch(forkedSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
    });

    const query: TypedDocumentNode<ViewerQueryData> = gql`
      query ViewerQuery {
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

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

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
  });

  it("schema.fork does not pollute the original schema", async () => {
    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    schema.fork({
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              colors: ["red", "blue", "green"],
              title: "The Book",
            },
          }),
        },
      },
    });

    using _fetch = createSchemaFetch(schema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

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
  });

  it("allows you to call .fork without providing resolvers", async () => {
    const forkedSchema = schema.fork();

    forkedSchema.add({
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              colors: ["red", "blue", "green"],
              title: "The Book",
            },
          }),
        },
      },
    });

    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    using _fetch = createSchemaFetch(forkedSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          // since we called .add and provided a new `viewer` resolver
          // _without_ providing the viewer.name field in the response data,
          // it renders with the default scalar mock for String
          name: "String",
          book: {
            __typename: "ColoringBook",
            id: "1",
            publishedAt: "2024-01-01",
            title: "The Book",
          },
        },
      });
    }
  });

  it("handles mutations", async () => {
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

    const forkedSchema = schema.fork({
      resolvers: {
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
      },
    });

    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    using _fetch = createSchemaFetch(forkedSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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

      renderStream.mergeSnapshot({
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

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
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

    await user.click(screen.getByText("Change name"));

    // initial suspended render
    await renderStream.takeRender();
    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
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
  });

  it("returns GraphQL errors", async () => {
    using _consoleSpy = spyOnConsole("error");
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

    const forkedSchema = schema.fork({
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              // text: "Hello World", <- this will cause a validation error
              title: "The Book",
            },
          }),
        },
        User: {
          name: () => name,
        },
      },
    });

    using _disabledAct = disableActEnvironment();
    const renderStream = createErrorProfiler<ViewerQueryData>();

    const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

    using _fetch = createSchemaFetch(forkedSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
    });

    const Fallback = () => {
      return <div>Loading...</div>;
    };

    const App = () => {
      return (
        <React.Suspense fallback={<Fallback />}>
          <ErrorBoundary>
            <Child />
          </ErrorBoundary>
        </React.Suspense>
      );
    };

    const Child = () => {
      const result = useSuspenseQuery(query);

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.error).toEqual(
        new CombinedGraphQLErrors({
          data: null,
          errors: [
            { message: "Could not resolve type", path: ["viewer", "book"] },
          ],
        })
      );
    }
  });

  it("validates schema by default and returns validation errors", async () => {
    using _consoleSpy = spyOnConsole("error");
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

    // invalid schema
    const forkedSchema = { foo: "bar" };

    using _disabledAct = disableActEnvironment();
    const renderStream = createErrorProfiler<ViewerQueryData>();

    const { ErrorBoundary } = createTrackedErrorComponents(renderStream);

    // @ts-expect-error - we're intentionally passing an invalid schema
    using _fetch = createSchemaFetch(forkedSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
    });

    const Fallback = () => {
      return <div>Loading...</div>;
    };

    const App = () => {
      return (
        <React.Suspense fallback={<Fallback />}>
          <ErrorBoundary>
            <Child />
          </ErrorBoundary>
        </React.Suspense>
      );
    };

    const Child = () => {
      const result = useSuspenseQuery(query);

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.error).toEqual(
        new CombinedGraphQLErrors({
          errors: [
            { message: 'Expected { foo: "bar" } to be a GraphQL schema.' },
          ],
        })
      );
    }
  });

  it("preserves resolvers from previous calls to .add on subsequent calls to .fork", async () => {
    let name = "Virginia";

    const schema = createTestSchema(schemaWithTypeDefs, {
      resolvers: {
        Query: {
          viewer: () => ({
            name,
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
      },
      scalars: {
        ID: () => "1",
        Int: () => 42,
        String: () => "String",
        Date: () => new Date("January 1, 2024 01:00:00").toJSON().split("T")[0],
      },
    });

    schema.add({
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              colors: ["red", "blue", "green"],
              title: "A New Book",
            },
          }),
        },
      },
    });

    schema.add({
      resolvers: {
        User: {
          name: () => name,
        },
      },
    });

    // should preserve resolvers from previous calls to .add
    const forkedSchema = schema.fork({
      resolvers: {
        Mutation: {
          changeViewerName: (_: any, { newName }: { newName: string }) => {
            name = newName;
            return {};
          },
        },
      },
    });

    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    using _fetch = createSchemaFetch(forkedSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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
            ... on ColoringBook {
              colors
            }
          }
        }
      }
    `;

    const mutation = gql`
      mutation {
        changeViewerName(newName: "Alexandre") {
          id
          name
        }
      }
    `;

    const Fallback = () => {
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

      renderStream.mergeSnapshot({
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

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          name: "Virginia",
          book: {
            __typename: "ColoringBook",
            colors: ["red", "blue", "green"],
            id: "1",
            publishedAt: "2024-01-01",
            title: "A New Book",
          },
        },
      });
    }

    await user.click(screen.getByText("Change name"));

    await renderStream.takeRender();
    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          name: "Alexandre",
          book: {
            __typename: "ColoringBook",
            colors: ["red", "blue", "green"],
            id: "1",
            publishedAt: "2024-01-01",
            title: "A New Book",
          },
        },
      });
    }
  });

  it("resets the schema with schema.reset()", async () => {
    const resetTestSchema = createTestSchema(schema, {
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              text: "Hello World",
              title: "Orlando: A Biography",
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
      },
    });
    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    resetTestSchema.add({
      resolvers: {
        Query: {
          viewer: () => ({
            book: {
              text: "Hello World",
              title: "The Waves",
            },
          }),
        },
      },
    });

    using _fetch = createSchemaFetch(resetTestSchema).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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
            ... on ColoringBook {
              colors
            }
          }
        }
      }
    `;

    const Fallback = () => {
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

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return (
        <div>
          Hello<button onClick={() => result.refetch()}>Refetch</button>
        </div>
      );
    };

    renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          name: "String",
          book: {
            __typename: "TextBook",
            id: "1",
            publishedAt: "2024-01-01",
            // value set in this test with .add
            title: "The Waves",
          },
        },
      });
    }

    resetTestSchema.reset();

    const user = userEvent.setup();

    await user.click(screen.getByText("Refetch"));

    // initial suspended render
    await renderStream.takeRender();

    {
      const { snapshot } = await renderStream.takeRender();

      expect(snapshot.result?.data).toEqual({
        viewer: {
          __typename: "User",
          age: 42,
          id: "1",
          name: "String",
          book: {
            __typename: "TextBook",
            id: "1",
            publishedAt: "2024-01-01",
            // original value
            title: "Orlando: A Biography",
          },
        },
      });
    }
  });

  it("createSchemaFetch respects min and max delay", async () => {
    using _disabledAct = disableActEnvironment();
    const renderStream = createDefaultProfiler<ViewerQueryData>();

    const minDelay = 1500;
    const maxDelay = 2000;

    using _fetch = createSchemaFetch(schema, {
      delay: { min: minDelay, max: maxDelay },
    }).mockGlobal();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      uri,
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

      renderStream.mergeSnapshot({
        result,
      } as Partial<{}>);

      return <div>Hello</div>;
    };

    await renderStream.render(<App />, {
      wrapper: createClientWrapper(client),
    });

    // initial suspended render
    await renderStream.takeRender();

    if (IS_REACT_19) {
      // not sure why we have this additional commit
      expect((await renderStream.takeRender()).snapshot).toStrictEqual({
        result: null,
      });
    }

    await expect(renderStream).not.toRerender({ timeout: minDelay - 100 });

    {
      const { snapshot } = await renderStream.takeRender({
        // This timeout doesn't start until after our `minDelay - 100`
        // timeout above, so we don't have to wait the full `maxDelay`
        // here.
        // Instead we can just wait for the difference between `maxDelay`
        // and `minDelay`, plus a bit to prevent flakiness.
        timeout: maxDelay - minDelay + 110,
      });

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
  });

  it("should call invariant.error if min delay is greater than max delay", async () => {
    await expect(async () => {
      createSchemaFetch(schema, {
        delay: { min: 3000, max: 1000 },
      });
    }).rejects.toThrow(
      new InvariantError(
        "Please configure a minimum delay that is less than the maximum delay. The default minimum delay is 3ms."
      )
    );
  });
});

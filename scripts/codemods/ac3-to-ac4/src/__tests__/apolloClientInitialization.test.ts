import { applyTransform } from "jscodeshift/dist/testUtils";
import { describe, expect, test } from "vitest";

import type { Steps } from "../apolloClientInitialization.js";
import apolloClientInitializationTransform from "../apolloClientInitialization.js";

const transform =
  (...enabledSteps: Steps[]) =>
  ([source]: TemplateStringsArray) =>
    applyTransform(
      apolloClientInitializationTransform,
      {
        apolloClientInitialization:
          enabledSteps.length > 0 ? enabledSteps : undefined,
      },
      { source, path: "test.ts" },
      { parser: "ts" }
    );

describe("all transforms", () => {
  test("kitchen sink 1", () => {
    expect(transform()`
import { ApolloClient, InMemoryCache } from "@apollo/client";

export const client = new ApolloClient<MyCacheShape>({
  uri: "/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
  cache: new InMemoryCache(),
  ssrForceFetchDelay: 50,
  ssrMode: true,
  connectToDevTools: true,
  queryDeduplication: true,
  defaultOptions: {},
  defaultContext: {},
  assumeImmutableResults: true,
  resolvers: myResolvers,
  typeDefs: mySchema,
  fragmentMatcher: () => true,
  name: "my-client",
  version: "1.0.0",
  documentTransform: myDocumentTransform,
  dataMasking: true
  })
    `).toMatchInlineSnapshot(`
      "import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

      import { Defer20220824Handler } from "@apollo/client/incremental";
      import { LocalState } from "@apollo/client/local-state";

      export const client = new ApolloClient({
        cache: new InMemoryCache(),
        ssrForceFetchDelay: 50,
        ssrMode: true,
        queryDeduplication: true,
        defaultOptions: {},
        defaultContext: {},
        assumeImmutableResults: true,
        documentTransform: myDocumentTransform,

        /*
        Inserted by Apollo Client 3->4 migration codemod.
        Keep this comment here if you intend to run the codemod again,
        to avoid changes from being reapplied.
        Delete this comment once you are done with the migration.
        @apollo/client-codemod-migrate-3-to-4 applied
        */
        dataMasking: true,

        link: new HttpLink({
          uri: "/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        }),

        clientAwareness: {
          name: "my-client",
          version: "1.0.0"
        },

        localState: new LocalState({
          resolvers: myResolvers
        }),

        devtools: {
          enabled: true
        },

        /*
        Inserted by Apollo Client 3->4 migration codemod.
        If you are not using the \`@defer\` directive in your application,
        you can safely remove this option.
        */
        incrementalHandler: new Defer20220824Handler()
      })

      /*
      Start: Inserted by Apollo Client 3->4 migration codemod.
      Copy the contents of this block into a \`.d.ts\` file in your project
      to enable data masking types.
      */


      import "@apollo/client";
      import { GraphQLCodegenDataMasking } from "@apollo/client/masking";

      declare module "@apollo/client" {
        export interface TypeOverrides extends GraphQLCodegenDataMasking.TypeOverrides {}
      }

      /*
      End: Inserted by Apollo Client 3->4 migration codemod.
      */


      /*
      Start: Inserted by Apollo Client 3->4 migration codemod.
      Copy the contents of this block into a \`.d.ts\` file in your project to enable correct response types in your custom links.
      If you do not use the \`@defer\` directive in your application, you can safely remove this block.
      */


      import "@apollo/client";
      import { Defer20220824Handler } from "@apollo/client/incremental";

      declare module "@apollo/client" {
        export interface TypeOverrides extends Defer20220824Handler.TypeOverrides {}
      }

      /*
      End: Inserted by Apollo Client 3->4 migration codemod.
      */"
    `);
  });

  test("Apollo Client renamed", () => {
    expect(transform()`
import { ApolloClient as RenamedApolloClient, SomethingElse as ApolloClient, InMemoryCache } from "@apollo/client";

export const dontTouchThis: ApolloClient<MyCacheShape> = new ApolloClient<MyCacheShape>({
  uri: "/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
  cache: new InMemoryCache(),
  ssrForceFetchDelay: 50,
  ssrMode: true,
  connectToDevTools: true,
  queryDeduplication: true,
  defaultOptions: {},
  defaultContext: {},
  assumeImmutableResults: true,
  resolvers: myResolvers,
  typeDefs: mySchema,
  fragmentMatcher: () => true,
  name: "my-client",
  version: "1.0.0",
  documentTransform: myDocumentTransform,
  dataMasking: true
  })

  export const transformThis: RenamedApolloClient<MyCacheShape> = new RenamedApolloClient<MyCacheShape>({
  uri: "/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
  cache: new InMemoryCache(),
  ssrForceFetchDelay: 50,
  ssrMode: true,
  connectToDevTools: true,
  queryDeduplication: true,
  defaultOptions: {},
  defaultContext: {},
  assumeImmutableResults: true,
  resolvers: myResolvers,
  typeDefs: mySchema,
  fragmentMatcher: () => true,
  name: "my-client",
  version: "1.0.0",
  documentTransform: myDocumentTransform,
  dataMasking: true
  })
    `).toMatchInlineSnapshot(`
      "import {
        ApolloClient as RenamedApolloClient,
        SomethingElse as ApolloClient,
        InMemoryCache,
        HttpLink,
      } from "@apollo/client";

      import { Defer20220824Handler } from "@apollo/client/incremental";
      import { LocalState } from "@apollo/client/local-state";

      export const dontTouchThis: ApolloClient<MyCacheShape> = new ApolloClient<MyCacheShape>({
        uri: "/graphql",
        credentials: "include",
        headers: {
          "x-custom-header": "value",
        },
        cache: new InMemoryCache(),
        ssrForceFetchDelay: 50,
        ssrMode: true,
        connectToDevTools: true,
        queryDeduplication: true,
        defaultOptions: {},
        defaultContext: {},
        assumeImmutableResults: true,
        resolvers: myResolvers,
        typeDefs: mySchema,
        fragmentMatcher: () => true,
        name: "my-client",
        version: "1.0.0",
        documentTransform: myDocumentTransform,
        dataMasking: true
        })

      export const transformThis: RenamedApolloClient = new RenamedApolloClient({
        cache: new InMemoryCache(),
        ssrForceFetchDelay: 50,
        ssrMode: true,
        queryDeduplication: true,
        defaultOptions: {},
        defaultContext: {},
        assumeImmutableResults: true,
        documentTransform: myDocumentTransform,

        /*
        Inserted by Apollo Client 3->4 migration codemod.
        Keep this comment here if you intend to run the codemod again,
        to avoid changes from being reapplied.
        Delete this comment once you are done with the migration.
        @apollo/client-codemod-migrate-3-to-4 applied
        */
        dataMasking: true,

        link: new HttpLink({
          uri: "/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        }),

        clientAwareness: {
          name: "my-client",
          version: "1.0.0"
        },

        localState: new LocalState({
          resolvers: myResolvers
        }),

        devtools: {
          enabled: true
        },

        /*
        Inserted by Apollo Client 3->4 migration codemod.
        If you are not using the \`@defer\` directive in your application,
        you can safely remove this option.
        */
        incrementalHandler: new Defer20220824Handler()
      })

      /*
      Start: Inserted by Apollo Client 3->4 migration codemod.
      Copy the contents of this block into a \`.d.ts\` file in your project
      to enable data masking types.
      */


      import "@apollo/client";
      import { GraphQLCodegenDataMasking } from "@apollo/client/masking";

      declare module "@apollo/client" {
        export interface TypeOverrides extends GraphQLCodegenDataMasking.TypeOverrides {}
      }

      /*
      End: Inserted by Apollo Client 3->4 migration codemod.
      */


      /*
      Start: Inserted by Apollo Client 3->4 migration codemod.
      Copy the contents of this block into a \`.d.ts\` file in your project to enable correct response types in your custom links.
      If you do not use the \`@defer\` directive in your application, you can safely remove this block.
      */


      import "@apollo/client";
      import { Defer20220824Handler } from "@apollo/client/incremental";

      declare module "@apollo/client" {
        export interface TypeOverrides extends Defer20220824Handler.TypeOverrides {}
      }

      /*
      End: Inserted by Apollo Client 3->4 migration codemod.
      */"
    `);
  });
});

describe("http link initialization", () => {
  test("all options", () => {
    expect(
      transform("explicitLinkConstruction")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  uri: "https://example.com/graphql",
  cache: new InMemoryCache(),
  credentials: "include",
  devtools: { enabled: true },
  headers: {
    "x-custom-header": "value",
  },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient, HttpLink } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        devtools: { enabled: true },

        link: new HttpLink({
          uri: "https://example.com/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        })
      })"
    `);
  });

  test("only uri", () => {
    expect(
      transform("explicitLinkConstruction")`
import { ApolloClient, InMemoryCache } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://example.com/graphql",
  devtools: { enabled: true },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        devtools: { enabled: true },
        link: new HttpLink({
          uri: "https://example.com/graphql"
        }),
      })"
    `);
  });

  test("HttpLink import already there", () => {
    expect(
      transform("explicitLinkConstruction")`
import { ApolloClient } from "@apollo/client";
import { HttpLink } from "@apollo/client/link/http";

new ApolloClient({
  uri: "https://example.com/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";
      import { HttpLink } from "@apollo/client/link/http";

      new ApolloClient({
        link: new HttpLink({
          uri: "https://example.com/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        })
      })"
    `);
  });

  test("HttpLink entry point already there", () => {
    expect(
      transform("explicitLinkConstruction")`
import { ApolloClient } from "@apollo/client";
import { defaultPrinter } from "@apollo/client/link/http";

new ApolloClient({
  uri: "https://example.com/graphql",
  credentials: "include",
  headers: {
    "x-custom-header": "value",
  },
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";
      import { defaultPrinter, HttpLink } from "@apollo/client/link/http";

      new ApolloClient({
        link: new HttpLink({
          uri: "https://example.com/graphql",
          credentials: "include",

          headers: {
            "x-custom-header": "value",
          }
        })
      })"
    `);
  });

  test("link already present inline", () => {
    expect(
      transform("explicitLinkConstruction")`
import { ApolloClient } from "@apollo/client";
import { BatchHttpLink } from "@apollo/client/link/batch-http";

new ApolloClient({
  link: new BatchHttpLink({
    uri: "http://localhost:4000/graphql",
    batchMax: 5,
    batchInterval: 20
  })
})
`
    ).toMatchInlineSnapshot(`""`);
  });

  test("link already present shorthand", () => {
    expect(
      transform("explicitLinkConstruction")`
import { ApolloClient } from "@apollo/client";
import { BatchHttpLink } from "@apollo/client/link/batch-http";

const link = new BatchHttpLink({
  uri: "http://localhost:4000/graphql",
  batchMax: 5,
  batchInterval: 20
});

new ApolloClient({
  link
})
`
    ).toMatchInlineSnapshot(`""`);
  });
});

describe("client awareness", () => {
  test("name and version", () => {
    expect(
      transform("clientAwareness")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  name: "my-client",
  version: "1.0.0",
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,

        clientAwareness: {
          name: "my-client",
          version: "1.0.0"
        }
      })"
    `);
  });
  test("name only", () => {
    expect(
      transform("clientAwareness")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  name: "my-client",
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        clientAwareness: {
          name: "my-client"
        },
      })"
    `);
  });
  test("version only", () => {
    expect(
      transform("clientAwareness")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  version: "1.0.0",
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        clientAwareness: {
          version: "1.0.0"
        },
      })"
    `);
  });
});

describe("local state", () => {
  test("with resolvers inline", () => {
    expect(
      transform("localState")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  resolvers: {
    foo: () => "bar",
  }
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      import { LocalState } from "@apollo/client/local-state";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        localState: new LocalState({
          resolvers: {
            foo: () => "bar",
          }
        })
      })"
    `);
  });
  test("with resolvers variable", () => {
    expect(
      transform("localState")`
import { ApolloClient } from "@apollo/client";

const myResolvers = {}

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  resolvers: myResolvers
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      import { LocalState } from "@apollo/client/local-state";

      const myResolvers = {}

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        localState: new LocalState({
          resolvers: myResolvers
        })
      })"
    `);
  });
  test("with resolvers variable (shorthand)", () => {
    expect(
      transform("localState")`
import { ApolloClient } from "@apollo/client";

const resolvers = {}

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  resolvers
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      import { LocalState } from "@apollo/client/local-state";

      const resolvers = {}

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        localState: new LocalState({
          resolvers
        })
      })"
    `);
  });
  test("without resolvers", () => {
    expect(
      transform("localState")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      import { LocalState } from "@apollo/client/local-state";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,

        /*
        Inserted by Apollo Client 3->4 migration codemod.
        If you are not using the \`@client\` directive in your application,
        you can safely remove this option.
        */
        localState: new LocalState({})
      })"
    `);
  });
});

describe("devtools option", () => {
  test("`true`", () => {
    expect(
      transform("devtoolsOption")`
import { ApolloClient } from "@apollo/client";


new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  connectToDevTools: true
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";


      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        devtools: {
          enabled: true
        }
      })"
    `);
  });
  test("`false`", () => {
    expect(
      transform("devtoolsOption")`
import { ApolloClient } from "@apollo/client";


new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  connectToDevTools: false
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";


      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        devtools: {
          enabled: false
        }
      })"
    `);
  });
  test("variable", () => {
    expect(
      transform("devtoolsOption")`
import { ApolloClient } from "@apollo/client";

const shouldConnectToDevTools = process.env.NODE_ENV === 'development';

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  // see if this comment moves around too
  connectToDevTools: shouldConnectToDevTools
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      const shouldConnectToDevTools = process.env.NODE_ENV === 'development';

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        devtools: {
          // see if this comment moves around too
          enabled: shouldConnectToDevTools
        }
      })"
    `);
  });
  test("process.env.NODE_ENV === 'development'", () => {
    expect(
      transform("devtoolsOption")`
import { ApolloClient } from "@apollo/client";


new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  connectToDevTools: process.env.NODE_ENV === 'development'
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";


      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        devtools: {
          enabled: process.env.NODE_ENV === 'development'
        }
      })"
    `);
  });
  test("shorthand", () => {
    expect(
      transform("devtoolsOption")`
import { ApolloClient } from "@apollo/client";

const connectToDevTools = process.env.NODE_ENV === 'development';

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  connectToDevTools
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      const connectToDevTools = process.env.NODE_ENV === 'development';

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        devtools: {
          enabled: connectToDevTools
        }
      })"
    `);
  });
});

describe("disableNetworkFetches option", () => {
  test("`true`", () => {
    expect(
      transform("prioritizeCacheValues")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  disableNetworkFetches: true
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        prioritizeCacheValues: true
      })"
    `);
  });
  test("`false`", () => {
    expect(
      transform("prioritizeCacheValues")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  disableNetworkFetches: false
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        prioritizeCacheValues: false
      })"
    `);
  });
  test("variable", () => {
    expect(
      transform("prioritizeCacheValues")`
import { ApolloClient } from "@apollo/client";

const onServer = typeof window === "undefined";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  disableNetworkFetches: onServer
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      const onServer = typeof window === "undefined";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        prioritizeCacheValues: onServer
      })"
    `);
  });
  test("shorthand", () => {
    expect(
      transform("prioritizeCacheValues")`
import { ApolloClient } from "@apollo/client";

const disableNetworkFetches = typeof window === "undefined";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  disableNetworkFetches
})
`
    ).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      const disableNetworkFetches = typeof window === "undefined";

      new ApolloClient({
        cache: new InMemoryCache(),
        link: someLink,
        prioritizeCacheValues: disableNetworkFetches
      })"
    `);
  });
});
describe("dataMasking types", () => {
  test("applied if `dataMasking` is set", () => {
    expect(transform("dataMasking")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  dataMasking: true,
})
      `).toMatchInlineSnapshot(`
        "import { ApolloClient } from "@apollo/client";

        new ApolloClient({
          cache: new InMemoryCache(),
          link: someLink,
          /*
          Inserted by Apollo Client 3->4 migration codemod.
          Keep this comment here if you intend to run the codemod again,
          to avoid changes from being reapplied.
          Delete this comment once you are done with the migration.
          @apollo/client-codemod-migrate-3-to-4 applied
          */
          dataMasking: true,
        })

        /*
        Start: Inserted by Apollo Client 3->4 migration codemod.
        Copy the contents of this block into a \`.d.ts\` file in your project
        to enable data masking types.
        */


        import "@apollo/client";
        import { GraphQLCodegenDataMasking } from "@apollo/client/masking";

        declare module "@apollo/client" {
          export interface TypeOverrides extends GraphQLCodegenDataMasking.TypeOverrides {}
        }

        /*
        End: Inserted by Apollo Client 3->4 migration codemod.
        */"
      `);
  });

  test("not applied if `dataMasking` is not set`", () => {
    expect(transform("dataMasking")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
})
      `).toMatchInlineSnapshot(`""`);
  });

  test("not applied if `dataMasking` is set to `false`", () => {
    expect(transform("dataMasking")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  dataMasking: false,
})
      `).toMatchInlineSnapshot(`""`);
  });

  test("does not reapply on a second run (full comment in place)", () => {
    const once = transform("dataMasking")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  dataMasking: true,
})
      `;
    const twice = transform("dataMasking")([once] as any);
    expect(twice).toEqual("" /* empty string -> no transformation */);
  });

  test("does not reapply on a second run (full comment in place, added code moved out)", () => {
    expect(transform("dataMasking")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  /*
  Inserted by Apollo Client 3->4 migration codemod.
  Keep this comment here if you intend to run the codemod again,
  to avoid changes from being reapplied.
  Delete this comment once you are done with the migration.
  @apollo/client-codemod-migrate-3-to-4 applied
  */
  dataMasking: true,
})
      `).toMatchInlineSnapshot(`""`);
  });

  test("does not reapply on a second run (only marker left in place, added code moved out)", () => {
    expect(transform("dataMasking")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  /* @apollo/client-codemod-migrate-3-to-4 applied */
  dataMasking: true,
})
      `).toMatchInlineSnapshot(`""`);
  });
});

describe("incrementalHandler", () => {
  test("added to ApolloClient constructor options", () => {
    expect(transform("incrementalHandler")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
})
      `).toMatchInlineSnapshot(`
        "import { ApolloClient } from "@apollo/client";

        import { Defer20220824Handler } from "@apollo/client/incremental";

        new ApolloClient({
          cache: new InMemoryCache(),
          link: someLink,

          /*
          Inserted by Apollo Client 3->4 migration codemod.
          If you are not using the \`@defer\` directive in your application,
          you can safely remove this option.
          */
          incrementalHandler: new Defer20220824Handler()
        })

        /*
        Start: Inserted by Apollo Client 3->4 migration codemod.
        Copy the contents of this block into a \`.d.ts\` file in your project to enable correct response types in your custom links.
        If you do not use the \`@defer\` directive in your application, you can safely remove this block.
        */


        import "@apollo/client";
        import { Defer20220824Handler } from "@apollo/client/incremental";

        declare module "@apollo/client" {
          export interface TypeOverrides extends Defer20220824Handler.TypeOverrides {}
        }

        /*
        End: Inserted by Apollo Client 3->4 migration codemod.
        */"
      `);
  });

  test("not added to ApolloClient constructor options if an `incrementalHandler` option is already present", () => {
    expect(transform("incrementalHandler")`
import { ApolloClient } from "@apollo/client";

new ApolloClient({
  cache: new InMemoryCache(),
  link: someLink,
  incrementalHandler: undefined
})
      `).toMatchInlineSnapshot(`""`);
  });
});

describe("removeTypeArguments", () => {
  test("remove constructor type argument", () => {
    expect(transform("removeTypeArguments")`
import { ApolloClient } from "@apollo/client";

new ApolloClient<CacheShape>({
  cache: new InMemoryCache(),
  link: someLink,
})
      `).toMatchInlineSnapshot(`
        "import { ApolloClient } from "@apollo/client";

        new ApolloClient({
          cache: new InMemoryCache(),
          link: someLink,
        })"
      `);
  });

  test("removes type arguments for usages of `ApolloClient` as a type", () => {
    expect(transform("removeTypeArguments")`
import { ApolloClient } from "@apollo/client";

function test(client: ApolloClient<unknown>): ApolloClient<any> {
  return client;
}
    `).toMatchInlineSnapshot(`
      "import { ApolloClient } from "@apollo/client";

      function test(client: ApolloClient): ApolloClient {
        return client;
      }"
    `);
  });
});

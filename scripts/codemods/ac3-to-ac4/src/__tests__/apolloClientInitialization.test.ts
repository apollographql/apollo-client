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
      { source },
      { parser: "ts" }
    );

describe("all transforms", () => {
  test("kitchen sink 1", () => {
    expect(transform()`
import { ApolloClient, InMemoryCache } from "@apollo/client";

export const client = new ApolloClient({
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
        }
      })"
    `);
  });
});

describe("http link intialization", () => {
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
    // TODO: should we insert `LocalState` by default, with a comment to remove it if not using client state?
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

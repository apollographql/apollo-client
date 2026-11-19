# Apollo Client Integration with React Router Framework Mode

This guide covers integrating Apollo Client in a React Router 7 application with support for modern streaming SSR.

## Installation

Install Apollo Client and the React Router integration package:

```bash
npm install @apollo/client-integration-react-router @apollo/client graphql rxjs
```

> **TypeScript users:** For type-safe GraphQL operations, see the [TypeScript Code Generation guide](typescript-codegen.md).

## Setup

### Step 1: Create Apollo Configuration

Create an `app/apollo.ts` file that exports a `makeClient` function and an `apolloLoader`:

```typescript
import { HttpLink, InMemoryCache } from "@apollo/client";
import {
  createApolloLoaderHandler,
  ApolloClient,
} from "@apollo/client-integration-react-router";

// `request` will be available on the server during SSR or in loaders, but not in the browser
export const makeClient = (request?: Request) => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "https://your-graphql-endpoint.com/graphql" }),
  });
};

export const apolloLoader = createApolloLoaderHandler(makeClient);
```

> **Important:** `ApolloClient` must be imported from `@apollo/client-integration-react-router`, not from `@apollo/client`.

### Step 2: Reveal Entry Files

Run the following command to create the entry files if they don't exist:

```bash
npx react-router reveal
```

This will create `app/entry.client.tsx` and `app/entry.server.tsx`.

### Step 3: Configure Client Entry

Adjust `app/entry.client.tsx` to wrap your app in `ApolloProvider`:

```typescript
import { makeClient } from "./apollo";
import { ApolloProvider } from "@apollo/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
  const client = makeClient();
  hydrateRoot(
    document,
    <StrictMode>
      <ApolloProvider client={client}>
        <HydratedRouter />
      </ApolloProvider>
    </StrictMode>
  );
});
```

### Step 4: Configure Server Entry

Adjust `app/entry.server.tsx` to wrap your app in `ApolloProvider` during SSR:

```typescript
import { makeClient } from "./apollo";
import { ApolloProvider } from "@apollo/client";
// ... other imports

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    // ... existing code

    const client = makeClient(request);

    const { pipe, abort } = renderToPipeableStream(
      <ApolloProvider client={client}>
        <ServerRouter
          context={routerContext}
          url={request.url}
          abortDelay={ABORT_DELAY}
        />
      </ApolloProvider>,
      {
        [readyOption]() {
          shellRendered = true;
          // ... rest of the handler
        },
        // ... other options
      }
    );
  });
}
```

### Step 5: Add Hydration Helper

Add `<ApolloHydrationHelper>` to `app/root.tsx`:

```typescript
import { ApolloHydrationHelper } from "@apollo/client-integration-react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ApolloHydrationHelper>{children}</ApolloHydrationHelper>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```

## Usage

### Using apolloLoader with useReadQuery

You can now use the `apolloLoader` function to create Apollo-enabled loaders for your routes:

```typescript
import { gql } from "@apollo/client";
import { useReadQuery } from "@apollo/client/react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/my-route";
import type { TypedDocumentNode } from "@apollo/client";
import { apolloLoader } from "./apollo";

// TypedDocumentNode definition with types
const GET_USER: TypedDocumentNode<
  { user: { id: string; name: string; email: string } },
  { id: string }
> = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

export const loader = apolloLoader<Route.LoaderArgs>()(({ preloadQuery }) => {
  const userQueryRef = preloadQuery(GET_USER, {
    variables: { id: "1" },
  });

  return {
    userQueryRef,
  };
});

export default function UserPage() {
  const { userQueryRef } = useLoaderData<typeof loader>();
  const { data } = useReadQuery(userQueryRef);

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </div>
  );
}
```

> **Important:** To provide better TypeScript support, `apolloLoader` is a method that you need to call twice: `apolloLoader<LoaderArgs>()(loader)`

### One Query for Each Route

Put all data for the route in one query, and preload that one query in the loader. Each child component adds its fields with a fragment (see the [Fragments reference](fragments.md)). Do not preload several independent queries in one loader: that sends several requests, and the queries cannot share a loading or error state. If part of the route is slow, use `@defer` on that part.

```typescript
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import { useReadQuery } from "@apollo/client/react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/user-page";
import { apolloLoader } from "./apollo";
import { UserHeader, USER_HEADER_FRAGMENT } from "./components/UserHeader";
import { PostListItem, POST_LIST_ITEM_FRAGMENT } from "./components/PostListItem";
import type { UserPageQuery, UserPageQueryVariables } from "./user-page.generated";

const USER_PAGE_QUERY: TypedDocumentNode<
  UserPageQuery,
  UserPageQueryVariables
> = gql`
  query UserPage($id: ID!) {
    user(id: $id) {
      id
      ...UserHeader_user
      posts {
        id
        ...PostListItem_post
      }
    }
  }
  ${USER_HEADER_FRAGMENT}
  ${POST_LIST_ITEM_FRAGMENT}
`;

export const loader = apolloLoader<Route.LoaderArgs>()(({
  preloadQuery,
  params,
}) => {
  const queryRef = preloadQuery(USER_PAGE_QUERY, {
    variables: { id: params.id },
  });

  return { queryRef };
});

export default function UserPage() {
  const { queryRef } = useLoaderData<typeof loader>();
  const { data } = useReadQuery(queryRef);

  return (
    <div>
      <UserHeader user={data.user} />
      <h2>Posts</h2>
      <ul>
        {data.user.posts.map((post) => (
          <PostListItem key={post.id} post={post} />
        ))}
      </ul>
    </div>
  );
}
```

## Important Considerations

1. **Import ApolloClient from Integration Package:** Always import `ApolloClient` from `@apollo/client-integration-react-router`, not from `@apollo/client`, to ensure proper SSR hydration.

2. **TypeScript Support:** The `apolloLoader` function requires double invocation for proper TypeScript type inference: `apolloLoader<LoaderArgs>()(loader)`.

3. **Request Context:** The `makeClient` function receives the `Request` object during SSR and in loaders, but not in the browser. Use this to set up auth headers or other request-specific configuration.

4. **Streaming SSR:** The integration fully supports React's streaming SSR capabilities. Place `Suspense` boundaries strategically for optimal user experience.

5. **Cache Hydration:** The `ApolloHydrationHelper` component ensures that data loaded on the server is properly hydrated on the client, preventing unnecessary refetches.

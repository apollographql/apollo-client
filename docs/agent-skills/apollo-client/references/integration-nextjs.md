# Apollo Client Integration with Next.js App Router

This guide covers integrating Apollo Client in a Next.js application using the App Router architecture with support for both React Server Components (RSC) and Client Components.

## What is supported?

### React Server Components

Apollo Client provides a shared client instance across all server components for a single request, preventing duplicate GraphQL requests and optimizing server-side rendering.

### React Client Components

When using the `app` directory, client components are rendered both on the server (SSR) and in the browser. Apollo Client enables you to execute GraphQL queries on the server and use the results to hydrate your browser-side cache, delivering fully-rendered pages to users.

## Installation

Install Apollo Client and the Next.js integration package:

```bash
npm install @apollo/client@latest @apollo/client-integration-nextjs graphql rxjs
```

> **TypeScript users:** For type-safe GraphQL operations, see the [TypeScript Code Generation guide](typescript-codegen.md).

## Setup for React Server Components (RSC)

### Step 1: Create Apollo Client Configuration

Create an `ApolloClient.ts` file in your app directory:

```typescript
import { HttpLink } from "@apollo/client";
import { registerApolloClient, ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      // Use an absolute URL for SSR (relative URLs cannot be used in SSR)
      uri: "https://your-api.com/graphql",
      fetchOptions: {
        // Optional: Next.js-specific fetch options for caching and revalidation
        // See: https://nextjs.org/docs/app/api-reference/functions/fetch
      },
    }),
  });
});
```

### Step 2: Use in Server Components

You can now use the `getClient` function or the `query` shortcut in your server components:

```typescript
import { query } from "./ApolloClient";

async function UserProfile({ userId }: { userId: string }) {
  const { data } = await query({
    query: GET_USER,
    variables: { id: userId },
  });

  return <div>{data.user.name}</div>;
}
```

### Override Next.js Fetch Options

You can override Next.js-specific `fetch` options per query using `context.fetchOptions`:

```typescript
const { data } = await getClient().query({
  query: GET_USER,
  context: {
    fetchOptions: {
      next: { revalidate: 60 }, // Revalidate every 60 seconds
    },
  },
});
```

## Setup for Client Components (SSR and Browser)

### Step 1: Create Apollo Wrapper Component

Create `app/ApolloWrapper.tsx`:

```typescript
"use client";

import { HttpLink } from "@apollo/client";
import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";

function makeClient() {
  const httpLink = new HttpLink({
    // Use an absolute URL for SSR
    uri: "https://your-api.com/graphql",
    fetchOptions: {
      // Optional: Next.js-specific fetch options
      // Note: This doesn't work with `export const dynamic = "force-static"`
    },
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
  });
}

export function ApolloWrapper({ children }: React.PropsWithChildren) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      {children}
    </ApolloNextAppProvider>
  );
}
```

### Step 2: Wrap Root Layout

Wrap your `RootLayout` in the `ApolloWrapper` component in `app/layout.tsx`:

```typescript
import { ApolloWrapper } from "./ApolloWrapper";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApolloWrapper>{children}</ApolloWrapper>
      </body>
    </html>
  );
}
```

> **Note:** This works even if your layout is a React Server Component. It ensures all Client Components share the same Apollo Client instance through `ApolloNextAppProvider`.

### Step 3: Use Apollo Client Hooks in Client Components

For optimal streaming SSR, use suspense-enabled hooks like `useSuspenseQuery` and `useFragment`:

```typescript
"use client";

import { useSuspenseQuery } from "@apollo/client/react";

export function UserProfile({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery(GET_USER, {
    variables: { id: userId },
  });

  return <div>{data.user.name}</div>;
}
```

## Preloading Data from RSC to Client Components

You can preload data in React Server Components to populate the cache of your Client Components.

### Step 1: Use PreloadQuery in Server Components

```tsx
import { PreloadQuery } from "./ApolloClient";
import { Suspense } from "react";

export default async function Page() {
  return (
    <PreloadQuery query={GET_USER} variables={{ id: "1" }}>
      <Suspense fallback={<>Loading...</>}>
        <ClientChild />
      </Suspense>
    </PreloadQuery>
  );
}
```

### Step 2: Consume with useSuspenseQuery in Client Components

```tsx
"use client";

import { useSuspenseQuery } from "@apollo/client/react";

export function ClientChild() {
  const { data } = useSuspenseQuery(GET_USER, {
    variables: { id: "1" },
  });

  return <div>{data.user.name}</div>;
}
```

> **Important:** Data fetched this way should be considered client data and never referenced in Server Components. `PreloadQuery` prevents mixing server data and client data by creating a separate `ApolloClient` instance.

### Using with useReadQuery

For advanced use cases, you can use `PreloadQuery` with `useReadQuery` to avoid request waterfalls:

```tsx
<PreloadQuery query={GET_USER} variables={{ id: "1" }}>
  {(queryRef) => (
    <Suspense fallback={<>Loading...</>}>
      <ClientChild queryRef={queryRef} />
    </Suspense>
  )}
</PreloadQuery>
```

In your Client Component:

```tsx
"use client";

import { useQueryRefHandlers, useReadQuery, QueryRef } from "@apollo/client/react";

export function ClientChild({ queryRef }: { queryRef: QueryRef<TQueryData> }) {
  const { refetch } = useQueryRefHandlers(queryRef);
  const { data } = useReadQuery(queryRef);

  return <div>{data.user.name}</div>;
}
```

## Handling Multipart Responses (@defer) in SSR

When using the `@defer` directive, `useSuspenseQuery` will only suspend until the initial response is received. To handle deferred data properly, you have three strategies:

### Strategy 1: Use PreloadQuery with useReadQuery

`PreloadQuery` allows deferred data to be fully transported and streamed chunk-by-chunk.

### Strategy 2: Remove @defer Fragments

Use `RemoveMultipartDirectivesLink` to strip `@defer` directives from queries during SSR:

```typescript
import { RemoveMultipartDirectivesLink } from "@apollo/client-integration-nextjs";

new RemoveMultipartDirectivesLink({
  stripDefer: true, // Default: true
});
```

You can exclude specific fragments from stripping by labeling them:

```graphql
query myQuery {
  fastField
  ... @defer(label: "SsrDontStrip1") {
    slowField1
  }
}
```

### Strategy 3: Wait for Deferred Data

Use `AccumulateMultipartResponsesLink` to debounce the initial response:

```typescript
import { AccumulateMultipartResponsesLink } from "@apollo/client-integration-nextjs";

new AccumulateMultipartResponsesLink({
  cutoffDelay: 100, // Wait up to 100ms for incremental data
});
```

### Combined Approach: SSRMultipartLink

Combine both strategies with `SSRMultipartLink`:

```typescript
import { SSRMultipartLink } from "@apollo/client-integration-nextjs";

new SSRMultipartLink({
  stripDefer: true,
  cutoffDelay: 100,
});
```

## Testing

Reset singleton instances between tests using the `resetApolloClientSingletons` helper:

```typescript
import { resetApolloClientSingletons } from "@apollo/client-integration-nextjs";

afterEach(resetApolloClientSingletons);
```

## Debugging

Enable verbose logging in your `app/ApolloWrapper.tsx`:

```typescript
import { setLogVerbosity } from "@apollo/client";

setLogVerbosity("debug");
```

## Important Considerations

1. **Separate RSC and SSR Queries:** Avoid overlapping queries between RSC and SSR. RSC queries don't update in the browser, while SSR queries can update dynamically as the cache changes.

2. **Use Absolute URLs:** Always use absolute URLs in `HttpLink` for SSR, as relative URLs cannot be used in server-side rendering.

3. **Streaming SSR:** For optimal performance, use `useSuspenseQuery` and `useFragment` to take advantage of React 18's streaming SSR capabilities.

4. **Suspense Boundaries:** Place `Suspense` boundaries at meaningful places in your UI for the best user experience.

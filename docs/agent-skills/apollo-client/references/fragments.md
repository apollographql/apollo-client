# Fragments Reference

GraphQL fragments define a set of fields for a specific type. In Apollo Client, each component that displays server data declares the fields it needs in its own fragment. The route component composes these fragments into one query. See [Where Data Comes From](../SKILL.md#where-data-comes-from) for the rules about where queries go.

## Table of Contents

- [Rules](#rules)
- [Setup Before You Use FragmentType](#setup-before-you-use-fragmenttype)
- [Fragment Colocation](#fragment-colocation)
- [Lists](#lists)
- [Data That Is Not Normalized](#data-that-is-not-normalized)
- [Data Masking](#data-masking)
- [Enabling Data Masking in an Existing App](#enabling-data-masking-in-an-existing-app)
- [Fragments Without Data Masking](#fragments-without-data-masking)
- [Deferring Fragments](#deferring-fragments)
- [GraphQL Codegen Fragment Masking](#graphql-codegen-fragment-masking)

## Rules

- **Each component that displays an object type from the server owns one fragment for each prop that receives that data.** The fragment selects exactly the fields that the component uses.
- **Fragments are for colocation, not reuse.** A fragment is 1:1 with its component. Never use the fragment of another component, even if the fields are the same today. If you want to share a fragment, render the component that owns it instead. When one component needs more fields later, only its own fragment changes, and no other component over-fetches.
- **The parent spreads the fragment of each child that it renders.** The parent's fragment or the route query includes `...Child_prop`. With data masking, TypeScript reports an error if the spread is missing. Fix the spread, do not cast the type.
- **Always pass both type arguments to `TypedDocumentNode` for a fragment.** Use `TypedDocumentNode<Fragment, Record<string, never>>` when the fragment uses no variables, and the variables type when it uses operation variables (see [Fragments that use operation variables](#fragments-that-use-operation-variables)). Never omit the variables type. It defaults to `{ [key: string]: any }`, which accepts any variables, so TypeScript checks nothing, and a reader cannot tell if the fragment uses variables.
- **Type each fragment prop with `FragmentType<typeof FRAGMENT>`.** The type comes from the fragment document, so if you rename the fragment or its generated type, you do not have to change the prop type. It requires Apollo Client 4.1+ and the masking types. See [Setup Before You Use FragmentType](#setup-before-you-use-fragmenttype).
- **The fragment tree mirrors the component tree.** A component spreads only the fragments of the components that it renders directly. Never spread the fragment of a grandchild. That would couple the component to the implementation of its child: if the child stops rendering the grandchild, or renders a different one, the parent still fetches fields that nothing uses, and nobody notices. Each component is responsible only for its direct children. See [Nested components](#nested-components).
- **Children never call query hooks.** A child that needs a new field adds it to its own fragment. See the [permitted exceptions](../SKILL.md#permitted-exceptions).
- **General-purpose components take plain props.** A component that renders one value and works with any type (for example `<Date value={...} />`) takes that value as a prop, not a fragment. A component built for one type uses a fragment, even for one field.
- **Run codegen before you import a generated type.** After you add or change a fragment, run codegen, and then import the generated type by the name in the generated file. Do not guess the name. With the default config, `UserCard_user` becomes `UserCard_UserFragment`, but the project's `namingConvention` option can change it.
- **Name fragments `ComponentName_propName`** (for example `UserCard_user`). See [Naming Convention](#naming-convention).

## Setup Before You Use FragmentType

`FragmentType` is the prop type that connects a parent's data to a child's fragment. It only works after you set up the data masking types. **Without the type overrides, `FragmentType` resolves to `never`**, and no value can be passed to the prop.

### Check the type generation tool first

Look at `package.json` and the codegen config before you add type overrides:

| Codebase uses                                                                                                                        | Action                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GraphQL Codegen (`@graphql-codegen/*`) with `typescript-operations`                                                                  | Add the codegen options and the type override below.                                                                                                                                                                                       |
| GraphQL Codegen `client` preset with its fragment masking (`fragmentMasking` is not `false`, or the generated `useFragment` is used) | First move off the client preset fragment masking (see [GraphQL Codegen Fragment Masking](#graphql-codegen-fragment-masking)), then continue as above.                                                                                     |
| gql.tada or another typed-document tool                                                                                              | Stop and tell the user: the Apollo Client masking types support GraphQL Codegen output, and this tool is not compatible with them yet. Do not enable `dataMasking`. Use [Fragments Without Data Masking](#fragments-without-data-masking). |
| No type generation (hand-written types, or no types)                                                                                 | Recommend GraphQL Codegen first. See [TypeScript Code Generation](typescript-codegen.md).                                                                                                                                                  |

It is possible to write custom masking types with higher-kinded types (see [the docs](https://www.apollographql.com/docs/react/data/fragments#defining-your-own-masking-types-using-higher-kinded-types)). Only do this when the user asks for it. A small mistake makes every masked type wrong without any error. If you write them, add a type test file with `// @ts-expect-error` lines that prove a masked field is an error and an unmasked field is not.

**Never enable `dataMasking: true` before the masking types are set up.** At runtime, masked fields are removed. Without the type overrides, the types still include those fields, so TypeScript lets components read fields that are `undefined` at runtime.

### GraphQL Codegen options

Add these options to the config of the `typescript-operations` plugin:

```ts
// codegen.ts
config: {
  // ...existing options
  inlineFragmentTypes: "mask",
  customDirectives: {
    apolloUnmask: true,
  },
},
```

### Type override

```ts
// apollo.d.ts
import "@apollo/client";
import type { GraphQLCodegenDataMasking } from "@apollo/client/masking";

declare module "@apollo/client" {
  interface TypeOverrides extends GraphQLCodegenDataMasking.TypeOverrides {}
}
```

### Version note

`FragmentType<typeof FRAGMENT>` requires Apollo Client 4.1+. On 4.0, pass the generated fragment data type instead: `FragmentType<UserCard_UserFragment>`.

## Fragment Colocation

### Child component (Suspense)

Define the fragment next to the component and export it. Type it with the generated fragment type and **always pass the variables type as the second type argument**. If the fragment does not use variables, pass `Record<string, never>`, so that TypeScript reports an error if variables are passed.

```tsx
// components/UserCard.tsx
import { gql } from "@apollo/client";
import type { FragmentType, TypedDocumentNode } from "@apollo/client";
import { useSuspenseFragment } from "@apollo/client/react";
import type { UserCard_UserFragment } from "./UserCard.generated";

export const USER_CARD_FRAGMENT: TypedDocumentNode<
  UserCard_UserFragment,
  Record<string, never>
> = gql`
  fragment UserCard_user on User {
    id
    name
    email
    avatarUrl
  }
`;

export function UserCard({
  user,
}: {
  user: FragmentType<typeof USER_CARD_FRAGMENT>;
}) {
  const { data } = useSuspenseFragment({
    fragment: USER_CARD_FRAGMENT,
    from: user,
  });

  return (
    <div>
      <img src={data.avatarUrl} alt={data.name} />
      <h2>{data.name}</h2>
      <p>{data.email}</p>
    </div>
  );
}
```

### Child component (without Suspense)

```tsx
import { useFragment } from "@apollo/client/react";

export function UserCard({
  user,
}: {
  user: FragmentType<typeof USER_CARD_FRAGMENT>;
}) {
  const { data, dataState } = useFragment({
    fragment: USER_CARD_FRAGMENT,
    from: user,
  });

  if (dataState !== "complete") {
    return null;
  }

  return <h2>{data.name}</h2>;
}
```

Check `dataState`, not `complete`. `dataState` narrows the type of `data`.

### Fragments that use operation variables

A fragment cannot declare variables, but it can use the variables of the operation (for example `posts(first: $first)`). For such a fragment, write the variables type by hand, because GraphQL Codegen does not generate variable types for fragments. Match the variable definitions of the operation: a required variable (`$first: Int!`) is a required property (`{ first: number }`), and a nullable variable (`$first: Int`) or a variable with a default value is an optional property (`{ first?: number | null }`).

```ts
const USER_POSTS_FRAGMENT: TypedDocumentNode<
  UserPosts_UserFragment,
  { first?: number | null }
> = gql`
  fragment UserPosts_user on User {
    id
    posts(first: $first) {
      id
    }
  }
`;
```

Always pass the same values in the `variables` option of `useFragment` or `useSuspenseFragment`. Without them, the hook reads a different cache field than the operation wrote and returns incomplete data.

### Parent: spread and interpolate the child fragment

The parent spreads the child fragment by name and interpolates the child's fragment document so that the definition is part of the operation. Select the key fields (usually `id`) next to the spread so that the child can identify the object in the cache.

```tsx
// routes/UserPage.tsx
import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";
import { useSuspenseQuery } from "@apollo/client/react";
import { UserCard, USER_CARD_FRAGMENT } from "../components/UserCard";
import type {
  UserPageQuery,
  UserPageQueryVariables,
} from "./UserPage.generated";

const USER_PAGE_QUERY: TypedDocumentNode<
  UserPageQuery,
  UserPageQueryVariables
> = gql`
  query UserPage($id: ID!) {
    user(id: $id) {
      id
      ...UserCard_user
    }
  }
  ${USER_CARD_FRAGMENT}
`;

export function UserPage({ params }: { params: { id: string } }) {
  const { data } = useSuspenseQuery(USER_PAGE_QUERY, {
    variables: { id: params.id },
  });

  if (!data.user) {
    return <p>User not found</p>;
  }

  return <UserCard user={data.user} />;
}
```

If the query does not spread `...UserCard_user`, `data.user` is not assignable to `FragmentType<typeof USER_CARD_FRAGMENT>`, and `tsc` reports an error at `<UserCard user={data.user} />`.

### Nested components

A component that renders other components spreads their fragments in its own fragment. The fragments form the same tree as the components.

```tsx
// components/UserProfile.tsx
import { UserAvatar, USER_AVATAR_FRAGMENT } from "./UserAvatar";

export const USER_PROFILE_FRAGMENT: TypedDocumentNode<
  UserProfile_UserFragment,
  Record<string, never>
> = gql`
  fragment UserProfile_user on User {
    id
    bio
    ...UserAvatar_user
  }
  ${USER_AVATAR_FRAGMENT}
`;

export function UserProfile({
  user,
}: {
  user: FragmentType<typeof USER_PROFILE_FRAGMENT>;
}) {
  const { data } = useSuspenseFragment({
    fragment: USER_PROFILE_FRAGMENT,
    from: user,
  });

  return (
    <section>
      <UserAvatar user={data} />
      <p>{data.bio}</p>
    </section>
  );
}
```

The route query then spreads only `...UserProfile_user`. It does not spread `...UserAvatar_user`, because the route does not render `UserAvatar`. `UserProfile` does.

```graphql
# ❌ The route spreads the fragment of a grandchild
query UserPage($id: ID!) {
  user(id: $id) {
    id
    ...UserProfile_user
    ...UserAvatar_user
  }
}

# ✅ The route spreads only the fragments of the components it renders
query UserPage($id: ID!) {
  user(id: $id) {
    id
    ...UserProfile_user
  }
}
```

### Naming Convention

Use `ComponentName_propName` by default:

- `UserCard_user` for the `user` prop of `UserCard`
- `PostList_posts` for the `posts` prop of `PostList`
  - For an array prop, use the plural prop name, even though the fragment selects the fields of one item: `PostList_posts` for `posts: Array<FragmentType<typeof POST_LIST_FRAGMENT>>`, not `PostList_post`.
- `CommentCard_comment` and `CommentCard_author` for a component with two fragment props

This convention gives every fragment a unique name without inventing new names, and it still works when a component receives more than one fragment. A name such as `UserCardFragment` breaks down when the component needs a second fragment.

If the codebase already uses a different convention, follow it. If that convention is not written in the `AGENTS.md` or `CLAUDE.md` of the project, offer to add it.

### Fragment registry

If the codebase registers fragments with `createFragmentRegistry`, use the registry: register the child fragment and spread it by name, without interpolation. Otherwise, use interpolation as shown above. Both approaches are fine. Do not introduce a registry unless the user asks for one.

```ts
import { createFragmentRegistry } from "@apollo/client/cache";

export const fragmentRegistry = createFragmentRegistry();

const client = new ApolloClient({
  cache: new InMemoryCache({ fragments: fragmentRegistry }),
  // ...
});

// next to the component
fragmentRegistry.register(USER_CARD_FRAGMENT);
```

## Lists

> Requires Apollo Client 4.1+. On 4.0, render one item component per item and let each item component read its own fragment.

A component that renders a list of items can pass the array to `from`. `data` is an array in the same order. `dataState` is `"complete"` only when every item is complete.

```tsx
// components/PostList.tsx
import { PostListItem, POST_LIST_ITEM_FRAGMENT } from "./PostListItem";

export const POST_LIST_FRAGMENT: TypedDocumentNode<
  PostList_PostsFragment,
  Record<string, never>
> = gql`
  fragment PostList_posts on Post {
    id
    ...PostListItem_post
  }
  ${POST_LIST_ITEM_FRAGMENT}
`;

export function PostList({
  posts,
}: {
  posts: Array<FragmentType<typeof POST_LIST_FRAGMENT>>;
}) {
  const { data } = useSuspenseFragment({
    fragment: POST_LIST_FRAGMENT,
    from: posts,
  });

  return (
    <ul>
      {data.map((post) => (
        <PostListItem key={post.id} post={post} />
      ))}
    </ul>
  );
}
```

The parent selects `posts { id ...PostList_posts }` and renders `<PostList posts={data.user.posts} />`.

## Data That Is Not Normalized

`useFragment` and `useSuspenseFragment` read from the cache, so `from` must be an object that the cache can identify (it has key fields such as `id`). Objects without key fields, or types with `keyFields: false`, are stored inside their parent and cannot be passed to `from`.

**First choice: put the fragment on the nearest normalized parent.** The fragment selects the non-normalized field through the parent.

```graphql
# Dimensions has no id. Put the fragment on Product instead.
fragment ProductDimensions_product on Product {
  id
  dimensions {
    width
    height
    depth
    unit
  }
}
```

**Second choice: `@unmask`.** If the nearest normalized parent is several levels up and a fragment on it would make the component awkward, unmask the spread. The parent then receives the fragment fields and passes them to the child. Type the prop with the generated fragment type and read from props directly.

```graphql
query OrderPage($id: ID!) {
  order(id: $id) {
    id
    summary {
      totals {
        ...OrderTotals_totals @unmask
      }
    }
  }
}
```

```tsx
import type { OrderTotals_TotalsFragment } from "./OrderTotals.generated";

export function OrderTotals({
  totals,
}: {
  totals: OrderTotals_TotalsFragment;
}) {
  return <p>Total: {totals.grandTotal}</p>;
}
```

Do not pass non-normalized data as a plain prop without one of these two approaches. With data masking, the parent does not receive the fragment fields unless the spread is unmasked.

## Data Masking

Data masking removes the fields of a fragment from the parent's result at runtime. A component can read only the fields of its own fragment, through `useFragment` or `useSuspenseFragment`.

Recommend data masking for every application:

- **No accidental coupling**: A parent cannot read fields that a child requested. Changing a child's fragment never breaks the parent.
- **Fewer re-renders**: The parent subscribes only to its own fields. When a field from a child's fragment changes, only that child re-renders.
- **Type-checked composition**: With the masking types, TypeScript reports a missing fragment spread or an access to a masked field.

### Enabling data masking in a new app

Set up the [masking types](#setup-before-you-use-fragmenttype) first, then:

```ts
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link,
  dataMasking: true,
});
```

### @unmask

`@unmask` on a fragment spread makes the fragment's fields available to the parent. It is an escape hatch. Before you use it, add the needed fields to the parent's own selection. Valid uses are [non-normalized data](#data-that-is-not-normalized) and the [migration of an existing app](#enabling-data-masking-in-an-existing-app).

## Enabling Data Masking in an Existing App

Apollo Client supports an incremental migration. Existing components keep receiving full data, and all new code is masked from the start. Ask the user before you start. Enabling `dataMasking` changes the runtime data of every component.

1. **Set up the masking types.** Follow [Setup Before You Use FragmentType](#setup-before-you-use-fragmenttype).

2. **Add `@unmask(mode: "migrate")` to every existing fragment spread with the codemod.** The codemod is not published to npm. Run it from its pinned URL in the project root. `graphql` must be installed in the project, and `NODE_PATH` is necessary because jscodeshift downloads the transform to a temporary directory:

   ```bash
   NODE_PATH="$PWD/node_modules" npx jscodeshift@17.1.1 \
     -t "https://raw.githubusercontent.com/apollographql/apollo-client/%40apollo/client%404.3.3/scripts/codemods/data-masking/unmask.ts" \
     --extensions tsx --parser tsx --mode migrate src
   ```

   Run it once for each extension the project uses (`ts`, `tsx`, `js`, `jsx`; use `--parser ts` for `.ts` files). For `.graphql` or `.gql` files, pass `--extensions graphql`. If the project uses a tag other than `gql` or `graphql`, pass `--tag <name>`.

   If the URL approach fails, clone the repository at the tag `@apollo/client@4.3.3` and pass the local path of `scripts/codemods/data-masking/unmask.ts` to `-t`.

   The codemod can remove comments inside GraphQL documents. Review the diff.

3. **Enable `dataMasking: true` in the same change.** Then every query or fragment added later is masked by default.

4. **Migrate components incrementally.** In migrate mode, Apollo Client logs a development warning when code reads a field that would be masked. For each warning, move the component to read its fragment with `useFragment` or `useSuspenseFragment`. When a spread produces no more warnings, remove its `@unmask(mode: "migrate")`.

## Fragments Without Data Masking

If the user does not want data masking, or the type tool does not support the masking types:

- Each component still owns and exports its fragment, and the parent still spreads it. The code is then ready for data masking later.
- Do not use `FragmentType`. It resolves to `never` without the masking types. Type the prop with the generated fragment type (for example `UserCard_UserFragment`) and read from props directly.
- TypeScript cannot check that the parent spreads the fragment. Check the spreads yourself.

If the codebase already uses `useFragment` or `useSuspenseFragment`, recommend enabling data masking for the re-render benefits.

## Deferring Fragments

Use `@defer` on a fragment spread to stream slow fields or fields below the fold. The route renders as soon as the non-deferred data arrives. Defer slow parts of the route query instead of moving them into a separate query.

```graphql
query ProductPage($id: ID!) {
  product(id: $id) {
    id
    ...ProductHeader_product
    ...ProductReviews_product @defer
  }
}
```

With `useSuspenseFragment`, the component that reads `ProductReviews_product` suspends until the deferred data arrives. Do not defer the key fields (`id`) of the object passed to `from`.

## GraphQL Codegen Fragment Masking

The GraphQL Codegen `client` preset has its own "fragment masking". It is different from Apollo Client data masking:

- **Codegen fragment masking is types only.** Its generated `useFragment` is an identity function. The full data is still present at runtime, and the parent still re-renders for every field.
- **Apollo Client data masking works at runtime.** Masked fields are removed from the parent's result, and `useFragment` and `useSuspenseFragment` create their own cache subscriptions, so only the component that owns a field re-renders.

Do not use Codegen fragment masking with Apollo Client. If the project uses it, recommend this migration:

1. Replace the generated `useFragment` function with the `useFragment` hook from `@apollo/client/react`.
2. Disable Codegen fragment masking and add the options for Apollo Client masking:

   ```ts
   // codegen.ts
   "path/to/gql/": {
     preset: "client",
     presetConfig: {
       fragmentMasking: false,
     },
     config: {
       inlineFragmentTypes: "mask",
       customDirectives: {
         apolloUnmask: true,
       },
     },
   },
   ```

3. Add the [type override](#type-override) and enable `dataMasking: true`.

# `@apollo/client/react/hooks`

This nested sub-package within `@apollo/client` provides implementations of
various [React Hooks](https://reactjs.org/docs/hooks-overview.html).

## Recommended `useFragment` usage

```ts
import { ListItemFragment } from "./ListItem.tsx"

const ListFragment = gql`
  fragment ListFragment on Query {
    items(search: $search) {
      id
    }
  }
`;

const ListQuery = gql`
  query ListQuery($search: String) {
    ...ListFragment
    items(search: $search) {
      id
      ...ListItemFragment
    }
  }
  ${ListFragment}
  ${ListItemFragment}
`;

export function ListComponent({ search }) {
  const {
    observable,
  } = useBackgroundQuery({
    query: ListQuery,
    variables: { search },
  });

  const { complete, data, errors } = useFragment({
    fragment: ListFragment,
    from: { __typename: "Query" },
    variables: observable.variables,
  });

  return (
    <div>
      {complete ? <ul>{
        data.items.map(item => <ListItem itemId={item.id} />)
      }</ul> : null}
      <hr/>
      <input type=button onClick={
        () => observable.refetch()
      } value="refresh" />
    </div>
  );
}
```

And then `ListItem.tsx`:

```ts
export const ListItemFragment = gql`
  fragment ListItemFragment on ListItem {
    id
    text
  }
`;

export function ListItem({ itemId }) {
  const { complete, data, errors } = useFragment({
    fragment: ListItemFragment,
    from: {
      __typename: "ListItem",
      id: itemId,
    },
  });

  return complete ? (
    <li>data.text</li>
  ) : null;
}
```

## `useApolloClient()`

TODO

## `useBackgroundQuery()`

TODO

## `useFragment()`

TODO

## `useReactiveVar()`

TODO

---
title: Improving performance
---

<h2 id="cache-redirects">Redirecting to cached data</h2>

<h2 id="prefetching">Prefetching data</h2>

Prefetching is one of the easiest ways to make your application's UI feel a lot faster with Apollo Client. Prefetching simply means loading data into the cache before it needs to be rendered on the screen. Essentially, we want to load all data required for a view as soon as we can guess that a user will navigate to it.

We can accomplish this in only a few lines of code by calling `client.query` whenever the user hovers over a link. Let's see this in action in the `Feed` component in our example app [Pupstagram](https://codesandbox.io/s/r5qp83z0yq).

```jsx
const Feed = () => (
  <View style={styles.container}>
    <Header />
    <Query query={GET_DOGS}>
      {({ loading, error, data, client }) => {
        if (loading) return <Fetching />;
        if (error) return <Error />;

        return (
          <DogList
            data={data.dogs}
            renderRow={(type, data) => (
              <Link
                to={{
                  pathname: `/${data.breed}/${data.id}`,
                  state: { id: data.id }
                }}
                onMouseOver={() =>
                  client.query({
                    query: GET_DOG,
                    variables: { breed: data.breed }
                  })
                }
                style={{ textDecoration: "none" }}
              >
                <Dog {...data} url={data.displayImage} />
              </Link>
            )}
          />
        );
      }}
    </Query>
  </View>
);
```

All we have to do is access the client in the render prop function and call `client.query` when the user hovers over the link. Once the user clicks on the link, the data will already be available in the Apollo cache, so the user won't see a loading state.

There are a lot of different ways to anticipate that the user will end up needing some data in the UI. In addition to using the hover state, here are some other places you can preload data:

1. The next step of a multi-step wizard immediately
2. The route of a call-to-action button
3. All of the data for a sub-area of the application, to make navigating within that area instant

If you have some other ideas, please send a PR to this article, and maybe add some more code snippets. A special form of prefetching is [store hydration from the server](./server-side-rendering.html#store-rehydration), so you might also consider hydrating more data than is actually needed for the first page load to make other interactions faster.

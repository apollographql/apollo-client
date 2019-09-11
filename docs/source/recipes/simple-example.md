---
title: "Example app"
description: Introducing Pupstagram, an example app with the latest features!
---

Want to get started with Apollo Client? This page will guide you through your first GraphQL query with Apollo in less than ten minutes. For this example, we're going to be using:

- [Launchpad](https://launchpad.graphql.com/nx9zvp49q7) for our GraphQL server
- [CodeSandbox](https://codesandbox.io/s/r5qp83z0yq) for our example app, Pupstagram
- Apollo Boost, our new zero-config way to start using Apollo

## Your first query

First, install `apollo-boost`, `graphql` & `react-apollo`.

```shell
npm i apollo-boost graphql react-apollo -S
```

Next, create your client. Once you create your client, hook it up to your app by passing it to the `ApolloProvider` exported from `react-apollo`.

```jsx
import React from 'react';
import { render } from 'react-dom';
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from 'react-apollo';

// Pass your GraphQL endpoint to uri
const client = new ApolloClient({ uri: 'https://nx9zvp49q7.lp.gql.zone/graphql' });

const ApolloApp = () => (
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
);

render(ApolloApp, document.getElementById('root'));
```

Awesome! Your ApolloClient is now connected to your app. Let's create our `<App />` component and make our first query:

```jsx
import React from 'react';
import { gql } from 'apollo-boost';
import { Query } from 'react-apollo';

const GET_DOG = gql`
  query {
    dog(breed: "bulldog") {
      id
      breed
      displayImage
    }
  }
`

const App = () => (
  <Query query={GET_DOG}>
    {({ loading, error, data }) => {
      if (loading) return <div>Loading...</div>;
      if (error) return <div>Error :(</div>;

      return (
        <Dog url={data.dog.displayImage} breed={data.dog.breed} />
      )
    }}
  </Query>
)
```

Time to celebrate! 🎉 You just made your first Query component. The Query component binds your GraphQL query to your UI so Apollo Client can take care of fetching your data, tracking loading & error states, and updating your UI via the `data` prop. Why don't you try experimenting with creating more Query components by forking our example app, [Pupstagram](https://codesandbox.io/s/r5qp83z0yq)?

The easiest way to see what Apollo Client and GraphQL can do for you is to try them for yourself. Below is a simple example of a single React Native view that uses Apollo Client to talk to our hosted example app, GitHunt. We've embedded it in the page with the [Snack](https://blog.expo.io/sketch-a-playground-for-react-native-16b2401f44a2) editor from [Expo](https://expo.io/).

<div data-snack-id="HkhGxRFhe" data-snack-platform="ios" data-snack-preview="true" style="overflow:hidden;background:#fafafa;border:1px solid rgba(0,0,0,.16);border-radius:4px;height:514px;width:100%"></div>
<script async src="https://snack.expo.io/embed.js"></script>

To start, let's run the app. There are two ways:

1. Click the "Tap to Play" button to run the app in the simulator.
2. Open the editor [in a new window](https://snack.expo.io/HkhGxRFhe) and install the [Expo app](https://expo.io/) to run it on your iOS or Android device.

Either way, the app will automatically reload as you type.

## First edit

Fortunately, the app is set up for us to make our first code change. Hopefully, after launching the app you see a view with a scrollable list of some GitHub repositories. This is fetched from the server using a GraphQL query. Let's edit the query by removing the `#` in front of `stargazers_count`, so that the app also loads the number of stars from GitHub. The query should now look like this:

```graphql
{
  feed (type: TOP, limit: 10) {
    repository {
      name, owner { login }

      # Uncomment the line below to get number of stars!
      stargazers_count
    }

    postedBy { login }
  }
}
```

Because in this example we've developed the UI in such a way that it knows how to display that new information, you should see the app refresh and show the number of GitHub stars from each repository!

## Multiple backends

One of the coolest things about GraphQL is that it can be an abstraction layer on top of multiple backends. The query you did above is actually loading from two totally separate data sources at once: A PostgreSQL database that stores the list of submissions, and the GitHub REST API to fetch the information about the actual repositories.

Let's verify that the app is _actually_ reading from GitHub. Pick one of the repositories in the list, for example [apollographql/apollo-client](https://github.com/apollographql/apollo-client) or [facebook/graphql](https://github.com/facebook/graphql), and star it. Then, pull down the list in the app to refresh. You should see the number change! That's because our GraphQL server is fetching from the real GitHub API every time, with some nice caching and ETag handling to avoid hitting a rate limit.

## Explaining the code

Before you go off and build your own awesome GraphQL app with Apollo, let's take a look at the code in this simple example.

This bit of code uses the `graphql` higher-order component from `react-apollo` to attach a GraphQL query result to the `Feed` component:

```js
const FeedWithData = graphql(gql`{
  feed (type: TOP, limit: 10) {
    repository {
      name, owner { login }

      # Uncomment the line below to get number of stars!
      # stargazers_count
    }

    postedBy { login }
  }
}`, { options: { notifyOnNetworkStatusChange: true } })(Feed);
```

This is the main `App` component that React Native is rendering. It creates an Apollo Link with the server URL, initializes an instance of `ApolloClient`, and attaches that to our React component tree with `ApolloProvider`. If you've used Redux, this should be familiar, since it's similar to how the Redux provider works.

```jsx
export default class App {
  createClient() {
    // Initialize Apollo Client with URL to our server
    return new ApolloClient({
      link: createHttpLink({
        uri: 'http://api.githunt.com/graphql',
      }),
      cache: new InMemoryCache()
    });
  }

  render() {
    return (
      // Feed the client instance into your React component tree
      <ApolloProvider client={this.createClient()}>
        <FeedWithData />
      </ApolloProvider>
    );
  }
}
```

Next, we get to a component that is actually dealing with some data loading concerns. Mostly, this is just passing through the `data` prop down to `FeedList`, which will actually display the items. But there is also an interesting React Native `RefreshControl` component here, which uses the built-in `data.refetch` method from Apollo to refetch data when you pull down the list. It also uses the `data.networkStatus` prop to display the correct loading state, which Apollo tracks for us.

```jsx
// The data prop here comes from the Apollo HoC. It has the data
// we asked for, and also useful methods like refetch().
function Feed({ data }) {
  return (
    <ScrollView style={styles.container} refreshControl={
      // This enables the pull-to-refresh functionality
      <RefreshControl
        refreshing={data.networkStatus === 4}
        onRefresh={data.refetch}
      />
    }>
      <Text style={styles.title}>GitHunt</Text>
      <FeedList data={data} />
      <Text style={styles.fullApp}>See the full app at www.githunt.com</Text>
      <Button
        buttonStyle={styles.learnMore}
        onPress={goToApolloWebsite}
        icon={{name: 'code'}}
        raised
        backgroundColor="#22A699"
        title="Learn more about Apollo"
      />
    </ScrollView>
  );
}
```

Finally, we get to the place that actually displays the items, the `FeedList` component. This consumes the `data` prop from Apollo, and maps over it to display list items. You can see that thanks to GraphQL, we got the data in exactly the shape that we expected.

```jsx
function FeedList({ data }) {
  if (data.networkStatus === 1) {
    return <ActivityIndicator style={styles.loading} />;
  }

  if (data.error) {
    return <Text>Error! {data.error.message}</Text>;
  }

  return (
    <List containerStyle={styles.list}>
      { data.feed.map((item) => {
          const badge = item.repository.stargazers_count && {
            value: `☆ ${item.repository.stargazers_count}`,
            badgeContainerStyle: { right: 10, backgroundColor: '#56579B' },
            badgeTextStyle: { fontSize: 12 },
          };

          return <ListItem
            hideChevron
            title={`${item.repository.owner.login}/${item.repository.name}`}
            subtitle={`Posted by ${item.postedBy.login}`}
            badge={badge}
          />;
        }
      ) }
    </List>
  )
}
```

Now you've seen all of the code you need to build a React Native app that loads a list of items and displays it in a list with pull-to-refresh functionality. As you can see, we had to write very little data loading code! We think that Apollo and GraphQL can help data loading get out of your way so you can build apps faster than ever before.

## Next steps

Let's get you building your own app from scratch! You have two tutorials to go through, and we recommend doing them in the following order:

1. [Full-Stack GraphQL + React tutorial](https://blog.apollographql.com/full-stack-react-graphql-tutorial-582ac8d24e3b#.cwvxzphyc) by [Jonas Helfer](https://twitter.com/helferjs).
2. [How to GraphQL](https://www.howtographql.com/react-apollo/0-introduction/) by the team and community around [Graphcool](https://www.graph.cool/), a hosted GraphQL backend platform.

Have fun!

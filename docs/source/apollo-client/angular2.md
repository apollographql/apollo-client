---
title: Angular 2.0 integration
order: 111
description: How to use the Apollo Client to fetch GraphQL data in your Angular 2.0 application.
---

This package allows you to easily integrate your Apollo client with your Angular 2.0 app.

```bash
npm install angular2-apollo --save
```

[Follow apollostack/angular2-apollo on GitHub.](https://github.com/apollostack/angular2-apollo)

<h2 id="bootstrap">Bootstrap</h2>

If you want to define the default *ApolloClient* to be used by `Angular2Apollo` service, you can use `defaultApolloClient` provider.

```ts
import {
  bootstrap
} from '@angular/platform-browser-dynamic';

import {
  defaultApolloClient,
  APOLLO_PROVIDERS
} from 'angular2-apollo';

import ApolloClient, {
  createNetworkInterface
} from 'apollo-client';

import {
  MyAppClass
} from './app/<my-app-class>';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

bootstrap(<MyAppClass>, [
  APOLLO_PROVIDERS,
  defaultApolloClient(client)
  ]);
```

<h2 id="angular2apollo">Angular2Apollo service</h2>

This service allows you to bind queries and call mutations.

<h4 id="angular2apollo-inject">Inject</h4>

Since you previously used `APOLLO_PROVIDERS` to bootstrap you app, it is possible now just to define `Angular2Apollo` service inside the constructor.

```ts
import {
  Component,
  Injectable
} from '@angular/core';

import {
  Angular2Apollo
} from 'angular2-apollo';

@Component({
  selector: 'postsList',
  templateUrl: 'client/postsList.html'
})
@Injectable()
class postsList {
  constructor(private angularApollo : Angular2Apollo) {
  }
}
```

<h4 id="angular2apollo-queries">Queries</h4>

To bind to query you can use `watchQuery` method with the same arguments as [`ApolloClient#watchQuery`](core.html#watchQuery). In this case as the result you will receive the [`QueryObservable`](core.html#watchQuery).

Here's how you could run a query:

```ts
import {
  Component,
  Injectable
} from '@angular/core';

import {
  Angular2Apollo
} from 'angular2-apollo';

import {
  Observable
} from 'rxjs/Observable';

import gql from 'apollo-client/gql';

@Component({
  selector: 'postsList',
  templateUrl: 'client/postsList.html'
})
@Injectable()
class postsList {
  posts: Observable<any[]>;

  constructor(private angularApollo : Angular2Apollo) {
    this.posts = angularApollo.watchQuery({
      query: gql`
        query getPosts($tag: String) {
          posts(tag: $tag) {
            title
          }
        }
      `,
      variables: {
        tag: '1234'
      }
    });
  }
}
```

<h4 id="angular2apollo-mutations">Mutations</h4>

To call a mutation you can use `mutate` method with the same arguments as [`ApolloClient#mutate`](core.html#mutate). In this case as the result you will receive a promise that resolves to a GraphQLResult.

Here's how you would call a mutation and pass in arguments via variables:

```ts
import {
  Component,
  Injectable
} from '@angular/core';

import {
  Angular2Apollo
} from 'angular2-apollo';

import gql from 'apollo-client/gql';

import {
  graphQLResult
} from 'graphql';

@Component({
  selector: 'postsList',
  templateUrl: 'client/postsList.html'
})
@Injectable()
class postsList {
  constructor(private angularApollo : Angular2Apollo) {

  }

  postReply({
    token,
    topicId,
    categoryId,
    raw
  }) {
    angularApollo.mutate({
      mutation: gql`
        mutation postReply(
          $token: String!
          $topic_id: ID!
          $category_id: ID!
          $raw: String!
        ) {
          createPost(
            token: $token
            topic_id: $topic_id
            category: $category_id
            raw: $raw
          ) {
            id
            cooked
          }
        }
      `,
      variables: {
        token: token,
        topic_id: topicId,
        category_id: categoryId,
        raw: raw,
      }
    }).then((graphQLResult) => {
      const { errors, data } = graphQLResult;

      if (data) {
        console.log('got data', data);
      }

      if (errors) {
        console.log('got some GraphQL execution errors', errors);
      }
    }).catch((error) => {
      console.log('there was an error sending the query', error);
    });
  }
}
```

<h2 id="apollo">Apollo decorator</h2>

It allows you to define queries and mutations and to make them reactive. You can use the component's context inside of them and they will be always up to date.

- `client` to define the ApolloClient
- `queries` to map queries to component's context
- `mutations` to map mutations to component's context

<h4 id="apollo-queries">Queries</h4>

Each key on the object returned by `queries` function should be made up of the same possible arguments as [`ApolloClient#watchQuery`](core.html#watchQuery).

The result of each query contains the same API as [`QuerySubscription`](core.html#QuerySubscription) and has the following form:

```js
{
  queryName: any
  ...
  loading: boolean
  errors: Error[]
  ...
  refetch(variables: Object)
  unsubscribe()
  stopPolling()
  startPolling(pollInterval: number)
}
```

Since `queries` function receives one argument which is a component's context you can use it to define variables.
It is also reactive so your variables will be always up to date.

Here's how you could run a query:

```ts
import {
  Component, Injectable
} from '@angular/core';

import {
  Apollo
} from 'angular2-apollo';

import ApolloClient, {
  createNetworkInterface
} from 'apollo-client';

import gql from 'apollo-client/gql';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

@Component({
  selector: 'postsList',
  templateUrl: 'client/postsList.html'
})
@Injectable()
@Apollo({
  client,
  queries(context) {
    return {
      data: {
        query: gql`
          query getPosts($tag: String) {
            posts(tag: $tag) {
              title
            }
          }
        `,
        variables: {
          tag: context.tag
        },
        forceFetch: false,
        returnPartialData: true,
        pollInterval: 10000
      }
    };
  }
})
class postsList {
  public tag: string = '1234';
  public data: any;
}
```

<h4 id="apollo-mutations">Mutations</h4>

`mutations` function returns an object made up of keys and values that are custom functions to call the mutation. The resulting function must return the same possible arguments as [`ApolloClient#mutate`](core.html#mutate)

Since `mutations` function receives one argument which is a component's context you can use it to inside variables.
It is also reactive so your variables will be always up to date.

Here's how you could run a mutation:

```ts
import {
  Component,
  Injectable
} from '@angular/core';

import {
  Apollo
} from 'angular2-apollo';

import {
  GraphQLResult
} from 'graphql';

import ApolloClient, {
  createNetworkInterface
} from 'apollo-client';

import gql from 'apollo-client/gql';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

@Component({
  selector: 'postsList',
  templateUrl: 'client/postsList.html'
})
@Injectable()
@Apollo({
  client,
  mutations(context) {
    return {
      postReply: ({
        token,
        topicId,
        categoryId,
        raw
      }) => ({
        mutation: gql`
          mutation postReply(
            $token: String!
            $topic_id: ID!
            $category_id: ID!
            $raw: String!
          ) {
            createPost(
              token: $token
              topic_id: $topic_id
              category: $category_id
              raw: $raw
            ) {
              id
              cooked
            }
          }
        `,
        variables: {
          token: context.token,
          topic_id: topicId,
          category_id: categoryId,
          raw: raw,
        }
      })
    };
  }
})
class postsList {
  public token: string = 'random';

  reply(reply) {
    this.postReply(reply)
      .then((result: GraphQLResult) => {
        const { errors, data } = result;

        if (data) {
          console.log('got data', data);
        }

        if (errors) {
          console.log('got some GraphQL execution errors', errors);
        }
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });
  }
}
```

<h2 id="apolloquerypipe">ApolloQueryPipe</h2>

Each Apollo query can include few queries.

[`Angular2Apollo#watchQuery`](angular2.html#angular2apollo-mutations) returns an Apollo observable.
In combination with AsyncPipe the data comes in the following form:

```ts
{
  data: {
    firstQuery: any
    secondQuery: any
  }
}
```

Using `@Apollo` decorator, queries come directly as properties of result object. It looks like this:

```ts
{
  firstQuery: any
  secondQuery: any
}
```

To handle that more easily we've created the `ApolloQueryPipe`.
It automatically knows where to look for the query. You don't have to worry about it.

Here is how it works:

```html
<ul>
  <li *ngFor="let post of data | apolloQuery:'posts'">
      {{ post.title }}
  </li>
</ul>
```

We are pondering about a solution that will return an observable per single query and then we won't need that pipe anymore.

<h2 id="development">Development</h2>

Running tests locally:

```
# nvm use node
npm install
npm test
```

This project uses TypeScript for static typing and TSLint for linting. You can get both of these built into your editor with no configuration by opening this project in [Visual Studio Code](https://code.visualstudio.com/), an open source IDE which is available for free on all platforms.

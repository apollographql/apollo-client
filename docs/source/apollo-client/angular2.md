---
title: Angular 2.0 integration
order: 111
description: How to use the Apollo Client to fetch GraphQL data in your Angular 2.0 application.
---

<h2 id="install">Install</h2>

```bash
npm install angular2-apollo --save
```

[Follow apollostack/angular2-apollo on GitHub.](https://github.com/apollostack/angular2-apollo)

<h2 id="bootstrap">Bootstrap</h2>

```ts
import {
  bootstrap
} from 'angular2/platform/browser';

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

<h2 id="inject-angular2apollo">Inject Angular2Apollo</h2>

```ts
import {
  Component,
  Injectable
} from 'angular2/core';

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

<h2 id="bind-to-query">Bind to query</h2>

<h4 id="bind-to-query-using-service">Using Angular2Apollo service</h4>

```ts
import {
  Component,
  Injectable
} from 'angular2/core';

import {
  Angular2Apollo
} from 'angular2-apollo';

import {
  Observable
} from 'rxjs/Observable';

@Component({
  selector: 'postsList',
  templateUrl: 'client/postsList.html'
})
@Injectable()
class postsList {
  posts: Observable<any[]>;

  constructor(private angularApollo : Angular2Apollo) {
    this.posts = angularApollo.watchQuery({
      query: `
        query getPosts($tag: String) {
          posts(tag: $tag) {
            title
          }
        }
      `,
      variables: {
        tag: "1234"
      }
    });
  }
}
```


<h4 id="bind-to-query-using-decorator">Using Apollo decorator</h4>

```ts
import {
  Component, Injectable
} from 'angular2/core';

import {
  Apollo
} from 'angular2-apollo';

import ApolloClient, {
  createNetworkInterface
} from 'apollo-client';

import {
  Observable
} from 'rxjs/Observable';

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
      posts: {
        query: `
          query getPosts($tag: String) {
            posts(tag: $tag) {
              title
            }
          }
        `,
        variables: {
          tag: "1234"
        }
      }
    };
  }
})
class postsList {
  posts: Observable<any[]>;
}
```

<h2 id="apolloquerypipe">ApolloQueryPipe</h2>

Apollo client exposes queries as observables, but each Apollo query can include few queries.

So inside an Apollo observable the data comes in the following form: `obs.data.queryName`

To handle that more easily we've created the `ApolloQueryPipe`. here is how it works:

template:
```html
<ul>
  <li *ngFor="#post of posts | async | apolloQuery:'posts'">
      {{ post.title }}
  </li>
</ul>
```

We are pondering about a solution that will return an observable per single query and then we won't need that pipe anymore.

<h2 id="mutations">Mutations</h2>

<h4 id="mutations-using-service">Using Angular2Apollo service</h4>

```ts
import {
  Component,
  Injectable
} from 'angular2/core';

import {
  Angular2Apollo
} from 'angular2-apollo';

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
      mutation: `
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

<h4 id="mutations-using-decorator">Using Apollo decorator</h4>

```ts
import {
  Component,
  Injectable
} from 'angular2/core';

import {
  Apollo
} from 'angular2-apollo';

import {
  graphQLResult
} from 'graphql';

import ApolloClient, {
  createNetworkInterface
} from 'apollo-client';

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
        mutation: `
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
      })
    };
  }
})
class postsList {
  constructor() {

  }
  
  reply(reply) {
    this.postReply(reply)
      .then((graphQLResult) => {
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

<h2 id="development">Development</h2>

Running tests locally:

```
# nvm use node
npm install
npm test
```

This project uses TypeScript for static typing and TSLint for linting. You can get both of these built into your editor with no configuration by opening this project in [Visual Studio Code](https://code.visualstudio.com/), an open source IDE which is available for free on all platforms.

---
title: Angular 2.0 integration
order: 151
description: How to use the Apollo Client to fetch GraphQL data in your Angular 2.0 application.
---

This package allows you to easily integrate your Apollo client with your Angular 2.0 app.

```bash
npm install angular2-apollo --save
```

[Follow apollostack/angular2-apollo on GitHub.](https://github.com/apollostack/angular2-apollo)

<h2 id="bootstrap">Bootstrap</h2>

*Angular Modules*, also known as *NgModules*, are the powerful new way to organize and bootstrap your Angular application.

<h4 id="bootstrap-apollo-module">ApolloModule</h4>

If you want to define the default *ApolloClient* to be used by `Angular2Apollo` service, you can use `defaultApolloClient` provider.

```ts
import { NgModule } from '@angular/core';
import { BrowserModule  } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { ApolloModule, defaultApolloClient } from 'angular2-apollo';
import ApolloClient, { createNetworkInterface } from 'apollo-client';

import { AppComponent } from './app.component';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

@NgModule({
  imports: [
    BrowserModule,
    ApolloModule,
  ],
  declarations: [ AppComponent ],
  providers: [ defaultApolloClient(client) ],
  bootstrap: [ AppComponent ],
})
class AppModule {}

platformBrowserDynamic().bootstrapModule(AppModule);
```

<h4 id="bootstrap-apollo-module-with-client">ApolloModule.withClient</h4>

You can also define the default *ApolloClient* to be used by `Angular2Apollo` service, by using `ApolloModule.withClient`.

```ts
import { NgModule } from '@angular/core';
import { BrowserModule  } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { ApolloModule } from 'angular2-apollo';
import ApolloClient, { createNetworkInterface } from 'apollo-client';

import { AppComponent } from './app.component';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

@NgModule({
  imports: [
    BrowserModule,
    ApolloModule.withClient(client),
  ],
  declarations: [ AppComponent ],
  bootstrap: [ AppComponent ],
})
class AppModule {}

platformBrowserDynamic().bootstrapModule(AppModule);
```

<h2 id="angular2apollo">Angular2Apollo service</h2>

This service allows you to bind queries and call mutations.

<h4 id="angular2apollo-inject">Inject</h4>

Since you previously used `APOLLO_PROVIDERS` to bootstrap you app, it is possible now just to define `Angular2Apollo` service inside the constructor.

```ts
import { Component } from '@angular/core';
import { Angular2Apollo } from 'angular2-apollo';

@Component({
  selector: 'posts-list',
  templateUrl: 'client/posts-list.component.html'
})
class PostsListComponent {
  constructor(private angularApollo : Angular2Apollo) {
  }
}
```

<h4 id="angular2apollo-queries">Queries</h4>

To bind to query you can use `watchQuery` method with the same arguments as [`ApolloClient#watchQuery`](queries.html#watchQuery). In this case as the result you will receive the `ApolloQueryObservable`. It is an enhanced version of [`QueryObservable`](queries.html#watchQuery) that can be used with RxJS's operators.

Here's how you could run a query:

```ts
import 'rxjs';

import { Component } from '@angular/core';
import { Angular2Apollo, ApolloQueryObservable } from 'angular2-apollo';

import gql from 'graphql-tag';

@Component({
  selector: 'posts-list',
  templateUrl: 'client/posts-list.component.html'
})
class PostsListComponent {
  posts: ApolloQueryObservable<any[]>;

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
    })
      .map((post) => {
        post.title = post.title.toUpperCase();
        return post;
      });
  }
}
```

If you just want to fetch a query you can use `query` method with the same arguments as [`ApolloClient#query`](queries.html#query). In this case as the result you will receive the Promise that resolves to a [`ApolloQueryResult`](queries.html#query).

Here's how you could run a query:

```ts
import { Component } from '@angular/core';
import { Angular2Apollo } from 'angular2-apollo';

import gql from 'graphql-tag';

@Component({
  selector: 'posts-list',
  templateUrl: 'client/posts-list.component.html'
})
class PostsListComponent {
  posts: any[] = [];

  constructor(private angularApollo : Angular2Apollo) {
    angularApollo.query({
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
    })
      .then(({ data }) => {
        this.posts = data;
      });
  }
}
```

**Variables with observable values**

You can specify variables values as observables. Every time those observables emit new values, the query is rebuild.

```ts
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Angular2Apollo, ApolloQueryObservable } from 'angular2-apollo';
import { Subject } from 'rxjs/Subject';

import gql from 'graphql-tag';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/debounceTime';

@Component({
  selector: 'search',
  template: `
    <input type="search" placeholder="Search..." [formControl]="searchControl" />

    <ul>
      <li *ngFor="let result of results | async">
        {{result.title}}
      </li>
    </ul>
  `
})
class SearchComponent implements OnInit {
  results: ApolloQueryObservable<any[]>;
  searchControl = new FormControl();
  search: Subject<string> = new Subject<string>();

  constructor(private angularApollo : Angular2Apollo) {}

  ngOnInit() {
    this.results = angularApollo.query({
      query: gql`
        query getResults($search: String) {
          results(title: $search) {
            title
          }
        }
      `,
      variables: {
        title: this.search
      }
    }).map(response => response.data.results);

    this.searchControl.valueChanges
      .debounceTime(300)
      .subscribe(search => {
        this.search.next(search);
      });
  }
}
```

It is important to know that it is possible to mix observable values with primitive values.

<h4 id="angular2apollo-mutations">Mutations</h4>

To call a mutation you can use `mutate` method with the same arguments as [`ApolloClient#mutate`](mutations.html#mutate). In this case as the result you will receive a promise that resolves to a ApolloQueryResult.

Here's how you would call a mutation and pass in arguments via variables:

```ts
import { Component } from '@angular/core';
import { Angular2Apollo } from 'angular2-apollo';

import gql from 'graphql-tag';

@Component({
  selector: 'posts-list',
  templateUrl: 'client/posts-list.component.html'
})
class PostsListComponent {
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
    }).then((result) => {
      const { data } = result;

      if (data) {
        console.log('got data', data);
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

Each key on the object returned by `queries` function should be made up of the same possible arguments as [`ApolloClient#watchQuery`](queries.html#watchQuery).

The result of each query contains the same API as [`QuerySubscription`](queries.html#QuerySubscription) and has the following form:

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
import { Component } from '@angular/core';
import { Apollo } from 'angular2-apollo';
import ApolloClient, { createNetworkInterface } from 'apollo-client';

import gql from 'graphql-tag';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

@Component({
  selector: 'posts-list',
  templateUrl: 'client/posts-list.component.html'
})
@Apollo({
  client,
  queries(context: PostsListComponent) {
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
class PostsListComponent {
  public tag: string = '1234';
  public data: any;
}
```

<h4 id="apollo-mutations">Mutations</h4>

`mutations` function returns an object made up of keys and values that are custom functions to call the mutation. The resulting function must return the same possible arguments as [`ApolloClient#mutate`](mutations.html#mutate)

Since `mutations` function receives one argument which is a component's context you can use it to inside variables.
It is also reactive so your variables will be always up to date.

Here's how you could run a mutation:

```ts
import { Component } from '@angular/core';
import { Apollo } from 'angular2-apollo';

import ApolloClient, { createNetworkInterface, ApolloQueryResult } from 'apollo-client';

import gql from 'graphql-tag';

const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://localhost:8080')
});

@Component({
  selector: 'posts-list',
  templateUrl: 'client/posts-list.component.html'
})
@Apollo({
  client,
  mutations(context: PostsListComponent) {
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
class PostsListComponent {
  public token: string = 'random';

  reply(reply) {
    this.postReply(reply)
      .then((result: ApolloQueryResult) => {
        const { data } = result;

        if (data) {
          console.log('got data', data);
        }
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });
  }
}
```

<h2 id="selectpipe">SelectPipe</h2>

> NOTE: Since v0.4.4 the `SelectPipe` has replaced the `ApolloQueryPipe`, which is now deprecated. Both share the same logic, but have different names.

Each Apollo query can include few sub queries.

[`Angular2Apollo#watchQuery`](angular2.html#angular2apollo-mutations) returns an Apollo observable.
In combination with AsyncPipe the data comes in the following form:

```ts
{
  data: {
    firstSubQuery: any
    secondSubQuery: any
  }
}
```

Using `@Apollo` decorator, queries come directly as properties of result object. It looks like this:

```ts
{
  firstSubQuery: any
  secondSubQuery: any
}
```

To handle that more easily we've created the `SelectPipe`.
It automatically knows where to look for the query. You don't have to worry about it.

Here is how it works:

```ts
gql`
  query allPosts {
    posts {
      title
      author {
        name
      }
    }
    currentUser {
      name
    }
  }
`
```

```html
<ul>
  <li *ngFor="let post of data | select:'posts'">
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

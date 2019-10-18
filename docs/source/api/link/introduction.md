---
title: Introduction
description: Understanding and building custom Apollo Links
---

Apollo Link is a simple yet powerful way to describe how you want to get the result of a GraphQL operation, and what you want to do with the results. You've probably come across "middleware" that might transform a request and its result: Apollo Link is an abstraction that is meant to solve similar problems in a much more flexible and elegant way.

Apollo Links are chainable "units" that you can snap together to define how each GraphQL request is handled by your GraphQL client. When you fire a GraphQL request, each link's functionality is applied one after another. This allows you to control the request lifecycle in a way that makes sense for your application. For example, links can provide retrying, polling, batching, and more.

By default, Apollo Client uses the Apollo Link API behind the scenes, to build an HTTP link that can be used to communicate with a GraphQL based API. The creation and control of this HTTP link is managed by Apollo Client internally, and covers a lot of Apollo Client use cases without any additional customization.

> If your application is only interested in making HTTP based requests to a GraphQL endpoint, there's a good chance you don't need to interact with the Apollo Link API. Refer to the [Basic HTTP networking](/networking/basic-http-networking) section for more details around Apollo Client's out of the box HTTP support.

If you would like to extend or replace Apollo Client's default networking approach, you can build one or more custom Apollo Link's, chain them together, and configure them to be used by Apollo Client instead of the default HTTP based link. Refer to the [Concepts](/api/link/concepts) section to understand the motivation behind the link API and its different pieces, and to get started on writing your own custom links.

---
title: File uploads
description: Enabling file uploads in Apollo Client
---

Apollo Client doesn't support a file upload feature out of the box. If you'd like to enable file upload capabilities, you will have to set Apollo Client up manually with a 3rd party package.

Detailed instructions on how to setup Apollo Client for file upload can be found here: [https://github.com/jaydenseric/apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

An example configuration is show below using the [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client) package.

```bash
npm install apollo-upload-client
```

Basic setup for the Apollo Client:

```js
const { ApolloClient } = require('apollo-client')
const { InMemoryCache } = require('apollo-cache-inmemory')
const { createUploadLink } = require('apollo-upload-client')

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: createUploadLink()
})
```
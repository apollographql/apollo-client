# Documentation

This is the documentation **source** for this repository.

The **deployed** version of the documentation for this repository is available at:

* https://www.apollographql.com/docs/react/

For general local installation and development instructions, see the [docs site README](https://github.com/apollographql/docs).

In order to build and develop the Apollo Client docs locally, you will need to follow these additional steps:

1. Clone the docs site repository ([https://github.com/apollographql/docs](https://github.com/apollographql/docs)) in a sibling directory to your local copy of the [`apollo-client`](https://github.com/apollographql/apollo-client) repository.
2. `cd docs && npm i`
3. Open a new terminal, `cd apollo-client`, make changes to the docs and run `npm run docmodel`
4. Back in the terminal window where you've checked out and cd'd into the `docs` repository, run `DOCS_MODE='local' npm run start:local -- ../apollo-client`
5. Open a browser and visit `http://localhost:3000`
6. Note: you'll need to manually remove the `/react` segment of the URL from the path inside the browser

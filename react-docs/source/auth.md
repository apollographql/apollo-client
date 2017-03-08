---
title: Authentication
---

Unless all of the data you are loading is completely public, your app has some sort of users, accounts and permissions systems. If different users have different permissions in your application, then you need a way to tell the server which user is associated with each request.

Apollo Client comes with a pluggable [HTTP network interface](/core/network.html) that includes several options for authentication.

## Cookie

If your app is browser based and you are using cookies for login and session management with a backend, it's very easy to tell your network interface to send the cookie along with every request. You just need to pass the credentials option. e.g.  `{ credentials: 'same-origin' }` as shown below, if your backend server is the same domain or else `{ credentials: 'include' }` if your backend is a different domain. 

```js
const networkInterface = createNetworkInterface({
  uri: '/graphql',
  opts: {
    credentials: 'same-origin',
  },
});

const client = new ApolloClient({
  networkInterface,
});
```

This option is simply passed through to the [`fetch` polyfill](https://github.com/github/fetch) used by the network interface when sending the query.

Note: the backend must also allow credentials from the requested origin. e.g. if using the popular 'cors' package from npm in node.js, the following settings would work in tandem with the above apollo client settings, 

// enable cors
var corsOptions = {
  origin: '<insert uri of front-end domain>',
  credentials: true // <-- REQUIRED backend setting
};
app.use(cors(corsOptions));

## Header

Another common way to identify yourself when using HTTP is to send along an authorization header. The Apollo network interface has a middleware feature that lets you modify requests before they are sent to the server. It's easy to add an `authorization` header to every HTTP request. In this example, we'll pull the login token from `localStorage` every time a request is sent:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface({
  uri: '/graphql',
});

networkInterface.use([{
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the header object if needed.
    }

    // get the authentication token from local storage if it exists
    const token = localStorage.getItem('token');
    req.options.headers.authorization = token ? `Bearer ${token}` : null;
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

The server can use that header to authenticate the user and attach it to the GraphQL execution context, so resolvers can modify their behavior based on a user's role and permissions.

<h2 id="login-logout">Reset store on logout</h2>

Since Apollo caches all of your query results, it's important to get rid of them when the login state changes.

The easiest way to ensure that the UI and store state reflects the current user's permissions is to call `client.resetStore()` after your login or logout process has completed. This will cause the store to be cleared and all active queries to be refetched. Another option is to reload the page, which will have a similar effect.


```js
class Profile extends React.Component {
  constructor(props) {
    super(props);

    this.logout = () => {
      App.logout() // or whatever else your logout flow is
      .then(() =>
        props.client.resetStore();
      )
      .catch(err =>
        console.error('Logout failed', err);
      );
    }
  }

  render() {
    const { loading, currentUser } = this.props;

    if (loading) {
      return (
        <p className="navbar-text navbar-right">
          Loading...
        </p>
      );
    } else if (currentUser) {
      return (
        <span>
          <p className="navbar-text navbar-right">
            {currentUser.login}
            &nbsp;
            <button onClick={this.logout}>Log out</button>
          </p>
        </span>
      );
    }
    return (
      <p className="navbar-text navbar-right">
        <a href="/login/github">Log in with GitHub</a>
      </p>
    );
  }
}

Profile.propTypes = {
  client: React.PropTypes.instanceOf(ApolloClient),
  loading: React.PropTypes.bool,
  currentUser: React.PropTypes.shape({
    login: React.PropTypes.string.isRequired,
  }),
};

const PROFILE_QUERY = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

export default withApollo(graphql(PROFILE_QUERY, {
  options: { forceFetch: true },
  props: ({ data: { loading, currentUser } }) => ({
    loading, currentUser,
  }),
})(Profile));
```

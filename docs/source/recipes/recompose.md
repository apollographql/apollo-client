---
title: Recompose patterns
---

[Recompose](https://github.com/acdlite/recompose) is a nice toolbelt for working with React components in a reusable functional way. The workflow is similar to something like Underscore or Lodash for JavaScript, which can help you avoid re-implementing common functional patterns. Check out the [Recompose documentation](https://github.com/acdlite/recompose/blob/master/docs/API.md) for all the details.

<h2 id="loading-status">Loading status</h2>

During graphql HoC execution, there is time while data are loading which we need to handle quite often. By default `loading` state is only active during first fetch. [Read more about loading state and network status in the query docs.](../basics/queries.html#graphql-query-data-loading)

Most of the time we want to just show some loading component. So we end up with something like this:

```js
const Component = props => {
  if (props.data.loading) {
    return <LoadingPlaceholder>
  }

  return (
    <div>Our component</div>
  )
}
```

Recompose has a utility function `branch()` which let us compose different HoC's based on the results of a test function. We can combine it with another Recompose method, `renderComponent()`. So we can say "If we are loading, render `LoadingPlaceholder` instead of our default component", like so:

```js
import { propType } from 'graphql-anywhere'

const renderWhileLoading = (component, propName = 'data') =>
  branch(
    props => props[propName] && props[propName].loading,
    renderComponent(component),
  );

const Component = props => (<div>Our component for {props.user.name}</div>)
Component.propTypes = {
  user: propType(getUser).isRequired, // autogenerating proptypes, as we expect them to be always there (yeah, if no error)
}

const enhancedComponent = compose(
  graphql(getUser, { name: "user" }),
  renderWhileLoading(LoadingPlaceholder, "user")
)(Component);

export default enhancedComponent;
```

This way our wrapped component is only rendered outside of loading. That means we only need to take care of 2 states - error or successful load.

> Note: `loading` is only true during the first fetch for a particular query. But if you enable [options.notifyOnNetworkStatusChange](../basics/queries.html#graphql-config-options-notifyOnNetworkStatusChange) you can keep track of other loading status using the [data.networkStatus](../basics/queries.html#graphql-query-data-networkStatus) field. You can use a similar pattern to the above.

<h2 id="error-handling">Error handling</h2>

Similar to loading state above, we might want to display a different component in the case of an error, or let the user `refetch()`. We will use `withProps()` to place the refetch method directly on props. This way our universal error handler can always expect it there and is not coupled with exact query invocation.

```js
const renderForError = (component, propName = "data") =>
  branch(
    props => props[propName] && props[propName].error,
    renderComponent(component),
  );

const ErrorComponent = props =>(
  <span>
    Something went wrong, you can try to
    <button onClick={props.refetch}>refetch</button>
  </span>
)

const setRefetchProp = (propName = "data") =>
  withProps(props => ({refetch: props[propName] && props[propName].data}))

const enhancedComponent = compose(
  graphql(getUser, { name: "user" }),
  renderWhileLoading(LoadingPlaceholder, "user"),
  setRefetchProp("user"),
  renderForError(ErrorComponent, "user"),
)(Component);

export default enhancedComponent;
```

Now we can really count on results being available for our default component and don't have to manually check for loading state or errors inside the render function.

<h2 id="query-lifecycle">Query lifecycle</h2>

There are some usecases when we need to execute something after query finish fetching.
From the example above, we would render our default component only when there is no error and loading is finished.

But it is just a stateless component, it has no lifecycle hooks. If we need extra lifecycle functionality, Recompose's `lifecycle()` to the rescue:

```js
const execAtMount = lifecycle({
  componentWillMount() {
    executeSomething();
  },
})

const enhancedComponent = compose(
  graphql(getUser, { name: "user" }),
  renderWhileLoading(LoadingPlaceholder, "user"),
  setRefetchProp("user"),
  renderForError(ErrorComponent, "user"),
  execAtMount,
)(Component);
```

The above works well if we just want something to happen at component mount time.

Lets define another more advanced usecase, for example I am using `react-select` to let user pick an option from the results of a query. I want to always display the react-select, which has its own loading state indicator. The, I want to automatically select predefined option after query finish fetching.

There is one special thing we need to handle if we want to fetch for every component instance with the default fetchPolicy, we need to be aware that the query can skip loading state when data is already in the cache. That would mean we need to handle `networkStatus === 7` on mount.

We will also use recompose's `withState()` to keep value for our option picker. For this example we will assume the default `data` prop name is unchanged.

```js
const DEFAULT_PICK = "orange";
const withPickerValue = withState("pickerValue", "setPickerValue", null);

// find matching option
const findOption = (options, ourLabel) =>
  lodashFind(options, option => option.label.toLowerCase() === ourLabel.toLowerCase());

const withAutoPicking = lifecycle({
  componentWillReceiveProps(nextProps) {
    // when value was already picked
    if (nextProps.pickerValue) {
      return;
    }
    // networkStatus change from 1 to 7 - initial load finished successfully
    if (this.props.data.networkStatus === 1 && nextProps.data.networkStatus === 7) {
      const match = findOption(nextProps.data.options)
      if (match) {
        nextProps.setPickerValue(match);
      }
    }
  },
  componentWillMount() {
    const { pickerValue, setPickerValue, data } = this.props;
    if (pickerValue) {
      return;
    }
    // when Apollo query is resolved from cache,
    // it already have networkStatus 7 at mount time
    if (data.networkStatus === 7 && !data.error) {
      const match = findOption(data.options);
      if (match) {
        setPickerValue(match);
      }
    }
  },
});

const Component = props => (
  <Select
    loading={props.data.loading}
    value={props.pickerValue && props.pickerValue.value || null}
    onChange={props.setPickerValue}
    options={props.data.options || undefined}
  />
);

const enhancedComponent = compose(
  graphql(getOptions),
  withPickerValue,
  withAutoPicking,
)(Component);
```

<h2 id="controlling-poll-interval">Controlling pollInterval</h2>

This case is borrowed from [David Glasser's post on the Apollo blog](https://dev-blog.apollodata.com/dynamic-graphql-polling-with-react-and-apollo-client-fb36e390d250) about the Meteor's Galaxy UI migrations panel implementation. In the post, he says:

> We’re not usually running any migrations, so a nice, slow polling interval like 30 seconds seemed reasonable. But in the rare case where a migration is running, I wanted to be able to see much faster updates on its progress.

> The key to this is knowing that the `options` parameter to react-apollo’s main graphql function can itself be a function that depends on its incoming React props. (The `options` parameter describes the options for the query itself, as opposed to React-specific details like what property name to use for data.) We can then use recompose's `withState()` to set the poll interval from a prop passed in to the graphql component, and use the `componentWillReceiveProps` React lifecycle event (added via the recompose lifecycle helper) to look at the fetched GraphQL data and adjust if necessary.

Let's look at the code:

```js
import { graphql } from "react-apollo";
import gql from "graphql-tag";
import { compose, withState, lifecycle } from "recompose";

const DEFAULT_INTERVAL = 30 * 1000;
const ACTIVE_INTERVAL = 500;

const withData = compose(
  // Pass down two props to the nested component: `pollInterval`,
  // which defaults to our normal slow poll, and `setPollInterval`,
  // which lets the nested components modify `pollInterval`.
  withState("pollInterval", "setPollInterval", DEFAULT_INTERVAL),
  graphql(
    gql`
      query getMigrationStatus {
        activeMigration {
          name
          version
          progress
        }
      }
    `,
    {
      // If you think it's clear enough, you can abbreviate this as:
      //   options: ({pollInterval}) => ({pollInterval}),
      options: props => {
        return {
          pollInterval: props.pollInterval
        };
      }
    }
  ),
  lifecycle({
    componentWillReceiveProps({
      data: { loading, activeMigration },
      pollInterval,
      setPollInterval
    }) {
      if (loading) {
        return;
      }
      if (activeMigration && pollInterval !== ACTIVE_INTERVAL) {
        setPollInterval(ACTIVE_INTERVAL);
      } else if (
        !activeMigration &&
        pollInterval !== DEFAULT_INTERVAL
      ) {
        setPollInterval(DEFAULT_INTERVAL);
      }
    }
  })
);
const MigrationPanelWithData = withData(MigrationPanel);
```

Note that we check the current value of `pollInterval` before changing it, because by default in React, nested components will get re-rendered any time we change state, even if you change it to the same value. You can deal with this using `componentShouldUpdate` or `React.PureComponent`, but in this case it’s straightforward just to only set the state when it’s actually changing.

<h2 id="other">Other usecases</h2>

You can use similar DRY approach with Recompose's help for many other use cases like keeping state above the `graphql` HOC, to be used in it's options function to change variables/pollingInterval etc.

Normaly if you need to add sideffect to mutate function, you would manage it in HOC's `options->props` part by doing something like `{ mutate: () => mutate().then(sideEffectHandler) }`. But that is not very reusable. Using recompose's `withHandlers()` you can compose same prop manipulation in any count of components. [Blog example](https://medium.com/front-end-developers/how-i-write-mutations-in-apollo-w-recompose-1c0ab06ef4ea)

Mutation run can also be tracked with `withState` as it has no effect on query's `loading` state. It is usefull to disable button or whole form while submitting etc.

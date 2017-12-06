---
title: Recompose patterns
---

There is this nice toolbelt for working with components in a reusable functional way. If you used underscore/lodash you know how such library can improve workflow.

Before jumping into the code, there are some usefull links:
* [Github repo](https://github.com/acdlite/recompose)
* [Recompose documentation](https://github.com/acdlite/recompose/blob/master/docs/API.md)

## Loading status

During graphql HoC execution, there is time while data are loading which we need to somehow handle all the time. By default `loading` state is only active during first fetch.

Most of the time we want to just show some loader or such. So we end up with something like this
```
const Component = props => {
  if (props.data.loading) {
    return <LoadingPlaceholder>
  }
  return (
    <div>Our component</div>
  )
}
```

Recompose have this utility function `branch()` which let us compose different HoC's based on test function results. We can combine it with another function `renderComponent()`.

So we can say "If we are loading, render `LoadingPlaceholder` instead of our default component"
```
import { propType } from 'graphql-anywhere'

const renderWhileLoading = (component, propName = "data") =>
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

This way our default component is only rendered outside of loading. That means we need to take care of 2 states - error or successfull.

Note: By default `loading` state would happen only during first fetch. But if you enabled [options.notifyOnNetworkStatusChange](../basics/queries.html#graphql-config-options-notifyOnNetworkStatusChange) it could happen also in between loading. Than you can use [data.networkStatus](../basics/queries.html#graphql-query-data-networkStatus) to handle different states in more granular way.

## Error handling

In case of errors for standard queries, we can display different component and let user `refetch()`.

We will use `withProps()` to also place refetch method directly on props. This way our universal error handler could always expect it there and is not coupled with exact query invocation.
```
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
Now we can really count with results being available for our default component and get rid of other pile of `if (error)` unnecessary code.

## Query lifecycle

There are some usecases when we need to execute something after query finish fetching.
From the example above, we would render our default component only when there is no error and loading is finished.

But it is just stateless component, it has no lifecycle hooks. Recompose's `lifecycle()` to the rescue. 
```
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
This is the usecase if we wanted something just at component mount time.

Lets define another more advanced usecase, for example I am using `react-select` to let user pick option from apollo fetched. I want to always display the react-select which has it's own loading state indicator which we use. And I want to autoselect predefined option after query finish fetching.

There is 1 special thing we need to count with - if we want to fetch and autopick for every component instance with default fetchPolicy, be aware that query can skip loading state when data is already in cache. That would mean we need to handle networkStatus 7 on mount.

We will also use recompose's `withState()` to keep value for our option picker. For this example we will count with default `data` prop name.

```
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

## Controlling pollInterval
Let's borrow some example from Meteor's Galaxy UI panel migrations implementation.

We’re not usually running any migrations, so a nice, slow polling interval like 30 seconds seemed reasonable. But in the rare case where a migration is running, I wanted to be able to see much faster updates on its progress.

The key to this is knowing that the `options` parameter to react-apollo’s main graphql function can itself be a function that depends on its incoming React props. (The `options` parameter describes the options for the query itself, as opposed to React-specific details like what property name to use for data.) We can then use recompose's `withState()` to set the poll interval from a prop passed in to the graphql component, and use the `componentWillReceiveProps` React lifecycle event (added via the recompose lifecycle helper) to look at the fetched GraphQL data and adjust if necessary.

```
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

Using this pattern successfully requires at least version 2.0.3 of apollo-client, as earlier versions had a bug related to changing pollInterval.

## Other usecases

You can use similar DRY approach with recompose's help for many other usecases like keeping state above graphql HOC to be used in it's options function to change variables/pollingInterval etc.

Normaly if you need to add sideffect to mutate function, you would manage it in HOC's `options->props` part by doing something like `{ mutate: () => mutate().then(sideEffectHandler) }`. But that is not very reusable. Using recompose's `withProps()` you can compose same prop manipulation in any count of components.

Mutation run can also be tracked with `withState` as it has no effect on query's `loading` state. It is usefull to disable button or whole form while submitting etc.

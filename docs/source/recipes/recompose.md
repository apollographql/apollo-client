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

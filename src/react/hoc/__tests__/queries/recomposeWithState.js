// Adapted from v0.30.0 of https://github.com/acdlite/recompose/blob/master/src/packages/recompose/withState.js
// to avoid incurring an indirect dependency on ua-parser-js via fbjs.

import { createFactory, Component } from 'react'

const setStatic = (key, value) => BaseComponent => {
  /* eslint-disable no-param-reassign */
  BaseComponent[key] = value
  /* eslint-enable no-param-reassign */
  return BaseComponent
}

const setDisplayName = displayName => setStatic('displayName', displayName)

const getDisplayName = Component => {
  if (typeof Component === 'string') {
    return Component
  }

  if (!Component) {
    return undefined
  }

  return Component.displayName || Component.name || 'Component'
}

const wrapDisplayName = (BaseComponent, hocName) =>
  `${hocName}(${getDisplayName(BaseComponent)})`

export const withState = (
  stateName,
  stateUpdaterName,
  initialState
) => BaseComponent => {
  const factory = createFactory(BaseComponent)
  class WithState extends Component {
    state = {
      stateValue:
        typeof initialState === 'function'
          ? initialState(this.props)
          : initialState,
    }

    updateStateValue = (updateFn, callback) =>
      this.setState(
        ({ stateValue }) => ({
          stateValue:
            typeof updateFn === 'function' ? updateFn(stateValue) : updateFn,
        }),
        callback
      )

    render() {
      return factory({
        ...this.props,
        [stateName]: this.state.stateValue,
        [stateUpdaterName]: this.updateStateValue,
      })
    }
  }

  if (__DEV__) {
    return setDisplayName(wrapDisplayName(BaseComponent, 'withState'))(
      WithState
    )
  }

  return WithState
}

// Jest complains if modules within __tests__ directories contain no tests.
describe("withState", () => {
  it("is a function", () => {
    expect(typeof withState).toBe("function");
  });
});

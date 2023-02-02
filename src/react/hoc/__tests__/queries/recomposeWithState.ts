// Adapted from v0.30.0 of https://github.com/acdlite/recompose/blob/master/src/packages/recompose/withState.js
// to avoid incurring an indirect dependency on ua-parser-js via fbjs.

import React, { createFactory, Component } from "react";
import '../../../../utilities/globals'; // For __DEV__

const setStatic =
  (key: string, value: string) => (BaseComponent: React.ComponentClass) => {
    // @ts-ignore
    BaseComponent[key] = value;
    return BaseComponent;
  };

const setDisplayName = (displayName: string) =>
  setStatic("displayName", displayName);

const getDisplayName = (Component: React.ComponentClass) => {
  if (typeof Component === "string") {
    return Component;
  }

  if (!Component) {
    return undefined;
  }

  return Component.displayName || Component.name || "Component";
};

const wrapDisplayName = (
  BaseComponent: React.ComponentClass,
  hocName: string
) => `${hocName}(${getDisplayName(BaseComponent)})`;

export const withState =
  (stateName: string, stateUpdaterName: string, initialState: unknown) =>
  (BaseComponent: React.ComponentClass) => {
    const factory = createFactory(BaseComponent);
    class WithState extends Component<Record<string, unknown>, { stateValue: unknown }> {
      state = {
        stateValue:
          typeof initialState === "function"
            ? initialState(this.props)
            : initialState,
      };

      updateStateValue = (
        updateFn: (stateValue: unknown) => void,
        callback: () => void
      ) =>
        this.setState(
          ({ stateValue }) => ({
            stateValue:
              typeof updateFn === "function" ? updateFn(stateValue) : updateFn,
          }),
          callback
        );

      render() {
        return factory({
          ...this.props,
          [stateName]: this.state.stateValue,
          [stateUpdaterName]: this.updateStateValue,
        });
      }
    }

    if (__DEV__) {
      return setDisplayName(wrapDisplayName(BaseComponent, "withState"))(
        WithState
      );
    }

    return WithState;
  };

// Jest complains if modules within __tests__ directories contain no tests.
describe("withState", () => {
  it("is a function", () => {
    expect(typeof withState).toBe("function");
  });
});

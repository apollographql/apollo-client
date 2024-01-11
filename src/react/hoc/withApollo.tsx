import { invariant } from "../../utilities/globals/index.js";
import * as React from "rehackt";
import type * as ReactTypes from "react";
import hoistNonReactStatics from "hoist-non-react-statics";

import { ApolloConsumer } from "../context/index.js";
import type { OperationOption, WithApolloClient } from "./types.js";

function getDisplayName<P>(WrappedComponent: ReactTypes.ComponentType<P>) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}

/**
 * @deprecated
 * Official support for React Apollo higher order components ended in March 2020.
 * This library is still included in the `@apollo/client` package, but it no longer receives feature updates or bug fixes.
 */
export function withApollo<TProps, TResult = any>(
  WrappedComponent: ReactTypes.ComponentType<
    WithApolloClient<Omit<TProps, "client">>
  >,
  operationOptions: OperationOption<TProps, TResult> = {}
): ReactTypes.ComponentClass<Omit<TProps, "client">> {
  const withDisplayName = `withApollo(${getDisplayName(WrappedComponent)})`;

  class WithApollo extends React.Component<Omit<TProps, "client">> {
    static displayName = withDisplayName;
    static WrappedComponent = WrappedComponent;

    // wrapped instance
    private wrappedInstance: any;

    constructor(props: Omit<TProps, "client">) {
      super(props);
      this.setWrappedInstance = this.setWrappedInstance.bind(this);
    }

    getWrappedInstance() {
      invariant(
        operationOptions.withRef,
        `To access the wrapped instance, you need to specify ` +
          `{ withRef: true } in the options`
      );

      return this.wrappedInstance;
    }

    setWrappedInstance(
      ref: ReactTypes.ComponentType<WithApolloClient<TProps>>
    ) {
      this.wrappedInstance = ref;
    }

    render() {
      return (
        <ApolloConsumer>
          {(client) => {
            const props = Object.assign({}, this.props, {
              client,
              ref:
                operationOptions.withRef ? this.setWrappedInstance : undefined,
            });
            return <WrappedComponent {...props} />;
          }}
        </ApolloConsumer>
      );
    }
  }

  // Make sure we preserve any custom statics on the original component.
  return hoistNonReactStatics(WithApollo, WrappedComponent, {});
}

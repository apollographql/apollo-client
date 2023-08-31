import React from "react";
import gql from "graphql-tag";

import { graphql } from "../graphql";

let sampleOperation = gql`
  {
    user {
      name
    }
  }
`;

describe("statics", () => {
  it("should be preserved", () => {
    const ApolloContainer = graphql(sampleOperation)(
      class extends React.Component<any, any> {
        static veryStatic = "such global";
      }
    );

    expect((ApolloContainer as any).veryStatic).toBe("such global");
  });

  it("exposes a debuggable displayName", () => {
    @graphql(sampleOperation)
    class ApolloContainer extends React.Component<any, any> {}

    expect((ApolloContainer as any).displayName).toBe(
      "Apollo(ApolloContainer)"
    );
  });

  it("honors custom display names", () => {
    const ApolloContainer = graphql(sampleOperation)(
      class extends React.Component<any, any> {
        static displayName = "Foo";
      }
    );

    expect((ApolloContainer as any).displayName).toBe("Apollo(Foo)");
  });
});

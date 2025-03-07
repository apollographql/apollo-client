/** @jest-environment node */
import React from "react";
import { DocumentNode } from "graphql";
import { gql } from "graphql-tag";
import { mockSingleLink } from "../../../testing/index.js";
import { ApolloClient } from "../../../core/index.js";
import { InMemoryCache } from "../../../cache/index.js";
import { ApolloProvider } from "../../context/index.js";
import { useLazyQuery } from "../../hooks/index.js";
import { renderToStringWithData } from "../../ssr/index.js";

describe("useLazyQuery Hook SSR", () => {
  const CAR_QUERY: DocumentNode = gql`
    query {
      cars {
        make
        model
        vin
      }
    }
  `;

  const CAR_RESULT_DATA = {
    cars: [
      {
        make: "Audi",
        model: "RS8",
        vin: "DOLLADOLLABILL",
        __typename: "Car",
      },
    ],
  };

  it("should run query only after calling the lazy mode execute function", () => {
    const link = mockSingleLink({
      request: { query: CAR_QUERY },
      result: { data: CAR_RESULT_DATA },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      ssrMode: true,
    });

    const Component = () => {
      let html = null;
      const [execute, { loading, called, data }] = useLazyQuery(CAR_QUERY);

      if (!loading && !called) {
        execute();
      }

      if (!loading && called) {
        expect(loading).toEqual(false);
        expect(data).toEqual(CAR_RESULT_DATA);
        html = <p>{data.cars[0].make}</p>;
      }

      return html;
    };

    const app = (
      <ApolloProvider client={client}>
        <Component />
      </ApolloProvider>
    );

    return renderToStringWithData(app).then((markup) => {
      expect(markup).toMatch(/Audi/);
    });
  });
});

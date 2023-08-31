import gql from "graphql-tag";

import { createOperation } from "../../utils/createOperation";
import {
  selectHttpOptionsAndBody,
  fallbackHttpConfig,
} from "../selectHttpOptionsAndBody";

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe("headerNormalization", () => {
  it("normalizes HTTP header names to lower case by default", () => {
    const config = {
      headers: {
        accept: "text/html",
        ACCEPT: "text/html",
        "content-type": "application/graphql",
        "CONTENT-TYPE": "application/graphql",
      },
    };

    const { options, body } = selectHttpOptionsAndBody(
      createOperation({}, { query }),
      fallbackHttpConfig,
      config
    );

    expect(body).toHaveProperty("query");
    expect(body).not.toHaveProperty("extensions");

    expect(options.headers).toEqual({
      accept: "text/html",
      "content-type": "application/graphql",
    });
  });

  it("preserves HTTP header name capitalization when enabled", () => {
    const config = {
      headers: {
        accept: "text/html",
        ACCEPT: "text/html",
        "content-type": "application/graphql",
        "CONTENT-TYPE": "application/graphql",
      },
      http: { preserveHeaderCase: true },
    };

    const { options } = selectHttpOptionsAndBody(
      createOperation({}, { query }),
      fallbackHttpConfig,
      config
    );

    expect(options.headers).toEqual({
      ACCEPT: "text/html",
      "CONTENT-TYPE": "application/graphql",
    });
  });

  it("ensures context preserveHeaderCase overrides link config (true->false)", () => {
    const linkConfig = {
      headers: {
        accept: "text/html",
        ACCEPT: "text/html",
      },
      http: { preserveHeaderCase: true },
    };
    const contextConfig = {
      headers: {
        "content-type": "application/graphql",
        "CONTENT-TYPE": "application/graphql",
      },
      http: { preserveHeaderCase: false },
    };
    const { options } = selectHttpOptionsAndBody(
      createOperation({}, { query }),
      fallbackHttpConfig,
      linkConfig,
      contextConfig
    );

    expect(options.headers).toEqual({
      accept: "text/html",
      "content-type": "application/graphql",
    });
  });

  it("ensures context preserveHeaderCase overrides link config (false->true)", () => {
    const linkConfig = {
      headers: {
        accept: "text/html",
        ACCEPT: "text/html",
      },
      http: { preserveHeaderCase: false },
    };
    const contextConfig = {
      headers: {
        "content-type": "application/graphql",
        "CONTENT-TYPE": "application/graphql",
      },
      http: { preserveHeaderCase: true },
    };
    const { options } = selectHttpOptionsAndBody(
      createOperation({}, { query }),
      fallbackHttpConfig,
      linkConfig,
      contextConfig
    );

    expect(options.headers).toEqual({
      ACCEPT: "text/html",
      "CONTENT-TYPE": "application/graphql",
    });
  });

  it("ensures link headerNormalization affects context headers", () => {
    const linkConfig = {
      headers: {
        accept: "text/html",
        ACCEPT: "text/html",
      },
      http: { preserveHeaderCase: true },
    };
    const contextConfig = {
      headers: {
        "content-type": "application/graphql",
        "CONTENT-TYPE": "application/graphql",
      },
    };

    const { options } = selectHttpOptionsAndBody(
      createOperation({}, { query }),
      fallbackHttpConfig,
      linkConfig,
      contextConfig
    );

    expect(options.headers).toEqual({
      ACCEPT: "text/html",
      "CONTENT-TYPE": "application/graphql",
    });
  });
});

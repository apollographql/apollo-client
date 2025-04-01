import { Readable } from "stream";
import { TextDecoder } from "util";

import { gql } from "graphql-tag";
import { ReadableStream } from "web-streams-polyfill";

import { execute } from "@apollo/client/link/core";
import { HttpLink } from "@apollo/client/link/http";
import { InvariantError } from "@apollo/client/utilities/invariant";

import { ObservableStream } from "../../../testing/internal/index.js";



const sampleDeferredQuery = gql`
  query SampleDeferredQuery {
    stub {
      id
      ... on Stub @defer {
        name
      }
    }
  }
`;

const BOUNDARY = "gc0p4Jq0M2Yt08jU534c0p";

describe("multipart responses", () => {
  let originalTextDecoder: any;
  beforeAll(() => {
    originalTextDecoder = TextDecoder;
    (globalThis as any).TextDecoder = TextDecoder;
  });

  afterAll(() => {
    globalThis.TextDecoder = originalTextDecoder;
  });

  const bodyCustomBoundary = [
    `--${BOUNDARY}`,
    "Content-Type: application/json; charset=utf-8",
    "Content-Length: 43",
    "",
    '{"data":{"stub":{"id":"0"}},"hasNext":true}',
    `--${BOUNDARY}`,
    "Content-Type: application/json; charset=utf-8",
    "Content-Length: 58",
    "",
    '{"hasNext":false, "incremental": [{"data":{"name":"stubby"},"path":["stub"]}]}',
    `--${BOUNDARY}--`,
  ].join("\r\n");

  const bodyIncorrectChunkType = [
    `---`,
    "Content-Type: foo/bar; charset=utf-8",
    "Content-Length: 43",
    "",
    '{"data":{"stub":{"id":"0"}},"hasNext":true}',
    `---`,
    "Content-Type: foo/bar; charset=utf-8",
    "Content-Length: 58",
    "",
    '{"hasNext":false, "incremental": [{"data":{"name":"stubby"},"path":["stub"]}]}',
    `-----`,
  ].join("\r\n");

  const results = [
    {
      data: {
        stub: {
          id: "0",
        },
      },
      hasNext: true,
    },
    {
      incremental: [
        {
          data: {
            name: "stubby",
          },
          path: ["stub"],
        },
      ],
      hasNext: false,
    },
  ];

  it("can handle whatwg stream bodies", async () => {
    const stream = new ReadableStream({
      async start(controller) {
        const lines = bodyCustomBoundary.split("\r\n");
        try {
          for (const line of lines) {
            controller.enqueue(line + "\r\n");
          }
        } finally {
          controller.close();
        }
      },
    });

    const fetch = jest.fn(async () => ({
      status: 200,
      body: stream,
      headers: new Headers({
        "content-type": `multipart/mixed; boundary=${BOUNDARY}`,
      }),
    }));

    const link = new HttpLink({
      fetch: fetch as any,
    });

    const observable = execute(link, { query: sampleDeferredQuery });
    const observableStream = new ObservableStream(observable);

    for (const result of results) {
      await expect(observableStream).toEmitValue(result);
    }

    await expect(observableStream).toComplete();
  });

  it("can handle whatwg stream bodies with arbitrary splits", async () => {
    const stream = new ReadableStream({
      async start(controller) {
        let chunks: Array<string> = [];
        let chunkSize = 15;
        for (let i = 0; i < bodyCustomBoundary.length; i += chunkSize) {
          chunks.push(bodyCustomBoundary.slice(i, i + chunkSize));
        }

        try {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
        } finally {
          controller.close();
        }
      },
    });

    const fetch = jest.fn(async () => ({
      status: 200,
      body: stream,
      headers: new Headers({
        "content-type": `multipart/mixed; boundary=${BOUNDARY}`,
      }),
    }));

    const link = new HttpLink({
      fetch: fetch as any,
    });

    const observable = execute(link, { query: sampleDeferredQuery });
    const observableStream = new ObservableStream(observable);

    for (const result of results) {
      await expect(observableStream).toEmitValue(result);
    }

    await expect(observableStream).toComplete();
  });

  it("throws error on non-streamable body", async () => {
    // non-streamable body
    const body = 12345;
    const fetch = jest.fn(async () => ({
      status: 200,
      body,
      headers: new Headers({
        "content-type": `multipart/mixed; boundary=${BOUNDARY}`,
      }),
    }));
    const link = new HttpLink({
      fetch: fetch as any,
    });
    const observable = execute(link, { query: sampleDeferredQuery });
    const mockError = {
      throws: new InvariantError(
        "Unknown type for `response.body`. Please use a `fetch` implementation that is WhatWG-compliant and that uses WhatWG ReadableStreams for `body`."
      ),
    };

    const observableStream = new ObservableStream(observable);

    await expect(observableStream).toEmitError(mockError.throws);
  });

  // test is still failing as observer.complete is called even after error is thrown
  it.failing("throws error on unsupported patch content type", async () => {
    const stream = Readable.from(
      bodyIncorrectChunkType.split("\r\n").map((line) => line + "\r\n")
    );
    const fetch = jest.fn(async () => ({
      status: 200,
      body: stream,
      headers: new Headers({
        "content-type": `multipart/mixed; boundary=${BOUNDARY}`,
      }),
    }));
    const link = new HttpLink({
      fetch: fetch as any,
    });
    const observable = execute(link, { query: sampleDeferredQuery });
    const mockError = {
      throws: new Error(
        "Unsupported patch content type: application/json is required"
      ),
    };
    const observableStream = new ObservableStream(observable);

    await expect(observableStream).toEmitError(mockError.throws);
  });

  describe("without TextDecoder defined in the environment", () => {
    beforeAll(() => {
      originalTextDecoder = TextDecoder;
      (globalThis as any).TextDecoder = undefined;
    });

    afterAll(() => {
      globalThis.TextDecoder = originalTextDecoder;
    });

    it("throws error if TextDecoder not defined in the environment", async () => {
      const stream = Readable.from(
        bodyIncorrectChunkType.split("\r\n").map((line) => line + "\r\n")
      );
      const fetch = jest.fn(async () => ({
        status: 200,
        body: stream,
        headers: new Headers({
          "content-type": `multipart/mixed; boundary=${BOUNDARY}`,
        }),
      }));
      const link = new HttpLink({
        fetch: fetch as any,
      });
      const observable = execute(link, { query: sampleDeferredQuery });
      const mockError = {
        throws: new Error(
          "TextDecoder must be defined in the environment: please import a polyfill."
        ),
      };

      const observableStream = new ObservableStream(observable);

      await expect(observableStream).toEmitError(mockError.throws);
    });
  });
});

import gql from "graphql-tag";
import { execute } from "../../core/execute";
import { HttpLink } from "../HttpLink";
import { itAsync, subscribeAndCount } from "../../../testing";
import type { Observable } from "zen-observable-ts";
import { ObservableQuery } from "../../../core";
import { TextEncoder, TextDecoder } from "util";
import { ReadableStream } from "web-streams-polyfill";
import { Readable } from "stream";

var Blob = require("blob-polyfill").Blob;

function makeCallback<TArgs extends any[]>(
  resolve: () => void,
  reject: (error: Error) => void,
  callback: (...args: TArgs) => any
) {
  return function () {
    try {
      // @ts-expect-error
      callback.apply(this, arguments);
      resolve();
    } catch (error) {
      reject(error as Error);
    }
  } as typeof callback;
}

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

function matchesResults<T>(
  resolve: () => void,
  reject: (err: any) => void,
  observable: Observable<T>,
  results: Array<T>
) {
  // TODO: adding a second observer to the observable will consume the
  // observable. I want to test completion, but the subscribeAndCount API
  // doesn’t have anything like that.
  subscribeAndCount(
    reject,
    observable as unknown as ObservableQuery,
    (count, result) => {
      // subscribeAndCount is 1-indexed for some terrible reason.
      if (0 >= count || count > results.length) {
        reject(new Error("Unexpected result"));
      }

      expect(result).toEqual(results[count - 1]);
      if (count === results.length) {
        resolve();
      }
    }
  );
}

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

  const bodyDefaultBoundary = [
    `---`,
    "Content-Type: application/json; charset=utf-8",
    "Content-Length: 43",
    "",
    '{"data":{"stub":{"id":"0"}},"hasNext":true}',
    `---`,
    "Content-Type: application/json; charset=utf-8",
    "Content-Length: 58",
    "",
    '{"hasNext":false, "incremental": [{"data":{"name":"stubby"},"path":["stub"]}]}',
    `-----`,
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

  const bodyBatchedResults = [
    "--graphql",
    "content-type: application/json",
    "",
    '{"data":{"allProducts":[{"delivery":{"__typename":"DeliveryEstimates"},"sku":"federation","id":"apollo-federation","__typename":"Product"},{"delivery":{"__typename":"DeliveryEstimates"},"sku":"studio","id":"apollo-studio","__typename":"Product"}]},"hasNext":true}',
    "--graphql",
    "content-type: application/json",
    "",
    '{"hasNext":true,"incremental":[{"data":{"estimatedDelivery":"6/25/2021","fastestDelivery":"6/24/2021","__typename":"DeliveryEstimates"},"path":["allProducts",0,"delivery"]},{"data":{"estimatedDelivery":"6/25/2021","fastestDelivery":"6/24/2021","__typename":"DeliveryEstimates"},"path":["allProducts",1,"delivery"]}]}',
    "--graphql",
    "content-type: application/json",
    "",
    '{"hasNext":false}',
    "--graphql--",
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

  const batchedResults = [
    {
      data: {
        allProducts: [
          {
            __typename: "Product",
            delivery: {
              __typename: "DeliveryEstimates",
            },
            id: "apollo-federation",
            sku: "federation",
          },
          {
            __typename: "Product",
            delivery: {
              __typename: "DeliveryEstimates",
            },
            id: "apollo-studio",
            sku: "studio",
          },
        ],
      },
      hasNext: true,
    },
    {
      hasNext: true,
      incremental: [
        {
          data: {
            __typename: "DeliveryEstimates",
            estimatedDelivery: "6/25/2021",
            fastestDelivery: "6/24/2021",
          },
          path: ["allProducts", 0, "delivery"],
        },
        {
          data: {
            __typename: "DeliveryEstimates",
            estimatedDelivery: "6/25/2021",
            fastestDelivery: "6/24/2021",
          },
          path: ["allProducts", 1, "delivery"],
        },
      ],
    },
  ];

  itAsync("can handle whatwg stream bodies", (resolve, reject) => {
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
    matchesResults(resolve, reject, observable, results);
  });

  itAsync(
    "can handle whatwg stream bodies with arbitrary splits",
    (resolve, reject) => {
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
      matchesResults(resolve, reject, observable, results);
    }
  );

  itAsync(
    "can handle node stream bodies (strings) with default boundary",
    (resolve, reject) => {
      const stream = Readable.from(
        bodyDefaultBoundary.split("\r\n").map((line) => line + "\r\n")
      );

      const fetch = jest.fn(async () => ({
        status: 200,
        body: stream,
        // if no boundary is specified, default to -
        headers: new Headers({
          "content-type": `multipart/mixed`,
        }),
      }));
      const link = new HttpLink({
        fetch: fetch as any,
      });

      const observable = execute(link, { query: sampleDeferredQuery });
      matchesResults(resolve, reject, observable, results);
    }
  );

  itAsync(
    "can handle node stream bodies (strings) with arbitrary splits",
    (resolve, reject) => {
      let chunks: Array<string> = [];
      let chunkSize = 15;
      for (let i = 0; i < bodyCustomBoundary.length; i += chunkSize) {
        chunks.push(bodyCustomBoundary.slice(i, i + chunkSize));
      }
      const stream = Readable.from(chunks);

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
      matchesResults(resolve, reject, observable, results);
    }
  );

  itAsync(
    "can handle node stream bodies (array buffers)",
    (resolve, reject) => {
      const stream = Readable.from(
        bodyDefaultBoundary
          .split("\r\n")
          .map((line) => new TextEncoder().encode(line + "\r\n"))
      );

      const fetch = jest.fn(async () => ({
        status: 200,
        body: stream,
        // if no boundary is specified, default to -
        headers: new Headers({
          "content-type": `multipart/mixed`,
        }),
      }));
      const link = new HttpLink({
        fetch: fetch as any,
      });

      const observable = execute(link, { query: sampleDeferredQuery });
      matchesResults(resolve, reject, observable, results);
    }
  );

  itAsync(
    "can handle node stream bodies (array buffers) with batched results",
    (resolve, reject) => {
      const stream = Readable.from(
        bodyBatchedResults
          .split("\r\n")
          .map((line) => new TextEncoder().encode(line + "\r\n"))
      );

      const fetch = jest.fn(async () => ({
        status: 200,
        body: stream,
        // if no boundary is specified, default to -
        headers: new Headers({
          "content-type": `multipart/mixed;boundary="graphql";deferSpec=20220824`,
        }),
      }));
      const link = new HttpLink({
        fetch: fetch as any,
      });

      const observable = execute(link, { query: sampleDeferredQuery });
      matchesResults(resolve, reject, observable, batchedResults);
    }
  );

  itAsync("can handle streamable blob bodies", (resolve, reject) => {
    const body = new Blob(bodyCustomBoundary.split("\r\n"), {
      type: "application/text",
    });
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
    body.stream = () => stream;
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
    matchesResults(resolve, reject, observable, results);
  });

  itAsync("can handle non-streamable blob bodies", (resolve, reject) => {
    const body = new Blob(
      bodyCustomBoundary.split("\r\n").map((i) => i + "\r\n"),
      { type: "application/text" }
    );
    body.stream = undefined;

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
    matchesResults(resolve, reject, observable, results);
  });

  itAsync("throws error on non-streamable body", (resolve, reject) => {
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
      throws: new Error(
        "Unknown body type for responseIterator. Please pass a streamable response."
      ),
    };

    observable.subscribe(
      () => reject("next should not have been called"),
      makeCallback(resolve, reject, (error) => {
        expect(error).toEqual(mockError.throws);
      }),
      () => reject("complete should not have been called")
    );
  });

  // test is still failing as observer.complete is called even after error is thrown
  // itAsync('throws error on unsupported patch content type', (resolve, reject) => {
  //   const stream = Readable.from(
  //     bodyIncorrectChunkType.split("\r\n").map((line) => line + "\r\n")
  //   );
  //   const fetch = jest.fn(async () => ({
  //     status: 200,
  //     body: stream,
  //     headers: new Headers({ "content-type": `multipart/mixed; boundary=${BOUNDARY}` }),
  //   }));
  //   const link = new HttpLink({
  //     fetch: fetch as any,
  //   });
  //   const observable = execute(link, { query: sampleDeferredQuery });
  //   const mockError = { throws: new Error('Unsupported patch content type: application/json is required') };

  //   observable.subscribe(
  //     () => reject('next should not have been called'),
  //     makeCallback(resolve, reject, (error) => {
  //       expect(error).toEqual(mockError.throws);
  //     }),
  //     () => reject('complete should not have been called'),
  //   );
  // });

  describe("without TextDecoder defined in the environment", () => {
    beforeAll(() => {
      originalTextDecoder = TextDecoder;
      (globalThis as any).TextDecoder = undefined;
    });

    afterAll(() => {
      globalThis.TextDecoder = originalTextDecoder;
    });

    itAsync(
      "throws error if TextDecoder not defined in the environment",
      (resolve, reject) => {
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

        observable.subscribe(
          () => reject("next should not have been called"),
          makeCallback(resolve, reject, (error) => {
            expect(error).toEqual(mockError.throws);
          }),
          () => reject("complete should not have been called")
        );
      }
    );
  });
});

import gql from "graphql-tag";
import fetchMock from "fetch-mock";

import { createOperation } from "../../utils/createOperation";
import {
  parseAndCheckHttpResponse,
  parseJsonBody,
} from "../parseAndCheckHttpResponse";
import { itAsync } from "../../../testing";

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe("parseAndCheckResponse", () => {
  beforeEach(() => {
    fetchMock.restore();
  });

  const operations = [createOperation({}, { query })];

  itAsync(
    "throws a Server error when response is > 300 with unparsable json",
    (resolve, reject) => {
      const status = 400;
      fetchMock.mock("begin:/error", status);
      fetch("error")
        .then(parseAndCheckHttpResponse(operations))
        .then(reject)
        .catch((e) => {
          expect(e.statusCode).toBe(status);
          expect(e.name).toBe("ServerError");
          expect(e).toHaveProperty("response");
          expect(e.bodyText).toBe(undefined);
          resolve();
        })
        .catch(reject);
    }
  );

  itAsync(
    "throws a ServerParse error when response is 200 with unparsable json",
    (resolve, reject) => {
      const status = 200;
      fetchMock.mock("begin:/error", status);
      fetch("error")
        .then(parseAndCheckHttpResponse(operations))
        .then(reject)
        .catch((e) => {
          expect(e.statusCode).toBe(status);
          expect(e.name).toBe("ServerParseError");
          expect(e).toHaveProperty("response");
          expect(e).toHaveProperty("bodyText");
          resolve();
        })
        .catch(reject);
    }
  );

  itAsync(
    "throws a network error with a status code and result",
    (resolve, reject) => {
      const status = 403;
      const body = { data: "fail" }; //does not contain data or errors
      fetchMock.mock("begin:/error", {
        body,
        status,
      });
      fetch("error")
        .then(parseAndCheckHttpResponse(operations))
        .then(reject)
        .catch((e) => {
          expect(e.statusCode).toBe(status);
          expect(e.name).toBe("ServerError");
          expect(e).toHaveProperty("response");
          expect(e).toHaveProperty("result");
          resolve();
        })
        .catch(reject);
    }
  );

  itAsync("throws a server error on incorrect data", (resolve, reject) => {
    const data = { hello: "world" }; //does not contain data or erros
    fetchMock.mock("begin:/incorrect", data);
    fetch("incorrect")
      .then(parseAndCheckHttpResponse(operations))
      .then(reject)
      .catch((e) => {
        expect(e.statusCode).toBe(200);
        expect(e.name).toBe("ServerError");
        expect(e).toHaveProperty("response");
        expect(e.result).toEqual(data);
        resolve();
      })
      .catch(reject);
  });

  itAsync("is able to return a correct GraphQL result", (resolve, reject) => {
    const errors = ["", "" + new Error("hi")];
    const data = { data: { hello: "world" }, errors };

    fetchMock.mock("begin:/data", {
      body: data,
    });
    fetch("data")
      .then(parseAndCheckHttpResponse(operations))
      .then(({ data, errors: e }) => {
        expect(data).toEqual({ hello: "world" });
        expect(e.length).toEqual(errors.length);
        expect(e).toEqual(errors);
        resolve();
      })
      .catch(reject);
  });
});

describe("parseJsonBody", () => {
  it("(called with one argument) parses JSON from response without calling JSON.parse", async () => {
    const spy = jest.spyOn(JSON, "parse");
    try {
      const received = { data: new Array(1000).fill({ hello: "world" }) };
      const response = new Response(JSON.stringify(received), {
        status: 200,
      });
      const promise = parseJsonBody(response);
      await expect(promise).resolves.toEqual(received);

      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("(called with two arguments) uses `JSON.parse`", async () => {
    const spy = jest.spyOn(JSON, "parse");
    const originalResponse = global.Response;
    try {
      const received = { data: new Array(1000).fill({ hello: "world" }) };
      const response = new Response(JSON.stringify(received), {
        status: 200,
      });
      const bodyText = await response.text();

      // @ts-expect-error
      delete global.Response;

      const promise = parseJsonBody(response, bodyText);
      await expect(promise).resolves.toEqual(received);

      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      global.Response = originalResponse;
    }
  });
});

import gql from "graphql-tag";
import fetchMock from "fetch-mock";

import { createOperation } from "../../utils/createOperation";
import { parseAndCheckHttpResponse } from "../parseAndCheckHttpResponse";

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

  it("throws a Server error when response is > 300 with unparsable json", async () => {
    const status = 400;
    fetchMock.mock("begin:/error", status);

    const error = await fetch("error")
      .then(parseAndCheckHttpResponse(operations))
      .catch((error) => error);

    expect(error.statusCode).toBe(status);
    expect(error.name).toBe("ServerError");
    expect(error).toHaveProperty("response");
    expect(error.bodyText).toBe(undefined);
  });

  it("throws a ServerParse error when response is 200 with unparsable json", async () => {
    const status = 200;
    fetchMock.mock("begin:/error", status);
    const error = await fetch("error")
      .then(parseAndCheckHttpResponse(operations))
      .catch((error) => error);

    expect(error.statusCode).toBe(status);
    expect(error.name).toBe("ServerParseError");
    expect(error).toHaveProperty("response");
    expect(error).toHaveProperty("bodyText");
  });

  it("throws a network error with a status code and result", async () => {
    const status = 403;
    const body = { data: "fail" }; //does not contain data or errors
    fetchMock.mock("begin:/error", {
      body,
      status,
    });
    const error = await fetch("error")
      .then(parseAndCheckHttpResponse(operations))
      .catch((error) => error);

    expect(error.statusCode).toBe(status);
    expect(error.name).toBe("ServerError");
    expect(error).toHaveProperty("response");
    expect(error).toHaveProperty("result");
  });

  it("throws a server error on incorrect data", async () => {
    const data = { hello: "world" }; //does not contain data or erros
    fetchMock.mock("begin:/incorrect", data);
    const error = await fetch("incorrect")
      .then(parseAndCheckHttpResponse(operations))
      .catch((error) => error);

    expect(error.statusCode).toBe(200);
    expect(error.name).toBe("ServerError");
    expect(error).toHaveProperty("response");
    expect(error.result).toEqual(data);
  });

  it("is able to return a correct GraphQL result", async () => {
    const errors = ["", "" + new Error("hi")];
    const data = { data: { hello: "world" }, errors };

    fetchMock.mock("begin:/data", {
      body: data,
    });

    {
      const { data, errors: e } = await fetch("data").then(
        parseAndCheckHttpResponse(operations)
      );

      expect(data).toEqual({ hello: "world" });
      expect(e.length).toEqual(errors.length);
      expect(e).toEqual(errors);
    }
  });
});

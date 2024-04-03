import "@testing-library/jest-dom";
import { beforeAll, afterAll, afterEach, jest } from "@jest/globals";
import { server } from "./mocks/server";
import { gql } from "@apollo/client";

gql.disableFragmentWarnings();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

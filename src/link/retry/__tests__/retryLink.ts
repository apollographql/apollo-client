import gql from "graphql-tag";

import { ApolloLink } from "../../core/ApolloLink";
import { execute } from "../../core/execute";
import { Observable, of, throwError } from "rxjs";
import { RetryLink } from "../retryLink";
import {
  mockMultipartSubscriptionStream,
  ObservableStream,
} from "../../../testing/internal";
import { ApolloError } from "../../../core";

const query = gql`
  {
    sample {
      id
    }
  }
`;

const standardError = new Error("I never work");

describe("RetryLink", () => {
  it("fails for unreachable endpoints", async () => {
    const max = 10;
    const retry = new RetryLink({ delay: { initial: 1 }, attempts: { max } });
    const stub = jest.fn(() => throwError(() => standardError)) as any;
    const link = ApolloLink.from([retry, stub]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(standardError, { timeout: 1000 });

    expect(stub).toHaveBeenCalledTimes(max);
  });

  it("returns data from the underlying link on a successful operation", async () => {
    const retry = new RetryLink();
    const data = { data: { hello: "world" } };
    const stub = jest.fn(() => of(data));
    const link = ApolloLink.from([retry, stub]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitValue(data);
    await expect(stream).toComplete();

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("returns data from the underlying link on a successful retry", async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 2 },
    });
    const data = { data: { hello: "world" } };
    const stub = jest.fn();
    stub.mockReturnValueOnce(throwError(() => standardError));
    stub.mockReturnValueOnce(of(data));
    const link = ApolloLink.from([retry, stub]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitValue(data);
    await expect(stream).toComplete();

    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("calls unsubscribe on the appropriate downstream observable", async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 2 },
    });
    const data = { data: { hello: "world" } };
    const unsubscribeStub = jest.fn();

    const firstTry = throwError(() => standardError);
    // Hold the test hostage until we're hit
    let secondTry;
    const untilSecondTry = new Promise<void>((resolve) => {
      secondTry = {
        subscribe(observer: any) {
          resolve(); // Release hold on test.

          Promise.resolve().then(() => {
            observer.next(data);
            observer.complete();
          });
          return { unsubscribe: unsubscribeStub };
        },
      };
    });

    const stub = jest.fn();
    stub.mockReturnValueOnce(firstTry);
    stub.mockReturnValueOnce(secondTry);
    const link = ApolloLink.from([retry, stub]);

    const subscription = execute(link, { query }).subscribe({});
    await untilSecondTry;
    subscription.unsubscribe();
    expect(unsubscribeStub).toHaveBeenCalledTimes(1);
  });

  it("multiple subscribers will trigger multiple requests", async () => {
    const subscriber = {
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
    };
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 5 },
    });
    const data = { data: { hello: "world" } };
    const stub = jest.fn();
    stub.mockReturnValueOnce(throwError(() => standardError));
    stub.mockReturnValueOnce(throwError(() => standardError));
    stub.mockReturnValueOnce(of(data));
    stub.mockReturnValueOnce(throwError(() => standardError));
    stub.mockReturnValueOnce(throwError(() => standardError));
    stub.mockReturnValueOnce(of(data));
    const link = ApolloLink.from([retry, stub]);

    const observable = execute(link, { query });
    observable.subscribe(subscriber);
    observable.subscribe(subscriber);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(subscriber.next).toHaveBeenNthCalledWith(1, data);
    expect(subscriber.next).toHaveBeenNthCalledWith(2, data);
    expect(subscriber.complete).toHaveBeenCalledTimes(2);
    expect(stub).toHaveBeenCalledTimes(6);
  });

  it("retries independently for concurrent requests", async () => {
    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: { max: 5 },
    });
    const stub = jest.fn(() => throwError(() => standardError)) as any;
    const link = ApolloLink.from([retry, stub]);
    const stream1 = new ObservableStream(execute(link, { query }));
    const stream2 = new ObservableStream(execute(link, { query }));

    await Promise.all([
      expect(stream1).toEmitError(standardError),
      expect(stream2).toEmitError(standardError),
    ]);

    expect(stub).toHaveBeenCalledTimes(10);
  });

  it("supports custom delay functions", async () => {
    const delayStub = jest.fn(() => 1);
    const retry = new RetryLink({ delay: delayStub, attempts: { max: 3 } });
    const linkStub = jest.fn(() => throwError(() => standardError)) as any;
    const link = ApolloLink.from([retry, linkStub]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(standardError);

    const operation = (delayStub.mock.calls[0] as any)[1];
    expect(delayStub.mock.calls).toEqual([
      [1, operation, standardError],
      [2, operation, standardError],
    ]);
  });

  it("supports custom attempt functions", async () => {
    const attemptStub = jest.fn();
    attemptStub.mockReturnValueOnce(true);
    attemptStub.mockReturnValueOnce(true);
    attemptStub.mockReturnValueOnce(false);

    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: attemptStub,
    });
    const linkStub = jest.fn(() => throwError(() => standardError)) as any;
    const link = ApolloLink.from([retry, linkStub]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(standardError);

    const operation = attemptStub.mock.calls[0][1];
    expect(attemptStub.mock.calls).toEqual([
      [1, operation, standardError],
      [2, operation, standardError],
      [3, operation, standardError],
    ]);
  });

  it("supports custom attempt functions that return either Promises or booleans", async () => {
    const attemptStub = jest.fn();
    attemptStub.mockReturnValueOnce(true);
    attemptStub.mockReturnValueOnce(Promise.resolve(true));
    attemptStub.mockReturnValueOnce(Promise.resolve(false));

    const retry = new RetryLink({
      delay: { initial: 1 },
      attempts: attemptStub,
    });
    const linkStub = jest.fn(
      () => new Observable((o) => o.error(standardError))
    ) as any;
    const link = ApolloLink.from([retry, linkStub]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(standardError);

    const operation = attemptStub.mock.calls[0][1];
    expect(attemptStub.mock.calls).toEqual([
      [1, operation, standardError],
      [2, operation, standardError],
      [3, operation, standardError],
    ]);
  });

  it("handles protocol errors from multipart subscriptions", async () => {
    const subscription = gql`
      subscription MySubscription {
        aNewDieWasCreated {
          die {
            roll
            sides
            color
          }
        }
      }
    `;

    const attemptStub = jest.fn();
    attemptStub.mockReturnValueOnce(true);

    const retryLink = new RetryLink({
      delay: { initial: 1 },
      attempts: attemptStub,
    });

    const { httpLink, enqueuePayloadResult, enqueueProtocolErrors } =
      mockMultipartSubscriptionStream();
    const link = ApolloLink.from([retryLink, httpLink]);
    const stream = new ObservableStream(execute(link, { query: subscription }));

    enqueueProtocolErrors([
      { message: "Error field", extensions: { code: "INTERNAL_SERVER_ERROR" } },
    ]);

    enqueuePayloadResult({
      data: {
        aNewDieWasCreated: { die: { color: "blue", roll: 2, sides: 6 } },
      },
    });

    await expect(stream).toEmitValue({
      data: {
        aNewDieWasCreated: { die: { color: "blue", roll: 2, sides: 6 } },
      },
    });

    expect(attemptStub).toHaveBeenCalledTimes(1);
    expect(attemptStub).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        operationName: "MySubscription",
        query: subscription,
      }),
      new ApolloError({
        protocolErrors: [
          {
            message: "Error field",
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          },
        ],
      })
    );
  });
});

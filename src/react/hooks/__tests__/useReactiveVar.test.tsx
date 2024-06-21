import React, { StrictMode, useEffect } from "react";
import { screen, render, waitFor, act } from "@testing-library/react";

import { itAsync } from "../../../testing";
import { makeVar } from "../../../core";
import { useReactiveVar } from "../useReactiveVar";

const IS_REACT_18 = React.version.startsWith("18");
const IS_REACT_19 = React.version.startsWith("19");

describe("useReactiveVar Hook", () => {
  it("works with one component", async () => {
    const counterVar = makeVar(0);
    let renderCount = 0;

    function Component() {
      const count = useReactiveVar(counterVar);

      useEffect(() => {
        switch (++renderCount) {
          case 1:
            expect(count).toBe(0);
            counterVar(count + 1);
            break;
          case 2:
            expect(count).toBe(1);
            counterVar(counterVar() + 2);
            break;
          case 3:
            expect(count).toBe(3);
            break;
          default:
            console.error(`too many (${renderCount}) renders`);
        }
      });

      return null;
    }

    render(<Component />);

    await waitFor(() => {
      expect(renderCount).toBe(3);
    });
    await waitFor(() => {
      expect(counterVar()).toBe(3);
    });
  });

  itAsync(
    "works when two components share a variable",
    async (resolve, reject) => {
      const counterVar = makeVar(0);

      let parentRenderCount = 0;
      function Parent() {
        const count = useReactiveVar(counterVar);

        switch (++parentRenderCount) {
          case 1:
            expect(count).toBe(0);
            break;
          case 2:
            expect(count).toBe(1);
            break;
          case 3:
            expect(count).toBe(11);
            break;
          default:
            reject(`too many (${parentRenderCount}) parent renders`);
        }

        return <Child />;
      }

      let childRenderCount = 0;
      function Child() {
        const count = useReactiveVar(counterVar);

        switch (++childRenderCount) {
          case 1:
            expect(count).toBe(0);
            break;
          case 2:
            expect(count).toBe(1);
            break;
          case 3:
            expect(count).toBe(11);
            break;
          default:
            reject(`too many (${childRenderCount}) child renders`);
        }

        return null;
      }

      render(<Parent />);

      await waitFor(() => {
        expect(parentRenderCount).toBe(1);
      });

      await waitFor(() => {
        expect(childRenderCount).toBe(1);
      });

      expect(counterVar()).toBe(0);
      act(() => {
        counterVar(1);
      });

      await waitFor(() => {
        expect(parentRenderCount).toBe(2);
      });
      await waitFor(() => {
        expect(childRenderCount).toBe(2);
      });

      expect(counterVar()).toBe(1);
      act(() => {
        counterVar(counterVar() + 10);
      });

      await waitFor(() => {
        expect(parentRenderCount).toBe(3);
      });
      await waitFor(() => {
        expect(childRenderCount).toBe(3);
      });

      expect(counterVar()).toBe(11);

      resolve();
    }
  );

  it("does not update if component has been unmounted", async () => {
    const counterVar = makeVar(0);
    let renderCount = 0;
    let attemptedUpdateAfterUnmount = false;

    function Component() {
      const count = useReactiveVar(counterVar);

      useEffect(() => {
        if (count < 3) {
          expect(count).toBe(renderCount++);
          counterVar(count + 1);
        }

        if (count === 3) {
          expect(count).toBe(3);
          setTimeout(() => {
            unmount();
            setTimeout(() => {
              counterVar(counterVar() * 2);
              attemptedUpdateAfterUnmount = true;
            }, 10);
          }, 10);
        }
      });

      return null;
    }

    // To detect updates of unmounted components, we have to monkey-patch
    // the console.error method.
    const consoleErrorArgs: any[][] = [];
    const { error } = console;
    console.error = function (...args: any[]) {
      consoleErrorArgs.push(args);
      return error.apply(this, args);
    };

    const { unmount } = render(<Component />);

    await waitFor(() => {
      expect(attemptedUpdateAfterUnmount).toBe(true);
    });
    await waitFor(() => {
      expect(renderCount).toBe(3);
    });
    await waitFor(() => {
      expect(counterVar()).toBe(6);
    });
    await waitFor(() => {
      expect(consoleErrorArgs).toEqual([]);
    });
    console.error = error;
  });

  describe("useEffect", () => {
    it("works if updated higher in the component tree", async () => {
      const counterVar = makeVar(0);

      function ComponentOne() {
        const count = useReactiveVar(counterVar);

        useEffect(() => {
          counterVar(1);
        }, []);

        return <div>{count}</div>;
      }

      function ComponentTwo() {
        const count = useReactiveVar(counterVar);

        return <div>{count}</div>;
      }

      render(
        <>
          <ComponentOne />
          <ComponentTwo />
        </>
      );

      await waitFor(() => {
        expect(screen.getAllByText("1")).toHaveLength(2);
      });
    });

    it("works if updated lower in the component tree", async () => {
      const counterVar = makeVar(0);

      function ComponentOne() {
        const count = useReactiveVar(counterVar);

        return <div>{count}</div>;
      }

      function ComponentTwo() {
        const count = useReactiveVar(counterVar);

        useEffect(() => {
          counterVar(1);
        }, []);

        return <div>{count}</div>;
      }

      render(
        <>
          <ComponentOne />
          <ComponentTwo />
        </>
      );

      await waitFor(() => {
        expect(screen.getAllByText("1")).toHaveLength(2);
      });
    });

    itAsync("works with strict mode", async (resolve, reject) => {
      const counterVar = makeVar(0);
      const mock = jest.fn();

      function Component() {
        const count = useReactiveVar(counterVar);
        useEffect(() => {
          mock(count);
        }, [count]);

        useEffect(() => {
          Promise.resolve().then(() => {
            counterVar(counterVar() + 1);
          });
        }, []);

        return <div />;
      }

      render(
        <StrictMode>
          <Component />
        </StrictMode>
      );

      await waitFor(() => {
        if (IS_REACT_18 || IS_REACT_19) {
          expect(mock).toHaveBeenCalledTimes(3);
          expect(mock).toHaveBeenNthCalledWith(1, 0);
          expect(mock).toHaveBeenNthCalledWith(2, 0);
          expect(mock).toHaveBeenNthCalledWith(3, 2);
        } else {
          expect(mock).toHaveBeenCalledTimes(2);
          expect(mock).toHaveBeenNthCalledWith(1, 0);
          expect(mock).toHaveBeenNthCalledWith(2, 1);
        }
      });

      resolve();
    });

    itAsync(
      "works with multiple synchronous calls",
      async (resolve, reject) => {
        const counterVar = makeVar(0);
        function Component() {
          const count = useReactiveVar(counterVar);

          return <div>{count}</div>;
        }

        render(<Component />);
        Promise.resolve().then(() => {
          counterVar(1);
          counterVar(2);
          counterVar(3);
          counterVar(4);
          counterVar(5);
          counterVar(6);
          counterVar(7);
          counterVar(8);
          counterVar(9);
          counterVar(10);
        });

        await waitFor(() => {
          expect(screen.getAllByText("10")).toHaveLength(1);
        });

        resolve();
      }
    );

    itAsync(
      "should survive many rerenderings despite racing asynchronous updates",
      (resolve, reject) => {
        const rv = makeVar(0);

        function App() {
          const value = useReactiveVar(rv);
          return (
            <div className="App">
              <h1>{value}</h1>
            </div>
          );
        }

        const goalCount = 1000;
        let updateCount = 0;
        let stopped = false;

        function spam() {
          if (stopped) return;
          try {
            if (++updateCount <= goalCount) {
              act(() => {
                rv(updateCount);
                setTimeout(spam, Math.random() * 10);
              });
            } else {
              stopped = true;
              expect(rv()).toBe(goalCount);
              screen
                .findByText(String(goalCount))
                .then((element) => {
                  expect(element.nodeName.toLowerCase()).toBe("h1");
                })
                .then(resolve, reject);
            }
          } catch (e) {
            stopped = true;
            reject(e);
          }
        }
        spam();
        spam();
        spam();
        spam();

        render(
          <StrictMode>
            <App />
          </StrictMode>
        );
      }
    );
  });
});

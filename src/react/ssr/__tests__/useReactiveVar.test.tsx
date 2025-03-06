/** @jest-environment node */
import React from "react";
import { makeVar } from "@apollo/client/core";
import { useReactiveVar } from "@apollo/client/react/hooks";
import { renderToStringWithData } from "@apollo/client/react/ssr";
import { spyOnConsole } from "../../../testing/internal/index.js";

describe("useReactiveVar Hook SSR", () => {
  it("does not cause warnings", async () => {
    using consoleSpy = spyOnConsole("error");
    const counterVar = makeVar(0);
    function Component() {
      const count = useReactiveVar(counterVar);
      counterVar(1);
      counterVar(2);
      return <div>{count}</div>;
    }

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const value = await renderToStringWithData(<Component />);
    expect(value).toEqual("<div>0</div>");
    expect(consoleSpy.error).toHaveBeenCalledTimes(0);
  });
});

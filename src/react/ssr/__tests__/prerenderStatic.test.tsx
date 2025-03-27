import { expectTypeOf } from "expect-type";
import * as React from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import { prerenderStatic } from "@apollo/client/react/ssr";

it.skip("type tests", async () => {
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToStaticMarkup,
    })
  ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  expectTypeOf(
    await prerenderStatic({
      tree: <div />,
      renderFunction: renderToString,
    })
  ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  if (React.version.startsWith("19")) {
    const { prerender, prerenderToNodeStream } =
      require("react-dom/static") as typeof import("react-dom/static");

    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerender,
      })
    ).toEqualTypeOf<{ result: string; aborted: boolean }>();
    expectTypeOf(
      await prerenderStatic({
        tree: <div />,
        renderFunction: prerenderToNodeStream,
      })
    ).toEqualTypeOf<{ result: string; aborted: boolean }>();
  }
});

// This is a helper required for React 19 testing.
// There are currently multiple directions this could play out in RTL and none of
// them has been released yet, so we are inling this helper for now.
// See https://github.com/testing-library/react-testing-library/pull/1214
// and https://github.com/testing-library/react-testing-library/pull/1365

import * as React from "react";

export function actAsync<T>(scope: () => T | Promise<T>): Promise<T> {
  return React.act(async () => {
    return await scope();
  });
}

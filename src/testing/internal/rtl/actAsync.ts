import * as React from "react";

// This is a helper required for React 19 testing.
// There are currently multiple directions this could play out in RTL and none of
// them has been released yet, so we are inling this helper for now.
// See https://github.com/testing-library/react-testing-library/pull/1214
// and https://github.com/testing-library/react-testing-library/pull/1365
export function actAsync(scope: () => void | Promise<void>): Promise<void> {
  return React.act(async () => {
    await scope();
  });
}

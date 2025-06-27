import { build } from "@apollo/client";
import { reactCompilerVersion } from "@apollo/client/react";

const isCI = process.env.TEST_ENV === "ci";

test("test is running against source or ESM (in CI) build", () => {
  // We want to ensure that in CI, these tests run against the
  // React Compiler-compiled ESM build
  expect(build).toBe(isCI ? "esm" : "source");
});

test("test is running against uncompiled or compiled (in CI)", () => {
  if (isCI) {
    expect(reactCompilerVersion).toMatchInlineSnapshot(`"19.1.0-rc.2"`);
  } else {
    expect(reactCompilerVersion).toBe("uncompiled");
  }
});

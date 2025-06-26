declare module "jscodeshift/dist/testUtils" {
  import { Transform } from "jscodeshift";

  export function defineInlineTest(
    module: Transform,
    options: Record<string, unknown>,
    input: string,
    expectedOutput: string,
    testName?: string
  ): void;

  export function defineTest(
    dirName: string,
    transformName: string,
    options: Record<string, unknown> | null,
    testFilePrefix?: string,
    testOptions?: {
      parser?: "babel" | "babylon" | "flow" | "ts" | "tsx" | (string & {});
    }
  ): void;
}

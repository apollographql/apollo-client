import { withCleanup } from "./withCleanup.js";

const noOp = () => {};
const restore = (spy: jest.SpyInstance) => spy.mockRestore();

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

/** @internal */
export function spyOnConsole<Keys extends ConsoleMethod[]>(...spyOn: Keys) {
  const spies = {} as Record<Keys[number], jest.SpyInstance<void, any[], any>>;
  for (const key of spyOn) {
    // @ts-ignore
    spies[key] = jest.spyOn(console, key).mockImplementation(noOp);
  }
  return withCleanup(spies, (spies) => {
    for (const spy of Object.values(spies) as jest.SpyInstance[]) {
      restore(spy);
    }
  });
}

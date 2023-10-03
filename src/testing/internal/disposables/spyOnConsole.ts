import { withCleanup } from "./withCleanup.js";

const noOp = () => {};
const restore = (spy: jest.SpyInstance) => spy.mockRestore();

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

type Spies<Keys extends ConsoleMethod[]> = Record<
  Keys[number],
  jest.SpyInstance<void, any[], any>
>;

/** @internal */
export function spyOnConsole<Keys extends ConsoleMethod[]>(
  ...spyOn: Keys
): Spies<Keys> & Disposable {
  const spies = {} as Spies<Keys>;
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

spyOnConsole.takeSnapshots = <Keys extends ConsoleMethod[]>(
  ...spyOn: Keys
): Spies<Keys> & Disposable =>
  withCleanup(spyOnConsole(...spyOn), (spies) => {
    for (const spy of Object.values(spies) as jest.SpyInstance[]) {
      expect(spy).toMatchSnapshot();
    }
  });

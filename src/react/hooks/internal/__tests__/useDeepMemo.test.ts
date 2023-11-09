import { renderHook } from "@testing-library/react";
import { useDeepMemo } from "../useDeepMemo";

describe("useDeepMemo", () => {
  it("ensures the value is initialized", () => {
    const { result } = renderHook(() =>
      useDeepMemo(() => ({ test: true }), [])
    );

    expect(result.current).toEqual({ test: true });
  });

  it("returns memoized value when its dependencies are deeply equal", () => {
    const { result, rerender } = renderHook(
      ({ active, items, user }) => {
        useDeepMemo(() => ({ active, items, user }), [items, name, active]);
      },
      {
        initialProps: {
          active: true,
          items: [1, 2],
          user: { name: "John Doe" },
        },
      }
    );

    const previousResult = result.current;

    rerender({ active: true, items: [1, 2], user: { name: "John Doe" } });

    expect(result.current).toBe(previousResult);
  });

  it("returns updated value if a dependency changes", () => {
    const { result, rerender } = renderHook(
      ({ items }) => useDeepMemo(() => ({ items }), [items]),
      { initialProps: { items: [1] } }
    );

    const previousResult = result.current;

    rerender({ items: [1, 2] });

    expect(result.current).not.toBe(previousResult);
    expect(result.current).toEqual({ items: [1, 2] });
  });
});

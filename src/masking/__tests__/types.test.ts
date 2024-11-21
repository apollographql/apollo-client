import { expectTypeOf } from "expect-type";
import { MaybeMasked, type Unmasked } from "../index";
import { DeepPartial } from "../../utilities";

describe.skip("Unmasked", () => {
  test("unmasks deeply nested fragments", () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: {
        NameFieldsFragment: NameFieldsFragment;
        JobFieldsFragment: JobFieldsFragment;
      };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    type JobFieldsFragment = {
      __typename: "User";
      job: string;
    } & { " $fragmentName"?: "JobFieldsFragment" } & {
      " $fragmentRefs"?: { CareerFieldsFragment: CareerFieldsFragment };
    };

    type CareerFieldsFragment = {
      __typename: "User";
      position: string;
    } & { " $fragmentName"?: "CareerFieldsFragment" };

    expectTypeOf<Unmasked<UserFieldsFragment>>().toEqualTypeOf<{
      __typename: "User";
      id: number;
      age: number;
      firstName: string;
      lastName: string;
      job: string;
      position: string;
    }>();
  });

  test("unmasks deeply nested fragments", () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
      jobs: Array<
        {
          __typename: "Job";
          id: string;
          title: string;
        } & { " $fragmentRefs"?: { JobFieldsFragment: JobFieldsFragment } }
      >;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: {
        NameFieldsFragment: NameFieldsFragment;
      };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    type JobFieldsFragment = {
      __typename: "Job";
      job: string;
    } & { " $fragmentName"?: "JobFieldsFragment" } & {
      " $fragmentRefs"?: { CareerFieldsFragment: CareerFieldsFragment };
    };

    type CareerFieldsFragment = {
      __typename: "Job";
      position: string;
    } & { " $fragmentName"?: "CareerFieldsFragment" };

    expectTypeOf<Unmasked<UserFieldsFragment>>().toEqualTypeOf<{
      __typename: "User";
      id: number;
      age: number;
      firstName: string;
      lastName: string;
      jobs: Array<{
        __typename: "Job";
        id: string;
        title: string;
        job: string;
        position: string;
      }>;
    }>();
  });

  test("unmasks deeply nested nullable fragments", () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
      career:
        | ({
            __typename: "Job";
            id: string;
            title: string;
          } & { " $fragmentRefs"?: { JobFieldsFragment: JobFieldsFragment } })
        | null;
      jobs: Array<
        | ({
            __typename: "Job";
            id: string;
            title: string;
          } & { " $fragmentRefs"?: { JobFieldsFragment: JobFieldsFragment } })
        | null
      >;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: {
        NameFieldsFragment: NameFieldsFragment;
      };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    type JobFieldsFragment = {
      __typename: "Job";
      job: string;
    } & { " $fragmentName"?: "JobFieldsFragment" } & {
      " $fragmentRefs"?: { CareerFieldsFragment: CareerFieldsFragment };
    };

    type CareerFieldsFragment = {
      __typename: "Job";
      position: string;
    } & { " $fragmentName"?: "CareerFieldsFragment" };

    expectTypeOf<Unmasked<UserFieldsFragment>>().toEqualTypeOf<{
      __typename: "User";
      id: number;
      age: number;
      firstName: string;
      lastName: string;
      career: {
        __typename: "Job";
        id: string;
        title: string;
        job: string;
        position: string;
      } | null;
      jobs: Array<{
        __typename: "Job";
        id: string;
        title: string;
        job: string;
        position: string;
      } | null>;
    }>();
  });

  test("unmasks DeepPartial types", () => {
    type UserFieldsFragment = {
      __typename: "User";
      id: number;
      age: number;
    } & { " $fragmentName"?: "UserFieldsFragment" } & {
      " $fragmentRefs"?: {
        NameFieldsFragment: NameFieldsFragment;
      };
    };

    type NameFieldsFragment = {
      __typename: "User";
      firstName: string;
      lastName: string;
    } & { " $fragmentName"?: "NameFieldsFragment" };

    expectTypeOf<Unmasked<DeepPartial<UserFieldsFragment>>>().toEqualTypeOf<{
      __typename?: "User";
      id?: number;
      age?: number;
      firstName?: string;
      lastName?: string;
    }>();
  });

  test("handles odd types", () => {
    expectTypeOf<Unmasked<{}>>().toEqualTypeOf<{}>();
    expectTypeOf<Unmasked<Record<string, any>>>().toEqualTypeOf<
      Record<string, any>
    >();
    expectTypeOf<Unmasked<unknown>>().toEqualTypeOf<unknown>();
    expectTypeOf<Unmasked<any>>().toEqualTypeOf<any>();
  });

  test("edge case: MaybeMasked<any>", () => {
    expectTypeOf<MaybeMasked<any>>().toBeAny();
  });

  test("edge case: distributed members on MaybeMasked", () => {
    function unresolvedGeneric<T>() {
      let value = {} as MaybeMasked<T | null | undefined>;
      let expected = {} as MaybeMasked<T> | null | undefined;

      value = expected;
      expected = value;
    }

    function unresolvedGenerics<T, V>() {
      let value = {} as MaybeMasked<T | V>;
      let expected = {} as MaybeMasked<T> | MaybeMasked<V>;

      value = expected;
      expected = value;
    }
  });
});

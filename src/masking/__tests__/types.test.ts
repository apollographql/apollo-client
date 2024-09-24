import { expectTypeOf } from "expect-type";
import type { Unmasked } from "../index";

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
          id: string;
          title: string;
        } & { " $fragmentRefs?": { JobFieldsFragment: JobFieldsFragment } }
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
      jobs: Array<{
        id: string;
        title: string;
        job: string;
        position: string;
      }>;
    }>();
  });

  test("handles odd types", () => {
    expectTypeOf<Unmasked<{}>>().toEqualTypeOf<{}>();
    expectTypeOf<Unmasked<Record<string, any>>>().toEqualTypeOf<
      Record<string, any>
    >();
    expectTypeOf<Unmasked<unknown>>().toEqualTypeOf<unknown>();
  });
});

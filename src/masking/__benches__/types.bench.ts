import type { MaybeMasked, Unmasked } from "../index.js";
import { attest, bench } from "@ark/attest";
import { expectTypeOf } from "expect-type";
import type { DeepPartial } from "../../utilities/index.js";

import { setup } from "@ark/attest";

setup({
  updateSnapshots: !process.env.CI,
});

function test(name: string, fn: (name: string) => void) {
  fn(name + ": ");
}

type UnrelatedType = {
  __typename: "Unrelated";
} & { " $fragmentName"?: "Unrelated" } & {
  " $fragmentRefs"?: {
    Unrelated: {
      __unrelated: boolean;
    };
  };
};
type _TypeCacheWarmup = Unmasked<UnrelatedType> | MaybeMasked<UnrelatedType>;

test("unmasks deeply nested fragments", (prefix) => {
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

  type Source = UserFieldsFragment;

  bench(prefix + "instantiations", () => {
    return {} as Unmasked<Source>;
  }).types([51, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<Unmasked<Source>>().toEqualTypeOf<{
      __typename: "User";
      id: number;
      age: number;
      firstName: string;
      lastName: string;
      job: string;
      position: string;
    }>();
  });
});

test("unmasks deeply nested fragments", (prefix) => {
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

  type Source = UserFieldsFragment;

  bench(prefix + "instantiations", () => {
    return {} as Unmasked<Source>;
  }).types([51, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<Unmasked<Source>>().toEqualTypeOf<{
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
});

test("unmasks deeply nested nullable fragments", (prefix) => {
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

  type Source = UserFieldsFragment;

  bench(prefix + "instantiations", () => {
    return {} as Unmasked<Source>;
  }).types([51, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<Unmasked<Source>>().toEqualTypeOf<{
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
});

test("unmasks DeepPartial types", (prefix) => {
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

  type Source = DeepPartial<UserFieldsFragment>;

  bench(prefix + "instantiations", () => {
    return {} as Unmasked<Source>;
  }).types([51, "instantiations"]);

  bench(prefix + "functionality", () => {
    expectTypeOf<Unmasked<Source>>().toEqualTypeOf<{
      __typename?: "User";
      id?: number;
      age?: number;
      firstName?: string;
      lastName?: string;
    }>();
  });
});

test("Unmasked handles odd types", (prefix) => {
  bench(prefix + "empty type instantiations", () => {
    attest<{}, Unmasked<{}>>();
  }).types([92, "instantiations"]);

  bench(prefix + "empty type functionality", () => {
    expectTypeOf<Unmasked<{}>>().toEqualTypeOf<{}>();
  });

  bench(prefix + "generic record type instantiations", () => {
    attest<Record<string, any>, Unmasked<Record<string, any>>>();
  }).types([89, "instantiations"]);

  bench(prefix + "generic record type functionality", () => {
    expectTypeOf<Unmasked<Record<string, any>>>().toEqualTypeOf<
      Record<string, any>
    >();
  });

  bench(prefix + "unknown instantiations", () => {
    attest<unknown, Unmasked<unknown>>();
  }).types([43, "instantiations"]);

  bench(prefix + "unknown functionality", () => {
    expectTypeOf<Unmasked<unknown>>().toBeUnknown();
  });

  bench(prefix + "any instantiations", () => {
    attest<any, Unmasked<any>>();
  }).types([93, "instantiations"]);

  bench(prefix + "any functionality", () => {
    expectTypeOf<Unmasked<any>>().toBeAny();
  });
});

test("MaybeMasked handles odd types", (prefix) => {
  bench(prefix + "empty type instantiations", () => {
    attest<{}, MaybeMasked<{}>>();
  }).types([76, "instantiations"]);

  bench(prefix + "empty type functionality", () => {
    expectTypeOf<MaybeMasked<{}>>().toEqualTypeOf<{}>();
  });

  bench(prefix + "generic record type instantiations", () => {
    attest<Record<string, any>, MaybeMasked<Record<string, any>>>();
  }).types([89, "instantiations"]);
  bench(prefix + "generic record type functionality", () => {
    expectTypeOf<MaybeMasked<Record<string, any>>>().toEqualTypeOf<
      Record<string, any>
    >();
  });

  bench(prefix + "unknown instantiations", () => {
    attest<unknown, MaybeMasked<unknown>>();
  }).types([52, "instantiations"]);
  bench(prefix + "unknown functionality", () => {
    expectTypeOf<MaybeMasked<unknown>>().toBeUnknown();
  });

  bench(prefix + "any instantiations", () => {
    attest<any, MaybeMasked<any>>();
  }).types([49, "instantiations"]);
  bench(prefix + "any functionality", () => {
    expectTypeOf<MaybeMasked<any>>().toBeAny();
  });
});

test("distributed members on MaybeMasked", (prefix) => {
  (function unresolvedGeneric<T>() {
    bench(prefix + "one unresolved generic mixed with null|undefined", () => {
      attest<
        [MaybeMasked<T> | null | undefined],
        [MaybeMasked<T | null | undefined>]
      >();
    }).types([55, "instantiations"]);
  })();

  (function unresolvedGenerics<T, V>() {
    bench(prefix + "two unresolved generics distribute", () => {
      attest<[MaybeMasked<T> | MaybeMasked<V>], [MaybeMasked<T | V>]>();
    }).types([61, "instantiations"]);
  })();
});

test("deals with overlapping array from parent fragment", (prefix) => {
  {
    type Source = {
      __typename: "Track";
      id: number;
      artists: Array<{
        __typename: "Artist";
        id: number;
        " $fragmentRefs"?: {
          ArtistFragment: ArtistFragment;
        };
      }>;
      " $fragmentRefs"?: {
        NestedTrackFragment: NestedTrackFragment;
      };
    };

    type ArtistFragment = {
      " $fragmentName"?: "Fragment__Artist";
      __typename: "Artist";
      birthdate: string;
    };

    type NestedTrackFragment = {
      " $fragmentName"?: "Fragment__Track";
      __typename: "Track";
      artists: Array<{
        __typename: "Artist";
        lastname: string;
      }>;
    };

    bench(prefix + "instantiations", () => {
      return {} as Unmasked<Source>;
    }).types([51, "instantiations"]);

    bench(prefix + "functionality", () => {
      expectTypeOf<Unmasked<Source>>().branded.toEqualTypeOf<{
        __typename: "Track";
        id: number;
        artists: Array<{
          __typename: "Artist";
          id: number;
          birthdate: string;
          lastname: string;
        }>;
      }>();
    });
  }
});

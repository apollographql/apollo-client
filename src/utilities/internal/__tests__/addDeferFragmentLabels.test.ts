import { gql } from "@apollo/client";
import { addDeferFragmentLabels } from "@apollo/client/utilities/internal";

test("adds a label to an inline fragment with @defer", () => {
  const query = gql`
    query {
      greeting {
        name
        ... on Greeting @defer {
          recipient
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        name
        ... on Greeting @defer(label: "ac_0") {
          recipient
        }
      }
    }
  `);
});

test("adds a label to a fragment spread with @defer", () => {
  const query = gql`
    query {
      greeting {
        name
        ...GreetingFields @defer
      }
    }

    fragment GreetingFields on Greeting {
      recipient
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        name
        ...GreetingFields @defer(label: "ac_0")
      }
    }

    fragment GreetingFields on Greeting {
      recipient
    }
  `);
});

test("increments the label for each @defer in visit order", () => {
  const query = gql`
    query {
      greeting {
        name
        ... on Greeting @defer {
          recipient
        }
        ...GreetingFields @defer
      }
      hero {
        ... on Hero @defer {
          homeworld
        }
      }
    }

    fragment GreetingFields on Greeting {
      language
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        name
        ... on Greeting @defer(label: "ac_0") {
          recipient
        }
        ...GreetingFields @defer(label: "ac_1")
      }
      hero {
        ... on Hero @defer(label: "ac_2") {
          homeworld
        }
      }
    }

    fragment GreetingFields on Greeting {
      language
    }
  `);
});

test("adds labels to @defer inside fragment definitions", () => {
  const query = gql`
    query {
      greeting {
        ...GreetingFields
      }
    }

    fragment GreetingFields on Greeting {
      name
      ... on Greeting @defer {
        recipient
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        ...GreetingFields
      }
    }

    fragment GreetingFields on Greeting {
      name
      ... on Greeting @defer(label: "ac_0") {
        recipient
      }
    }
  `);
});

test("adds labels to nested @defer", () => {
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer {
          recipient
          ... on Greeting @defer {
            language
          }
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "ac_0") {
          recipient
          ... on Greeting @defer(label: "ac_1") {
            language
          }
        }
      }
    }
  `);
});

test("keeps user-defined labels", () => {
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer(label: "myLabel") {
          recipient
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "myLabel") {
          recipient
        }
      }
    }
  `);
});

test("does not consume a label number for a user-defined label", () => {
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer(label: "myLabel") {
          recipient
        }
        ... on Greeting @defer {
          language
        }
        ... on Greeting @defer {
          punctuation
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "myLabel") {
          recipient
        }
        ... on Greeting @defer(label: "ac_0") {
          language
        }
        ... on Greeting @defer(label: "ac_1") {
          punctuation
        }
      }
    }
  `);
});

test("overwrites user-defined labels that use the reserved `ac_` prefix", () => {
  const duplicatesGeneratedLabel = gql`
    query {
      greeting {
        ... on Greeting @defer {
          recipient
        }
        ... on Greeting @defer(label: "ac_0") {
          language
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(duplicatesGeneratedLabel)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "ac_0") {
          recipient
        }
        ... on Greeting @defer(label: "ac_1") {
          language
        }
      }
    }
  `);

  const reservedPrefixWithCustomSuffix = gql`
    query {
      greeting {
        ... on Greeting @defer(label: "ac_custom") {
          recipient
        }
        ... on Greeting @defer {
          language
        }
      }
    }
  `;

  expect(
    addDeferFragmentLabels(reservedPrefixWithCustomSuffix)
  ).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "ac_0") {
          recipient
        }
        ... on Greeting @defer(label: "ac_1") {
          language
        }
      }
    }
  `);
});

test("keeps the `if` argument and adds the label after it", () => {
  const query = gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        ... on Greeting @defer(if: $shouldDefer) {
          recipient
        }
        ... on Greeting @defer(if: false) {
          language
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        ... on Greeting @defer(if: $shouldDefer, label: "ac_0") {
          recipient
        }
        ... on Greeting @defer(if: false, label: "ac_1") {
          language
        }
      }
    }
  `);
});

test("keeps other directives on the fragment", () => {
  const query = gql`
    query {
      greeting {
        ... on Greeting @include(if: true) @defer @skip(if: false) {
          recipient
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting
          @include(if: true)
          @defer(label: "ac_0")
          @skip(if: false) {
          recipient
        }
      }
    }
  `);
});

test("does not add labels to directives other than @defer", () => {
  const query = gql`
    query {
      greeting @nonreactive {
        name @custom
        recipients @stream
        ... on Greeting @include(if: true) {
          language
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting @nonreactive {
        name @custom
        recipients @stream
        ... on Greeting @include(if: true) {
          language
        }
      }
    }
  `);
});

test("does not add a label to @stream on a deferred fragment", () => {
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer {
          recipients @stream
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "ac_0") {
          recipients @stream
        }
      }
    }
  `);
});

test("returns the document unchanged when it contains no @defer", () => {
  const query = gql`
    query {
      greeting {
        name
        ...GreetingFields
      }
    }

    fragment GreetingFields on Greeting {
      recipient
    }
  `;

  expect(addDeferFragmentLabels(query)).toMatchDocument(gql`
    query {
      greeting {
        name
        ...GreetingFields
      }
    }

    fragment GreetingFields on Greeting {
      recipient
    }
  `);
});

test("restarts the label sequence for each document", () => {
  const query1 = gql`
    query Greeting {
      greeting {
        ... on Greeting @defer {
          recipient
        }
      }
    }
  `;

  const query2 = gql`
    query Hero {
      hero {
        ... on Hero @defer {
          homeworld
        }
      }
    }
  `;

  expect(addDeferFragmentLabels(query1)).toMatchDocument(gql`
    query Greeting {
      greeting {
        ... on Greeting @defer(label: "ac_0") {
          recipient
        }
      }
    }
  `);

  expect(addDeferFragmentLabels(query2)).toMatchDocument(gql`
    query Hero {
      hero {
        ... on Hero @defer(label: "ac_0") {
          homeworld
        }
      }
    }
  `);
});

test("keeps the labels when a transformed document is transformed again", () => {
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer {
          recipient
        }
        ... on Greeting @defer {
          language
        }
      }
    }
  `;

  const transformed = addDeferFragmentLabels(query);

  expect(addDeferFragmentLabels(transformed)).toMatchDocument(gql`
    query {
      greeting {
        ... on Greeting @defer(label: "ac_0") {
          recipient
        }
        ... on Greeting @defer(label: "ac_1") {
          language
        }
      }
    }
  `);
});

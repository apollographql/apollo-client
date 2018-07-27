# Issue Triage

This document describes the process Apollo contributors use to organize issues. We use Github [issues](https://github.com/apollographql/apollo-client/issues) here to track bugs, and issues in the [Apollo Client Feature Request repo](https://github.com/apollographql/apollo-feature-requests) to track feature requests. Our goal is to maintain a list of issues that are relevant and well-defined (and [labeled](https://github.com/apollographql/apollo-client/labels)) such that a contributor can immediately begin working on the code for a fix or feature request. Contributors who want to dive in and write code aren't likely to prioritize working on issues that are ambiguous and have low impact.

We would love to have more contributors who are willing to help out with triaging issues. You can begin by helping issue requesters create good reproductions and by confirming those reproductions on your own machine. It won't be long before the core maintainers notice your work and ask whether you'd like to be promoted to an issue maintainer.

- [Issue lifecycle](#issue-lifecycle)
  - [Bugs](#bugs)
  - [Help questions](#help-questions)
  - [Feature requests](#feature-requests)
- [Classification](#classification)
  - [Severity](#severity)
  - [Impact](#impact)
- [Issues ready to claim](#issues-ready-to-claim)

## Issue lifecycle

All issues follow the flow outlined below. Your job as an issue maintainer is to work with the requester and others within the community towards the goal of having an issue either become 'claimable' or closed. Read on for more details on the process.

![Flowchart](IssueTriageFlow.png "Issue Lifecycle")

The first step is in determining whether the issue is a bug, help question or feature request. Read on for more details.

### Bugs

1. Duplicates should be closed and marked as such.
2. If the bug would be better filed under a different repository (react-apollo, graphql-tag, graphql-anywhere, etc. ), close the issue and politely point the author to the right location.
3. Add the `bug` label. Bugs should have a high-quality reproduction as described [here](CONTRIBUTING.md#reporting-bugs). You may need to help the reporter reduce their bug to a minimal reproduction. Leave the issue open.
5. A reproduction should be confirmed by at least one person other than the original reporter. Run the reproduction and validate that the bug exists; then make a note of your findings on the issue. If a reproduction is supplied but doesn't work, add the `can't-reproduce` label and make a comment describing what happened.
6. Finally, once you've confirmed the reproduction add the `confirmed` label and [classify](#classification) the issue (removing the `can't-reproduce` label if it exists).

### Help questions

[Stack Overflow](http://stackoverflow.com/questions/tagged/apollo) and our [Slack channel](https://www.apollographql.com/slack) are the place to ask for help on using the framework. Close issues that are help requests and politely refer the author to the above locations.

### Feature requests

Apollo Client feature requests are managed in the [Apollo Client Feature Request repo](https://github.com/apollographql/apollo-feature-requests). Feature request triaging should happen there. Feature requests opened in this repository should be closed, with a message asking the original requestor to re-open the feature request in the FR repo.

<h2 id="classification">Classification</h2>

Assign a classification (via GH labels) that enables the community to determine how to prioritize which issues to work on.

### Priority

- `high-priority`: Issue impacts more or less every user.
- `medium-priority`: Issue impacts users using a feature that is commonly but not universally used.
- `low-priority`: Issue would go unnoticed by almost all users, apart from those using a very niche feature, or a feature in an unusual way.

## Issues ready to claim

This state indicates that bugs/feature requests have reached the level of quality
required for a contributor to begin writing code against (you can easily [filter for this list](https://github.com/apollographql/apollo-client/labels/confirmed) by using the `confirmed` label).

Although this should have already been done by this stage, ensure the issue is
correctly labeled and the title/description have been updated to reflect an
accurate summary of the issue.

Contributors should comment on and/or assign themselves an issue if they begin working on it so that others know work is in progress.

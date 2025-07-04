---
allowed-tools: Bash(git commit:*)
description: Chores
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Fetch the latest changes from the remote repository. If the current branch is not up to date, don't do anything, but inform the user about it.

Take a note if the current git status is clean.

Run the npm scripts `format`, `build`, `extract-api:only`, `update-size-limits` after each other in that order.

If before running the scripts, the git status was clean, create a new commit with the message "chores".

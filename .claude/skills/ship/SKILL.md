---
name: ship
description: Deploy the Hangar sandbox — merge feature PRs into develop and promote develop to main so Netlify publishes the live site. Use when the user says ship, deploy, publish, or "make it live".
argument-hint: "[optional: which PRs to include]"
---

# Ship to production

$ARGUMENTS

`main` is what Netlify deploys. Nothing reaches `main` except through `develop`. The user
invoking this skill is the go-ahead to merge.

1. Find open PRs into `develop` from this session (or the ones named above). For each, check
   CI on its head commit. Merge the green ones; for red ones, fix them first or report why not.
2. Check that CI is green on `develop` itself.
3. Open a PR from `develop` into `main` titled `Ship: <short summary>`, listing the PRs
   and projects it brings in. Wait for CI to pass on it, then merge it (merge commit, not
   squash, so `develop` and `main` stay in step).
4. Reply with the live URL (see the README's "Live site" line) and what changed. Netlify
   needs a minute or two to rebuild.

Never force-push `main` or `develop`, and never merge with red CI.

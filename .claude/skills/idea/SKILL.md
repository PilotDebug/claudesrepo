---
name: idea
description: Park a project idea on the Hangar runway (IDEAS.md) without building it yet. Use when the user has an idea to save for later.
argument-hint: <the idea>
---

# Add an idea to the runway

Idea: $ARGUMENTS

Append a new entry to `IDEAS.md`, following the format of the entries already there:

```
## <Short title>

<2–3 sentence pitch: what it does, who it's for, what makes it interesting. Mention any
real data or API it depends on.>

Tags: <tag>, <tag>
```

Reuse existing tags where they fit. Commit it on the session's branch, push, and open a PR
into `develop` (or add it to an open one). Reply with the entry, and ask whether to
`/prototype` it now.

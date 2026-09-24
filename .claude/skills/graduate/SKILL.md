---
name: graduate
description: Graduate a Hangar project into its own repository and Netlify site, and mark it graduated in the sandbox. Use when the user wants a prototype to "fly solo", become its own app, or get its own repo/deployment.
argument-hint: <slug>
---

# Graduate a project

Project: $ARGUMENTS

1. Confirm with the user: the new repo's name (default: the slug) and whether it should be
   private or public. Creating a repo is outward-facing, so wait for their answer.
2. `make graduate NAME=<slug>` exports a standalone copy to `scratch/graduated/<slug>/` with
   its own `netlify.toml`, CI workflow, and `.gitignore`. Check the export's tests pass there
   (`node --test`).
3. Create the repository with the GitHub tools, add it to this session (add_repo) if needed,
   then push the export as its first commit on `main`.
4. Tell the user how to connect it: Netlify → Add new site → Import from GitHub → the new
   repo (settings come from its `netlify.toml`).
5. In the sandbox, set `projects/<slug>/project.json` → `"stage": "graduated"` and
   `"links": { "repo": "<url>", "live": "<netlify url once known>" }`. Keep the sandbox copy
   as a record, and open a PR into `develop`.

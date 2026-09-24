# claudesrepo — the sandbox

A multi-language playground for trying ideas quickly, built to work with
[Claude Code on the web](https://claude.ai/code), and published as a gallery website
where every experiment shows its live demo, program output, test results, and source.

**Live site:** https://celadon-meerkat-0da244.netlify.app/

```
labs/
  python/hello/   # unittest
  node/hello/     # node --test
  go/hello/       # go test
  rust/hello/     # cargo test
  cpp/hello/      # make + g++, assert-style tests
  web/hello/      # a live page in the gallery; logic tested with node --test
site/             # gallery website generator (build.mjs) and front end (src/)
scripts/          # lab runner, test runner, lab scaffolder
scratch/          # gitignored throwaway space
```

## Quick start

```sh
make new LANG=cpp NAME=ray-tracer     # copy the C++ template to labs/cpp/ray-tracer
make test LAB=labs/cpp/ray-tracer     # test just that lab
make test                             # test everything
make serve                            # build the gallery and open http://localhost:8000
```

## Branches

| Branch      | Purpose                                              |
|-------------|------------------------------------------------------|
| `main`      | Production — Netlify deploys this to the live site   |
| `develop`   | Integration — feature branches merge here first      |
| `claude/*`  | Work branches from Claude Code sessions → PR to `develop` |

CI runs `make test` and `make site` on pushes to `main`/`develop` and on every pull request.

## Deploying to Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub → `PilotDebug/claudesrepo`**.
2. Set **Branch to deploy** to `main`. Build settings are read from `netlify.toml`
   (`node site/build.mjs`, publish `site/dist`), so leave those fields as detected.
3. Deploy. Optional: enable **branch deploys** for `develop` to get a staging URL, and
   **deploy previews** so every pull request gets its own preview link.

## Ideas for things to ask Claude

- "Make a web lab that visualises sorting algorithms step by step."
- "Write a C++ lab that benchmarks `std::vector` vs `std::list` insertion."
- "Build a Go lab that simulates Conway's Game of Life, with a `demo/` page that animates it."

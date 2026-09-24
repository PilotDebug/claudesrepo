# claudesrepo — the sandbox

A multi-language playground for trying ideas quickly, built to work well with
[Claude Code on the web](https://claude.ai/code).

```
labs/
  python/hello/   # unittest
  node/hello/     # node --test
  go/hello/       # go test
  rust/hello/     # cargo test
scratch/          # gitignored throwaway space
scripts/          # test runner + lab scaffolder
```

## Quick start

```sh
make new LANG=rust NAME=parser-idea   # copy the rust template to labs/rust/parser-idea
make test LAB=labs/rust/parser-idea   # test just that lab
make test                             # test everything
```

CI runs `make test` on every push to `main` and on every pull request.

## Ideas for things to ask Claude

- "Make a Go lab that benchmarks three ways to concatenate strings."
- "Port labs/python/foo to Rust and compare the run times."
- "Build a tiny HTTP server in Node with tests, in a new lab."

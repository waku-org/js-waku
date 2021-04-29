# Contributing

Contributors are welcomed!

We try to keep a number of [`good first issue`](https://github.com/status-im/js-waku/labels/good%20first%20issue) for new contributors.
If you feel confident, you can also check out the [`help wanted`](https://github.com/status-im/js-waku/labels/help%20wanted) issues.

To have an idea of the work in the pipeline, feel free to view the [js-waku project board](https://github.com/status-im/js-waku/projects/1).
This project board is to prioritize the work of core contributors so do not be deterred by issues in the `Icebox` or bottom of the `Backlog`.

Do note that we have a [CI](./.github/workflows/ci.yml) powered by GitHub Action.
To help ensure your PR passes, just run before committing:

 - `npm run fix`: To format your code,
 - `npm run test`: To run all tests, including lint checks.


## Build & Test

To build and test this repository, you need:
  
  - [Node.js & npm](https://nodejs.org/en/)
  - [bufbuild](https://github.com/bufbuild/buf) (only if changing protobuf files)
  - [protoc](https://grpc.io/docs/protoc-installation/) (only if changing protobuf files)

To ensure interoperability with [nim-waku](https://github.com/status-im/nim-waku/), some tests are run against a nim-waku node.
This is why `nim-waku` is present as a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules), which itself contain several submodules.
At this stage, it is not possible to exclude nim-waku tests, hence `git submodule update --init --recursive` is run before testing (see [`pretest` script](https://github.com/status-im/js-waku/blob/main/package.json)).

To build nim-waku, you also need [Rust](https://www.rust-lang.org/tools/install).

## Guidelines

- Please follow [Chris Beam's commit message guide](https://chris.beams.io/posts/git-commit/),
- Usually best to test new code,

### Committing Patches

In general, [commits should be atomic](https://en.wikipedia.org/wiki/Atomic_commit#Atomic_commit_convention)
and diffs should be easy to read.
For this reason, do not mix any formatting fixes or code moves with actual code changes.

Commit messages should be verbose by default consisting of a short subject line (50 chars max),
a blank line and detailed explanatory text as separate paragraph(s),
unless the title alone is self-explanatory in which case a single title line is sufficient.

Commit messages should be helpful to people reading your code in the future, so explain the reasoning for
your decisions.

If a particular commit references another issue, please add the reference.
For example: `refs #1234` or `fixes #4321`.
Using the `fixes` or `closes` keywords will cause the corresponding issue to be closed when the pull request is merged.

Commit messages should never contain any `@` mentions (usernames prefixed with "@").

Please refer to the [Git manual](https://git-scm.com/doc) for more information
about Git.


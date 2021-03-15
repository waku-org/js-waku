# js-waku

A JavaScript implementation of the [Waku v2 protocol](https://specs.vac.dev/specs/waku/v2/waku-v2).

**This repo is a Work In Progress**

## Contributing

To build and test this repository, you need:
  
  - [Node.js & npm](https://nodejs.org/en/)
  - [bufbuild](https://github.com/bufbuild/buf)
  - [protoc](https://grpc.io/docs/protoc-installation/) 

To ensure interoperability with [nim-waku](https://github.com/status-im/nim-waku/), some tests are run against a nim-waku node.
This is why `nim-waku` is present as a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules), which itself contain several submodules.
At this stage, it is not possible to exclude nim-waku tests, hence `git submodule update --init --recursive` is run before testing (see [`pretest` script](https://github.com/status-im/js-waku/blob/main/package.json)).

To build nim-waku, you also need [Rust](https://www.rust-lang.org/tools/install).


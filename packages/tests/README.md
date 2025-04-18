# Description

This package contains tests for the `js-waku` library.

# Pre-requisites

Some of the tests from this package require a running `nwaku` node.
These nodes are setup to be run in a docker container.
Therefore, you need to have `docker` installed on your machine to run the tests.

# Running interop tests

- The tests by default run against an `nwaku` node with the image name specified in `nwaku.ts` and `packages/tests/package.json`. The tests can be run against a different image by setting the environment variable `WAKUNODE_IMAGE` to the desired image.

- Whatever `WAKUNODE_IMAGE` is set to, the tests will run against that image. If the image is not available locally, the tests will pull the image from the docker hub.
  You can run the tests by running the following command:

  ```bash
  WAKUNODE_IMAGE=explicit-image-name npm run test:node
  ```

  Or against the default docker image by running:

  ```bash
  npm run test:node
  ```

- You can also run the tests against a local `nwaku` by setting the environment variable `WAKUNODE_IMAGE` to the name of the image. The tests will then run against the local image.

  - For example, to run the tests against a local checkout of `nwaku`, build the image first manually. You can build the image by running the following command:

    ```bash
    docker build path-to-dockerfile -t image-name
    ```

    Then, you can run the tests by running the following command:

    ```bash
    WAKUNODE_IMAGE=image-name npm run test:node
    ```

- Locally, tests are executed serially, allowing the use of **.only** for focused testing. If you wish to run all tests locally and expedite the process, you can enable parallel execution in the Mocha configuration.

- Logs from `nwaku` nodes can be found in `packages/tests/logs` folder from latest execution.

# Running tests in the CI

- Tests are being run on standard Ubuntu GitHub Actions instances.
- To speed up execution, we run tests in parallel. After numerous attempts, we determined that using 6 threads strikes the best balance between execution speed and test reliability. Using more than this doesn't significantly decrease execution time and might even slow it down.
- To address occasional test flakiness, primarily due to Docker containers starting and stopping for each test and the concurrent execution of tests, we utilize the Mocha retry mechanism.

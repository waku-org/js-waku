# Reliability Tests

This package contains reliability and stability tests for the [js-waku](https://github.com/waku-org/js-waku) project.

These tests are designed to run realistic message scenarios in loops over extended periods, helping identify edge cases, memory leaks, network inconsistencies, or message delivery issues that may appear over time.

## 📄 Current Tests

### `longevity.spec.ts`

This is the first test in the suite. It runs a js-waku<->nwaku filter scenario in a loop for 2 hours, sending and receiving messages continuously.

The test records:
- Message ID
- Timestamp
- Send/receive status
- Any errors during transmission

At the end, a summary report is printed and any failures cause the test to fail.

## 🚀 How to Run

From the **project root**:

```bash
npm run test:longevity

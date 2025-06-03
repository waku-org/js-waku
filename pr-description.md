### Problem / Description
<!--
What problem does this PR address?
Clearly describe the issue or feature the PR aims to solve.
-->

js-waku needs to support Light Push Protocol v3 to align with the latest Waku specification. The current implementation only supports v2, which uses a different message format and lacks modern error handling capabilities.

### Solution
<!--
Describe how the problem is solved in this PR.
- Provide an overview of the changes made.
- Highlight any significant design decisions or architectural changes.
-->

Implements Light Push v3 alongside existing v2 support with automatic protocol negotiation:

**Core Changes:**
- `packages/core/src/lib/light_push/light_push_v3.ts` - New v3 protocol implementation
- `packages/proto/src/lib/light_push_v3.proto` - v3 protobuf definitions using direct request/response format
- `packages/core/src/lib/light_push/status_codes_v3.ts` - HTTP-style status codes (200, 400, 413, etc.)

**SDK Integration:**
- `packages/sdk/src/light_push/light_push.ts` - Auto-detects peer protocol support and selects v3 when available, falls back to v2
- Maintains 100% backward compatibility

**Key Design Decisions:**
- v3 uses direct request/response format instead of v2's RPC wrapper
- Peer-level protocol negotiation allows mixed v2/v3 networks
- v2 implementation moved to original `light_push.ts` file for cleaner organization

**Testing:**
- `packages/tests/tests/light-push/light_push_v3.node.spec.ts` - v3 unit tests
- `packages/tests/tests/light-push/lightpush_v3_features.node.spec.ts` - v3 integration tests
- `packages/tests/tests/light-push/lightpush_v3_relay.node.spec.ts` - v3 relay features

### Notes
<!--
Additional context, considerations, or information relevant to this PR.
- Are there known limitations or trade-offs in the solution?
- Include links to related discussions, documents, or references.
-->

**Protocol Differences:**
- v2: Uses RPC wrapper with boolean success indicator
- v3: Direct request/response with HTTP-style status codes and optional relay peer count

**Backward Compatibility:**
- Existing v2 clients continue working unchanged
- SDK automatically negotiates best protocol per peer
- Graceful fallback when protocol detection fails

- Resolves
- Related to https://github.com/waku-org/js-waku/issues/2400

---

#### Checklist
- [x] Code changes are **covered by unit tests**.
- [x] Code changes are **covered by e2e tests**, if applicable.
- [ ] **Dogfooding has been performed**, if feasible.
- [ ] A **test version has been published**, if required.
- [x] All **CI checks** pass successfully.
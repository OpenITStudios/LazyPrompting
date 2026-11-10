# Receipt-driven dispatch coordinator

NonblockingDispatchCoordinator combines the pure dispatch planner with a trusted PromptDispatchGate, prompt planner, snapshot reader and cursor persistence callback. It sends to eligible chats sequentially, awaiting only each host acceptance receipt (not the response body), then moves to the next chat. Response observation remains independent.

A single scheduler owner and serialized sweeps are REQUIRED. The host must persist cursor with compare-and-swap and use the durable PromptOutbox to block duplicate pending prompts. Unknown send outcomes are reconciled, never retried blindly. The coordinator stops on unknown cursor persistence. It does not provide cross-store atomicity or a live ChatGPT transport.

Outstanding work: source-level failure matrix for cursor races, live transport capability admission, durable lease, verified response lifecycle and native tests. No GitHub integration in the user workflow.

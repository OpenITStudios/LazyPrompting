# Durable progress review

DurableProgressReview persists at most ten workspace counters, with duplicate response-ID suppression and a three-cycle review threshold. A verified progress event resets the counter; no progress increments it. Session changes fail closed and require review, not silent migration. The store contains only identities and counters, not task context.

Only an authenticated external evaluator can provide verified progressMade; model text is not evidence. The adaptive event planner can consume snapshot() output. Production integration and runtime tests are not yet completed. This is single-host file persistence, not a distributed transaction or a ChatGPT transport.

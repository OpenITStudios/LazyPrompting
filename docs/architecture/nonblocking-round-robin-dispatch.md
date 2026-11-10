# Non-blocking round-robin dispatch

Approved behavior: dispatch one prompt to Chat 01, obtain an authenticated delivery receipt, move to Chat 02 without waiting for Chat 01's final response, and continue across eligible chats. One unresolved prompt per chat. Observe responses independently; only send another prompt to a chat after its previous response is terminal and verified.

The planner separates maxDispatches (bounded sends per sweep) from maxInFlight (simultaneously outstanding prompts across distinct chats). Its dispatch list is advisory, not an actual send or acknowledgement. Host dispatcher must reserve the durable outbox entry before send, authenticate the target session, await acceptance receipt, and mark unknown delivery for reconciliation without retry. Cursor must advance based on confirmed dispatch outcomes, not merely planned candidates, and be persisted atomically with scheduling state to prevent starvation or duplicate sends.

Rate/quota limits wait, not bypass. Busy chats are skipped; old chat history remains. ChatGPT owns all task context and project work. No GitHub client in this workflow. No live ChatGPT consumer transport is implemented. Source tests authored, not run.

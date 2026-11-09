# Managed Agent Backend — Source Contract

The agent host must provide trusted `probe`, `connect` and `disconnect` callbacks. `src/transport/managed-agent-backend.mjs` uses the LazyDesigner-derived `BackendLifecycle` to reconnect on explicit requests and detect generation changes.

`probe` returns `{ready:true,signature:<stable host generation>}`. `connect` returns a backend exposing `observe(taskId)` and `dispatch(request)`. A lost dispatch response is **outcome unknown**, never an automatic retry. A dispatch request must include an authorization receipt from the trusted host; this module does not validate that receipt independently, so the host must enforce it at its actual tool boundary.

**Not a real Codex/OpenAI transport.** No undocumented API endpoint, authentication scheme or model behavior is assumed. A version-pinned official host implementation and live proof are still required.

The user has requested code-first work with local tests deferred. The accompanying source tests have not been executed.

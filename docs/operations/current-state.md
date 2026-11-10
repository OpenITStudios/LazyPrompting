# Current State — Single Active Continuation Owner

**Branch:** `Local`  
**Last source baseline reviewed for repository structure:** `42664dfa0468fe64c4615a8087f8821aca0ef857` (2026-11-11).  
**Scope:** repository root, architecture and MCP ownership standardization. Product/UI design changes are intentionally deferred.

## Active engineering position

- LazyPrompting has three noninterchangeable MCP implementation lanes: installed Rust desktop facade, packaged internal Node gateway, and legacy standalone Node server. A fourth opt-in path is the synthetic ChatGPT probe; see [MCP architecture](../../mcp/ARCHITECTURE.md).
- The code includes ten WebView2 workspace bindings, desktop/native browser controls, authenticated packaged gateway/Lightpanda integration foundations, bounded Codex execution and durable recovery. The observed Windows tests described below were recorded before this repository-only cleanup, not rerun against any new SHA.
- Only this file owns the active next engineering task. The former 134 KB chronological current-state file was retained byte-for-byte as an [archived checkpoint](history/2026-11-10-full-checkpoint.md). Historical `Next:` lines in that archive are superseded by this section.

## Existing evidence — provenance and limits

| Area | Most recent recorded evidence before architecture cleanup | Still unverified / not inferred |
| --- | --- | --- |
| Native Windows application | Installed x64 debug build opened; WebView2 controls and MCP browser navigation were exercised in recorded Windows tests | Full ten-tab interactive acceptance, complete operator-dialog and recovery workflow on final combined build |
| Gateway and private browser | Packaged Node authentication, native grants and staged integration; real WSL2 Lightpanda ten-context test recorded | Full production installation/security acceptance and behavior after arbitrary host changes |
| Managed Codex | Windows tests recorded ten distinct turns/threads with retained receipts and five-task worktree changes and checks | General-purpose autonomous correctness, product-wide release acceptance, all interrupted/unknown-outcome cases |
| ChatGPT transport experiment | ChatGPT Work arithmetic probe recorded two turns in five isolated chats after explicit bootstrap; Chat-mode callbacks remained inconsistent | A currently approved HTTPS endpoint, automatic Chat-mode delivery without reselection, real-goal operation, production transport |
| Repository reorganization | This task reviews exact GitHub source and authors a repository structure checker | Any claim that the new checker, entire test suite or native build passed on the post-cleanup commit |

Detailed chronology, source/proof claims and test limits: [archived full checkpoint](history/2026-11-10-full-checkpoint.md). Specific ChatGPT probe evidence/setup: [transport handoff](chatgpt-chat-handoff.md). No automatic work across another OpenITStudios repository is permitted.

## Current priority

1. Complete root/toolchain consistency, domain documentation routing, MCP surface/owner map, safe history split and deterministic architecture/source contract checking on `Local`.
2. Verify the resulting GitHub commit/tree/paths; classify unexecuted Node, Rust, Windows and live-MCP gates accurately.
3. **Only after that**, begin product and desktop design discussions with the operator. Do not silently change public MCP tools, security grants or existing feature behavior during cleanup.

## Stop / risk boundaries

Never promote an earlier Windows test to a PASS on a later SHA. No force-push, merge, release, workflow dispatch, plugin installation, browser scraping, cross-repository mutation, license choice or production authorization is part of this cleanup. The selected `Harness` history branch remains intact.

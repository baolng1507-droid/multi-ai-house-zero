# ECC → Multi-AI House: Technical adoption decision (V2.1)

Source reviewed: https://github.com/affaan-m/ECC (README, AGENTS.md, SECURITY.md), 2026-11-20.

## Actual constraints
- iPhone + GitHub Pages static hosting; no persistent backend, process runner, local shell, paid API, shared agent session, or automatic access to ChatGPT/Gemini/Claude/DeepSeek/Grok conversations.
- ECC is an agent harness and workflow toolkit, not a service that grants free third-party model access.
- Do not claim native ECC hooks, MCP servers, subagents, AgentShield scanner, CI test execution, or multi-agent automatic orchestration work inside a static PWA.

## ECC components and disposition

| ECC mechanism | Decision | Reason |
| --- | --- | --- |
| Plan → test → implement → review → verify → remember | ADOPT | Structured handoffs, verification evidence, reusable lessons |
| Specialized planner, architect, code-reviewer, security-reviewer | ADAPT | Five existing external AI sites receive role-specific prompts, not native agents |
| Project rules, acceptance criteria | ADOPT | Stored per project, included in prompts |
| Test-driven development and verification evidence | ADAPT | User supplies actual test evidence; never fabricate test outcomes |
| Session memory / continuous learning | ADAPT | Local project lessons in browser storage; manual export/import |
| Hooks, command shims, runtime orchestration | DEFER | Requires trusted runtime/harness, unavailable in GitHub Pages |
| MCP server connections, automatic tool execution | DEFER | Needs backend, auth, trust controls and possibly billing |
| AgentShield scanning | DEFER | Static site cannot run npm scanner; do not present checkbox as actual scan |
| Automatic provider failover | REJECT under current constraints | No access to model quotas or sessions, no compliant auto-routing |
| Pro GitHub App | EXCLUDE | 0 VND absolute constraint and no need for hosted private-repo services |

## Implemented in V2.1
1. A project-scoped verification evidence field.
2. A project-scoped lessons/knowledge field.
3. Downstream prompts include prior stage outputs, verification evidence and lessons.
4. Project approval is blocked until five stage outputs AND a nonempty verification record exist.
5. Exported report includes verification evidence and lessons.
6. No automatic test execution is claimed; evidence is self-reported and cannot be independently authenticated by the PWA.

## Safety and engineering follow-ups
- Add structured test cases with expected/actual result, environment, timestamp, and reviewer, rather than a free-text field.
- Build unit/E2E tests for storage migrations, prompt construction, import validation, and approval gating. Current changes have NOT been browser-E2E tested.
- Refactor large single-file JavaScript into separate modules before further feature expansion.
- Guard against localStorage quota failure, accidental data loss, malicious import payloads and oversized prompt context.
- Consider content provenance and conflict handling when multiple AI answers disagree.
- Avoid copying ECC files blindly; preserve original attribution and license when directly incorporating code.
- GitHub Pages public repo and client-side storage are not appropriate for secrets.

## Non-goals
- Automatic conversations across five vendors.
- Running ECC CLI inside mobile Safari.
- Autonomous background agent execution.
- Guaranteeing that all third-party AI services are free forever.

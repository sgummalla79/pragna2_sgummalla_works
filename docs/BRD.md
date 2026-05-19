# Pragna — Business Requirements Document

**Version:** 1.0
**Status:** Draft
**Product Name:** Pragna

---

## 1. Problem Statement

Knowledge workers who want to use AI assistants and multi-agent workflows today face two blockers:

1. **Vendor lock-in** — they must use a single provider's models at fixed prices they cannot control.
2. **No workflow control** — they cannot define how agents collaborate, what order they run, or how results are reviewed and approved.

Pragna solves both by giving every user their own AI brain: they bring their own LLM API keys, configure models with their own pricing, and build custom multi-agent pipelines that match their actual work.

---

## 2. Goals

| # | Goal |
|---|---|
| G1 | Allow any user to register and log in securely |
| G2 | Let users register their own LLM API keys (BYOK) across multiple providers |
| G3 | Let users register specific models with per-token pricing for cost tracking |
| G4 | Let users build and manage multi-agent pipelines (flows) using a visual canvas |
| G5 | Let users create on-demand skills (slash commands) backed by functions or flows |
| G6 | Provide a real-time streaming chat interface powered by the user's own configuration |
| G7 | Show per-conversation token usage and USD cost broken down by agent node |
| G8 | Work well on both desktop and mobile devices |

---

## 3. User Personas

### Persona A — The Power User
- Technical professional (engineer, researcher, product manager)
- Wants full control over which AI models are used and at what cost
- Builds custom multi-agent pipelines for recurring workflows
- Accesses Pragna primarily on desktop

### Persona B — The Casual User
- Non-technical or semi-technical knowledge worker
- Adds one provider, registers one model, uses the default chat
- Cares about cost visibility
- May access Pragna on mobile

---

## 4. Functional Requirements

### 4.1 Authentication

| ID | Requirement |
|---|---|
| FR-AUTH-01 | User can register with email and password |
| FR-AUTH-02 | User can log in with email and password |
| FR-AUTH-03 | Access tokens expire after 15 minutes; refresh tokens after 30 days |
| FR-AUTH-04 | The app silently refreshes the access token before expiry without user interaction |
| FR-AUTH-05 | User can update their display settings (theme, default flow) |

### 4.2 LLM Providers (BYOK)

| ID | Requirement |
|---|---|
| FR-PROV-01 | User can register a provider API key for: Anthropic, OpenAI, Google, Groq, Mistral, Bedrock |
| FR-PROV-02 | The API key is never shown again after submission |
| FR-PROV-03 | User can delete a registered provider (and all its associated models) |
| FR-PROV-04 | User can have multiple providers registered simultaneously |

### 4.3 Models

| ID | Requirement |
|---|---|
| FR-MOD-01 | User can register a model under a provider with: model ID, display name, input cost per token, output cost per token |
| FR-MOD-02 | User can delete a registered model |
| FR-MOD-03 | Models are listed grouped by provider |
| FR-MOD-04 | Model pricing is displayed in human-readable format ($/M tokens) |

### 4.4 Flows (Multi-Agent Pipelines)

| ID | Requirement |
|---|---|
| FR-FLOW-01 | User can create a named flow with optional description and metadata |
| FR-FLOW-02 | User can add agent nodes to a flow, selecting from global agent types: intake, discovery, researcher, aggregator, reviewer, approver |
| FR-FLOW-03 | Each node is assigned one of the user's registered models |
| FR-FLOW-04 | User can connect nodes with directed edges; each edge has a routing condition: default, passed, failed, approved, rejected |
| FR-FLOW-05 | Edges support fan-out (one node → multiple) and fan-in (multiple nodes → one) for parallel research patterns |
| FR-FLOW-06 | User can delete a flow |
| FR-FLOW-07 | The flow is visualised as a directed acyclic graph on desktop |
| FR-FLOW-08 | On mobile, a simplified node list view is shown instead of the canvas |

### 4.5 Skills

| ID | Requirement |
|---|---|
| FR-SKILL-01 | User can create a function skill: single LLM call triggered by a `/slash-command` in chat |
| FR-SKILL-02 | User can create an agent skill: runs a full flow, triggered by a `/slash-command` in chat |
| FR-SKILL-03 | User can delete a skill |
| FR-SKILL-04 | Active skills are listed with their slash command trigger |

### 4.6 Chat

| ID | Requirement |
|---|---|
| FR-CHAT-01 | User can send messages and receive real-time streaming responses via the CopilotKit SSE protocol |
| FR-CHAT-02 | The AI assistant is branded as "Pragna" in the chat UI |
| FR-CHAT-03 | Users can invoke skills by typing `/skill-name` in the chat input |
| FR-CHAT-04 | The chat interface works on mobile (full-screen layout) |

### 4.7 Conversations & Usage

| ID | Requirement |
|---|---|
| FR-CONV-01 | Past conversations are listed in reverse chronological order with pagination |
| FR-CONV-02 | Selecting a conversation shows a per-agent-node breakdown of: input tokens, output tokens, USD cost |
| FR-CONV-03 | A total cost is shown for the conversation |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Security** — API keys submitted by users are never stored client-side after submission |
| NFR-02 | **Security** — Access tokens are stored in memory only; refresh tokens persist in sessionStorage |
| NFR-03 | **Privacy** — No PII (email, name) is written to client-side logs |
| NFR-04 | **Privacy** — Conversation message content is never logged |
| NFR-05 | **Performance** — Initial page load (Largest Contentful Paint) < 2.5 s on 4G |
| NFR-06 | **Reliability** — Token expiry is handled transparently; user is never logged out mid-session unless refresh also fails |
| NFR-07 | **Accessibility** — All interactive elements are keyboard-navigable; ARIA labels on all icons and inputs |
| NFR-08 | **Responsiveness** — All views are fully usable at 375 px (iPhone SE) and 1440 px (desktop) |
| NFR-09 | **Observability** — Every outbound request carries a correlation ID that matches the server-side log entry |
| NFR-10 | **Maintainability** — Test coverage ≥ 80%; `tsc --noEmit` and ESLint pass with zero warnings |

---

## 6. Out of Scope (v1)

- Social / OAuth login (Google, GitHub)
- Team accounts or multi-user sharing
- In-app flow templates or marketplace
- Real-time collaboration on flows
- Mobile native app (React Native)

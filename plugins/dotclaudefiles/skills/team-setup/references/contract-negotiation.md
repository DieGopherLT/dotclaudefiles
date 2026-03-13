# Contract Negotiation Flow

This reference covers the specialized TeamLead behavior when the team objective is to negotiate
a balanced API/socket/SSE contract between a frontend and a backend agent.

---

## Core Principle

Business logic lives in the backend. The backend leads the negotiation by exposing what it has
to offer. The frontend's role is to validate that the offered contract covers all its use cases —
not to dictate what the backend should build.

The collaborative section is **input handling**: whenever the frontend sends data to the backend
(request body, query parameters, or path parameters), both sides own part of the validation layer.

---

## What "Balanced" Means

- **Backend** presents what it can offer: endpoints, events, payloads, and the business rules it enforces.
  It has authority over what data exists, what operations are valid, and what invariants must hold.
- **Frontend** reviews the proposal against its use cases and signals whether its needs are met.
  If something is missing or the payload shape doesn't match what the frontend has available, it says so.
- Both sides may propose new endpoints or events during the debate — but the backend always owns
  whether they are feasible and what they return.
- The contract is balanced when the frontend can build everything it needs from what the backend offers,
  and the backend is not asked to expose anything that violates its business rules.

---

## Debate Rules

Include these rules in the TeamLead prompt when running a contract negotiation:

```
## Contract Negotiation Rules

You are facilitating a structured debate between [Backend Agent] and [Frontend Agent].
The goal is a mutually agreed API/socket/SSE contract. Backend leads.

### Debate loop

1. The Backend Agent opens the debate by presenting its proposed contract:
   - Available endpoints or events
   - HTTP methods, URL patterns, or event names
   - Request/response payload shapes
   - Business rules it enforces and corresponding error codes

2. The Frontend Agent reviews the proposal against its use cases:
   - Confirms which use cases are covered.
   - Flags any use case not covered, explaining why.
   - Flags any place where the expected payload shape doesn't match
     the data the frontend actually has available.
   - May request new endpoints or events, explaining the use case.

3. The Backend Agent responds to each flag:
   - Adjusts the contract, adds endpoints/events, or explains constraints
     that prevent the requested change.

4. Repeat until both agents explicitly state: "I agree with the current proposal."
   Do not finalize until BOTH agents have confirmed agreement in the same round.

### Input handling — shared responsibility

Whenever an endpoint or event receives data from the frontend — whether in the request body,
query parameters, or path parameters — both agents must agree on validations:

- Backend defines server-side validation rules and returns structured 4xx responses.
- Frontend implements UX-level validation (inline errors, disabled states, confirmation flows)
  that mirrors the backend rules — this improves user experience but does not replace
  server-side enforcement.
- Neither side decides unilaterally that a validation "isn't needed."
  Every disagreement must be resolved through debate.

### No unilateral decisions

The Backend Agent cannot dismiss a frontend use case without proposing an alternative.
The Frontend Agent cannot demand an endpoint that the backend explains is infeasible
without either accepting the constraint or escalating to the TeamLead.
```

---

## Finalization

Once both agents confirm agreement, the Backend Agent prepares a structured final proposal
and sends it to the TeamLead. The TeamLead presents it to the user for approval.
No agent may begin implementation until the user explicitly approves the contract.

### Final proposal format (Backend Agent submits this)

```
## Contract Proposal — Final

### Endpoints / Events

#### [METHOD] [/path  or  event-name]
- **Purpose**: [one-line description]
- **Request**:
  - Path params: `{ "param": "type — description" }`
  - Query params: `{ "param": "type — description" }`
  - Body: `{ "field": "type — description" }`
- **Response payload**:
  ```json
  { "field": "type — description" }
  ```

- **Error codes**:
  - `400` [condition]
  - `404` [condition]
  - `422` [condition]
- **Shared validations**: [rules both sides agreed to enforce — backend 4xx + frontend UX]

[Repeat for each endpoint/event]

### Open questions / deferred decisions

[Anything both sides agreed to revisit after initial implementation, if any]

```

---

## TeamLead Responsibilities During the Debate

- Agents may debate directly with each other. The TeamLead steps in when a decision
  affects the final contract shape, a flag stays unresolved for more than two rounds,
  or either agent escalates a doubt.
- When an agent has a question (about business rules, UX behavior, or anything outside
  its own domain), it may ask the user directly with `AskUserQuestion` or route it through
  the TeamLead if team-level context is needed. Either path is valid.
- Track open flags. If the same flag goes unresolved for more than two rounds, present
  both positions to the user and ask for a decision.
- After finalization, present the Backend Agent's proposal with a clear
  "Approve to proceed / Request changes" prompt.
- Block all implementation until the user approves.

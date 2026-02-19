# Template Block: User Flows

Use this block to document user/system flows gathered during the smart-interview phase.
Each flow must be traceable end-to-end with branches and error paths explicit.

---

## User Flows

### Flow: [Flow Name]

**Trigger**: [What initiates this flow — user action, API call, event, etc.]

**Steps**:

1. [Step]
2. [Step]
3. [Step with branch: if X → go to step 4a; if Y → go to step 4b]
   - **4a**: [Path X continuation]
   - **4b**: [Path Y continuation]

**Error paths**:

- [Error condition] → [System response / fallback behavior]
- [Error condition] → [System response / fallback behavior]

**Exits with**: [The successful end state or output of this flow]

---

### Flow: [Second Flow Name]

<!-- Add additional flows as needed using the same structure above. -->

# Technique Playbooks

Execution playbooks for applying refactoring.guru techniques safely. Organized by the six technique
groups. For each group: the **safety discipline** that governs every technique in it, then per-technique
**execution steps** with explicit verification points, then the **pitfalls** that most often turn a
refactor into a behavior change.

This file is what `refactor` hands to `refactoring-applier`. The condensed when/mechanics index lives in
the smell-scan reference `refactoring-techniques.md`; this file is the actionable expansion.

Every technique runs inside the safe cycle: **green before → one technique in small steps → green after →
commit**. Techniques marked **(OOP-specific)** require type hierarchies.

---

## Group 1 — Composing Methods

**Safety discipline**: these reshape the inside of a function. The contract (signature, return, side
effects) must be identical afterward. Work in steps small enough that the function compiles between each.

### Extract Method
1. Identify the block to extract; confirm it is a coherent unit with a nameable intent.
2. Create a new function with a descriptive name (verb phrase for the action it performs).
3. Find every variable the block reads → pass as parameters. Find every variable it writes that is used
   after → return it (or return a small object if more than one).
4. Replace the original block with a call to the new function.
5. **Verify**: build + tests green; the extracted name reads as documentation.
- *Pitfall*: missing a written-and-later-read variable silently changes behavior — trace data flow before
  cutting.

### Inline Method
1. Confirm the function is not overridden (for OOP, check the hierarchy).
2. Find all call sites.
3. Replace each call with the function body, adapting argument names.
4. Delete the function.
5. **Verify**: build + tests green.

### Extract Variable
1. Pick the sub-expression that is hard to read.
2. Declare a well-named variable before the statement and assign that sub-expression to it.
3. Replace the sub-expression with the variable; repeat per segment.
4. **Verify**: identical result; the expression now reads in named parts.

### Inline Temp
1. Confirm the temp holds a simple expression used only once or twice and adds no clarity.
2. Replace its references with the original expression.
3. Remove the declaration. **Verify** green.

### Replace Temp with Query
1. Confirm the temp is assigned exactly once (if not, Split Temporary Variable first).
2. Extract the assigning expression via Extract Method; ensure the query has no side effects.
3. Replace references to the temp with calls to the query; remove the temp.
4. **Verify**: green; the query is reusable across functions.

### Split Temporary Variable
1. For each distinct purpose the variable serves, rename the corresponding assignment to a purpose-named
   variable.
2. Replace the uses tied to that assignment.
3. Repeat per assignment; prefer immutable bindings where the language allows. **Verify** green.

### Remove Assignments to Parameters
1. Introduce a local variable initialized from the parameter.
2. Replace later uses of the parameter with the local.
3. **Verify** green — the parameter is now read-only, clarifying input vs working state.

### Replace Method with Method Object
1. Create a dedicated type named for the operation.
2. Turn the function's local variables into fields of that type; add a constructor taking the inputs.
3. Move the body into a single main method on the type.
4. Replace the original function with: instantiate the object, call its main method, return the result.
5. **Verify** green — now the tangled locals can be Extract-Method'd freely as private methods.

### Substitute Algorithm
1. Ensure the existing algorithm is covered by tests (its behavior is the spec).
2. Implement the new algorithm separately.
3. Swap them; run tests; if outputs diverge on edge cases, reconcile against the documented contract.
4. Remove the old algorithm. **Verify** green.
- *Pitfall*: only substitute when the existing behavior is fully pinned by tests — otherwise you cannot
  prove equivalence.

---

## Group 2 — Moving Features between Objects

**Safety discipline**: these move code across module boundaries. Use `findReferences`/`incomingCalls`
(LSP) to find every caller before moving, and redirect them all. Move one member at a time and test.

### Move Method
1. Examine the method's dependencies; move tightly-coupled helpers with it or expose them.
2. Create the method in the destination (a better name is allowed); give it access to the receiver it
   needs.
3. Replace the original with delegation to the new location, or remove it and update callers.
4. **Verify** green at every call site.

### Move Field
1. Encapsulate the field if it is public (Self Encapsulate Field).
2. Create an equivalent field with accessors in the destination.
3. Redirect references to go through the destination.
4. Remove the original. **Verify** green.

### Extract Class
1. Create a new module/type for the second responsibility.
2. Establish the relationship — prefer a unidirectional link from old to new.
3. Move fields and functions incrementally, **testing after each move**.
4. Decide the new type's visibility and interface. **Verify** green.

### Inline Class
1. In the receiver, create fields/functions equivalent to the lazy class's, delegating initially.
2. Redirect references from the lazy class to the receiver.
3. Move each member over (Move Method/Field); delete the now-empty class. **Verify** green.

### Hide Delegate **(OOP-specific)**
1. For each call the client makes through the server to a delegate, add a forwarding function on the
   server.
2. Update clients to call the server's function instead of reaching through.
3. Remove the delegate accessor once no client uses it. **Verify** green.
- *Pitfall*: stop before every method becomes a forward — that produces a Middle Man.

### Remove Middle Man
1. Add a getter exposing the delegate.
2. Identify the delegating functions on the middle man.
3. Replace client calls with direct calls on the delegate; remove the delegating functions. **Verify**
   green.

### Introduce Foreign Method
1. In the client, write a function taking an instance of the unmodifiable external type as its first
   parameter.
2. Move the repeated manipulation logic into it; replace the duplicates with calls.
3. Comment it as a "foreign method" — it conceptually belongs to the external type.
4. **Verify** green; if these accumulate, consider Introduce Local Extension.

### Introduce Local Extension **(OOP-specific)**
1. Create a subclass or wrapper of the external type.
2. Provide a constructor mirroring the original, plus one accepting an existing instance.
3. Implement the missing functions on the extension; remove duplicates from clients. **Verify** green.

---

## Group 3 — Organizing Data

**Safety discipline**: these change how data is represented and accessed. Encapsulate first so callers go
through accessors, then change the representation behind them — that keeps the change invisible to clients.

### Self Encapsulate Field **(OOP-specific)** / Encapsulate Field
1. Create a getter (and setter, unless immutable) for the field.
2. Locate direct accesses; replace reads with the getter and writes with the setter.
3. Make the field private. **Verify** green — now validation/lazy/override has one home.

### Encapsulate Collection
1. Replace the collection setter with dedicated add/remove functions; initialize the collection empty.
2. Update direct mutations to go through add/remove.
3. Make the getter return a read-only view. **Verify** green.

### Replace Magic Number with Symbolic Constant
1. Declare a named constant for the value.
2. Confirm each occurrence of the literal shares the same meaning (the same number can mean different
   things — do not merge those).
3. Substitute matching occurrences. **Verify** green.

### Replace Data Value with Object
1. Create a type wrapping the field, with a getter and constructor.
2. Change the field's declaration to the new type; the original getter delegates; the setter instantiates
   the new type.
3. **Verify** green; consider Change Value to Reference if instances should be shared.

### Replace Array with Object
1. Create a structured type holding the array as a private field.
2. Add accessors named per element (position → name).
3. Move each element into a dedicated field; remove the array. **Verify** green.

### Replace Type Code with Class / Subclasses / State-Strategy **(OOP-specific)**
- **with Class** (code has no behavioral impact): new type per purpose; field becomes a private property
  with a getter; static factories per value; swap references to the statics.
- **with Subclasses** (code drives conditionals, value fixed for the object's life): encapsulate the getter;
  make the supertype constructor private + a Factory; a subtype per value overriding the getter; remove the
  field, declare the getter abstract; replace conditionals with polymorphism.
- **with State/Strategy** (code drives behavior, value changes during life): self-encapsulate the getter; an
  abstraction with an abstract getter; subtypes per value; a Factory on the abstraction; update the setter
  via the factory; remove conditionals with polymorphism.
- **Verify** green after each sub-step; these are multi-step — go slowly.

### Change Value to Reference / Change Reference to Value **(latter OOP-specific)**
- **Value → Reference**: replace the constructor with a Factory Method; add a registry/cache; the factory
  returns existing instances. Decide preload vs on-demand.
- **Reference → Value**: remove mutability (only the constructor assigns); implement equivalence
  comparison; drop the Factory if no longer needed.

### Change Uni/Bidirectional Association **(OOP-specific for adding direction)**
- **Uni → Bi**: add an inverse-association field; designate a dominant module; the dominant one drives
  utility functions on the other to keep both sides consistent.
- **Bi → Uni**: confirm one side does not use the other (or replace that use with a parameter/query);
  remove the field assignment, then the field.

### Duplicate Observed Data **(OOP-specific)**
1. Encapsulate GUI field access.
2. Create a domain module with the fields; wire an observer (listeners + notification).
3. Register the GUI as observer; GUI setters update the domain, domain notifies the GUI. **Verify** green.

### Replace Subclass with Fields **(OOP-specific)**
1. Replace Constructor with Factory Method on the subtypes.
2. Introduce fields in the parent; the parent constructor takes those values.
3. Subtype constructors call the parent with their constants; implement the functions in the parent; remove
   the subtypes. **Verify** green.

---

## Group 4 — Simplifying Conditional Expressions

**Safety discipline**: conditionals carry behavior — the truth table must be identical afterward. When in
doubt, write out the cases before and after and compare.

### Decompose Conditional
1. Extract the condition into a named predicate function.
2. Extract the then-branch and the else-branch into named functions.
3. Replace with calls. **Verify** green — the intent now reads without parsing the logic.

### Consolidate Conditional Expression
1. Confirm the conditionals have no side effects and share an identical result.
2. Combine them with and/or; extract into a predicate named for what it checks.
3. Replace the originals. **Verify** green.

### Consolidate Duplicate Conditional Fragments
1. Find code identical across all branches.
2. If at the branch start, hoist it before the conditional; if at the end, move it after.
3. Extract long fragments into a function. **Verify** green.

### Replace Nested Conditional with Guard Clauses
1. Identify edge-case conditions (guards).
2. Move each to the top as a flat list returning/throwing immediately.
3. Replace nested else-if with sequential guarded returns; merge guards with identical results.
4. **Verify** green — the normal path is now the unindented trunk.

### Remove Control Flag
1. Find the assignment that signals the loop/function should stop.
2. Replace it with `break` / `continue` / `return`.
3. Remove the flag and its checks; simplify the loop condition. **Verify** green.

### Replace Conditional with Polymorphism **(OOP-specific; functional → pattern matching)**
1. If the conditional is mixed with other code, Extract Method first.
2. Create a variant per branch (subtype, or match arm).
3. Move each branch's logic into its variant; replace the conditional with a polymorphic call.
4. Mark the function abstract/virtual on the base. **Verify** green — a new case now means a new variant,
   not an edited switch.

### Introduce Null Object **(OOP-specific)**
1. Create a subtype representing the null case with no-op/default behavior and an `isNull()`.
2. Replace null returns with the null object.
3. Replace `== null` checks with `isNull()` or just rely on the default behavior. **Verify** green.

### Introduce Assertion
1. Identify an implicit assumption about state (often marked by a comment).
2. Add an assertion stating it before the dependent code.
3. Ensure the assertion does not alter normal behavior — it only catches violations. **Verify** green; do
   not over-assert obvious invariants.

---

## Group 5 — Simplifying Method Calls

**Safety discipline**: these change interfaces. For public APIs, prefer the add-new-delegate-then-migrate
path and deprecate rather than break callers. Use `findReferences` to update every site.

### Add Parameter / Remove Parameter
1. Check the parent/child hierarchy for overrides.
2. Create the new-signature function; have the old one delegate to it.
3. Update callers; remove the old one (or deprecate if public). **Verify** green.
- *Remove Parameter pitfall*: confirm the parameter is truly unused, including in overrides.

### Rename Method
1. Check parent/child for overrides.
2. Create a function with the better name; the old name delegates.
3. Update references; remove the old one (or deprecate). **Verify** green.

### Separate Query from Modifier
1. Create a pure query returning the value.
2. Make the original call the query and return its result (temporarily doing both).
3. At each call site, call the query for the value and the modifier separately; leave the original as a
   pure modifier. **Verify** green.
- *Pitfall*: only safe when the query has no observable side effects.

### Parameterize Method
1. Extract the common logic shared by the near-duplicate functions.
2. Replace the differing literals with a parameter.
3. Update call sites to pass the value; remove the redundant functions. **Verify** green.

### Introduce Parameter Object
1. Create an immutable type for the parameter group.
2. Add it to the signature; remove the old parameters one at a time, testing after each.
3. Consider moving operations that act on the group into the new type. **Verify** green.

### Preserve Whole Object
1. Add a parameter accepting the whole structure.
2. Progressively replace the loose parameters with accesses on the structure inside the body, testing.
3. Remove the prior extraction at call sites. **Verify** green.

### Remove Setting Method **(OOP-specific)**
1. Add the field to the constructor's parameters.
2. Move setter calls into constructor arguments at creation sites; assign directly in the constructor.
3. Remove the setter. **Verify** green — the field is now set-once.

### Replace Parameter with Explicit Methods
1. Create one function per branch value, each containing that branch's code.
2. Replace each call by the matching explicit function.
3. Remove the original branching function. **Verify** green.

### Replace Parameter with Method Call
1. Confirm the passed value comes from a query that does not depend on the current parameters.
2. Extract that query if complex.
3. Inside the function, call the query directly; Remove Parameter. **Verify** green.

### Hide Method
1. Use static analysis / `findReferences` to confirm no external callers.
2. Restrict visibility step by step (public → internal → private), testing each tightening.
3. Collapse needless getters/setters to direct access where now-private. **Verify** green.

### Replace Constructor with Factory Method **(OOP-specific)**
1. Create a static factory that calls the constructor.
2. Redirect creation sites to the factory.
3. Make the constructor private; move non-initialization logic into the factory. **Verify** green.

### Replace Error Code with Exception
1. Wrap callers in try/catch for the new exception.
2. Replace the error-code return with a throw; document the exception in the signature.
3. Remove the error-code handling once all callers use try/catch. **Verify** green.
- *Pitfall*: only for genuinely exceptional conditions; predictable cases want Replace Exception with Test.

### Replace Exception with Test
1. Add a conditional checking the predictable edge case before the try block.
2. Move the catch logic into that conditional.
3. Leave the handler only for genuine errors; remove the try/catch if nothing genuine remains. **Verify**
   green.

---

## Group 6 — Dealing with Generalization **(OOP-specific)**

**Safety discipline**: this entire group moves members along an inheritance hierarchy. Standardize
signatures and names before moving; move one member at a time; verify each subtype still satisfies its
contract after each move.

### Pull Up Field / Pull Up Method
1. Confirm the field/method serves an identical purpose across subtypes; standardize names and signatures.
2. Define it in the parent (field protected; method handling subtype-specific bits via abstraction).
3. Remove the duplicates from the subtypes; update call sites. **Verify** green.

### Pull Up Constructor Body
1. Create a supertype constructor holding the common initialization.
2. Extract the identical leading code from each subtype constructor; call `super(...)` first.
3. Keep only the subtype-specific tail. **Verify** green.

### Push Down Field / Push Down Method
1. Declare the member in the subtype(s) that actually use it; copy the implementation down.
2. Remove it from the parent.
3. Confirm it is referenced only from those subtypes. **Verify** green.

### Extract Subclass
1. Create a subtype for the conditional/specialized feature set.
2. Give it a constructor with the specialized data, calling the parent.
3. Replace the relevant instantiations; push specialized features down; replace conditionals with
   polymorphism. **Verify** green.

### Extract Superclass
1. Create an abstract supertype.
2. Pull up the identical fields and shared functions; relocate common constructor logic.
3. Update clients to depend on the supertype where appropriate. **Verify** green.

### Extract Interface
1. Define an empty interface (or protocol/trait).
2. Declare the operations the clients share.
3. Mark the implementing types; update client declarations to the interface. **Verify** green.
- *Note*: applies in languages with interfaces/protocols/traits, even without class inheritance.

### Collapse Hierarchy
1. Choose which of the near-identical subtype/supertype to remove.
2. Pull up or push down all members so one type holds everything.
3. Replace uses of the removed type; delete it. **Verify** green.

### Form Template Method
1. Extract Method for each step of the similar algorithms across subtypes.
2. Pull up the identical step-functions; Rename the structurally-equal-but-differently-named ones to match.
3. Declare the genuinely differing steps abstract in the parent; promote the orchestrating method to the
   parent. **Verify** green — the algorithm skeleton now lives once.

### Replace Inheritance with Delegation
1. Add a field holding an instance of the former parent.
2. Delegate the internally-used methods to it; add forwarding methods for the externally-used ones.
3. Remove the `extends`; initialize the delegate in the constructor. **Verify** green.

### Replace Delegation with Inheritance
1. Confirm the type delegates to *all* of the delegate's public methods and has no parent already.
2. Inherit from the delegate; keep a temporary field reference.
3. Remove the delegating methods one by one; replace references to the delegate field with the type
   itself; remove the field. **Verify** green.

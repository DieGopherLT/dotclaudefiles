# Smell Catalog

The full refactoring.guru taxonomy: 26 code smells in 5 categories. Each entry carries a stable
**reference code** (used by `smell-scan` to label findings), its **detection** criteria, the **problem**
it causes, and the **techniques** that resolve it (see `refactoring-techniques.md`).

Smells marked **(OOP-specific)** apply only to class/inheritance hierarchies. The rest use generic
function / module / type terminology and apply across paradigms. The OOP-specific smells are not
suppressed — they are kept marked, because they still apply in C# and TypeScript class code.

Reference-code scheme: `B` Bloaters, `OO` OO Abusers, `CP` Change Preventers, `D` Dispensables,
`C` Couplers.

---

## Bloaters

Code, methods, and classes that have grown so large they are hard to work with. They accumulate
gradually, especially when nobody refactors.

### B1 — Long Method

- **Detection**: a function past ~10 lines; comments explain internal blocks; cannot be understood at a
  glance.
- **Problem**: hard to comprehend or modify; a hiding place for duplication; extending it requires reading
  the whole body.
- **Techniques**: Extract Method, Replace Temp with Query, Introduce Parameter Object, Preserve Whole
  Object, Replace Method with Method Object, Decompose Conditional.

### B2 — Large Class / Large Module

- **Detection**: a module with many fields / exported functions / lines; sections operate on unrelated
  data; internal duplication.
- **Problem**: high cognitive load; a change to one responsibility affects others; fragile to extend.
- **Techniques**: Extract Class, Extract Subclass *(OOP)*, Extract Interface *(OOP)*, Duplicate Observed
  Data *(OOP)*.

### B3 — Primitive Obsession

- **Detection**: domain concepts (currency, range, phone, status code) modeled as a loose string/int;
  scattered constants like `USER_ADMIN_ROLE = 1`; strings used as map keys where a structure would fit.
- **Problem**: operations scattered instead of encapsulated; the purpose of constants is not obvious;
  duplication is hard to remove.
- **Techniques**: Replace Data Value with Object, Introduce Parameter Object, Preserve Whole Object,
  Replace Type Code with Class/Subclasses/State-Strategy *(OOP)*, Replace Array with Object.

### B4 — Long Parameter List

- **Detection**: a signature with more than 3-4 parameters; parameters that always travel together;
  boolean flags that switch behavior.
- **Problem**: hard to read, prone to ordering mistakes; the signature does not communicate intent; each
  extra datum changes the signature and every call site.
- **Techniques**: Replace Parameter with Method Call, Preserve Whole Object, Introduce Parameter Object.

### B5 — Data Clumps

- **Detection**: the same set of 3+ variables passed as parameters across multiple functions; the same
  fields declared in several modules; removing one makes the rest lose meaning.
- **Problem**: related data scattered around hides the domain concept; a change to the structure forces
  edits in multiple sites.
- **Techniques**: Extract Class (as fields), Introduce Parameter Object (as parameters), Preserve Whole
  Object.

---

## OO Abusers

Incomplete or incorrect application of object-oriented principles.

### OO1 — Alternative Classes with Different Interfaces

- **Detection**: two functions/modules produce the same result under different names (`fetchUser` vs
  `getUser`); incompatible signatures for equivalent operations.
- **Problem**: hidden duplication; bugs patched in one place but not the other; changes must be replicated.
- **Techniques**: Rename Method, Move Method, Add Parameter / Parameterize Method, Extract Superclass.

### OO2 — Refused Bequest **(OOP-specific)**

- **Detection**: inherited methods never invoked or overridden to throw an exception; subtype and supertype
  share little logic; fails the "is-a" test.
- **Problem**: the hierarchy lies, breaks Liskov substitution; confuses the relationship between types;
  fragile inheritance.
- **Techniques**: Replace Inheritance with Delegation, Extract Superclass.

### OO3 — Switch Statements

- **Detection**: a `switch` or `if/else if` chain dispatching on type/state/role; the same cases in more
  than one place; a new "type" forces editing every block.
- **Problem**: low extensibility; high chance of forgetting a site; violates open/closed.
- **Techniques**: Extract Method + Move Method, Replace Type Code with Subclasses/State-Strategy *(OOP)*,
  Replace Conditional with Polymorphism *(OOP)*, Replace Parameter with Explicit Methods, Introduce Null
  Object.

### OO4 — Temporary Field **(OOP-specific)**

- **Detection**: fields assigned only inside one method, null/zero the rest of the time; scattered
  `if (this.tempField != null)`; a field meaningless outside a single flow.
- **Problem**: obscures data flow; loads an auxiliary object's responsibilities onto the host; complicates
  testing.
- **Techniques**: Extract Class, Replace Method with Method Object, Introduce Null Object.

---

## Change Preventers

Structures that mean a single change forces many other changes — the opposite of the goal that changes
should be local.

### CP1 — Divergent Change

- **Detection**: one module modified for unrelated reasons; a new requirement from any area touches the
  same file; functions respond to different axes of change.
- **Problem**: a bottleneck; conflicts and regressions; hard to understand (mixed responsibilities).
- **Techniques**: Extract Class, Extract Superclass *(OOP)*, Extract Subclass *(OOP)*.

### CP2 — Parallel Inheritance Hierarchies **(OOP-specific)**

- **Detection**: creating a subclass in hierarchy A forces creating one in hierarchy B; subclasses share
  common prefixes/suffixes; both hierarchies have the same subclass count.
- **Problem**: structural duplication; fragile synchrony; one design decision requires two sites.
- **Techniques**: Move Method, Move Field.

### CP3 — Shotgun Surgery

- **Detection**: one change forces editing 5-10+ files; a recurring pattern of files touched together; the
  same constant/rule copied across modules.
- **Problem**: errors of omission; costly tracing; changes proportional to the number of modules.
- **Techniques**: Move Method / Move Field, Inline Class.

---

## Dispensables

Something pointless and unneeded whose absence would make the code cleaner, more efficient, and easier to
understand.

### D1 — Comments

- **Detection**: blocks surrounded by explanations in order to be understandable; comments describing
  *what* (not *why*); an extracted function that still requires a comment.
- **Problem**: stale comments are documented lies; logic split between code and prose increases cognitive
  load.
- **Techniques**: Extract Method, Extract Variable, Rename Method, Introduce Assertion.
- **Valid exception**: comments that explain the *why* of a non-obvious decision, or document complex
  algorithms.

### D2 — Duplicate Code

- **Detection**: blocks copied across functions/modules; near-identical logic with superficial variations;
  branches that run the same code.
- **Problem**: fixes must be replicated; a partial update introduces inconsistencies; scattered logic.
- **Techniques**: Extract Method, Consolidate Conditional Expression, Consolidate Duplicate Conditional
  Fragments, Pull Up Field/Constructor Body *(OOP)*, Form Template Method *(OOP)*, Extract
  Superclass/Class *(OOP)*.

### D3 — Data Class **(OOP-specific)**

- **Detection**: only fields and getters/setters with no logic; public unencapsulated fields; never makes
  a decision.
- **Problem**: data logic spread across clients; low cohesion; changes force tracing every client.
- **Techniques**: Encapsulate Field, Encapsulate Collection, Move Method, Extract Method, Remove Setting
  Method, Hide Method.

### D4 — Dead Code

- **Detection**: variables/fields with no active references; functions never called; unreachable branches;
  ignored parameters.
- **Problem**: increases the reading surface with no value; time wasted assessing relevance; tempts reuse
  of obsolete logic.
- **Techniques**: direct deletion, Remove Parameter, Inline Class, Collapse Hierarchy.

### D5 — Lazy Class / Lazy Module **(OOP-specific in classic form)**

- **Detection**: a class/module with a single trivial function; a subclass with almost no override;
  deleting it would not change behavior.
- **Problem**: cognitive cost with no return; the reader navigates to it only to conclude it does nothing.
- **Techniques**: Inline Class, Collapse Hierarchy.

### D6 — Speculative Generality

- **Detection**: abstract interfaces/types with no implementation in use; ignored parameters; fields never
  read; methods only called from tests.
- **Problem**: blurs what the system *does* versus what it *could do*; noise during refactoring and
  debugging.
- **Techniques**: Collapse Hierarchy, Inline Class, Inline Method, Remove Parameter.

---

## Couplers

Excessive coupling between classes, or coupling moved to over-use of delegation.

### C1 — Feature Envy

- **Detection**: a function accesses another module's data more than its own; >50% of references go to
  external data; it could be moved without losing anything.
- **Problem**: logic decoupled from its data; coupling between modules; duplicates knowledge of a foreign
  structure.
- **Techniques**: Move Method, Extract Method (then Move Method over the fragment).
- **Exception**: intentional separation (Strategy, Visitor).

### C2 — Inappropriate Intimacy **(OOP-specific in classic form)**

- **Detection**: a module reaches into another's internal fields without a public interface; a
  bidirectional dependency that should be unidirectional; an internal change in A breaks B.
- **Problem**: breaks encapsulation; conceptually distinct modules evolve together; hampers reuse and
  testing.
- **Techniques**: Move Method / Move Field, Extract Class, Hide Delegate, Change Bidirectional Association
  to Unidirectional *(OOP)*, Replace Delegation with Inheritance *(OOP)*.

### C3 — Incomplete Library Class

- **Detection**: utilities that "should" live in a library but sit in your own code; thin wrappers over
  third-party types; repeated code patching the same gap.
- **Problem**: duplicates/scatters logic that belongs in the library; cost when updating; clients
  accumulate foreign responsibilities.
- **Techniques**: Introduce Foreign Method (a few methods), Introduce Local Extension (broad changes).

### C4 — Message Chains

- **Detection**: `a.getB().getC().getD()`; the caller must know each link's internal structure; a change in
  an intermediate forces modifying the caller.
- **Problem**: coupling to the whole chain; structural fragility; violates the Law of Demeter.
- **Techniques**: Hide Delegate, Extract Method + Move Method.
- **Caution**: overusing Hide Delegate produces a Middle Man.

### C5 — Middle Man **(OOP-specific in classic form)**

- **Detection**: most methods only delegate to another object; removing the class and calling directly
  would not change behavior; no own state or logic.
- **Problem**: accidental complexity; an extra layer to understand where the work actually happens.
- **Techniques**: Remove Middle Man.
- **Exception**: intentional indirection (Proxy, Decorator).

# Refactoring Techniques

The full refactoring.guru catalog: 67 techniques in 6 groups. Each entry gives **when to apply** and the
**mechanics** (3-5 steps). The `refactor` skill expands these into executable playbooks in
`technique-playbooks.md`; this file is the index `smell-scan` maps findings to.

Techniques marked **(OOP-specific)** require type hierarchies / inheritance. They are kept marked, not
removed — they apply in C# and TypeScript class code. Terminology is otherwise generic, no concrete
languages.

---

## 1. Composing Methods

Streamline methods, remove code duplication, pave the way for future improvements.

- **Extract Method** — *When*: a long function or a nameable block; a duplicated block. *Mechanics*: create
  a function with a descriptive name; move the block in and insert a call; pass external variables as
  parameters; return modified variables; verify behavior is identical.
- **Inline Method** — *When*: a function merely delegates without adding clarity. *Mechanics*: check it is
  not overridden; locate invocations; replace each call with the body; delete the function.
- **Extract Variable** — *When*: a complex expression is hard to read. *Mechanics*: declare a variable
  before the expression; assign the logical part; replace that portion with the reference; repeat per
  segment.
- **Inline Temp** — *When*: a temporary holds a simple expression used 1-2 times and adds no clarity.
  *Mechanics*: identify references; replace with the original expression; remove the declaration.
- **Replace Temp with Query** — *When*: a local variable holds an expression used multiple times or
  repeated in other functions. *Mechanics*: confirm a single assignment (otherwise Split Temporary
  Variable); extract the expression via Extract Method; ensure the function has no side effects; replace
  references with calls.
- **Split Temporary Variable** — *When*: a variable is reused for unrelated intermediate values.
  *Mechanics*: rename the first assignment for its purpose; replace its uses; repeat per assignment;
  consider immutability.
- **Remove Assignments to Parameters** — *When*: a parameter is reassigned in the body. *Mechanics*: create
  a local variable initialized from the parameter; replace later uses; update references.
- **Replace Method with Method Object** — *When*: a long function with intertwined local variables that
  cannot be separated. *Mechanics*: create a dedicated type; turn locals into fields; a constructor takes
  the values; move the body into a main method; replace the original function with instantiation +
  invocation.
- **Substitute Algorithm** — *When*: a messy implementation, or a better approach exists. *Mechanics*:
  simplify the current one by extracting unrelated logic; implement the new one separately; swap and test;
  compare outputs if they diverge; delete the old one.

---

## 2. Moving Features between Objects

Safely move functionality between classes/modules, create new ones, hide implementation details.

- **Move Method** — *When*: a function is used more in another module; to reduce dependencies. *Mechanics*:
  examine dependencies and move related ones; create it in the destination (possibly a better name);
  establish a reference to the receiver; replace the original with delegation or remove it.
- **Move Field** — *When*: a field is used more in another module; common during Extract Class.
  *Mechanics*: encapsulate it if public; create an equivalent field with accessors in the destination;
  reference the destination; redirect references; remove the original.
- **Extract Class** — *When*: a module does the work of two. *Mechanics*: create a new module; establish the
  relationship (prefer unidirectional); move fields/functions incrementally, testing after each step;
  decide visibility.
- **Inline Class** — *When*: a module does almost nothing (Lazy Class). *Mechanics*: create equivalent
  fields/functions in the receiver that delegate; replace references; Move Method/Field to relocate
  everything; delete the empty module.
- **Hide Delegate** — *When*: a client navigates a chain of objects. *Mechanics*: create a function on the
  server for each call to the delegate; forward it; update clients; remove the delegate accessor.
  **(OOP-specific)**
- **Remove Middle Man** — *When*: a module has too many functions that only delegate. *Mechanics*: create a
  getter for the delegate; identify the delegating functions; replace client calls with direct calls;
  remove the delegating functions.
- **Introduce Foreign Method** — *When*: an unmodifiable external type lacks a function; repeated code
  manipulates it. *Mechanics*: a new function in the client that receives an instance of the external type;
  extract the duplicated logic; replace duplicates; comment it as a "foreign method"; consider a wrapper if
  they accumulate.
- **Introduce Local Extension** — *When*: an unmodifiable external type lacks several functions (Incomplete
  Library Class). *Mechanics*: subclass or wrap the type; a constructor with the original's parameters; an
  alternate constructor accepting an instance; implement the extensions; remove duplicates in clients.
  **(OOP-specific)**

---

## 3. Organizing Data

Make data handling cleaner and classes more reusable and portable.

- **Change Value to Reference** — *When*: many identical instances with mutable data to propagate.
  *Mechanics*: replace the constructor with a Factory Method; add storage (registry/cache); decide
  preload vs on-demand; the factory returns existing instances.
- **Change Reference to Value** — *When*: a small/immutable reference type whose lifecycle is overhead.
  *Mechanics*: remove mutability (only the constructor assigns); implement equivalence comparison; evaluate
  whether a Factory is still needed. **(OOP-specific)**
- **Duplicate Observed Data** — *When*: domain data lives inside GUI modules; several views of the same
  data. *Mechanics*: encapsulate GUI access; create a domain module with the fields; an observer pattern
  with listeners and notification; the GUI registers and updates; GUI setters update the domain.
  **(OOP-specific)**
- **Self Encapsulate Field** — *When*: direct access to private fields within the module; validation/lazy/
  override is needed. *Mechanics*: create a getter/setter; locate direct accesses; replace with accessors;
  omit the setter if immutable. **(OOP-specific)**
- **Replace Data Value with Object** — *When*: a primitive field grew associated data/behavior;
  duplication. *Mechanics*: create a type with the field, a getter, and a constructor; change the
  declaration to the new type; the original getter delegates; the setter instantiates the new type;
  consider Change Value to Reference.
- **Replace Array with Object** — *When*: an array used as a container of mixed types where position carries
  meaning (Primitive Obsession). *Mechanics*: create a structured type with the array as a field; accessors
  named per element; make the array private; move elements into dedicated fields; remove the array.
- **Change Unidirectional Association to Bidirectional** — *When*: two modules need each other's features
  but the association is one-way. *Mechanics*: add an inverse association field; designate the dominant
  module; utility functions on the non-dominant one; the dominant one invokes those utilities.
  **(OOP-specific)**
- **Change Bidirectional Association to Unidirectional** — *When*: a bidirectional association where one
  side does not use the other. *Mechanics*: confirm non-use or an alternate replacement; replace references
  with parameters/queries; remove the field assignment; remove the field.
- **Encapsulate Field** — *When*: a public field with uncontrolled external access. *Mechanics*: create a
  getter/setter; identify direct accesses; replace reads/writes; make the field private.
- **Encapsulate Collection** — *When*: a module exposes a collection with simple getter/setter that the
  client mutates. *Mechanics*: dedicated add/remove functions; initialize the collection empty; replace the
  setter with add/remove; update direct modifications; the getter returns a read-only view.
- **Replace Magic Number with Symbolic Constant** — *When*: numeric values with no explanation. *Mechanics*:
  declare a named constant; locate instances; verify each occurrence shares the same purpose (the same
  number can mean different things); substitute.
- **Replace Type Code with Class** — *When*: a field with primitive values from a fixed set, with no impact
  on behavior. *Mechanics*: a new type per its purpose; move the field in as a private property with a
  getter; static factories per value; change the field's type; replace references with the statics.
  **(OOP-specific)**
- **Replace Type Code with Subclasses** — *When*: a type code that affects behavior (drives conditionals).
  *Mechanics*: an encapsulated getter; make the supertype constructor private + a Factory that instantiates
  the subtype; a subtype per value overriding the getter; remove the field and declare an abstract getter;
  relocate and replace the conditionals with polymorphism. **(OOP-specific)**
- **Replace Type Code with State/Strategy** — *When*: a type code affects behavior but the value changes
  during the lifecycle (subclasses do not fit). *Mechanics*: a self-encapsulated getter; an abstraction with
  an abstract getter; subtypes per value; a Factory on the abstraction; replace the field's type and update
  the setter via the factory; remove the conditionals with polymorphism. **(OOP-specific)**
- **Replace Subclass with Fields** — *When*: subtypes that differ only in functions returning constants.
  *Mechanics*: Replace Constructor with Factory Method; introduce fields in the parent; the parent's
  constructor takes those values; subtype constructors call the parent; implement the functions in the
  parent and remove the subtypes. **(OOP-specific)**

---

## 4. Simplifying Conditional Expressions

Conditionals tend to grow complicated; these techniques untangle them.

- **Consolidate Conditional Expression** — *When*: multiple conditionals with an identical result.
  *Mechanics*: confirm no side effects; combine with and/or; extract into a function; name it for what it
  checks; replace the originals.
- **Consolidate Duplicate Conditional Fragments** — *When*: identical code in every branch. *Mechanics*:
  identify the common code; if at the start, move it before; if at the end, after; depending on position,
  assess the effect on logic; extract long fragments.
- **Decompose Conditional** — *When*: a complex conditional reduces readability. *Mechanics*: extract the
  condition into a named function; extract the true branch; extract the false branch; replace with calls.
- **Replace Conditional with Polymorphism** — *When*: conditionals acting on a type/property; the pattern
  repeated across functions. *Mechanics*: extract the conditional if mixed in; create variants per branch;
  move the logic into each variant; replace with a polymorphic call; mark the function abstract/virtual.
  **(OOP-specific; in functional code, pattern matching.)**
- **Remove Control Flag** — *When*: a boolean used as a control flag in a loop/function. *Mechanics*: locate
  the assignment that causes the exit; replace it with break/continue/return; remove the associated checks;
  simplify the loop condition.
- **Replace Nested Conditional with Guard Clauses** — *When*: nested conditionals hide the normal flow.
  *Mechanics*: identify the guards (edge cases); move them to the start in a flat list; replace nested
  else-if with sequential ifs that return immediately; consolidate guards with an identical result.
- **Introduce Null Object** — *When*: dozens of null checks; functions return null. *Mechanics*: a subtype
  representing the null case with no-op behavior; `isNull()`; replace null returns with the variant;
  substitute comparisons with `isNull()`; redefine functions with defaults. **(OOP-specific)**
- **Introduce Assertion** — *When*: comments or implicit assumptions about required state. *Mechanics*:
  identify the assumptions; add assertions before the main code; ensure they do not alter normal behavior;
  verify they catch violations; do not over-apply.

---

## 5. Simplifying Method Calls

Make method calls simpler and easier to understand, which simplifies the interfaces for class interaction.

- **Add Parameter** — *When*: a function lacks enough data. *Mechanics*: check parent/child; create a new
  function with the parameter and delegate the old one; update callers; remove the old one (or deprecate if
  public).
- **Remove Parameter** — *When*: an unused parameter. *Mechanics*: check overrides; create a function
  without the parameter and delegate; update references; remove (or deprecate).
- **Rename Method** — *When*: the name does not explain what it does. *Mechanics*: check parent/child;
  create a function with a better name and delegate the old one; update references; remove the old one (or
  deprecate).
- **Separate Query from Modifier** — *When*: a function returns a value and mutates state. *Mechanics*:
  create a query that returns the same value; the original only calls and returns the query; replace calls
  with query + modifier-before; leave the original as a pure modifier.
- **Parameterize Method** — *When*: several similar functions differ only in values. *Mechanics*: extract
  the common logic; replace the differing values with a parameter; update call sites; remove the redundant
  ones.
- **Introduce Parameter Object** — *When*: a repeated group of parameters (Data Clumps). *Mechanics*: an
  immutable type for the group; add it to the function; remove the old parameters one by one, testing;
  consider moving related operations into the new type.
- **Preserve Whole Object** — *When*: several values are extracted from a structure to pass them loose.
  *Mechanics*: a parameter accepting the whole structure; progressively replace parameters with accesses on
  the structure, testing; remove the prior extraction; the body retrieves values directly.
- **Remove Setting Method** — *When*: a field that should only be set at creation. *Mechanics*: add a
  parameter to the constructor; move setter arguments into constructor invocations; assign directly in the
  constructor; remove the setter. **(OOP-specific)**
- **Replace Parameter with Explicit Methods** — *When*: branches on a parameter with non-trivial code and
  rare variants. *Mechanics*: a function per variant called from the original by value; replace invocations
  with the variant; remove the original.
- **Replace Parameter with Method Call** — *When*: the result of a query is passed as a parameter when the
  function could call it. *Mechanics*: confirm the retrieval does not depend on current parameters; Extract
  Method if complex; replace references with direct calls; Remove Parameter.
- **Hide Method** — *When*: a function not used by other modules, or only within its hierarchy. *Mechanics*:
  static analysis to detect no external callers; restrict visibility progressively; turn unnecessary
  getters/setters into direct access; test internal references.
- **Replace Constructor with Factory Method** — *When*: a complex constructor does more than assign fields.
  *Mechanics*: a static Factory that calls the constructor; redirect invocations; make the constructor
  private; move non-initialization logic into the factory. **(OOP-specific)**
- **Replace Error Code with Exception** — *When*: a function returns special error values. *Mechanics*: wrap
  callers in try/catch; replace returns with throws; document the exception in the signature; remove the
  error code.
- **Replace Exception with Test** — *When*: an exception where a conditional would suffice for a
  predictable edge case. *Mechanics*: a conditional checking the case before the try/catch; move the catch
  logic into the conditional; leave the handler only for genuine errors; test; remove the try/catch if it
  passes.

---

## 6. Dealing with Generalization

Abstraction has its own group, mostly moving functionality along the class inheritance hierarchy, creating
new classes and interfaces, replacing inheritance with delegation and vice versa.

*This entire group is **(OOP-specific)** — it requires type/inheritance hierarchies.*

- **Pull Up Field** — *When*: subtypes with the same duplicated field. *Mechanics*: verify identical
  purpose; standardize names; define it in the parent (protected); remove it from the children.
- **Pull Up Method** — *When*: subtypes with similar/identical work functions. *Mechanics*: standardize the
  functions; adjust parameters to the desired signature; move to the parent handling dependencies via
  abstraction; remove from subtypes; update call sites.
- **Pull Up Constructor Body** — *When*: subtype constructors mostly identical. *Mechanics*: a constructor
  in the supertype with the common initialization; extract the identical code from the start of each
  subtype; call super first; remove the redundant code keeping the specific parts.
- **Push Down Field** — *When*: a parent field used only by some subtypes. *Mechanics*: declare the field in
  the children that need it; remove it from the parent; update references.
- **Push Down Method** — *When*: supertype behavior used only by some subtypes. *Mechanics*: declare and copy
  the implementation in the subtype; remove from the parent; verify it is used only from the subtype.
- **Extract Subclass** — *When*: a type with features used only in certain cases. *Mechanics*: a derived
  subtype; a constructor with specialized data that calls the parent; replace instantiations where
  applicable; push-down the specialized features; replace conditionals with polymorphism.
- **Extract Superclass** — *When*: two types with common fields/functions. *Mechanics*: an abstract
  supertype; pull-up the identical fields; migrate the shared functions; relocate constructor logic; update
  clients to the supertype.
- **Extract Interface** — *When*: several clients use the same part of the interface, or identical portions
  exist across several types. *Mechanics*: define an empty interface; declare the shared operations; mark
  the types as implementers; update client declarations. *(Applies in languages with interfaces/protocols/
  traits without inheritance.)*
- **Collapse Hierarchy** — *When*: a subtype and supertype are nearly identical. *Mechanics*: choose which
  to remove; pull-up or push-down the fields/functions; replace uses of the removed one; delete the empty
  type.
- **Form Template Method** — *When*: subtypes with algorithms of similar steps in the same order.
  *Mechanics*: Extract Method per step; pull-up the identical functions; Rename the non-identical ones; mark
  the non-similar signatures abstract in the parent; promote the main function that orchestrates concrete
  and abstract steps.
- **Replace Inheritance with Delegation** — *When*: a subtype violates Liskov or uses only part of the
  supertype. *Mechanics*: a field holding an instance of the former parent; delegate internal functions;
  forwarding functions for the externally used ones; remove the inheritance; initialize the delegate in the
  constructor.
- **Replace Delegation with Inheritance** — *When*: a type with many functions delegating to *all* of
  another's methods. *Mechanics*: inherit from the delegate; a temporary field reference; remove the
  delegating functions one by one; replace references to the delegate with the current type; remove the
  field. *(Only if it delegates to all public methods and the type does not already have a parent.)*

## MODIFIED Requirements

### Requirement: Graduated access is distinct from paying access

The predicate that decides whether a client may receive training content SHALL keep its current meaning and SHALL NOT be widened to include `completed`. Shell access SHALL be decided by a separate, separately named definition — never by relaxing the content predicate.

That separate definition is a named set of shell-granting statuses, applied where subscription rows are selected, together with the derivation that turns a client's statuses into her tier. Naming the enforcement this way rather than requiring a particular function keeps the guarantee honest: the shell boundary is applied in the query, so a standalone predicate over an already-filtered row would answer `true` unconditionally and protect nothing. A redundant predicate is worse than no predicate, because it sits beside the strict one and reads as the right thing to call.

Every content-serving path SHALL use the strict predicate. Widening the existing one would serve training content to clients who are no longer paying, through every call site at once.

#### Scenario: Content paths use the strict check
- **WHEN** any path that serves training content evaluates access for a `completed` client
- **THEN** access is refused

#### Scenario: Shell access uses the graduated check
- **WHEN** the portal shell evaluates access for a `completed` client
- **THEN** access is granted

#### Scenario: Paying clients are unaffected
- **WHEN** a client whose subscription is `active`, `trialing`, or `past_due` is evaluated by either predicate
- **THEN** access is granted exactly as before this change

#### Scenario: The content predicate is never widened
- **WHEN** the set of statuses that grant training content is evaluated
- **THEN** it contains exactly `active`, `trialing` and `past_due`, and does not contain `completed`

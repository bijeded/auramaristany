# portal-graduated-access Specification

## Purpose

Qué conserva una cliente que TERMINÓ su programa. El portal tiene dos niveles: quien paga recibe contenido de entrenamiento; quien terminó conserva lo suyo —su cuenta, sus pagos, su historial, sus fotos y sus mensajes— y pierde lo que estaba pagando, con una salida clara hacia el programa que sigue. La separación entre ambos niveles es la garantía central: la comprobación que decide el contenido nunca se ensancha para incluir a las graduadas.

## Requirements
### Requirement: A client who finished a program keeps a graduated portal

A client whose subscription status is `completed` SHALL retain access to the portal shell and to her own data, and SHALL NOT receive any training content. She SHALL be shown a clear way to continue with the program that follows.

Reachable: her account, her payment history, her progress history, her progress photos and her messages, plus a call to action to continue with CuarentaMás Extra. Not reachable: the day view, the week view, the pillars, and any series content.

Messages are included because they are how Aura reaches her and they carry no training content; they are owner-scoped by recipient. The set of reachable routes SHALL be expressed as an allow-list, so that a training route added later is closed to her by default rather than open until someone remembers to close it.

The distinction encoded is that she keeps what she earned and loses what she was paying for. Locking her out entirely would take her own data from her at the moment she is most likely to continue.

#### Scenario: Completed client reaches her own data
- **WHEN** a client with a `completed` subscription opens the portal
- **THEN** she can reach her account, payment history, progress history, progress photos and her messages

#### Scenario: A training route added later is closed by default
- **WHEN** a portal route that is not on the allow-list is requested by a `completed` client
- **THEN** access is refused and she is directed to the graduated view

#### Scenario: Completed client is offered the next program
- **WHEN** a client with a `completed` subscription opens the portal
- **THEN** a call to action to continue with CuarentaMás Extra is presented

#### Scenario: Completed client cannot reach training content
- **WHEN** a client with a `completed` subscription requests the day view, the week view, or the pillars
- **THEN** access is refused and she is directed to the graduated view

#### Scenario: Cancelled client is not graduated
- **WHEN** a client whose subscription is `canceled` opens the portal
- **THEN** she does not receive graduated access

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


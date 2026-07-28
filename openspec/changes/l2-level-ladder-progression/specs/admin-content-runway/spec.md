## ADDED Requirements

### Requirement: Aura is warned which clients are about to run out of new content

The system SHALL surface, in the admin area, a signal identifying clients who are close to exhausting the content authored for them. The signal SHALL cover both exhaustion shapes as one list, because they have the same cause and the same remedy — Aura needs to author more content:

- a client approaching the end of the top rung, who will wrap and begin repeating; and
- a client approaching the end of a rung whose declared next rung has no series authored yet.

The second case SHALL be presented as the more urgent of the two: a client finishing a rung with no content in the next one wraps back to that rung's first series, which is indistinguishable from a defect to both the client and Aura.

Without this signal Aura learns that a client ran out of content from a complaint, which is the failure this requirement exists to prevent.

#### Scenario: Client approaching the end of the top rung
- **WHEN** a client on the top rung is within the warning threshold of its last authored series
- **THEN** she appears in the runway signal, indicating she will begin repeating

#### Scenario: Next rung has no content
- **WHEN** a client is within the warning threshold of the end of her rung and the rung declared as next has no series mapped to it
- **THEN** she appears in the runway signal flagged as the more urgent case

#### Scenario: Client with ample content ahead
- **WHEN** a client has more authored series ahead of her than the warning threshold
- **THEN** she does not appear in the runway signal

#### Scenario: No clients at risk
- **WHEN** no client is within the warning threshold
- **THEN** the signal reports that no client is running out of content, rather than rendering an empty area with no explanation

#### Scenario: Signal is admin-only
- **WHEN** a non-admin attempts to reach the runway signal
- **THEN** access is refused by the existing admin guard

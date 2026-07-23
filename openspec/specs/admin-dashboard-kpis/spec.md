# admin-dashboard-kpis

## Requirements

### Requirement: Revenue by program is a bar chart
The admin dashboard SHALL render "Ingresos por programa" as a bar chart using the same data as before (`groupRevenueByProgram`). The donut form is removed.

#### Scenario: Bars render per program
- **WHEN** the dashboard loads with invoices across programs
- **THEN** one bar per program is shown with its revenue amount, with brand-consistent colors and tooltips

#### Scenario: Data unchanged
- **WHEN** the chart form changes from donut to bars
- **THEN** the totals per program are identical to the previous donut values

### Requirement: KPI card for subscriptions expiring in 7 days
The admin dashboard SHALL show a fifth stat card with the count and MXN amount of subscriptions whose `current_period_end` falls within the next 7 days. The existing "Renuevan este mes" (≤30 days) card MUST remain.

#### Scenario: Subscription expiring within a week
- **WHEN** a subscription's `current_period_end` is 5 days from now
- **THEN** it is counted in both the 7-day card and the 30-day card

#### Scenario: Subscription expiring later this month
- **WHEN** a subscription's `current_period_end` is 20 days from now
- **THEN** it is counted only in the 30-day card

#### Scenario: Boundary and null handling
- **WHEN** a subscription's period end is in the past or `current_period_end` is null
- **THEN** it is counted in neither card

#### Scenario: Responsive layout with 5 cards
- **WHEN** the dashboard renders at mobile, tablet, and desktop widths
- **THEN** the KPI row wraps cleanly with no overflow or broken layout

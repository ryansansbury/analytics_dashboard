# Decision Log

Choices this codebase made, why, and what each one cost.

Several entries record a decision that was later **reversed**. Those are kept
rather than deleted, because the reasoning that made a bad decision look
attractive at the time is the useful part, and a log that only shows the
surviving choices teaches nothing about how they were arrived at.

---

## 1. Numbers are measured, never generated

**Decision.** Every figure the API reports is derived from stored rows or from a
model scored on a holdout. Where a value cannot be computed, the response
carries `null` and the interface renders a blank.

**Reversal of an earlier decision.** This application previously generated many
displayed metrics at request time with `random.seed(hash(start_date))`: change
percentages, retention, cycle times, quota attainment, forecast intervals, and
model accuracy. The reasoning was defensible in isolation. Seeding by the
selected date range made the dashboard stable on refresh but responsive to
filter changes, which reads as real behaviour, and it guaranteed no empty
charts.

**Why it was wrong.** It was not that the numbers were fake, it was that nothing
distinguished the fake ones from the real ones. `/api/forecasting/model-performance`
reported ROC AUC and MAPE for models that did not exist. Sales performance
computed real per-rep revenue and then overwrote `attainment` with a
manufactured 145-to-61 curve. A reader had no way to know which was which, and
neither did the next person to change the code.

**Cost of the current rule.** Some fields are now permanently `null`, and blank
space is less impressive than a number. `pipelineChange` cannot be computed
because pipeline rows carry current state rather than history, so it stays null
instead of being estimated. That is the trade accepted.

**Enforced by.** `backend/tests/test_forecasting_api.py` asserts endpoint output
equals the trained model exactly rather than approximately.
`backend/tests/test_consistency.py` asserts two identical requests return
identical bytes, which rules out a PRNG behind any figure.

---

## 2. Two real models, validated the way their task requires

**Decision.** Churn is a `GradientBoostingClassifier` over RFM features, tenure,
refund rate, and account attributes, scored on a **stratified** holdout. Revenue
is a `Ridge` regression on trend, cyclical seasonality, and two autoregressive
lags, scored on a **chronological** holdout and reported next to a last-value
naive baseline.

**Why chronological for the forecast.** A shuffled split lets a time-series
model train on the future and predict the past, which produces excellent
validation numbers and a useless model. The split has to respect the arrow of
time or the metric is a lie.

**Why the naive baseline is reported.** MAPE alone does not say whether a model
is worth running. Against a last-value baseline it does. The forecast currently
sits at 3.58% against 5.82%, so it earns its keep by a real but unremarkable
margin, and the API says so.

**Cost.** `r2Score` for the revenue model is negative, which looks alarming
next to a 3.58% MAPE. Both are correct: R² measures against the holdout's own
mean, and a short, nearly flat holdout makes that mean a strong competitor. The
figure stays in the API rather than being suppressed, and the interface leads
with the comparison that is actually informative.

---

## 3. The seed data has to be learnable, and must not leak its own label

**Decision.** Churn in `backend/data/seed_data.py` is behaviour-driven: a latent
engagement variable drives transaction frequency, and the same variable drives
the churn hazard alongside segment and tenure. The engagement value and the
churn date are stripped from the row before insert.

**Why.** An earlier dataset assigned churn at random, which meant no model could
learn it and any reported accuracy had to be fabricated. The failure was
upstream of the modelling code. Making the label a consequence of behaviour that
the features can see is what allows an honest 0.959 ROC AUC.

**Why the cause is stripped.** If `engagement` were stored, the model would read
the label's cause directly and score near-perfectly, which would be a leak
rather than a result.

---

## 4. One bucketing rule, defined once

**Decision.** `backend/app/periods.py` owns a single rule: a period the window
only partly covers is not plotted. Every time-series endpoint calls
`drop_incomplete_tail`.

**Why.** The same data trended upward under a 90-day filter and fell off a cliff
under Year to Date. Nothing was wrong with the query. A nine-day month holds
nine days of revenue, and next to twelve complete months that reads as demand
collapsing. Bucketed weekly the same shortfall is invisible, which is why the
defect looked like an inconsistency between pages rather than one rule missing.

**Cost.** The most recent period is never shown, so the dashboard is always
slightly behind. That is the correct trade: a missing bar is honest, a short bar
is misleading.

---

## 5. Seeding is a command, not an endpoint or a startup step

**Decision.** `python reseed.py`. The application factory creates tables and
stops there.

**Reversal of two earlier decisions.** The app used to auto-reseed on boot when
the newest transaction was more than a week old, and exposed
`GET /api/seed-database` for the same purpose. Both aimed at a hosted demo that
always looks current without manual intervention.

**Why they were wrong.** The auto-reseed recursed infinitely: `seed_database()`
called `create_app()`, which reached the freshness check, found the database
still empty, and called `seed_database()` again. Each level opened its own
engine, so it terminated only by exhausting the server's connections. A bare
`except Exception: pass` hid the failure completely. The endpoint was an
unauthenticated destructive operation reachable by anyone who guessed the URL.

**What replaced the goal.** The demo stays current through
`scripts/refresh-demo.sh`, run deliberately, with a test gating the deploy.

---

## 6. Destructive test fixtures require an opt-in database name

**Decision.** `tests/conftest.py` refuses to run against a database whose name
does not end in `_test`.

**Why.** `pg_app` calls `drop_all()`. On 2026-08-09 the suite was pointed at the
development database and destroyed the real dataset, replacing it with the small
fixture set. Every test passed, because fixture data is perfectly valid. The
snapshot built from it reached production before anyone noticed.

**The general lesson.** A destructive fixture must not depend on the operator
having aimed carefully. The blast radius has to be bounded by something the code
can check.

---

## 7. The hosted demo is a static build, not a running service

**Decision.** `backend/scripts/snapshot.py` runs the real pipeline against real
PostgreSQL, trains both models, walks every endpoint the UI calls under every
date preset, and freezes the responses to JSON. The React build reads those
files. One environment flag switches transports; every API function, hook, and
component is identical across the two modes.

**Why.** Serving the demo live would mean paying for a database, waiting through
a cold start while two models train, and running a job to stop the seeded window
drifting into the past. None of that shows a visitor anything the JSON does not.

**The hard part was time.** Presets like "last 90 days" resolve against today, so
a snapshot taken on one date stops matching the next morning. Rather than key
files on preset names and translate between them, the snapshot records the date
it was taken and static mode treats that as today. The request path then works
directly as the cache key with nothing in between to drift.

**Cost.** The demo ages. Its data is frozen at the snapshot date, which the
sidebar states rather than letting the page imply currency. Unpredictable
breakage was traded for predictable staleness.

**Enforced by.** `frontend/src/services/staticData.test.tsx` mounts every page
under every preset against the snapshot and fails on any request it does not
cover, so a missing endpoint breaks a test rather than producing a blank chart.

**Amended 2026-11-06.** The demo moved from its own Cloudflare Pages project at
analytics.ryansansbury.com to a folder on www.ryansansbury.com beside the site's
other demos, so all three share one address pattern and one deploy. A static
build is based at `/analytics-dashboard/`, `refresh-demo.sh` stages it into the
website, and the website's rules give it its own security policy and route its
pages. The old address redirects every path to the same page at the new one.

---

## 8. PostgreSQL is required, not one option among several

**Decision.** No SQLite fallback for the cross-endpoint suite.

**Why.** Most time-series queries use `date_trunc`, which SQLite has no
equivalent for. A fallback would mean either two query paths or tests that pass
against a database the application never runs on. CI starts a PostgreSQL service
so the consistency checks run there rather than skipping.

**Cost.** A contributor without PostgreSQL sees those tests skip. The unit tests
still run, so a fresh clone is not blocked.

**Amended 2026-11-06.** The newer endpoints group in pandas rather than with
`date_trunc` and run on SQLite too, which is how the unit suite exercises them.
Only `/api/revenue/trends` still needs PostgreSQL. The application and CI stay on
PostgreSQL.

---

## 9. Same-origin single service

**Decision.** The production build places the compiled frontend where Flask can
serve it, so the API and the SPA share an origin.

**Why.** It removes CORS and proxy configuration from production entirely, and
it is one process to deploy.

**Amended 2026-08-09.** That build output used to be committed to git. It is now
ignored. Tracking it meant the committed bundle drifted out of sync with the
source that produced it, and every rebuild wrote another 700 KB blob into
history. Five versions accumulated before it was caught.

---

## 10. No authentication

**Decision.** None anywhere. CORS is open for `/api/*`.

**Why.** Every endpoint is a read over synthetic data, and there is nothing to
protect. The one operation that was genuinely dangerous, seeding, is no longer
reachable over HTTP at all.

**Cost.** Adding real data to this application would require auth first, not as
a later hardening pass.

---

## 11. Churn is predicted forward from a cutoff, not read from the status column

**Decision.** The churn model trains on every customer live at a cutoff 90
days before the latest order. Their features use only transactions on or
before the cutoff, and the label is whether they ordered in the 90 days after
it. Live customers are then scored with features as of today.

**Why.** The first model learned the status column. Customers marked churned
had stopped buying, so recency separated them almost perfectly and the model
reported 0.96 ROC AUC. It was answering "who already left," and every live
customer looked unlike the people who had, so nearly all of them scored under
10% and the at-risk list was empty in practice. The useful question is who
stops next, and a label from after the cutoff against features from before it
asks that without letting the future in. The feature builder had to become
point in time for this to hold. It used to total every transaction whatever
date it was given, and a test now pins that it doesn't.

**Cost.** ROC AUC fell to about 0.78, which is the honest difficulty of the
question. The training population is a quarter old by construction.

---

## 12. Revenue is compared with a year earlier, and quotas are prorated

**Decision.** The comparison chart sets each bucket against the same bucket a
year earlier, shifted 364 days for days and weeks so weekdays align. Headline
figures still compare with the prior window of equal length. Rep attainment
divides bookings by the annual quota times the window's share of a year.

**Why.** The business is seasonal. Against the window just before, a December
spike sits beside a November with none, and the difference is the calendar.
Against a year earlier the spikes line up and the gap is growth. Attainment
against the full annual quota put every rep near 25% on a 90-day view, which
read as a sales team in crisis.

**Cost.** Two comparison bases on one page, so each chart says which it uses.

---

## 13. Opportunities carry their stage history

**Decision.** A `pipeline_stage_changes` table records each stage a deal
entered and when, and `closed_at` records when it closed.

**Why.** Without it the pipeline KPIs were null by necessity. Win rate, cycle
time, days in each stage, the pipeline as it stood on a past date, and the flow
from stage to stage all need to know when a deal moved. With it they are
measured rather than estimated, and the pipeline change on the executive page
compares two real days.

**Cost.** One more table to seed and keep consistent with the opportunities,
which the consistency suite checks.

---

## 14. Each chart's form follows its question, and every chart has a table

**Decision.** Ranked bars instead of pies and donuts, small multiples instead
of one tangled line chart, heatmaps for the cohort table and the daily
calendar, a Sankey for the pipeline, and diverging bars for seasonality.
Colors are fixed per entity, and every chart card has a table view with a CSV
download.

**Why.** A reader compares lengths along a shared baseline far better than
angles or areas. A color that follows rank repaints an entity the moment a
filter reorders the ranking. The table view is how anyone who can't use the
chart gets the numbers, a screen reader user or a colorblind reader with a
dense chart included.

**Cost.** More chart components to maintain than a single generic chart, each
with its own test.

"""Regenerate the dataset from scratch.

    DATABASE_URL=postgresql://localhost:5432/analytics_dashboard python reseed.py

Drops every table, recreates them, and generates a fresh two-year window ending
today. Takes a few minutes.

**This is destructive and it reads DATABASE_URL.** Confirm what that points at
before running, particularly if a shell profile exports one globally for another
project. `scripts/refresh-demo.sh` pins its own database for exactly that reason.

The generator is deterministic (seed 42), but anchors its window to the current
date minus two years, so a rerun reproduces the same dataset re-dated to today
rather than a different one.

This used to be described as a Railway cron service, alongside an auto-reseed in
the application factory. Both are gone; see docs/DECISIONS.md entry 5. Seeding is
a deliberate command now.
"""

from data.seed_data import seed_database

if __name__ == '__main__':
    print("Reseeding. This drops and regenerates every table.")
    seed_database()
    print("Reseed complete.")

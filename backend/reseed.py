"""Standalone reseed script for Railway cron job.

Runs seed_database() with fresh dates and exits.
Configure as a separate Railway service with a cron schedule.
"""

from data.seed_data import seed_database

if __name__ == '__main__':
    print("Starting scheduled reseed...")
    seed_database()
    print("Reseed complete.")

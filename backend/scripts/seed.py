"""Seed-Einstieg: Führt je nach ENVIRONMENT dev- oder prod-Seed aus."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ENVIRONMENT aus .env (vor dem Import von app.config)
os.environ.setdefault("ENVIRONMENT", "development")

from app.config import settings


def main():
    env = (settings.ENVIRONMENT or "development").lower()
    if env == "production":
        from scripts.seed_prod import run_seed_prod
        print("Running PRODUCTION seed ...")
        run_seed_prod()
    else:
        from scripts.seed_dev import run_seed_dev
        print("Running DEVELOPMENT seed ...")
        run_seed_dev()
    print("Seed data created successfully!")


if __name__ == "__main__":
    main()

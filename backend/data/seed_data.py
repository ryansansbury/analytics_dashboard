"""
Synthetic data for the Analytics Dashboard.

One seed and a two-year window ending today, for a software company with a
shape worth charting:

- 40 products in 8 categories, named for what they are. The categories move at
  different rates: cloud and security grow, professional services shrink.
- 2,000 customers in five regions. North America is the largest and Asia
  Pacific grows fastest.
- About 45,000 orders. Volume grows about 28% a year, peaks in December, dips in
  late summer, surges in the last ten days of each quarter, and falls off on
  weekends.
- 30 sales reps, each with a region, a team, and a productivity of their own.
  Quotas are set from each rep's real trailing-year bookings, so attainment
  spreads around 100% the way it does in a real team.
- About 1,400 opportunities, each walked through the stages with its own timing,
  so every one carries a history of when it entered each stage and when it was
  won or lost.

Churn is generated from behaviour rather than rolled at random. Each customer
has a latent engagement score that drives how often they buy and how likely
they are to leave. The models only ever see the transactions it produced.
"""

import contextlib
import math
import os
import random
import sys
from datetime import date, datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from faker import Faker
import numpy as np

fake = Faker()
Faker.seed(42)
random.seed(42)
np.random.seed(42)

# Configuration. The test fixtures override the two counts with smaller ones.
NUM_CUSTOMERS = 2000
NUM_TRANSACTIONS = 45000
NUM_SALES_REPS = 30
NUM_PIPELINE = 1800
START_DATE = None
END_DATE = None

# The catalog. Plain descriptive names, so no product reads as a real company's.
CATALOG = {
    'Enterprise Software': ['ERP Suite', 'Procurement Cloud', 'HR Platform', 'Finance Hub', 'Planning Studio'],
    'Professional Services': ['Implementation Package', 'Migration Services', 'Advisory Retainer',
                              'Training Program', 'Custom Integration'],
    'Cloud Infrastructure': ['Reserved Compute', 'Managed Kubernetes', 'Object Storage', 'Edge Network',
                             'Backup Vault'],
    'Data Analytics': ['Data Warehouse', 'BI Workspace', 'Streaming Pipelines', 'ML Studio', 'Data Catalog'],
    'Security Solutions': ['Endpoint Protection', 'Identity Gateway', 'Threat Detection', 'Email Security',
                           'Cloud Posture'],
    'Integration Platform': ['API Gateway', 'Connector Library', 'Event Bus', 'File Transfer', 'Workflow Engine'],
    'Development Tools': ['CI Runners', 'Code Review', 'Test Automation', 'Release Manager', 'Error Monitoring'],
    'Support & Maintenance': ['Premium Support', 'Extended Warranty', 'Managed Updates', 'Health Checks',
                              'Success Plan'],
}

# Unit price ranges, in dollars.
CATEGORIES = {
    'Enterprise Software': (8000, 26000),
    'Professional Services': (4000, 15000),
    'Cloud Infrastructure': (1500, 9000),
    'Data Analytics': (2500, 11000),
    'Security Solutions': (3000, 14000),
    'Integration Platform': (1800, 7000),
    'Development Tools': (500, 2800),
    'Support & Maintenance': (900, 4500),
}

# How often each category sells at the start of the window, and how fast that
# share grows or shrinks each year.
CATEGORY_MIX = {
    'Security Solutions': (0.20, 0.35),
    'Data Analytics': (0.17, 0.30),
    'Cloud Infrastructure': (0.15, 0.45),
    'Enterprise Software': (0.14, 0.05),
    'Integration Platform': (0.10, 0.15),
    'Professional Services': (0.10, -0.20),
    'Support & Maintenance': (0.08, -0.05),
    'Development Tools': (0.06, 0.20),
}

REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East']
# Share of customers, and how fast each region's share of orders grows a year.
REGION_MIX = {
    'North America': (0.42, 0.10),
    'Europe': (0.27, 0.18),
    'Asia Pacific': (0.16, 0.55),
    'Latin America': (0.09, 0.30),
    'Middle East': (0.06, 0.12),
}

CHANNELS = ['direct', 'online', 'partner']
# Channel shares by segment at the start of the window. Online gains four
# points a year, taken from direct.
CHANNEL_MIX = {
    'enterprise': {'direct': 0.70, 'partner': 0.22, 'online': 0.08},
    'mid-market': {'direct': 0.50, 'partner': 0.28, 'online': 0.22},
    'smb': {'direct': 0.25, 'partner': 0.25, 'online': 0.50},
}
SEGMENTS = ['enterprise', 'mid-market', 'smb']
SEGMENT_ORDER_SIZE = {'enterprise': 1.6, 'mid-market': 1.0, 'smb': 0.55}
TEAM_FOR_SEGMENT = {'enterprise': 'Enterprise', 'mid-market': 'Mid-Market', 'smb': 'SMB'}
INDUSTRIES = [
    'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail',
    'Education', 'Government', 'Media', 'Transportation', 'Energy'
]
ACQUISITION_CHANNELS = ['Direct Sales', 'Referral', 'Organic Search', 'Paid Ads', 'Events']
PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost']
TEAMS = ['Enterprise', 'Mid-Market', 'SMB']

# Order volume over the year. December peaks with year-end budgets, late summer
# is quiet, and the last ten days of each quarter carry the quarter-end push.
MONTH_FACTOR = {1: 0.86, 2: 0.90, 3: 1.02, 4: 0.94, 5: 0.97, 6: 1.04,
                7: 0.88, 8: 0.85, 9: 1.03, 10: 1.05, 11: 1.10, 12: 1.22}
QUARTER_END_PUSH = 1.45
WEEKDAY_FACTOR = {0: 1.00, 1: 1.08, 2: 1.06, 3: 1.02, 4: 0.82, 5: 0.18, 6: 0.10}
ANNUAL_GROWTH = 0.22
QUOTA_GROWTH = 0.15

# The pipeline. The chance a deal advances out of each stage (it's lost
# otherwise), and the median days it spends there.
STAGE_FLOW = ['lead', 'qualified', 'proposal', 'negotiation']
ADVANCE = {'lead': 0.62, 'qualified': 0.70, 'proposal': 0.66, 'negotiation': 0.70}
STAGE_DAYS = {'lead': 8, 'qualified': 15, 'proposal': 19, 'negotiation': 12}
OPEN_PROBABILITY = {'lead': 15, 'qualified': 30, 'proposal': 55, 'negotiation': 75}


def _as_date(value):
    return value.date() if isinstance(value, datetime) else value


def _years_in(on_date):
    """Years since the window began, as a fraction."""
    return (_as_date(on_date) - _as_date(START_DATE)).days / 365.0


def _quarter_end(on_date):
    """Inside the last ten days of a calendar quarter?"""
    if on_date.month not in (3, 6, 9, 12):
        return False
    next_month = date(on_date.year + (on_date.month == 12), on_date.month % 12 + 1, 1)
    return (next_month - on_date).days <= 10


def generate_products():
    """The catalog: five named products in each category."""
    products = []
    product_id = 1
    for category, names in CATALOG.items():
        low, high = CATEGORIES[category]
        for name in names:
            price = round(random.uniform(low, high), -1)
            products.append({
                'id': product_id,
                'name': name,
                'category': category,
                'unit_price': price,
                'cost': round(price * random.uniform(0.25, 0.55), 2),
                'is_active': True,
            })
            product_id += 1
    return products


def generate_sales_reps():
    """The sales team, spread across regions and teams.

    Each rep carries a productivity factor that decides how much of their
    territory's business they win. `quota` starts as a placeholder.
    `assign_quotas()` sets the real figure once the orders exist, from what
    each rep actually booked.
    """
    region_counts = {'North America': 11, 'Europe': 8, 'Asia Pacific': 6, 'Latin America': 3, 'Middle East': 2}
    regions = [r for r, n in region_counts.items() for _ in range(n)][:NUM_SALES_REPS]
    teams = (['Enterprise'] * 8 + ['Mid-Market'] * 10 + ['SMB'] * 12)
    random.shuffle(teams)

    reps = []
    for i, region in enumerate(regions):
        reps.append({
            'id': i + 1,
            'name': fake.name(),
            'team': teams[i % len(teams)],
            'region': region,
            'quota': 0,
            'hire_date': fake.date_between(start_date='-5y', end_date='-6m'),
            'productivity': float(np.random.lognormal(0.0, 0.22)),
        })
    return reps


def generate_customers():
    """Generate customer base.

    Churn is *generated from behaviour*, not rolled independently, so the
    dataset actually contains a learnable signal. Each customer gets a latent
    engagement score, and their churn hazard is a function of that score plus
    segment and tenure. The label is then derived from the hazard rather than
    assigned at random.

    This matters: an earlier version of this generator drew `status` from a
    bare `random.random()` with no relationship to any other column, which made
    churn statistically unlearnable by construction. Any classifier trained on
    it would have scored at the base rate, correctly.

    `engagement` and `churn_date` are internal fields consumed by
    generate_transactions(); they are not persisted to the database. Recency
    and frequency in the transaction history are what a model actually sees.
    `lifetime_value` starts at zero and `realized_ltv()` fills it in from the
    customer's own completed orders.
    """
    customers = []

    # Distribution: 15% enterprise, 35% mid-market, 50% SMB
    n_ent = int(NUM_CUSTOMERS * 0.15)
    n_mid = int(NUM_CUSTOMERS * 0.35)
    segments = ['enterprise'] * n_ent + ['mid-market'] * n_mid + ['smb'] * (NUM_CUSTOMERS - n_ent - n_mid)

    # Smaller accounts churn more often, which is the usual shape in B2B.
    segment_hazard = {'enterprise': 0.05, 'mid-market': 0.11, 'smb': 0.19}
    region_names = list(REGION_MIX)
    region_weights = [REGION_MIX[r][0] for r in region_names]

    for i in range(NUM_CUSTOMERS):
        segment = segments[i]
        region = random.choices(region_names, weights=region_weights, k=1)[0]
        # A third of the base was already a customer when the window opened, so
        # the business is mature at the start rather than ramping up from zero.
        if random.random() < 0.35:
            acquisition_date = fake.date_between(start_date=START_DATE - timedelta(days=1095), end_date=START_DATE)
        else:
            acquisition_date = fake.date_between(start_date=START_DATE, end_date=END_DATE)

        # Latent propensity to keep buying. Drives transaction frequency below,
        # so it reaches the model only through observable behaviour.
        engagement = random.betavariate(2.6, 2.0)

        # Tenure in days at the end of the window.
        end_date = _as_date(END_DATE)
        tenure_days = max((end_date - acquisition_date).days, 0)

        # Hazard: disengaged, small, and newly acquired accounts churn most.
        hazard = segment_hazard[segment]
        hazard *= (1.9 - 1.4 * engagement)          # engagement dominates
        hazard *= (1.35 if tenure_days < 180 else 1.0)  # early-life churn
        hazard += random.uniform(-0.03, 0.03)       # irreducible noise
        hazard = min(max(hazard, 0.01), 0.85)

        roll = random.random()
        churn_date = None
        if roll < hazard:
            status = 'churned'
            # Stopped buying somewhere in the back half of their tenure.
            if tenure_days > 60:
                offset = random.randint(30, max(31, int(tenure_days * 0.8)))
                churn_date = acquisition_date + timedelta(days=offset)
            else:
                churn_date = acquisition_date + timedelta(days=15)
        elif roll < hazard * 1.9:
            # Still buying but decaying. generate_transactions() thins them out.
            status = 'at-risk'
        else:
            status = 'active'

        customers.append({
            'id': i + 1,
            'name': fake.name(),
            'company': fake.company(),
            'industry': random.choice(INDUSTRIES),
            'segment': segment,
            'acquisition_date': acquisition_date,
            'acquisition_channel': random.choice(ACQUISITION_CHANNELS),
            'lifetime_value': 0,
            'status': status,
            'region': region,
            # internal only, stripped before insert
            'engagement': engagement,
            'churn_date': churn_date,
        })

    return customers


def _daily_volumes(start, end):
    """Expected orders per day, scaled so the window holds NUM_TRANSACTIONS."""
    days, weights = [], []
    day = start
    while day <= end:
        w = (1 + ANNUAL_GROWTH) ** _years_in(day)
        w *= MONTH_FACTOR[day.month] * WEEKDAY_FACTOR[day.weekday()]
        if _quarter_end(day):
            w *= QUARTER_END_PUSH
        days.append(day)
        weights.append(w)
        day += timedelta(days=1)
    scale = NUM_TRANSACTIONS / sum(weights)
    return [(d, w * scale) for d, w in zip(days, weights)]


def _shares(mix, years):
    """Normalized shares after `years` of each entry growing at its own rate."""
    raw = {k: base * (1 + growth) ** years for k, (base, growth) in mix.items()}
    total = sum(raw.values())
    return {k: v / total for k, v in raw.items()}


def generate_transactions(products, customers, sales_reps):
    """Order history with growth, seasonality, and regional and category trends.

    Each order picks a region by that region's share on the day, then a customer
    there weighted by engagement, a product by its category's share on the day,
    a channel by segment, and a rep from the customer's region and segment team
    weighted by productivity.
    """
    rng = np.random.default_rng(42)
    start, end = _as_date(START_DATE), _as_date(END_DATE)

    end_date_d = end
    by_region = {r: [c for c in customers if c['region'] == r] for r in REGIONS}
    region_weights = {r: [0.25 + 1.75 * c['engagement'] for c in by_region[r]] for r in REGIONS}

    by_category = {}
    for p in products:
        by_category.setdefault(p['category'], []).append(p)

    reps_by_key = {}
    for rep in sales_reps:
        reps_by_key.setdefault((rep['region'], rep['team']), []).append(rep)
    reps_by_region = {}
    for rep in sales_reps:
        reps_by_region.setdefault(rep['region'], []).append(rep)

    def eligible(c, on_date):
        """Is this customer still transacting on `on_date`?"""
        if on_date < c['acquisition_date']:
            return False
        if c['churn_date'] is not None and on_date >= c['churn_date']:
            return False
        if c['status'] == 'at-risk':
            # Activity fades over the final six months rather than stopping dead,
            # so an at-risk account looks partway to churned by the end. With a
            # shallower fade nobody still buying resembled a churner, and the
            # model put almost every live customer under 10% risk.
            days_left = (end_date_d - on_date).days
            if days_left < 180:
                return random.random() < (0.02 + 0.98 * (days_left / 180) ** 1.6)
        return True

    def pick_customer(region, on_date, attempts=12):
        pool = by_region.get(region) or []
        if not pool:
            return None
        for _ in range(attempts):
            c = random.choices(pool, weights=region_weights[region], k=1)[0]
            if eligible(c, on_date):
                return c
        return None

    def pick_rep(customer):
        team = TEAM_FOR_SEGMENT[customer['segment']]
        pool = reps_by_key.get((customer['region'], team)) or reps_by_region.get(customer['region']) or sales_reps
        return random.choices(pool, weights=[r['productivity'] for r in pool], k=1)[0]

    def pick_channel(customer, years):
        shares = dict(CHANNEL_MIX[customer['segment']])
        shift = min(0.04 * years, shares['direct'] - 0.05)
        shares['online'] += shift
        shares['direct'] -= shift
        names = list(shares)
        return random.choices(names, weights=[shares[n] for n in names], k=1)[0]

    # A customer acquired inside the window is acquired by their first order, so
    # that order lands on the acquisition date. Without it a new account's first
    # purchase came whenever the sampler happened to pick it, and a cohort chart
    # keyed on acquisition month could not start at 100%.
    newcomers_on = {}
    for c in customers:
        if start <= c['acquisition_date'] <= end:
            newcomers_on.setdefault(c['acquisition_date'], []).append(c)

    transactions = []
    transaction_id = 1
    for day, expected in _daily_volumes(start, end):
        years = _years_in(day)
        region_share = _shares(REGION_MIX, years)
        category_share = _shares(CATEGORY_MIX, years)
        regions = list(region_share)
        categories = list(category_share)
        newcomers = newcomers_on.get(day, [])
        # First orders count toward the day's volume rather than adding to it.
        # There's no hard cap on the total: NUM_TRANSACTIONS sets the expected
        # count, and a cap would cut off the final days of the window whenever
        # the Poisson draws ran a little high.
        count = max(int(rng.poisson(expected)), len(newcomers))

        for slot in range(count):
            first_order = slot < len(newcomers)
            if first_order:
                customer = newcomers[slot]
            else:
                region = random.choices(regions, weights=[region_share[r] for r in regions], k=1)[0]
                customer = pick_customer(region, day)
                if customer is None:
                    continue

            category = random.choices(categories, weights=[category_share[c] for c in categories], k=1)[0]
            product = random.choice(by_category[category])
            sales_rep = pick_rep(customer)

            if category in ('Enterprise Software', 'Professional Services'):
                quantity = 1
            else:
                quantity = random.choices([1, 2, 3, 4, 5, 6, 8], weights=[72, 14, 7, 3, 2, 1, 1], k=1)[0]

            noise = float(rng.lognormal(0.0, 0.15))
            amount = product['unit_price'] * quantity * SEGMENT_ORDER_SIZE[customer['segment']] * noise

            status_roll = random.random()
            if first_order or status_roll < 0.94:
                status = 'completed'
            elif status_roll < 0.975:
                status = 'pending'
            else:
                status = 'refunded'

            transactions.append({
                'id': transaction_id,
                'transaction_date': day,
                'amount': round(amount, 2),
                'quantity': quantity,
                'product_id': product['id'],
                'customer_id': customer['id'],
                'sales_rep_id': sales_rep['id'],
                'region': customer['region'],
                'channel': pick_channel(customer, years),
                'status': status,
            })
            transaction_id += 1

    return transactions


def assign_quotas(sales_reps, transactions):
    """Annual quotas from each rep's trailing-year bookings.

    A target attainment is drawn for each rep around 100% with a realistic
    spread, and the quota is whatever makes their real bookings land there. The
    API prorates the annual figure to whatever window the page shows.
    """
    end = _as_date(END_DATE)
    year_ago = end - timedelta(days=365)
    booked = {r['id']: 0.0 for r in sales_reps}
    for t in transactions:
        if t['status'] == 'completed' and t['transaction_date'] > year_ago:
            booked[t['sales_rep_id']] = booked.get(t['sales_rep_id'], 0.0) + t['amount']
    for rep in sales_reps:
        target = min(max(random.gauss(1.0, 0.16), 0.62), 1.38)
        bookings = booked.get(rep['id'], 0.0)
        # Quotas carry the year's expected growth, as real quotas do.
        quota = bookings * (1 + QUOTA_GROWTH) / target if bookings else 1_000_000
        rep['quota'] = round(quota, -4)
    return sales_reps


def realized_ltv(customers, transactions):
    """Lifetime value as each customer's completed revenue to date."""
    totals = {}
    for t in transactions:
        if t['status'] == 'completed':
            totals[t['customer_id']] = totals.get(t['customer_id'], 0.0) + t['amount']
    for c in customers:
        c['lifetime_value'] = round(totals.get(c['id'], 0.0), 2)
    return customers


def generate_pipeline(customers, sales_reps):
    """Opportunities walked through the stages, each with its own history.

    Deals are created over the last twenty months, more of them recently. Each
    one spends a lognormal number of days in a stage around that stage's median,
    then advances or is lost. A deal still moving when the window ends stays
    open in its current stage. `_history` lists every stage the deal entered
    with the day it entered. It's stripped before insert and becomes rows in
    pipeline_stage_changes through `stage_changes()`.
    """
    rng = np.random.default_rng(7)
    end = _as_date(END_DATE)
    first = end - timedelta(days=600)
    live = [c for c in customers if c['status'] != 'churned']
    categories = list(CATALOG)

    pipeline = []
    for i in range(NUM_PIPELINE):
        # More deals recently: a power below one skews creation dates toward the end.
        offset = int(600 * (random.random() ** (1 / 1.6)))
        created = first + timedelta(days=offset)
        customer = random.choice(live)
        team = TEAM_FOR_SEGMENT[customer['segment']]
        pool = [r for r in sales_reps if r['region'] == customer['region'] and r['team'] == team] or sales_reps
        sales_rep = random.choice(pool)

        if customer['segment'] == 'enterprise':
            amount = float(rng.lognormal(math.log(210000), 0.45))
        elif customer['segment'] == 'mid-market':
            amount = float(rng.lognormal(math.log(75000), 0.40))
        else:
            amount = float(rng.lognormal(math.log(22000), 0.40))

        history = [('lead', created)]
        stage, day, closed = 'lead', created, None
        while True:
            days_here = max(1, int(rng.lognormal(math.log(STAGE_DAYS[stage]), 0.45)))
            leave = day + timedelta(days=days_here)
            if leave > end:
                break
            if random.random() < ADVANCE[stage]:
                if stage == 'negotiation':
                    stage, closed = 'closed-won', leave
                    history.append((stage, leave))
                    break
                stage = STAGE_FLOW[STAGE_FLOW.index(stage) + 1]
                day = leave
                history.append((stage, day))
            else:
                stage, closed = 'closed-lost', leave
                history.append((stage, leave))
                break

        if closed is None:
            remaining = sum(STAGE_DAYS[s] for s in STAGE_FLOW[STAGE_FLOW.index(stage):])
            expected_close = end + timedelta(days=max(3, int(remaining * random.uniform(0.6, 1.3))))
            probability = OPEN_PROBABILITY[stage]
        else:
            expected_close = closed
            probability = 100 if stage == 'closed-won' else 0

        pipeline.append({
            'id': i + 1,
            'opportunity_name': f"{customer['company']} {random.choice(categories)}",
            'customer_id': customer['id'],
            'sales_rep_id': sales_rep['id'],
            'stage': stage,
            'amount': round(amount, -2),
            'probability': probability,
            'expected_close_date': expected_close,
            'created_at': datetime.combine(created, datetime.min.time()) + timedelta(hours=9),
            'closed_at': closed,
            '_history': history,
        })

    return pipeline


def stage_changes(pipeline):
    """Rows for pipeline_stage_changes from each opportunity's `_history`."""
    rows = []
    for opp in pipeline:
        for stage, entered in opp['_history']:
            rows.append({'opportunity_id': opp['id'], 'stage': stage, 'entered_on': entered})
    return rows


def without_internal(rows, *fields):
    """Copies of `rows` without generator-internal fields."""
    return [{k: v for k, v in r.items() if k not in fields} for r in rows]


def generate_all():
    """Every table's rows, in dependency order."""
    products = generate_products()
    sales_reps = generate_sales_reps()
    customers = generate_customers()
    transactions = generate_transactions(products, customers, sales_reps)
    assign_quotas(sales_reps, transactions)
    realized_ltv(customers, transactions)
    pipeline = generate_pipeline(customers, sales_reps)
    return {
        'products': products,
        'sales_reps': without_internal(sales_reps, 'productivity'),
        'customers': without_internal(customers, 'engagement', 'churn_date'),
        'transactions': transactions,
        'pipeline': without_internal(pipeline, '_history'),
        'stage_changes': stage_changes(pipeline),
    }


def seed_database():
    """Drop every table, recreate them, and fill them with a fresh window ending today."""
    global START_DATE, END_DATE
    END_DATE = datetime.now()
    START_DATE = END_DATE - timedelta(days=730)  # 2 years ago

    from flask import current_app
    from app import create_app, db
    from app.models import Product, Customer, SalesRep, Transaction, Pipeline, StageChange

    # Reuse an active application context when there is one, and only build an
    # app when called standalone. Unconditionally calling create_app() here was
    # half of a recursion loop with the factory's old auto-reseed block.
    if current_app:
        ctx = contextlib.nullcontext()
    else:
        ctx = create_app('development').app_context()

    with ctx:
        print("Generating synthetic data...")
        data = generate_all()
        for name, rows in data.items():
            print(f"Generated {len(rows)} {name.replace('_', ' ')}")

        # Drop and recreate rather than truncate, so a schema change reaches the
        # database on the next reseed instead of failing against old tables.
        print("\nRecreating tables...")
        db.drop_all()
        db.create_all()

        for model, key in ((Product, 'products'), (SalesRep, 'sales_reps'), (Customer, 'customers'),
                           (Transaction, 'transactions'), (Pipeline, 'pipeline'),
                           (StageChange, 'stage_changes')):
            rows = data[key]
            print(f"Inserting {key.replace('_', ' ')} ({len(rows)})...")
            for i in range(0, len(rows), 5000):
                db.session.bulk_insert_mappings(model, rows[i:i + 5000])
                db.session.commit()

        print("\nDatabase seeding complete!")


if __name__ == '__main__':
    seed_database()

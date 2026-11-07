from app import db


class StageChange(db.Model):
    """One stage an opportunity entered, and the day it entered it.

    Every opportunity has a row for `lead` on the day it was created, a row for
    each later stage it reached, and a final `closed-won` or `closed-lost` row
    when it closed. That history is what cycle time, win rate over a window, the
    pipeline's value on a past date, and the stage-to-stage flow are measured
    from. Before it existed the schema held only an opportunity's current stage,
    so those figures could not be computed and the API returned null for them.
    """
    __tablename__ = 'pipeline_stage_changes'

    id = db.Column(db.Integer, primary_key=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey('pipeline.id'), index=True, nullable=False)
    stage = db.Column(db.String(50), nullable=False)
    entered_on = db.Column(db.Date, nullable=False, index=True)

    opportunity = db.relationship('Pipeline', back_populates='stage_changes')

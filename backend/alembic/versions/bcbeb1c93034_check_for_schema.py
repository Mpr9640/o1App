# alembic/versions/bcbeb1c93034_check_for_schema.py
from alembic import op
import sqlalchemy as sa

revision = "bcbeb1c93034"
down_revision = "bb640746e944"
branch_labels = None
depends_on = None

job_status = sa.Enum("applied", "interview", "rejected", "finalized", name="job_status")

def upgrade():
    bind = op.get_bind()
    job_status.create(bind, checkfirst=True)

    # 0) Drop existing default so the TYPE change can proceed
    op.execute("ALTER TABLE job_applications ALTER COLUMN status DROP DEFAULT")

    # 1) Normalize data to safe values
    op.execute("UPDATE job_applications SET status = COALESCE(LOWER(status), 'applied')")
    op.execute("""
        UPDATE job_applications
        SET status = 'applied'
        WHERE status NOT IN ('applied','interview','rejected','finalized')
    """)

    # 2) Change type with USING
    op.execute("""
        ALTER TABLE job_applications
        ALTER COLUMN status TYPE job_status
        USING status::job_status
    """)

    # 3) Re-apply constraints/defaults
    op.execute("ALTER TABLE job_applications ALTER COLUMN status SET NOT NULL")
    op.execute("ALTER TABLE job_applications ALTER COLUMN status SET DEFAULT 'applied'::job_status")

    # 4) applied_at → NOT NULL (backfill first)
    op.execute("UPDATE job_applications SET applied_at = NOW() WHERE applied_at IS NULL")
    op.alter_column("job_applications", "applied_at",
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)

    # 5) Constraint rename (guarded)
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_jobapps_user_url') THEN
            ALTER TABLE job_applications RENAME CONSTRAINT uq_jobapps_user_url TO uq_user_url;
        END IF;
    END$$;
    """)

    # 6) Index (guarded)
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_applications_user_id ON job_applications (user_id)")


def downgrade():
    # Drop default first
    op.execute("ALTER TABLE job_applications ALTER COLUMN status DROP DEFAULT")

    # Convert ENUM -> VARCHAR
    op.execute("""
        ALTER TABLE job_applications
        ALTER COLUMN status TYPE VARCHAR
        USING status::text
    """)
    # Restore nullable/default as prior
    op.alter_column("job_applications", "applied_at",
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.execute("ALTER TABLE job_applications ALTER COLUMN status SET DEFAULT 'applied'")

    # Undo index + rename (guarded)
    op.execute("DROP INDEX IF EXISTS ix_job_applications_user_id")
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_url') THEN
            ALTER TABLE job_applications RENAME CONSTRAINT uq_user_url TO uq_jobapps_user_url;
        END IF;
    END$$;
    """)

    # Drop type if unused
    job_status.drop(op.get_bind(), checkfirst=True)

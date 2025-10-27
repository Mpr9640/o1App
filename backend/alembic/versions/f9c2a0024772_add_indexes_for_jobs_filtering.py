"""add indexes for jobs filtering

Revision ID: f9c2a0024772
Revises: bcbeb1c93034
Create Date: 2025-10-02 18:20:37.827291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9c2a0024772'
down_revision: Union[str, None] = 'bcbeb1c93034'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # Ordered indexes match ORDER BY ... DESC pattern
        op.execute("""
            CREATE INDEX IF NOT EXISTS ix_job_apps_user_status_applied_at_desc
            ON job_applications (user_id, status, applied_at DESC);
        """)
        op.execute("""
            CREATE INDEX IF NOT EXISTS ix_job_apps_user_applied_at_desc
            ON job_applications (user_id, applied_at DESC);
        """)
    else:
        # Cross-DB safe (SQLite/MySQL/etc.)
        op.create_index(
            "ix_job_apps_user_status_applied_at",
            "job_applications",
            ["user_id", "status", "applied_at"],
            unique=False,
        )
        op.create_index(
            "ix_job_apps_user_applied_at",
            "job_applications",
            ["user_id", "applied_at"],
            unique=False,
        )

def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_job_apps_user_applied_at_desc;")
        op.execute("DROP INDEX IF EXISTS ix_job_apps_user_status_applied_at_desc;")
    else:
        op.drop_index("ix_job_apps_user_applied_at", table_name="job_applications")
        op.drop_index("ix_job_apps_user_status_applied_at", table_name="job_applications")

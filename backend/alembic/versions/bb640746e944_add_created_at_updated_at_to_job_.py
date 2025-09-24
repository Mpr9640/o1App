"""add created_at updated_at to job_applications

Revision ID: bb640746e944
Revises: 8c471d7c5f83
Create Date: 2025-09-15 14:26:14.192218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb640746e944'
down_revision: Union[str, None] = '8c471d7c5f83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade():
    # Add columns with server defaults so existing rows are backfilled
    op.add_column(
        "job_applications",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.add_column(
        "job_applications",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # If you recently added the unique constraint in the model and it doesn't exist yet, uncomment:
    # op.create_unique_constraint('uq_user_url', 'job_applications', ['user_id', 'url'])

def downgrade():
    # If you created the unique constraint above, drop it here too:
    # op.drop_constraint('uq_user_url', 'job_applications', type_='unique')
    op.drop_column("job_applications", "updated_at")
    op.drop_column("job_applications", "created_at")
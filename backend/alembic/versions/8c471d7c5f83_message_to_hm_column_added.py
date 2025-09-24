"""Message to HM Column added

Revision ID: 8c471d7c5f83
Revises: add_job_apps
Create Date: 2025-09-12 14:16:45.922001
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "8c471d7c5f83"
down_revision: Union[str, None] = "add_job_apps"   # make sure this matches your previous revision ID exactly
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # ✅ Only add the new column
    op.add_column(
        "candidates",
        sa.Column("message_to_hiring_manager", sa.Text(), nullable=True),  # Text is safer for long messages
    )

def downgrade() -> None:
    # ✅ Only drop the new column
    op.drop_column("candidates", "message_to_hiring_manager")

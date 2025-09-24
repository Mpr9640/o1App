"""Add educations/experiences tables

Revision ID: 19e1896d74a8
Revises: 5edf6a4187c4
Create Date: 2025-09-11 11:15:48.223391
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '19e1896d74a8'
down_revision: Union[str, None] = '5edf6a4187c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 0) Ensure the FK target (candidates.user_id) is valid for FK references
    #    Must be NOT NULL + UNIQUE (or PK). We add UNIQUE here.
    op.alter_column('candidates', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
    op.create_unique_constraint('uq_candidates_user_id', 'candidates', ['user_id'])

    # 1) Create child tables (FK -> candidates.user_id)
    op.create_table(
        'educations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('candidate_user_id', sa.Integer(), nullable=False),
        sa.Column('degree', sa.String(), nullable=True),
        sa.Column('major', sa.String(), nullable=True),
        sa.Column('school', sa.String(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('currently_studying', sa.Boolean(), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('zip_code', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('cgpa', sa.Numeric(precision=4, scale=2), nullable=True),
        sa.ForeignKeyConstraint(['candidate_user_id'], ['candidates.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_educations_candidate_user_id'), 'educations', ['candidate_user_id'], unique=False)

    op.create_table(
        'experiences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('candidate_user_id', sa.Integer(), nullable=False),
        sa.Column('company_name', sa.String(), nullable=True),
        sa.Column('job_name', sa.String(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('currently_working', sa.Boolean(), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('zip_code', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('job_duties', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['candidate_user_id'], ['candidates.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_experiences_candidate_user_id'), 'experiences', ['candidate_user_id'], unique=False)

    # 2) (Optional) widen types you had
    op.alter_column('candidates', 'skills', existing_type=sa.VARCHAR(), type_=sa.Text(), existing_nullable=True)
    op.alter_column('candidates', 'job_titles', existing_type=sa.VARCHAR(), type_=sa.Text(), existing_nullable=True)
    op.alter_column('candidates', 'locations', existing_type=sa.VARCHAR(), type_=sa.Text(), existing_nullable=True)

    # 3) (You’re dropping legacy single-education/experience columns here)
    #    NOTE: if you needed to backfill those values into the new tables,
    #    do it BEFORE dropping them (using op.execute INSERT ... SELECT ...).
    op.drop_column('candidates', 'currently_working')
    op.drop_column('candidates', 'job_address')
    op.drop_column('candidates', 'company_name')
    op.drop_column('candidates', 'school_zip_code')
    op.drop_column('candidates', 'job_state')
    op.drop_column('candidates', 'job_city')
    op.drop_column('candidates', 'school')
    op.drop_column('candidates', 'school_state')
    op.drop_column('candidates', 'job_country')
    op.drop_column('candidates', 'cgpa')
    op.drop_column('candidates', 'job_start_date')
    op.drop_column('candidates', 'school_end_date')
    op.drop_column('candidates', 'currently_studying')
    op.drop_column('candidates', 'school_address')
    op.drop_column('candidates', 'degree')
    op.drop_column('candidates', 'school_country')
    op.drop_column('candidates', 'job_duties')
    op.drop_column('candidates', 'school_city')
    op.drop_column('candidates', 'job_end_date')
    op.drop_column('candidates', 'major')
    op.drop_column('candidates', 'job_name')
    op.drop_column('candidates', 'school_start_date')
    op.drop_column('candidates', 'job_zip_code')


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate dropped columns (types from your autogen)
    op.add_column('candidates', sa.Column('job_zip_code', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_start_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_name', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('major', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_end_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_city', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_duties', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_country', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('degree', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_address', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('currently_studying', sa.BOOLEAN(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_end_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_start_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('cgpa', sa.NUMERIC(precision=3, scale=2), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_country', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_state', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_city', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_state', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('school_zip_code', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('company_name', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('job_address', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('candidates', sa.Column('currently_working', sa.BOOLEAN(), autoincrement=False, nullable=True))

    op.alter_column('candidates', 'locations', existing_type=sa.Text(), type_=sa.VARCHAR(), existing_nullable=True)
    op.alter_column('candidates', 'job_titles', existing_type=sa.Text(), type_=sa.VARCHAR(), existing_nullable=True)
    op.alter_column('candidates', 'skills', existing_type=sa.Text(), type_=sa.VARCHAR(), existing_nullable=True)

    op.drop_index(op.f('ix_experiences_candidate_user_id'), table_name='experiences')
    op.drop_table('experiences')
    op.drop_index(op.f('ix_educations_candidate_user_id'), table_name='educations')
    op.drop_table('educations')

    # Drop the UNIQUE constraint we added in upgrade()
    op.drop_constraint('uq_candidates_user_id', 'candidates', type_='unique')

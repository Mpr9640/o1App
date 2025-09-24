from alembic import op
import sqlalchemy as sa


revision = "add_job_apps"
down_revision = "19e1896d74a8" # set to your last revision id
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'job_applications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('company', sa.String()),
        sa.Column('location', sa.String()),
        sa.Column('url', sa.String()),
        sa.Column('status', sa.String(), server_default='applied'),
        sa.Column('notes', sa.Text()),
        sa.Column('company_logo_url', sa.String()),
        sa.Column('source', sa.String(), server_default='manual'),
        sa.Column('applied_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint('uq_jobapps_user_url', 'job_applications', ['user_id', 'url'])




def downgrade():
    op.drop_constraint('uq_jobapps_user_url', 'job_applications', type_='unique')
    op.drop_table('job_applications')
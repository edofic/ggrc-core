# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: andraz@reciprocitylabs.com
# Maintained By: andraz@reciprocitylabs.com

"""
add finished date to request and assessment

Create Date: 2016-03-14 14:03:38.026877
"""
# disable Invalid constant name pylint warning for mandatory Alembic variables.
# pylint: disable=invalid-name

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision = '4fd36860d196'
down_revision = '39aec99639d5'


def upgrade_table(table):
  """Add columns finished_date and verified_date and populate them."""
  op.add_column(table,
                sa.Column('finished_date', sa.DateTime(), nullable=True))
  op.add_column(table,
                sa.Column('verified_date', sa.DateTime(), nullable=True))
  op.execute("""
      UPDATE {}
      SET finished_date = updated_at
      WHERE status in ("Finished", "Verified", "Final")
  """.format(table))
  op.execute("""
      UPDATE {}
      SET verified_date = updated_at, status = "Final"
      WHERE status = "Verified"
  """.format(table))


def upgrade():
  upgrade_table('requests')
  upgrade_table('assessments')


def downgrade():
  """Remove verified_date and finished_date columns."""
  op.drop_column('assessments', 'verified_date')
  op.drop_column('assessments', 'finished_date')
  op.drop_column('requests', 'verified_date')
  op.drop_column('requests', 'finished_date')

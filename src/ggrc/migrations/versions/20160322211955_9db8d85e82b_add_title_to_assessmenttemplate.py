# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: peter@reciprocitylabs.com
# Maintained By: peter@reciprocitylabs.com

"""
Add title to AssessmentTemplate

Create Date: 2016-03-22 21:19:55.013833
"""
# disable Invalid constant name pylint warning for mandatory Alembic variables.
# pylint: disable=invalid-name

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision = '9db8d85e82b'
down_revision = '204540106539'


def upgrade():
  """Upgrade database schema and/or data, creating a new revision.

  The function adds the title column to the assessment_templates table.
  """
  op.add_column(
      "assessment_templates",
      sa.Column("title", sa.String(length=250), nullable=False, unique=False)
  )


def downgrade():
  """Downgrade database schema and/or data back to the previous revision.

  The function drops the assessment_template table's title column.
  """
  op.drop_column("assessment_templates", "title")

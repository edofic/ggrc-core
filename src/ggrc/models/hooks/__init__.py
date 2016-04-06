# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: ivan@reciprocitylabs.com
# Maintained By: ivan@reciprocitylabs.com

"""Import gGRC model hooks."""

from ggrc.models.hooks import assessment

ALL_HOOKS = [
  assessment
]

def init_hooks():
  for hook in ALL_HOOKS:
    hook.init_hook()

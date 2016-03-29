# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: andraz@reciprocitylabs.com
# Maintained By: andraz@reciprocitylabs.com

"""Check number of db queries per API request.

This is in converters because it depends on import to provide data
"""

import collections

from ggrc.models import all_models
from ggrc.utils import QueryCounter
from ggrc.views import all_object_views
from integration.ggrc_workflows.generator import WorkflowsGenerator

from integration.ggrc.converters import TestCase
from integration.ggrc.generator import ObjectGenerator


class TestComprehensiveSheets(TestCase):

  """
  test sheet from:
    https://docs.google.com/spreadsheets/d/1Jg8jum2eQfvR3kZNVYbVKizWIGZXvfqv3yQpo2rIiD8/edit#gid=0

  """

  # skip abstract models since they are not really first class
  WHITELIST = {"Directive", "SystemOrProcess"}
  MODELS = [getattr(all_models, model_name)
            for model_name in all_models.__all__
            if model_name not in WHITELIST]

  def setUp(self):
    TestCase.setUp(self)
    self.generator = ObjectGenerator()
    self.client.get("/login")

    self.create_custom_attributes()
    filename = "comprehensive_sheet1.csv"
    self.import_file(filename)

    gen = WorkflowsGenerator()
    wfs = all_models.Workflow.eager_query().filter_by(status='Draft').all()
    for workflow in wfs:
      _, cycle = gen.generate_cycle(workflow)
      self.assertIsNotNone(cycle)

  def tearDown(self):
    pass

  def test_queries_per_api_call(self):
    """Import comprehensive_sheet1 and count db requests per collection get.

    Query count should be <100 for all model types.
    """
    with QueryCounter() as counter:
      for model in self.MODELS:
        counter.queries = []
        self.generator.api.get_query(model, "")
        if counter.get > 100 or model.__name__ == "CycleTaskGroupObjectTask":
          print collections.Counter(counter.queries).most_common(1)
        self.assertLess(counter.get, 100,
                        "Query count for API GET " + model.__name__)

  def test_queries_per_object_page(self):
    """Import comprehensive_sheet1 and count db requests per collection get.

    Query count should be <100 for all model types.
    """
    with QueryCounter() as counter:
      for view in all_object_views():
        model = view.model_class
        if model not in self.MODELS:
          continue
        instance = model.query.first()
        if instance is None or getattr(instance, "id", None) is None:
          continue
        counter.queries = []
        res = self.client.get("/{}/{}".format(view.url, instance.id))
        self.assertEqual(res.status_code, 200)
        self.assertLess(counter.get, 100,
                        "Query count for object page " + model.__name__)

  def test_queries_for_dashboard(self):
    with QueryCounter() as counter:
      res = self.client.get("/permissions")
      self.assertEqual(res.status_code, 200)
      self.assertLess(counter.get, 100, "Query count for dashboard")

  def test_queries_for_permissions(self):
    with QueryCounter() as counter:
      res = self.client.get("/dashboard")
      self.assertEqual(res.status_code, 200)
      self.assertLess(counter.get, 100, "Query count for permissions")

  def create_custom_attributes(self):
    """Generate custom attributes needed by comprehensive_sheet1.csv."""
    gen = self.generator.generate_custom_attribute
    gen("control", title="my custom text", mandatory=True)
    gen("program", title="my_text", mandatory=True)
    gen("program", title="my_date", attribute_type="Date")
    gen("program", title="my_checkbox", attribute_type="Checkbox")
    gen("program", title="my_dropdown", attribute_type="Dropdown",
        options="a,b,c,d")

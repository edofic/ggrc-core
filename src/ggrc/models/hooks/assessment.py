# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: ivan@reciprocitylabs.com
# Maintained By: ivan@reciprocitylabs.com

"""
  Assessment generator hooks

  We are applying assessment template properties and make
  new relationships and custom attributes
"""

from ggrc import db
from ggrc.models import all_models
from ggrc.models import Assessment
from ggrc.models import Relationship
from ggrc.services.common import Resource

def init_hook():
  # pylint: disable=unused-variable
  @Resource.model_posted_after_commit.connect_via(Assessment)
  def handle_assessment_post(sender, obj=None, src=None, service=None):
    # pylint: disable=unused-argument
    """Apply custom attribute definitions and map people roles
    when generating Assessmet with template"""

    if not src.get("template", False):
      return

    related = {
        "template": get_by_id(src["template"]),
        "obj": get_by_id(src["object"]),
        "audit": get_by_id(src["audit"]),
    }

    relate_assignees(obj, related)
    relate_ca(obj, related)


def get_by_id(obj):
  """Get object instance by id"""
  model = get_model_query(obj["type"])
  return model.filter_by(id=obj["id"]).first()


def get_model_query(model_type):
  """Get model query"""
  model = getattr(all_models, model_type, None)
  return db.session.query(model)


def get_value(which, assessment, template, audit, obj):
  """Gets person value from string

      Args:
        which (string): type of people we are getting from template
        assessment (model instance): Assessment model
        template (model instance): Template related to Assessment
        audit (model instance): Audit related to Assessment
        obj (model instance): Object related to Assessment
            (it can be any object in our app ie. Control,Issue, Facility...)
  """
  types = {
      "Object Owners": [owner.person for owner in assessment.object_owners],
      "Audit Lead": audit.contact,
      "Object Contact": obj.contact,
      "Primary Contact": obj.contact,
      "Secondary Contact": obj.secondary_contact,
      "Primary Assessor": obj.principal_assessor,
      "Secondary Assessor": obj.secondary_assessor,
  }
  people = template.default_people[which]
  return types[people]


def assign_people(assignees, assignee_role, assessment, relationships):
  """Create a list of people with roles

      Args:
        assignees (list of model instances): List of people
        assignee_role (string): It can be either Assessor or Verifier
        assessment (model instance): Assessment model
        relationships (list): List relationships between assignees and
                              assessment with merged AssigneeType's
  """
  assignees = assignees if isinstance(assignees, list) else [assignees]
  for assignee in assignees:
    if not assignee:
      return

    rel = (val for val in relationships if val["source"] == assignee)
    rel = next(rel, None)
    if rel:
      values = rel["attrs"]["AssigneeType"].split(",")
      rel["attrs"]["AssigneeType"] = ",".join(set(values))
    else:
      relationships.append({
          "source": assignee,
          "destination": assessment,
          "context": assessment.context,
          "attrs": {
              "AssigneeType": assignee_role,
          },
      })


def relate_assignees(assessment, related):
  """Generates assignee list and relates them to Assessment objects

    Args:
        assessment (model instance): Assessment model
        related (dict): Dict containing model instances related to assessment
                        - template
                        - obj
                        - audit
  """
  people_types = {
      "assessors": "Assessor",
      "verifiers": "Verifier",
  }
  people_list = []

  for person_key, person_type in people_types.iteritems():
    assign_people(
        get_value(person_key, assessment, **related),
        person_type, assessment, people_list)
  for person in people_list:
    db.session.add(Relationship(**person))


def relate_ca(assessment, related):
  """Generates custom attribute list and relates it to Assessment objects

    Args:
        assessment (model instance): Assessment model
        related (dict): Dict containing model instances related to assessment
                        - template
                        - obj
                        - audit
  """
  ca_definitions = get_model_query("CustomAttributeDefinition").filter_by(
      definition_id=related["template"].id,
      definition_type="assessment_template"
  )

  for definition in ca_definitions:
    db.make_transient(definition)
    definition.id = None
    definition.definition_id = assessment.id
    definition.definition_type = assessment.__tablename__
    definition.title = "Definition for {}-{}".format(
        assessment.__tablename__, assessment.id)
    db.session.add(definition)

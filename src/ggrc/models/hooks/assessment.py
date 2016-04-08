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

    related = {
        "template": get_by_id(src.get("template", None)),
        "obj": get_by_id(src.get("object", None)),
        "audit": get_by_id(src.get("audit", None)),
    }
    relate_assignees(obj, related)
    relate_ca(obj, related)


def get_by_id(obj):
  """Get object instance by id"""
  if not obj:
    return

  model = get_model_query(obj["type"])
  return model.get(obj["id"])


def get_model_query(model_type):
  """Get model query"""
  model = getattr(all_models, model_type, None)
  return db.session.query(model)


def get_value(which, audit, obj, template=None):
  """Gets person value from string

      Args:
        which (string): type of people we are getting from template
        template (model instance): Template related to Assessment
        audit (model instance): Audit related to Assessment
        obj (model instance): Object related to Assessment
            (it can be any object in our app ie. Control,Issue, Facility...)
  """
  if not template:
    return

  types = {
      "Object Owners": [owner.person
        for owner in getattr(obj, 'object_owners', None)],
      "Audit Lead": getattr(audit, 'contact', None),
      "Object Contact": getattr(obj, 'contact', None),
      "Primary Contact": getattr(obj, 'contact', None),
      "Secondary Contact": getattr(obj, 'secondary_contact', None),
      "Primary Assessor": getattr(obj, 'principal_assessor', None),
      "Secondary Assessor": getattr(obj, 'secondary_assessor', None),
  }
  people = template.default_people.get(which, None)
  if not people:
    return

  if isinstance(people, list):
    return [get_by_id({
        'type': 'Person',
        'id': person_id
    }) for person_id in people]
  return types.get(people, None)


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
  assignees = [assignee for assignee in assignees if assignee is not None]

  if not len(assignees) and assignee_role != "Verifier":
    assignees.append(assessment.modified_by)

  for assignee in assignees:
    rel = (val for val in relationships if val["source"] == assignee)
    rel = next(rel, None)
    if rel:
      values = rel["attrs"]["AssigneeType"].split(",")
      values.append(assignee_role)
      rel["attrs"]["AssigneeType"] = ",".join(set(values))
    else:
      relationships.append(
        get_relationship_dict(assignee, assessment, assignee_role))

def get_relationship_dict(source, destination, role):
  return {
      "source": source,
      "destination": destination,
      "context": destination.context,
      "attrs": {
          "AssigneeType": role,
      },
  }


def relate_assignees(assessment, related):
  """Generates assignee list and relates them to Assessment objects

    Args:
        assessment (model instance): Assessment model
        related (dict): Dict containing model instances related to assessment
                        - obj
                        - audit
  """
  people_types = {
      "assessors": "Assessor",
      "verifiers": "Verifier",
      "creator": "Creator",
  }
  people_list = []

  for person_key, person_type in people_types.iteritems():
    assign_people(
        get_value(person_key, **related),
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
  if not related["template"]:
    return

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

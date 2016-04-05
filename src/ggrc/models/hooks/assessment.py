# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: ivan@reciprocitylabs.com
# Maintained By: ivan@reciprocitylabs.com

from ggrc import db
from ggrc.models import all_models
from ggrc.models.assessment import Assessment
from ggrc.models.relationship import Relationship
from ggrc.services.common import Resource


def get_by_id(obj):
  """Get model by id"""
  model = get_model(obj['type'])

  return model.filter_by(id=obj['id']).first()


def get_model(model_type):
  """Get model from all models"""
  model = getattr(all_models, model_type, None)
  return db.session.query(model)


def get_value(which, assessment, template=None, audit=None, obj=None):
  """Gets person value from string"""
  types = {
      'Object Owners': [owner.person for owner in assessment.object_owners],
      'Audit Lead': audit.contact,
      'Object Contact': obj.contact,
      'Primary Contact': obj.contact,
      'Secondary Contact': obj.secondary_contact,
      'Primary Assessor': obj.principal_assessor,
      'Secondary Assessor': obj.secondary_assessor,
  }
  people = template.default_people[which]
  return types[people]


def assign_people(people, person_type, assessment, relationships):
  """Create a list of people with roles"""
  people = people if isinstance(people, list) else [people]
  for person in people:
    rel = (val for val in relationships if val['source'] == person)
    rel = next(rel, None)
    if rel:
      rel['attrs']['AssigneeType'] += (',' + person_type)
    else:
      relationships.append({
          'source': person,
          'destination': assessment,
          'context': assessment.context,
          'attrs': {
              'AssigneeType': person_type,
          },
      })


def relate_people(assessment, related):
  """Make relationship between a list of people and assessment"""
  people_types = {
      'assessors': 'Assessor',
      'verifiers': 'Verifier',
  }
  people_list = []

  for person_key, person_type in people_types.iteritems():
    assign_people(
        get_value(person_key, assessment, **related),
        person_type, assessment, people_list
        )
  for person in people_list:
    db.session.add(Relationship(**person))


def relate_ca(assessment, related):
  """Create custom attributes for assessment"""
  ca_definitions = get_model('CustomAttributeDefinition').filter_by(
      definition_id=related['template'].id,
      definition_type='assessment_template'
  ).all()

  for definition in ca_definitions:
    db.make_transient(definition)
    definition.id = None
    definition.definition_id = assessment.id
    definition.definition_type = assessment.__tablename__
    definition.title = 'Definition for {}-{}'.format(
        assessment.__tablename__, assessment.id)
    db.session.add(definition)


# pylint: disable=unused-variable
@Resource.model_posted_after_commit.connect_via(Assessment)
def handle_assessment_post(sender, obj=None, src=None, service=None):
  """Apply custom attribute definitions and map people roles
  when generating Assessmet with template"""

  if not src['template']:
    return

  related = {
      'template': get_by_id(src['template']),
      'obj': get_by_id(src['object']),
      'audit': get_by_id(src['audit']),
  }

  relate_people(obj, related)
  relate_ca(obj, related)

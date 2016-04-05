# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: anze@reciprocitylabs.com
# Maintained By: anze@reciprocitylabs.com

from sqlalchemy.orm import validates

from ggrc import db
from ggrc.models import reflection
from ggrc.models.mixins_assignable import Assignable
from ggrc.models.mixins import BusinessObject
from ggrc.models.mixins import CustomAttributable
from ggrc.models.mixins import deferred
from ggrc.models.mixins import TestPlanned
from ggrc.models.mixins import Timeboxed
from ggrc.models.object_document import Documentable
from ggrc.models.object_owner import Ownable
from ggrc.models.object_person import Personable
from ggrc.models.reflection import PublishOnly
from ggrc.models.relationship import Relatable
from ggrc.models.track_object_state import HasObjectState
from ggrc.models.track_object_state import track_state_for_class
from ggrc.services.common import Resource


class Assessment(Assignable, HasObjectState, TestPlanned, CustomAttributable,
                 Documentable, Personable, Timeboxed, Ownable,
                 Relatable, BusinessObject, db.Model):
  __tablename__ = 'assessments'

  VALID_STATES = (u"Open", u"In Progress", u"Finished", u"Verified", u"Final")
  ASSIGNEE_TYPES = (u"Creator", u"Assessor", u"Verifier")

  status = deferred(db.Column(db.Enum(*VALID_STATES), nullable=False,
                    default=VALID_STATES[0]), "Assessment")

  design = deferred(db.Column(db.String), "Assessment")
  operationally = deferred(db.Column(db.String), "Assessment")

  object = {}  # we add this for the sake of client side error checking
  audit = {}

  VALID_CONCLUSIONS = frozenset([
      "Effective",
      "Ineffective",
      "Needs improvement",
      "Not Applicable"
  ])

  # REST properties
  _publish_attrs = [
      'design',
      'operationally',
      PublishOnly('audit'),
      PublishOnly('object')
  ]

  _aliases = {
      "audit": {
          "display_name": "Audit",
          "mandatory": True,
      },
      "url": "Assessment URL",
      "design": "Conclusion: Design",
      "operationally": "Conclusion: Operation",
      "related_creators": {
          "display_name": "Creator",
          "mandatory": True,
          "filter_by": "_filter_by_related_creators",
          "type": reflection.AttributeInfo.Type.MAPPING,
      },
      "related_assessors": {
          "display_name": "Assessor",
          "mandatory": True,
          "filter_by": "_filter_by_related_assessors",
          "type": reflection.AttributeInfo.Type.MAPPING,
      },
      "related_verifiers": {
          "display_name": "Verifier",
          "filter_by": "_filter_by_related_verifiers",
          "type": reflection.AttributeInfo.Type.MAPPING,
      },
  }

  def validate_conclusion(self, value):
    return value if value in self.VALID_CONCLUSIONS else ""

  @validates("operationally")
  def validate_opperationally(self, key, value):
    return self.validate_conclusion(value)

  @validates("design")
  def validate_design(self, key, value):
    return self.validate_conclusion(value)

  @classmethod
  def _filter_by_related_creators(cls, predicate):
    return cls._get_relate_filter(predicate, "Creator")

  @classmethod
  def _filter_by_related_assessors(cls, predicate):
    return cls._get_relate_filter(predicate, "Assessor")

  @classmethod
  def _filter_by_related_verifiers(cls, predicate):
    return cls._get_relate_filter(predicate, "Verifier")

track_state_for_class(Assessment)


# pylint: disable=unused-variable
@Resource.model_posted_after_commit.connect_via(Assessment)
def handle_assessment_post(sender, assessment=None, src=None):
  """Apply Custom Attribute Definitions and map people as
  Verifiers and Assessors when generating Assessmet with template"""
  from ggrc.models import all_models

  if not src['template']:
    return

  def get_by_id(obj):
    model = get_model(obj['type'])
    return model.filter_by(id=obj['id']).first()

  def get_model(model_type):
    model = getattr(all_models, model_type, None)
    return db.session.query(model)

  def get_value(obj):
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
    return template.default_people[obj]

  def assign_people(people, user_type, relationships):
    people = people if isinstance(people, list) else [people]
    for person in people:
      rel = (val for val in relationships if val['source'] == person)
      rel = next(rel, None)
      if rel:
        rel['attrs']['AssigneeType'] += (',' + user_type)
      else:
        relationships.append({
            'source': person,
            'destination': assessment,
            'context': assessment.context,
            'attrs': {
                'AssigneeType': user_type,
            },
        })

  template = get_by_id(src['template'])
  obj = get_by_id(src['object'])
  audit = get_by_id(src['audit'])
  people_list = []
  ca_definitions = get_model('CustomAttributeDefinition').filter_by(
      definition_id=template.id,
      definition_type='assessment_template'
  ).all()

  assign_people(get_value('assessors'), 'Assessor', people_list)
  assign_people(get_value('verifiers'), 'Verifier', people_list)

  for person in people_list:
    db.session.add(all_models.Relationship(**person))

  for definition in ca_definitions:
    db.make_transient(definition)
    definition.id = None
    definition.definition_id = obj.id
    definition.definition_type = obj.__tablename__
    definition.title = 'Definition for {}-{}'.format(
        obj.__tablename__, obj.id)
    db.session.add(definition)

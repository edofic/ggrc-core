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
from ggrc.models.assessment_template import AssessmentTemplate


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

@Resource.model_posted_after_commit.connect_via(Assessment)
def handle_assessment_post(sender, obj=None, src=None, service=None):
  from ggrc.models import all_models

  if not src['template']:
    return

  def get_by_id(obj):
    model = get_model(obj['type'])
    return model.filter_by(id=obj['id']).first()

  def get_model(model_type):
    model = getattr(all_models, model_type, None)
    return db.session.query(model)

  def get_object_owners(obj):
    return [owner.person for owner in obj.object_owners]

  def get_value(obj):
    type_val = types[obj]
    return type_val() if callable(type_val) else type_val

  def assign_people(people, user_type):
    people = people if isinstance(people, list) else [people]
    for person in people:
      rel = filter(lambda rel: rel['source'] == person, people_list)
      if rel:
        rel = rel[0]
        rel['attrs']['AssigneeType'] += (',' + user_type)
      else:
        rel = {
          'source': person,
          'destination': obj,
          'context': obj.context,
          'attrs': {
            'AssigneeType': user_type,
          },
        }
        people_list.append(rel)

  relationship = getattr(all_models, 'Relationship', None)
  template = get_by_id(src['template'])
  src_obj = get_by_id(src['object'])
  audit = get_by_id(src['audit'])
  people = template.default_people
  people_list = []
  ca_definitions = get_model('CustomAttributeDefinition').filter_by(
      definition_id=template.id,
      definition_type='assessment_template'
    ).all()
  types = {
    'Object Owners': get_object_owners(src_obj),
    'Audit Lead': audit.contact,
    'Object Contact': src_obj.contact,
    'Primary Contact': src_obj.contact,
    'Secondary Contact': src_obj.secondary_contact,
    'Primary Assessor': src_obj.principal_assessor,
    'Secondary Assessor': src_obj.secondary_assessor,
  }

  assign_people(get_value(people['assessors']), 'Assessor')
  assign_people(get_value(people['verifiers']), 'Verifier')

  for person in people_list:
    rel = relationship(**person)
    db.session.add(rel)

  for definition in ca_definitions:
    definition.id = None
    definition.definition_id = obj.id
    definition.definition_type = obj.__tablename__
    db.session.add(definition)

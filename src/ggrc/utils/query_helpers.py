# Copyright (C) 2016 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""This module helper query builder for my dashboard page."""
from sqlalchemy import and_
from sqlalchemy import case
from sqlalchemy import literal
from sqlalchemy import or_
from sqlalchemy import true
from sqlalchemy import union
from sqlalchemy import alias
from ggrc import db
from ggrc.models import all_models
from ggrc.models.object_person import ObjectPerson
from ggrc.models.object_owner import ObjectOwner
from ggrc.models.relationship import Relationship
from ggrc.models.custom_attribute_value import CustomAttributeValue
from ggrc.rbac import permissions as pr
from ggrc_basic_permissions import backlog_workflows
from ggrc_basic_permissions.models import UserRole
from ggrc_workflows.models import Cycle


def get_type_select_column(model):
  """Get column name,taking into account polymorphic types."""
  mapper = model._sa_class_manager.mapper
  if mapper.polymorphic_on is None:
    type_column = literal(mapper.class_.__name__)
  else:
    # Handle polymorphic types with CASE
    type_column = case(
        value=mapper.polymorphic_on,
        whens={
            val: m.class_.__name__
            for val, m in mapper.polymorphic_map.items()
        })
  return type_column


def _types_to_type_models(types):
  """Convert string types to real objects."""
  if types is None:
    return all_models.all_models
  return [m for m in all_models.all_models if m.__name__ in types]


def get_myobjects_query(types=None, contact_id=None, is_creator=False):  # noqa
  """Filters by "myview" for a given person.

  Finds all objects which might appear on a user's Profile or Dashboard
  pages.

  This method only *limits* the result set -- Contexts and Roles will still
  filter out forbidden objects.
  """
  type_models = _types_to_type_models(types)
  model_names = [model.__name__ for model in type_models]
  type_union_queries = []

  def _get_people():
    """Get all the people w/o any restrictions."""
    all_people = db.session.query(
        all_models.Person.id.label('id'),
        literal(all_models.Person.__name__).label('type'),
        literal(None).label('context_id')
    )
    return all_people

  def _get_object_people():
    """Objects to which the user is 'mapped'."""
    object_people_query = db.session.query(
        ObjectPerson.personable_id.label('id'),
        ObjectPerson.personable_type.label('type'),
        literal(None).label('context_id')
    ).filter(
        and_(
            ObjectPerson.person_id == contact_id,
            ObjectPerson.personable_type.in_(model_names)
        )
    )
    return object_people_query

  def _get_object_owners():
    """Objects for which the user is an 'owner'."""
    object_owners_query = db.session.query(
        ObjectOwner.ownable_id.label('id'),
        ObjectOwner.ownable_type.label('type'),
        literal(None).label('context_id')
    ).filter(
        and_(
            ObjectOwner.person_id == contact_id,
            ObjectOwner.ownable_type.in_(model_names),
        )
    )
    return object_owners_query

  def _get_object_mapped_ca():
    """Objects to which the user is mapped via a custom attribute."""
    ca_mapped_objects_query = db.session.query(
        CustomAttributeValue.attributable_id.label('id'),
        CustomAttributeValue.attributable_type.label('type'),
        literal(None).label('context_id')
    ).filter(
        and_(
            CustomAttributeValue.attribute_value == "Person",
            CustomAttributeValue.attribute_object_id == contact_id,
            CustomAttributeValue.attributable_type.in_(model_names)
        )
    )
    return ca_mapped_objects_query

  def _get_objects_user_assigned():
    """Objects for which the user is assigned."""
    dst_assignee_query = db.session.query(
        Relationship.destination_id.label('id'),
        Relationship.destination_type.label('type'),
        literal(None).label('context_id'),
    ).filter(
        and_(
            Relationship.source_type == "Person",
            Relationship.source_id == contact_id,
            Relationship.destination_type.in_(model_names)
        ),
    )
    src_assignee_query = db.session.query(
        Relationship.source_id.label('id'),
        Relationship.source_type.label('type'),
        literal(None).label('context_id'),
    ).filter(
        and_(
            Relationship.destination_type == "Person",
            Relationship.destination_id == contact_id,
            Relationship.source_type.in_(model_names)
        ),
    )
    return dst_assignee_query.union(src_assignee_query)

  def _get_results_by_context(model):
    """Objects based on the context of the current model.

    Return the objects that are in private contexts via UserRole.
    """
    context_query = db.session.query(
        model.id.label('id'),
        literal(model.__name__).label('type'),
        literal(None).label('context_id'),
    ).join(
        UserRole,
        and_(
            UserRole.context_id == model.context_id,
            UserRole.person_id == contact_id,
        )
    )
    return context_query

  def _get_assigned_to_records(model):
    """Get query by models contacts fields.

    Objects for which the user is the 'contact' or 'secondary contact'.
    Control also has 'principal_assessor' and 'secondary_assessor'.
    """
    model_type_queries = []
    for attr in ('contact_id', 'secondary_contact_id',
                 'principal_assessor_id', 'secondary_assessor_id'):
      if hasattr(model, attr):
        model_type_queries.append(getattr(model, attr) == contact_id)
    return model_type_queries

  def _get_tasks_in_cycle(model):
    """Filter tasks with particular statuses and cycle.

    Filtering tasks with statuses "Assigned", "InProgress" and "Finished".
    Where the task is in current users cycle.
    """
    task_query = db.session.query(
        model.id.label('id'),
        literal(model.__name__).label('type'),
        literal(None).label('context_id'),
    ).join(Cycle, Cycle.id == model.cycle_id).filter(
        and_(
            Cycle.is_current == true(),
            model.contact_id == contact_id,
            model.status.in_(
                all_models.CycleTaskGroupObjectTask.ACTIVE_STATES
            )
        )
    )
    return task_query

  def _get_model_specific_query(model):
    """Prepare query specific for a particular model."""
    model_type_query = None
    if model is all_models.CycleTaskGroupObjectTask:
      model_type_query = _get_tasks_in_cycle(model)
    else:
      model_type_queries = _get_assigned_to_records(model)
      if model_type_queries:
        type_column = get_type_select_column(model)
        model_type_query = db.session.query(
            model.id.label('id'),
            type_column.label('type'),
            literal(None).label('context_id')
        ).filter(or_(*model_type_queries)).distinct()
    return model_type_query

  # Note: We don't return mapped objects for the Creator because being mapped
  # does not give the Creator necessary permissions to view the object.
  if not is_creator:
    type_union_queries.append(_get_object_people())
  type_union_queries.extend((_get_object_owners(),
                            _get_object_mapped_ca(),
                            _get_objects_user_assigned()))

  for model in type_models:
    query = _get_model_specific_query(model)
    if query:
      type_union_queries.append(query)

    if model is all_models.Workflow:
      type_union_queries.append(backlog_workflows())
    if model is all_models.Person:
      type_union_queries.append(_get_people())
    if model in (all_models.Program, all_models.Audit, all_models.Workflow):
      type_union_queries.append(_get_results_by_context(model))

  return alias(union(*type_union_queries))


def get_context_resource(model_name, permission_type='read',
                         permission_model=None):
  """Get allowed contexts and resources."""
  permissions_map = {
      "create": (pr.create_contexts_for, pr.create_resources_for),
      "read": (pr.read_contexts_for, pr.read_resources_for),
      "update": (pr.update_contexts_for, pr.update_resources_for),
      "delete": (pr.delete_contexts_for, pr.delete_resources_for),
  }

  contexts = permissions_map[permission_type][0](
      permission_model or model_name)
  resources = permissions_map[permission_type][1](
      permission_model or model_name)

  if permission_model and contexts:
    contexts = set(contexts) & set(
        pr.read_contexts_for(model_name))

  return contexts, resources

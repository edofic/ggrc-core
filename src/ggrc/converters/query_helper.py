# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from sqlalchemy import and_
from sqlalchemy import not_
from sqlalchemy import or_

from ggrc.models.reflection import AttributeInfo
from ggrc.models.relationship_helper import RelationshipHelper
from ggrc.converters import get_importables


class QueryHelper(object):

  """ Helper class for handling request queries

  Primary use for this class is to get list of object ids for each object
  defined in the query. All object ids must pass the query filters if they
  are defined.

  query object = [
    {
      object_name: search class name,
      filters: {
        relevant_filters:
          these filters will return all ids of the "search class name" object
          that are mapped to objects defined in the dictionary insde the list.
          [ list of filters joined by OR expression
            [ list of filters joined by AND expression
              {
                "object_name": class of relevant object,
                "slugs": list of relevant object slugs,
                        optional and if exists will be converted into ids
                "ids": list of relevant object ids
              }
            ]
          ],
        object_filters: {
          TODO: allow filtering by title, description and other object fields
        }
      }
    }
  ]
  """

  def __init__(self, query):
    importable = get_importables()
    self.object_map = {o.__name__: o for o in importable.values()}
    self.query = self.clean_query(query)
    self.set_attr_name_map()

  def set_attr_name_map(self):
    """ build a map for attributes names and display names

    Dict containing all display_name to attr_name mappings
    for all objects used in the current query
    Example:
        { Program: {"Program URL": "url", "Code": "slug", ...} ...}
    """
    self.attr_name_map = {}
    for object_query in self.query:
      object_name = object_query["object_name"]
      object_class = self.object_map[object_name]
      aliases = AttributeInfo.gather_aliases(object_class)
      self.attr_name_map[object_class] = {}
      for key, value in aliases.items():
        if type(value) is dict:
          value = value["display_name"]
        if value:
          self.attr_name_map[object_class][value.lower()] = key.lower()

  def clean_query(self, query):
    """ sanitize the query object """
    for object_query in query:
      filters = object_query.get("filters", {}).get("expression")
      self.clean_filters(filters)
    return query

  def clean_filters(self, expression):
    """ prepair the filter expression for building the query """
    if not expression or type(expression) != dict:
      return
    slugs = expression.get("slugs")
    if slugs:
      ids = expression.get("ids", [])
      ids.extend(self.slugs_to_ids(expression["object_name"], slugs))
      expression["ids"] = ids
    expression["ids"] = map(int, expression.get("ids", []))
    self.clean_filters(expression.get("left"))
    self.clean_filters(expression.get("right"))

  def get_ids(self):
    """ get list of objects and their ids according to the query

    Returns:
      list of dicts: same query as the input with all ids that match the filter
    """
    for object_query in self.query:
      object_query["ids"] = self.get_object_ids(object_query)
    return self.query

  def _get_attr(self, object_class, key):
    """ get class attr by attribute name or display name """
    attr = getattr(object_class, key.lower(), None)
    if attr is None:
      mapped_name = self.attr_name_map[object_class][key.lower()]
      attr = getattr(object_class, mapped_name, None)
    if attr is None:
      raise Exception("Bad search query: object '{}' does not have "
                      "attribute '{}'.".format(object_class.__name__, key))
    return attr

  def get_object_ids(self, object_query):
    """ get a set of object ids describideb in the filters """
    object_name = object_query["object_name"]
    expression = object_query.get("filters", {}).get("expression")

    if expression is None:
      return set()
    object_class = self.object_map[object_name]

    def build_expression(exp):
      if "op" not in exp:
        return None
      if exp["op"]["name"] == "AND":
        return and_(build_expression(exp["left"]),
                    build_expression(exp["right"]))
      elif exp["op"]["name"] == "OR":
        return or_(build_expression(exp["left"]),
                   build_expression(exp["right"]))
      elif exp["op"]["name"] == "=":
        return self._get_attr(object_class, exp["left"]) == exp["right"]
      elif exp["op"]["name"] == "!=":
        return self._get_attr(object_class, exp["left"]) != exp["right"]
      elif exp["op"]["name"] == "~":
        return self._get_attr(object_class, exp["left"]).ilike(
            "%{}%".format(exp["right"]))
      elif exp["op"]["name"] == "!~":
        return not_(self._get_attr(object_class, exp["left"]).ilike(
            "%{}%".format(exp["right"])))
      elif exp["op"]["name"] == "relevant":
        if exp["object_name"] == "__previous__":
          query = self.query[exp["ids"][0]]
          return object_class.id.in_(
              RelationshipHelper.get_ids_related_to(
                  object_name,
                  query["object_name"],
                  query["ids"],
              )
          )
        else:
          return object_class.id.in_(
              RelationshipHelper.get_ids_related_to(
                  object_name,
                  exp["object_name"],
                  exp["ids"],
              )
          )
      elif exp["op"]["name"] == "text_search":
        text_exp = None
        for field in object_query.get("fields", []):
          if not hasattr(object_class, field):
            continue
          text_exp = or_(text_exp, getattr(object_class, field)
                         .ilike("%{}%".format(exp["text"])))
        return text_exp

      return None

    filter_expression = build_expression(expression)
    if filter_expression is None:
      objects = object_class.query.all()
    else:
      objects = object_class.query.filter(filter_expression).all()
    object_ids = [o.id for o in objects]
    return object_ids

  def slugs_to_ids(self, object_name, slugs):
    object_class = self.object_map.get(object_name)
    if not object_class:
      return []
    ids = [c.id for c in object_class.query.filter(
        object_class.slug.in_(slugs)).all()]
    return ids

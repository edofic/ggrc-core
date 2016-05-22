# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: david@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

import datetime
import json
import re
import sqlalchemy
import sys
import time

from flask import current_app, request
from settings import CUSTOM_URL_ROOT

import ggrc

class GrcEncoder(json.JSONEncoder):

  """Custom JSON Encoder to handle datetime objects and sets

  from:
     `http://stackoverflow.com/questions/12122007/python-json-encoder-to-support-datetime`_
  also consider:
     `http://hg.tryton.org/2.4/trytond/file/ade5432ac476/trytond/protocols/jsonrpc.py#l53`_
  """

  def default(self, obj):
    if isinstance(obj, datetime.datetime):
      return obj.isoformat()
    elif isinstance(obj, datetime.date):
      return obj.isoformat()
    elif isinstance(obj, datetime.timedelta):
      return (datetime.datetime.min + obj).time().isoformat()
    elif isinstance(obj, set):
      return list(obj)
    else:
      return super(GrcEncoder, self).default(obj)


class UnicodeSafeJsonWrapper(dict):

  """JSON received via POST has keys as unicode. This makes get work with plain
  `str` keys.
  """

  def __getitem__(self, key):
    ret = self.get(key)
    if ret is None:
      raise KeyError(key)
    return ret

  def get(self, key, default=None):
    return super(UnicodeSafeJsonWrapper, self).get(unicode(key), default)  # noqa


def as_json(obj, **kwargs):
  return json.dumps(obj, cls=GrcEncoder, **kwargs)


def service_for(obj):
  module = sys.modules['ggrc.services']
  if type(obj) is str or type(obj) is unicode:  # noqa
    model_type = obj
  else:
    model_type = obj.__class__.__name__
  return getattr(module, model_type, None)


def url_for(obj, id=None):
  service = service_for(obj)
  if service is None:
    return None
  if not hasattr(service, 'url_for'):
    return None
  if id is not None:
    return service.url_for(id=id)
  return service.url_for(obj)


def view_service_for(obj):
  module = sys.modules['ggrc.views']
  if type(obj) is str or type(obj) is unicode:  # noqa
    model_type = obj
  else:
    model_type = obj.__class__.__name__
  return getattr(module, model_type, None)


def view_url_for(obj, id=None):
  service = view_service_for(obj)
  if service is None:
    return None
  if not hasattr(service, 'url_for'):
    return None
  if id is not None:
    return service.url_for(id=id)
  return service.url_for(obj)


def encoded_dict(in_dict):
  # http://stackoverflow.com/questions/6480723/urllib-urlencode-doesnt-like-unicode-values-how-about-this-workaround
  out_dict = {}
  for k, v in in_dict.iteritems():
    if isinstance(v, unicode):  # noqa
      v = v.encode('utf8')
    elif isinstance(v, str):
      # Must be encoded in UTF-8
      v.decode('utf8')
    out_dict[k] = v
  return out_dict


def merge_dict(destination, source, path=None):
  """merges source into destination"""
  if path is None:
    path = []
  for key in source:
    if key in destination:
      if isinstance(destination[key], dict) and isinstance(source[key], dict):
        merge_dict(destination[key], source[key], path + [str(key)])
      elif destination[key] == source[key]:
        pass  # same leaf value
      else:
        raise Exception('Conflict at %s' % '.'.join(path + [str(key)]))
    else:
      destination[key] = source[key]
  return destination


def merge_dicts(*args):
  result = {}
  for arg in args:
    result = merge_dict(result, arg)
  return result


def get_url_root():
  if CUSTOM_URL_ROOT is not None:
    return CUSTOM_URL_ROOT
  return request.url_root


def get_mapping_rules():
  """ Get mappings rules as defined in business_object.js

  Special cases:
    Aduit has direct mapping to Program with program_id
    Request has a direct mapping to Audit with audit_id
    Section has a direct mapping to Standard/Regulation/Poicy with directive_id
    Anything can be mapped to a request, frotent show audit insted

  """

  def filter(object_list):
    """ remove all lower case items since real object are CamelCase """
    return set([item for item in object_list if item != item.lower()])

  # these rules are copy pasted from
  # src/ggrc/assets/javascripts/apps/base_widgets.js line: 9
  # WARNING ########################################################
  # Manually added Risks and threats to the list from base_widgets #
  ##################################################################
  # TODO: Read these rules from different modules and combine them here.
  business_object_rules = {
      "AccessGroup": "Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Audit": "AccessGroup Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor",  # noqa
      # "AssessmentTemplate": "Audit", # Uncomment this line when we add support for assessment templates in exports # noqa
      "Clause": "AccessGroup Audit Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Contract": "AccessGroup Audit Clause Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Process Product Program Project Request Section System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Control": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Assessment": "AccessGroup Audit Clause Contract Control DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "DataAsset": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Facility": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Issue": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Market": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Objective": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "OrgGroup": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Person": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Policy Process Product Program Project Regulation Request Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Policy": "AccessGroup Audit Clause Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Process Product Program Project Request Section System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Process": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Product": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Program": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Project": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Regulation": "AccessGroup Audit Clause Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Process Product Program Project Request Section System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Request": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Section": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Standard": "AccessGroup Audit Clause Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Process Product Program Project Request Section System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "System": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Vendor": "AccessGroup Audit Clause Contract Control Assessment DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat CycleTaskGroupObjectTask",  # noqa
      "Risk": "AccessGroup Clause Contract Assessment Control DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Threat CycleTaskGroupObjectTask",  # noqa
      "Threat": "AccessGroup Clause Contract Assessment Control DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk CycleTaskGroupObjectTask",  # noqa
      "CycleTaskGroupObjectTask": "AccessGroup Clause Contract Assessment Control DataAsset Facility Issue Market Objective OrgGroup Person Policy Process Product Program Project Regulation Request Section Standard System Vendor Risk Threat",  # noqa
  }

  split_rules = {k: v.split() for k, v in business_object_rules.items()}
  filtered_rules = {k: filter(v) for k, v in split_rules.items()}
  return filtered_rules


def _prefix_camelcase(name, prefix):
  name = name[:1].lower() + name[1:]
  return re.sub(r'[A-Z]', lambda pat: prefix + pat.group(0).lower(), name)


def underscore_from_camelcase(name):
  return _prefix_camelcase(name, "_")


def title_from_camelcase(name):
  return _prefix_camelcase(name, " ")


def get_fuzzy_date(delta_date):
  """Get a human readable date string.

  This function returns a human friendly time delta compared to today.

  Args:
    delta_date (date): Date that we want to show to the user.

  Returns:
    string: A human readable representation date delta.

  Examples:
    >>> get_fuzzy_date(datetime.date.today() + datetime.timedelta(2))
    'in 2 days'
    >>> get_fuzzy_date(datetime.date.today())
    'today'
    >>> get_fuzzy_date(datetime.date.today() + datetime.timedelta(-1))
    '1 day ago'
  """
  if not delta_date:
    return ""
  if isinstance(delta_date, datetime.datetime):
    delta_date = delta_date.date()
  delta = delta_date - datetime.date.today()
  if delta.days < 0:
    days = abs(delta.days)
    return "{} day{} ago".format(days, "s" if days > 1 else "")
  if delta.days == 0:
    return "today"
  # TODO: use format_timedelta from babel package.
  return "in {} day{}".format(delta.days, "s" if delta.days > 1 else "")


# pylint: disable=too-few-public-methods
# because this is a small context manager
class QueryCounter(object):
  """Context manager for counting sqlalchemy database queries.

  Usage:
    with QueryCounter() as counter:
      query_count = counter.get
  """

  def __init__(self):
    self.queries = []

    def after_cursor_execute(*args):
      self.queries.append(args[2])

    self.listener = after_cursor_execute

  def __enter__(self):
    sqlalchemy.event.listen(sqlalchemy.engine.Engine,
                            "after_cursor_execute",
                            self.listener)
    return self

  def __exit__(self, *_):
    sqlalchemy.event.remove(sqlalchemy.engine.Engine,
                            "after_cursor_execute",
                            self.listener)

  @property
  def get(self):
    return len(self.queries)


class Transaction(object):

  class Proxy(object):

    def __init__(self, tr, session):
      self.tr = tr
      self.session = session
      self.current = self.session.begin_nested()

    def commit(self, *args, **kwargs):
      try:
        self.current.commit(*args, **kwargs)
      finally:
        self.current = self.session.begin_nested()

    def rollback(self, *args, **kwargs):
      try:
        self.current.rollback(*args, **kwargs)
      finally:
        self.current = self.session.begin_nested()

    def __getattr__(self, attr):
      return getattr(self.session, attr)

    def __call__(self, *args, **kwargs):
      return self.session.__call__(*args, **kwargs)

  def __enter__(self):
    self.parent = ggrc.db.session
    self.tr = self.parent.begin_nested()
    proxy = self.Proxy(self.tr, self.parent)
    ggrc.db.session = proxy
    return proxy

  def __exit__(self, exc_type, exc_value, exc_trace):
    if exc_type is None:
      self.tr.commit()
    else:
      self.tr.rollback()
    ggrc.db.session = self.parent


class BenchmarkContextManager(object):

  def __init__(self, message):
    self.message = message

  def __enter__(self):
    self.start = time.time()

  def __exit__(self, exc_type, exc_value, exc_trace):
    end = time.time()
    current_app.logger.info("{:.4f} {}".format(end - self.start, self.message))


class WithNop(object):

  def __init__(self, message):
    pass

  def __enter__(self):
    pass

  def __exit__(self, exc_type, exc_value, exc_trace):
    pass


benchmark = BenchmarkContextManager
with_nop = WithNop

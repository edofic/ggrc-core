# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: david@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

import datetime
import re
import json
import sys
import time
from flask import current_app, request
from settings import custom_url_root


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
  if custom_url_root is not None:
    return custom_url_root
  return request.url_root


def get_mapping_rules():
  """ Get mappings rules as defined in business_object.js

  Special cases:
    Aduit has direct mapping to Program with program_id
    Request has a direct mapping to Audit with audit_id
    Response has a direct mapping to Request with request_id
    DocumentationResponse has a direct mapping to Request with request_id
    DocumentationResponse has normal mappings with all other objects in
    maping modal
    Section has a direct mapping to Standard/Regulation/Poicy with directive_id
    Anything can be mapped to a request, frotent show audit insted

  """

  def filter(object_list):
    """ remove all lower case items since real object are CamelCase """
    return set([item for item in object_list if item != item.lower()])

  # these rules are copy pasted from
  # src/ggrc/assets/javascripts/apps/business_objects.js line: 276
  business_object_rules = {
    "Program": "Issue ControlAssessment Regulation Contract Policy Standard Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Audit",  # noqa # removed Person because Programs have a "Mapped" attribute for people mappings
    "Audit": "Issue ControlAssessment Request history Person program program_controls",  # noqa
    "Issue": "ControlAssessment Control Audit Program Regulation Contract Policy Standard Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Issue",  # noqa
    "ControlAssessment": "Issue Objective Program Regulation Contract Policy Standard Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Regulation" : "Program Issue ControlAssessment Section Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Policy" : "Program Issue ControlAssessment Section Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Standard" : "Program Issue ControlAssessment Section Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Contract" : "Program Issue ControlAssessment Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Clause" : "Contract Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Section" : "Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Objective" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person",  # noqa
    "Control" : "Issue ControlAssessment Request Program Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Person" : "Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Audit",  # noqa
    "OrgGroup" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Vendor" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "System" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Process" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "DataAsset" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Product" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Project" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Facility" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit",  # noqa
    "Market" : "Program Issue ControlAssessment Regulation Contract Policy Standard Section Clause Objective Control System Process DataAsset Product Project Facility Market OrgGroup Vendor Person Audit"  # noqa
  }
  split_rules = {k: v.split() for k, v in business_object_rules.items()}
  filtered_rules = {k: filter(v) for k, v in split_rules.items()}
  return filtered_rules


def _prefix_camelcase(name, prefix):
  name = name[:1].lower() + name[1:]
  callback = lambda pat: prefix + pat.group(0).lower()
  return re.sub(r'[A-Z]', callback, name)


def underscore_from_camelcase(name):
  return _prefix_camelcase(name, "_")


def title_from_camelcase(name):
  return _prefix_camelcase(name, " ")


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

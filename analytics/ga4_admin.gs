/**
 * Philly After School GA4 admin. Bound to the "Philly After School GA4 Admin" Google Sheet.
 *
 * Setup (once, by whoever will run it; their Google login needs Editor on the GA4 property):
 *   1. In the sheet: Extensions > Apps Script. Delete the sample code, paste this whole file, Save.
 *   2. Left bar: "+" next to Services > Google Analytics Admin API > version v1alpha > Add.
 *      (v1alpha, not v1beta: event rules, data redaction, enhanced measurement, annotations and
 *      audiences only exist in v1alpha.)
 *   3. Reload the sheet. A "GA4 Admin" menu appears next to Help.
 *   4. README tab: fill in the property ID (B3). The measurement ID (B4) is already there.
 *   5. GA4 Admin > Check GA4 (authorize when asked). Read the Result columns and the Log tab. Then > Apply.
 *
 * What each tab controls, and what Include = N means there:
 *   Dimensions, Metrics   create what is missing. N = leave that row out (nothing is ever archived). GA4 registers a
 *                         parameter name as a dimension or a metric, never both; the script reports the clash.
 *   Key events            Y = make it a key event; N = take it off the key-event list (no data is lost).
 *   Event rules           Y = make the rule on the web stream; N = delete the rule (events already made stay).
 *   Settings              a blank Value leaves that setting as it is; a filled one is compared and applied.
 *   Annotations           create what is missing, matched by title + date. N = leave out; never deleted.
 *   Audiences             create what is missing, matched by name. N = leave out; never archived.
 *
 * Writes to the sheet: each tab's Result column, Settings column C (what GA4 has now), README B2 (status),
 * README B5 (the data stream's ID), and the Log tab (one row per item). Safe to run again at any time.
 */

var TABS = { readme: 'README', dims: 'Dimensions', metrics: 'Metrics', keys: 'Key events', rules: 'Event rules',
             settings: 'Settings', notes: 'Annotations', aud: 'Audiences', log: 'Log' };
var CELLS = { status: 'B2', property: 'B3', mid: 'B4', stream: 'B5' };
var LIMITS = { dims: { EVENT: 50, USER: 25, ITEM: 10 }, metrics: 50, keyEvents: 30, audiences: 100 };
var MAX_PARAM = { EVENT: 40, USER: 24, ITEM: 40 };
var UNITS = ['STANDARD', 'CURRENCY', 'FEET', 'METERS', 'KILOMETERS', 'MILES', 'MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS'];
var COLORS = ['PURPLE', 'BROWN', 'BLUE', 'GREEN', 'RED', 'CYAN'];
var SLEEP_MS = 200;

// Result column (1-based) on each tab, and the first data row.
var RESULT_COL = { dims: 6, metrics: 6, keys: 6, rules: 9, settings: 5, notes: 7, aud: 7 };

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var one = ui.createMenu('Apply one tab')
    .addItem('Dimensions', 'applyDims').addItem('Metrics', 'applyMetrics').addItem('Key events', 'applyKeys')
    .addItem('Event rules', 'applyRules').addItem('Settings', 'applySettings').addItem('Annotations', 'applyNotes')
    .addItem('Audiences', 'applyAud');
  ui.createMenu('GA4 Admin')
    .addItem('Check GA4 (no changes)', 'checkRun')
    .addItem('Apply (make the changes)', 'applyRun')
    .addSeparator()
    .addSubMenu(one)
    .addSeparator()
    .addItem('Clear the Result columns', 'clearResults')
    .addToUi();
}

function checkRun() { run_('check', null); }
function applyRun() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Apply', 'Make GA4 match every tab of this sheet?\n\nDimensions, metrics, annotations and audiences are only ever added. Key events and event rules marked N are removed. Settings with a value are changed to it.\n\nRun "Check GA4" first if you have not.', ui.ButtonSet.OK_CANCEL);
  if (r === ui.Button.OK) run_('apply', null);
}
function applyDims()     { run_('apply', 'dims'); }
function applyMetrics()  { run_('apply', 'metrics'); }
function applyKeys()     { run_('apply', 'keys'); }
function applyRules()    { run_('apply', 'rules'); }
function applySettings() { run_('apply', 'settings'); }
function applyNotes()    { run_('apply', 'notes'); }
function applyAud()      { run_('apply', 'aud'); }

function clearResults() {
  Object.keys(RESULT_COL).forEach(function (k) {
    var s = sheet_(TABS[k]), n = s.getLastRow() - 1;
    if (n > 0) s.getRange(2, RESULT_COL[k], n, 1).clearContent();
  });
  setStatus_('Result columns cleared.');
}

/** Runs every step (or one), in the order the API needs: dimensions before audiences that use them. */
function run_(mode, only) {
  if (typeof AnalyticsAdmin === 'undefined') {
    SpreadsheetApp.getUi().alert('The Google Analytics Admin API service is not added. In the script editor, click + next to Services, choose Google Analytics Admin API, version v1alpha, Add. Then reload the sheet.');
    return;
  }
  var runAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var ctx = context_(mode, runAt);
  if (!ctx) return;
  var steps = [['dims', doDims_], ['metrics', doMetrics_], ['keys', doKeyEvents_], ['rules', doRules_],
               ['settings', doSettings_], ['notes', doAnnotations_], ['aud', doAudiences_]];
  var all = [];
  steps.forEach(function (st) {
    if (only && only !== st[0]) return;
    setStatus_(mode + ': ' + TABS[st[0]] + '…');
    try { all = all.concat(st[1](ctx, mode, runAt)); }
    catch (e) { all.push(row_(runAt, mode, TABS[st[0]], '', 'failed', short_(e))); }
  });
  appendLog_(all);
  setStatus_('Done (' + mode + ', ' + runAt + '): ' + summarize_(all) + '. See the Log tab.');
}

/** Property and web stream from the README tab. */
function context_(mode, runAt) {
  var rd = sheet_(TABS.readme);
  var id = String(rd.getRange(CELLS.property).getValue()).trim().replace(/\.0+$/, '').replace(/^properties\//, '');
  var mid = String(rd.getRange(CELLS.mid).getValue()).trim();
  if (!/^\d+$/.test(id)) { setStatus_('Fill in the GA4 property ID in ' + CELLS.property + ' (numbers only; it is under Admin > Property details).'); return null; }
  var parent = 'properties/' + id, prop;
  try { prop = withRetry_(function () { return AnalyticsAdmin.Properties.get(parent); }); }
  catch (e) { setStatus_('Cannot open property ' + id + ': ' + short_(e) + '. Check the ID and that your Google login has Editor on it.'); return null; }
  var streams;
  try { streams = (withRetry_(function () { return AnalyticsAdmin.Properties.DataStreams.list(parent); }).dataStreams || []); }
  catch (e) { setStatus_('Cannot list the property’s data streams: ' + short_(e)); return null; }
  var web = streams.filter(function (s) { return s.webStreamData; });
  var stream = mid ? web.filter(function (s) { return s.webStreamData.measurementId === mid; })[0] : web[0];
  if (!stream) {
    setStatus_('No web stream with measurement ID ' + (mid || '(blank)') + ' on property ' + id + ' (it has: ' + (web.map(function (s) { return s.webStreamData.measurementId; }).join(', ') || 'none') + '). Wrong property ID?');
    return null;
  }
  rd.getRange(CELLS.stream).setValue(stream.name.split('/').pop());
  if (!mid) rd.getRange(CELLS.mid).setValue(stream.webStreamData.measurementId);
  appendLog_([row_(runAt, mode, TABS.readme, prop.displayName, 'ok', 'property ' + id + ', stream ' + stream.name.split('/').pop() + ' (' + stream.webStreamData.measurementId + '), time zone ' + prop.timeZone + ', currency ' + prop.currencyCode)]);
  return { id: id, parent: parent, prop: prop, stream: stream, streamName: stream.name, mid: stream.webStreamData.measurementId };
}

// ------------------------------------------------------------------ Dimensions
// Columns: Display name | Scope | Event parameter | Description | Include | Result | Sent by
function doDims_(ctx, mode, runAt) {
  var tab = 'dims', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  var existing = listAll_(function (args) { return AnalyticsAdmin.Properties.CustomDimensions.list(ctx.parent, args); }, 'customDimensions');
  var byKey = {}, byDisplay = {}, counts = {}, metricOf = {};
  existing.forEach(function (cd) {
    byKey[cd.parameterName + '|' + cd.scope] = cd;
    byDisplay[String(cd.displayName || '').trim().toLowerCase()] = cd;
    counts[cd.scope] = (counts[cd.scope] || 0) + 1;
  });
  listAll_(function (args) { return AnalyticsAdmin.Properties.CustomMetrics.list(ctx.parent, args); }, 'customMetrics')
    .forEach(function (m) { metricOf[m.parameterName] = m; });
  rows.forEach(function (r, i) {
    var line = i + 2, name = String(r[0] || '').trim(), scope = String(r[1] || 'EVENT').trim().toUpperCase(), param = String(r[2] || '').trim();
    var desc = String(r[3] || '').trim().slice(0, 150), include = yes_(r[4]);
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], param + ' (' + name + ')', status, detail)); };
    if (!name && !param) return;
    if (!include) { put('not included', ''); return; }
    if (!LIMITS.dims[scope]) { put('failed', 'scope must be EVENT, USER or ITEM'); return; }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(param)) { put('failed', 'parameter name must be letters, digits and underscores, starting with a letter'); return; }
    if (param.length > MAX_PARAM[scope]) { put('failed', 'parameter name is ' + param.length + ' characters; the limit for ' + scope + ' scope is ' + MAX_PARAM[scope]); return; }
    if (name.length > 82) { put('failed', 'display name is over 82 characters'); return; }
    var have = byKey[param + '|' + scope];
    if (have) { put('exists', have.displayName === name ? '' : 'registered as “' + have.displayName + '” (left as is)'); return; }
    if (scope === 'EVENT' && metricOf[param]) { put('conflict', '“' + param + '” is already the custom metric “' + metricOf[param].displayName + '”; GA4 registers a parameter as a dimension or a metric, not both'); return; }
    var clash = byDisplay[name.toLowerCase()];
    if (clash) { put('conflict', 'display name already used by parameter “' + clash.parameterName + '”: rename it in GA4 or change this display name'); return; }
    if ((counts[scope] || 0) >= LIMITS.dims[scope]) { put('failed', 'property already has ' + counts[scope] + ' ' + scope.toLowerCase() + '-scoped dimensions (limit ' + LIMITS.dims[scope] + ')'); return; }
    if (mode !== 'apply') { put('would create', ''); return; }
    try {
      withRetry_(function () { return AnalyticsAdmin.Properties.CustomDimensions.create({ parameterName: param, displayName: name, scope: scope, description: desc }, ctx.parent); });
      counts[scope] = (counts[scope] || 0) + 1; byDisplay[name.toLowerCase()] = { parameterName: param };
      put('created', ''); Utilities.sleep(SLEEP_MS);
    } catch (e) { put('failed', short_(e)); }
  });
  return out;
}

// ------------------------------------------------------------------ Metrics
// Columns: Display name | Event parameter | Unit | Description | Include | Result
function doMetrics_(ctx, mode, runAt) {
  var tab = 'metrics', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  var existing = listAll_(function (args) { return AnalyticsAdmin.Properties.CustomMetrics.list(ctx.parent, args); }, 'customMetrics');
  var byParam = {}, byDisplay = {}, count = existing.length, dimOf = {};
  existing.forEach(function (m) { byParam[m.parameterName] = m; byDisplay[String(m.displayName || '').trim().toLowerCase()] = m; });
  // GA4 keeps one registry of parameter names across custom dimensions and metrics: a parameter is one or the other.
  listAll_(function (args) { return AnalyticsAdmin.Properties.CustomDimensions.list(ctx.parent, args); }, 'customDimensions')
    .forEach(function (d) { if (d.scope === 'EVENT') dimOf[d.parameterName] = d; });
  rows.forEach(function (r, i) {
    var line = i + 2, name = String(r[0] || '').trim(), param = String(r[1] || '').trim(), unit = String(r[2] || 'STANDARD').trim().toUpperCase();
    var desc = String(r[3] || '').trim().slice(0, 150), include = yes_(r[4]);
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], param + ' (' + name + ')', status, detail)); };
    if (!name && !param) return;
    if (!include) { put('not included', ''); return; }
    if (UNITS.indexOf(unit) < 0) { put('failed', 'unit must be one of ' + UNITS.join(', ')); return; }
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(param)) { put('failed', 'parameter name must be letters, digits and underscores, up to 40 characters'); return; }
    var have = byParam[param];
    if (have) { put('exists', (have.displayName === name ? '' : 'registered as “' + have.displayName + '”') + (have.measurementUnit === unit ? '' : ' unit ' + have.measurementUnit) + ' (left as is)'); return; }
    if (dimOf[param]) { put('conflict', '“' + param + '” is already the custom dimension “' + dimOf[param].displayName + '”; GA4 registers a parameter as a dimension or a metric, not both. For a metric, send the number under a second parameter name in Tag Manager and register that one here.'); return; }
    var clash = byDisplay[name.toLowerCase()];
    if (clash) { put('conflict', 'display name already used by parameter “' + clash.parameterName + '”'); return; }
    if (count >= LIMITS.metrics) { put('failed', 'property already has ' + count + ' custom metrics (limit ' + LIMITS.metrics + ')'); return; }
    if (mode !== 'apply') { put('would create', ''); return; }
    try {
      withRetry_(function () { return AnalyticsAdmin.Properties.CustomMetrics.create({ parameterName: param, displayName: name, description: desc, measurementUnit: unit, scope: 'EVENT' }, ctx.parent); });
      count++; byDisplay[name.toLowerCase()] = { parameterName: param };
      put('created', ''); Utilities.sleep(SLEEP_MS);
    } catch (e) { put('failed', short_(e)); }
  });
  return out;
}

// ------------------------------------------------------------------ Key events
// Columns: Event name | Counting method | Default value | Include | Why | Result
function doKeyEvents_(ctx, mode, runAt) {
  var tab = 'keys', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  var existing = listAll_(function (args) { return AnalyticsAdmin.Properties.KeyEvents.list(ctx.parent, args); }, 'keyEvents');
  var byName = {}, onSheet = {}, count = existing.length;
  existing.forEach(function (k) { byName[k.eventName] = k; });
  rows.forEach(function (r, i) {
    var line = i + 2, name = String(r[0] || '').trim(), method = counting_(r[1]), include = yes_(r[3]);
    var dv = r[2] === '' || r[2] === null ? null : Number(r[2]);
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], name, status, detail)); };
    if (!name) return;
    onSheet[name] = true;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) { put('failed', 'event name must be letters, digits and underscores, up to 40 characters'); return; }
    if (!method) { put('failed', 'counting method must be “once per event” or “once per session”'); return; }
    var have = byName[name];
    if (!include) {
      if (!have) { put('not included', 'not a key event'); return; }
      if (have.deletable === false) { put('kept', 'GA4 marks this one itself and it cannot be removed'); return; }
      if (mode !== 'apply') { put('would remove', 'it stops being a key event; its data stays'); return; }
      try { withRetry_(function () { return AnalyticsAdmin.Properties.KeyEvents.remove(have.name); }); count--; put('removed', ''); }
      catch (e) { put('failed', short_(e)); }
      return;
    }
    if (have) {
      var want = { countingMethod: method };
      var diff = have.countingMethod !== method;
      if (dv !== null && !isNaN(dv)) { want.defaultValue = { numericValue: dv, currencyCode: ctx.prop.currencyCode || 'USD' }; diff = diff || !have.defaultValue || Number(have.defaultValue.numericValue) !== dv; }
      if (!diff) { put('exists', ''); return; }
      if (have.custom === false) { put('exists', 'a GA4 default; its counting method is left as is'); return; }
      if (mode !== 'apply') { put('would change', 'counting ' + have.countingMethod + ' → ' + method + (want.defaultValue ? ', default value ' + dv : '')); return; }
      try {
        withRetry_(function () { return AnalyticsAdmin.Properties.KeyEvents.patch(want, have.name, { updateMask: 'counting_method' + (want.defaultValue ? ',default_value' : '') }); });
        put('changed', 'counting ' + method);
      } catch (e) { put('failed', short_(e)); }
      return;
    }
    if (count >= LIMITS.keyEvents) { put('failed', 'property already has ' + count + ' key events (limit ' + LIMITS.keyEvents + ')'); return; }
    if (mode !== 'apply') { put('would create', ''); return; }
    try {
      var body = { eventName: name, countingMethod: method };
      if (dv !== null && !isNaN(dv)) body.defaultValue = { numericValue: dv, currencyCode: ctx.prop.currencyCode || 'USD' };
      withRetry_(function () { return AnalyticsAdmin.Properties.KeyEvents.create(body, ctx.parent); });
      count++; put('created', ''); Utilities.sleep(SLEEP_MS);
    } catch (e) { put('failed', short_(e)); }
  });
  existing.forEach(function (k) { if (!onSheet[k.eventName]) out.push(row_(runAt, mode, TABS[tab], k.eventName, 'in GA4, not on the sheet', 'left as is; add a row with Include = N to remove it, or Y to keep it on purpose')); });
  return out;
}

// ------------------------------------------------------------------ Event rules (on the web stream)
// Columns: New event | Source event | Condition 1 | Condition 2 | Condition 3 | Copy parameters | Include | Why | Result
function doRules_(ctx, mode, runAt) {
  var tab = 'rules', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  var existing = listAll_(function (args) { return AnalyticsAdmin.Properties.DataStreams.EventCreateRules.list(ctx.streamName, args); }, 'eventCreateRules');
  var byDest = {};
  existing.forEach(function (e) { byDest[e.destinationEvent] = e; });
  rows.forEach(function (r, i) {
    var line = i + 2, dest = String(r[0] || '').trim(), src = String(r[1] || '').trim(), include = yes_(r[6]), copy = yes_(r[5]);
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], dest, status, detail)); };
    if (!dest && !src) return;
    var have = byDest[dest];
    if (!include) {
      if (!have) { put('not included', ''); return; }
      if (mode !== 'apply') { put('would remove', 'the rule goes; events it already made stay'); return; }
      try { withRetry_(function () { return AnalyticsAdmin.Properties.DataStreams.EventCreateRules.remove(have.name); }); put('removed', ''); }
      catch (e) { put('failed', short_(e)); }
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(dest)) { put('failed', 'new event name must be letters, digits and underscores, under 40 characters, starting with a letter'); return; }
    if (!src) { put('failed', 'needs a source event'); return; }
    var conds = [{ field: 'event_name', comparisonType: 'EQUALS', value: src }], bad = null;
    [r[2], r[3], r[4]].forEach(function (c) {
      c = String(c || '').trim(); if (!c) return;
      var p = condition_(c); if (!p) { bad = c; return; }
      conds.push(p);
    });
    if (bad) { put('failed', 'cannot read condition “' + bad + '”: write it as  name = value,  name != value,  name contains value,  name starts with value  or  name matches regex'); return; }
    var body = { destinationEvent: dest, eventConditions: conds, sourceCopyParameters: copy };
    if (have) {
      var same = JSON.stringify(norm_(have.eventConditions)) === JSON.stringify(norm_(conds)) && !!have.sourceCopyParameters === copy;
      if (same) { put('exists', ''); return; }
      if (mode !== 'apply') { put('would change', 'conditions or copy setting differ from GA4'); return; }
      try {
        withRetry_(function () { return AnalyticsAdmin.Properties.DataStreams.EventCreateRules.patch(body, have.name, { updateMask: 'event_conditions,source_copy_parameters' }); });
        put('changed', '');
      } catch (e) { put('failed', short_(e)); }
      return;
    }
    if (mode !== 'apply') { put('would create', conds.length + ' condition(s)'); return; }
    try {
      withRetry_(function () { return AnalyticsAdmin.Properties.DataStreams.EventCreateRules.create(body, ctx.streamName); });
      put('created', ''); Utilities.sleep(SLEEP_MS);
    } catch (e) { put('failed', short_(e)); }
  });
  existing.forEach(function (e) {
    var on = rows.some(function (r) { return String(r[0] || '').trim() === e.destinationEvent; });
    if (!on) out.push(row_(runAt, mode, TABS[tab], e.destinationEvent, 'in GA4, not on the sheet', 'left as is'));
  });
  return out;
}

/** "step = signed_in" → a MatchingCondition. Also !=, contains, starts with, matches. */
function condition_(text) {
  var m;
  if ((m = /^([A-Za-z0-9_]+)\s*!=\s*(.+)$/.exec(text))) return { field: m[1], comparisonType: 'EQUALS', value: m[2].trim(), negated: true };
  if ((m = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(text))) return { field: m[1], comparisonType: 'EQUALS', value: m[2].trim() };
  if ((m = /^([A-Za-z0-9_]+)\s+contains\s+(.+)$/i.exec(text))) return { field: m[1], comparisonType: 'CONTAINS', value: m[2].trim() };
  if ((m = /^([A-Za-z0-9_]+)\s+starts with\s+(.+)$/i.exec(text))) return { field: m[1], comparisonType: 'STARTS_WITH', value: m[2].trim() };
  if ((m = /^([A-Za-z0-9_]+)\s+matches\s+(.+)$/i.exec(text))) return { field: m[1], comparisonType: 'REGULAR_EXPRESSION', value: m[2].trim() };
  return null;
}
function norm_(conds) {
  return (conds || []).map(function (c) { return [c.field, c.comparisonType, c.value, !!c.negated]; })
    .sort(function (a, b) { return a.join('|') < b.join('|') ? -1 : 1; });
}

// ------------------------------------------------------------------ Settings
// Columns: Setting | Value | Now in GA4 | Why | Result
function doSettings_(ctx, mode, runAt) {
  var tab = 'settings', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  var groups = {
    property:  { get: function () { return ctx.prop; },
                 set: function (body, mask) { return AnalyticsAdmin.Properties.patch(body, ctx.parent, { updateMask: mask }); } },
    retention: { get: function () { return AnalyticsAdmin.Properties.getDataRetentionSettings(ctx.parent + '/dataRetentionSettings'); },
                 set: function (body, mask) { return AnalyticsAdmin.Properties.updateDataRetentionSettings(body, ctx.parent + '/dataRetentionSettings', { updateMask: mask }); } },
    signals:   { get: function () { return AnalyticsAdmin.Properties.getGoogleSignalsSettings(ctx.parent + '/googleSignalsSettings'); },
                 set: function (body, mask) { return AnalyticsAdmin.Properties.updateGoogleSignalsSettings(body, ctx.parent + '/googleSignalsSettings', { updateMask: mask }); } },
    enhanced:  { get: function () { return AnalyticsAdmin.Properties.DataStreams.getEnhancedMeasurementSettings(ctx.streamName + '/enhancedMeasurementSettings'); },
                 set: function (body, mask) { return AnalyticsAdmin.Properties.DataStreams.updateEnhancedMeasurementSettings(body, ctx.streamName + '/enhancedMeasurementSettings', { updateMask: mask }); } },
    redaction: { get: function () { return AnalyticsAdmin.Properties.DataStreams.getDataRedactionSettings(ctx.streamName + '/dataRedactionSettings'); },
                 set: function (body, mask) { return AnalyticsAdmin.Properties.DataStreams.updateDataRedactionSettings(body, ctx.streamName + '/dataRedactionSettings', { updateMask: mask }); } }
  };
  // Setting label → group, API field, snake_case mask name, and how to read the sheet's value.
  var retention = function (v) { v = String(v).trim().toUpperCase(); return /^2|TWO/.test(v) ? 'TWO_MONTHS' : /^14|FOURTEEN/.test(v) ? 'FOURTEEN_MONTHS' : /^26|TWENTY/.test(v) ? 'TWENTY_SIX_MONTHS' : /^38|THIRTY/.test(v) ? 'THIRTY_EIGHT_MONTHS' : /^50|FIFTY/.test(v) ? 'FIFTY_MONTHS' : null; };
  var onoff = function (v) { v = String(v).trim().toUpperCase(); return /^(ON|Y|YES|TRUE|ENABLED|GOOGLE_SIGNALS_ENABLED)$/.test(v) ? 'GOOGLE_SIGNALS_ENABLED' : /^(OFF|N|NO|FALSE|DISABLED|GOOGLE_SIGNALS_DISABLED)$/.test(v) ? 'GOOGLE_SIGNALS_DISABLED' : null; };
  var bool = function (v) { v = String(v).trim().toUpperCase(); return /^(Y|YES|TRUE|ON)$/.test(v) ? true : /^(N|NO|FALSE|OFF)$/.test(v) ? false : null; };
  var text = function (v) { v = String(v).trim(); return v || null; };
  var list = function (v) { var a = String(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean); return a.length ? a : null; };
  var MAP = {
    'property time zone':                      ['property',  'timeZone',                        'time_zone',                          text],
    'property currency':                       ['property',  'currencyCode',                    'currency_code',                      function (v) { var t = text(v); return t ? t.toUpperCase() : null; }],
    'event data retention':                    ['retention', 'eventDataRetention',              'event_data_retention',               retention],
    'user data retention':                     ['retention', 'userDataRetention',               'user_data_retention',                retention],
    'reset user data on new activity':         ['retention', 'resetUserDataOnNewActivity',      'reset_user_data_on_new_activity',    bool],
    'google signals':                          ['signals',   'state',                           'state',                              onoff],
    'enhanced measurement':                    ['enhanced',  'streamEnabled',                   'stream_enabled',                     bool],
    'enhanced: scrolls':                       ['enhanced',  'scrollsEnabled',                  'scrolls_enabled',                    bool],
    'enhanced: outbound clicks':               ['enhanced',  'outboundClicksEnabled',           'outbound_clicks_enabled',            bool],
    'enhanced: site search':                   ['enhanced',  'siteSearchEnabled',               'site_search_enabled',                bool],
    'enhanced: video engagement':              ['enhanced',  'videoEngagementEnabled',          'video_engagement_enabled',           bool],
    'enhanced: file downloads':                ['enhanced',  'fileDownloadsEnabled',            'file_downloads_enabled',             bool],
    'enhanced: page changes (browser history)':['enhanced',  'pageChangesEnabled',              'page_changes_enabled',               bool],
    'enhanced: form interactions':             ['enhanced',  'formInteractionsEnabled',         'form_interactions_enabled',          bool],
    'redact email addresses':                  ['redaction', 'emailRedactionEnabled',           'email_redaction_enabled',            bool],
    'redact url query parameters':             ['redaction', 'queryParameterRedactionEnabled',  'query_parameter_redaction_enabled',  bool],
    'query parameters to redact':              ['redaction', 'queryParameterKeys',              'query_parameter_keys',               list]
  };
  var current = {}, pending = {};   // group → fetched object; group → { body, masks[], lines[] }
  var fetch = function (g) {
    if (current[g] === undefined) { try { current[g] = withRetry_(groups[g].get) || {}; } catch (e) { current[g] = { __error: short_(e) }; } }
    return current[g];
  };
  var show = function (v) {
    if (v === undefined || v === null || v === '') return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'on' : 'off';
    if (/^[A-Z_]+$/.test(String(v))) return String(v).replace(/^GOOGLE_SIGNALS_/, '').replace('_MONTHS', ' months').toLowerCase().replace(/_/g, ' ');
    return String(v);
  };
  rows.forEach(function (r, i) {
    var line = i + 2, label = String(r[0] || '').trim(), key = label.toLowerCase(), raw = r[1];
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], label, status, detail)); };
    if (!label) return;
    var m = MAP[key];
    if (!m) { put('failed', 'unknown setting; the label in column A must match the script’s list'); return; }
    var cur = fetch(m[0]);
    if (cur.__error) { put('failed', 'cannot read it: ' + cur.__error); return; }
    var now = cur[m[1]];
    s.getRange(line, 3).setValue(show(now));
    if (raw === '' || raw === null) { put('left as is', ''); return; }
    var want = m[3](raw);
    if (want === null) { put('failed', 'cannot read the value “' + raw + '”'); return; }
    var same = Array.isArray(want) ? JSON.stringify(want.map(function (x) { return x.toLowerCase(); }).sort()) === JSON.stringify((now || []).map(function (x) { return String(x).toLowerCase(); }).sort())
                                   : (typeof want === 'boolean' ? !!now === want : String(now || '') === want);
    if (same) { put('same', ''); return; }
    if (mode !== 'apply') { put('would change', show(now) + ' → ' + show(want)); return; }
    if (!pending[m[0]]) pending[m[0]] = { body: {}, masks: [], lines: [] };
    pending[m[0]].body[m[1]] = want; pending[m[0]].masks.push(m[2]); pending[m[0]].lines.push({ line: line, label: label, detail: show(now) + ' → ' + show(want) });
  });
  Object.keys(pending).forEach(function (g) {
    var p = pending[g], body = p.body, cur = current[g] || {};
    if (g === 'enhanced' && body.searchQueryParameter === undefined) body.searchQueryParameter = cur.searchQueryParameter || 'q,s,search,query,keyword';
    if (g === 'redaction') {
      if (body.queryParameterRedactionEnabled === undefined) body.queryParameterRedactionEnabled = !!cur.queryParameterRedactionEnabled;
      if (body.queryParameterKeys === undefined) body.queryParameterKeys = cur.queryParameterKeys || [];
      if (body.queryParameterRedactionEnabled && !body.queryParameterKeys.length) { p.lines.forEach(function (l) { result_(tab, l.line, 'failed', 'redacting query parameters needs at least one key in “Query parameters to redact”'); out.push(row_(runAt, mode, TABS[tab], l.label, 'failed', 'no query parameter keys')); }); return; }
    }
    if (g === 'signals' && body.state === 'GOOGLE_SIGNALS_ENABLED') body.consent = 'GOOGLE_SIGNALS_CONSENT_CONSENTED';
    try {
      withRetry_(function () { return groups[g].set(body, p.masks.join(',')); });
      p.lines.forEach(function (l) { result_(tab, l.line, 'changed', l.detail); out.push(row_(runAt, mode, TABS[tab], l.label, 'changed', l.detail)); });
    } catch (e) {
      p.lines.forEach(function (l) { result_(tab, l.line, 'failed', short_(e)); out.push(row_(runAt, mode, TABS[tab], l.label, 'failed', short_(e))); });
    }
  });
  return out;
}

// ------------------------------------------------------------------ Annotations
// Columns: Date | End date | Title | Description | Color | Include | Result
function doAnnotations_(ctx, mode, runAt) {
  var tab = 'notes', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  if (!AnalyticsAdmin.Properties.ReportingDataAnnotations) {
    out.push(row_(runAt, mode, TABS[tab], '', 'failed', 'this build of the Google Analytics Admin API service has no annotations; make sure version v1alpha is the one added'));
    return out;
  }
  var existing = listAll_(function (args) { return AnalyticsAdmin.Properties.ReportingDataAnnotations.list(ctx.parent, args); }, 'reportingDataAnnotations')
    .filter(function (a) { return !a.systemGenerated; });
  var key = function (title, ymd) { return String(title).trim().toLowerCase() + '|' + ymd; };
  var have = {};
  existing.forEach(function (a) {
    var d = a.annotationDate || (a.annotationDateRange && a.annotationDateRange.startDate);
    if (d) have[key(a.title, ymdOf_(d))] = a;
  });
  rows.forEach(function (r, i) {
    var line = i + 2, start = ymd_(r[0]), end = ymd_(r[1]), title = String(r[2] || '').trim(), desc = String(r[3] || '').trim();
    var color = String(r[4] || 'BLUE').trim().toUpperCase(), include = yes_(r[5]);
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], title + ' (' + (start || '?') + ')', status, detail)); };
    if (!title && !r[0]) return;
    if (!include) { put('not included', ''); return; }
    if (!start) { put('failed', 'needs a date (YYYY-MM-DD)'); return; }
    if (!title) { put('failed', 'needs a title'); return; }
    if (COLORS.indexOf(color) < 0) { put('failed', 'color must be one of ' + COLORS.join(', ')); return; }
    if (end && end < start) { put('failed', 'end date is before the start date'); return; }
    if (have[key(title, start)]) { put('exists', ''); return; }
    if (mode !== 'apply') { put('would create', ''); return; }
    var body = { title: title, description: desc, color: color };
    if (end && end !== start) body.annotationDateRange = { startDate: dateOf_(start), endDate: dateOf_(end) };
    else body.annotationDate = dateOf_(start);
    try {
      withRetry_(function () { return AnalyticsAdmin.Properties.ReportingDataAnnotations.create(body, ctx.parent); });
      have[key(title, start)] = body; put('created', ''); Utilities.sleep(SLEEP_MS);
    } catch (e) { put('failed', short_(e)); }
  });
  return out;
}

// ------------------------------------------------------------------ Audiences
// Columns: Name | Description | Dimension | Equals | Membership days | Include | Result
function doAudiences_(ctx, mode, runAt) {
  var tab = 'aud', s = sheet_(TABS[tab]), out = [];
  var rows = s.getDataRange().getValues().slice(1);
  var existing = listAll_(function (args) { return AnalyticsAdmin.Properties.Audiences.list(ctx.parent, args); }, 'audiences');
  var byName = {}, count = existing.length;
  existing.forEach(function (a) { byName[String(a.displayName || '').trim().toLowerCase()] = a; });
  var customParams = {};
  sheet_(TABS.dims).getDataRange().getValues().slice(1).forEach(function (r) { if (r[2]) customParams[String(r[2]).trim()] = String(r[1] || 'EVENT').trim().toUpperCase(); });
  rows.forEach(function (r, i) {
    var line = i + 2, name = String(r[0] || '').trim(), desc = String(r[1] || '').trim(), dim = String(r[2] || '').trim(), val = String(r[3] || '').trim();
    var days = Number(r[4] || 540), include = yes_(r[5]);
    var put = function (status, detail) { result_(tab, line, status, detail); out.push(row_(runAt, mode, TABS[tab], name, status, detail)); };
    if (!name) return;
    if (!include) { put('not included', ''); return; }
    if (!dim || !val) { put('failed', 'needs a dimension (or the word “event”) and a value'); return; }
    if (!(days >= 1 && days <= 540)) { put('failed', 'membership days must be 1 to 540'); return; }
    if (byName[name.toLowerCase()]) { put('exists', 'left as is (change it in GA4, or give the row a new name)'); return; }
    if (count >= LIMITS.audiences) { put('failed', 'property already has ' + count + ' audiences (limit ' + LIMITS.audiences + ')'); return; }
    var leaf;
    if (dim.toLowerCase() === 'event') leaf = { eventFilter: { eventName: val } };
    else {
      var field = dim.indexOf(':') >= 0 ? dim : customParams[dim] ? (customParams[dim] === 'USER' ? 'customUser:' : 'customEvent:') + dim : dim;
      leaf = { dimensionOrMetricFilter: { fieldName: field, atAnyPointInTime: true, stringFilter: { matchType: 'EXACT', value: val, caseSensitive: false } } };
    }
    if (mode !== 'apply') { put('would create', (leaf.eventFilter ? 'event ' + val : leaf.dimensionOrMetricFilter.fieldName + ' = ' + val) + ', ' + days + ' days'); return; }
    var body = { displayName: name, description: desc || name, membershipDurationDays: days,
      filterClauses: [{ clauseType: 'INCLUDE', simpleFilter: { scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
        filterExpression: { andGroup: { filterExpressions: [{ orGroup: { filterExpressions: [leaf] } }] } } } }] };
    try {
      withRetry_(function () { return AnalyticsAdmin.Properties.Audiences.create(body, ctx.parent); });
      byName[name.toLowerCase()] = body; count++; put('created', ''); Utilities.sleep(SLEEP_MS);
    } catch (e) { put('failed', short_(e) + (/customEvent|customUser|field/i.test(String(e)) ? ' (is the dimension registered on the Dimensions tab and applied? GA4 can take a while to accept a new one)' : '')); }
  });
  return out;
}

// ------------------------------------------------------------------ helpers
function listAll_(call, key) {
  var all = [], token = null;
  do {
    var args = { pageSize: 200 };
    if (token) args.pageToken = token;
    var res = withRetry_(function () { return call(args); }) || {};
    (res[key] || []).forEach(function (x) { all.push(x); });
    token = res.nextPageToken;
  } while (token);
  return all;
}

/** Retries quota and transient errors with backoff; anything else is thrown to the caller. */
function withRetry_(fn) {
  for (var i = 0; ; i++) {
    try { return fn(); }
    catch (e) {
      var msg = String(e);
      var transient = /429|RESOURCE_EXHAUSTED|quota|rate limit|503|UNAVAILABLE|500|INTERNAL|DEADLINE|timed out/i.test(msg);
      if (!transient || i >= 4) throw e;
      Utilities.sleep(Math.pow(2, i + 1) * 1000);
    }
  }
}

function yes_(v) { return String(v === '' || v === null || v === undefined ? 'Y' : v).trim().toUpperCase() !== 'N'; }
function counting_(v) { v = String(v || 'once per event').trim().toUpperCase().replace(/ /g, '_'); return /SESSION/.test(v) ? 'ONCE_PER_SESSION' : /EVENT/.test(v) ? 'ONCE_PER_EVENT' : null; }
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var t = String(v || '').trim(), m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (!m) return null;
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
function ymdOf_(d) { return d.year + '-' + ('0' + d.month).slice(-2) + '-' + ('0' + d.day).slice(-2); }
function dateOf_(ymd) { var p = ymd.split('-'); return { year: Number(p[0]), month: Number(p[1]), day: Number(p[2]) }; }

function sheet_(name) {
  var s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error('Missing tab: ' + name);
  return s;
}
function result_(tab, line, status, detail) { sheet_(TABS[tab]).getRange(line, RESULT_COL[tab]).setValue(status + (detail ? ': ' + detail : '')); }
function row_(runAt, mode, tab, item, status, detail) { return [runAt, mode, tab, item, status, detail || '']; }
function appendLog_(rows) {
  if (!rows.length) return;
  var s = sheet_(TABS.log);
  s.getRange(s.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}
function setStatus_(text) { sheet_(TABS.readme).getRange(CELLS.status).setValue(text); SpreadsheetApp.flush(); }
function summarize_(rows) {
  var c = {};
  rows.forEach(function (r) { c[r[4]] = (c[r[4]] || 0) + 1; });
  return Object.keys(c).sort().map(function (k) { return c[k] + ' ' + k; }).join(', ');
}
function short_(e) { return String(e && e.message ? e.message : e).split('\n')[0].slice(0, 220); }

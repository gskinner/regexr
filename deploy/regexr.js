var regexr = (function () {
'use strict';

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// This is CodeMirror (http://codemirror.net), a code editor
// implemented in JavaScript on top of the browser's DOM.
//
// You can find some technical background for some of the code below
// at http://marijnhaverbeke.nl/blog/#cm-internals .

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.CodeMirror = factory());
}(window, (function () { 'use strict';

// Kludges for bugs and behavior differences that can't be feature
// detected are enabled based on userAgent etc sniffing.
var userAgent = navigator.userAgent;
var platform = navigator.platform;

var gecko = /gecko\/\d/i.test(userAgent);
var ie_upto10 = /MSIE \d/.test(userAgent);
var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent);
var edge = /Edge\/(\d+)/.exec(userAgent);
var ie = ie_upto10 || ie_11up || edge;
var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : +(edge || ie_11up)[1]);
var webkit = !edge && /WebKit\//.test(userAgent);
var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent);
var chrome = !edge && /Chrome\//.test(userAgent);
var presto = /Opera\//.test(userAgent);
var safari = /Apple Computer/.test(navigator.vendor);
var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent);
var phantom = /PhantomJS/.test(userAgent);

var ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
var android = /Android/.test(userAgent);
// This is woefully incomplete. Suggestions for alternative methods welcome.
var mobile = ios || android || /webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent);
var mac = ios || /Mac/.test(platform);
var chromeOS = /\bCrOS\b/.test(userAgent);
var windows = /win/i.test(platform);

var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/);
if (presto_version) { presto_version = Number(presto_version[1]); }
if (presto_version && presto_version >= 15) { presto = false; webkit = true; }
// Some browsers use the wrong event properties to signal cmd/ctrl on OS X
var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11));
var captureRightClick = gecko || (ie && ie_version >= 9);

function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }

var rmClass = function(node, cls) {
  var current = node.className;
  var match = classTest(cls).exec(current);
  if (match) {
    var after = current.slice(match.index + match[0].length);
    node.className = current.slice(0, match.index) + (after ? match[1] + after : "");
  }
};

function removeChildren(e) {
  for (var count = e.childNodes.length; count > 0; --count)
    { e.removeChild(e.firstChild); }
  return e
}

function removeChildrenAndAdd(parent, e) {
  return removeChildren(parent).appendChild(e)
}

function elt(tag, content, className, style) {
  var e = document.createElement(tag);
  if (className) { e.className = className; }
  if (style) { e.style.cssText = style; }
  if (typeof content == "string") { e.appendChild(document.createTextNode(content)); }
  else if (content) { for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); } }
  return e
}
// wrapper for elt, which removes the elt from the accessibility tree
function eltP(tag, content, className, style) {
  var e = elt(tag, content, className, style);
  e.setAttribute("role", "presentation");
  return e
}

var range;
if (document.createRange) { range = function(node, start, end, endNode) {
  var r = document.createRange();
  r.setEnd(endNode || node, end);
  r.setStart(node, start);
  return r
}; }
else { range = function(node, start, end) {
  var r = document.body.createTextRange();
  try { r.moveToElementText(node.parentNode); }
  catch(e) { return r }
  r.collapse(true);
  r.moveEnd("character", end);
  r.moveStart("character", start);
  return r
}; }

function contains(parent, child) {
  if (child.nodeType == 3) // Android browser always returns false when child is a textnode
    { child = child.parentNode; }
  if (parent.contains)
    { return parent.contains(child) }
  do {
    if (child.nodeType == 11) { child = child.host; }
    if (child == parent) { return true }
  } while (child = child.parentNode)
}

function activeElt() {
  // IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
  // IE < 10 will throw when accessed while the page is loading or in an iframe.
  // IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
  var activeElement;
  try {
    activeElement = document.activeElement;
  } catch(e) {
    activeElement = document.body || null;
  }
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
    { activeElement = activeElement.shadowRoot.activeElement; }
  return activeElement
}

function addClass(node, cls) {
  var current = node.className;
  if (!classTest(cls).test(current)) { node.className += (current ? " " : "") + cls; }
}
function joinClasses(a, b) {
  var as = a.split(" ");
  for (var i = 0; i < as.length; i++)
    { if (as[i] && !classTest(as[i]).test(b)) { b += " " + as[i]; } }
  return b
}

var selectInput = function(node) { node.select(); };
if (ios) // Mobile Safari apparently has a bug where select() is broken.
  { selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length; }; }
else if (ie) // Suppress mysterious IE10 errors
  { selectInput = function(node) { try { node.select(); } catch(_e) {} }; }

function bind(f) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function(){return f.apply(null, args)}
}

function copyObj(obj, target, overwrite) {
  if (!target) { target = {}; }
  for (var prop in obj)
    { if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
      { target[prop] = obj[prop]; } }
  return target
}

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
function countColumn(string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/);
    if (end == -1) { end = string.length; }
  }
  for (var i = startIndex || 0, n = startValue || 0;;) {
    var nextTab = string.indexOf("\t", i);
    if (nextTab < 0 || nextTab >= end)
      { return n + (end - i) }
    n += nextTab - i;
    n += tabSize - (n % tabSize);
    i = nextTab + 1;
  }
}

var Delayed = function() {this.id = null;};
Delayed.prototype.set = function (ms, f) {
  clearTimeout(this.id);
  this.id = setTimeout(f, ms);
};

function indexOf(array, elt) {
  for (var i = 0; i < array.length; ++i)
    { if (array[i] == elt) { return i } }
  return -1
}

// Number of pixels added to scroller and sizer to hide scrollbar
var scrollerGap = 30;

// Returned or thrown by various protocols to signal 'I'm not
// handling this'.
var Pass = {toString: function(){return "CodeMirror.Pass"}};

// Reused option objects for setSelection & friends
var sel_dontScroll = {scroll: false};
var sel_mouse = {origin: "*mouse"};
var sel_move = {origin: "+move"};
// The inverse of countColumn -- find the offset that corresponds to
// a particular column.
function findColumn(string, goal, tabSize) {
  for (var pos = 0, col = 0;;) {
    var nextTab = string.indexOf("\t", pos);
    if (nextTab == -1) { nextTab = string.length; }
    var skipped = nextTab - pos;
    if (nextTab == string.length || col + skipped >= goal)
      { return pos + Math.min(skipped, goal - col) }
    col += nextTab - pos;
    col += tabSize - (col % tabSize);
    pos = nextTab + 1;
    if (col >= goal) { return pos }
  }
}

var spaceStrs = [""];
function spaceStr(n) {
  while (spaceStrs.length <= n)
    { spaceStrs.push(lst(spaceStrs) + " "); }
  return spaceStrs[n]
}

function lst(arr) { return arr[arr.length-1] }

function map(array, f) {
  var out = [];
  for (var i = 0; i < array.length; i++) { out[i] = f(array[i], i); }
  return out
}

function insertSorted(array, value, score) {
  var pos = 0, priority = score(value);
  while (pos < array.length && score(array[pos]) <= priority) { pos++; }
  array.splice(pos, 0, value);
}

function nothing() {}

function createObj(base, props) {
  var inst;
  if (Object.create) {
    inst = Object.create(base);
  } else {
    nothing.prototype = base;
    inst = new nothing();
  }
  if (props) { copyObj(props, inst); }
  return inst
}

var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;
function isWordCharBasic(ch) {
  return /\w/.test(ch) || ch > "\x80" &&
    (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
}
function isWordChar(ch, helper) {
  if (!helper) { return isWordCharBasic(ch) }
  if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) { return true }
  return helper.test(ch)
}

function isEmpty(obj) {
  for (var n in obj) { if (obj.hasOwnProperty(n) && obj[n]) { return false } }
  return true
}

// Extending unicode characters. A series of a non-extending char +
// any number of extending chars is treated as a single unit as far
// as editing and measuring is concerned. This is not fully correct,
// since some scripts/fonts/browsers also treat other configurations
// of code points as a group.
var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;
function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }

// Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
function skipExtendingChars(str, pos, dir) {
  while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) { pos += dir; }
  return pos
}

// Returns the value from the range [`from`; `to`] that satisfies
// `pred` and is closest to `from`. Assumes that at least `to` satisfies `pred`.
function findFirst(pred, from, to) {
  for (;;) {
    if (Math.abs(from - to) <= 1) { return pred(from) ? from : to }
    var mid = Math.floor((from + to) / 2);
    if (pred(mid)) { to = mid; }
    else { from = mid; }
  }
}

// The display handles the DOM integration, both for input reading
// and content drawing. It holds references to DOM nodes and
// display-related state.

function Display(place, doc, input) {
  var d = this;
  this.input = input;

  // Covers bottom-right square when both scrollbars are present.
  d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
  d.scrollbarFiller.setAttribute("cm-not-content", "true");
  // Covers bottom of gutter when coverGutterNextToScrollbar is on
  // and h scrollbar is present.
  d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler");
  d.gutterFiller.setAttribute("cm-not-content", "true");
  // Will contain the actual code, positioned to cover the viewport.
  d.lineDiv = eltP("div", null, "CodeMirror-code");
  // Elements are added to these to represent selection and cursors.
  d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
  d.cursorDiv = elt("div", null, "CodeMirror-cursors");
  // A visibility: hidden element used to find the size of things.
  d.measure = elt("div", null, "CodeMirror-measure");
  // When lines outside of the viewport are measured, they are drawn in this.
  d.lineMeasure = elt("div", null, "CodeMirror-measure");
  // Wraps everything that needs to exist inside the vertically-padded coordinate system
  d.lineSpace = eltP("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
                    null, "position: relative; outline: none");
  var lines = eltP("div", [d.lineSpace], "CodeMirror-lines");
  // Moved around its parent to cover visible view.
  d.mover = elt("div", [lines], null, "position: relative");
  // Set to the height of the document, allowing scrolling.
  d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
  d.sizerWidth = null;
  // Behavior of elts with overflow: auto and padding is
  // inconsistent across browsers. This is used to ensure the
  // scrollable area is big enough.
  d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;");
  // Will contain the gutters, if any.
  d.gutters = elt("div", null, "CodeMirror-gutters");
  d.lineGutter = null;
  // Actual scrollable element.
  d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll");
  d.scroller.setAttribute("tabIndex", "-1");
  // The element in which the editor lives.
  d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror");

  // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
  if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0; }
  if (!webkit && !(gecko && mobile)) { d.scroller.draggable = true; }

  if (place) {
    if (place.appendChild) { place.appendChild(d.wrapper); }
    else { place(d.wrapper); }
  }

  // Current rendered range (may be bigger than the view window).
  d.viewFrom = d.viewTo = doc.first;
  d.reportedViewFrom = d.reportedViewTo = doc.first;
  // Information about the rendered lines.
  d.view = [];
  d.renderedView = null;
  // Holds info about a single rendered line when it was rendered
  // for measurement, while not in view.
  d.externalMeasured = null;
  // Empty space (in pixels) above the view
  d.viewOffset = 0;
  d.lastWrapHeight = d.lastWrapWidth = 0;
  d.updateLineNumbers = null;

  d.nativeBarWidth = d.barHeight = d.barWidth = 0;
  d.scrollbarsClipped = false;

  // Used to only resize the line number gutter when necessary (when
  // the amount of lines crosses a boundary that makes its width change)
  d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null;
  // Set to true when a non-horizontal-scrolling line widget is
  // added. As an optimization, line widget aligning is skipped when
  // this is false.
  d.alignWidgets = false;

  d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;

  // Tracks the maximum line length so that the horizontal scrollbar
  // can be kept static when scrolling.
  d.maxLine = null;
  d.maxLineLength = 0;
  d.maxLineChanged = false;

  // Used for measuring wheel scrolling granularity
  d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null;

  // True when shift is held down.
  d.shift = false;

  // Used to track whether anything happened since the context menu
  // was opened.
  d.selForContextMenu = null;

  d.activeTouch = null;

  input.init(d);
}

// Find the line object corresponding to the given line number.
function getLine(doc, n) {
  n -= doc.first;
  if (n < 0 || n >= doc.size) { throw new Error("There is no line " + (n + doc.first) + " in the document.") }
  var chunk = doc;
  while (!chunk.lines) {
    for (var i = 0;; ++i) {
      var child = chunk.children[i], sz = child.chunkSize();
      if (n < sz) { chunk = child; break }
      n -= sz;
    }
  }
  return chunk.lines[n]
}

// Get the part of a document between two positions, as an array of
// strings.
function getBetween(doc, start, end) {
  var out = [], n = start.line;
  doc.iter(start.line, end.line + 1, function (line) {
    var text = line.text;
    if (n == end.line) { text = text.slice(0, end.ch); }
    if (n == start.line) { text = text.slice(start.ch); }
    out.push(text);
    ++n;
  });
  return out
}
// Get the lines between from and to, as array of strings.
function getLines(doc, from, to) {
  var out = [];
  doc.iter(from, to, function (line) { out.push(line.text); }); // iter aborts when callback returns truthy value
  return out
}

// Update the height of a line, propagating the height change
// upwards to parent nodes.
function updateLineHeight(line, height) {
  var diff = height - line.height;
  if (diff) { for (var n = line; n; n = n.parent) { n.height += diff; } }
}

// Given a line object, find its line number by walking up through
// its parent links.
function lineNo(line) {
  if (line.parent == null) { return null }
  var cur = line.parent, no = indexOf(cur.lines, line);
  for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
    for (var i = 0;; ++i) {
      if (chunk.children[i] == cur) { break }
      no += chunk.children[i].chunkSize();
    }
  }
  return no + cur.first
}

// Find the line at the given vertical position, using the height
// information in the document tree.
function lineAtHeight(chunk, h) {
  var n = chunk.first;
  outer: do {
    for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
      var child = chunk.children[i$1], ch = child.height;
      if (h < ch) { chunk = child; continue outer }
      h -= ch;
      n += child.chunkSize();
    }
    return n
  } while (!chunk.lines)
  var i = 0;
  for (; i < chunk.lines.length; ++i) {
    var line = chunk.lines[i], lh = line.height;
    if (h < lh) { break }
    h -= lh;
  }
  return n + i
}

function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size}

function lineNumberFor(options, i) {
  return String(options.lineNumberFormatter(i + options.firstLineNumber))
}

// A Pos instance represents a position within the text.
function Pos(line, ch, sticky) {
  if ( sticky === void 0 ) sticky = null;

  if (!(this instanceof Pos)) { return new Pos(line, ch, sticky) }
  this.line = line;
  this.ch = ch;
  this.sticky = sticky;
}

// Compare two positions, return 0 if they are the same, a negative
// number when a is less, and a positive number otherwise.
function cmp(a, b) { return a.line - b.line || a.ch - b.ch }

function equalCursorPos(a, b) { return a.sticky == b.sticky && cmp(a, b) == 0 }

function copyPos(x) {return Pos(x.line, x.ch)}
function maxPos(a, b) { return cmp(a, b) < 0 ? b : a }
function minPos(a, b) { return cmp(a, b) < 0 ? a : b }

// Most of the external API clips given positions to make sure they
// actually exist within the document.
function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1))}
function clipPos(doc, pos) {
  if (pos.line < doc.first) { return Pos(doc.first, 0) }
  var last = doc.first + doc.size - 1;
  if (pos.line > last) { return Pos(last, getLine(doc, last).text.length) }
  return clipToLen(pos, getLine(doc, pos.line).text.length)
}
function clipToLen(pos, linelen) {
  var ch = pos.ch;
  if (ch == null || ch > linelen) { return Pos(pos.line, linelen) }
  else if (ch < 0) { return Pos(pos.line, 0) }
  else { return pos }
}
function clipPosArray(doc, array) {
  var out = [];
  for (var i = 0; i < array.length; i++) { out[i] = clipPos(doc, array[i]); }
  return out
}

// Optimize some code when these features are not used.
var sawReadOnlySpans = false;
var sawCollapsedSpans = false;
function seeReadOnlySpans() {
  sawReadOnlySpans = true;
}

function seeCollapsedSpans() {
  sawCollapsedSpans = true;
}

// TEXTMARKER SPANS

function MarkedSpan(marker, from, to) {
  this.marker = marker;
  this.from = from; this.to = to;
}

// Search an array of spans for a span matching the given marker.
function getMarkedSpanFor(spans, marker) {
  if (spans) { for (var i = 0; i < spans.length; ++i) {
    var span = spans[i];
    if (span.marker == marker) { return span }
  } }
}
// Remove a span from an array, returning undefined if no spans are
// left (we don't store arrays for lines without spans).
function removeMarkedSpan(spans, span) {
  var r;
  for (var i = 0; i < spans.length; ++i)
    { if (spans[i] != span) { (r || (r = [])).push(spans[i]); } }
  return r
}
// Add a span to a line.
function addMarkedSpan(line, span) {
  line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
  span.marker.attachLine(line);
}

// Used for the algorithm that adjusts markers for a change in the
// document. These functions cut an array of spans at a given
// character position, returning an array of remaining chunks (or
// undefined if nothing remains).
function markedSpansBefore(old, startCh, isInsert) {
  var nw;
  if (old) { for (var i = 0; i < old.length; ++i) {
    var span = old[i], marker = span.marker;
    var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
    if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
      var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);(nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to));
    }
  } }
  return nw
}
function markedSpansAfter(old, endCh, isInsert) {
  var nw;
  if (old) { for (var i = 0; i < old.length; ++i) {
    var span = old[i], marker = span.marker;
    var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
    if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
      var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);(nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
                                            span.to == null ? null : span.to - endCh));
    }
  } }
  return nw
}

// Given a change object, compute the new set of marker spans that
// cover the line in which the change took place. Removes spans
// entirely within the change, reconnects spans belonging to the
// same marker that appear on both sides of the change, and cuts off
// spans partially within the change. Returns an array of span
// arrays with one element for each line in (after) the change.
function stretchSpansOverChange(doc, change) {
  if (change.full) { return null }
  var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
  var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;
  if (!oldFirst && !oldLast) { return null }

  var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0;
  // Get the spans that 'stick out' on both sides
  var first = markedSpansBefore(oldFirst, startCh, isInsert);
  var last = markedSpansAfter(oldLast, endCh, isInsert);

  // Next, merge those two ends
  var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0);
  if (first) {
    // Fix up .to properties of first
    for (var i = 0; i < first.length; ++i) {
      var span = first[i];
      if (span.to == null) {
        var found = getMarkedSpanFor(last, span.marker);
        if (!found) { span.to = startCh; }
        else if (sameLine) { span.to = found.to == null ? null : found.to + offset; }
      }
    }
  }
  if (last) {
    // Fix up .from in last (or move them into first in case of sameLine)
    for (var i$1 = 0; i$1 < last.length; ++i$1) {
      var span$1 = last[i$1];
      if (span$1.to != null) { span$1.to += offset; }
      if (span$1.from == null) {
        var found$1 = getMarkedSpanFor(first, span$1.marker);
        if (!found$1) {
          span$1.from = offset;
          if (sameLine) { (first || (first = [])).push(span$1); }
        }
      } else {
        span$1.from += offset;
        if (sameLine) { (first || (first = [])).push(span$1); }
      }
    }
  }
  // Make sure we didn't create any zero-length spans
  if (first) { first = clearEmptySpans(first); }
  if (last && last != first) { last = clearEmptySpans(last); }

  var newMarkers = [first];
  if (!sameLine) {
    // Fill gap with whole-line-spans
    var gap = change.text.length - 2, gapMarkers;
    if (gap > 0 && first)
      { for (var i$2 = 0; i$2 < first.length; ++i$2)
        { if (first[i$2].to == null)
          { (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null)); } } }
    for (var i$3 = 0; i$3 < gap; ++i$3)
      { newMarkers.push(gapMarkers); }
    newMarkers.push(last);
  }
  return newMarkers
}

// Remove spans that are empty and don't have a clearWhenEmpty
// option of false.
function clearEmptySpans(spans) {
  for (var i = 0; i < spans.length; ++i) {
    var span = spans[i];
    if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
      { spans.splice(i--, 1); }
  }
  if (!spans.length) { return null }
  return spans
}

// Used to 'clip' out readOnly ranges when making a change.
function removeReadOnlyRanges(doc, from, to) {
  var markers = null;
  doc.iter(from.line, to.line + 1, function (line) {
    if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
      var mark = line.markedSpans[i].marker;
      if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
        { (markers || (markers = [])).push(mark); }
    } }
  });
  if (!markers) { return null }
  var parts = [{from: from, to: to}];
  for (var i = 0; i < markers.length; ++i) {
    var mk = markers[i], m = mk.find(0);
    for (var j = 0; j < parts.length; ++j) {
      var p = parts[j];
      if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) { continue }
      var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to);
      if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
        { newParts.push({from: p.from, to: m.from}); }
      if (dto > 0 || !mk.inclusiveRight && !dto)
        { newParts.push({from: m.to, to: p.to}); }
      parts.splice.apply(parts, newParts);
      j += newParts.length - 3;
    }
  }
  return parts
}

// Connect or disconnect spans from a line.
function detachMarkedSpans(line) {
  var spans = line.markedSpans;
  if (!spans) { return }
  for (var i = 0; i < spans.length; ++i)
    { spans[i].marker.detachLine(line); }
  line.markedSpans = null;
}
function attachMarkedSpans(line, spans) {
  if (!spans) { return }
  for (var i = 0; i < spans.length; ++i)
    { spans[i].marker.attachLine(line); }
  line.markedSpans = spans;
}

// Helpers used when computing which overlapping collapsed span
// counts as the larger one.
function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0 }
function extraRight(marker) { return marker.inclusiveRight ? 1 : 0 }

// Returns a number indicating which of two overlapping collapsed
// spans is larger (and thus includes the other). Falls back to
// comparing ids when the spans cover exactly the same range.
function compareCollapsedMarkers(a, b) {
  var lenDiff = a.lines.length - b.lines.length;
  if (lenDiff != 0) { return lenDiff }
  var aPos = a.find(), bPos = b.find();
  var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b);
  if (fromCmp) { return -fromCmp }
  var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b);
  if (toCmp) { return toCmp }
  return b.id - a.id
}

// Find out whether a line ends or starts in a collapsed span. If
// so, return the marker for that span.
function collapsedSpanAtSide(line, start) {
  var sps = sawCollapsedSpans && line.markedSpans, found;
  if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
    sp = sps[i];
    if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
        (!found || compareCollapsedMarkers(found, sp.marker) < 0))
      { found = sp.marker; }
  } }
  return found
}
function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true) }
function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false) }

// Test whether there exists a collapsed span that partially
// overlaps (covers the start or end, but not both) of a new span.
// Such overlap is not allowed.
function conflictingCollapsedRange(doc, lineNo, from, to, marker) {
  var line = getLine(doc, lineNo);
  var sps = sawCollapsedSpans && line.markedSpans;
  if (sps) { for (var i = 0; i < sps.length; ++i) {
    var sp = sps[i];
    if (!sp.marker.collapsed) { continue }
    var found = sp.marker.find(0);
    var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker);
    var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker);
    if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) { continue }
    if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) ||
        fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0))
      { return true }
  } }
}

// A visual line is a line as drawn on the screen. Folding, for
// example, can cause multiple logical lines to appear on the same
// visual line. This finds the start of the visual line that the
// given line is part of (usually that is the line itself).
function visualLine(line) {
  var merged;
  while (merged = collapsedSpanAtStart(line))
    { line = merged.find(-1, true).line; }
  return line
}

function visualLineEnd(line) {
  var merged;
  while (merged = collapsedSpanAtEnd(line))
    { line = merged.find(1, true).line; }
  return line
}

// Returns an array of logical lines that continue the visual line
// started by the argument, or undefined if there are no such lines.
function visualLineContinued(line) {
  var merged, lines;
  while (merged = collapsedSpanAtEnd(line)) {
    line = merged.find(1, true).line
    ;(lines || (lines = [])).push(line);
  }
  return lines
}

// Get the line number of the start of the visual line that the
// given line number is part of.
function visualLineNo(doc, lineN) {
  var line = getLine(doc, lineN), vis = visualLine(line);
  if (line == vis) { return lineN }
  return lineNo(vis)
}

// Get the line number of the start of the next visual line after
// the given line.
function visualLineEndNo(doc, lineN) {
  if (lineN > doc.lastLine()) { return lineN }
  var line = getLine(doc, lineN), merged;
  if (!lineIsHidden(doc, line)) { return lineN }
  while (merged = collapsedSpanAtEnd(line))
    { line = merged.find(1, true).line; }
  return lineNo(line) + 1
}

// Compute whether a line is hidden. Lines count as hidden when they
// are part of a visual line that starts with another line, or when
// they are entirely covered by collapsed, non-widget span.
function lineIsHidden(doc, line) {
  var sps = sawCollapsedSpans && line.markedSpans;
  if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
    sp = sps[i];
    if (!sp.marker.collapsed) { continue }
    if (sp.from == null) { return true }
    if (sp.marker.widgetNode) { continue }
    if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
      { return true }
  } }
}
function lineIsHiddenInner(doc, line, span) {
  if (span.to == null) {
    var end = span.marker.find(1, true);
    return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker))
  }
  if (span.marker.inclusiveRight && span.to == line.text.length)
    { return true }
  for (var sp = (void 0), i = 0; i < line.markedSpans.length; ++i) {
    sp = line.markedSpans[i];
    if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
        (sp.to == null || sp.to != span.from) &&
        (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
        lineIsHiddenInner(doc, line, sp)) { return true }
  }
}

// Find the height above the given line.
function heightAtLine(lineObj) {
  lineObj = visualLine(lineObj);

  var h = 0, chunk = lineObj.parent;
  for (var i = 0; i < chunk.lines.length; ++i) {
    var line = chunk.lines[i];
    if (line == lineObj) { break }
    else { h += line.height; }
  }
  for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
    for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
      var cur = p.children[i$1];
      if (cur == chunk) { break }
      else { h += cur.height; }
    }
  }
  return h
}

// Compute the character length of a line, taking into account
// collapsed ranges (see markText) that might hide parts, and join
// other lines onto it.
function lineLength(line) {
  if (line.height == 0) { return 0 }
  var len = line.text.length, merged, cur = line;
  while (merged = collapsedSpanAtStart(cur)) {
    var found = merged.find(0, true);
    cur = found.from.line;
    len += found.from.ch - found.to.ch;
  }
  cur = line;
  while (merged = collapsedSpanAtEnd(cur)) {
    var found$1 = merged.find(0, true);
    len -= cur.text.length - found$1.from.ch;
    cur = found$1.to.line;
    len += cur.text.length - found$1.to.ch;
  }
  return len
}

// Find the longest line in the document.
function findMaxLine(cm) {
  var d = cm.display, doc = cm.doc;
  d.maxLine = getLine(doc, doc.first);
  d.maxLineLength = lineLength(d.maxLine);
  d.maxLineChanged = true;
  doc.iter(function (line) {
    var len = lineLength(line);
    if (len > d.maxLineLength) {
      d.maxLineLength = len;
      d.maxLine = line;
    }
  });
}

// BIDI HELPERS

function iterateBidiSections(order, from, to, f) {
  if (!order) { return f(from, to, "ltr") }
  var found = false;
  for (var i = 0; i < order.length; ++i) {
    var part = order[i];
    if (part.from < to && part.to > from || from == to && part.to == from) {
      f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr");
      found = true;
    }
  }
  if (!found) { f(from, to, "ltr"); }
}

var bidiOther = null;
function getBidiPartAt(order, ch, sticky) {
  var found;
  bidiOther = null;
  for (var i = 0; i < order.length; ++i) {
    var cur = order[i];
    if (cur.from < ch && cur.to > ch) { return i }
    if (cur.to == ch) {
      if (cur.from != cur.to && sticky == "before") { found = i; }
      else { bidiOther = i; }
    }
    if (cur.from == ch) {
      if (cur.from != cur.to && sticky != "before") { found = i; }
      else { bidiOther = i; }
    }
  }
  return found != null ? found : bidiOther
}

// Bidirectional ordering algorithm
// See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
// that this (partially) implements.

// One-char codes used for character types:
// L (L):   Left-to-Right
// R (R):   Right-to-Left
// r (AL):  Right-to-Left Arabic
// 1 (EN):  European Number
// + (ES):  European Number Separator
// % (ET):  European Number Terminator
// n (AN):  Arabic Number
// , (CS):  Common Number Separator
// m (NSM): Non-Spacing Mark
// b (BN):  Boundary Neutral
// s (B):   Paragraph Separator
// t (S):   Segment Separator
// w (WS):  Whitespace
// N (ON):  Other Neutrals

// Returns null if characters are ordered as they appear
// (left-to-right), or an array of sections ({from, to, level}
// objects) in the order in which they occur visually.
var bidiOrdering = (function() {
  // Character types for codepoints 0 to 0xff
  var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN";
  // Character types for codepoints 0x600 to 0x6f9
  var arabicTypes = "nnnnnnNNr%%r,rNNmmmmmmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmmmnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmnNmmmmmmrrmmNmmmmrr1111111111";
  function charType(code) {
    if (code <= 0xf7) { return lowTypes.charAt(code) }
    else if (0x590 <= code && code <= 0x5f4) { return "R" }
    else if (0x600 <= code && code <= 0x6f9) { return arabicTypes.charAt(code - 0x600) }
    else if (0x6ee <= code && code <= 0x8ac) { return "r" }
    else if (0x2000 <= code && code <= 0x200b) { return "w" }
    else if (code == 0x200c) { return "b" }
    else { return "L" }
  }

  var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
  var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/;

  function BidiSpan(level, from, to) {
    this.level = level;
    this.from = from; this.to = to;
  }

  return function(str, direction) {
    var outerType = direction == "ltr" ? "L" : "R";

    if (str.length == 0 || direction == "ltr" && !bidiRE.test(str)) { return false }
    var len = str.length, types = [];
    for (var i = 0; i < len; ++i)
      { types.push(charType(str.charCodeAt(i))); }

    // W1. Examine each non-spacing mark (NSM) in the level run, and
    // change the type of the NSM to the type of the previous
    // character. If the NSM is at the start of the level run, it will
    // get the type of sor.
    for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
      var type = types[i$1];
      if (type == "m") { types[i$1] = prev; }
      else { prev = type; }
    }

    // W2. Search backwards from each instance of a European number
    // until the first strong type (R, L, AL, or sor) is found. If an
    // AL is found, change the type of the European number to Arabic
    // number.
    // W3. Change all ALs to R.
    for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
      var type$1 = types[i$2];
      if (type$1 == "1" && cur == "r") { types[i$2] = "n"; }
      else if (isStrong.test(type$1)) { cur = type$1; if (type$1 == "r") { types[i$2] = "R"; } }
    }

    // W4. A single European separator between two European numbers
    // changes to a European number. A single common separator between
    // two numbers of the same type changes to that type.
    for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
      var type$2 = types[i$3];
      if (type$2 == "+" && prev$1 == "1" && types[i$3+1] == "1") { types[i$3] = "1"; }
      else if (type$2 == "," && prev$1 == types[i$3+1] &&
               (prev$1 == "1" || prev$1 == "n")) { types[i$3] = prev$1; }
      prev$1 = type$2;
    }

    // W5. A sequence of European terminators adjacent to European
    // numbers changes to all European numbers.
    // W6. Otherwise, separators and terminators change to Other
    // Neutral.
    for (var i$4 = 0; i$4 < len; ++i$4) {
      var type$3 = types[i$4];
      if (type$3 == ",") { types[i$4] = "N"; }
      else if (type$3 == "%") {
        var end = (void 0);
        for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}
        var replace = (i$4 && types[i$4-1] == "!") || (end < len && types[end] == "1") ? "1" : "N";
        for (var j = i$4; j < end; ++j) { types[j] = replace; }
        i$4 = end - 1;
      }
    }

    // W7. Search backwards from each instance of a European number
    // until the first strong type (R, L, or sor) is found. If an L is
    // found, then change the type of the European number to L.
    for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
      var type$4 = types[i$5];
      if (cur$1 == "L" && type$4 == "1") { types[i$5] = "L"; }
      else if (isStrong.test(type$4)) { cur$1 = type$4; }
    }

    // N1. A sequence of neutrals takes the direction of the
    // surrounding strong text if the text on both sides has the same
    // direction. European and Arabic numbers act as if they were R in
    // terms of their influence on neutrals. Start-of-level-run (sor)
    // and end-of-level-run (eor) are used at level run boundaries.
    // N2. Any remaining neutrals take the embedding direction.
    for (var i$6 = 0; i$6 < len; ++i$6) {
      if (isNeutral.test(types[i$6])) {
        var end$1 = (void 0);
        for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}
        var before = (i$6 ? types[i$6-1] : outerType) == "L";
        var after = (end$1 < len ? types[end$1] : outerType) == "L";
        var replace$1 = before == after ? (before ? "L" : "R") : outerType;
        for (var j$1 = i$6; j$1 < end$1; ++j$1) { types[j$1] = replace$1; }
        i$6 = end$1 - 1;
      }
    }

    // Here we depart from the documented algorithm, in order to avoid
    // building up an actual levels array. Since there are only three
    // levels (0, 1, 2) in an implementation that doesn't take
    // explicit embedding into account, we can build up the order on
    // the fly, without following the level-based algorithm.
    var order = [], m;
    for (var i$7 = 0; i$7 < len;) {
      if (countsAsLeft.test(types[i$7])) {
        var start = i$7;
        for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}
        order.push(new BidiSpan(0, start, i$7));
      } else {
        var pos = i$7, at = order.length;
        for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}
        for (var j$2 = pos; j$2 < i$7;) {
          if (countsAsNum.test(types[j$2])) {
            if (pos < j$2) { order.splice(at, 0, new BidiSpan(1, pos, j$2)); }
            var nstart = j$2;
            for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}
            order.splice(at, 0, new BidiSpan(2, nstart, j$2));
            pos = j$2;
          } else { ++j$2; }
        }
        if (pos < i$7) { order.splice(at, 0, new BidiSpan(1, pos, i$7)); }
      }
    }
    if (order[0].level == 1 && (m = str.match(/^\s+/))) {
      order[0].from = m[0].length;
      order.unshift(new BidiSpan(0, 0, m[0].length));
    }
    if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
      lst(order).to -= m[0].length;
      order.push(new BidiSpan(0, len - m[0].length, len));
    }

    return direction == "rtl" ? order.reverse() : order
  }
})();

// Get the bidi ordering for the given line (and cache it). Returns
// false for lines that are fully left-to-right, and an array of
// BidiSpan objects otherwise.
function getOrder(line, direction) {
  var order = line.order;
  if (order == null) { order = line.order = bidiOrdering(line.text, direction); }
  return order
}

function moveCharLogically(line, ch, dir) {
  var target = skipExtendingChars(line.text, ch + dir, dir);
  return target < 0 || target > line.text.length ? null : target
}

function moveLogically(line, start, dir) {
  var ch = moveCharLogically(line, start.ch, dir);
  return ch == null ? null : new Pos(start.line, ch, dir < 0 ? "after" : "before")
}

function endOfLine(visually, cm, lineObj, lineNo, dir) {
  if (visually) {
    var order = getOrder(lineObj, cm.doc.direction);
    if (order) {
      var part = dir < 0 ? lst(order) : order[0];
      var moveInStorageOrder = (dir < 0) == (part.level == 1);
      var sticky = moveInStorageOrder ? "after" : "before";
      var ch;
      // With a wrapped rtl chunk (possibly spanning multiple bidi parts),
      // it could be that the last bidi part is not on the last visual line,
      // since visual lines contain content order-consecutive chunks.
      // Thus, in rtl, we are looking for the first (content-order) character
      // in the rtl chunk that is on the last line (that is, the same line
      // as the last (content-order) character).
      if (part.level > 0) {
        var prep = prepareMeasureForLine(cm, lineObj);
        ch = dir < 0 ? lineObj.text.length - 1 : 0;
        var targetTop = measureCharPrepared(cm, prep, ch).top;
        ch = findFirst(function (ch) { return measureCharPrepared(cm, prep, ch).top == targetTop; }, (dir < 0) == (part.level == 1) ? part.from : part.to - 1, ch);
        if (sticky == "before") { ch = moveCharLogically(lineObj, ch, 1); }
      } else { ch = dir < 0 ? part.to : part.from; }
      return new Pos(lineNo, ch, sticky)
    }
  }
  return new Pos(lineNo, dir < 0 ? lineObj.text.length : 0, dir < 0 ? "before" : "after")
}

function moveVisually(cm, line, start, dir) {
  var bidi = getOrder(line, cm.doc.direction);
  if (!bidi) { return moveLogically(line, start, dir) }
  if (start.ch >= line.text.length) {
    start.ch = line.text.length;
    start.sticky = "before";
  } else if (start.ch <= 0) {
    start.ch = 0;
    start.sticky = "after";
  }
  var partPos = getBidiPartAt(bidi, start.ch, start.sticky), part = bidi[partPos];
  if (cm.doc.direction == "ltr" && part.level % 2 == 0 && (dir > 0 ? part.to > start.ch : part.from < start.ch)) {
    // Case 1: We move within an ltr part in an ltr editor. Even with wrapped lines,
    // nothing interesting happens.
    return moveLogically(line, start, dir)
  }

  var mv = function (pos, dir) { return moveCharLogically(line, pos instanceof Pos ? pos.ch : pos, dir); };
  var prep;
  var getWrappedLineExtent = function (ch) {
    if (!cm.options.lineWrapping) { return {begin: 0, end: line.text.length} }
    prep = prep || prepareMeasureForLine(cm, line);
    return wrappedLineExtentChar(cm, line, prep, ch)
  };
  var wrappedLineExtent = getWrappedLineExtent(start.sticky == "before" ? mv(start, -1) : start.ch);

  if (cm.doc.direction == "rtl" || part.level == 1) {
    var moveInStorageOrder = (part.level == 1) == (dir < 0);
    var ch = mv(start, moveInStorageOrder ? 1 : -1);
    if (ch != null && (!moveInStorageOrder ? ch >= part.from && ch >= wrappedLineExtent.begin : ch <= part.to && ch <= wrappedLineExtent.end)) {
      // Case 2: We move within an rtl part or in an rtl editor on the same visual line
      var sticky = moveInStorageOrder ? "before" : "after";
      return new Pos(start.line, ch, sticky)
    }
  }

  // Case 3: Could not move within this bidi part in this visual line, so leave
  // the current bidi part

  var searchInVisualLine = function (partPos, dir, wrappedLineExtent) {
    var getRes = function (ch, moveInStorageOrder) { return moveInStorageOrder
      ? new Pos(start.line, mv(ch, 1), "before")
      : new Pos(start.line, ch, "after"); };

    for (; partPos >= 0 && partPos < bidi.length; partPos += dir) {
      var part = bidi[partPos];
      var moveInStorageOrder = (dir > 0) == (part.level != 1);
      var ch = moveInStorageOrder ? wrappedLineExtent.begin : mv(wrappedLineExtent.end, -1);
      if (part.from <= ch && ch < part.to) { return getRes(ch, moveInStorageOrder) }
      ch = moveInStorageOrder ? part.from : mv(part.to, -1);
      if (wrappedLineExtent.begin <= ch && ch < wrappedLineExtent.end) { return getRes(ch, moveInStorageOrder) }
    }
  };

  // Case 3a: Look for other bidi parts on the same visual line
  var res = searchInVisualLine(partPos + dir, dir, wrappedLineExtent);
  if (res) { return res }

  // Case 3b: Look for other bidi parts on the next visual line
  var nextCh = dir > 0 ? wrappedLineExtent.end : mv(wrappedLineExtent.begin, -1);
  if (nextCh != null && !(dir > 0 && nextCh == line.text.length)) {
    res = searchInVisualLine(dir > 0 ? 0 : bidi.length - 1, dir, getWrappedLineExtent(nextCh));
    if (res) { return res }
  }

  // Case 4: Nowhere to move
  return null
}

// EVENT HANDLING

// Lightweight event framework. on/off also work on DOM nodes,
// registering native DOM handlers.

var noHandlers = [];

var on = function(emitter, type, f) {
  if (emitter.addEventListener) {
    emitter.addEventListener(type, f, false);
  } else if (emitter.attachEvent) {
    emitter.attachEvent("on" + type, f);
  } else {
    var map = emitter._handlers || (emitter._handlers = {});
    map[type] = (map[type] || noHandlers).concat(f);
  }
};

function getHandlers(emitter, type) {
  return emitter._handlers && emitter._handlers[type] || noHandlers
}

function off(emitter, type, f) {
  if (emitter.removeEventListener) {
    emitter.removeEventListener(type, f, false);
  } else if (emitter.detachEvent) {
    emitter.detachEvent("on" + type, f);
  } else {
    var map = emitter._handlers, arr = map && map[type];
    if (arr) {
      var index = indexOf(arr, f);
      if (index > -1)
        { map[type] = arr.slice(0, index).concat(arr.slice(index + 1)); }
    }
  }
}

function signal(emitter, type /*, values...*/) {
  var handlers = getHandlers(emitter, type);
  if (!handlers.length) { return }
  var args = Array.prototype.slice.call(arguments, 2);
  for (var i = 0; i < handlers.length; ++i) { handlers[i].apply(null, args); }
}

// The DOM events that CodeMirror handles can be overridden by
// registering a (non-DOM) handler on the editor for the event name,
// and preventDefault-ing the event in that handler.
function signalDOMEvent(cm, e, override) {
  if (typeof e == "string")
    { e = {type: e, preventDefault: function() { this.defaultPrevented = true; }}; }
  signal(cm, override || e.type, cm, e);
  return e_defaultPrevented(e) || e.codemirrorIgnore
}

function signalCursorActivity(cm) {
  var arr = cm._handlers && cm._handlers.cursorActivity;
  if (!arr) { return }
  var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = []);
  for (var i = 0; i < arr.length; ++i) { if (indexOf(set, arr[i]) == -1)
    { set.push(arr[i]); } }
}

function hasHandler(emitter, type) {
  return getHandlers(emitter, type).length > 0
}

// Add on and off methods to a constructor's prototype, to make
// registering events on such objects more convenient.
function eventMixin(ctor) {
  ctor.prototype.on = function(type, f) {on(this, type, f);};
  ctor.prototype.off = function(type, f) {off(this, type, f);};
}

// Due to the fact that we still support jurassic IE versions, some
// compatibility wrappers are needed.

function e_preventDefault(e) {
  if (e.preventDefault) { e.preventDefault(); }
  else { e.returnValue = false; }
}
function e_stopPropagation(e) {
  if (e.stopPropagation) { e.stopPropagation(); }
  else { e.cancelBubble = true; }
}
function e_defaultPrevented(e) {
  return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false
}
function e_stop(e) {e_preventDefault(e); e_stopPropagation(e);}

function e_target(e) {return e.target || e.srcElement}
function e_button(e) {
  var b = e.which;
  if (b == null) {
    if (e.button & 1) { b = 1; }
    else if (e.button & 2) { b = 3; }
    else if (e.button & 4) { b = 2; }
  }
  if (mac && e.ctrlKey && b == 1) { b = 3; }
  return b
}

// Detect drag-and-drop
var dragAndDrop = function() {
  // There is *some* kind of drag-and-drop support in IE6-8, but I
  // couldn't get it to work yet.
  if (ie && ie_version < 9) { return false }
  var div = elt('div');
  return "draggable" in div || "dragDrop" in div
}();

var zwspSupported;
function zeroWidthElement(measure) {
  if (zwspSupported == null) {
    var test = elt("span", "\u200b");
    removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));
    if (measure.firstChild.offsetHeight != 0)
      { zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8); }
  }
  var node = zwspSupported ? elt("span", "\u200b") :
    elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px");
  node.setAttribute("cm-text", "");
  return node
}

// Feature-detect IE's crummy client rect reporting for bidi text
var badBidiRects;
function hasBadBidiRects(measure) {
  if (badBidiRects != null) { return badBidiRects }
  var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"));
  var r0 = range(txt, 0, 1).getBoundingClientRect();
  var r1 = range(txt, 1, 2).getBoundingClientRect();
  removeChildren(measure);
  if (!r0 || r0.left == r0.right) { return false } // Safari returns null in some cases (#2780)
  return badBidiRects = (r1.right - r0.right < 3)
}

// See if "".split is the broken IE version, if so, provide an
// alternative way to split lines.
var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
  var pos = 0, result = [], l = string.length;
  while (pos <= l) {
    var nl = string.indexOf("\n", pos);
    if (nl == -1) { nl = string.length; }
    var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
    var rt = line.indexOf("\r");
    if (rt != -1) {
      result.push(line.slice(0, rt));
      pos += rt + 1;
    } else {
      result.push(line);
      pos = nl + 1;
    }
  }
  return result
} : function (string) { return string.split(/\r\n?|\n/); };

var hasSelection = window.getSelection ? function (te) {
  try { return te.selectionStart != te.selectionEnd }
  catch(e) { return false }
} : function (te) {
  var range;
  try {range = te.ownerDocument.selection.createRange();}
  catch(e) {}
  if (!range || range.parentElement() != te) { return false }
  return range.compareEndPoints("StartToEnd", range) != 0
};

var hasCopyEvent = (function () {
  var e = elt("div");
  if ("oncopy" in e) { return true }
  e.setAttribute("oncopy", "return;");
  return typeof e.oncopy == "function"
})();

var badZoomedRects = null;
function hasBadZoomedRects(measure) {
  if (badZoomedRects != null) { return badZoomedRects }
  var node = removeChildrenAndAdd(measure, elt("span", "x"));
  var normal = node.getBoundingClientRect();
  var fromRange = range(node, 0, 1).getBoundingClientRect();
  return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1
}

var modes = {};
var mimeModes = {};
// Extra arguments are stored as the mode's dependencies, which is
// used by (legacy) mechanisms like loadmode.js to automatically
// load a mode. (Preferred mechanism is the require/define calls.)
function defineMode(name, mode) {
  if (arguments.length > 2)
    { mode.dependencies = Array.prototype.slice.call(arguments, 2); }
  modes[name] = mode;
}

function defineMIME(mime, spec) {
  mimeModes[mime] = spec;
}

// Given a MIME type, a {name, ...options} config object, or a name
// string, return a mode config object.
function resolveMode(spec) {
  if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
    spec = mimeModes[spec];
  } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
    var found = mimeModes[spec.name];
    if (typeof found == "string") { found = {name: found}; }
    spec = createObj(found, spec);
    spec.name = found.name;
  } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
    return resolveMode("application/xml")
  } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
    return resolveMode("application/json")
  }
  if (typeof spec == "string") { return {name: spec} }
  else { return spec || {name: "null"} }
}

// Given a mode spec (anything that resolveMode accepts), find and
// initialize an actual mode object.
function getMode(options, spec) {
  spec = resolveMode(spec);
  var mfactory = modes[spec.name];
  if (!mfactory) { return getMode(options, "text/plain") }
  var modeObj = mfactory(options, spec);
  if (modeExtensions.hasOwnProperty(spec.name)) {
    var exts = modeExtensions[spec.name];
    for (var prop in exts) {
      if (!exts.hasOwnProperty(prop)) { continue }
      if (modeObj.hasOwnProperty(prop)) { modeObj["_" + prop] = modeObj[prop]; }
      modeObj[prop] = exts[prop];
    }
  }
  modeObj.name = spec.name;
  if (spec.helperType) { modeObj.helperType = spec.helperType; }
  if (spec.modeProps) { for (var prop$1 in spec.modeProps)
    { modeObj[prop$1] = spec.modeProps[prop$1]; } }

  return modeObj
}

// This can be used to attach properties to mode objects from
// outside the actual mode definition.
var modeExtensions = {};
function extendMode(mode, properties) {
  var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
  copyObj(properties, exts);
}

function copyState(mode, state) {
  if (state === true) { return state }
  if (mode.copyState) { return mode.copyState(state) }
  var nstate = {};
  for (var n in state) {
    var val = state[n];
    if (val instanceof Array) { val = val.concat([]); }
    nstate[n] = val;
  }
  return nstate
}

// Given a mode and a state (for that mode), find the inner mode and
// state at the position that the state refers to.
function innerMode(mode, state) {
  var info;
  while (mode.innerMode) {
    info = mode.innerMode(state);
    if (!info || info.mode == mode) { break }
    state = info.state;
    mode = info.mode;
  }
  return info || {mode: mode, state: state}
}

function startState(mode, a1, a2) {
  return mode.startState ? mode.startState(a1, a2) : true
}

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.

var StringStream = function(string, tabSize, lineOracle) {
  this.pos = this.start = 0;
  this.string = string;
  this.tabSize = tabSize || 8;
  this.lastColumnPos = this.lastColumnValue = 0;
  this.lineStart = 0;
  this.lineOracle = lineOracle;
};

StringStream.prototype.eol = function () {return this.pos >= this.string.length};
StringStream.prototype.sol = function () {return this.pos == this.lineStart};
StringStream.prototype.peek = function () {return this.string.charAt(this.pos) || undefined};
StringStream.prototype.next = function () {
  if (this.pos < this.string.length)
    { return this.string.charAt(this.pos++) }
};
StringStream.prototype.eat = function (match) {
  var ch = this.string.charAt(this.pos);
  var ok;
  if (typeof match == "string") { ok = ch == match; }
  else { ok = ch && (match.test ? match.test(ch) : match(ch)); }
  if (ok) {++this.pos; return ch}
};
StringStream.prototype.eatWhile = function (match) {
  var start = this.pos;
  while (this.eat(match)){}
  return this.pos > start
};
StringStream.prototype.eatSpace = function () {
    var this$1 = this;

  var start = this.pos;
  while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this$1.pos; }
  return this.pos > start
};
StringStream.prototype.skipToEnd = function () {this.pos = this.string.length;};
StringStream.prototype.skipTo = function (ch) {
  var found = this.string.indexOf(ch, this.pos);
  if (found > -1) {this.pos = found; return true}
};
StringStream.prototype.backUp = function (n) {this.pos -= n;};
StringStream.prototype.column = function () {
  if (this.lastColumnPos < this.start) {
    this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
    this.lastColumnPos = this.start;
  }
  return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.indentation = function () {
  return countColumn(this.string, null, this.tabSize) -
    (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
  if (typeof pattern == "string") {
    var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; };
    var substr = this.string.substr(this.pos, pattern.length);
    if (cased(substr) == cased(pattern)) {
      if (consume !== false) { this.pos += pattern.length; }
      return true
    }
  } else {
    var match = this.string.slice(this.pos).match(pattern);
    if (match && match.index > 0) { return null }
    if (match && consume !== false) { this.pos += match[0].length; }
    return match
  }
};
StringStream.prototype.current = function (){return this.string.slice(this.start, this.pos)};
StringStream.prototype.hideFirstChars = function (n, inner) {
  this.lineStart += n;
  try { return inner() }
  finally { this.lineStart -= n; }
};
StringStream.prototype.lookAhead = function (n) {
  var oracle = this.lineOracle;
  return oracle && oracle.lookAhead(n)
};

var SavedContext = function(state, lookAhead) {
  this.state = state;
  this.lookAhead = lookAhead;
};

var Context = function(doc, state, line, lookAhead) {
  this.state = state;
  this.doc = doc;
  this.line = line;
  this.maxLookAhead = lookAhead || 0;
};

Context.prototype.lookAhead = function (n) {
  var line = this.doc.getLine(this.line + n);
  if (line != null && n > this.maxLookAhead) { this.maxLookAhead = n; }
  return line
};

Context.prototype.nextLine = function () {
  this.line++;
  if (this.maxLookAhead > 0) { this.maxLookAhead--; }
};

Context.fromSaved = function (doc, saved, line) {
  if (saved instanceof SavedContext)
    { return new Context(doc, copyState(doc.mode, saved.state), line, saved.lookAhead) }
  else
    { return new Context(doc, copyState(doc.mode, saved), line) }
};

Context.prototype.save = function (copy) {
  var state = copy !== false ? copyState(this.doc.mode, this.state) : this.state;
  return this.maxLookAhead > 0 ? new SavedContext(state, this.maxLookAhead) : state
};


// Compute a style array (an array starting with a mode generation
// -- for invalidation -- followed by pairs of end positions and
// style strings), which is used to highlight the tokens on the
// line.
function highlightLine(cm, line, context, forceToEnd) {
  // A styles array always starts with a number identifying the
  // mode/overlays that it is based on (for easy invalidation).
  var st = [cm.state.modeGen], lineClasses = {};
  // Compute the base array of styles
  runMode(cm, line.text, cm.doc.mode, context, function (end, style) { return st.push(end, style); },
          lineClasses, forceToEnd);
  var state = context.state;

  // Run overlays, adjust style array.
  var loop = function ( o ) {
    var overlay = cm.state.overlays[o], i = 1, at = 0;
    context.state = true;
    runMode(cm, line.text, overlay.mode, context, function (end, style) {
      var start = i;
      // Ensure there's a token end at the current position, and that i points at it
      while (at < end) {
        var i_end = st[i];
        if (i_end > end)
          { st.splice(i, 1, end, st[i+1], i_end); }
        i += 2;
        at = Math.min(end, i_end);
      }
      if (!style) { return }
      if (overlay.opaque) {
        st.splice(start, i - start, end, "overlay " + style);
        i = start + 2;
      } else {
        for (; start < i; start += 2) {
          var cur = st[start+1];
          st[start+1] = (cur ? cur + " " : "") + "overlay " + style;
        }
      }
    }, lineClasses);
  };

  for (var o = 0; o < cm.state.overlays.length; ++o) loop( o );
  context.state = state;

  return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null}
}

function getLineStyles(cm, line, updateFrontier) {
  if (!line.styles || line.styles[0] != cm.state.modeGen) {
    var context = getContextBefore(cm, lineNo(line));
    var resetState = line.text.length > cm.options.maxHighlightLength && copyState(cm.doc.mode, context.state);
    var result = highlightLine(cm, line, context);
    if (resetState) { context.state = resetState; }
    line.stateAfter = context.save(!resetState);
    line.styles = result.styles;
    if (result.classes) { line.styleClasses = result.classes; }
    else if (line.styleClasses) { line.styleClasses = null; }
    if (updateFrontier === cm.doc.highlightFrontier)
      { cm.doc.modeFrontier = Math.max(cm.doc.modeFrontier, ++cm.doc.highlightFrontier); }
  }
  return line.styles
}

function getContextBefore(cm, n, precise) {
  var doc = cm.doc, display = cm.display;
  if (!doc.mode.startState) { return new Context(doc, true, n) }
  var start = findStartLine(cm, n, precise);
  var saved = start > doc.first && getLine(doc, start - 1).stateAfter;
  var context = saved ? Context.fromSaved(doc, saved, start) : new Context(doc, startState(doc.mode), start);

  doc.iter(start, n, function (line) {
    processLine(cm, line.text, context);
    var pos = context.line;
    line.stateAfter = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo ? context.save() : null;
    context.nextLine();
  });
  if (precise) { doc.modeFrontier = context.line; }
  return context
}

// Lightweight form of highlight -- proceed over this line and
// update state, but don't save a style array. Used for lines that
// aren't currently visible.
function processLine(cm, text, context, startAt) {
  var mode = cm.doc.mode;
  var stream = new StringStream(text, cm.options.tabSize, context);
  stream.start = stream.pos = startAt || 0;
  if (text == "") { callBlankLine(mode, context.state); }
  while (!stream.eol()) {
    readToken(mode, stream, context.state);
    stream.start = stream.pos;
  }
}

function callBlankLine(mode, state) {
  if (mode.blankLine) { return mode.blankLine(state) }
  if (!mode.innerMode) { return }
  var inner = innerMode(mode, state);
  if (inner.mode.blankLine) { return inner.mode.blankLine(inner.state) }
}

function readToken(mode, stream, state, inner) {
  for (var i = 0; i < 10; i++) {
    if (inner) { inner[0] = innerMode(mode, state).mode; }
    var style = mode.token(stream, state);
    if (stream.pos > stream.start) { return style }
  }
  throw new Error("Mode " + mode.name + " failed to advance stream.")
}

var Token = function(stream, type, state) {
  this.start = stream.start; this.end = stream.pos;
  this.string = stream.current();
  this.type = type || null;
  this.state = state;
};

// Utility for getTokenAt and getLineTokens
function takeToken(cm, pos, precise, asArray) {
  var doc = cm.doc, mode = doc.mode, style;
  pos = clipPos(doc, pos);
  var line = getLine(doc, pos.line), context = getContextBefore(cm, pos.line, precise);
  var stream = new StringStream(line.text, cm.options.tabSize, context), tokens;
  if (asArray) { tokens = []; }
  while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
    stream.start = stream.pos;
    style = readToken(mode, stream, context.state);
    if (asArray) { tokens.push(new Token(stream, style, copyState(doc.mode, context.state))); }
  }
  return asArray ? tokens : new Token(stream, style, context.state)
}

function extractLineClasses(type, output) {
  if (type) { for (;;) {
    var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/);
    if (!lineClass) { break }
    type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length);
    var prop = lineClass[1] ? "bgClass" : "textClass";
    if (output[prop] == null)
      { output[prop] = lineClass[2]; }
    else if (!(new RegExp("(?:^|\s)" + lineClass[2] + "(?:$|\s)")).test(output[prop]))
      { output[prop] += " " + lineClass[2]; }
  } }
  return type
}

// Run the given mode's parser over a line, calling f for each token.
function runMode(cm, text, mode, context, f, lineClasses, forceToEnd) {
  var flattenSpans = mode.flattenSpans;
  if (flattenSpans == null) { flattenSpans = cm.options.flattenSpans; }
  var curStart = 0, curStyle = null;
  var stream = new StringStream(text, cm.options.tabSize, context), style;
  var inner = cm.options.addModeClass && [null];
  if (text == "") { extractLineClasses(callBlankLine(mode, context.state), lineClasses); }
  while (!stream.eol()) {
    if (stream.pos > cm.options.maxHighlightLength) {
      flattenSpans = false;
      if (forceToEnd) { processLine(cm, text, context, stream.pos); }
      stream.pos = text.length;
      style = null;
    } else {
      style = extractLineClasses(readToken(mode, stream, context.state, inner), lineClasses);
    }
    if (inner) {
      var mName = inner[0].name;
      if (mName) { style = "m-" + (style ? mName + " " + style : mName); }
    }
    if (!flattenSpans || curStyle != style) {
      while (curStart < stream.start) {
        curStart = Math.min(stream.start, curStart + 5000);
        f(curStart, curStyle);
      }
      curStyle = style;
    }
    stream.start = stream.pos;
  }
  while (curStart < stream.pos) {
    // Webkit seems to refuse to render text nodes longer than 57444
    // characters, and returns inaccurate measurements in nodes
    // starting around 5000 chars.
    var pos = Math.min(stream.pos, curStart + 5000);
    f(pos, curStyle);
    curStart = pos;
  }
}

// Finds the line to start with when starting a parse. Tries to
// find a line with a stateAfter, so that it can start with a
// valid state. If that fails, it returns the line with the
// smallest indentation, which tends to need the least context to
// parse correctly.
function findStartLine(cm, n, precise) {
  var minindent, minline, doc = cm.doc;
  var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100);
  for (var search = n; search > lim; --search) {
    if (search <= doc.first) { return doc.first }
    var line = getLine(doc, search - 1), after = line.stateAfter;
    if (after && (!precise || search + (after instanceof SavedContext ? after.lookAhead : 0) <= doc.modeFrontier))
      { return search }
    var indented = countColumn(line.text, null, cm.options.tabSize);
    if (minline == null || minindent > indented) {
      minline = search - 1;
      minindent = indented;
    }
  }
  return minline
}

function retreatFrontier(doc, n) {
  doc.modeFrontier = Math.min(doc.modeFrontier, n);
  if (doc.highlightFrontier < n - 10) { return }
  var start = doc.first;
  for (var line = n - 1; line > start; line--) {
    var saved = getLine(doc, line).stateAfter;
    // change is on 3
    // state on line 1 looked ahead 2 -- so saw 3
    // test 1 + 2 < 3 should cover this
    if (saved && (!(saved instanceof SavedContext) || line + saved.lookAhead < n)) {
      start = line + 1;
      break
    }
  }
  doc.highlightFrontier = Math.min(doc.highlightFrontier, start);
}

// LINE DATA STRUCTURE

// Line objects. These hold state related to a line, including
// highlighting info (the styles array).
var Line = function(text, markedSpans, estimateHeight) {
  this.text = text;
  attachMarkedSpans(this, markedSpans);
  this.height = estimateHeight ? estimateHeight(this) : 1;
};

Line.prototype.lineNo = function () { return lineNo(this) };
eventMixin(Line);

// Change the content (text, markers) of a line. Automatically
// invalidates cached information and tries to re-estimate the
// line's height.
function updateLine(line, text, markedSpans, estimateHeight) {
  line.text = text;
  if (line.stateAfter) { line.stateAfter = null; }
  if (line.styles) { line.styles = null; }
  if (line.order != null) { line.order = null; }
  detachMarkedSpans(line);
  attachMarkedSpans(line, markedSpans);
  var estHeight = estimateHeight ? estimateHeight(line) : 1;
  if (estHeight != line.height) { updateLineHeight(line, estHeight); }
}

// Detach a line from the document tree and its markers.
function cleanUpLine(line) {
  line.parent = null;
  detachMarkedSpans(line);
}

// Convert a style as returned by a mode (either null, or a string
// containing one or more styles) to a CSS style. This is cached,
// and also looks for line-wide styles.
var styleToClassCache = {};
var styleToClassCacheWithMode = {};
function interpretTokenStyle(style, options) {
  if (!style || /^\s*$/.test(style)) { return null }
  var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache;
  return cache[style] ||
    (cache[style] = style.replace(/\S+/g, "cm-$&"))
}

// Render the DOM representation of the text of a line. Also builds
// up a 'line map', which points at the DOM nodes that represent
// specific stretches of text, and is used by the measuring code.
// The returned object contains the DOM node, this map, and
// information about line-wide styles that were set by the mode.
function buildLineContent(cm, lineView) {
  // The padding-right forces the element to have a 'border', which
  // is needed on Webkit to be able to get line-level bounding
  // rectangles for it (in measureChar).
  var content = eltP("span", null, null, webkit ? "padding-right: .1px" : null);
  var builder = {pre: eltP("pre", [content], "CodeMirror-line"), content: content,
                 col: 0, pos: 0, cm: cm,
                 trailingSpace: false,
                 splitSpaces: (ie || webkit) && cm.getOption("lineWrapping")};
  lineView.measure = {};

  // Iterate over the logical lines that make up this visual line.
  for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
    var line = i ? lineView.rest[i - 1] : lineView.line, order = (void 0);
    builder.pos = 0;
    builder.addToken = buildToken;
    // Optionally wire in some hacks into the token-rendering
    // algorithm, to deal with browser quirks.
    if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line, cm.doc.direction)))
      { builder.addToken = buildTokenBadBidi(builder.addToken, order); }
    builder.map = [];
    var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line);
    insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate));
    if (line.styleClasses) {
      if (line.styleClasses.bgClass)
        { builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || ""); }
      if (line.styleClasses.textClass)
        { builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || ""); }
    }

    // Ensure at least a single node is present, for measuring.
    if (builder.map.length == 0)
      { builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure))); }

    // Store the map and a cache object for the current logical line
    if (i == 0) {
      lineView.measure.map = builder.map;
      lineView.measure.cache = {};
    } else {
      (lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map)
      ;(lineView.measure.caches || (lineView.measure.caches = [])).push({});
    }
  }

  // See issue #2901
  if (webkit) {
    var last = builder.content.lastChild;
    if (/\bcm-tab\b/.test(last.className) || (last.querySelector && last.querySelector(".cm-tab")))
      { builder.content.className = "cm-tab-wrap-hack"; }
  }

  signal(cm, "renderLine", cm, lineView.line, builder.pre);
  if (builder.pre.className)
    { builder.textClass = joinClasses(builder.pre.className, builder.textClass || ""); }

  return builder
}

function defaultSpecialCharPlaceholder(ch) {
  var token = elt("span", "\u2022", "cm-invalidchar");
  token.title = "\\u" + ch.charCodeAt(0).toString(16);
  token.setAttribute("aria-label", token.title);
  return token
}

// Build up the DOM representation for a single token, and add it to
// the line map. Takes care to render special characters separately.
function buildToken(builder, text, style, startStyle, endStyle, title, css) {
  if (!text) { return }
  var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text;
  var special = builder.cm.state.specialChars, mustWrap = false;
  var content;
  if (!special.test(text)) {
    builder.col += text.length;
    content = document.createTextNode(displayText);
    builder.map.push(builder.pos, builder.pos + text.length, content);
    if (ie && ie_version < 9) { mustWrap = true; }
    builder.pos += text.length;
  } else {
    content = document.createDocumentFragment();
    var pos = 0;
    while (true) {
      special.lastIndex = pos;
      var m = special.exec(text);
      var skipped = m ? m.index - pos : text.length - pos;
      if (skipped) {
        var txt = document.createTextNode(displayText.slice(pos, pos + skipped));
        if (ie && ie_version < 9) { content.appendChild(elt("span", [txt])); }
        else { content.appendChild(txt); }
        builder.map.push(builder.pos, builder.pos + skipped, txt);
        builder.col += skipped;
        builder.pos += skipped;
      }
      if (!m) { break }
      pos += skipped + 1;
      var txt$1 = (void 0);
      if (m[0] == "\t") {
        var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize;
        txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
        txt$1.setAttribute("role", "presentation");
        txt$1.setAttribute("cm-text", "\t");
        builder.col += tabWidth;
      } else if (m[0] == "\r" || m[0] == "\n") {
        txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"));
        txt$1.setAttribute("cm-text", m[0]);
        builder.col += 1;
      } else {
        txt$1 = builder.cm.options.specialCharPlaceholder(m[0]);
        txt$1.setAttribute("cm-text", m[0]);
        if (ie && ie_version < 9) { content.appendChild(elt("span", [txt$1])); }
        else { content.appendChild(txt$1); }
        builder.col += 1;
      }
      builder.map.push(builder.pos, builder.pos + 1, txt$1);
      builder.pos++;
    }
  }
  builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32;
  if (style || startStyle || endStyle || mustWrap || css) {
    var fullStyle = style || "";
    if (startStyle) { fullStyle += startStyle; }
    if (endStyle) { fullStyle += endStyle; }
    var token = elt("span", [content], fullStyle, css);
    if (title) { token.title = title; }
    return builder.content.appendChild(token)
  }
  builder.content.appendChild(content);
}

function splitSpaces(text, trailingBefore) {
  if (text.length > 1 && !/  /.test(text)) { return text }
  var spaceBefore = trailingBefore, result = "";
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32))
      { ch = "\u00a0"; }
    result += ch;
    spaceBefore = ch == " ";
  }
  return result
}

// Work around nonsense dimensions being reported for stretches of
// right-to-left text.
function buildTokenBadBidi(inner, order) {
  return function (builder, text, style, startStyle, endStyle, title, css) {
    style = style ? style + " cm-force-border" : "cm-force-border";
    var start = builder.pos, end = start + text.length;
    for (;;) {
      // Find the part that overlaps with the start of this text
      var part = (void 0);
      for (var i = 0; i < order.length; i++) {
        part = order[i];
        if (part.to > start && part.from <= start) { break }
      }
      if (part.to >= end) { return inner(builder, text, style, startStyle, endStyle, title, css) }
      inner(builder, text.slice(0, part.to - start), style, startStyle, null, title, css);
      startStyle = null;
      text = text.slice(part.to - start);
      start = part.to;
    }
  }
}

function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
  var widget = !ignoreWidget && marker.widgetNode;
  if (widget) { builder.map.push(builder.pos, builder.pos + size, widget); }
  if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
    if (!widget)
      { widget = builder.content.appendChild(document.createElement("span")); }
    widget.setAttribute("cm-marker", marker.id);
  }
  if (widget) {
    builder.cm.display.input.setUneditable(widget);
    builder.content.appendChild(widget);
  }
  builder.pos += size;
  builder.trailingSpace = false;
}

// Outputs a number of spans to make up a line, taking highlighting
// and marked text into account.
function insertLineContent(line, builder, styles) {
  var spans = line.markedSpans, allText = line.text, at = 0;
  if (!spans) {
    for (var i$1 = 1; i$1 < styles.length; i$1+=2)
      { builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1+1], builder.cm.options)); }
    return
  }

  var len = allText.length, pos = 0, i = 1, text = "", style, css;
  var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, title, collapsed;
  for (;;) {
    if (nextChange == pos) { // Update current marker set
      spanStyle = spanEndStyle = spanStartStyle = title = css = "";
      collapsed = null; nextChange = Infinity;
      var foundBookmarks = [], endStyles = (void 0);
      for (var j = 0; j < spans.length; ++j) {
        var sp = spans[j], m = sp.marker;
        if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
          foundBookmarks.push(m);
        } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
          if (sp.to != null && sp.to != pos && nextChange > sp.to) {
            nextChange = sp.to;
            spanEndStyle = "";
          }
          if (m.className) { spanStyle += " " + m.className; }
          if (m.css) { css = (css ? css + ";" : "") + m.css; }
          if (m.startStyle && sp.from == pos) { spanStartStyle += " " + m.startStyle; }
          if (m.endStyle && sp.to == nextChange) { (endStyles || (endStyles = [])).push(m.endStyle, sp.to); }
          if (m.title && !title) { title = m.title; }
          if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
            { collapsed = sp; }
        } else if (sp.from > pos && nextChange > sp.from) {
          nextChange = sp.from;
        }
      }
      if (endStyles) { for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2)
        { if (endStyles[j$1 + 1] == nextChange) { spanEndStyle += " " + endStyles[j$1]; } } }

      if (!collapsed || collapsed.from == pos) { for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2)
        { buildCollapsedSpan(builder, 0, foundBookmarks[j$2]); } }
      if (collapsed && (collapsed.from || 0) == pos) {
        buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
                           collapsed.marker, collapsed.from == null);
        if (collapsed.to == null) { return }
        if (collapsed.to == pos) { collapsed = false; }
      }
    }
    if (pos >= len) { break }

    var upto = Math.min(len, nextChange);
    while (true) {
      if (text) {
        var end = pos + text.length;
        if (!collapsed) {
          var tokenText = end > upto ? text.slice(0, upto - pos) : text;
          builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                           spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", title, css);
        }
        if (end >= upto) {text = text.slice(upto - pos); pos = upto; break}
        pos = end;
        spanStartStyle = "";
      }
      text = allText.slice(at, at = styles[i++]);
      style = interpretTokenStyle(styles[i++], builder.cm.options);
    }
  }
}


// These objects are used to represent the visible (currently drawn)
// part of the document. A LineView may correspond to multiple
// logical lines, if those are connected by collapsed ranges.
function LineView(doc, line, lineN) {
  // The starting line
  this.line = line;
  // Continuing lines, if any
  this.rest = visualLineContinued(line);
  // Number of logical lines in this visual line
  this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1;
  this.node = this.text = null;
  this.hidden = lineIsHidden(doc, line);
}

// Create a range of LineView objects for the given lines.
function buildViewArray(cm, from, to) {
  var array = [], nextPos;
  for (var pos = from; pos < to; pos = nextPos) {
    var view = new LineView(cm.doc, getLine(cm.doc, pos), pos);
    nextPos = pos + view.size;
    array.push(view);
  }
  return array
}

var operationGroup = null;

function pushOperation(op) {
  if (operationGroup) {
    operationGroup.ops.push(op);
  } else {
    op.ownsGroup = operationGroup = {
      ops: [op],
      delayedCallbacks: []
    };
  }
}

function fireCallbacksForOps(group) {
  // Calls delayed callbacks and cursorActivity handlers until no
  // new ones appear
  var callbacks = group.delayedCallbacks, i = 0;
  do {
    for (; i < callbacks.length; i++)
      { callbacks[i].call(null); }
    for (var j = 0; j < group.ops.length; j++) {
      var op = group.ops[j];
      if (op.cursorActivityHandlers)
        { while (op.cursorActivityCalled < op.cursorActivityHandlers.length)
          { op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm); } }
    }
  } while (i < callbacks.length)
}

function finishOperation(op, endCb) {
  var group = op.ownsGroup;
  if (!group) { return }

  try { fireCallbacksForOps(group); }
  finally {
    operationGroup = null;
    endCb(group);
  }
}

var orphanDelayedCallbacks = null;

// Often, we want to signal events at a point where we are in the
// middle of some work, but don't want the handler to start calling
// other methods on the editor, which might be in an inconsistent
// state or simply not expect any other events to happen.
// signalLater looks whether there are any handlers, and schedules
// them to be executed when the last operation ends, or, if no
// operation is active, when a timeout fires.
function signalLater(emitter, type /*, values...*/) {
  var arr = getHandlers(emitter, type);
  if (!arr.length) { return }
  var args = Array.prototype.slice.call(arguments, 2), list;
  if (operationGroup) {
    list = operationGroup.delayedCallbacks;
  } else if (orphanDelayedCallbacks) {
    list = orphanDelayedCallbacks;
  } else {
    list = orphanDelayedCallbacks = [];
    setTimeout(fireOrphanDelayed, 0);
  }
  var loop = function ( i ) {
    list.push(function () { return arr[i].apply(null, args); });
  };

  for (var i = 0; i < arr.length; ++i)
    loop( i );
}

function fireOrphanDelayed() {
  var delayed = orphanDelayedCallbacks;
  orphanDelayedCallbacks = null;
  for (var i = 0; i < delayed.length; ++i) { delayed[i](); }
}

// When an aspect of a line changes, a string is added to
// lineView.changes. This updates the relevant part of the line's
// DOM structure.
function updateLineForChanges(cm, lineView, lineN, dims) {
  for (var j = 0; j < lineView.changes.length; j++) {
    var type = lineView.changes[j];
    if (type == "text") { updateLineText(cm, lineView); }
    else if (type == "gutter") { updateLineGutter(cm, lineView, lineN, dims); }
    else if (type == "class") { updateLineClasses(cm, lineView); }
    else if (type == "widget") { updateLineWidgets(cm, lineView, dims); }
  }
  lineView.changes = null;
}

// Lines with gutter elements, widgets or a background class need to
// be wrapped, and have the extra elements added to the wrapper div
function ensureLineWrapped(lineView) {
  if (lineView.node == lineView.text) {
    lineView.node = elt("div", null, null, "position: relative");
    if (lineView.text.parentNode)
      { lineView.text.parentNode.replaceChild(lineView.node, lineView.text); }
    lineView.node.appendChild(lineView.text);
    if (ie && ie_version < 8) { lineView.node.style.zIndex = 2; }
  }
  return lineView.node
}

function updateLineBackground(cm, lineView) {
  var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass;
  if (cls) { cls += " CodeMirror-linebackground"; }
  if (lineView.background) {
    if (cls) { lineView.background.className = cls; }
    else { lineView.background.parentNode.removeChild(lineView.background); lineView.background = null; }
  } else if (cls) {
    var wrap = ensureLineWrapped(lineView);
    lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild);
    cm.display.input.setUneditable(lineView.background);
  }
}

// Wrapper around buildLineContent which will reuse the structure
// in display.externalMeasured when possible.
function getLineContent(cm, lineView) {
  var ext = cm.display.externalMeasured;
  if (ext && ext.line == lineView.line) {
    cm.display.externalMeasured = null;
    lineView.measure = ext.measure;
    return ext.built
  }
  return buildLineContent(cm, lineView)
}

// Redraw the line's text. Interacts with the background and text
// classes because the mode may output tokens that influence these
// classes.
function updateLineText(cm, lineView) {
  var cls = lineView.text.className;
  var built = getLineContent(cm, lineView);
  if (lineView.text == lineView.node) { lineView.node = built.pre; }
  lineView.text.parentNode.replaceChild(built.pre, lineView.text);
  lineView.text = built.pre;
  if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
    lineView.bgClass = built.bgClass;
    lineView.textClass = built.textClass;
    updateLineClasses(cm, lineView);
  } else if (cls) {
    lineView.text.className = cls;
  }
}

function updateLineClasses(cm, lineView) {
  updateLineBackground(cm, lineView);
  if (lineView.line.wrapClass)
    { ensureLineWrapped(lineView).className = lineView.line.wrapClass; }
  else if (lineView.node != lineView.text)
    { lineView.node.className = ""; }
  var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass;
  lineView.text.className = textClass || "";
}

function updateLineGutter(cm, lineView, lineN, dims) {
  if (lineView.gutter) {
    lineView.node.removeChild(lineView.gutter);
    lineView.gutter = null;
  }
  if (lineView.gutterBackground) {
    lineView.node.removeChild(lineView.gutterBackground);
    lineView.gutterBackground = null;
  }
  if (lineView.line.gutterClass) {
    var wrap = ensureLineWrapped(lineView);
    lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass,
                                    ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px; width: " + (dims.gutterTotalWidth) + "px"));
    cm.display.input.setUneditable(lineView.gutterBackground);
    wrap.insertBefore(lineView.gutterBackground, lineView.text);
  }
  var markers = lineView.line.gutterMarkers;
  if (cm.options.lineNumbers || markers) {
    var wrap$1 = ensureLineWrapped(lineView);
    var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px"));
    cm.display.input.setUneditable(gutterWrap);
    wrap$1.insertBefore(gutterWrap, lineView.text);
    if (lineView.line.gutterClass)
      { gutterWrap.className += " " + lineView.line.gutterClass; }
    if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
      { lineView.lineNumber = gutterWrap.appendChild(
        elt("div", lineNumberFor(cm.options, lineN),
            "CodeMirror-linenumber CodeMirror-gutter-elt",
            ("left: " + (dims.gutterLeft["CodeMirror-linenumbers"]) + "px; width: " + (cm.display.lineNumInnerWidth) + "px"))); }
    if (markers) { for (var k = 0; k < cm.options.gutters.length; ++k) {
      var id = cm.options.gutters[k], found = markers.hasOwnProperty(id) && markers[id];
      if (found)
        { gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt",
                                   ("left: " + (dims.gutterLeft[id]) + "px; width: " + (dims.gutterWidth[id]) + "px"))); }
    } }
  }
}

function updateLineWidgets(cm, lineView, dims) {
  if (lineView.alignable) { lineView.alignable = null; }
  for (var node = lineView.node.firstChild, next = (void 0); node; node = next) {
    next = node.nextSibling;
    if (node.className == "CodeMirror-linewidget")
      { lineView.node.removeChild(node); }
  }
  insertLineWidgets(cm, lineView, dims);
}

// Build a line's DOM representation from scratch
function buildLineElement(cm, lineView, lineN, dims) {
  var built = getLineContent(cm, lineView);
  lineView.text = lineView.node = built.pre;
  if (built.bgClass) { lineView.bgClass = built.bgClass; }
  if (built.textClass) { lineView.textClass = built.textClass; }

  updateLineClasses(cm, lineView);
  updateLineGutter(cm, lineView, lineN, dims);
  insertLineWidgets(cm, lineView, dims);
  return lineView.node
}

// A lineView may contain multiple logical lines (when merged by
// collapsed spans). The widgets for all of them need to be drawn.
function insertLineWidgets(cm, lineView, dims) {
  insertLineWidgetsFor(cm, lineView.line, lineView, dims, true);
  if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
    { insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false); } }
}

function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
  if (!line.widgets) { return }
  var wrap = ensureLineWrapped(lineView);
  for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
    var widget = ws[i], node = elt("div", [widget.node], "CodeMirror-linewidget");
    if (!widget.handleMouseEvents) { node.setAttribute("cm-ignore-events", "true"); }
    positionLineWidget(widget, node, lineView, dims);
    cm.display.input.setUneditable(node);
    if (allowAbove && widget.above)
      { wrap.insertBefore(node, lineView.gutter || lineView.text); }
    else
      { wrap.appendChild(node); }
    signalLater(widget, "redraw");
  }
}

function positionLineWidget(widget, node, lineView, dims) {
  if (widget.noHScroll) {
    (lineView.alignable || (lineView.alignable = [])).push(node);
    var width = dims.wrapperWidth;
    node.style.left = dims.fixedPos + "px";
    if (!widget.coverGutter) {
      width -= dims.gutterTotalWidth;
      node.style.paddingLeft = dims.gutterTotalWidth + "px";
    }
    node.style.width = width + "px";
  }
  if (widget.coverGutter) {
    node.style.zIndex = 5;
    node.style.position = "relative";
    if (!widget.noHScroll) { node.style.marginLeft = -dims.gutterTotalWidth + "px"; }
  }
}

function widgetHeight(widget) {
  if (widget.height != null) { return widget.height }
  var cm = widget.doc.cm;
  if (!cm) { return 0 }
  if (!contains(document.body, widget.node)) {
    var parentStyle = "position: relative;";
    if (widget.coverGutter)
      { parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;"; }
    if (widget.noHScroll)
      { parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;"; }
    removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle));
  }
  return widget.height = widget.node.parentNode.offsetHeight
}

// Return true when the given mouse event happened in a widget
function eventInWidget(display, e) {
  for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
    if (!n || (n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true") ||
        (n.parentNode == display.sizer && n != display.mover))
      { return true }
  }
}

// POSITION MEASUREMENT

function paddingTop(display) {return display.lineSpace.offsetTop}
function paddingVert(display) {return display.mover.offsetHeight - display.lineSpace.offsetHeight}
function paddingH(display) {
  if (display.cachedPaddingH) { return display.cachedPaddingH }
  var e = removeChildrenAndAdd(display.measure, elt("pre", "x"));
  var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle;
  var data = {left: parseInt(style.paddingLeft), right: parseInt(style.paddingRight)};
  if (!isNaN(data.left) && !isNaN(data.right)) { display.cachedPaddingH = data; }
  return data
}

function scrollGap(cm) { return scrollerGap - cm.display.nativeBarWidth }
function displayWidth(cm) {
  return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth
}
function displayHeight(cm) {
  return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight
}

// Ensure the lineView.wrapping.heights array is populated. This is
// an array of bottom offsets for the lines that make up a drawn
// line. When lineWrapping is on, there might be more than one
// height.
function ensureLineHeights(cm, lineView, rect) {
  var wrapping = cm.options.lineWrapping;
  var curWidth = wrapping && displayWidth(cm);
  if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
    var heights = lineView.measure.heights = [];
    if (wrapping) {
      lineView.measure.width = curWidth;
      var rects = lineView.text.firstChild.getClientRects();
      for (var i = 0; i < rects.length - 1; i++) {
        var cur = rects[i], next = rects[i + 1];
        if (Math.abs(cur.bottom - next.bottom) > 2)
          { heights.push((cur.bottom + next.top) / 2 - rect.top); }
      }
    }
    heights.push(rect.bottom - rect.top);
  }
}

// Find a line map (mapping character offsets to text nodes) and a
// measurement cache for the given line number. (A line view might
// contain multiple lines when collapsed ranges are present.)
function mapFromLineView(lineView, line, lineN) {
  if (lineView.line == line)
    { return {map: lineView.measure.map, cache: lineView.measure.cache} }
  for (var i = 0; i < lineView.rest.length; i++)
    { if (lineView.rest[i] == line)
      { return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i]} } }
  for (var i$1 = 0; i$1 < lineView.rest.length; i$1++)
    { if (lineNo(lineView.rest[i$1]) > lineN)
      { return {map: lineView.measure.maps[i$1], cache: lineView.measure.caches[i$1], before: true} } }
}

// Render a line into the hidden node display.externalMeasured. Used
// when measurement is needed for a line that's not in the viewport.
function updateExternalMeasurement(cm, line) {
  line = visualLine(line);
  var lineN = lineNo(line);
  var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN);
  view.lineN = lineN;
  var built = view.built = buildLineContent(cm, view);
  view.text = built.pre;
  removeChildrenAndAdd(cm.display.lineMeasure, built.pre);
  return view
}

// Get a {top, bottom, left, right} box (in line-local coordinates)
// for a given character.
function measureChar(cm, line, ch, bias) {
  return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias)
}

// Find a line view that corresponds to the given line number.
function findViewForLine(cm, lineN) {
  if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo)
    { return cm.display.view[findViewIndex(cm, lineN)] }
  var ext = cm.display.externalMeasured;
  if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size)
    { return ext }
}

// Measurement can be split in two steps, the set-up work that
// applies to the whole line, and the measurement of the actual
// character. Functions like coordsChar, that need to do a lot of
// measurements in a row, can thus ensure that the set-up work is
// only done once.
function prepareMeasureForLine(cm, line) {
  var lineN = lineNo(line);
  var view = findViewForLine(cm, lineN);
  if (view && !view.text) {
    view = null;
  } else if (view && view.changes) {
    updateLineForChanges(cm, view, lineN, getDimensions(cm));
    cm.curOp.forceUpdate = true;
  }
  if (!view)
    { view = updateExternalMeasurement(cm, line); }

  var info = mapFromLineView(view, line, lineN);
  return {
    line: line, view: view, rect: null,
    map: info.map, cache: info.cache, before: info.before,
    hasHeights: false
  }
}

// Given a prepared measurement object, measures the position of an
// actual character (or fetches it from the cache).
function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
  if (prepared.before) { ch = -1; }
  var key = ch + (bias || ""), found;
  if (prepared.cache.hasOwnProperty(key)) {
    found = prepared.cache[key];
  } else {
    if (!prepared.rect)
      { prepared.rect = prepared.view.text.getBoundingClientRect(); }
    if (!prepared.hasHeights) {
      ensureLineHeights(cm, prepared.view, prepared.rect);
      prepared.hasHeights = true;
    }
    found = measureCharInner(cm, prepared, ch, bias);
    if (!found.bogus) { prepared.cache[key] = found; }
  }
  return {left: found.left, right: found.right,
          top: varHeight ? found.rtop : found.top,
          bottom: varHeight ? found.rbottom : found.bottom}
}

var nullRect = {left: 0, right: 0, top: 0, bottom: 0};

function nodeAndOffsetInLineMap(map, ch, bias) {
  var node, start, end, collapse, mStart, mEnd;
  // First, search the line map for the text node corresponding to,
  // or closest to, the target character.
  for (var i = 0; i < map.length; i += 3) {
    mStart = map[i];
    mEnd = map[i + 1];
    if (ch < mStart) {
      start = 0; end = 1;
      collapse = "left";
    } else if (ch < mEnd) {
      start = ch - mStart;
      end = start + 1;
    } else if (i == map.length - 3 || ch == mEnd && map[i + 3] > ch) {
      end = mEnd - mStart;
      start = end - 1;
      if (ch >= mEnd) { collapse = "right"; }
    }
    if (start != null) {
      node = map[i + 2];
      if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right"))
        { collapse = bias; }
      if (bias == "left" && start == 0)
        { while (i && map[i - 2] == map[i - 3] && map[i - 1].insertLeft) {
          node = map[(i -= 3) + 2];
          collapse = "left";
        } }
      if (bias == "right" && start == mEnd - mStart)
        { while (i < map.length - 3 && map[i + 3] == map[i + 4] && !map[i + 5].insertLeft) {
          node = map[(i += 3) + 2];
          collapse = "right";
        } }
      break
    }
  }
  return {node: node, start: start, end: end, collapse: collapse, coverStart: mStart, coverEnd: mEnd}
}

function getUsefulRect(rects, bias) {
  var rect = nullRect;
  if (bias == "left") { for (var i = 0; i < rects.length; i++) {
    if ((rect = rects[i]).left != rect.right) { break }
  } } else { for (var i$1 = rects.length - 1; i$1 >= 0; i$1--) {
    if ((rect = rects[i$1]).left != rect.right) { break }
  } }
  return rect
}

function measureCharInner(cm, prepared, ch, bias) {
  var place = nodeAndOffsetInLineMap(prepared.map, ch, bias);
  var node = place.node, start = place.start, end = place.end, collapse = place.collapse;

  var rect;
  if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
    for (var i$1 = 0; i$1 < 4; i$1++) { // Retry a maximum of 4 times when nonsense rectangles are returned
      while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) { --start; }
      while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) { ++end; }
      if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart)
        { rect = node.parentNode.getBoundingClientRect(); }
      else
        { rect = getUsefulRect(range(node, start, end).getClientRects(), bias); }
      if (rect.left || rect.right || start == 0) { break }
      end = start;
      start = start - 1;
      collapse = "right";
    }
    if (ie && ie_version < 11) { rect = maybeUpdateRectForZooming(cm.display.measure, rect); }
  } else { // If it is a widget, simply get the box for the whole widget.
    if (start > 0) { collapse = bias = "right"; }
    var rects;
    if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1)
      { rect = rects[bias == "right" ? rects.length - 1 : 0]; }
    else
      { rect = node.getBoundingClientRect(); }
  }
  if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
    var rSpan = node.parentNode.getClientRects()[0];
    if (rSpan)
      { rect = {left: rSpan.left, right: rSpan.left + charWidth(cm.display), top: rSpan.top, bottom: rSpan.bottom}; }
    else
      { rect = nullRect; }
  }

  var rtop = rect.top - prepared.rect.top, rbot = rect.bottom - prepared.rect.top;
  var mid = (rtop + rbot) / 2;
  var heights = prepared.view.measure.heights;
  var i = 0;
  for (; i < heights.length - 1; i++)
    { if (mid < heights[i]) { break } }
  var top = i ? heights[i - 1] : 0, bot = heights[i];
  var result = {left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
                right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
                top: top, bottom: bot};
  if (!rect.left && !rect.right) { result.bogus = true; }
  if (!cm.options.singleCursorHeightPerLine) { result.rtop = rtop; result.rbottom = rbot; }

  return result
}

// Work around problem with bounding client rects on ranges being
// returned incorrectly when zoomed on IE10 and below.
function maybeUpdateRectForZooming(measure, rect) {
  if (!window.screen || screen.logicalXDPI == null ||
      screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure))
    { return rect }
  var scaleX = screen.logicalXDPI / screen.deviceXDPI;
  var scaleY = screen.logicalYDPI / screen.deviceYDPI;
  return {left: rect.left * scaleX, right: rect.right * scaleX,
          top: rect.top * scaleY, bottom: rect.bottom * scaleY}
}

function clearLineMeasurementCacheFor(lineView) {
  if (lineView.measure) {
    lineView.measure.cache = {};
    lineView.measure.heights = null;
    if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
      { lineView.measure.caches[i] = {}; } }
  }
}

function clearLineMeasurementCache(cm) {
  cm.display.externalMeasure = null;
  removeChildren(cm.display.lineMeasure);
  for (var i = 0; i < cm.display.view.length; i++)
    { clearLineMeasurementCacheFor(cm.display.view[i]); }
}

function clearCaches(cm) {
  clearLineMeasurementCache(cm);
  cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null;
  if (!cm.options.lineWrapping) { cm.display.maxLineChanged = true; }
  cm.display.lineNumChars = null;
}

function pageScrollX() {
  // Work around https://bugs.chromium.org/p/chromium/issues/detail?id=489206
  // which causes page_Offset and bounding client rects to use
  // different reference viewports and invalidate our calculations.
  if (chrome && android) { return -(document.body.getBoundingClientRect().left - parseInt(getComputedStyle(document.body).marginLeft)) }
  return window.pageXOffset || (document.documentElement || document.body).scrollLeft
}
function pageScrollY() {
  if (chrome && android) { return -(document.body.getBoundingClientRect().top - parseInt(getComputedStyle(document.body).marginTop)) }
  return window.pageYOffset || (document.documentElement || document.body).scrollTop
}

// Converts a {top, bottom, left, right} box from line-local
// coordinates into another coordinate system. Context may be one of
// "line", "div" (display.lineDiv), "local"./null (editor), "window",
// or "page".
function intoCoordSystem(cm, lineObj, rect, context, includeWidgets) {
  if (!includeWidgets && lineObj.widgets) { for (var i = 0; i < lineObj.widgets.length; ++i) { if (lineObj.widgets[i].above) {
    var size = widgetHeight(lineObj.widgets[i]);
    rect.top += size; rect.bottom += size;
  } } }
  if (context == "line") { return rect }
  if (!context) { context = "local"; }
  var yOff = heightAtLine(lineObj);
  if (context == "local") { yOff += paddingTop(cm.display); }
  else { yOff -= cm.display.viewOffset; }
  if (context == "page" || context == "window") {
    var lOff = cm.display.lineSpace.getBoundingClientRect();
    yOff += lOff.top + (context == "window" ? 0 : pageScrollY());
    var xOff = lOff.left + (context == "window" ? 0 : pageScrollX());
    rect.left += xOff; rect.right += xOff;
  }
  rect.top += yOff; rect.bottom += yOff;
  return rect
}

// Coverts a box from "div" coords to another coordinate system.
// Context may be "window", "page", "div", or "local"./null.
function fromCoordSystem(cm, coords, context) {
  if (context == "div") { return coords }
  var left = coords.left, top = coords.top;
  // First move into "page" coordinate system
  if (context == "page") {
    left -= pageScrollX();
    top -= pageScrollY();
  } else if (context == "local" || !context) {
    var localBox = cm.display.sizer.getBoundingClientRect();
    left += localBox.left;
    top += localBox.top;
  }

  var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect();
  return {left: left - lineSpaceBox.left, top: top - lineSpaceBox.top}
}

function charCoords(cm, pos, context, lineObj, bias) {
  if (!lineObj) { lineObj = getLine(cm.doc, pos.line); }
  return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context)
}

// Returns a box for a given cursor position, which may have an
// 'other' property containing the position of the secondary cursor
// on a bidi boundary.
// A cursor Pos(line, char, "before") is on the same visual line as `char - 1`
// and after `char - 1` in writing order of `char - 1`
// A cursor Pos(line, char, "after") is on the same visual line as `char`
// and before `char` in writing order of `char`
// Examples (upper-case letters are RTL, lower-case are LTR):
//     Pos(0, 1, ...)
//     before   after
// ab     a|b     a|b
// aB     a|B     aB|
// Ab     |Ab     A|b
// AB     B|A     B|A
// Every position after the last character on a line is considered to stick
// to the last character on the line.
function cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
  lineObj = lineObj || getLine(cm.doc, pos.line);
  if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
  function get(ch, right) {
    var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight);
    if (right) { m.left = m.right; } else { m.right = m.left; }
    return intoCoordSystem(cm, lineObj, m, context)
  }
  var order = getOrder(lineObj, cm.doc.direction), ch = pos.ch, sticky = pos.sticky;
  if (ch >= lineObj.text.length) {
    ch = lineObj.text.length;
    sticky = "before";
  } else if (ch <= 0) {
    ch = 0;
    sticky = "after";
  }
  if (!order) { return get(sticky == "before" ? ch - 1 : ch, sticky == "before") }

  function getBidi(ch, partPos, invert) {
    var part = order[partPos], right = (part.level % 2) != 0;
    return get(invert ? ch - 1 : ch, right != invert)
  }
  var partPos = getBidiPartAt(order, ch, sticky);
  var other = bidiOther;
  var val = getBidi(ch, partPos, sticky == "before");
  if (other != null) { val.other = getBidi(ch, other, sticky != "before"); }
  return val
}

// Used to cheaply estimate the coordinates for a position. Used for
// intermediate scroll updates.
function estimateCoords(cm, pos) {
  var left = 0;
  pos = clipPos(cm.doc, pos);
  if (!cm.options.lineWrapping) { left = charWidth(cm.display) * pos.ch; }
  var lineObj = getLine(cm.doc, pos.line);
  var top = heightAtLine(lineObj) + paddingTop(cm.display);
  return {left: left, right: left, top: top, bottom: top + lineObj.height}
}

// Positions returned by coordsChar contain some extra information.
// xRel is the relative x position of the input coordinates compared
// to the found position (so xRel > 0 means the coordinates are to
// the right of the character position, for example). When outside
// is true, that means the coordinates lie outside the line's
// vertical range.
function PosWithInfo(line, ch, sticky, outside, xRel) {
  var pos = Pos(line, ch, sticky);
  pos.xRel = xRel;
  if (outside) { pos.outside = true; }
  return pos
}

// Compute the character position closest to the given coordinates.
// Input must be lineSpace-local ("div" coordinate system).
function coordsChar(cm, x, y) {
  var doc = cm.doc;
  y += cm.display.viewOffset;
  if (y < 0) { return PosWithInfo(doc.first, 0, null, true, -1) }
  var lineN = lineAtHeight(doc, y), last = doc.first + doc.size - 1;
  if (lineN > last)
    { return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, null, true, 1) }
  if (x < 0) { x = 0; }

  var lineObj = getLine(doc, lineN);
  for (;;) {
    var found = coordsCharInner(cm, lineObj, lineN, x, y);
    var merged = collapsedSpanAtEnd(lineObj);
    var mergedPos = merged && merged.find(0, true);
    if (merged && (found.ch > mergedPos.from.ch || found.ch == mergedPos.from.ch && found.xRel > 0))
      { lineN = lineNo(lineObj = mergedPos.to.line); }
    else
      { return found }
  }
}

function wrappedLineExtent(cm, lineObj, preparedMeasure, y) {
  var measure = function (ch) { return intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, ch), "line"); };
  var end = lineObj.text.length;
  var begin = findFirst(function (ch) { return measure(ch - 1).bottom <= y; }, end, 0);
  end = findFirst(function (ch) { return measure(ch).top > y; }, begin, end);
  return {begin: begin, end: end}
}

function wrappedLineExtentChar(cm, lineObj, preparedMeasure, target) {
  var targetTop = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, target), "line").top;
  return wrappedLineExtent(cm, lineObj, preparedMeasure, targetTop)
}

function coordsCharInner(cm, lineObj, lineNo, x, y) {
  y -= heightAtLine(lineObj);
  var begin = 0, end = lineObj.text.length;
  var preparedMeasure = prepareMeasureForLine(cm, lineObj);
  var pos;
  var order = getOrder(lineObj, cm.doc.direction);
  if (order) {
    if (cm.options.lineWrapping) {
      var assign;
      ((assign = wrappedLineExtent(cm, lineObj, preparedMeasure, y), begin = assign.begin, end = assign.end, assign));
    }
    pos = new Pos(lineNo, Math.floor(begin + (end - begin) / 2));
    var beginLeft = cursorCoords(cm, pos, "line", lineObj, preparedMeasure).left;
    var dir = beginLeft < x ? 1 : -1;
    var prevDiff, diff = beginLeft - x, prevPos;
    var steps = Math.ceil((end - begin) / 4);
    outer: do {
      prevDiff = diff;
      prevPos = pos;
      var i = 0;
      for (; i < steps; ++i) {
        var prevPos$1 = pos;
        pos = moveVisually(cm, lineObj, pos, dir);
        if (pos == null || pos.ch < begin || end <= (pos.sticky == "before" ? pos.ch - 1 : pos.ch)) {
          pos = prevPos$1;
          break outer
        }
      }
      diff = cursorCoords(cm, pos, "line", lineObj, preparedMeasure).left - x;
      if (steps > 1) {
        var diff_change_per_step = Math.abs(diff - prevDiff) / steps;
        steps = Math.min(steps, Math.ceil(Math.abs(diff) / diff_change_per_step));
        dir = diff < 0 ? 1 : -1;
      }
    } while (diff != 0 && (steps > 1 || ((dir < 0) != (diff < 0) && (Math.abs(diff) <= Math.abs(prevDiff)))))
    if (Math.abs(diff) > Math.abs(prevDiff)) {
      if ((diff < 0) == (prevDiff < 0)) { throw new Error("Broke out of infinite loop in coordsCharInner") }
      pos = prevPos;
    }
  } else {
    var ch = findFirst(function (ch) {
      var box = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, ch), "line");
      if (box.top > y) {
        // For the cursor stickiness
        end = Math.min(ch, end);
        return true
      }
      else if (box.bottom <= y) { return false }
      else if (box.left > x) { return true }
      else if (box.right < x) { return false }
      else { return (x - box.left < box.right - x) }
    }, begin, end);
    ch = skipExtendingChars(lineObj.text, ch, 1);
    pos = new Pos(lineNo, ch, ch == end ? "before" : "after");
  }
  var coords = cursorCoords(cm, pos, "line", lineObj, preparedMeasure);
  if (y < coords.top || coords.bottom < y) { pos.outside = true; }
  pos.xRel = x < coords.left ? -1 : (x > coords.right ? 1 : 0);
  return pos
}

var measureText;
// Compute the default text height.
function textHeight(display) {
  if (display.cachedTextHeight != null) { return display.cachedTextHeight }
  if (measureText == null) {
    measureText = elt("pre");
    // Measure a bunch of lines, for browsers that compute
    // fractional heights.
    for (var i = 0; i < 49; ++i) {
      measureText.appendChild(document.createTextNode("x"));
      measureText.appendChild(elt("br"));
    }
    measureText.appendChild(document.createTextNode("x"));
  }
  removeChildrenAndAdd(display.measure, measureText);
  var height = measureText.offsetHeight / 50;
  if (height > 3) { display.cachedTextHeight = height; }
  removeChildren(display.measure);
  return height || 1
}

// Compute the default character width.
function charWidth(display) {
  if (display.cachedCharWidth != null) { return display.cachedCharWidth }
  var anchor = elt("span", "xxxxxxxxxx");
  var pre = elt("pre", [anchor]);
  removeChildrenAndAdd(display.measure, pre);
  var rect = anchor.getBoundingClientRect(), width = (rect.right - rect.left) / 10;
  if (width > 2) { display.cachedCharWidth = width; }
  return width || 10
}

// Do a bulk-read of the DOM positions and sizes needed to draw the
// view, so that we don't interleave reading and writing to the DOM.
function getDimensions(cm) {
  var d = cm.display, left = {}, width = {};
  var gutterLeft = d.gutters.clientLeft;
  for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
    left[cm.options.gutters[i]] = n.offsetLeft + n.clientLeft + gutterLeft;
    width[cm.options.gutters[i]] = n.clientWidth;
  }
  return {fixedPos: compensateForHScroll(d),
          gutterTotalWidth: d.gutters.offsetWidth,
          gutterLeft: left,
          gutterWidth: width,
          wrapperWidth: d.wrapper.clientWidth}
}

// Computes display.scroller.scrollLeft + display.gutters.offsetWidth,
// but using getBoundingClientRect to get a sub-pixel-accurate
// result.
function compensateForHScroll(display) {
  return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left
}

// Returns a function that estimates the height of a line, to use as
// first approximation until the line becomes visible (and is thus
// properly measurable).
function estimateHeight(cm) {
  var th = textHeight(cm.display), wrapping = cm.options.lineWrapping;
  var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
  return function (line) {
    if (lineIsHidden(cm.doc, line)) { return 0 }

    var widgetsHeight = 0;
    if (line.widgets) { for (var i = 0; i < line.widgets.length; i++) {
      if (line.widgets[i].height) { widgetsHeight += line.widgets[i].height; }
    } }

    if (wrapping)
      { return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th }
    else
      { return widgetsHeight + th }
  }
}

function estimateLineHeights(cm) {
  var doc = cm.doc, est = estimateHeight(cm);
  doc.iter(function (line) {
    var estHeight = est(line);
    if (estHeight != line.height) { updateLineHeight(line, estHeight); }
  });
}

// Given a mouse event, find the corresponding position. If liberal
// is false, it checks whether a gutter or scrollbar was clicked,
// and returns null if it was. forRect is used by rectangular
// selections, and tries to estimate a character position even for
// coordinates beyond the right of the text.
function posFromMouse(cm, e, liberal, forRect) {
  var display = cm.display;
  if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") { return null }

  var x, y, space = display.lineSpace.getBoundingClientRect();
  // Fails unpredictably on IE[67] when mouse is dragged around quickly.
  try { x = e.clientX - space.left; y = e.clientY - space.top; }
  catch (e) { return null }
  var coords = coordsChar(cm, x, y), line;
  if (forRect && coords.xRel == 1 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
    var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length;
    coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff));
  }
  return coords
}

// Find the view element corresponding to a given line. Return null
// when the line isn't visible.
function findViewIndex(cm, n) {
  if (n >= cm.display.viewTo) { return null }
  n -= cm.display.viewFrom;
  if (n < 0) { return null }
  var view = cm.display.view;
  for (var i = 0; i < view.length; i++) {
    n -= view[i].size;
    if (n < 0) { return i }
  }
}

function updateSelection(cm) {
  cm.display.input.showSelection(cm.display.input.prepareSelection());
}

function prepareSelection(cm, primary) {
  var doc = cm.doc, result = {};
  var curFragment = result.cursors = document.createDocumentFragment();
  var selFragment = result.selection = document.createDocumentFragment();

  for (var i = 0; i < doc.sel.ranges.length; i++) {
    if (primary === false && i == doc.sel.primIndex) { continue }
    var range = doc.sel.ranges[i];
    if (range.from().line >= cm.display.viewTo || range.to().line < cm.display.viewFrom) { continue }
    var collapsed = range.empty();
    if (collapsed || cm.options.showCursorWhenSelecting)
      { drawSelectionCursor(cm, range.head, curFragment); }
    if (!collapsed)
      { drawSelectionRange(cm, range, selFragment); }
  }
  return result
}

// Draws a cursor for the given range
function drawSelectionCursor(cm, head, output) {
  var pos = cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine);

  var cursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor"));
  cursor.style.left = pos.left + "px";
  cursor.style.top = pos.top + "px";
  cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";

  if (pos.other) {
    // Secondary cursor, shown when on a 'jump' in bi-directional text
    var otherCursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor"));
    otherCursor.style.display = "";
    otherCursor.style.left = pos.other.left + "px";
    otherCursor.style.top = pos.other.top + "px";
    otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
  }
}

// Draws the given range as a highlighted selection
function drawSelectionRange(cm, range, output) {
  var display = cm.display, doc = cm.doc;
  var fragment = document.createDocumentFragment();
  var padding = paddingH(cm.display), leftSide = padding.left;
  var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right;

  function add(left, top, width, bottom) {
    if (top < 0) { top = 0; }
    top = Math.round(top);
    bottom = Math.round(bottom);
    fragment.appendChild(elt("div", null, "CodeMirror-selected", ("position: absolute; left: " + left + "px;\n                             top: " + top + "px; width: " + (width == null ? rightSide - left : width) + "px;\n                             height: " + (bottom - top) + "px")));
  }

  function drawForLine(line, fromArg, toArg) {
    var lineObj = getLine(doc, line);
    var lineLen = lineObj.text.length;
    var start, end;
    function coords(ch, bias) {
      return charCoords(cm, Pos(line, ch), "div", lineObj, bias)
    }

    iterateBidiSections(getOrder(lineObj, doc.direction), fromArg || 0, toArg == null ? lineLen : toArg, function (from, to, dir) {
      var leftPos = coords(from, "left"), rightPos, left, right;
      if (from == to) {
        rightPos = leftPos;
        left = right = leftPos.left;
      } else {
        rightPos = coords(to - 1, "right");
        if (dir == "rtl") { var tmp = leftPos; leftPos = rightPos; rightPos = tmp; }
        left = leftPos.left;
        right = rightPos.right;
      }
      if (fromArg == null && from == 0) { left = leftSide; }
      if (rightPos.top - leftPos.top > 3) { // Different lines, draw top part
        add(left, leftPos.top, null, leftPos.bottom);
        left = leftSide;
        if (leftPos.bottom < rightPos.top) { add(left, leftPos.bottom, null, rightPos.top); }
      }
      if (toArg == null && to == lineLen) { right = rightSide; }
      if (!start || leftPos.top < start.top || leftPos.top == start.top && leftPos.left < start.left)
        { start = leftPos; }
      if (!end || rightPos.bottom > end.bottom || rightPos.bottom == end.bottom && rightPos.right > end.right)
        { end = rightPos; }
      if (left < leftSide + 1) { left = leftSide; }
      add(left, rightPos.top, right - left, rightPos.bottom);
    });
    return {start: start, end: end}
  }

  var sFrom = range.from(), sTo = range.to();
  if (sFrom.line == sTo.line) {
    drawForLine(sFrom.line, sFrom.ch, sTo.ch);
  } else {
    var fromLine = getLine(doc, sFrom.line), toLine = getLine(doc, sTo.line);
    var singleVLine = visualLine(fromLine) == visualLine(toLine);
    var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end;
    var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start;
    if (singleVLine) {
      if (leftEnd.top < rightStart.top - 2) {
        add(leftEnd.right, leftEnd.top, null, leftEnd.bottom);
        add(leftSide, rightStart.top, rightStart.left, rightStart.bottom);
      } else {
        add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom);
      }
    }
    if (leftEnd.bottom < rightStart.top)
      { add(leftSide, leftEnd.bottom, null, rightStart.top); }
  }

  output.appendChild(fragment);
}

// Cursor-blinking
function restartBlink(cm) {
  if (!cm.state.focused) { return }
  var display = cm.display;
  clearInterval(display.blinker);
  var on = true;
  display.cursorDiv.style.visibility = "";
  if (cm.options.cursorBlinkRate > 0)
    { display.blinker = setInterval(function () { return display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden"; },
      cm.options.cursorBlinkRate); }
  else if (cm.options.cursorBlinkRate < 0)
    { display.cursorDiv.style.visibility = "hidden"; }
}

function ensureFocus(cm) {
  if (!cm.state.focused) { cm.display.input.focus(); onFocus(cm); }
}

function delayBlurEvent(cm) {
  cm.state.delayingBlurEvent = true;
  setTimeout(function () { if (cm.state.delayingBlurEvent) {
    cm.state.delayingBlurEvent = false;
    onBlur(cm);
  } }, 100);
}

function onFocus(cm, e) {
  if (cm.state.delayingBlurEvent) { cm.state.delayingBlurEvent = false; }

  if (cm.options.readOnly == "nocursor") { return }
  if (!cm.state.focused) {
    signal(cm, "focus", cm, e);
    cm.state.focused = true;
    addClass(cm.display.wrapper, "CodeMirror-focused");
    // This test prevents this from firing when a context
    // menu is closed (since the input reset would kill the
    // select-all detection hack)
    if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
      cm.display.input.reset();
      if (webkit) { setTimeout(function () { return cm.display.input.reset(true); }, 20); } // Issue #1730
    }
    cm.display.input.receivedFocus();
  }
  restartBlink(cm);
}
function onBlur(cm, e) {
  if (cm.state.delayingBlurEvent) { return }

  if (cm.state.focused) {
    signal(cm, "blur", cm, e);
    cm.state.focused = false;
    rmClass(cm.display.wrapper, "CodeMirror-focused");
  }
  clearInterval(cm.display.blinker);
  setTimeout(function () { if (!cm.state.focused) { cm.display.shift = false; } }, 150);
}

// Read the actual heights of the rendered lines, and update their
// stored heights to match.
function updateHeightsInViewport(cm) {
  var display = cm.display;
  var prevBottom = display.lineDiv.offsetTop;
  for (var i = 0; i < display.view.length; i++) {
    var cur = display.view[i], height = (void 0);
    if (cur.hidden) { continue }
    if (ie && ie_version < 8) {
      var bot = cur.node.offsetTop + cur.node.offsetHeight;
      height = bot - prevBottom;
      prevBottom = bot;
    } else {
      var box = cur.node.getBoundingClientRect();
      height = box.bottom - box.top;
    }
    var diff = cur.line.height - height;
    if (height < 2) { height = textHeight(display); }
    if (diff > .005 || diff < -.005) {
      updateLineHeight(cur.line, height);
      updateWidgetHeight(cur.line);
      if (cur.rest) { for (var j = 0; j < cur.rest.length; j++)
        { updateWidgetHeight(cur.rest[j]); } }
    }
  }
}

// Read and store the height of line widgets associated with the
// given line.
function updateWidgetHeight(line) {
  if (line.widgets) { for (var i = 0; i < line.widgets.length; ++i)
    { line.widgets[i].height = line.widgets[i].node.parentNode.offsetHeight; } }
}

// Compute the lines that are visible in a given viewport (defaults
// the the current scroll position). viewport may contain top,
// height, and ensure (see op.scrollToPos) properties.
function visibleLines(display, doc, viewport) {
  var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop;
  top = Math.floor(top - paddingTop(display));
  var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight;

  var from = lineAtHeight(doc, top), to = lineAtHeight(doc, bottom);
  // Ensure is a {from: {line, ch}, to: {line, ch}} object, and
  // forces those lines into the viewport (if possible).
  if (viewport && viewport.ensure) {
    var ensureFrom = viewport.ensure.from.line, ensureTo = viewport.ensure.to.line;
    if (ensureFrom < from) {
      from = ensureFrom;
      to = lineAtHeight(doc, heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight);
    } else if (Math.min(ensureTo, doc.lastLine()) >= to) {
      from = lineAtHeight(doc, heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight);
      to = ensureTo;
    }
  }
  return {from: from, to: Math.max(to, from + 1)}
}

// Re-align line numbers and gutter marks to compensate for
// horizontal scrolling.
function alignHorizontally(cm) {
  var display = cm.display, view = display.view;
  if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) { return }
  var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
  var gutterW = display.gutters.offsetWidth, left = comp + "px";
  for (var i = 0; i < view.length; i++) { if (!view[i].hidden) {
    if (cm.options.fixedGutter) {
      if (view[i].gutter)
        { view[i].gutter.style.left = left; }
      if (view[i].gutterBackground)
        { view[i].gutterBackground.style.left = left; }
    }
    var align = view[i].alignable;
    if (align) { for (var j = 0; j < align.length; j++)
      { align[j].style.left = left; } }
  } }
  if (cm.options.fixedGutter)
    { display.gutters.style.left = (comp + gutterW) + "px"; }
}

// Used to ensure that the line number gutter is still the right
// size for the current document size. Returns true when an update
// is needed.
function maybeUpdateLineNumberWidth(cm) {
  if (!cm.options.lineNumbers) { return false }
  var doc = cm.doc, last = lineNumberFor(cm.options, doc.first + doc.size - 1), display = cm.display;
  if (last.length != display.lineNumChars) {
    var test = display.measure.appendChild(elt("div", [elt("div", last)],
                                               "CodeMirror-linenumber CodeMirror-gutter-elt"));
    var innerW = test.firstChild.offsetWidth, padding = test.offsetWidth - innerW;
    display.lineGutter.style.width = "";
    display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1;
    display.lineNumWidth = display.lineNumInnerWidth + padding;
    display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
    display.lineGutter.style.width = display.lineNumWidth + "px";
    updateGutterSpace(cm);
    return true
  }
  return false
}

// SCROLLING THINGS INTO VIEW

// If an editor sits on the top or bottom of the window, partially
// scrolled out of view, this ensures that the cursor is visible.
function maybeScrollWindow(cm, rect) {
  if (signalDOMEvent(cm, "scrollCursorIntoView")) { return }

  var display = cm.display, box = display.sizer.getBoundingClientRect(), doScroll = null;
  if (rect.top + box.top < 0) { doScroll = true; }
  else if (rect.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) { doScroll = false; }
  if (doScroll != null && !phantom) {
    var scrollNode = elt("div", "\u200b", null, ("position: absolute;\n                         top: " + (rect.top - display.viewOffset - paddingTop(cm.display)) + "px;\n                         height: " + (rect.bottom - rect.top + scrollGap(cm) + display.barHeight) + "px;\n                         left: " + (rect.left) + "px; width: " + (Math.max(2, rect.right - rect.left)) + "px;"));
    cm.display.lineSpace.appendChild(scrollNode);
    scrollNode.scrollIntoView(doScroll);
    cm.display.lineSpace.removeChild(scrollNode);
  }
}

// Scroll a given position into view (immediately), verifying that
// it actually became visible (as line heights are accurately
// measured, the position of something may 'drift' during drawing).
function scrollPosIntoView(cm, pos, end, margin) {
  if (margin == null) { margin = 0; }
  var rect;
  if (!cm.options.lineWrapping && pos == end) {
    // Set pos and end to the cursor positions around the character pos sticks to
    // If pos.sticky == "before", that is around pos.ch - 1, otherwise around pos.ch
    // If pos == Pos(_, 0, "before"), pos and end are unchanged
    pos = pos.ch ? Pos(pos.line, pos.sticky == "before" ? pos.ch - 1 : pos.ch, "after") : pos;
    end = pos.sticky == "before" ? Pos(pos.line, pos.ch + 1, "before") : pos;
  }
  for (var limit = 0; limit < 5; limit++) {
    var changed = false;
    var coords = cursorCoords(cm, pos);
    var endCoords = !end || end == pos ? coords : cursorCoords(cm, end);
    rect = {left: Math.min(coords.left, endCoords.left),
            top: Math.min(coords.top, endCoords.top) - margin,
            right: Math.max(coords.left, endCoords.left),
            bottom: Math.max(coords.bottom, endCoords.bottom) + margin};
    var scrollPos = calculateScrollPos(cm, rect);
    var startTop = cm.doc.scrollTop, startLeft = cm.doc.scrollLeft;
    if (scrollPos.scrollTop != null) {
      updateScrollTop(cm, scrollPos.scrollTop);
      if (Math.abs(cm.doc.scrollTop - startTop) > 1) { changed = true; }
    }
    if (scrollPos.scrollLeft != null) {
      setScrollLeft(cm, scrollPos.scrollLeft);
      if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) { changed = true; }
    }
    if (!changed) { break }
  }
  return rect
}

// Scroll a given set of coordinates into view (immediately).
function scrollIntoView(cm, rect) {
  var scrollPos = calculateScrollPos(cm, rect);
  if (scrollPos.scrollTop != null) { updateScrollTop(cm, scrollPos.scrollTop); }
  if (scrollPos.scrollLeft != null) { setScrollLeft(cm, scrollPos.scrollLeft); }
}

// Calculate a new scroll position needed to scroll the given
// rectangle into view. Returns an object with scrollTop and
// scrollLeft properties. When these are undefined, the
// vertical/horizontal position does not need to be adjusted.
function calculateScrollPos(cm, rect) {
  var display = cm.display, snapMargin = textHeight(cm.display);
  if (rect.top < 0) { rect.top = 0; }
  var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop;
  var screen = displayHeight(cm), result = {};
  if (rect.bottom - rect.top > screen) { rect.bottom = rect.top + screen; }
  var docBottom = cm.doc.height + paddingVert(display);
  var atTop = rect.top < snapMargin, atBottom = rect.bottom > docBottom - snapMargin;
  if (rect.top < screentop) {
    result.scrollTop = atTop ? 0 : rect.top;
  } else if (rect.bottom > screentop + screen) {
    var newTop = Math.min(rect.top, (atBottom ? docBottom : rect.bottom) - screen);
    if (newTop != screentop) { result.scrollTop = newTop; }
  }

  var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft;
  var screenw = displayWidth(cm) - (cm.options.fixedGutter ? display.gutters.offsetWidth : 0);
  var tooWide = rect.right - rect.left > screenw;
  if (tooWide) { rect.right = rect.left + screenw; }
  if (rect.left < 10)
    { result.scrollLeft = 0; }
  else if (rect.left < screenleft)
    { result.scrollLeft = Math.max(0, rect.left - (tooWide ? 0 : 10)); }
  else if (rect.right > screenw + screenleft - 3)
    { result.scrollLeft = rect.right + (tooWide ? 0 : 10) - screenw; }
  return result
}

// Store a relative adjustment to the scroll position in the current
// operation (to be applied when the operation finishes).
function addToScrollTop(cm, top) {
  if (top == null) { return }
  resolveScrollToPos(cm);
  cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top;
}

// Make sure that at the end of the operation the current cursor is
// shown.
function ensureCursorVisible(cm) {
  resolveScrollToPos(cm);
  var cur = cm.getCursor();
  cm.curOp.scrollToPos = {from: cur, to: cur, margin: cm.options.cursorScrollMargin};
}

function scrollToCoords(cm, x, y) {
  if (x != null || y != null) { resolveScrollToPos(cm); }
  if (x != null) { cm.curOp.scrollLeft = x; }
  if (y != null) { cm.curOp.scrollTop = y; }
}

function scrollToRange(cm, range) {
  resolveScrollToPos(cm);
  cm.curOp.scrollToPos = range;
}

// When an operation has its scrollToPos property set, and another
// scroll action is applied before the end of the operation, this
// 'simulates' scrolling that position into view in a cheap way, so
// that the effect of intermediate scroll commands is not ignored.
function resolveScrollToPos(cm) {
  var range = cm.curOp.scrollToPos;
  if (range) {
    cm.curOp.scrollToPos = null;
    var from = estimateCoords(cm, range.from), to = estimateCoords(cm, range.to);
    scrollToCoordsRange(cm, from, to, range.margin);
  }
}

function scrollToCoordsRange(cm, from, to, margin) {
  var sPos = calculateScrollPos(cm, {
    left: Math.min(from.left, to.left),
    top: Math.min(from.top, to.top) - margin,
    right: Math.max(from.right, to.right),
    bottom: Math.max(from.bottom, to.bottom) + margin
  });
  scrollToCoords(cm, sPos.scrollLeft, sPos.scrollTop);
}

// Sync the scrollable area and scrollbars, ensure the viewport
// covers the visible area.
function updateScrollTop(cm, val) {
  if (Math.abs(cm.doc.scrollTop - val) < 2) { return }
  if (!gecko) { updateDisplaySimple(cm, {top: val}); }
  setScrollTop(cm, val, true);
  if (gecko) { updateDisplaySimple(cm); }
  startWorker(cm, 100);
}

function setScrollTop(cm, val, forceScroll) {
  val = Math.min(cm.display.scroller.scrollHeight - cm.display.scroller.clientHeight, val);
  if (cm.display.scroller.scrollTop == val && !forceScroll) { return }
  cm.doc.scrollTop = val;
  cm.display.scrollbars.setScrollTop(val);
  if (cm.display.scroller.scrollTop != val) { cm.display.scroller.scrollTop = val; }
}

// Sync scroller and scrollbar, ensure the gutter elements are
// aligned.
function setScrollLeft(cm, val, isScroller, forceScroll) {
  val = Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth);
  if ((isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) && !forceScroll) { return }
  cm.doc.scrollLeft = val;
  alignHorizontally(cm);
  if (cm.display.scroller.scrollLeft != val) { cm.display.scroller.scrollLeft = val; }
  cm.display.scrollbars.setScrollLeft(val);
}

// SCROLLBARS

// Prepare DOM reads needed to update the scrollbars. Done in one
// shot to minimize update/measure roundtrips.
function measureForScrollbars(cm) {
  var d = cm.display, gutterW = d.gutters.offsetWidth;
  var docH = Math.round(cm.doc.height + paddingVert(cm.display));
  return {
    clientHeight: d.scroller.clientHeight,
    viewHeight: d.wrapper.clientHeight,
    scrollWidth: d.scroller.scrollWidth, clientWidth: d.scroller.clientWidth,
    viewWidth: d.wrapper.clientWidth,
    barLeft: cm.options.fixedGutter ? gutterW : 0,
    docHeight: docH,
    scrollHeight: docH + scrollGap(cm) + d.barHeight,
    nativeBarWidth: d.nativeBarWidth,
    gutterWidth: gutterW
  }
}

var NativeScrollbars = function(place, scroll, cm) {
  this.cm = cm;
  var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar");
  var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar");
  place(vert); place(horiz);

  on(vert, "scroll", function () {
    if (vert.clientHeight) { scroll(vert.scrollTop, "vertical"); }
  });
  on(horiz, "scroll", function () {
    if (horiz.clientWidth) { scroll(horiz.scrollLeft, "horizontal"); }
  });

  this.checkedZeroWidth = false;
  // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
  if (ie && ie_version < 8) { this.horiz.style.minHeight = this.vert.style.minWidth = "18px"; }
};

NativeScrollbars.prototype.update = function (measure) {
  var needsH = measure.scrollWidth > measure.clientWidth + 1;
  var needsV = measure.scrollHeight > measure.clientHeight + 1;
  var sWidth = measure.nativeBarWidth;

  if (needsV) {
    this.vert.style.display = "block";
    this.vert.style.bottom = needsH ? sWidth + "px" : "0";
    var totalHeight = measure.viewHeight - (needsH ? sWidth : 0);
    // A bug in IE8 can cause this value to be negative, so guard it.
    this.vert.firstChild.style.height =
      Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px";
  } else {
    this.vert.style.display = "";
    this.vert.firstChild.style.height = "0";
  }

  if (needsH) {
    this.horiz.style.display = "block";
    this.horiz.style.right = needsV ? sWidth + "px" : "0";
    this.horiz.style.left = measure.barLeft + "px";
    var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0);
    this.horiz.firstChild.style.width =
      Math.max(0, measure.scrollWidth - measure.clientWidth + totalWidth) + "px";
  } else {
    this.horiz.style.display = "";
    this.horiz.firstChild.style.width = "0";
  }

  if (!this.checkedZeroWidth && measure.clientHeight > 0) {
    if (sWidth == 0) { this.zeroWidthHack(); }
    this.checkedZeroWidth = true;
  }

  return {right: needsV ? sWidth : 0, bottom: needsH ? sWidth : 0}
};

NativeScrollbars.prototype.setScrollLeft = function (pos) {
  if (this.horiz.scrollLeft != pos) { this.horiz.scrollLeft = pos; }
  if (this.disableHoriz) { this.enableZeroWidthBar(this.horiz, this.disableHoriz, "horiz"); }
};

NativeScrollbars.prototype.setScrollTop = function (pos) {
  if (this.vert.scrollTop != pos) { this.vert.scrollTop = pos; }
  if (this.disableVert) { this.enableZeroWidthBar(this.vert, this.disableVert, "vert"); }
};

NativeScrollbars.prototype.zeroWidthHack = function () {
  var w = mac && !mac_geMountainLion ? "12px" : "18px";
  this.horiz.style.height = this.vert.style.width = w;
  this.horiz.style.pointerEvents = this.vert.style.pointerEvents = "none";
  this.disableHoriz = new Delayed;
  this.disableVert = new Delayed;
};

NativeScrollbars.prototype.enableZeroWidthBar = function (bar, delay, type) {
  bar.style.pointerEvents = "auto";
  function maybeDisable() {
    // To find out whether the scrollbar is still visible, we
    // check whether the element under the pixel in the bottom
    // right corner of the scrollbar box is the scrollbar box
    // itself (when the bar is still visible) or its filler child
    // (when the bar is hidden). If it is still visible, we keep
    // it enabled, if it's hidden, we disable pointer events.
    var box = bar.getBoundingClientRect();
    var elt = type == "vert" ? document.elementFromPoint(box.right - 1, (box.top + box.bottom) / 2)
        : document.elementFromPoint((box.right + box.left) / 2, box.bottom - 1);
    if (elt != bar) { bar.style.pointerEvents = "none"; }
    else { delay.set(1000, maybeDisable); }
  }
  delay.set(1000, maybeDisable);
};

NativeScrollbars.prototype.clear = function () {
  var parent = this.horiz.parentNode;
  parent.removeChild(this.horiz);
  parent.removeChild(this.vert);
};

var NullScrollbars = function () {};

NullScrollbars.prototype.update = function () { return {bottom: 0, right: 0} };
NullScrollbars.prototype.setScrollLeft = function () {};
NullScrollbars.prototype.setScrollTop = function () {};
NullScrollbars.prototype.clear = function () {};

function updateScrollbars(cm, measure) {
  if (!measure) { measure = measureForScrollbars(cm); }
  var startWidth = cm.display.barWidth, startHeight = cm.display.barHeight;
  updateScrollbarsInner(cm, measure);
  for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
    if (startWidth != cm.display.barWidth && cm.options.lineWrapping)
      { updateHeightsInViewport(cm); }
    updateScrollbarsInner(cm, measureForScrollbars(cm));
    startWidth = cm.display.barWidth; startHeight = cm.display.barHeight;
  }
}

// Re-synchronize the fake scrollbars with the actual size of the
// content.
function updateScrollbarsInner(cm, measure) {
  var d = cm.display;
  var sizes = d.scrollbars.update(measure);

  d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px";
  d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px";
  d.heightForcer.style.borderBottom = sizes.bottom + "px solid transparent";

  if (sizes.right && sizes.bottom) {
    d.scrollbarFiller.style.display = "block";
    d.scrollbarFiller.style.height = sizes.bottom + "px";
    d.scrollbarFiller.style.width = sizes.right + "px";
  } else { d.scrollbarFiller.style.display = ""; }
  if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
    d.gutterFiller.style.display = "block";
    d.gutterFiller.style.height = sizes.bottom + "px";
    d.gutterFiller.style.width = measure.gutterWidth + "px";
  } else { d.gutterFiller.style.display = ""; }
}

var scrollbarModel = {"native": NativeScrollbars, "null": NullScrollbars};

function initScrollbars(cm) {
  if (cm.display.scrollbars) {
    cm.display.scrollbars.clear();
    if (cm.display.scrollbars.addClass)
      { rmClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
  }

  cm.display.scrollbars = new scrollbarModel[cm.options.scrollbarStyle](function (node) {
    cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller);
    // Prevent clicks in the scrollbars from killing focus
    on(node, "mousedown", function () {
      if (cm.state.focused) { setTimeout(function () { return cm.display.input.focus(); }, 0); }
    });
    node.setAttribute("cm-not-content", "true");
  }, function (pos, axis) {
    if (axis == "horizontal") { setScrollLeft(cm, pos); }
    else { updateScrollTop(cm, pos); }
  }, cm);
  if (cm.display.scrollbars.addClass)
    { addClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
}

// Operations are used to wrap a series of changes to the editor
// state in such a way that each change won't have to update the
// cursor and display (which would be awkward, slow, and
// error-prone). Instead, display updates are batched and then all
// combined and executed at once.

var nextOpId = 0;
// Start a new operation.
function startOperation(cm) {
  cm.curOp = {
    cm: cm,
    viewChanged: false,      // Flag that indicates that lines might need to be redrawn
    startHeight: cm.doc.height, // Used to detect need to update scrollbar
    forceUpdate: false,      // Used to force a redraw
    updateInput: null,       // Whether to reset the input textarea
    typing: false,           // Whether this reset should be careful to leave existing text (for compositing)
    changeObjs: null,        // Accumulated changes, for firing change events
    cursorActivityHandlers: null, // Set of handlers to fire cursorActivity on
    cursorActivityCalled: 0, // Tracks which cursorActivity handlers have been called already
    selectionChanged: false, // Whether the selection needs to be redrawn
    updateMaxLine: false,    // Set when the widest line needs to be determined anew
    scrollLeft: null, scrollTop: null, // Intermediate scroll position, not pushed to DOM yet
    scrollToPos: null,       // Used to scroll to a specific position
    focus: false,
    id: ++nextOpId           // Unique ID
  };
  pushOperation(cm.curOp);
}

// Finish an operation, updating the display and signalling delayed events
function endOperation(cm) {
  var op = cm.curOp;
  finishOperation(op, function (group) {
    for (var i = 0; i < group.ops.length; i++)
      { group.ops[i].cm.curOp = null; }
    endOperations(group);
  });
}

// The DOM updates done when an operation finishes are batched so
// that the minimum number of relayouts are required.
function endOperations(group) {
  var ops = group.ops;
  for (var i = 0; i < ops.length; i++) // Read DOM
    { endOperation_R1(ops[i]); }
  for (var i$1 = 0; i$1 < ops.length; i$1++) // Write DOM (maybe)
    { endOperation_W1(ops[i$1]); }
  for (var i$2 = 0; i$2 < ops.length; i$2++) // Read DOM
    { endOperation_R2(ops[i$2]); }
  for (var i$3 = 0; i$3 < ops.length; i$3++) // Write DOM (maybe)
    { endOperation_W2(ops[i$3]); }
  for (var i$4 = 0; i$4 < ops.length; i$4++) // Read DOM
    { endOperation_finish(ops[i$4]); }
}

function endOperation_R1(op) {
  var cm = op.cm, display = cm.display;
  maybeClipScrollbars(cm);
  if (op.updateMaxLine) { findMaxLine(cm); }

  op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null ||
    op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom ||
                       op.scrollToPos.to.line >= display.viewTo) ||
    display.maxLineChanged && cm.options.lineWrapping;
  op.update = op.mustUpdate &&
    new DisplayUpdate(cm, op.mustUpdate && {top: op.scrollTop, ensure: op.scrollToPos}, op.forceUpdate);
}

function endOperation_W1(op) {
  op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update);
}

function endOperation_R2(op) {
  var cm = op.cm, display = cm.display;
  if (op.updatedDisplay) { updateHeightsInViewport(cm); }

  op.barMeasure = measureForScrollbars(cm);

  // If the max line changed since it was last measured, measure it,
  // and ensure the document's width matches it.
  // updateDisplay_W2 will use these properties to do the actual resizing
  if (display.maxLineChanged && !cm.options.lineWrapping) {
    op.adjustWidthTo = measureChar(cm, display.maxLine, display.maxLine.text.length).left + 3;
    cm.display.sizerWidth = op.adjustWidthTo;
    op.barMeasure.scrollWidth =
      Math.max(display.scroller.clientWidth, display.sizer.offsetLeft + op.adjustWidthTo + scrollGap(cm) + cm.display.barWidth);
    op.maxScrollLeft = Math.max(0, display.sizer.offsetLeft + op.adjustWidthTo - displayWidth(cm));
  }

  if (op.updatedDisplay || op.selectionChanged)
    { op.preparedSelection = display.input.prepareSelection(op.focus); }
}

function endOperation_W2(op) {
  var cm = op.cm;

  if (op.adjustWidthTo != null) {
    cm.display.sizer.style.minWidth = op.adjustWidthTo + "px";
    if (op.maxScrollLeft < cm.doc.scrollLeft)
      { setScrollLeft(cm, Math.min(cm.display.scroller.scrollLeft, op.maxScrollLeft), true); }
    cm.display.maxLineChanged = false;
  }

  var takeFocus = op.focus && op.focus == activeElt() && (!document.hasFocus || document.hasFocus());
  if (op.preparedSelection)
    { cm.display.input.showSelection(op.preparedSelection, takeFocus); }
  if (op.updatedDisplay || op.startHeight != cm.doc.height)
    { updateScrollbars(cm, op.barMeasure); }
  if (op.updatedDisplay)
    { setDocumentHeight(cm, op.barMeasure); }

  if (op.selectionChanged) { restartBlink(cm); }

  if (cm.state.focused && op.updateInput)
    { cm.display.input.reset(op.typing); }
  if (takeFocus) { ensureFocus(op.cm); }
}

function endOperation_finish(op) {
  var cm = op.cm, display = cm.display, doc = cm.doc;

  if (op.updatedDisplay) { postUpdateDisplay(cm, op.update); }

  // Abort mouse wheel delta measurement, when scrolling explicitly
  if (display.wheelStartX != null && (op.scrollTop != null || op.scrollLeft != null || op.scrollToPos))
    { display.wheelStartX = display.wheelStartY = null; }

  // Propagate the scroll position to the actual DOM scroller
  if (op.scrollTop != null) { setScrollTop(cm, op.scrollTop, op.forceScroll); }

  if (op.scrollLeft != null) { setScrollLeft(cm, op.scrollLeft, true, true); }
  // If we need to scroll a specific position into view, do so.
  if (op.scrollToPos) {
    var rect = scrollPosIntoView(cm, clipPos(doc, op.scrollToPos.from),
                                 clipPos(doc, op.scrollToPos.to), op.scrollToPos.margin);
    maybeScrollWindow(cm, rect);
  }

  // Fire events for markers that are hidden/unidden by editing or
  // undoing
  var hidden = op.maybeHiddenMarkers, unhidden = op.maybeUnhiddenMarkers;
  if (hidden) { for (var i = 0; i < hidden.length; ++i)
    { if (!hidden[i].lines.length) { signal(hidden[i], "hide"); } } }
  if (unhidden) { for (var i$1 = 0; i$1 < unhidden.length; ++i$1)
    { if (unhidden[i$1].lines.length) { signal(unhidden[i$1], "unhide"); } } }

  if (display.wrapper.offsetHeight)
    { doc.scrollTop = cm.display.scroller.scrollTop; }

  // Fire change events, and delayed event handlers
  if (op.changeObjs)
    { signal(cm, "changes", cm, op.changeObjs); }
  if (op.update)
    { op.update.finish(); }
}

// Run the given function in an operation
function runInOp(cm, f) {
  if (cm.curOp) { return f() }
  startOperation(cm);
  try { return f() }
  finally { endOperation(cm); }
}
// Wraps a function in an operation. Returns the wrapped function.
function operation(cm, f) {
  return function() {
    if (cm.curOp) { return f.apply(cm, arguments) }
    startOperation(cm);
    try { return f.apply(cm, arguments) }
    finally { endOperation(cm); }
  }
}
// Used to add methods to editor and doc instances, wrapping them in
// operations.
function methodOp(f) {
  return function() {
    if (this.curOp) { return f.apply(this, arguments) }
    startOperation(this);
    try { return f.apply(this, arguments) }
    finally { endOperation(this); }
  }
}
function docMethodOp(f) {
  return function() {
    var cm = this.cm;
    if (!cm || cm.curOp) { return f.apply(this, arguments) }
    startOperation(cm);
    try { return f.apply(this, arguments) }
    finally { endOperation(cm); }
  }
}

// Updates the display.view data structure for a given change to the
// document. From and to are in pre-change coordinates. Lendiff is
// the amount of lines added or subtracted by the change. This is
// used for changes that span multiple lines, or change the way
// lines are divided into visual lines. regLineChange (below)
// registers single-line changes.
function regChange(cm, from, to, lendiff) {
  if (from == null) { from = cm.doc.first; }
  if (to == null) { to = cm.doc.first + cm.doc.size; }
  if (!lendiff) { lendiff = 0; }

  var display = cm.display;
  if (lendiff && to < display.viewTo &&
      (display.updateLineNumbers == null || display.updateLineNumbers > from))
    { display.updateLineNumbers = from; }

  cm.curOp.viewChanged = true;

  if (from >= display.viewTo) { // Change after
    if (sawCollapsedSpans && visualLineNo(cm.doc, from) < display.viewTo)
      { resetView(cm); }
  } else if (to <= display.viewFrom) { // Change before
    if (sawCollapsedSpans && visualLineEndNo(cm.doc, to + lendiff) > display.viewFrom) {
      resetView(cm);
    } else {
      display.viewFrom += lendiff;
      display.viewTo += lendiff;
    }
  } else if (from <= display.viewFrom && to >= display.viewTo) { // Full overlap
    resetView(cm);
  } else if (from <= display.viewFrom) { // Top overlap
    var cut = viewCuttingPoint(cm, to, to + lendiff, 1);
    if (cut) {
      display.view = display.view.slice(cut.index);
      display.viewFrom = cut.lineN;
      display.viewTo += lendiff;
    } else {
      resetView(cm);
    }
  } else if (to >= display.viewTo) { // Bottom overlap
    var cut$1 = viewCuttingPoint(cm, from, from, -1);
    if (cut$1) {
      display.view = display.view.slice(0, cut$1.index);
      display.viewTo = cut$1.lineN;
    } else {
      resetView(cm);
    }
  } else { // Gap in the middle
    var cutTop = viewCuttingPoint(cm, from, from, -1);
    var cutBot = viewCuttingPoint(cm, to, to + lendiff, 1);
    if (cutTop && cutBot) {
      display.view = display.view.slice(0, cutTop.index)
        .concat(buildViewArray(cm, cutTop.lineN, cutBot.lineN))
        .concat(display.view.slice(cutBot.index));
      display.viewTo += lendiff;
    } else {
      resetView(cm);
    }
  }

  var ext = display.externalMeasured;
  if (ext) {
    if (to < ext.lineN)
      { ext.lineN += lendiff; }
    else if (from < ext.lineN + ext.size)
      { display.externalMeasured = null; }
  }
}

// Register a change to a single line. Type must be one of "text",
// "gutter", "class", "widget"
function regLineChange(cm, line, type) {
  cm.curOp.viewChanged = true;
  var display = cm.display, ext = cm.display.externalMeasured;
  if (ext && line >= ext.lineN && line < ext.lineN + ext.size)
    { display.externalMeasured = null; }

  if (line < display.viewFrom || line >= display.viewTo) { return }
  var lineView = display.view[findViewIndex(cm, line)];
  if (lineView.node == null) { return }
  var arr = lineView.changes || (lineView.changes = []);
  if (indexOf(arr, type) == -1) { arr.push(type); }
}

// Clear the view.
function resetView(cm) {
  cm.display.viewFrom = cm.display.viewTo = cm.doc.first;
  cm.display.view = [];
  cm.display.viewOffset = 0;
}

function viewCuttingPoint(cm, oldN, newN, dir) {
  var index = findViewIndex(cm, oldN), diff, view = cm.display.view;
  if (!sawCollapsedSpans || newN == cm.doc.first + cm.doc.size)
    { return {index: index, lineN: newN} }
  var n = cm.display.viewFrom;
  for (var i = 0; i < index; i++)
    { n += view[i].size; }
  if (n != oldN) {
    if (dir > 0) {
      if (index == view.length - 1) { return null }
      diff = (n + view[index].size) - oldN;
      index++;
    } else {
      diff = n - oldN;
    }
    oldN += diff; newN += diff;
  }
  while (visualLineNo(cm.doc, newN) != newN) {
    if (index == (dir < 0 ? 0 : view.length - 1)) { return null }
    newN += dir * view[index - (dir < 0 ? 1 : 0)].size;
    index += dir;
  }
  return {index: index, lineN: newN}
}

// Force the view to cover a given range, adding empty view element
// or clipping off existing ones as needed.
function adjustView(cm, from, to) {
  var display = cm.display, view = display.view;
  if (view.length == 0 || from >= display.viewTo || to <= display.viewFrom) {
    display.view = buildViewArray(cm, from, to);
    display.viewFrom = from;
  } else {
    if (display.viewFrom > from)
      { display.view = buildViewArray(cm, from, display.viewFrom).concat(display.view); }
    else if (display.viewFrom < from)
      { display.view = display.view.slice(findViewIndex(cm, from)); }
    display.viewFrom = from;
    if (display.viewTo < to)
      { display.view = display.view.concat(buildViewArray(cm, display.viewTo, to)); }
    else if (display.viewTo > to)
      { display.view = display.view.slice(0, findViewIndex(cm, to)); }
  }
  display.viewTo = to;
}

// Count the number of lines in the view whose DOM representation is
// out of date (or nonexistent).
function countDirtyView(cm) {
  var view = cm.display.view, dirty = 0;
  for (var i = 0; i < view.length; i++) {
    var lineView = view[i];
    if (!lineView.hidden && (!lineView.node || lineView.changes)) { ++dirty; }
  }
  return dirty
}

// HIGHLIGHT WORKER

function startWorker(cm, time) {
  if (cm.doc.highlightFrontier < cm.display.viewTo)
    { cm.state.highlight.set(time, bind(highlightWorker, cm)); }
}

function highlightWorker(cm) {
  var doc = cm.doc;
  if (doc.highlightFrontier >= cm.display.viewTo) { return }
  var end = +new Date + cm.options.workTime;
  var context = getContextBefore(cm, doc.highlightFrontier);
  var changedLines = [];

  doc.iter(context.line, Math.min(doc.first + doc.size, cm.display.viewTo + 500), function (line) {
    if (context.line >= cm.display.viewFrom) { // Visible
      var oldStyles = line.styles;
      var resetState = line.text.length > cm.options.maxHighlightLength ? copyState(doc.mode, context.state) : null;
      var highlighted = highlightLine(cm, line, context, true);
      if (resetState) { context.state = resetState; }
      line.styles = highlighted.styles;
      var oldCls = line.styleClasses, newCls = highlighted.classes;
      if (newCls) { line.styleClasses = newCls; }
      else if (oldCls) { line.styleClasses = null; }
      var ischange = !oldStyles || oldStyles.length != line.styles.length ||
        oldCls != newCls && (!oldCls || !newCls || oldCls.bgClass != newCls.bgClass || oldCls.textClass != newCls.textClass);
      for (var i = 0; !ischange && i < oldStyles.length; ++i) { ischange = oldStyles[i] != line.styles[i]; }
      if (ischange) { changedLines.push(context.line); }
      line.stateAfter = context.save();
      context.nextLine();
    } else {
      if (line.text.length <= cm.options.maxHighlightLength)
        { processLine(cm, line.text, context); }
      line.stateAfter = context.line % 5 == 0 ? context.save() : null;
      context.nextLine();
    }
    if (+new Date > end) {
      startWorker(cm, cm.options.workDelay);
      return true
    }
  });
  doc.highlightFrontier = context.line;
  doc.modeFrontier = Math.max(doc.modeFrontier, context.line);
  if (changedLines.length) { runInOp(cm, function () {
    for (var i = 0; i < changedLines.length; i++)
      { regLineChange(cm, changedLines[i], "text"); }
  }); }
}

// DISPLAY DRAWING

var DisplayUpdate = function(cm, viewport, force) {
  var display = cm.display;

  this.viewport = viewport;
  // Store some values that we'll need later (but don't want to force a relayout for)
  this.visible = visibleLines(display, cm.doc, viewport);
  this.editorIsHidden = !display.wrapper.offsetWidth;
  this.wrapperHeight = display.wrapper.clientHeight;
  this.wrapperWidth = display.wrapper.clientWidth;
  this.oldDisplayWidth = displayWidth(cm);
  this.force = force;
  this.dims = getDimensions(cm);
  this.events = [];
};

DisplayUpdate.prototype.signal = function (emitter, type) {
  if (hasHandler(emitter, type))
    { this.events.push(arguments); }
};
DisplayUpdate.prototype.finish = function () {
    var this$1 = this;

  for (var i = 0; i < this.events.length; i++)
    { signal.apply(null, this$1.events[i]); }
};

function maybeClipScrollbars(cm) {
  var display = cm.display;
  if (!display.scrollbarsClipped && display.scroller.offsetWidth) {
    display.nativeBarWidth = display.scroller.offsetWidth - display.scroller.clientWidth;
    display.heightForcer.style.height = scrollGap(cm) + "px";
    display.sizer.style.marginBottom = -display.nativeBarWidth + "px";
    display.sizer.style.borderRightWidth = scrollGap(cm) + "px";
    display.scrollbarsClipped = true;
  }
}

function selectionSnapshot(cm) {
  if (cm.hasFocus()) { return null }
  var active = activeElt();
  if (!active || !contains(cm.display.lineDiv, active)) { return null }
  var result = {activeElt: active};
  if (window.getSelection) {
    var sel = window.getSelection();
    if (sel.anchorNode && sel.extend && contains(cm.display.lineDiv, sel.anchorNode)) {
      result.anchorNode = sel.anchorNode;
      result.anchorOffset = sel.anchorOffset;
      result.focusNode = sel.focusNode;
      result.focusOffset = sel.focusOffset;
    }
  }
  return result
}

function restoreSelection(snapshot) {
  if (!snapshot || !snapshot.activeElt || snapshot.activeElt == activeElt()) { return }
  snapshot.activeElt.focus();
  if (snapshot.anchorNode && contains(document.body, snapshot.anchorNode) && contains(document.body, snapshot.focusNode)) {
    var sel = window.getSelection(), range = document.createRange();
    range.setEnd(snapshot.anchorNode, snapshot.anchorOffset);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    sel.extend(snapshot.focusNode, snapshot.focusOffset);
  }
}

// Does the actual updating of the line display. Bails out
// (returning false) when there is nothing to be done and forced is
// false.
function updateDisplayIfNeeded(cm, update) {
  var display = cm.display, doc = cm.doc;

  if (update.editorIsHidden) {
    resetView(cm);
    return false
  }

  // Bail out if the visible area is already rendered and nothing changed.
  if (!update.force &&
      update.visible.from >= display.viewFrom && update.visible.to <= display.viewTo &&
      (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo) &&
      display.renderedView == display.view && countDirtyView(cm) == 0)
    { return false }

  if (maybeUpdateLineNumberWidth(cm)) {
    resetView(cm);
    update.dims = getDimensions(cm);
  }

  // Compute a suitable new viewport (from & to)
  var end = doc.first + doc.size;
  var from = Math.max(update.visible.from - cm.options.viewportMargin, doc.first);
  var to = Math.min(end, update.visible.to + cm.options.viewportMargin);
  if (display.viewFrom < from && from - display.viewFrom < 20) { from = Math.max(doc.first, display.viewFrom); }
  if (display.viewTo > to && display.viewTo - to < 20) { to = Math.min(end, display.viewTo); }
  if (sawCollapsedSpans) {
    from = visualLineNo(cm.doc, from);
    to = visualLineEndNo(cm.doc, to);
  }

  var different = from != display.viewFrom || to != display.viewTo ||
    display.lastWrapHeight != update.wrapperHeight || display.lastWrapWidth != update.wrapperWidth;
  adjustView(cm, from, to);

  display.viewOffset = heightAtLine(getLine(cm.doc, display.viewFrom));
  // Position the mover div to align with the current scroll position
  cm.display.mover.style.top = display.viewOffset + "px";

  var toUpdate = countDirtyView(cm);
  if (!different && toUpdate == 0 && !update.force && display.renderedView == display.view &&
      (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo))
    { return false }

  // For big changes, we hide the enclosing element during the
  // update, since that speeds up the operations on most browsers.
  var selSnapshot = selectionSnapshot(cm);
  if (toUpdate > 4) { display.lineDiv.style.display = "none"; }
  patchDisplay(cm, display.updateLineNumbers, update.dims);
  if (toUpdate > 4) { display.lineDiv.style.display = ""; }
  display.renderedView = display.view;
  // There might have been a widget with a focused element that got
  // hidden or updated, if so re-focus it.
  restoreSelection(selSnapshot);

  // Prevent selection and cursors from interfering with the scroll
  // width and height.
  removeChildren(display.cursorDiv);
  removeChildren(display.selectionDiv);
  display.gutters.style.height = display.sizer.style.minHeight = 0;

  if (different) {
    display.lastWrapHeight = update.wrapperHeight;
    display.lastWrapWidth = update.wrapperWidth;
    startWorker(cm, 400);
  }

  display.updateLineNumbers = null;

  return true
}

function postUpdateDisplay(cm, update) {
  var viewport = update.viewport;

  for (var first = true;; first = false) {
    if (!first || !cm.options.lineWrapping || update.oldDisplayWidth == displayWidth(cm)) {
      // Clip forced viewport to actual scrollable area.
      if (viewport && viewport.top != null)
        { viewport = {top: Math.min(cm.doc.height + paddingVert(cm.display) - displayHeight(cm), viewport.top)}; }
      // Updated line heights might result in the drawn area not
      // actually covering the viewport. Keep looping until it does.
      update.visible = visibleLines(cm.display, cm.doc, viewport);
      if (update.visible.from >= cm.display.viewFrom && update.visible.to <= cm.display.viewTo)
        { break }
    }
    if (!updateDisplayIfNeeded(cm, update)) { break }
    updateHeightsInViewport(cm);
    var barMeasure = measureForScrollbars(cm);
    updateSelection(cm);
    updateScrollbars(cm, barMeasure);
    setDocumentHeight(cm, barMeasure);
    update.force = false;
  }

  update.signal(cm, "update", cm);
  if (cm.display.viewFrom != cm.display.reportedViewFrom || cm.display.viewTo != cm.display.reportedViewTo) {
    update.signal(cm, "viewportChange", cm, cm.display.viewFrom, cm.display.viewTo);
    cm.display.reportedViewFrom = cm.display.viewFrom; cm.display.reportedViewTo = cm.display.viewTo;
  }
}

function updateDisplaySimple(cm, viewport) {
  var update = new DisplayUpdate(cm, viewport);
  if (updateDisplayIfNeeded(cm, update)) {
    updateHeightsInViewport(cm);
    postUpdateDisplay(cm, update);
    var barMeasure = measureForScrollbars(cm);
    updateSelection(cm);
    updateScrollbars(cm, barMeasure);
    setDocumentHeight(cm, barMeasure);
    update.finish();
  }
}

// Sync the actual display DOM structure with display.view, removing
// nodes for lines that are no longer in view, and creating the ones
// that are not there yet, and updating the ones that are out of
// date.
function patchDisplay(cm, updateNumbersFrom, dims) {
  var display = cm.display, lineNumbers = cm.options.lineNumbers;
  var container = display.lineDiv, cur = container.firstChild;

  function rm(node) {
    var next = node.nextSibling;
    // Works around a throw-scroll bug in OS X Webkit
    if (webkit && mac && cm.display.currentWheelTarget == node)
      { node.style.display = "none"; }
    else
      { node.parentNode.removeChild(node); }
    return next
  }

  var view = display.view, lineN = display.viewFrom;
  // Loop over the elements in the view, syncing cur (the DOM nodes
  // in display.lineDiv) with the view as we go.
  for (var i = 0; i < view.length; i++) {
    var lineView = view[i];
    if (lineView.hidden) {
    } else if (!lineView.node || lineView.node.parentNode != container) { // Not drawn yet
      var node = buildLineElement(cm, lineView, lineN, dims);
      container.insertBefore(node, cur);
    } else { // Already drawn
      while (cur != lineView.node) { cur = rm(cur); }
      var updateNumber = lineNumbers && updateNumbersFrom != null &&
        updateNumbersFrom <= lineN && lineView.lineNumber;
      if (lineView.changes) {
        if (indexOf(lineView.changes, "gutter") > -1) { updateNumber = false; }
        updateLineForChanges(cm, lineView, lineN, dims);
      }
      if (updateNumber) {
        removeChildren(lineView.lineNumber);
        lineView.lineNumber.appendChild(document.createTextNode(lineNumberFor(cm.options, lineN)));
      }
      cur = lineView.node.nextSibling;
    }
    lineN += lineView.size;
  }
  while (cur) { cur = rm(cur); }
}

function updateGutterSpace(cm) {
  var width = cm.display.gutters.offsetWidth;
  cm.display.sizer.style.marginLeft = width + "px";
}

function setDocumentHeight(cm, measure) {
  cm.display.sizer.style.minHeight = measure.docHeight + "px";
  cm.display.heightForcer.style.top = measure.docHeight + "px";
  cm.display.gutters.style.height = (measure.docHeight + cm.display.barHeight + scrollGap(cm)) + "px";
}

// Rebuild the gutter elements, ensure the margin to the left of the
// code matches their width.
function updateGutters(cm) {
  var gutters = cm.display.gutters, specs = cm.options.gutters;
  removeChildren(gutters);
  var i = 0;
  for (; i < specs.length; ++i) {
    var gutterClass = specs[i];
    var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + gutterClass));
    if (gutterClass == "CodeMirror-linenumbers") {
      cm.display.lineGutter = gElt;
      gElt.style.width = (cm.display.lineNumWidth || 1) + "px";
    }
  }
  gutters.style.display = i ? "" : "none";
  updateGutterSpace(cm);
}

// Make sure the gutters options contains the element
// "CodeMirror-linenumbers" when the lineNumbers option is true.
function setGuttersForLineNumbers(options) {
  var found = indexOf(options.gutters, "CodeMirror-linenumbers");
  if (found == -1 && options.lineNumbers) {
    options.gutters = options.gutters.concat(["CodeMirror-linenumbers"]);
  } else if (found > -1 && !options.lineNumbers) {
    options.gutters = options.gutters.slice(0);
    options.gutters.splice(found, 1);
  }
}

var wheelSamples = 0;
var wheelPixelsPerUnit = null;
// Fill in a browser-detected starting value on browsers where we
// know one. These don't have to be accurate -- the result of them
// being wrong would just be a slight flicker on the first wheel
// scroll (if it is large enough).
if (ie) { wheelPixelsPerUnit = -.53; }
else if (gecko) { wheelPixelsPerUnit = 15; }
else if (chrome) { wheelPixelsPerUnit = -.7; }
else if (safari) { wheelPixelsPerUnit = -1/3; }

function wheelEventDelta(e) {
  var dx = e.wheelDeltaX, dy = e.wheelDeltaY;
  if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) { dx = e.detail; }
  if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) { dy = e.detail; }
  else if (dy == null) { dy = e.wheelDelta; }
  return {x: dx, y: dy}
}
function wheelEventPixels(e) {
  var delta = wheelEventDelta(e);
  delta.x *= wheelPixelsPerUnit;
  delta.y *= wheelPixelsPerUnit;
  return delta
}

function onScrollWheel(cm, e) {
  var delta = wheelEventDelta(e), dx = delta.x, dy = delta.y;

  var display = cm.display, scroll = display.scroller;
  // Quit if there's nothing to scroll here
  var canScrollX = scroll.scrollWidth > scroll.clientWidth;
  var canScrollY = scroll.scrollHeight > scroll.clientHeight;
  if (!(dx && canScrollX || dy && canScrollY)) { return }

  // Webkit browsers on OS X abort momentum scrolls when the target
  // of the scroll event is removed from the scrollable element.
  // This hack (see related code in patchDisplay) makes sure the
  // element is kept around.
  if (dy && mac && webkit) {
    outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
      for (var i = 0; i < view.length; i++) {
        if (view[i].node == cur) {
          cm.display.currentWheelTarget = cur;
          break outer
        }
      }
    }
  }

  // On some browsers, horizontal scrolling will cause redraws to
  // happen before the gutter has been realigned, causing it to
  // wriggle around in a most unseemly way. When we have an
  // estimated pixels/delta value, we just handle horizontal
  // scrolling entirely here. It'll be slightly off from native, but
  // better than glitching out.
  if (dx && !gecko && !presto && wheelPixelsPerUnit != null) {
    if (dy && canScrollY)
      { updateScrollTop(cm, Math.max(0, scroll.scrollTop + dy * wheelPixelsPerUnit)); }
    setScrollLeft(cm, Math.max(0, scroll.scrollLeft + dx * wheelPixelsPerUnit));
    // Only prevent default scrolling if vertical scrolling is
    // actually possible. Otherwise, it causes vertical scroll
    // jitter on OSX trackpads when deltaX is small and deltaY
    // is large (issue #3579)
    if (!dy || (dy && canScrollY))
      { e_preventDefault(e); }
    display.wheelStartX = null; // Abort measurement, if in progress
    return
  }

  // 'Project' the visible viewport to cover the area that is being
  // scrolled into view (if we know enough to estimate it).
  if (dy && wheelPixelsPerUnit != null) {
    var pixels = dy * wheelPixelsPerUnit;
    var top = cm.doc.scrollTop, bot = top + display.wrapper.clientHeight;
    if (pixels < 0) { top = Math.max(0, top + pixels - 50); }
    else { bot = Math.min(cm.doc.height, bot + pixels + 50); }
    updateDisplaySimple(cm, {top: top, bottom: bot});
  }

  if (wheelSamples < 20) {
    if (display.wheelStartX == null) {
      display.wheelStartX = scroll.scrollLeft; display.wheelStartY = scroll.scrollTop;
      display.wheelDX = dx; display.wheelDY = dy;
      setTimeout(function () {
        if (display.wheelStartX == null) { return }
        var movedX = scroll.scrollLeft - display.wheelStartX;
        var movedY = scroll.scrollTop - display.wheelStartY;
        var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
          (movedX && display.wheelDX && movedX / display.wheelDX);
        display.wheelStartX = display.wheelStartY = null;
        if (!sample) { return }
        wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
        ++wheelSamples;
      }, 200);
    } else {
      display.wheelDX += dx; display.wheelDY += dy;
    }
  }
}

// Selection objects are immutable. A new one is created every time
// the selection changes. A selection is one or more non-overlapping
// (and non-touching) ranges, sorted, and an integer that indicates
// which one is the primary selection (the one that's scrolled into
// view, that getCursor returns, etc).
var Selection = function(ranges, primIndex) {
  this.ranges = ranges;
  this.primIndex = primIndex;
};

Selection.prototype.primary = function () { return this.ranges[this.primIndex] };

Selection.prototype.equals = function (other) {
    var this$1 = this;

  if (other == this) { return true }
  if (other.primIndex != this.primIndex || other.ranges.length != this.ranges.length) { return false }
  for (var i = 0; i < this.ranges.length; i++) {
    var here = this$1.ranges[i], there = other.ranges[i];
    if (!equalCursorPos(here.anchor, there.anchor) || !equalCursorPos(here.head, there.head)) { return false }
  }
  return true
};

Selection.prototype.deepCopy = function () {
    var this$1 = this;

  var out = [];
  for (var i = 0; i < this.ranges.length; i++)
    { out[i] = new Range(copyPos(this$1.ranges[i].anchor), copyPos(this$1.ranges[i].head)); }
  return new Selection(out, this.primIndex)
};

Selection.prototype.somethingSelected = function () {
    var this$1 = this;

  for (var i = 0; i < this.ranges.length; i++)
    { if (!this$1.ranges[i].empty()) { return true } }
  return false
};

Selection.prototype.contains = function (pos, end) {
    var this$1 = this;

  if (!end) { end = pos; }
  for (var i = 0; i < this.ranges.length; i++) {
    var range = this$1.ranges[i];
    if (cmp(end, range.from()) >= 0 && cmp(pos, range.to()) <= 0)
      { return i }
  }
  return -1
};

var Range = function(anchor, head) {
  this.anchor = anchor; this.head = head;
};

Range.prototype.from = function () { return minPos(this.anchor, this.head) };
Range.prototype.to = function () { return maxPos(this.anchor, this.head) };
Range.prototype.empty = function () { return this.head.line == this.anchor.line && this.head.ch == this.anchor.ch };

// Take an unsorted, potentially overlapping set of ranges, and
// build a selection out of it. 'Consumes' ranges array (modifying
// it).
function normalizeSelection(ranges, primIndex) {
  var prim = ranges[primIndex];
  ranges.sort(function (a, b) { return cmp(a.from(), b.from()); });
  primIndex = indexOf(ranges, prim);
  for (var i = 1; i < ranges.length; i++) {
    var cur = ranges[i], prev = ranges[i - 1];
    if (cmp(prev.to(), cur.from()) >= 0) {
      var from = minPos(prev.from(), cur.from()), to = maxPos(prev.to(), cur.to());
      var inv = prev.empty() ? cur.from() == cur.head : prev.from() == prev.head;
      if (i <= primIndex) { --primIndex; }
      ranges.splice(--i, 2, new Range(inv ? to : from, inv ? from : to));
    }
  }
  return new Selection(ranges, primIndex)
}

function simpleSelection(anchor, head) {
  return new Selection([new Range(anchor, head || anchor)], 0)
}

// Compute the position of the end of a change (its 'to' property
// refers to the pre-change end).
function changeEnd(change) {
  if (!change.text) { return change.to }
  return Pos(change.from.line + change.text.length - 1,
             lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0))
}

// Adjust a position to refer to the post-change position of the
// same text, or the end of the change if the change covers it.
function adjustForChange(pos, change) {
  if (cmp(pos, change.from) < 0) { return pos }
  if (cmp(pos, change.to) <= 0) { return changeEnd(change) }

  var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
  if (pos.line == change.to.line) { ch += changeEnd(change).ch - change.to.ch; }
  return Pos(line, ch)
}

function computeSelAfterChange(doc, change) {
  var out = [];
  for (var i = 0; i < doc.sel.ranges.length; i++) {
    var range = doc.sel.ranges[i];
    out.push(new Range(adjustForChange(range.anchor, change),
                       adjustForChange(range.head, change)));
  }
  return normalizeSelection(out, doc.sel.primIndex)
}

function offsetPos(pos, old, nw) {
  if (pos.line == old.line)
    { return Pos(nw.line, pos.ch - old.ch + nw.ch) }
  else
    { return Pos(nw.line + (pos.line - old.line), pos.ch) }
}

// Used by replaceSelections to allow moving the selection to the
// start or around the replaced test. Hint may be "start" or "around".
function computeReplacedSel(doc, changes, hint) {
  var out = [];
  var oldPrev = Pos(doc.first, 0), newPrev = oldPrev;
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var from = offsetPos(change.from, oldPrev, newPrev);
    var to = offsetPos(changeEnd(change), oldPrev, newPrev);
    oldPrev = change.to;
    newPrev = to;
    if (hint == "around") {
      var range = doc.sel.ranges[i], inv = cmp(range.head, range.anchor) < 0;
      out[i] = new Range(inv ? to : from, inv ? from : to);
    } else {
      out[i] = new Range(from, from);
    }
  }
  return new Selection(out, doc.sel.primIndex)
}

// Used to get the editor into a consistent state again when options change.

function loadMode(cm) {
  cm.doc.mode = getMode(cm.options, cm.doc.modeOption);
  resetModeState(cm);
}

function resetModeState(cm) {
  cm.doc.iter(function (line) {
    if (line.stateAfter) { line.stateAfter = null; }
    if (line.styles) { line.styles = null; }
  });
  cm.doc.modeFrontier = cm.doc.highlightFrontier = cm.doc.first;
  startWorker(cm, 100);
  cm.state.modeGen++;
  if (cm.curOp) { regChange(cm); }
}

// DOCUMENT DATA STRUCTURE

// By default, updates that start and end at the beginning of a line
// are treated specially, in order to make the association of line
// widgets and marker elements with the text behave more intuitive.
function isWholeLineUpdate(doc, change) {
  return change.from.ch == 0 && change.to.ch == 0 && lst(change.text) == "" &&
    (!doc.cm || doc.cm.options.wholeLineUpdateBefore)
}

// Perform a change on the document data structure.
function updateDoc(doc, change, markedSpans, estimateHeight) {
  function spansFor(n) {return markedSpans ? markedSpans[n] : null}
  function update(line, text, spans) {
    updateLine(line, text, spans, estimateHeight);
    signalLater(line, "change", line, change);
  }
  function linesFor(start, end) {
    var result = [];
    for (var i = start; i < end; ++i)
      { result.push(new Line(text[i], spansFor(i), estimateHeight)); }
    return result
  }

  var from = change.from, to = change.to, text = change.text;
  var firstLine = getLine(doc, from.line), lastLine = getLine(doc, to.line);
  var lastText = lst(text), lastSpans = spansFor(text.length - 1), nlines = to.line - from.line;

  // Adjust the line structure
  if (change.full) {
    doc.insert(0, linesFor(0, text.length));
    doc.remove(text.length, doc.size - text.length);
  } else if (isWholeLineUpdate(doc, change)) {
    // This is a whole-line replace. Treated specially to make
    // sure line objects move the way they are supposed to.
    var added = linesFor(0, text.length - 1);
    update(lastLine, lastLine.text, lastSpans);
    if (nlines) { doc.remove(from.line, nlines); }
    if (added.length) { doc.insert(from.line, added); }
  } else if (firstLine == lastLine) {
    if (text.length == 1) {
      update(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch), lastSpans);
    } else {
      var added$1 = linesFor(1, text.length - 1);
      added$1.push(new Line(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight));
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
      doc.insert(from.line + 1, added$1);
    }
  } else if (text.length == 1) {
    update(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch), spansFor(0));
    doc.remove(from.line + 1, nlines);
  } else {
    update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
    update(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans);
    var added$2 = linesFor(1, text.length - 1);
    if (nlines > 1) { doc.remove(from.line + 1, nlines - 1); }
    doc.insert(from.line + 1, added$2);
  }

  signalLater(doc, "change", doc, change);
}

// Call f for all linked documents.
function linkedDocs(doc, f, sharedHistOnly) {
  function propagate(doc, skip, sharedHist) {
    if (doc.linked) { for (var i = 0; i < doc.linked.length; ++i) {
      var rel = doc.linked[i];
      if (rel.doc == skip) { continue }
      var shared = sharedHist && rel.sharedHist;
      if (sharedHistOnly && !shared) { continue }
      f(rel.doc, shared);
      propagate(rel.doc, doc, shared);
    } }
  }
  propagate(doc, null, true);
}

// Attach a document to an editor.
function attachDoc(cm, doc) {
  if (doc.cm) { throw new Error("This document is already in use.") }
  cm.doc = doc;
  doc.cm = cm;
  estimateLineHeights(cm);
  loadMode(cm);
  setDirectionClass(cm);
  if (!cm.options.lineWrapping) { findMaxLine(cm); }
  cm.options.mode = doc.modeOption;
  regChange(cm);
}

function setDirectionClass(cm) {
  (cm.doc.direction == "rtl" ? addClass : rmClass)(cm.display.lineDiv, "CodeMirror-rtl");
}

function directionChanged(cm) {
  runInOp(cm, function () {
    setDirectionClass(cm);
    regChange(cm);
  });
}

function History(startGen) {
  // Arrays of change events and selections. Doing something adds an
  // event to done and clears undo. Undoing moves events from done
  // to undone, redoing moves them in the other direction.
  this.done = []; this.undone = [];
  this.undoDepth = Infinity;
  // Used to track when changes can be merged into a single undo
  // event
  this.lastModTime = this.lastSelTime = 0;
  this.lastOp = this.lastSelOp = null;
  this.lastOrigin = this.lastSelOrigin = null;
  // Used by the isClean() method
  this.generation = this.maxGeneration = startGen || 1;
}

// Create a history change event from an updateDoc-style change
// object.
function historyChangeFromChange(doc, change) {
  var histChange = {from: copyPos(change.from), to: changeEnd(change), text: getBetween(doc, change.from, change.to)};
  attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
  linkedDocs(doc, function (doc) { return attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1); }, true);
  return histChange
}

// Pop all selection events off the end of a history array. Stop at
// a change event.
function clearSelectionEvents(array) {
  while (array.length) {
    var last = lst(array);
    if (last.ranges) { array.pop(); }
    else { break }
  }
}

// Find the top change event in the history. Pop off selection
// events that are in the way.
function lastChangeEvent(hist, force) {
  if (force) {
    clearSelectionEvents(hist.done);
    return lst(hist.done)
  } else if (hist.done.length && !lst(hist.done).ranges) {
    return lst(hist.done)
  } else if (hist.done.length > 1 && !hist.done[hist.done.length - 2].ranges) {
    hist.done.pop();
    return lst(hist.done)
  }
}

// Register a change in the history. Merges changes that are within
// a single operation, or are close together with an origin that
// allows merging (starting with "+") into a single event.
function addChangeToHistory(doc, change, selAfter, opId) {
  var hist = doc.history;
  hist.undone.length = 0;
  var time = +new Date, cur;
  var last;

  if ((hist.lastOp == opId ||
       hist.lastOrigin == change.origin && change.origin &&
       ((change.origin.charAt(0) == "+" && doc.cm && hist.lastModTime > time - doc.cm.options.historyEventDelay) ||
        change.origin.charAt(0) == "*")) &&
      (cur = lastChangeEvent(hist, hist.lastOp == opId))) {
    // Merge this change into the last event
    last = lst(cur.changes);
    if (cmp(change.from, change.to) == 0 && cmp(change.from, last.to) == 0) {
      // Optimized case for simple insertion -- don't want to add
      // new changesets for every character typed
      last.to = changeEnd(change);
    } else {
      // Add new sub-event
      cur.changes.push(historyChangeFromChange(doc, change));
    }
  } else {
    // Can not be merged, start a new event.
    var before = lst(hist.done);
    if (!before || !before.ranges)
      { pushSelectionToHistory(doc.sel, hist.done); }
    cur = {changes: [historyChangeFromChange(doc, change)],
           generation: hist.generation};
    hist.done.push(cur);
    while (hist.done.length > hist.undoDepth) {
      hist.done.shift();
      if (!hist.done[0].ranges) { hist.done.shift(); }
    }
  }
  hist.done.push(selAfter);
  hist.generation = ++hist.maxGeneration;
  hist.lastModTime = hist.lastSelTime = time;
  hist.lastOp = hist.lastSelOp = opId;
  hist.lastOrigin = hist.lastSelOrigin = change.origin;

  if (!last) { signal(doc, "historyAdded"); }
}

function selectionEventCanBeMerged(doc, origin, prev, sel) {
  var ch = origin.charAt(0);
  return ch == "*" ||
    ch == "+" &&
    prev.ranges.length == sel.ranges.length &&
    prev.somethingSelected() == sel.somethingSelected() &&
    new Date - doc.history.lastSelTime <= (doc.cm ? doc.cm.options.historyEventDelay : 500)
}

// Called whenever the selection changes, sets the new selection as
// the pending selection in the history, and pushes the old pending
// selection into the 'done' array when it was significantly
// different (in number of selected ranges, emptiness, or time).
function addSelectionToHistory(doc, sel, opId, options) {
  var hist = doc.history, origin = options && options.origin;

  // A new event is started when the previous origin does not match
  // the current, or the origins don't allow matching. Origins
  // starting with * are always merged, those starting with + are
  // merged when similar and close together in time.
  if (opId == hist.lastSelOp ||
      (origin && hist.lastSelOrigin == origin &&
       (hist.lastModTime == hist.lastSelTime && hist.lastOrigin == origin ||
        selectionEventCanBeMerged(doc, origin, lst(hist.done), sel))))
    { hist.done[hist.done.length - 1] = sel; }
  else
    { pushSelectionToHistory(sel, hist.done); }

  hist.lastSelTime = +new Date;
  hist.lastSelOrigin = origin;
  hist.lastSelOp = opId;
  if (options && options.clearRedo !== false)
    { clearSelectionEvents(hist.undone); }
}

function pushSelectionToHistory(sel, dest) {
  var top = lst(dest);
  if (!(top && top.ranges && top.equals(sel)))
    { dest.push(sel); }
}

// Used to store marked span information in the history.
function attachLocalSpans(doc, change, from, to) {
  var existing = change["spans_" + doc.id], n = 0;
  doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function (line) {
    if (line.markedSpans)
      { (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans; }
    ++n;
  });
}

// When un/re-doing restores text containing marked spans, those
// that have been explicitly cleared should not be restored.
function removeClearedSpans(spans) {
  if (!spans) { return null }
  var out;
  for (var i = 0; i < spans.length; ++i) {
    if (spans[i].marker.explicitlyCleared) { if (!out) { out = spans.slice(0, i); } }
    else if (out) { out.push(spans[i]); }
  }
  return !out ? spans : out.length ? out : null
}

// Retrieve and filter the old marked spans stored in a change event.
function getOldSpans(doc, change) {
  var found = change["spans_" + doc.id];
  if (!found) { return null }
  var nw = [];
  for (var i = 0; i < change.text.length; ++i)
    { nw.push(removeClearedSpans(found[i])); }
  return nw
}

// Used for un/re-doing changes from the history. Combines the
// result of computing the existing spans with the set of spans that
// existed in the history (so that deleting around a span and then
// undoing brings back the span).
function mergeOldSpans(doc, change) {
  var old = getOldSpans(doc, change);
  var stretched = stretchSpansOverChange(doc, change);
  if (!old) { return stretched }
  if (!stretched) { return old }

  for (var i = 0; i < old.length; ++i) {
    var oldCur = old[i], stretchCur = stretched[i];
    if (oldCur && stretchCur) {
      spans: for (var j = 0; j < stretchCur.length; ++j) {
        var span = stretchCur[j];
        for (var k = 0; k < oldCur.length; ++k)
          { if (oldCur[k].marker == span.marker) { continue spans } }
        oldCur.push(span);
      }
    } else if (stretchCur) {
      old[i] = stretchCur;
    }
  }
  return old
}

// Used both to provide a JSON-safe object in .getHistory, and, when
// detaching a document, to split the history in two
function copyHistoryArray(events, newGroup, instantiateSel) {
  var copy = [];
  for (var i = 0; i < events.length; ++i) {
    var event = events[i];
    if (event.ranges) {
      copy.push(instantiateSel ? Selection.prototype.deepCopy.call(event) : event);
      continue
    }
    var changes = event.changes, newChanges = [];
    copy.push({changes: newChanges});
    for (var j = 0; j < changes.length; ++j) {
      var change = changes[j], m = (void 0);
      newChanges.push({from: change.from, to: change.to, text: change.text});
      if (newGroup) { for (var prop in change) { if (m = prop.match(/^spans_(\d+)$/)) {
        if (indexOf(newGroup, Number(m[1])) > -1) {
          lst(newChanges)[prop] = change[prop];
          delete change[prop];
        }
      } } }
    }
  }
  return copy
}

// The 'scroll' parameter given to many of these indicated whether
// the new cursor position should be scrolled into view after
// modifying the selection.

// If shift is held or the extend flag is set, extends a range to
// include a given position (and optionally a second position).
// Otherwise, simply returns the range between the given positions.
// Used for cursor motion and such.
function extendRange(range, head, other, extend) {
  if (extend) {
    var anchor = range.anchor;
    if (other) {
      var posBefore = cmp(head, anchor) < 0;
      if (posBefore != (cmp(other, anchor) < 0)) {
        anchor = head;
        head = other;
      } else if (posBefore != (cmp(head, other) < 0)) {
        head = other;
      }
    }
    return new Range(anchor, head)
  } else {
    return new Range(other || head, head)
  }
}

// Extend the primary selection range, discard the rest.
function extendSelection(doc, head, other, options, extend) {
  if (extend == null) { extend = doc.cm && (doc.cm.display.shift || doc.extend); }
  setSelection(doc, new Selection([extendRange(doc.sel.primary(), head, other, extend)], 0), options);
}

// Extend all selections (pos is an array of selections with length
// equal the number of selections)
function extendSelections(doc, heads, options) {
  var out = [];
  var extend = doc.cm && (doc.cm.display.shift || doc.extend);
  for (var i = 0; i < doc.sel.ranges.length; i++)
    { out[i] = extendRange(doc.sel.ranges[i], heads[i], null, extend); }
  var newSel = normalizeSelection(out, doc.sel.primIndex);
  setSelection(doc, newSel, options);
}

// Updates a single range in the selection.
function replaceOneSelection(doc, i, range, options) {
  var ranges = doc.sel.ranges.slice(0);
  ranges[i] = range;
  setSelection(doc, normalizeSelection(ranges, doc.sel.primIndex), options);
}

// Reset the selection to a single range.
function setSimpleSelection(doc, anchor, head, options) {
  setSelection(doc, simpleSelection(anchor, head), options);
}

// Give beforeSelectionChange handlers a change to influence a
// selection update.
function filterSelectionChange(doc, sel, options) {
  var obj = {
    ranges: sel.ranges,
    update: function(ranges) {
      var this$1 = this;

      this.ranges = [];
      for (var i = 0; i < ranges.length; i++)
        { this$1.ranges[i] = new Range(clipPos(doc, ranges[i].anchor),
                                   clipPos(doc, ranges[i].head)); }
    },
    origin: options && options.origin
  };
  signal(doc, "beforeSelectionChange", doc, obj);
  if (doc.cm) { signal(doc.cm, "beforeSelectionChange", doc.cm, obj); }
  if (obj.ranges != sel.ranges) { return normalizeSelection(obj.ranges, obj.ranges.length - 1) }
  else { return sel }
}

function setSelectionReplaceHistory(doc, sel, options) {
  var done = doc.history.done, last = lst(done);
  if (last && last.ranges) {
    done[done.length - 1] = sel;
    setSelectionNoUndo(doc, sel, options);
  } else {
    setSelection(doc, sel, options);
  }
}

// Set a new selection.
function setSelection(doc, sel, options) {
  setSelectionNoUndo(doc, sel, options);
  addSelectionToHistory(doc, doc.sel, doc.cm ? doc.cm.curOp.id : NaN, options);
}

function setSelectionNoUndo(doc, sel, options) {
  if (hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange"))
    { sel = filterSelectionChange(doc, sel, options); }

  var bias = options && options.bias ||
    (cmp(sel.primary().head, doc.sel.primary().head) < 0 ? -1 : 1);
  setSelectionInner(doc, skipAtomicInSelection(doc, sel, bias, true));

  if (!(options && options.scroll === false) && doc.cm)
    { ensureCursorVisible(doc.cm); }
}

function setSelectionInner(doc, sel) {
  if (sel.equals(doc.sel)) { return }

  doc.sel = sel;

  if (doc.cm) {
    doc.cm.curOp.updateInput = doc.cm.curOp.selectionChanged = true;
    signalCursorActivity(doc.cm);
  }
  signalLater(doc, "cursorActivity", doc);
}

// Verify that the selection does not partially select any atomic
// marked ranges.
function reCheckSelection(doc) {
  setSelectionInner(doc, skipAtomicInSelection(doc, doc.sel, null, false));
}

// Return a selection that does not partially select any atomic
// ranges.
function skipAtomicInSelection(doc, sel, bias, mayClear) {
  var out;
  for (var i = 0; i < sel.ranges.length; i++) {
    var range = sel.ranges[i];
    var old = sel.ranges.length == doc.sel.ranges.length && doc.sel.ranges[i];
    var newAnchor = skipAtomic(doc, range.anchor, old && old.anchor, bias, mayClear);
    var newHead = skipAtomic(doc, range.head, old && old.head, bias, mayClear);
    if (out || newAnchor != range.anchor || newHead != range.head) {
      if (!out) { out = sel.ranges.slice(0, i); }
      out[i] = new Range(newAnchor, newHead);
    }
  }
  return out ? normalizeSelection(out, sel.primIndex) : sel
}

function skipAtomicInner(doc, pos, oldPos, dir, mayClear) {
  var line = getLine(doc, pos.line);
  if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
    var sp = line.markedSpans[i], m = sp.marker;
    if ((sp.from == null || (m.inclusiveLeft ? sp.from <= pos.ch : sp.from < pos.ch)) &&
        (sp.to == null || (m.inclusiveRight ? sp.to >= pos.ch : sp.to > pos.ch))) {
      if (mayClear) {
        signal(m, "beforeCursorEnter");
        if (m.explicitlyCleared) {
          if (!line.markedSpans) { break }
          else {--i; continue}
        }
      }
      if (!m.atomic) { continue }

      if (oldPos) {
        var near = m.find(dir < 0 ? 1 : -1), diff = (void 0);
        if (dir < 0 ? m.inclusiveRight : m.inclusiveLeft)
          { near = movePos(doc, near, -dir, near && near.line == pos.line ? line : null); }
        if (near && near.line == pos.line && (diff = cmp(near, oldPos)) && (dir < 0 ? diff < 0 : diff > 0))
          { return skipAtomicInner(doc, near, pos, dir, mayClear) }
      }

      var far = m.find(dir < 0 ? -1 : 1);
      if (dir < 0 ? m.inclusiveLeft : m.inclusiveRight)
        { far = movePos(doc, far, dir, far.line == pos.line ? line : null); }
      return far ? skipAtomicInner(doc, far, pos, dir, mayClear) : null
    }
  } }
  return pos
}

// Ensure a given position is not inside an atomic range.
function skipAtomic(doc, pos, oldPos, bias, mayClear) {
  var dir = bias || 1;
  var found = skipAtomicInner(doc, pos, oldPos, dir, mayClear) ||
      (!mayClear && skipAtomicInner(doc, pos, oldPos, dir, true)) ||
      skipAtomicInner(doc, pos, oldPos, -dir, mayClear) ||
      (!mayClear && skipAtomicInner(doc, pos, oldPos, -dir, true));
  if (!found) {
    doc.cantEdit = true;
    return Pos(doc.first, 0)
  }
  return found
}

function movePos(doc, pos, dir, line) {
  if (dir < 0 && pos.ch == 0) {
    if (pos.line > doc.first) { return clipPos(doc, Pos(pos.line - 1)) }
    else { return null }
  } else if (dir > 0 && pos.ch == (line || getLine(doc, pos.line)).text.length) {
    if (pos.line < doc.first + doc.size - 1) { return Pos(pos.line + 1, 0) }
    else { return null }
  } else {
    return new Pos(pos.line, pos.ch + dir)
  }
}

function selectAll(cm) {
  cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()), sel_dontScroll);
}

// UPDATING

// Allow "beforeChange" event handlers to influence a change
function filterChange(doc, change, update) {
  var obj = {
    canceled: false,
    from: change.from,
    to: change.to,
    text: change.text,
    origin: change.origin,
    cancel: function () { return obj.canceled = true; }
  };
  if (update) { obj.update = function (from, to, text, origin) {
    if (from) { obj.from = clipPos(doc, from); }
    if (to) { obj.to = clipPos(doc, to); }
    if (text) { obj.text = text; }
    if (origin !== undefined) { obj.origin = origin; }
  }; }
  signal(doc, "beforeChange", doc, obj);
  if (doc.cm) { signal(doc.cm, "beforeChange", doc.cm, obj); }

  if (obj.canceled) { return null }
  return {from: obj.from, to: obj.to, text: obj.text, origin: obj.origin}
}

// Apply a change to a document, and add it to the document's
// history, and propagating it to all linked documents.
function makeChange(doc, change, ignoreReadOnly) {
  if (doc.cm) {
    if (!doc.cm.curOp) { return operation(doc.cm, makeChange)(doc, change, ignoreReadOnly) }
    if (doc.cm.state.suppressEdits) { return }
  }

  if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
    change = filterChange(doc, change, true);
    if (!change) { return }
  }

  // Possibly split or suppress the update based on the presence
  // of read-only spans in its range.
  var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);
  if (split) {
    for (var i = split.length - 1; i >= 0; --i)
      { makeChangeInner(doc, {from: split[i].from, to: split[i].to, text: i ? [""] : change.text}); }
  } else {
    makeChangeInner(doc, change);
  }
}

function makeChangeInner(doc, change) {
  if (change.text.length == 1 && change.text[0] == "" && cmp(change.from, change.to) == 0) { return }
  var selAfter = computeSelAfterChange(doc, change);
  addChangeToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);

  makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
  var rebased = [];

  linkedDocs(doc, function (doc, sharedHist) {
    if (!sharedHist && indexOf(rebased, doc.history) == -1) {
      rebaseHist(doc.history, change);
      rebased.push(doc.history);
    }
    makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
  });
}

// Revert a change stored in a document's history.
function makeChangeFromHistory(doc, type, allowSelectionOnly) {
  if (doc.cm && doc.cm.state.suppressEdits && !allowSelectionOnly) { return }

  var hist = doc.history, event, selAfter = doc.sel;
  var source = type == "undo" ? hist.done : hist.undone, dest = type == "undo" ? hist.undone : hist.done;

  // Verify that there is a useable event (so that ctrl-z won't
  // needlessly clear selection events)
  var i = 0;
  for (; i < source.length; i++) {
    event = source[i];
    if (allowSelectionOnly ? event.ranges && !event.equals(doc.sel) : !event.ranges)
      { break }
  }
  if (i == source.length) { return }
  hist.lastOrigin = hist.lastSelOrigin = null;

  for (;;) {
    event = source.pop();
    if (event.ranges) {
      pushSelectionToHistory(event, dest);
      if (allowSelectionOnly && !event.equals(doc.sel)) {
        setSelection(doc, event, {clearRedo: false});
        return
      }
      selAfter = event;
    }
    else { break }
  }

  // Build up a reverse change object to add to the opposite history
  // stack (redo when undoing, and vice versa).
  var antiChanges = [];
  pushSelectionToHistory(selAfter, dest);
  dest.push({changes: antiChanges, generation: hist.generation});
  hist.generation = event.generation || ++hist.maxGeneration;

  var filter = hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange");

  var loop = function ( i ) {
    var change = event.changes[i];
    change.origin = type;
    if (filter && !filterChange(doc, change, false)) {
      source.length = 0;
      return {}
    }

    antiChanges.push(historyChangeFromChange(doc, change));

    var after = i ? computeSelAfterChange(doc, change) : lst(source);
    makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));
    if (!i && doc.cm) { doc.cm.scrollIntoView({from: change.from, to: changeEnd(change)}); }
    var rebased = [];

    // Propagate to the linked documents
    linkedDocs(doc, function (doc, sharedHist) {
      if (!sharedHist && indexOf(rebased, doc.history) == -1) {
        rebaseHist(doc.history, change);
        rebased.push(doc.history);
      }
      makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
    });
  };

  for (var i$1 = event.changes.length - 1; i$1 >= 0; --i$1) {
    var returned = loop( i$1 );

    if ( returned ) return returned.v;
  }
}

// Sub-views need their line numbers shifted when text is added
// above or below them in the parent document.
function shiftDoc(doc, distance) {
  if (distance == 0) { return }
  doc.first += distance;
  doc.sel = new Selection(map(doc.sel.ranges, function (range) { return new Range(
    Pos(range.anchor.line + distance, range.anchor.ch),
    Pos(range.head.line + distance, range.head.ch)
  ); }), doc.sel.primIndex);
  if (doc.cm) {
    regChange(doc.cm, doc.first, doc.first - distance, distance);
    for (var d = doc.cm.display, l = d.viewFrom; l < d.viewTo; l++)
      { regLineChange(doc.cm, l, "gutter"); }
  }
}

// More lower-level change function, handling only a single document
// (not linked ones).
function makeChangeSingleDoc(doc, change, selAfter, spans) {
  if (doc.cm && !doc.cm.curOp)
    { return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans) }

  if (change.to.line < doc.first) {
    shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
    return
  }
  if (change.from.line > doc.lastLine()) { return }

  // Clip the change to the size of this doc
  if (change.from.line < doc.first) {
    var shift = change.text.length - 1 - (doc.first - change.from.line);
    shiftDoc(doc, shift);
    change = {from: Pos(doc.first, 0), to: Pos(change.to.line + shift, change.to.ch),
              text: [lst(change.text)], origin: change.origin};
  }
  var last = doc.lastLine();
  if (change.to.line > last) {
    change = {from: change.from, to: Pos(last, getLine(doc, last).text.length),
              text: [change.text[0]], origin: change.origin};
  }

  change.removed = getBetween(doc, change.from, change.to);

  if (!selAfter) { selAfter = computeSelAfterChange(doc, change); }
  if (doc.cm) { makeChangeSingleDocInEditor(doc.cm, change, spans); }
  else { updateDoc(doc, change, spans); }
  setSelectionNoUndo(doc, selAfter, sel_dontScroll);
}

// Handle the interaction of a change to a document with the editor
// that this document is part of.
function makeChangeSingleDocInEditor(cm, change, spans) {
  var doc = cm.doc, display = cm.display, from = change.from, to = change.to;

  var recomputeMaxLength = false, checkWidthStart = from.line;
  if (!cm.options.lineWrapping) {
    checkWidthStart = lineNo(visualLine(getLine(doc, from.line)));
    doc.iter(checkWidthStart, to.line + 1, function (line) {
      if (line == display.maxLine) {
        recomputeMaxLength = true;
        return true
      }
    });
  }

  if (doc.sel.contains(change.from, change.to) > -1)
    { signalCursorActivity(cm); }

  updateDoc(doc, change, spans, estimateHeight(cm));

  if (!cm.options.lineWrapping) {
    doc.iter(checkWidthStart, from.line + change.text.length, function (line) {
      var len = lineLength(line);
      if (len > display.maxLineLength) {
        display.maxLine = line;
        display.maxLineLength = len;
        display.maxLineChanged = true;
        recomputeMaxLength = false;
      }
    });
    if (recomputeMaxLength) { cm.curOp.updateMaxLine = true; }
  }

  retreatFrontier(doc, from.line);
  startWorker(cm, 400);

  var lendiff = change.text.length - (to.line - from.line) - 1;
  // Remember that these lines changed, for updating the display
  if (change.full)
    { regChange(cm); }
  else if (from.line == to.line && change.text.length == 1 && !isWholeLineUpdate(cm.doc, change))
    { regLineChange(cm, from.line, "text"); }
  else
    { regChange(cm, from.line, to.line + 1, lendiff); }

  var changesHandler = hasHandler(cm, "changes"), changeHandler = hasHandler(cm, "change");
  if (changeHandler || changesHandler) {
    var obj = {
      from: from, to: to,
      text: change.text,
      removed: change.removed,
      origin: change.origin
    };
    if (changeHandler) { signalLater(cm, "change", cm, obj); }
    if (changesHandler) { (cm.curOp.changeObjs || (cm.curOp.changeObjs = [])).push(obj); }
  }
  cm.display.selForContextMenu = null;
}

function replaceRange(doc, code, from, to, origin) {
  if (!to) { to = from; }
  if (cmp(to, from) < 0) { var tmp = to; to = from; from = tmp; }
  if (typeof code == "string") { code = doc.splitLines(code); }
  makeChange(doc, {from: from, to: to, text: code, origin: origin});
}

// Rebasing/resetting history to deal with externally-sourced changes

function rebaseHistSelSingle(pos, from, to, diff) {
  if (to < pos.line) {
    pos.line += diff;
  } else if (from < pos.line) {
    pos.line = from;
    pos.ch = 0;
  }
}

// Tries to rebase an array of history events given a change in the
// document. If the change touches the same lines as the event, the
// event, and everything 'behind' it, is discarded. If the change is
// before the event, the event's positions are updated. Uses a
// copy-on-write scheme for the positions, to avoid having to
// reallocate them all on every rebase, but also avoid problems with
// shared position objects being unsafely updated.
function rebaseHistArray(array, from, to, diff) {
  for (var i = 0; i < array.length; ++i) {
    var sub = array[i], ok = true;
    if (sub.ranges) {
      if (!sub.copied) { sub = array[i] = sub.deepCopy(); sub.copied = true; }
      for (var j = 0; j < sub.ranges.length; j++) {
        rebaseHistSelSingle(sub.ranges[j].anchor, from, to, diff);
        rebaseHistSelSingle(sub.ranges[j].head, from, to, diff);
      }
      continue
    }
    for (var j$1 = 0; j$1 < sub.changes.length; ++j$1) {
      var cur = sub.changes[j$1];
      if (to < cur.from.line) {
        cur.from = Pos(cur.from.line + diff, cur.from.ch);
        cur.to = Pos(cur.to.line + diff, cur.to.ch);
      } else if (from <= cur.to.line) {
        ok = false;
        break
      }
    }
    if (!ok) {
      array.splice(0, i + 1);
      i = 0;
    }
  }
}

function rebaseHist(hist, change) {
  var from = change.from.line, to = change.to.line, diff = change.text.length - (to - from) - 1;
  rebaseHistArray(hist.done, from, to, diff);
  rebaseHistArray(hist.undone, from, to, diff);
}

// Utility for applying a change to a line by handle or number,
// returning the number and optionally registering the line as
// changed.
function changeLine(doc, handle, changeType, op) {
  var no = handle, line = handle;
  if (typeof handle == "number") { line = getLine(doc, clipLine(doc, handle)); }
  else { no = lineNo(handle); }
  if (no == null) { return null }
  if (op(line, no) && doc.cm) { regLineChange(doc.cm, no, changeType); }
  return line
}

// The document is represented as a BTree consisting of leaves, with
// chunk of lines in them, and branches, with up to ten leaves or
// other branch nodes below them. The top node is always a branch
// node, and is the document object itself (meaning it has
// additional methods and properties).
//
// All nodes have parent links. The tree is used both to go from
// line numbers to line objects, and to go from objects to numbers.
// It also indexes by height, and is used to convert between height
// and line object, and to find the total height of the document.
//
// See also http://marijnhaverbeke.nl/blog/codemirror-line-tree.html

function LeafChunk(lines) {
  var this$1 = this;

  this.lines = lines;
  this.parent = null;
  var height = 0;
  for (var i = 0; i < lines.length; ++i) {
    lines[i].parent = this$1;
    height += lines[i].height;
  }
  this.height = height;
}

LeafChunk.prototype = {
  chunkSize: function chunkSize() { return this.lines.length },

  // Remove the n lines at offset 'at'.
  removeInner: function removeInner(at, n) {
    var this$1 = this;

    for (var i = at, e = at + n; i < e; ++i) {
      var line = this$1.lines[i];
      this$1.height -= line.height;
      cleanUpLine(line);
      signalLater(line, "delete");
    }
    this.lines.splice(at, n);
  },

  // Helper used to collapse a small branch into a single leaf.
  collapse: function collapse(lines) {
    lines.push.apply(lines, this.lines);
  },

  // Insert the given array of lines at offset 'at', count them as
  // having the given height.
  insertInner: function insertInner(at, lines, height) {
    var this$1 = this;

    this.height += height;
    this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
    for (var i = 0; i < lines.length; ++i) { lines[i].parent = this$1; }
  },

  // Used to iterate over a part of the tree.
  iterN: function iterN(at, n, op) {
    var this$1 = this;

    for (var e = at + n; at < e; ++at)
      { if (op(this$1.lines[at])) { return true } }
  }
};

function BranchChunk(children) {
  var this$1 = this;

  this.children = children;
  var size = 0, height = 0;
  for (var i = 0; i < children.length; ++i) {
    var ch = children[i];
    size += ch.chunkSize(); height += ch.height;
    ch.parent = this$1;
  }
  this.size = size;
  this.height = height;
  this.parent = null;
}

BranchChunk.prototype = {
  chunkSize: function chunkSize() { return this.size },

  removeInner: function removeInner(at, n) {
    var this$1 = this;

    this.size -= n;
    for (var i = 0; i < this.children.length; ++i) {
      var child = this$1.children[i], sz = child.chunkSize();
      if (at < sz) {
        var rm = Math.min(n, sz - at), oldHeight = child.height;
        child.removeInner(at, rm);
        this$1.height -= oldHeight - child.height;
        if (sz == rm) { this$1.children.splice(i--, 1); child.parent = null; }
        if ((n -= rm) == 0) { break }
        at = 0;
      } else { at -= sz; }
    }
    // If the result is smaller than 25 lines, ensure that it is a
    // single leaf node.
    if (this.size - n < 25 &&
        (this.children.length > 1 || !(this.children[0] instanceof LeafChunk))) {
      var lines = [];
      this.collapse(lines);
      this.children = [new LeafChunk(lines)];
      this.children[0].parent = this;
    }
  },

  collapse: function collapse(lines) {
    var this$1 = this;

    for (var i = 0; i < this.children.length; ++i) { this$1.children[i].collapse(lines); }
  },

  insertInner: function insertInner(at, lines, height) {
    var this$1 = this;

    this.size += lines.length;
    this.height += height;
    for (var i = 0; i < this.children.length; ++i) {
      var child = this$1.children[i], sz = child.chunkSize();
      if (at <= sz) {
        child.insertInner(at, lines, height);
        if (child.lines && child.lines.length > 50) {
          // To avoid memory thrashing when child.lines is huge (e.g. first view of a large file), it's never spliced.
          // Instead, small slices are taken. They're taken in order because sequential memory accesses are fastest.
          var remaining = child.lines.length % 25 + 25;
          for (var pos = remaining; pos < child.lines.length;) {
            var leaf = new LeafChunk(child.lines.slice(pos, pos += 25));
            child.height -= leaf.height;
            this$1.children.splice(++i, 0, leaf);
            leaf.parent = this$1;
          }
          child.lines = child.lines.slice(0, remaining);
          this$1.maybeSpill();
        }
        break
      }
      at -= sz;
    }
  },

  // When a node has grown, check whether it should be split.
  maybeSpill: function maybeSpill() {
    if (this.children.length <= 10) { return }
    var me = this;
    do {
      var spilled = me.children.splice(me.children.length - 5, 5);
      var sibling = new BranchChunk(spilled);
      if (!me.parent) { // Become the parent node
        var copy = new BranchChunk(me.children);
        copy.parent = me;
        me.children = [copy, sibling];
        me = copy;
     } else {
        me.size -= sibling.size;
        me.height -= sibling.height;
        var myIndex = indexOf(me.parent.children, me);
        me.parent.children.splice(myIndex + 1, 0, sibling);
      }
      sibling.parent = me.parent;
    } while (me.children.length > 10)
    me.parent.maybeSpill();
  },

  iterN: function iterN(at, n, op) {
    var this$1 = this;

    for (var i = 0; i < this.children.length; ++i) {
      var child = this$1.children[i], sz = child.chunkSize();
      if (at < sz) {
        var used = Math.min(n, sz - at);
        if (child.iterN(at, used, op)) { return true }
        if ((n -= used) == 0) { break }
        at = 0;
      } else { at -= sz; }
    }
  }
};

// Line widgets are block elements displayed above or below a line.

var LineWidget = function(doc, node, options) {
  var this$1 = this;

  if (options) { for (var opt in options) { if (options.hasOwnProperty(opt))
    { this$1[opt] = options[opt]; } } }
  this.doc = doc;
  this.node = node;
};

LineWidget.prototype.clear = function () {
    var this$1 = this;

  var cm = this.doc.cm, ws = this.line.widgets, line = this.line, no = lineNo(line);
  if (no == null || !ws) { return }
  for (var i = 0; i < ws.length; ++i) { if (ws[i] == this$1) { ws.splice(i--, 1); } }
  if (!ws.length) { line.widgets = null; }
  var height = widgetHeight(this);
  updateLineHeight(line, Math.max(0, line.height - height));
  if (cm) {
    runInOp(cm, function () {
      adjustScrollWhenAboveVisible(cm, line, -height);
      regLineChange(cm, no, "widget");
    });
    signalLater(cm, "lineWidgetCleared", cm, this, no);
  }
};

LineWidget.prototype.changed = function () {
    var this$1 = this;

  var oldH = this.height, cm = this.doc.cm, line = this.line;
  this.height = null;
  var diff = widgetHeight(this) - oldH;
  if (!diff) { return }
  updateLineHeight(line, line.height + diff);
  if (cm) {
    runInOp(cm, function () {
      cm.curOp.forceUpdate = true;
      adjustScrollWhenAboveVisible(cm, line, diff);
      signalLater(cm, "lineWidgetChanged", cm, this$1, lineNo(line));
    });
  }
};
eventMixin(LineWidget);

function adjustScrollWhenAboveVisible(cm, line, diff) {
  if (heightAtLine(line) < ((cm.curOp && cm.curOp.scrollTop) || cm.doc.scrollTop))
    { addToScrollTop(cm, diff); }
}

function addLineWidget(doc, handle, node, options) {
  var widget = new LineWidget(doc, node, options);
  var cm = doc.cm;
  if (cm && widget.noHScroll) { cm.display.alignWidgets = true; }
  changeLine(doc, handle, "widget", function (line) {
    var widgets = line.widgets || (line.widgets = []);
    if (widget.insertAt == null) { widgets.push(widget); }
    else { widgets.splice(Math.min(widgets.length - 1, Math.max(0, widget.insertAt)), 0, widget); }
    widget.line = line;
    if (cm && !lineIsHidden(doc, line)) {
      var aboveVisible = heightAtLine(line) < doc.scrollTop;
      updateLineHeight(line, line.height + widgetHeight(widget));
      if (aboveVisible) { addToScrollTop(cm, widget.height); }
      cm.curOp.forceUpdate = true;
    }
    return true
  });
  signalLater(cm, "lineWidgetAdded", cm, widget, typeof handle == "number" ? handle : lineNo(handle));
  return widget
}

// TEXTMARKERS

// Created with markText and setBookmark methods. A TextMarker is a
// handle that can be used to clear or find a marked position in the
// document. Line objects hold arrays (markedSpans) containing
// {from, to, marker} object pointing to such marker objects, and
// indicating that such a marker is present on that line. Multiple
// lines may point to the same marker when it spans across lines.
// The spans will have null for their from/to properties when the
// marker continues beyond the start/end of the line. Markers have
// links back to the lines they currently touch.

// Collapsed markers have unique ids, in order to be able to order
// them, which is needed for uniquely determining an outer marker
// when they overlap (they may nest, but not partially overlap).
var nextMarkerId = 0;

var TextMarker = function(doc, type) {
  this.lines = [];
  this.type = type;
  this.doc = doc;
  this.id = ++nextMarkerId;
};

// Clear the marker.
TextMarker.prototype.clear = function () {
    var this$1 = this;

  if (this.explicitlyCleared) { return }
  var cm = this.doc.cm, withOp = cm && !cm.curOp;
  if (withOp) { startOperation(cm); }
  if (hasHandler(this, "clear")) {
    var found = this.find();
    if (found) { signalLater(this, "clear", found.from, found.to); }
  }
  var min = null, max = null;
  for (var i = 0; i < this.lines.length; ++i) {
    var line = this$1.lines[i];
    var span = getMarkedSpanFor(line.markedSpans, this$1);
    if (cm && !this$1.collapsed) { regLineChange(cm, lineNo(line), "text"); }
    else if (cm) {
      if (span.to != null) { max = lineNo(line); }
      if (span.from != null) { min = lineNo(line); }
    }
    line.markedSpans = removeMarkedSpan(line.markedSpans, span);
    if (span.from == null && this$1.collapsed && !lineIsHidden(this$1.doc, line) && cm)
      { updateLineHeight(line, textHeight(cm.display)); }
  }
  if (cm && this.collapsed && !cm.options.lineWrapping) { for (var i$1 = 0; i$1 < this.lines.length; ++i$1) {
    var visual = visualLine(this$1.lines[i$1]), len = lineLength(visual);
    if (len > cm.display.maxLineLength) {
      cm.display.maxLine = visual;
      cm.display.maxLineLength = len;
      cm.display.maxLineChanged = true;
    }
  } }

  if (min != null && cm && this.collapsed) { regChange(cm, min, max + 1); }
  this.lines.length = 0;
  this.explicitlyCleared = true;
  if (this.atomic && this.doc.cantEdit) {
    this.doc.cantEdit = false;
    if (cm) { reCheckSelection(cm.doc); }
  }
  if (cm) { signalLater(cm, "markerCleared", cm, this, min, max); }
  if (withOp) { endOperation(cm); }
  if (this.parent) { this.parent.clear(); }
};

// Find the position of the marker in the document. Returns a {from,
// to} object by default. Side can be passed to get a specific side
// -- 0 (both), -1 (left), or 1 (right). When lineObj is true, the
// Pos objects returned contain a line object, rather than a line
// number (used to prevent looking up the same line twice).
TextMarker.prototype.find = function (side, lineObj) {
    var this$1 = this;

  if (side == null && this.type == "bookmark") { side = 1; }
  var from, to;
  for (var i = 0; i < this.lines.length; ++i) {
    var line = this$1.lines[i];
    var span = getMarkedSpanFor(line.markedSpans, this$1);
    if (span.from != null) {
      from = Pos(lineObj ? line : lineNo(line), span.from);
      if (side == -1) { return from }
    }
    if (span.to != null) {
      to = Pos(lineObj ? line : lineNo(line), span.to);
      if (side == 1) { return to }
    }
  }
  return from && {from: from, to: to}
};

// Signals that the marker's widget changed, and surrounding layout
// should be recomputed.
TextMarker.prototype.changed = function () {
    var this$1 = this;

  var pos = this.find(-1, true), widget = this, cm = this.doc.cm;
  if (!pos || !cm) { return }
  runInOp(cm, function () {
    var line = pos.line, lineN = lineNo(pos.line);
    var view = findViewForLine(cm, lineN);
    if (view) {
      clearLineMeasurementCacheFor(view);
      cm.curOp.selectionChanged = cm.curOp.forceUpdate = true;
    }
    cm.curOp.updateMaxLine = true;
    if (!lineIsHidden(widget.doc, line) && widget.height != null) {
      var oldHeight = widget.height;
      widget.height = null;
      var dHeight = widgetHeight(widget) - oldHeight;
      if (dHeight)
        { updateLineHeight(line, line.height + dHeight); }
    }
    signalLater(cm, "markerChanged", cm, this$1);
  });
};

TextMarker.prototype.attachLine = function (line) {
  if (!this.lines.length && this.doc.cm) {
    var op = this.doc.cm.curOp;
    if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1)
      { (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this); }
  }
  this.lines.push(line);
};

TextMarker.prototype.detachLine = function (line) {
  this.lines.splice(indexOf(this.lines, line), 1);
  if (!this.lines.length && this.doc.cm) {
    var op = this.doc.cm.curOp;(op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
  }
};
eventMixin(TextMarker);

// Create a marker, wire it up to the right lines, and
function markText(doc, from, to, options, type) {
  // Shared markers (across linked documents) are handled separately
  // (markTextShared will call out to this again, once per
  // document).
  if (options && options.shared) { return markTextShared(doc, from, to, options, type) }
  // Ensure we are in an operation.
  if (doc.cm && !doc.cm.curOp) { return operation(doc.cm, markText)(doc, from, to, options, type) }

  var marker = new TextMarker(doc, type), diff = cmp(from, to);
  if (options) { copyObj(options, marker, false); }
  // Don't connect empty markers unless clearWhenEmpty is false
  if (diff > 0 || diff == 0 && marker.clearWhenEmpty !== false)
    { return marker }
  if (marker.replacedWith) {
    // Showing up as a widget implies collapsed (widget replaces text)
    marker.collapsed = true;
    marker.widgetNode = eltP("span", [marker.replacedWith], "CodeMirror-widget");
    if (!options.handleMouseEvents) { marker.widgetNode.setAttribute("cm-ignore-events", "true"); }
    if (options.insertLeft) { marker.widgetNode.insertLeft = true; }
  }
  if (marker.collapsed) {
    if (conflictingCollapsedRange(doc, from.line, from, to, marker) ||
        from.line != to.line && conflictingCollapsedRange(doc, to.line, from, to, marker))
      { throw new Error("Inserting collapsed marker partially overlapping an existing one") }
    seeCollapsedSpans();
  }

  if (marker.addToHistory)
    { addChangeToHistory(doc, {from: from, to: to, origin: "markText"}, doc.sel, NaN); }

  var curLine = from.line, cm = doc.cm, updateMaxLine;
  doc.iter(curLine, to.line + 1, function (line) {
    if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(line) == cm.display.maxLine)
      { updateMaxLine = true; }
    if (marker.collapsed && curLine != from.line) { updateLineHeight(line, 0); }
    addMarkedSpan(line, new MarkedSpan(marker,
                                       curLine == from.line ? from.ch : null,
                                       curLine == to.line ? to.ch : null));
    ++curLine;
  });
  // lineIsHidden depends on the presence of the spans, so needs a second pass
  if (marker.collapsed) { doc.iter(from.line, to.line + 1, function (line) {
    if (lineIsHidden(doc, line)) { updateLineHeight(line, 0); }
  }); }

  if (marker.clearOnEnter) { on(marker, "beforeCursorEnter", function () { return marker.clear(); }); }

  if (marker.readOnly) {
    seeReadOnlySpans();
    if (doc.history.done.length || doc.history.undone.length)
      { doc.clearHistory(); }
  }
  if (marker.collapsed) {
    marker.id = ++nextMarkerId;
    marker.atomic = true;
  }
  if (cm) {
    // Sync editor state
    if (updateMaxLine) { cm.curOp.updateMaxLine = true; }
    if (marker.collapsed)
      { regChange(cm, from.line, to.line + 1); }
    else if (marker.className || marker.title || marker.startStyle || marker.endStyle || marker.css)
      { for (var i = from.line; i <= to.line; i++) { regLineChange(cm, i, "text"); } }
    if (marker.atomic) { reCheckSelection(cm.doc); }
    signalLater(cm, "markerAdded", cm, marker);
  }
  return marker
}

// SHARED TEXTMARKERS

// A shared marker spans multiple linked documents. It is
// implemented as a meta-marker-object controlling multiple normal
// markers.
var SharedTextMarker = function(markers, primary) {
  var this$1 = this;

  this.markers = markers;
  this.primary = primary;
  for (var i = 0; i < markers.length; ++i)
    { markers[i].parent = this$1; }
};

SharedTextMarker.prototype.clear = function () {
    var this$1 = this;

  if (this.explicitlyCleared) { return }
  this.explicitlyCleared = true;
  for (var i = 0; i < this.markers.length; ++i)
    { this$1.markers[i].clear(); }
  signalLater(this, "clear");
};

SharedTextMarker.prototype.find = function (side, lineObj) {
  return this.primary.find(side, lineObj)
};
eventMixin(SharedTextMarker);

function markTextShared(doc, from, to, options, type) {
  options = copyObj(options);
  options.shared = false;
  var markers = [markText(doc, from, to, options, type)], primary = markers[0];
  var widget = options.widgetNode;
  linkedDocs(doc, function (doc) {
    if (widget) { options.widgetNode = widget.cloneNode(true); }
    markers.push(markText(doc, clipPos(doc, from), clipPos(doc, to), options, type));
    for (var i = 0; i < doc.linked.length; ++i)
      { if (doc.linked[i].isParent) { return } }
    primary = lst(markers);
  });
  return new SharedTextMarker(markers, primary)
}

function findSharedMarkers(doc) {
  return doc.findMarks(Pos(doc.first, 0), doc.clipPos(Pos(doc.lastLine())), function (m) { return m.parent; })
}

function copySharedMarkers(doc, markers) {
  for (var i = 0; i < markers.length; i++) {
    var marker = markers[i], pos = marker.find();
    var mFrom = doc.clipPos(pos.from), mTo = doc.clipPos(pos.to);
    if (cmp(mFrom, mTo)) {
      var subMark = markText(doc, mFrom, mTo, marker.primary, marker.primary.type);
      marker.markers.push(subMark);
      subMark.parent = marker;
    }
  }
}

function detachSharedMarkers(markers) {
  var loop = function ( i ) {
    var marker = markers[i], linked = [marker.primary.doc];
    linkedDocs(marker.primary.doc, function (d) { return linked.push(d); });
    for (var j = 0; j < marker.markers.length; j++) {
      var subMarker = marker.markers[j];
      if (indexOf(linked, subMarker.doc) == -1) {
        subMarker.parent = null;
        marker.markers.splice(j--, 1);
      }
    }
  };

  for (var i = 0; i < markers.length; i++) loop( i );
}

var nextDocId = 0;
var Doc = function(text, mode, firstLine, lineSep, direction) {
  if (!(this instanceof Doc)) { return new Doc(text, mode, firstLine, lineSep, direction) }
  if (firstLine == null) { firstLine = 0; }

  BranchChunk.call(this, [new LeafChunk([new Line("", null)])]);
  this.first = firstLine;
  this.scrollTop = this.scrollLeft = 0;
  this.cantEdit = false;
  this.cleanGeneration = 1;
  this.modeFrontier = this.highlightFrontier = firstLine;
  var start = Pos(firstLine, 0);
  this.sel = simpleSelection(start);
  this.history = new History(null);
  this.id = ++nextDocId;
  this.modeOption = mode;
  this.lineSep = lineSep;
  this.direction = (direction == "rtl") ? "rtl" : "ltr";
  this.extend = false;

  if (typeof text == "string") { text = this.splitLines(text); }
  updateDoc(this, {from: start, to: start, text: text});
  setSelection(this, simpleSelection(start), sel_dontScroll);
};

Doc.prototype = createObj(BranchChunk.prototype, {
  constructor: Doc,
  // Iterate over the document. Supports two forms -- with only one
  // argument, it calls that for each line in the document. With
  // three, it iterates over the range given by the first two (with
  // the second being non-inclusive).
  iter: function(from, to, op) {
    if (op) { this.iterN(from - this.first, to - from, op); }
    else { this.iterN(this.first, this.first + this.size, from); }
  },

  // Non-public interface for adding and removing lines.
  insert: function(at, lines) {
    var height = 0;
    for (var i = 0; i < lines.length; ++i) { height += lines[i].height; }
    this.insertInner(at - this.first, lines, height);
  },
  remove: function(at, n) { this.removeInner(at - this.first, n); },

  // From here, the methods are part of the public interface. Most
  // are also available from CodeMirror (editor) instances.

  getValue: function(lineSep) {
    var lines = getLines(this, this.first, this.first + this.size);
    if (lineSep === false) { return lines }
    return lines.join(lineSep || this.lineSeparator())
  },
  setValue: docMethodOp(function(code) {
    var top = Pos(this.first, 0), last = this.first + this.size - 1;
    makeChange(this, {from: top, to: Pos(last, getLine(this, last).text.length),
                      text: this.splitLines(code), origin: "setValue", full: true}, true);
    if (this.cm) { scrollToCoords(this.cm, 0, 0); }
    setSelection(this, simpleSelection(top), sel_dontScroll);
  }),
  replaceRange: function(code, from, to, origin) {
    from = clipPos(this, from);
    to = to ? clipPos(this, to) : from;
    replaceRange(this, code, from, to, origin);
  },
  getRange: function(from, to, lineSep) {
    var lines = getBetween(this, clipPos(this, from), clipPos(this, to));
    if (lineSep === false) { return lines }
    return lines.join(lineSep || this.lineSeparator())
  },

  getLine: function(line) {var l = this.getLineHandle(line); return l && l.text},

  getLineHandle: function(line) {if (isLine(this, line)) { return getLine(this, line) }},
  getLineNumber: function(line) {return lineNo(line)},

  getLineHandleVisualStart: function(line) {
    if (typeof line == "number") { line = getLine(this, line); }
    return visualLine(line)
  },

  lineCount: function() {return this.size},
  firstLine: function() {return this.first},
  lastLine: function() {return this.first + this.size - 1},

  clipPos: function(pos) {return clipPos(this, pos)},

  getCursor: function(start) {
    var range = this.sel.primary(), pos;
    if (start == null || start == "head") { pos = range.head; }
    else if (start == "anchor") { pos = range.anchor; }
    else if (start == "end" || start == "to" || start === false) { pos = range.to(); }
    else { pos = range.from(); }
    return pos
  },
  listSelections: function() { return this.sel.ranges },
  somethingSelected: function() {return this.sel.somethingSelected()},

  setCursor: docMethodOp(function(line, ch, options) {
    setSimpleSelection(this, clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line), null, options);
  }),
  setSelection: docMethodOp(function(anchor, head, options) {
    setSimpleSelection(this, clipPos(this, anchor), clipPos(this, head || anchor), options);
  }),
  extendSelection: docMethodOp(function(head, other, options) {
    extendSelection(this, clipPos(this, head), other && clipPos(this, other), options);
  }),
  extendSelections: docMethodOp(function(heads, options) {
    extendSelections(this, clipPosArray(this, heads), options);
  }),
  extendSelectionsBy: docMethodOp(function(f, options) {
    var heads = map(this.sel.ranges, f);
    extendSelections(this, clipPosArray(this, heads), options);
  }),
  setSelections: docMethodOp(function(ranges, primary, options) {
    var this$1 = this;

    if (!ranges.length) { return }
    var out = [];
    for (var i = 0; i < ranges.length; i++)
      { out[i] = new Range(clipPos(this$1, ranges[i].anchor),
                         clipPos(this$1, ranges[i].head)); }
    if (primary == null) { primary = Math.min(ranges.length - 1, this.sel.primIndex); }
    setSelection(this, normalizeSelection(out, primary), options);
  }),
  addSelection: docMethodOp(function(anchor, head, options) {
    var ranges = this.sel.ranges.slice(0);
    ranges.push(new Range(clipPos(this, anchor), clipPos(this, head || anchor)));
    setSelection(this, normalizeSelection(ranges, ranges.length - 1), options);
  }),

  getSelection: function(lineSep) {
    var this$1 = this;

    var ranges = this.sel.ranges, lines;
    for (var i = 0; i < ranges.length; i++) {
      var sel = getBetween(this$1, ranges[i].from(), ranges[i].to());
      lines = lines ? lines.concat(sel) : sel;
    }
    if (lineSep === false) { return lines }
    else { return lines.join(lineSep || this.lineSeparator()) }
  },
  getSelections: function(lineSep) {
    var this$1 = this;

    var parts = [], ranges = this.sel.ranges;
    for (var i = 0; i < ranges.length; i++) {
      var sel = getBetween(this$1, ranges[i].from(), ranges[i].to());
      if (lineSep !== false) { sel = sel.join(lineSep || this$1.lineSeparator()); }
      parts[i] = sel;
    }
    return parts
  },
  replaceSelection: function(code, collapse, origin) {
    var dup = [];
    for (var i = 0; i < this.sel.ranges.length; i++)
      { dup[i] = code; }
    this.replaceSelections(dup, collapse, origin || "+input");
  },
  replaceSelections: docMethodOp(function(code, collapse, origin) {
    var this$1 = this;

    var changes = [], sel = this.sel;
    for (var i = 0; i < sel.ranges.length; i++) {
      var range = sel.ranges[i];
      changes[i] = {from: range.from(), to: range.to(), text: this$1.splitLines(code[i]), origin: origin};
    }
    var newSel = collapse && collapse != "end" && computeReplacedSel(this, changes, collapse);
    for (var i$1 = changes.length - 1; i$1 >= 0; i$1--)
      { makeChange(this$1, changes[i$1]); }
    if (newSel) { setSelectionReplaceHistory(this, newSel); }
    else if (this.cm) { ensureCursorVisible(this.cm); }
  }),
  undo: docMethodOp(function() {makeChangeFromHistory(this, "undo");}),
  redo: docMethodOp(function() {makeChangeFromHistory(this, "redo");}),
  undoSelection: docMethodOp(function() {makeChangeFromHistory(this, "undo", true);}),
  redoSelection: docMethodOp(function() {makeChangeFromHistory(this, "redo", true);}),

  setExtending: function(val) {this.extend = val;},
  getExtending: function() {return this.extend},

  historySize: function() {
    var hist = this.history, done = 0, undone = 0;
    for (var i = 0; i < hist.done.length; i++) { if (!hist.done[i].ranges) { ++done; } }
    for (var i$1 = 0; i$1 < hist.undone.length; i$1++) { if (!hist.undone[i$1].ranges) { ++undone; } }
    return {undo: done, redo: undone}
  },
  clearHistory: function() {this.history = new History(this.history.maxGeneration);},

  markClean: function() {
    this.cleanGeneration = this.changeGeneration(true);
  },
  changeGeneration: function(forceSplit) {
    if (forceSplit)
      { this.history.lastOp = this.history.lastSelOp = this.history.lastOrigin = null; }
    return this.history.generation
  },
  isClean: function (gen) {
    return this.history.generation == (gen || this.cleanGeneration)
  },

  getHistory: function() {
    return {done: copyHistoryArray(this.history.done),
            undone: copyHistoryArray(this.history.undone)}
  },
  setHistory: function(histData) {
    var hist = this.history = new History(this.history.maxGeneration);
    hist.done = copyHistoryArray(histData.done.slice(0), null, true);
    hist.undone = copyHistoryArray(histData.undone.slice(0), null, true);
  },

  setGutterMarker: docMethodOp(function(line, gutterID, value) {
    return changeLine(this, line, "gutter", function (line) {
      var markers = line.gutterMarkers || (line.gutterMarkers = {});
      markers[gutterID] = value;
      if (!value && isEmpty(markers)) { line.gutterMarkers = null; }
      return true
    })
  }),

  clearGutter: docMethodOp(function(gutterID) {
    var this$1 = this;

    this.iter(function (line) {
      if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
        changeLine(this$1, line, "gutter", function () {
          line.gutterMarkers[gutterID] = null;
          if (isEmpty(line.gutterMarkers)) { line.gutterMarkers = null; }
          return true
        });
      }
    });
  }),

  lineInfo: function(line) {
    var n;
    if (typeof line == "number") {
      if (!isLine(this, line)) { return null }
      n = line;
      line = getLine(this, line);
      if (!line) { return null }
    } else {
      n = lineNo(line);
      if (n == null) { return null }
    }
    return {line: n, handle: line, text: line.text, gutterMarkers: line.gutterMarkers,
            textClass: line.textClass, bgClass: line.bgClass, wrapClass: line.wrapClass,
            widgets: line.widgets}
  },

  addLineClass: docMethodOp(function(handle, where, cls) {
    return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
      var prop = where == "text" ? "textClass"
               : where == "background" ? "bgClass"
               : where == "gutter" ? "gutterClass" : "wrapClass";
      if (!line[prop]) { line[prop] = cls; }
      else if (classTest(cls).test(line[prop])) { return false }
      else { line[prop] += " " + cls; }
      return true
    })
  }),
  removeLineClass: docMethodOp(function(handle, where, cls) {
    return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
      var prop = where == "text" ? "textClass"
               : where == "background" ? "bgClass"
               : where == "gutter" ? "gutterClass" : "wrapClass";
      var cur = line[prop];
      if (!cur) { return false }
      else if (cls == null) { line[prop] = null; }
      else {
        var found = cur.match(classTest(cls));
        if (!found) { return false }
        var end = found.index + found[0].length;
        line[prop] = cur.slice(0, found.index) + (!found.index || end == cur.length ? "" : " ") + cur.slice(end) || null;
      }
      return true
    })
  }),

  addLineWidget: docMethodOp(function(handle, node, options) {
    return addLineWidget(this, handle, node, options)
  }),
  removeLineWidget: function(widget) { widget.clear(); },

  markText: function(from, to, options) {
    return markText(this, clipPos(this, from), clipPos(this, to), options, options && options.type || "range")
  },
  setBookmark: function(pos, options) {
    var realOpts = {replacedWith: options && (options.nodeType == null ? options.widget : options),
                    insertLeft: options && options.insertLeft,
                    clearWhenEmpty: false, shared: options && options.shared,
                    handleMouseEvents: options && options.handleMouseEvents};
    pos = clipPos(this, pos);
    return markText(this, pos, pos, realOpts, "bookmark")
  },
  findMarksAt: function(pos) {
    pos = clipPos(this, pos);
    var markers = [], spans = getLine(this, pos.line).markedSpans;
    if (spans) { for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      if ((span.from == null || span.from <= pos.ch) &&
          (span.to == null || span.to >= pos.ch))
        { markers.push(span.marker.parent || span.marker); }
    } }
    return markers
  },
  findMarks: function(from, to, filter) {
    from = clipPos(this, from); to = clipPos(this, to);
    var found = [], lineNo = from.line;
    this.iter(from.line, to.line + 1, function (line) {
      var spans = line.markedSpans;
      if (spans) { for (var i = 0; i < spans.length; i++) {
        var span = spans[i];
        if (!(span.to != null && lineNo == from.line && from.ch >= span.to ||
              span.from == null && lineNo != from.line ||
              span.from != null && lineNo == to.line && span.from >= to.ch) &&
            (!filter || filter(span.marker)))
          { found.push(span.marker.parent || span.marker); }
      } }
      ++lineNo;
    });
    return found
  },
  getAllMarks: function() {
    var markers = [];
    this.iter(function (line) {
      var sps = line.markedSpans;
      if (sps) { for (var i = 0; i < sps.length; ++i)
        { if (sps[i].from != null) { markers.push(sps[i].marker); } } }
    });
    return markers
  },

  posFromIndex: function(off) {
    var ch, lineNo = this.first, sepSize = this.lineSeparator().length;
    this.iter(function (line) {
      var sz = line.text.length + sepSize;
      if (sz > off) { ch = off; return true }
      off -= sz;
      ++lineNo;
    });
    return clipPos(this, Pos(lineNo, ch))
  },
  indexFromPos: function (coords) {
    coords = clipPos(this, coords);
    var index = coords.ch;
    if (coords.line < this.first || coords.ch < 0) { return 0 }
    var sepSize = this.lineSeparator().length;
    this.iter(this.first, coords.line, function (line) { // iter aborts when callback returns a truthy value
      index += line.text.length + sepSize;
    });
    return index
  },

  copy: function(copyHistory) {
    var doc = new Doc(getLines(this, this.first, this.first + this.size),
                      this.modeOption, this.first, this.lineSep, this.direction);
    doc.scrollTop = this.scrollTop; doc.scrollLeft = this.scrollLeft;
    doc.sel = this.sel;
    doc.extend = false;
    if (copyHistory) {
      doc.history.undoDepth = this.history.undoDepth;
      doc.setHistory(this.getHistory());
    }
    return doc
  },

  linkedDoc: function(options) {
    if (!options) { options = {}; }
    var from = this.first, to = this.first + this.size;
    if (options.from != null && options.from > from) { from = options.from; }
    if (options.to != null && options.to < to) { to = options.to; }
    var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from, this.lineSep, this.direction);
    if (options.sharedHist) { copy.history = this.history
    ; }(this.linked || (this.linked = [])).push({doc: copy, sharedHist: options.sharedHist});
    copy.linked = [{doc: this, isParent: true, sharedHist: options.sharedHist}];
    copySharedMarkers(copy, findSharedMarkers(this));
    return copy
  },
  unlinkDoc: function(other) {
    var this$1 = this;

    if (other instanceof CodeMirror) { other = other.doc; }
    if (this.linked) { for (var i = 0; i < this.linked.length; ++i) {
      var link = this$1.linked[i];
      if (link.doc != other) { continue }
      this$1.linked.splice(i, 1);
      other.unlinkDoc(this$1);
      detachSharedMarkers(findSharedMarkers(this$1));
      break
    } }
    // If the histories were shared, split them again
    if (other.history == this.history) {
      var splitIds = [other.id];
      linkedDocs(other, function (doc) { return splitIds.push(doc.id); }, true);
      other.history = new History(null);
      other.history.done = copyHistoryArray(this.history.done, splitIds);
      other.history.undone = copyHistoryArray(this.history.undone, splitIds);
    }
  },
  iterLinkedDocs: function(f) {linkedDocs(this, f);},

  getMode: function() {return this.mode},
  getEditor: function() {return this.cm},

  splitLines: function(str) {
    if (this.lineSep) { return str.split(this.lineSep) }
    return splitLinesAuto(str)
  },
  lineSeparator: function() { return this.lineSep || "\n" },

  setDirection: docMethodOp(function (dir) {
    if (dir != "rtl") { dir = "ltr"; }
    if (dir == this.direction) { return }
    this.direction = dir;
    this.iter(function (line) { return line.order = null; });
    if (this.cm) { directionChanged(this.cm); }
  })
});

// Public alias.
Doc.prototype.eachLine = Doc.prototype.iter;

// Kludge to work around strange IE behavior where it'll sometimes
// re-fire a series of drag-related events right after the drop (#1551)
var lastDrop = 0;

function onDrop(e) {
  var cm = this;
  clearDragCursor(cm);
  if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e))
    { return }
  e_preventDefault(e);
  if (ie) { lastDrop = +new Date; }
  var pos = posFromMouse(cm, e, true), files = e.dataTransfer.files;
  if (!pos || cm.isReadOnly()) { return }
  // Might be a file drop, in which case we simply extract the text
  // and insert it.
  if (files && files.length && window.FileReader && window.File) {
    var n = files.length, text = Array(n), read = 0;
    var loadFile = function (file, i) {
      if (cm.options.allowDropFileTypes &&
          indexOf(cm.options.allowDropFileTypes, file.type) == -1)
        { return }

      var reader = new FileReader;
      reader.onload = operation(cm, function () {
        var content = reader.result;
        if (/[\x00-\x08\x0e-\x1f]{2}/.test(content)) { content = ""; }
        text[i] = content;
        if (++read == n) {
          pos = clipPos(cm.doc, pos);
          var change = {from: pos, to: pos,
                        text: cm.doc.splitLines(text.join(cm.doc.lineSeparator())),
                        origin: "paste"};
          makeChange(cm.doc, change);
          setSelectionReplaceHistory(cm.doc, simpleSelection(pos, changeEnd(change)));
        }
      });
      reader.readAsText(file);
    };
    for (var i = 0; i < n; ++i) { loadFile(files[i], i); }
  } else { // Normal drop
    // Don't do a replace if the drop happened inside of the selected text.
    if (cm.state.draggingText && cm.doc.sel.contains(pos) > -1) {
      cm.state.draggingText(e);
      // Ensure the editor is re-focused
      setTimeout(function () { return cm.display.input.focus(); }, 20);
      return
    }
    try {
      var text$1 = e.dataTransfer.getData("Text");
      if (text$1) {
        var selected;
        if (cm.state.draggingText && !cm.state.draggingText.copy)
          { selected = cm.listSelections(); }
        setSelectionNoUndo(cm.doc, simpleSelection(pos, pos));
        if (selected) { for (var i$1 = 0; i$1 < selected.length; ++i$1)
          { replaceRange(cm.doc, "", selected[i$1].anchor, selected[i$1].head, "drag"); } }
        cm.replaceSelection(text$1, "around", "paste");
        cm.display.input.focus();
      }
    }
    catch(e){}
  }
}

function onDragStart(cm, e) {
  if (ie && (!cm.state.draggingText || +new Date - lastDrop < 100)) { e_stop(e); return }
  if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) { return }

  e.dataTransfer.setData("Text", cm.getSelection());
  e.dataTransfer.effectAllowed = "copyMove";

  // Use dummy image instead of default browsers image.
  // Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.
  if (e.dataTransfer.setDragImage && !safari) {
    var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    if (presto) {
      img.width = img.height = 1;
      cm.display.wrapper.appendChild(img);
      // Force a relayout, or Opera won't use our image for some obscure reason
      img._top = img.offsetTop;
    }
    e.dataTransfer.setDragImage(img, 0, 0);
    if (presto) { img.parentNode.removeChild(img); }
  }
}

function onDragOver(cm, e) {
  var pos = posFromMouse(cm, e);
  if (!pos) { return }
  var frag = document.createDocumentFragment();
  drawSelectionCursor(cm, pos, frag);
  if (!cm.display.dragCursor) {
    cm.display.dragCursor = elt("div", null, "CodeMirror-cursors CodeMirror-dragcursors");
    cm.display.lineSpace.insertBefore(cm.display.dragCursor, cm.display.cursorDiv);
  }
  removeChildrenAndAdd(cm.display.dragCursor, frag);
}

function clearDragCursor(cm) {
  if (cm.display.dragCursor) {
    cm.display.lineSpace.removeChild(cm.display.dragCursor);
    cm.display.dragCursor = null;
  }
}

// These must be handled carefully, because naively registering a
// handler for each editor will cause the editors to never be
// garbage collected.

function forEachCodeMirror(f) {
  if (!document.getElementsByClassName) { return }
  var byClass = document.getElementsByClassName("CodeMirror");
  for (var i = 0; i < byClass.length; i++) {
    var cm = byClass[i].CodeMirror;
    if (cm) { f(cm); }
  }
}

var globalsRegistered = false;
function ensureGlobalHandlers() {
  if (globalsRegistered) { return }
  registerGlobalHandlers();
  globalsRegistered = true;
}
function registerGlobalHandlers() {
  // When the window resizes, we need to refresh active editors.
  var resizeTimer;
  on(window, "resize", function () {
    if (resizeTimer == null) { resizeTimer = setTimeout(function () {
      resizeTimer = null;
      forEachCodeMirror(onResize);
    }, 100); }
  });
  // When the window loses focus, we want to show the editor as blurred
  on(window, "blur", function () { return forEachCodeMirror(onBlur); });
}
// Called when the window resizes
function onResize(cm) {
  var d = cm.display;
  if (d.lastWrapHeight == d.wrapper.clientHeight && d.lastWrapWidth == d.wrapper.clientWidth)
    { return }
  // Might be a text scaling operation, clear size caches.
  d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;
  d.scrollbarsClipped = false;
  cm.setSize();
}

var keyNames = {
  3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
  19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
  36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
  46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
  106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete",
  173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
  221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
  63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
};

// Number keys
for (var i = 0; i < 10; i++) { keyNames[i + 48] = keyNames[i + 96] = String(i); }
// Alphabetic keys
for (var i$1 = 65; i$1 <= 90; i$1++) { keyNames[i$1] = String.fromCharCode(i$1); }
// Function keys
for (var i$2 = 1; i$2 <= 12; i$2++) { keyNames[i$2 + 111] = keyNames[i$2 + 63235] = "F" + i$2; }

var keyMap = {};

keyMap.basic = {
  "Left": "goCharLeft", "Right": "goCharRight", "Up": "goLineUp", "Down": "goLineDown",
  "End": "goLineEnd", "Home": "goLineStartSmart", "PageUp": "goPageUp", "PageDown": "goPageDown",
  "Delete": "delCharAfter", "Backspace": "delCharBefore", "Shift-Backspace": "delCharBefore",
  "Tab": "defaultTab", "Shift-Tab": "indentAuto",
  "Enter": "newlineAndIndent", "Insert": "toggleOverwrite",
  "Esc": "singleSelection"
};
// Note that the save and find-related commands aren't defined by
// default. User code or addons can define them. Unknown commands
// are simply ignored.
keyMap.pcDefault = {
  "Ctrl-A": "selectAll", "Ctrl-D": "deleteLine", "Ctrl-Z": "undo", "Shift-Ctrl-Z": "redo", "Ctrl-Y": "redo",
  "Ctrl-Home": "goDocStart", "Ctrl-End": "goDocEnd", "Ctrl-Up": "goLineUp", "Ctrl-Down": "goLineDown",
  "Ctrl-Left": "goGroupLeft", "Ctrl-Right": "goGroupRight", "Alt-Left": "goLineStart", "Alt-Right": "goLineEnd",
  "Ctrl-Backspace": "delGroupBefore", "Ctrl-Delete": "delGroupAfter", "Ctrl-S": "save", "Ctrl-F": "find",
  "Ctrl-G": "findNext", "Shift-Ctrl-G": "findPrev", "Shift-Ctrl-F": "replace", "Shift-Ctrl-R": "replaceAll",
  "Ctrl-[": "indentLess", "Ctrl-]": "indentMore",
  "Ctrl-U": "undoSelection", "Shift-Ctrl-U": "redoSelection", "Alt-U": "redoSelection",
  fallthrough: "basic"
};
// Very basic readline/emacs-style bindings, which are standard on Mac.
keyMap.emacsy = {
  "Ctrl-F": "goCharRight", "Ctrl-B": "goCharLeft", "Ctrl-P": "goLineUp", "Ctrl-N": "goLineDown",
  "Alt-F": "goWordRight", "Alt-B": "goWordLeft", "Ctrl-A": "goLineStart", "Ctrl-E": "goLineEnd",
  "Ctrl-V": "goPageDown", "Shift-Ctrl-V": "goPageUp", "Ctrl-D": "delCharAfter", "Ctrl-H": "delCharBefore",
  "Alt-D": "delWordAfter", "Alt-Backspace": "delWordBefore", "Ctrl-K": "killLine", "Ctrl-T": "transposeChars",
  "Ctrl-O": "openLine"
};
keyMap.macDefault = {
  "Cmd-A": "selectAll", "Cmd-D": "deleteLine", "Cmd-Z": "undo", "Shift-Cmd-Z": "redo", "Cmd-Y": "redo",
  "Cmd-Home": "goDocStart", "Cmd-Up": "goDocStart", "Cmd-End": "goDocEnd", "Cmd-Down": "goDocEnd", "Alt-Left": "goGroupLeft",
  "Alt-Right": "goGroupRight", "Cmd-Left": "goLineLeft", "Cmd-Right": "goLineRight", "Alt-Backspace": "delGroupBefore",
  "Ctrl-Alt-Backspace": "delGroupAfter", "Alt-Delete": "delGroupAfter", "Cmd-S": "save", "Cmd-F": "find",
  "Cmd-G": "findNext", "Shift-Cmd-G": "findPrev", "Cmd-Alt-F": "replace", "Shift-Cmd-Alt-F": "replaceAll",
  "Cmd-[": "indentLess", "Cmd-]": "indentMore", "Cmd-Backspace": "delWrappedLineLeft", "Cmd-Delete": "delWrappedLineRight",
  "Cmd-U": "undoSelection", "Shift-Cmd-U": "redoSelection", "Ctrl-Up": "goDocStart", "Ctrl-Down": "goDocEnd",
  fallthrough: ["basic", "emacsy"]
};
keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;

// KEYMAP DISPATCH

function normalizeKeyName(name) {
  var parts = name.split(/-(?!$)/);
  name = parts[parts.length - 1];
  var alt, ctrl, shift, cmd;
  for (var i = 0; i < parts.length - 1; i++) {
    var mod = parts[i];
    if (/^(cmd|meta|m)$/i.test(mod)) { cmd = true; }
    else if (/^a(lt)?$/i.test(mod)) { alt = true; }
    else if (/^(c|ctrl|control)$/i.test(mod)) { ctrl = true; }
    else if (/^s(hift)?$/i.test(mod)) { shift = true; }
    else { throw new Error("Unrecognized modifier name: " + mod) }
  }
  if (alt) { name = "Alt-" + name; }
  if (ctrl) { name = "Ctrl-" + name; }
  if (cmd) { name = "Cmd-" + name; }
  if (shift) { name = "Shift-" + name; }
  return name
}

// This is a kludge to keep keymaps mostly working as raw objects
// (backwards compatibility) while at the same time support features
// like normalization and multi-stroke key bindings. It compiles a
// new normalized keymap, and then updates the old object to reflect
// this.
function normalizeKeyMap(keymap) {
  var copy = {};
  for (var keyname in keymap) { if (keymap.hasOwnProperty(keyname)) {
    var value = keymap[keyname];
    if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) { continue }
    if (value == "...") { delete keymap[keyname]; continue }

    var keys = map(keyname.split(" "), normalizeKeyName);
    for (var i = 0; i < keys.length; i++) {
      var val = (void 0), name = (void 0);
      if (i == keys.length - 1) {
        name = keys.join(" ");
        val = value;
      } else {
        name = keys.slice(0, i + 1).join(" ");
        val = "...";
      }
      var prev = copy[name];
      if (!prev) { copy[name] = val; }
      else if (prev != val) { throw new Error("Inconsistent bindings for " + name) }
    }
    delete keymap[keyname];
  } }
  for (var prop in copy) { keymap[prop] = copy[prop]; }
  return keymap
}

function lookupKey(key, map, handle, context) {
  map = getKeyMap(map);
  var found = map.call ? map.call(key, context) : map[key];
  if (found === false) { return "nothing" }
  if (found === "...") { return "multi" }
  if (found != null && handle(found)) { return "handled" }

  if (map.fallthrough) {
    if (Object.prototype.toString.call(map.fallthrough) != "[object Array]")
      { return lookupKey(key, map.fallthrough, handle, context) }
    for (var i = 0; i < map.fallthrough.length; i++) {
      var result = lookupKey(key, map.fallthrough[i], handle, context);
      if (result) { return result }
    }
  }
}

// Modifier key presses don't count as 'real' key presses for the
// purpose of keymap fallthrough.
function isModifierKey(value) {
  var name = typeof value == "string" ? value : keyNames[value.keyCode];
  return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
}

function addModifierNames(name, event, noShift) {
  var base = name;
  if (event.altKey && base != "Alt") { name = "Alt-" + name; }
  if ((flipCtrlCmd ? event.metaKey : event.ctrlKey) && base != "Ctrl") { name = "Ctrl-" + name; }
  if ((flipCtrlCmd ? event.ctrlKey : event.metaKey) && base != "Cmd") { name = "Cmd-" + name; }
  if (!noShift && event.shiftKey && base != "Shift") { name = "Shift-" + name; }
  return name
}

// Look up the name of a key as indicated by an event object.
function keyName(event, noShift) {
  if (presto && event.keyCode == 34 && event["char"]) { return false }
  var name = keyNames[event.keyCode];
  if (name == null || event.altGraphKey) { return false }
  return addModifierNames(name, event, noShift)
}

function getKeyMap(val) {
  return typeof val == "string" ? keyMap[val] : val
}

// Helper for deleting text near the selection(s), used to implement
// backspace, delete, and similar functionality.
function deleteNearSelection(cm, compute) {
  var ranges = cm.doc.sel.ranges, kill = [];
  // Build up a set of ranges to kill first, merging overlapping
  // ranges.
  for (var i = 0; i < ranges.length; i++) {
    var toKill = compute(ranges[i]);
    while (kill.length && cmp(toKill.from, lst(kill).to) <= 0) {
      var replaced = kill.pop();
      if (cmp(replaced.from, toKill.from) < 0) {
        toKill.from = replaced.from;
        break
      }
    }
    kill.push(toKill);
  }
  // Next, remove those actual ranges.
  runInOp(cm, function () {
    for (var i = kill.length - 1; i >= 0; i--)
      { replaceRange(cm.doc, "", kill[i].from, kill[i].to, "+delete"); }
    ensureCursorVisible(cm);
  });
}

// Commands are parameter-less actions that can be performed on an
// editor, mostly used for keybindings.
var commands = {
  selectAll: selectAll,
  singleSelection: function (cm) { return cm.setSelection(cm.getCursor("anchor"), cm.getCursor("head"), sel_dontScroll); },
  killLine: function (cm) { return deleteNearSelection(cm, function (range) {
    if (range.empty()) {
      var len = getLine(cm.doc, range.head.line).text.length;
      if (range.head.ch == len && range.head.line < cm.lastLine())
        { return {from: range.head, to: Pos(range.head.line + 1, 0)} }
      else
        { return {from: range.head, to: Pos(range.head.line, len)} }
    } else {
      return {from: range.from(), to: range.to()}
    }
  }); },
  deleteLine: function (cm) { return deleteNearSelection(cm, function (range) { return ({
    from: Pos(range.from().line, 0),
    to: clipPos(cm.doc, Pos(range.to().line + 1, 0))
  }); }); },
  delLineLeft: function (cm) { return deleteNearSelection(cm, function (range) { return ({
    from: Pos(range.from().line, 0), to: range.from()
  }); }); },
  delWrappedLineLeft: function (cm) { return deleteNearSelection(cm, function (range) {
    var top = cm.charCoords(range.head, "div").top + 5;
    var leftPos = cm.coordsChar({left: 0, top: top}, "div");
    return {from: leftPos, to: range.from()}
  }); },
  delWrappedLineRight: function (cm) { return deleteNearSelection(cm, function (range) {
    var top = cm.charCoords(range.head, "div").top + 5;
    var rightPos = cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div");
    return {from: range.from(), to: rightPos }
  }); },
  undo: function (cm) { return cm.undo(); },
  redo: function (cm) { return cm.redo(); },
  undoSelection: function (cm) { return cm.undoSelection(); },
  redoSelection: function (cm) { return cm.redoSelection(); },
  goDocStart: function (cm) { return cm.extendSelection(Pos(cm.firstLine(), 0)); },
  goDocEnd: function (cm) { return cm.extendSelection(Pos(cm.lastLine())); },
  goLineStart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStart(cm, range.head.line); },
    {origin: "+move", bias: 1}
  ); },
  goLineStartSmart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStartSmart(cm, range.head); },
    {origin: "+move", bias: 1}
  ); },
  goLineEnd: function (cm) { return cm.extendSelectionsBy(function (range) { return lineEnd(cm, range.head.line); },
    {origin: "+move", bias: -1}
  ); },
  goLineRight: function (cm) { return cm.extendSelectionsBy(function (range) {
    var top = cm.cursorCoords(range.head, "div").top + 5;
    return cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div")
  }, sel_move); },
  goLineLeft: function (cm) { return cm.extendSelectionsBy(function (range) {
    var top = cm.cursorCoords(range.head, "div").top + 5;
    return cm.coordsChar({left: 0, top: top}, "div")
  }, sel_move); },
  goLineLeftSmart: function (cm) { return cm.extendSelectionsBy(function (range) {
    var top = cm.cursorCoords(range.head, "div").top + 5;
    var pos = cm.coordsChar({left: 0, top: top}, "div");
    if (pos.ch < cm.getLine(pos.line).search(/\S/)) { return lineStartSmart(cm, range.head) }
    return pos
  }, sel_move); },
  goLineUp: function (cm) { return cm.moveV(-1, "line"); },
  goLineDown: function (cm) { return cm.moveV(1, "line"); },
  goPageUp: function (cm) { return cm.moveV(-1, "page"); },
  goPageDown: function (cm) { return cm.moveV(1, "page"); },
  goCharLeft: function (cm) { return cm.moveH(-1, "char"); },
  goCharRight: function (cm) { return cm.moveH(1, "char"); },
  goColumnLeft: function (cm) { return cm.moveH(-1, "column"); },
  goColumnRight: function (cm) { return cm.moveH(1, "column"); },
  goWordLeft: function (cm) { return cm.moveH(-1, "word"); },
  goGroupRight: function (cm) { return cm.moveH(1, "group"); },
  goGroupLeft: function (cm) { return cm.moveH(-1, "group"); },
  goWordRight: function (cm) { return cm.moveH(1, "word"); },
  delCharBefore: function (cm) { return cm.deleteH(-1, "char"); },
  delCharAfter: function (cm) { return cm.deleteH(1, "char"); },
  delWordBefore: function (cm) { return cm.deleteH(-1, "word"); },
  delWordAfter: function (cm) { return cm.deleteH(1, "word"); },
  delGroupBefore: function (cm) { return cm.deleteH(-1, "group"); },
  delGroupAfter: function (cm) { return cm.deleteH(1, "group"); },
  indentAuto: function (cm) { return cm.indentSelection("smart"); },
  indentMore: function (cm) { return cm.indentSelection("add"); },
  indentLess: function (cm) { return cm.indentSelection("subtract"); },
  insertTab: function (cm) { return cm.replaceSelection("\t"); },
  insertSoftTab: function (cm) {
    var spaces = [], ranges = cm.listSelections(), tabSize = cm.options.tabSize;
    for (var i = 0; i < ranges.length; i++) {
      var pos = ranges[i].from();
      var col = countColumn(cm.getLine(pos.line), pos.ch, tabSize);
      spaces.push(spaceStr(tabSize - col % tabSize));
    }
    cm.replaceSelections(spaces);
  },
  defaultTab: function (cm) {
    if (cm.somethingSelected()) { cm.indentSelection("add"); }
    else { cm.execCommand("insertTab"); }
  },
  // Swap the two chars left and right of each selection's head.
  // Move cursor behind the two swapped characters afterwards.
  //
  // Doesn't consider line feeds a character.
  // Doesn't scan more than one line above to find a character.
  // Doesn't do anything on an empty line.
  // Doesn't do anything with non-empty selections.
  transposeChars: function (cm) { return runInOp(cm, function () {
    var ranges = cm.listSelections(), newSel = [];
    for (var i = 0; i < ranges.length; i++) {
      if (!ranges[i].empty()) { continue }
      var cur = ranges[i].head, line = getLine(cm.doc, cur.line).text;
      if (line) {
        if (cur.ch == line.length) { cur = new Pos(cur.line, cur.ch - 1); }
        if (cur.ch > 0) {
          cur = new Pos(cur.line, cur.ch + 1);
          cm.replaceRange(line.charAt(cur.ch - 1) + line.charAt(cur.ch - 2),
                          Pos(cur.line, cur.ch - 2), cur, "+transpose");
        } else if (cur.line > cm.doc.first) {
          var prev = getLine(cm.doc, cur.line - 1).text;
          if (prev) {
            cur = new Pos(cur.line, 1);
            cm.replaceRange(line.charAt(0) + cm.doc.lineSeparator() +
                            prev.charAt(prev.length - 1),
                            Pos(cur.line - 1, prev.length - 1), cur, "+transpose");
          }
        }
      }
      newSel.push(new Range(cur, cur));
    }
    cm.setSelections(newSel);
  }); },
  newlineAndIndent: function (cm) { return runInOp(cm, function () {
    var sels = cm.listSelections();
    for (var i = sels.length - 1; i >= 0; i--)
      { cm.replaceRange(cm.doc.lineSeparator(), sels[i].anchor, sels[i].head, "+input"); }
    sels = cm.listSelections();
    for (var i$1 = 0; i$1 < sels.length; i$1++)
      { cm.indentLine(sels[i$1].from().line, null, true); }
    ensureCursorVisible(cm);
  }); },
  openLine: function (cm) { return cm.replaceSelection("\n", "start"); },
  toggleOverwrite: function (cm) { return cm.toggleOverwrite(); }
};


function lineStart(cm, lineN) {
  var line = getLine(cm.doc, lineN);
  var visual = visualLine(line);
  if (visual != line) { lineN = lineNo(visual); }
  return endOfLine(true, cm, visual, lineN, 1)
}
function lineEnd(cm, lineN) {
  var line = getLine(cm.doc, lineN);
  var visual = visualLineEnd(line);
  if (visual != line) { lineN = lineNo(visual); }
  return endOfLine(true, cm, line, lineN, -1)
}
function lineStartSmart(cm, pos) {
  var start = lineStart(cm, pos.line);
  var line = getLine(cm.doc, start.line);
  var order = getOrder(line, cm.doc.direction);
  if (!order || order[0].level == 0) {
    var firstNonWS = Math.max(0, line.text.search(/\S/));
    var inWS = pos.line == start.line && pos.ch <= firstNonWS && pos.ch;
    return Pos(start.line, inWS ? 0 : firstNonWS, start.sticky)
  }
  return start
}

// Run a handler that was bound to a key.
function doHandleBinding(cm, bound, dropShift) {
  if (typeof bound == "string") {
    bound = commands[bound];
    if (!bound) { return false }
  }
  // Ensure previous input has been read, so that the handler sees a
  // consistent view of the document
  cm.display.input.ensurePolled();
  var prevShift = cm.display.shift, done = false;
  try {
    if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
    if (dropShift) { cm.display.shift = false; }
    done = bound(cm) != Pass;
  } finally {
    cm.display.shift = prevShift;
    cm.state.suppressEdits = false;
  }
  return done
}

function lookupKeyForEditor(cm, name, handle) {
  for (var i = 0; i < cm.state.keyMaps.length; i++) {
    var result = lookupKey(name, cm.state.keyMaps[i], handle, cm);
    if (result) { return result }
  }
  return (cm.options.extraKeys && lookupKey(name, cm.options.extraKeys, handle, cm))
    || lookupKey(name, cm.options.keyMap, handle, cm)
}

// Note that, despite the name, this function is also used to check
// for bound mouse clicks.

var stopSeq = new Delayed;
function dispatchKey(cm, name, e, handle) {
  var seq = cm.state.keySeq;
  if (seq) {
    if (isModifierKey(name)) { return "handled" }
    stopSeq.set(50, function () {
      if (cm.state.keySeq == seq) {
        cm.state.keySeq = null;
        cm.display.input.reset();
      }
    });
    name = seq + " " + name;
  }
  var result = lookupKeyForEditor(cm, name, handle);

  if (result == "multi")
    { cm.state.keySeq = name; }
  if (result == "handled")
    { signalLater(cm, "keyHandled", cm, name, e); }

  if (result == "handled" || result == "multi") {
    e_preventDefault(e);
    restartBlink(cm);
  }

  if (seq && !result && /\'$/.test(name)) {
    e_preventDefault(e);
    return true
  }
  return !!result
}

// Handle a key from the keydown event.
function handleKeyBinding(cm, e) {
  var name = keyName(e, true);
  if (!name) { return false }

  if (e.shiftKey && !cm.state.keySeq) {
    // First try to resolve full name (including 'Shift-'). Failing
    // that, see if there is a cursor-motion command (starting with
    // 'go') bound to the keyname without 'Shift-'.
    return dispatchKey(cm, "Shift-" + name, e, function (b) { return doHandleBinding(cm, b, true); })
        || dispatchKey(cm, name, e, function (b) {
             if (typeof b == "string" ? /^go[A-Z]/.test(b) : b.motion)
               { return doHandleBinding(cm, b) }
           })
  } else {
    return dispatchKey(cm, name, e, function (b) { return doHandleBinding(cm, b); })
  }
}

// Handle a key from the keypress event
function handleCharBinding(cm, e, ch) {
  return dispatchKey(cm, "'" + ch + "'", e, function (b) { return doHandleBinding(cm, b, true); })
}

var lastStoppedKey = null;
function onKeyDown(e) {
  var cm = this;
  cm.curOp.focus = activeElt();
  if (signalDOMEvent(cm, e)) { return }
  // IE does strange things with escape.
  if (ie && ie_version < 11 && e.keyCode == 27) { e.returnValue = false; }
  var code = e.keyCode;
  cm.display.shift = code == 16 || e.shiftKey;
  var handled = handleKeyBinding(cm, e);
  if (presto) {
    lastStoppedKey = handled ? code : null;
    // Opera has no cut event... we try to at least catch the key combo
    if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey))
      { cm.replaceSelection("", null, "cut"); }
  }

  // Turn mouse into crosshair when Alt is held on Mac.
  if (code == 18 && !/\bCodeMirror-crosshair\b/.test(cm.display.lineDiv.className))
    { showCrossHair(cm); }
}

function showCrossHair(cm) {
  var lineDiv = cm.display.lineDiv;
  addClass(lineDiv, "CodeMirror-crosshair");

  function up(e) {
    if (e.keyCode == 18 || !e.altKey) {
      rmClass(lineDiv, "CodeMirror-crosshair");
      off(document, "keyup", up);
      off(document, "mouseover", up);
    }
  }
  on(document, "keyup", up);
  on(document, "mouseover", up);
}

function onKeyUp(e) {
  if (e.keyCode == 16) { this.doc.sel.shift = false; }
  signalDOMEvent(this, e);
}

function onKeyPress(e) {
  var cm = this;
  if (eventInWidget(cm.display, e) || signalDOMEvent(cm, e) || e.ctrlKey && !e.altKey || mac && e.metaKey) { return }
  var keyCode = e.keyCode, charCode = e.charCode;
  if (presto && keyCode == lastStoppedKey) {lastStoppedKey = null; e_preventDefault(e); return}
  if ((presto && (!e.which || e.which < 10)) && handleKeyBinding(cm, e)) { return }
  var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
  // Some browsers fire keypress events for backspace
  if (ch == "\x08") { return }
  if (handleCharBinding(cm, e, ch)) { return }
  cm.display.input.onKeyPress(e);
}

var DOUBLECLICK_DELAY = 400;

var PastClick = function(time, pos, button) {
  this.time = time;
  this.pos = pos;
  this.button = button;
};

PastClick.prototype.compare = function (time, pos, button) {
  return this.time + DOUBLECLICK_DELAY > time &&
    cmp(pos, this.pos) == 0 && button == this.button
};

var lastClick;
var lastDoubleClick;
function clickRepeat(pos, button) {
  var now = +new Date;
  if (lastDoubleClick && lastDoubleClick.compare(now, pos, button)) {
    lastClick = lastDoubleClick = null;
    return "triple"
  } else if (lastClick && lastClick.compare(now, pos, button)) {
    lastDoubleClick = new PastClick(now, pos, button);
    lastClick = null;
    return "double"
  } else {
    lastClick = new PastClick(now, pos, button);
    lastDoubleClick = null;
    return "single"
  }
}

// A mouse down can be a single click, double click, triple click,
// start of selection drag, start of text drag, new cursor
// (ctrl-click), rectangle drag (alt-drag), or xwin
// middle-click-paste. Or it might be a click on something we should
// not interfere with, such as a scrollbar or widget.
function onMouseDown(e) {
  var cm = this, display = cm.display;
  if (signalDOMEvent(cm, e) || display.activeTouch && display.input.supportsTouch()) { return }
  display.input.ensurePolled();
  display.shift = e.shiftKey;

  if (eventInWidget(display, e)) {
    if (!webkit) {
      // Briefly turn off draggability, to allow widgets to do
      // normal dragging things.
      display.scroller.draggable = false;
      setTimeout(function () { return display.scroller.draggable = true; }, 100);
    }
    return
  }
  if (clickInGutter(cm, e)) { return }
  var pos = posFromMouse(cm, e), button = e_button(e), repeat = pos ? clickRepeat(pos, button) : "single";
  window.focus();

  // #3261: make sure, that we're not starting a second selection
  if (button == 1 && cm.state.selectingText)
    { cm.state.selectingText(e); }

  if (pos && handleMappedButton(cm, button, pos, repeat, e)) { return }

  if (button == 1) {
    if (pos) { leftButtonDown(cm, pos, repeat, e); }
    else if (e_target(e) == display.scroller) { e_preventDefault(e); }
  } else if (button == 2) {
    if (pos) { extendSelection(cm.doc, pos); }
    setTimeout(function () { return display.input.focus(); }, 20);
  } else if (button == 3) {
    if (captureRightClick) { onContextMenu(cm, e); }
    else { delayBlurEvent(cm); }
  }
}

function handleMappedButton(cm, button, pos, repeat, event) {
  var name = "Click";
  if (repeat == "double") { name = "Double" + name; }
  else if (repeat == "triple") { name = "Triple" + name; }
  name = (button == 1 ? "Left" : button == 2 ? "Middle" : "Right") + name;

  return dispatchKey(cm,  addModifierNames(name, event), event, function (bound) {
    if (typeof bound == "string") { bound = commands[bound]; }
    if (!bound) { return false }
    var done = false;
    try {
      if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
      done = bound(cm, pos) != Pass;
    } finally {
      cm.state.suppressEdits = false;
    }
    return done
  })
}

function configureMouse(cm, repeat, event) {
  var option = cm.getOption("configureMouse");
  var value = option ? option(cm, repeat, event) : {};
  if (value.unit == null) {
    var rect = chromeOS ? event.shiftKey && event.metaKey : event.altKey;
    value.unit = rect ? "rectangle" : repeat == "single" ? "char" : repeat == "double" ? "word" : "line";
  }
  if (value.extend == null || cm.doc.extend) { value.extend = cm.doc.extend || event.shiftKey; }
  if (value.addNew == null) { value.addNew = mac ? event.metaKey : event.ctrlKey; }
  if (value.moveOnDrag == null) { value.moveOnDrag = !(mac ? event.altKey : event.ctrlKey); }
  return value
}

function leftButtonDown(cm, pos, repeat, event) {
  if (ie) { setTimeout(bind(ensureFocus, cm), 0); }
  else { cm.curOp.focus = activeElt(); }

  var behavior = configureMouse(cm, repeat, event);

  var sel = cm.doc.sel, contained;
  if (cm.options.dragDrop && dragAndDrop && !cm.isReadOnly() &&
      repeat == "single" && (contained = sel.contains(pos)) > -1 &&
      (cmp((contained = sel.ranges[contained]).from(), pos) < 0 || pos.xRel > 0) &&
      (cmp(contained.to(), pos) > 0 || pos.xRel < 0))
    { leftButtonStartDrag(cm, event, pos, behavior); }
  else
    { leftButtonSelect(cm, event, pos, behavior); }
}

// Start a text drag. When it ends, see if any dragging actually
// happen, and treat as a click if it didn't.
function leftButtonStartDrag(cm, event, pos, behavior) {
  var display = cm.display, moved = false;
  var dragEnd = operation(cm, function (e) {
    if (webkit) { display.scroller.draggable = false; }
    cm.state.draggingText = false;
    off(document, "mouseup", dragEnd);
    off(document, "mousemove", mouseMove);
    off(display.scroller, "dragstart", dragStart);
    off(display.scroller, "drop", dragEnd);
    if (!moved) {
      e_preventDefault(e);
      if (!behavior.addNew)
        { extendSelection(cm.doc, pos, null, null, behavior.extend); }
      // Work around unexplainable focus problem in IE9 (#2127) and Chrome (#3081)
      if (webkit || ie && ie_version == 9)
        { setTimeout(function () {document.body.focus(); display.input.focus();}, 20); }
      else
        { display.input.focus(); }
    }
  });
  var mouseMove = function(e2) {
    moved = moved || Math.abs(event.clientX - e2.clientX) + Math.abs(event.clientY - e2.clientY) >= 10;
  };
  var dragStart = function () { return moved = true; };
  // Let the drag handler handle this.
  if (webkit) { display.scroller.draggable = true; }
  cm.state.draggingText = dragEnd;
  dragEnd.copy = !behavior.moveOnDrag;
  // IE's approach to draggable
  if (display.scroller.dragDrop) { display.scroller.dragDrop(); }
  on(document, "mouseup", dragEnd);
  on(document, "mousemove", mouseMove);
  on(display.scroller, "dragstart", dragStart);
  on(display.scroller, "drop", dragEnd);

  delayBlurEvent(cm);
  setTimeout(function () { return display.input.focus(); }, 20);
}

function rangeForUnit(cm, pos, unit) {
  if (unit == "char") { return new Range(pos, pos) }
  if (unit == "word") { return cm.findWordAt(pos) }
  if (unit == "line") { return new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))) }
  var result = unit(cm, pos);
  return new Range(result.from, result.to)
}

// Normal selection, as opposed to text dragging.
function leftButtonSelect(cm, event, start, behavior) {
  var display = cm.display, doc = cm.doc;
  e_preventDefault(event);

  var ourRange, ourIndex, startSel = doc.sel, ranges = startSel.ranges;
  if (behavior.addNew && !behavior.extend) {
    ourIndex = doc.sel.contains(start);
    if (ourIndex > -1)
      { ourRange = ranges[ourIndex]; }
    else
      { ourRange = new Range(start, start); }
  } else {
    ourRange = doc.sel.primary();
    ourIndex = doc.sel.primIndex;
  }

  if (behavior.unit == "rectangle") {
    if (!behavior.addNew) { ourRange = new Range(start, start); }
    start = posFromMouse(cm, event, true, true);
    ourIndex = -1;
  } else {
    var range = rangeForUnit(cm, start, behavior.unit);
    if (behavior.extend)
      { ourRange = extendRange(ourRange, range.anchor, range.head, behavior.extend); }
    else
      { ourRange = range; }
  }

  if (!behavior.addNew) {
    ourIndex = 0;
    setSelection(doc, new Selection([ourRange], 0), sel_mouse);
    startSel = doc.sel;
  } else if (ourIndex == -1) {
    ourIndex = ranges.length;
    setSelection(doc, normalizeSelection(ranges.concat([ourRange]), ourIndex),
                 {scroll: false, origin: "*mouse"});
  } else if (ranges.length > 1 && ranges[ourIndex].empty() && behavior.unit == "char" && !behavior.extend) {
    setSelection(doc, normalizeSelection(ranges.slice(0, ourIndex).concat(ranges.slice(ourIndex + 1)), 0),
                 {scroll: false, origin: "*mouse"});
    startSel = doc.sel;
  } else {
    replaceOneSelection(doc, ourIndex, ourRange, sel_mouse);
  }

  var lastPos = start;
  function extendTo(pos) {
    if (cmp(lastPos, pos) == 0) { return }
    lastPos = pos;

    if (behavior.unit == "rectangle") {
      var ranges = [], tabSize = cm.options.tabSize;
      var startCol = countColumn(getLine(doc, start.line).text, start.ch, tabSize);
      var posCol = countColumn(getLine(doc, pos.line).text, pos.ch, tabSize);
      var left = Math.min(startCol, posCol), right = Math.max(startCol, posCol);
      for (var line = Math.min(start.line, pos.line), end = Math.min(cm.lastLine(), Math.max(start.line, pos.line));
           line <= end; line++) {
        var text = getLine(doc, line).text, leftPos = findColumn(text, left, tabSize);
        if (left == right)
          { ranges.push(new Range(Pos(line, leftPos), Pos(line, leftPos))); }
        else if (text.length > leftPos)
          { ranges.push(new Range(Pos(line, leftPos), Pos(line, findColumn(text, right, tabSize)))); }
      }
      if (!ranges.length) { ranges.push(new Range(start, start)); }
      setSelection(doc, normalizeSelection(startSel.ranges.slice(0, ourIndex).concat(ranges), ourIndex),
                   {origin: "*mouse", scroll: false});
      cm.scrollIntoView(pos);
    } else {
      var oldRange = ourRange;
      var range = rangeForUnit(cm, pos, behavior.unit);
      var anchor = oldRange.anchor, head;
      if (cmp(range.anchor, anchor) > 0) {
        head = range.head;
        anchor = minPos(oldRange.from(), range.anchor);
      } else {
        head = range.anchor;
        anchor = maxPos(oldRange.to(), range.head);
      }
      var ranges$1 = startSel.ranges.slice(0);
      ranges$1[ourIndex] = new Range(clipPos(doc, anchor), head);
      setSelection(doc, normalizeSelection(ranges$1, ourIndex), sel_mouse);
    }
  }

  var editorSize = display.wrapper.getBoundingClientRect();
  // Used to ensure timeout re-tries don't fire when another extend
  // happened in the meantime (clearTimeout isn't reliable -- at
  // least on Chrome, the timeouts still happen even when cleared,
  // if the clear happens after their scheduled firing time).
  var counter = 0;

  function extend(e) {
    var curCount = ++counter;
    var cur = posFromMouse(cm, e, true, behavior.unit == "rectangle");
    if (!cur) { return }
    if (cmp(cur, lastPos) != 0) {
      cm.curOp.focus = activeElt();
      extendTo(cur);
      var visible = visibleLines(display, doc);
      if (cur.line >= visible.to || cur.line < visible.from)
        { setTimeout(operation(cm, function () {if (counter == curCount) { extend(e); }}), 150); }
    } else {
      var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;
      if (outside) { setTimeout(operation(cm, function () {
        if (counter != curCount) { return }
        display.scroller.scrollTop += outside;
        extend(e);
      }), 50); }
    }
  }

  function done(e) {
    cm.state.selectingText = false;
    counter = Infinity;
    e_preventDefault(e);
    display.input.focus();
    off(document, "mousemove", move);
    off(document, "mouseup", up);
    doc.history.lastSelOrigin = null;
  }

  var move = operation(cm, function (e) {
    if (!e_button(e)) { done(e); }
    else { extend(e); }
  });
  var up = operation(cm, done);
  cm.state.selectingText = up;
  on(document, "mousemove", move);
  on(document, "mouseup", up);
}


// Determines whether an event happened in the gutter, and fires the
// handlers for the corresponding event.
function gutterEvent(cm, e, type, prevent) {
  var mX, mY;
  try { mX = e.clientX; mY = e.clientY; }
  catch(e) { return false }
  if (mX >= Math.floor(cm.display.gutters.getBoundingClientRect().right)) { return false }
  if (prevent) { e_preventDefault(e); }

  var display = cm.display;
  var lineBox = display.lineDiv.getBoundingClientRect();

  if (mY > lineBox.bottom || !hasHandler(cm, type)) { return e_defaultPrevented(e) }
  mY -= lineBox.top - display.viewOffset;

  for (var i = 0; i < cm.options.gutters.length; ++i) {
    var g = display.gutters.childNodes[i];
    if (g && g.getBoundingClientRect().right >= mX) {
      var line = lineAtHeight(cm.doc, mY);
      var gutter = cm.options.gutters[i];
      signal(cm, type, cm, line, gutter, e);
      return e_defaultPrevented(e)
    }
  }
}

function clickInGutter(cm, e) {
  return gutterEvent(cm, e, "gutterClick", true)
}

// CONTEXT MENU HANDLING

// To make the context menu work, we need to briefly unhide the
// textarea (making it as unobtrusive as possible) to let the
// right-click take effect on it.
function onContextMenu(cm, e) {
  if (eventInWidget(cm.display, e) || contextMenuInGutter(cm, e)) { return }
  if (signalDOMEvent(cm, e, "contextmenu")) { return }
  cm.display.input.onContextMenu(e);
}

function contextMenuInGutter(cm, e) {
  if (!hasHandler(cm, "gutterContextMenu")) { return false }
  return gutterEvent(cm, e, "gutterContextMenu", false)
}

function themeChanged(cm) {
  cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") +
    cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
  clearCaches(cm);
}

var Init = {toString: function(){return "CodeMirror.Init"}};

var defaults = {};
var optionHandlers = {};

function defineOptions(CodeMirror) {
  var optionHandlers = CodeMirror.optionHandlers;

  function option(name, deflt, handle, notOnInit) {
    CodeMirror.defaults[name] = deflt;
    if (handle) { optionHandlers[name] =
      notOnInit ? function (cm, val, old) {if (old != Init) { handle(cm, val, old); }} : handle; }
  }

  CodeMirror.defineOption = option;

  // Passed to option handlers when there is no old value.
  CodeMirror.Init = Init;

  // These two are, on init, called from the constructor because they
  // have to be initialized before the editor can start at all.
  option("value", "", function (cm, val) { return cm.setValue(val); }, true);
  option("mode", null, function (cm, val) {
    cm.doc.modeOption = val;
    loadMode(cm);
  }, true);

  option("indentUnit", 2, loadMode, true);
  option("indentWithTabs", false);
  option("smartIndent", true);
  option("tabSize", 4, function (cm) {
    resetModeState(cm);
    clearCaches(cm);
    regChange(cm);
  }, true);
  option("lineSeparator", null, function (cm, val) {
    cm.doc.lineSep = val;
    if (!val) { return }
    var newBreaks = [], lineNo = cm.doc.first;
    cm.doc.iter(function (line) {
      for (var pos = 0;;) {
        var found = line.text.indexOf(val, pos);
        if (found == -1) { break }
        pos = found + val.length;
        newBreaks.push(Pos(lineNo, found));
      }
      lineNo++;
    });
    for (var i = newBreaks.length - 1; i >= 0; i--)
      { replaceRange(cm.doc, val, newBreaks[i], Pos(newBreaks[i].line, newBreaks[i].ch + val.length)); }
  });
  option("specialChars", /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff]/g, function (cm, val, old) {
    cm.state.specialChars = new RegExp(val.source + (val.test("\t") ? "" : "|\t"), "g");
    if (old != Init) { cm.refresh(); }
  });
  option("specialCharPlaceholder", defaultSpecialCharPlaceholder, function (cm) { return cm.refresh(); }, true);
  option("electricChars", true);
  option("inputStyle", mobile ? "contenteditable" : "textarea", function () {
    throw new Error("inputStyle can not (yet) be changed in a running editor") // FIXME
  }, true);
  option("spellcheck", false, function (cm, val) { return cm.getInputField().spellcheck = val; }, true);
  option("rtlMoveVisually", !windows);
  option("wholeLineUpdateBefore", true);

  option("theme", "default", function (cm) {
    themeChanged(cm);
    guttersChanged(cm);
  }, true);
  option("keyMap", "default", function (cm, val, old) {
    var next = getKeyMap(val);
    var prev = old != Init && getKeyMap(old);
    if (prev && prev.detach) { prev.detach(cm, next); }
    if (next.attach) { next.attach(cm, prev || null); }
  });
  option("extraKeys", null);
  option("configureMouse", null);

  option("lineWrapping", false, wrappingChanged, true);
  option("gutters", [], function (cm) {
    setGuttersForLineNumbers(cm.options);
    guttersChanged(cm);
  }, true);
  option("fixedGutter", true, function (cm, val) {
    cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
    cm.refresh();
  }, true);
  option("coverGutterNextToScrollbar", false, function (cm) { return updateScrollbars(cm); }, true);
  option("scrollbarStyle", "native", function (cm) {
    initScrollbars(cm);
    updateScrollbars(cm);
    cm.display.scrollbars.setScrollTop(cm.doc.scrollTop);
    cm.display.scrollbars.setScrollLeft(cm.doc.scrollLeft);
  }, true);
  option("lineNumbers", false, function (cm) {
    setGuttersForLineNumbers(cm.options);
    guttersChanged(cm);
  }, true);
  option("firstLineNumber", 1, guttersChanged, true);
  option("lineNumberFormatter", function (integer) { return integer; }, guttersChanged, true);
  option("showCursorWhenSelecting", false, updateSelection, true);

  option("resetSelectionOnContextMenu", true);
  option("lineWiseCopyCut", true);
  option("pasteLinesPerSelection", true);

  option("readOnly", false, function (cm, val) {
    if (val == "nocursor") {
      onBlur(cm);
      cm.display.input.blur();
    }
    cm.display.input.readOnlyChanged(val);
  });
  option("disableInput", false, function (cm, val) {if (!val) { cm.display.input.reset(); }}, true);
  option("dragDrop", true, dragDropChanged);
  option("allowDropFileTypes", null);

  option("cursorBlinkRate", 530);
  option("cursorScrollMargin", 0);
  option("cursorHeight", 1, updateSelection, true);
  option("singleCursorHeightPerLine", true, updateSelection, true);
  option("workTime", 100);
  option("workDelay", 100);
  option("flattenSpans", true, resetModeState, true);
  option("addModeClass", false, resetModeState, true);
  option("pollInterval", 100);
  option("undoDepth", 200, function (cm, val) { return cm.doc.history.undoDepth = val; });
  option("historyEventDelay", 1250);
  option("viewportMargin", 10, function (cm) { return cm.refresh(); }, true);
  option("maxHighlightLength", 10000, resetModeState, true);
  option("moveInputWithCursor", true, function (cm, val) {
    if (!val) { cm.display.input.resetPosition(); }
  });

  option("tabindex", null, function (cm, val) { return cm.display.input.getField().tabIndex = val || ""; });
  option("autofocus", null);
  option("direction", "ltr", function (cm, val) { return cm.doc.setDirection(val); }, true);
}

function guttersChanged(cm) {
  updateGutters(cm);
  regChange(cm);
  alignHorizontally(cm);
}

function dragDropChanged(cm, value, old) {
  var wasOn = old && old != Init;
  if (!value != !wasOn) {
    var funcs = cm.display.dragFunctions;
    var toggle = value ? on : off;
    toggle(cm.display.scroller, "dragstart", funcs.start);
    toggle(cm.display.scroller, "dragenter", funcs.enter);
    toggle(cm.display.scroller, "dragover", funcs.over);
    toggle(cm.display.scroller, "dragleave", funcs.leave);
    toggle(cm.display.scroller, "drop", funcs.drop);
  }
}

function wrappingChanged(cm) {
  if (cm.options.lineWrapping) {
    addClass(cm.display.wrapper, "CodeMirror-wrap");
    cm.display.sizer.style.minWidth = "";
    cm.display.sizerWidth = null;
  } else {
    rmClass(cm.display.wrapper, "CodeMirror-wrap");
    findMaxLine(cm);
  }
  estimateLineHeights(cm);
  regChange(cm);
  clearCaches(cm);
  setTimeout(function () { return updateScrollbars(cm); }, 100);
}

// A CodeMirror instance represents an editor. This is the object
// that user code is usually dealing with.

function CodeMirror(place, options) {
  var this$1 = this;

  if (!(this instanceof CodeMirror)) { return new CodeMirror(place, options) }

  this.options = options = options ? copyObj(options) : {};
  // Determine effective options based on given values and defaults.
  copyObj(defaults, options, false);
  setGuttersForLineNumbers(options);

  var doc = options.value;
  if (typeof doc == "string") { doc = new Doc(doc, options.mode, null, options.lineSeparator, options.direction); }
  this.doc = doc;

  var input = new CodeMirror.inputStyles[options.inputStyle](this);
  var display = this.display = new Display(place, doc, input);
  display.wrapper.CodeMirror = this;
  updateGutters(this);
  themeChanged(this);
  if (options.lineWrapping)
    { this.display.wrapper.className += " CodeMirror-wrap"; }
  initScrollbars(this);

  this.state = {
    keyMaps: [],  // stores maps added by addKeyMap
    overlays: [], // highlighting overlays, as added by addOverlay
    modeGen: 0,   // bumped when mode/overlay changes, used to invalidate highlighting info
    overwrite: false,
    delayingBlurEvent: false,
    focused: false,
    suppressEdits: false, // used to disable editing during key handlers when in readOnly mode
    pasteIncoming: false, cutIncoming: false, // help recognize paste/cut edits in input.poll
    selectingText: false,
    draggingText: false,
    highlight: new Delayed(), // stores highlight worker timeout
    keySeq: null,  // Unfinished key sequence
    specialChars: null
  };

  if (options.autofocus && !mobile) { display.input.focus(); }

  // Override magic textarea content restore that IE sometimes does
  // on our hidden textarea on reload
  if (ie && ie_version < 11) { setTimeout(function () { return this$1.display.input.reset(true); }, 20); }

  registerEventHandlers(this);
  ensureGlobalHandlers();

  startOperation(this);
  this.curOp.forceUpdate = true;
  attachDoc(this, doc);

  if ((options.autofocus && !mobile) || this.hasFocus())
    { setTimeout(bind(onFocus, this), 20); }
  else
    { onBlur(this); }

  for (var opt in optionHandlers) { if (optionHandlers.hasOwnProperty(opt))
    { optionHandlers[opt](this$1, options[opt], Init); } }
  maybeUpdateLineNumberWidth(this);
  if (options.finishInit) { options.finishInit(this); }
  for (var i = 0; i < initHooks.length; ++i) { initHooks[i](this$1); }
  endOperation(this);
  // Suppress optimizelegibility in Webkit, since it breaks text
  // measuring on line wrapping boundaries.
  if (webkit && options.lineWrapping &&
      getComputedStyle(display.lineDiv).textRendering == "optimizelegibility")
    { display.lineDiv.style.textRendering = "auto"; }
}

// The default configuration options.
CodeMirror.defaults = defaults;
// Functions to run when options are changed.
CodeMirror.optionHandlers = optionHandlers;

// Attach the necessary event handlers when initializing the editor
function registerEventHandlers(cm) {
  var d = cm.display;
  on(d.scroller, "mousedown", operation(cm, onMouseDown));
  // Older IE's will not fire a second mousedown for a double click
  if (ie && ie_version < 11)
    { on(d.scroller, "dblclick", operation(cm, function (e) {
      if (signalDOMEvent(cm, e)) { return }
      var pos = posFromMouse(cm, e);
      if (!pos || clickInGutter(cm, e) || eventInWidget(cm.display, e)) { return }
      e_preventDefault(e);
      var word = cm.findWordAt(pos);
      extendSelection(cm.doc, word.anchor, word.head);
    })); }
  else
    { on(d.scroller, "dblclick", function (e) { return signalDOMEvent(cm, e) || e_preventDefault(e); }); }
  // Some browsers fire contextmenu *after* opening the menu, at
  // which point we can't mess with it anymore. Context menu is
  // handled in onMouseDown for these browsers.
  if (!captureRightClick) { on(d.scroller, "contextmenu", function (e) { return onContextMenu(cm, e); }); }

  // Used to suppress mouse event handling when a touch happens
  var touchFinished, prevTouch = {end: 0};
  function finishTouch() {
    if (d.activeTouch) {
      touchFinished = setTimeout(function () { return d.activeTouch = null; }, 1000);
      prevTouch = d.activeTouch;
      prevTouch.end = +new Date;
    }
  }
  function isMouseLikeTouchEvent(e) {
    if (e.touches.length != 1) { return false }
    var touch = e.touches[0];
    return touch.radiusX <= 1 && touch.radiusY <= 1
  }
  function farAway(touch, other) {
    if (other.left == null) { return true }
    var dx = other.left - touch.left, dy = other.top - touch.top;
    return dx * dx + dy * dy > 20 * 20
  }
  on(d.scroller, "touchstart", function (e) {
    if (!signalDOMEvent(cm, e) && !isMouseLikeTouchEvent(e)) {
      d.input.ensurePolled();
      clearTimeout(touchFinished);
      var now = +new Date;
      d.activeTouch = {start: now, moved: false,
                       prev: now - prevTouch.end <= 300 ? prevTouch : null};
      if (e.touches.length == 1) {
        d.activeTouch.left = e.touches[0].pageX;
        d.activeTouch.top = e.touches[0].pageY;
      }
    }
  });
  on(d.scroller, "touchmove", function () {
    if (d.activeTouch) { d.activeTouch.moved = true; }
  });
  on(d.scroller, "touchend", function (e) {
    var touch = d.activeTouch;
    if (touch && !eventInWidget(d, e) && touch.left != null &&
        !touch.moved && new Date - touch.start < 300) {
      var pos = cm.coordsChar(d.activeTouch, "page"), range;
      if (!touch.prev || farAway(touch, touch.prev)) // Single tap
        { range = new Range(pos, pos); }
      else if (!touch.prev.prev || farAway(touch, touch.prev.prev)) // Double tap
        { range = cm.findWordAt(pos); }
      else // Triple tap
        { range = new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))); }
      cm.setSelection(range.anchor, range.head);
      cm.focus();
      e_preventDefault(e);
    }
    finishTouch();
  });
  on(d.scroller, "touchcancel", finishTouch);

  // Sync scrolling between fake scrollbars and real scrollable
  // area, ensure viewport is updated when scrolling.
  on(d.scroller, "scroll", function () {
    if (d.scroller.clientHeight) {
      updateScrollTop(cm, d.scroller.scrollTop);
      setScrollLeft(cm, d.scroller.scrollLeft, true);
      signal(cm, "scroll", cm);
    }
  });

  // Listen to wheel events in order to try and update the viewport on time.
  on(d.scroller, "mousewheel", function (e) { return onScrollWheel(cm, e); });
  on(d.scroller, "DOMMouseScroll", function (e) { return onScrollWheel(cm, e); });

  // Prevent wrapper from ever scrolling
  on(d.wrapper, "scroll", function () { return d.wrapper.scrollTop = d.wrapper.scrollLeft = 0; });

  d.dragFunctions = {
    enter: function (e) {if (!signalDOMEvent(cm, e)) { e_stop(e); }},
    over: function (e) {if (!signalDOMEvent(cm, e)) { onDragOver(cm, e); e_stop(e); }},
    start: function (e) { return onDragStart(cm, e); },
    drop: operation(cm, onDrop),
    leave: function (e) {if (!signalDOMEvent(cm, e)) { clearDragCursor(cm); }}
  };

  var inp = d.input.getField();
  on(inp, "keyup", function (e) { return onKeyUp.call(cm, e); });
  on(inp, "keydown", operation(cm, onKeyDown));
  on(inp, "keypress", operation(cm, onKeyPress));
  on(inp, "focus", function (e) { return onFocus(cm, e); });
  on(inp, "blur", function (e) { return onBlur(cm, e); });
}

var initHooks = [];
CodeMirror.defineInitHook = function (f) { return initHooks.push(f); };

// Indent the given line. The how parameter can be "smart",
// "add"/null, "subtract", or "prev". When aggressive is false
// (typically set to true for forced single-line indents), empty
// lines are not indented, and places where the mode returns Pass
// are left alone.
function indentLine(cm, n, how, aggressive) {
  var doc = cm.doc, state;
  if (how == null) { how = "add"; }
  if (how == "smart") {
    // Fall back to "prev" when the mode doesn't have an indentation
    // method.
    if (!doc.mode.indent) { how = "prev"; }
    else { state = getContextBefore(cm, n).state; }
  }

  var tabSize = cm.options.tabSize;
  var line = getLine(doc, n), curSpace = countColumn(line.text, null, tabSize);
  if (line.stateAfter) { line.stateAfter = null; }
  var curSpaceString = line.text.match(/^\s*/)[0], indentation;
  if (!aggressive && !/\S/.test(line.text)) {
    indentation = 0;
    how = "not";
  } else if (how == "smart") {
    indentation = doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);
    if (indentation == Pass || indentation > 150) {
      if (!aggressive) { return }
      how = "prev";
    }
  }
  if (how == "prev") {
    if (n > doc.first) { indentation = countColumn(getLine(doc, n-1).text, null, tabSize); }
    else { indentation = 0; }
  } else if (how == "add") {
    indentation = curSpace + cm.options.indentUnit;
  } else if (how == "subtract") {
    indentation = curSpace - cm.options.indentUnit;
  } else if (typeof how == "number") {
    indentation = curSpace + how;
  }
  indentation = Math.max(0, indentation);

  var indentString = "", pos = 0;
  if (cm.options.indentWithTabs)
    { for (var i = Math.floor(indentation / tabSize); i; --i) {pos += tabSize; indentString += "\t";} }
  if (pos < indentation) { indentString += spaceStr(indentation - pos); }

  if (indentString != curSpaceString) {
    replaceRange(doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");
    line.stateAfter = null;
    return true
  } else {
    // Ensure that, if the cursor was in the whitespace at the start
    // of the line, it is moved to the end of that space.
    for (var i$1 = 0; i$1 < doc.sel.ranges.length; i$1++) {
      var range = doc.sel.ranges[i$1];
      if (range.head.line == n && range.head.ch < curSpaceString.length) {
        var pos$1 = Pos(n, curSpaceString.length);
        replaceOneSelection(doc, i$1, new Range(pos$1, pos$1));
        break
      }
    }
  }
}

// This will be set to a {lineWise: bool, text: [string]} object, so
// that, when pasting, we know what kind of selections the copied
// text was made out of.
var lastCopied = null;

function setLastCopied(newLastCopied) {
  lastCopied = newLastCopied;
}

function applyTextInput(cm, inserted, deleted, sel, origin) {
  var doc = cm.doc;
  cm.display.shift = false;
  if (!sel) { sel = doc.sel; }

  var paste = cm.state.pasteIncoming || origin == "paste";
  var textLines = splitLinesAuto(inserted), multiPaste = null;
  // When pasing N lines into N selections, insert one line per selection
  if (paste && sel.ranges.length > 1) {
    if (lastCopied && lastCopied.text.join("\n") == inserted) {
      if (sel.ranges.length % lastCopied.text.length == 0) {
        multiPaste = [];
        for (var i = 0; i < lastCopied.text.length; i++)
          { multiPaste.push(doc.splitLines(lastCopied.text[i])); }
      }
    } else if (textLines.length == sel.ranges.length && cm.options.pasteLinesPerSelection) {
      multiPaste = map(textLines, function (l) { return [l]; });
    }
  }

  var updateInput;
  // Normal behavior is to insert the new text into every selection
  for (var i$1 = sel.ranges.length - 1; i$1 >= 0; i$1--) {
    var range = sel.ranges[i$1];
    var from = range.from(), to = range.to();
    if (range.empty()) {
      if (deleted && deleted > 0) // Handle deletion
        { from = Pos(from.line, from.ch - deleted); }
      else if (cm.state.overwrite && !paste) // Handle overwrite
        { to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + lst(textLines).length)); }
      else if (lastCopied && lastCopied.lineWise && lastCopied.text.join("\n") == inserted)
        { from = to = Pos(from.line, 0); }
    }
    updateInput = cm.curOp.updateInput;
    var changeEvent = {from: from, to: to, text: multiPaste ? multiPaste[i$1 % multiPaste.length] : textLines,
                       origin: origin || (paste ? "paste" : cm.state.cutIncoming ? "cut" : "+input")};
    makeChange(cm.doc, changeEvent);
    signalLater(cm, "inputRead", cm, changeEvent);
  }
  if (inserted && !paste)
    { triggerElectric(cm, inserted); }

  ensureCursorVisible(cm);
  cm.curOp.updateInput = updateInput;
  cm.curOp.typing = true;
  cm.state.pasteIncoming = cm.state.cutIncoming = false;
}

function handlePaste(e, cm) {
  var pasted = e.clipboardData && e.clipboardData.getData("Text");
  if (pasted) {
    e.preventDefault();
    if (!cm.isReadOnly() && !cm.options.disableInput)
      { runInOp(cm, function () { return applyTextInput(cm, pasted, 0, null, "paste"); }); }
    return true
  }
}

function triggerElectric(cm, inserted) {
  // When an 'electric' character is inserted, immediately trigger a reindent
  if (!cm.options.electricChars || !cm.options.smartIndent) { return }
  var sel = cm.doc.sel;

  for (var i = sel.ranges.length - 1; i >= 0; i--) {
    var range = sel.ranges[i];
    if (range.head.ch > 100 || (i && sel.ranges[i - 1].head.line == range.head.line)) { continue }
    var mode = cm.getModeAt(range.head);
    var indented = false;
    if (mode.electricChars) {
      for (var j = 0; j < mode.electricChars.length; j++)
        { if (inserted.indexOf(mode.electricChars.charAt(j)) > -1) {
          indented = indentLine(cm, range.head.line, "smart");
          break
        } }
    } else if (mode.electricInput) {
      if (mode.electricInput.test(getLine(cm.doc, range.head.line).text.slice(0, range.head.ch)))
        { indented = indentLine(cm, range.head.line, "smart"); }
    }
    if (indented) { signalLater(cm, "electricInput", cm, range.head.line); }
  }
}

function copyableRanges(cm) {
  var text = [], ranges = [];
  for (var i = 0; i < cm.doc.sel.ranges.length; i++) {
    var line = cm.doc.sel.ranges[i].head.line;
    var lineRange = {anchor: Pos(line, 0), head: Pos(line + 1, 0)};
    ranges.push(lineRange);
    text.push(cm.getRange(lineRange.anchor, lineRange.head));
  }
  return {text: text, ranges: ranges}
}

function disableBrowserMagic(field, spellcheck) {
  field.setAttribute("autocorrect", "off");
  field.setAttribute("autocapitalize", "off");
  field.setAttribute("spellcheck", !!spellcheck);
}

function hiddenTextarea() {
  var te = elt("textarea", null, null, "position: absolute; bottom: -1em; padding: 0; width: 1px; height: 1em; outline: none");
  var div = elt("div", [te], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
  // The textarea is kept positioned near the cursor to prevent the
  // fact that it'll be scrolled into view on input from scrolling
  // our fake cursor out of view. On webkit, when wrap=off, paste is
  // very slow. So make the area wide instead.
  if (webkit) { te.style.width = "1000px"; }
  else { te.setAttribute("wrap", "off"); }
  // If border: 0; -- iOS fails to open keyboard (issue #1287)
  if (ios) { te.style.border = "1px solid black"; }
  disableBrowserMagic(te);
  return div
}

// The publicly visible API. Note that methodOp(f) means
// 'wrap f in an operation, performed on its `this` parameter'.

// This is not the complete set of editor methods. Most of the
// methods defined on the Doc type are also injected into
// CodeMirror.prototype, for backwards compatibility and
// convenience.

function addEditorMethods(CodeMirror) {
  var optionHandlers = CodeMirror.optionHandlers;

  var helpers = CodeMirror.helpers = {};

  CodeMirror.prototype = {
    constructor: CodeMirror,
    focus: function(){window.focus(); this.display.input.focus();},

    setOption: function(option, value) {
      var options = this.options, old = options[option];
      if (options[option] == value && option != "mode") { return }
      options[option] = value;
      if (optionHandlers.hasOwnProperty(option))
        { operation(this, optionHandlers[option])(this, value, old); }
      signal(this, "optionChange", this, option);
    },

    getOption: function(option) {return this.options[option]},
    getDoc: function() {return this.doc},

    addKeyMap: function(map, bottom) {
      this.state.keyMaps[bottom ? "push" : "unshift"](getKeyMap(map));
    },
    removeKeyMap: function(map) {
      var maps = this.state.keyMaps;
      for (var i = 0; i < maps.length; ++i)
        { if (maps[i] == map || maps[i].name == map) {
          maps.splice(i, 1);
          return true
        } }
    },

    addOverlay: methodOp(function(spec, options) {
      var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);
      if (mode.startState) { throw new Error("Overlays may not be stateful.") }
      insertSorted(this.state.overlays,
                   {mode: mode, modeSpec: spec, opaque: options && options.opaque,
                    priority: (options && options.priority) || 0},
                   function (overlay) { return overlay.priority; });
      this.state.modeGen++;
      regChange(this);
    }),
    removeOverlay: methodOp(function(spec) {
      var this$1 = this;

      var overlays = this.state.overlays;
      for (var i = 0; i < overlays.length; ++i) {
        var cur = overlays[i].modeSpec;
        if (cur == spec || typeof spec == "string" && cur.name == spec) {
          overlays.splice(i, 1);
          this$1.state.modeGen++;
          regChange(this$1);
          return
        }
      }
    }),

    indentLine: methodOp(function(n, dir, aggressive) {
      if (typeof dir != "string" && typeof dir != "number") {
        if (dir == null) { dir = this.options.smartIndent ? "smart" : "prev"; }
        else { dir = dir ? "add" : "subtract"; }
      }
      if (isLine(this.doc, n)) { indentLine(this, n, dir, aggressive); }
    }),
    indentSelection: methodOp(function(how) {
      var this$1 = this;

      var ranges = this.doc.sel.ranges, end = -1;
      for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (!range.empty()) {
          var from = range.from(), to = range.to();
          var start = Math.max(end, from.line);
          end = Math.min(this$1.lastLine(), to.line - (to.ch ? 0 : 1)) + 1;
          for (var j = start; j < end; ++j)
            { indentLine(this$1, j, how); }
          var newRanges = this$1.doc.sel.ranges;
          if (from.ch == 0 && ranges.length == newRanges.length && newRanges[i].from().ch > 0)
            { replaceOneSelection(this$1.doc, i, new Range(from, newRanges[i].to()), sel_dontScroll); }
        } else if (range.head.line > end) {
          indentLine(this$1, range.head.line, how, true);
          end = range.head.line;
          if (i == this$1.doc.sel.primIndex) { ensureCursorVisible(this$1); }
        }
      }
    }),

    // Fetch the parser token for a given character. Useful for hacks
    // that want to inspect the mode state (say, for completion).
    getTokenAt: function(pos, precise) {
      return takeToken(this, pos, precise)
    },

    getLineTokens: function(line, precise) {
      return takeToken(this, Pos(line), precise, true)
    },

    getTokenTypeAt: function(pos) {
      pos = clipPos(this.doc, pos);
      var styles = getLineStyles(this, getLine(this.doc, pos.line));
      var before = 0, after = (styles.length - 1) / 2, ch = pos.ch;
      var type;
      if (ch == 0) { type = styles[2]; }
      else { for (;;) {
        var mid = (before + after) >> 1;
        if ((mid ? styles[mid * 2 - 1] : 0) >= ch) { after = mid; }
        else if (styles[mid * 2 + 1] < ch) { before = mid + 1; }
        else { type = styles[mid * 2 + 2]; break }
      } }
      var cut = type ? type.indexOf("overlay ") : -1;
      return cut < 0 ? type : cut == 0 ? null : type.slice(0, cut - 1)
    },

    getModeAt: function(pos) {
      var mode = this.doc.mode;
      if (!mode.innerMode) { return mode }
      return CodeMirror.innerMode(mode, this.getTokenAt(pos).state).mode
    },

    getHelper: function(pos, type) {
      return this.getHelpers(pos, type)[0]
    },

    getHelpers: function(pos, type) {
      var this$1 = this;

      var found = [];
      if (!helpers.hasOwnProperty(type)) { return found }
      var help = helpers[type], mode = this.getModeAt(pos);
      if (typeof mode[type] == "string") {
        if (help[mode[type]]) { found.push(help[mode[type]]); }
      } else if (mode[type]) {
        for (var i = 0; i < mode[type].length; i++) {
          var val = help[mode[type][i]];
          if (val) { found.push(val); }
        }
      } else if (mode.helperType && help[mode.helperType]) {
        found.push(help[mode.helperType]);
      } else if (help[mode.name]) {
        found.push(help[mode.name]);
      }
      for (var i$1 = 0; i$1 < help._global.length; i$1++) {
        var cur = help._global[i$1];
        if (cur.pred(mode, this$1) && indexOf(found, cur.val) == -1)
          { found.push(cur.val); }
      }
      return found
    },

    getStateAfter: function(line, precise) {
      var doc = this.doc;
      line = clipLine(doc, line == null ? doc.first + doc.size - 1: line);
      return getContextBefore(this, line + 1, precise).state
    },

    cursorCoords: function(start, mode) {
      var pos, range = this.doc.sel.primary();
      if (start == null) { pos = range.head; }
      else if (typeof start == "object") { pos = clipPos(this.doc, start); }
      else { pos = start ? range.from() : range.to(); }
      return cursorCoords(this, pos, mode || "page")
    },

    charCoords: function(pos, mode) {
      return charCoords(this, clipPos(this.doc, pos), mode || "page")
    },

    coordsChar: function(coords, mode) {
      coords = fromCoordSystem(this, coords, mode || "page");
      return coordsChar(this, coords.left, coords.top)
    },

    lineAtHeight: function(height, mode) {
      height = fromCoordSystem(this, {top: height, left: 0}, mode || "page").top;
      return lineAtHeight(this.doc, height + this.display.viewOffset)
    },
    heightAtLine: function(line, mode, includeWidgets) {
      var end = false, lineObj;
      if (typeof line == "number") {
        var last = this.doc.first + this.doc.size - 1;
        if (line < this.doc.first) { line = this.doc.first; }
        else if (line > last) { line = last; end = true; }
        lineObj = getLine(this.doc, line);
      } else {
        lineObj = line;
      }
      return intoCoordSystem(this, lineObj, {top: 0, left: 0}, mode || "page", includeWidgets || end).top +
        (end ? this.doc.height - heightAtLine(lineObj) : 0)
    },

    defaultTextHeight: function() { return textHeight(this.display) },
    defaultCharWidth: function() { return charWidth(this.display) },

    getViewport: function() { return {from: this.display.viewFrom, to: this.display.viewTo}},

    addWidget: function(pos, node, scroll, vert, horiz) {
      var display = this.display;
      pos = cursorCoords(this, clipPos(this.doc, pos));
      var top = pos.bottom, left = pos.left;
      node.style.position = "absolute";
      node.setAttribute("cm-ignore-events", "true");
      this.display.input.setUneditable(node);
      display.sizer.appendChild(node);
      if (vert == "over") {
        top = pos.top;
      } else if (vert == "above" || vert == "near") {
        var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
        hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth);
        // Default to positioning above (if specified and possible); otherwise default to positioning below
        if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight)
          { top = pos.top - node.offsetHeight; }
        else if (pos.bottom + node.offsetHeight <= vspace)
          { top = pos.bottom; }
        if (left + node.offsetWidth > hspace)
          { left = hspace - node.offsetWidth; }
      }
      node.style.top = top + "px";
      node.style.left = node.style.right = "";
      if (horiz == "right") {
        left = display.sizer.clientWidth - node.offsetWidth;
        node.style.right = "0px";
      } else {
        if (horiz == "left") { left = 0; }
        else if (horiz == "middle") { left = (display.sizer.clientWidth - node.offsetWidth) / 2; }
        node.style.left = left + "px";
      }
      if (scroll)
        { scrollIntoView(this, {left: left, top: top, right: left + node.offsetWidth, bottom: top + node.offsetHeight}); }
    },

    triggerOnKeyDown: methodOp(onKeyDown),
    triggerOnKeyPress: methodOp(onKeyPress),
    triggerOnKeyUp: onKeyUp,
    triggerOnMouseDown: methodOp(onMouseDown),

    execCommand: function(cmd) {
      if (commands.hasOwnProperty(cmd))
        { return commands[cmd].call(null, this) }
    },

    triggerElectric: methodOp(function(text) { triggerElectric(this, text); }),

    findPosH: function(from, amount, unit, visually) {
      var this$1 = this;

      var dir = 1;
      if (amount < 0) { dir = -1; amount = -amount; }
      var cur = clipPos(this.doc, from);
      for (var i = 0; i < amount; ++i) {
        cur = findPosH(this$1.doc, cur, dir, unit, visually);
        if (cur.hitSide) { break }
      }
      return cur
    },

    moveH: methodOp(function(dir, unit) {
      var this$1 = this;

      this.extendSelectionsBy(function (range) {
        if (this$1.display.shift || this$1.doc.extend || range.empty())
          { return findPosH(this$1.doc, range.head, dir, unit, this$1.options.rtlMoveVisually) }
        else
          { return dir < 0 ? range.from() : range.to() }
      }, sel_move);
    }),

    deleteH: methodOp(function(dir, unit) {
      var sel = this.doc.sel, doc = this.doc;
      if (sel.somethingSelected())
        { doc.replaceSelection("", null, "+delete"); }
      else
        { deleteNearSelection(this, function (range) {
          var other = findPosH(doc, range.head, dir, unit, false);
          return dir < 0 ? {from: other, to: range.head} : {from: range.head, to: other}
        }); }
    }),

    findPosV: function(from, amount, unit, goalColumn) {
      var this$1 = this;

      var dir = 1, x = goalColumn;
      if (amount < 0) { dir = -1; amount = -amount; }
      var cur = clipPos(this.doc, from);
      for (var i = 0; i < amount; ++i) {
        var coords = cursorCoords(this$1, cur, "div");
        if (x == null) { x = coords.left; }
        else { coords.left = x; }
        cur = findPosV(this$1, coords, dir, unit);
        if (cur.hitSide) { break }
      }
      return cur
    },

    moveV: methodOp(function(dir, unit) {
      var this$1 = this;

      var doc = this.doc, goals = [];
      var collapse = !this.display.shift && !doc.extend && doc.sel.somethingSelected();
      doc.extendSelectionsBy(function (range) {
        if (collapse)
          { return dir < 0 ? range.from() : range.to() }
        var headPos = cursorCoords(this$1, range.head, "div");
        if (range.goalColumn != null) { headPos.left = range.goalColumn; }
        goals.push(headPos.left);
        var pos = findPosV(this$1, headPos, dir, unit);
        if (unit == "page" && range == doc.sel.primary())
          { addToScrollTop(this$1, charCoords(this$1, pos, "div").top - headPos.top); }
        return pos
      }, sel_move);
      if (goals.length) { for (var i = 0; i < doc.sel.ranges.length; i++)
        { doc.sel.ranges[i].goalColumn = goals[i]; } }
    }),

    // Find the word at the given position (as returned by coordsChar).
    findWordAt: function(pos) {
      var doc = this.doc, line = getLine(doc, pos.line).text;
      var start = pos.ch, end = pos.ch;
      if (line) {
        var helper = this.getHelper(pos, "wordChars");
        if ((pos.sticky == "before" || end == line.length) && start) { --start; } else { ++end; }
        var startChar = line.charAt(start);
        var check = isWordChar(startChar, helper)
          ? function (ch) { return isWordChar(ch, helper); }
          : /\s/.test(startChar) ? function (ch) { return /\s/.test(ch); }
          : function (ch) { return (!/\s/.test(ch) && !isWordChar(ch)); };
        while (start > 0 && check(line.charAt(start - 1))) { --start; }
        while (end < line.length && check(line.charAt(end))) { ++end; }
      }
      return new Range(Pos(pos.line, start), Pos(pos.line, end))
    },

    toggleOverwrite: function(value) {
      if (value != null && value == this.state.overwrite) { return }
      if (this.state.overwrite = !this.state.overwrite)
        { addClass(this.display.cursorDiv, "CodeMirror-overwrite"); }
      else
        { rmClass(this.display.cursorDiv, "CodeMirror-overwrite"); }

      signal(this, "overwriteToggle", this, this.state.overwrite);
    },
    hasFocus: function() { return this.display.input.getField() == activeElt() },
    isReadOnly: function() { return !!(this.options.readOnly || this.doc.cantEdit) },

    scrollTo: methodOp(function (x, y) { scrollToCoords(this, x, y); }),
    getScrollInfo: function() {
      var scroller = this.display.scroller;
      return {left: scroller.scrollLeft, top: scroller.scrollTop,
              height: scroller.scrollHeight - scrollGap(this) - this.display.barHeight,
              width: scroller.scrollWidth - scrollGap(this) - this.display.barWidth,
              clientHeight: displayHeight(this), clientWidth: displayWidth(this)}
    },

    scrollIntoView: methodOp(function(range, margin) {
      if (range == null) {
        range = {from: this.doc.sel.primary().head, to: null};
        if (margin == null) { margin = this.options.cursorScrollMargin; }
      } else if (typeof range == "number") {
        range = {from: Pos(range, 0), to: null};
      } else if (range.from == null) {
        range = {from: range, to: null};
      }
      if (!range.to) { range.to = range.from; }
      range.margin = margin || 0;

      if (range.from.line != null) {
        scrollToRange(this, range);
      } else {
        scrollToCoordsRange(this, range.from, range.to, range.margin);
      }
    }),

    setSize: methodOp(function(width, height) {
      var this$1 = this;

      var interpret = function (val) { return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val; };
      if (width != null) { this.display.wrapper.style.width = interpret(width); }
      if (height != null) { this.display.wrapper.style.height = interpret(height); }
      if (this.options.lineWrapping) { clearLineMeasurementCache(this); }
      var lineNo = this.display.viewFrom;
      this.doc.iter(lineNo, this.display.viewTo, function (line) {
        if (line.widgets) { for (var i = 0; i < line.widgets.length; i++)
          { if (line.widgets[i].noHScroll) { regLineChange(this$1, lineNo, "widget"); break } } }
        ++lineNo;
      });
      this.curOp.forceUpdate = true;
      signal(this, "refresh", this);
    }),

    operation: function(f){return runInOp(this, f)},
    startOperation: function(){return startOperation(this)},
    endOperation: function(){return endOperation(this)},

    refresh: methodOp(function() {
      var oldHeight = this.display.cachedTextHeight;
      regChange(this);
      this.curOp.forceUpdate = true;
      clearCaches(this);
      scrollToCoords(this, this.doc.scrollLeft, this.doc.scrollTop);
      updateGutterSpace(this);
      if (oldHeight == null || Math.abs(oldHeight - textHeight(this.display)) > .5)
        { estimateLineHeights(this); }
      signal(this, "refresh", this);
    }),

    swapDoc: methodOp(function(doc) {
      var old = this.doc;
      old.cm = null;
      attachDoc(this, doc);
      clearCaches(this);
      this.display.input.reset();
      scrollToCoords(this, doc.scrollLeft, doc.scrollTop);
      this.curOp.forceScroll = true;
      signalLater(this, "swapDoc", this, old);
      return old
    }),

    getInputField: function(){return this.display.input.getField()},
    getWrapperElement: function(){return this.display.wrapper},
    getScrollerElement: function(){return this.display.scroller},
    getGutterElement: function(){return this.display.gutters}
  };
  eventMixin(CodeMirror);

  CodeMirror.registerHelper = function(type, name, value) {
    if (!helpers.hasOwnProperty(type)) { helpers[type] = CodeMirror[type] = {_global: []}; }
    helpers[type][name] = value;
  };
  CodeMirror.registerGlobalHelper = function(type, name, predicate, value) {
    CodeMirror.registerHelper(type, name, value);
    helpers[type]._global.push({pred: predicate, val: value});
  };
}

// Used for horizontal relative motion. Dir is -1 or 1 (left or
// right), unit can be "char", "column" (like char, but doesn't
// cross line boundaries), "word" (across next word), or "group" (to
// the start of next group of word or non-word-non-whitespace
// chars). The visually param controls whether, in right-to-left
// text, direction 1 means to move towards the next index in the
// string, or towards the character to the right of the current
// position. The resulting position will have a hitSide=true
// property if it reached the end of the document.
function findPosH(doc, pos, dir, unit, visually) {
  var oldPos = pos;
  var origDir = dir;
  var lineObj = getLine(doc, pos.line);
  function findNextLine() {
    var l = pos.line + dir;
    if (l < doc.first || l >= doc.first + doc.size) { return false }
    pos = new Pos(l, pos.ch, pos.sticky);
    return lineObj = getLine(doc, l)
  }
  function moveOnce(boundToLine) {
    var next;
    if (visually) {
      next = moveVisually(doc.cm, lineObj, pos, dir);
    } else {
      next = moveLogically(lineObj, pos, dir);
    }
    if (next == null) {
      if (!boundToLine && findNextLine())
        { pos = endOfLine(visually, doc.cm, lineObj, pos.line, dir); }
      else
        { return false }
    } else {
      pos = next;
    }
    return true
  }

  if (unit == "char") {
    moveOnce();
  } else if (unit == "column") {
    moveOnce(true);
  } else if (unit == "word" || unit == "group") {
    var sawType = null, group = unit == "group";
    var helper = doc.cm && doc.cm.getHelper(pos, "wordChars");
    for (var first = true;; first = false) {
      if (dir < 0 && !moveOnce(!first)) { break }
      var cur = lineObj.text.charAt(pos.ch) || "\n";
      var type = isWordChar(cur, helper) ? "w"
        : group && cur == "\n" ? "n"
        : !group || /\s/.test(cur) ? null
        : "p";
      if (group && !first && !type) { type = "s"; }
      if (sawType && sawType != type) {
        if (dir < 0) {dir = 1; moveOnce(); pos.sticky = "after";}
        break
      }

      if (type) { sawType = type; }
      if (dir > 0 && !moveOnce(!first)) { break }
    }
  }
  var result = skipAtomic(doc, pos, oldPos, origDir, true);
  if (equalCursorPos(oldPos, result)) { result.hitSide = true; }
  return result
}

// For relative vertical movement. Dir may be -1 or 1. Unit can be
// "page" or "line". The resulting position will have a hitSide=true
// property if it reached the end of the document.
function findPosV(cm, pos, dir, unit) {
  var doc = cm.doc, x = pos.left, y;
  if (unit == "page") {
    var pageSize = Math.min(cm.display.wrapper.clientHeight, window.innerHeight || document.documentElement.clientHeight);
    var moveAmount = Math.max(pageSize - .5 * textHeight(cm.display), 3);
    y = (dir > 0 ? pos.bottom : pos.top) + dir * moveAmount;

  } else if (unit == "line") {
    y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
  }
  var target;
  for (;;) {
    target = coordsChar(cm, x, y);
    if (!target.outside) { break }
    if (dir < 0 ? y <= 0 : y >= doc.height) { target.hitSide = true; break }
    y += dir * 5;
  }
  return target
}

// CONTENTEDITABLE INPUT STYLE

var ContentEditableInput = function(cm) {
  this.cm = cm;
  this.lastAnchorNode = this.lastAnchorOffset = this.lastFocusNode = this.lastFocusOffset = null;
  this.polling = new Delayed();
  this.composing = null;
  this.gracePeriod = false;
  this.readDOMTimeout = null;
};

ContentEditableInput.prototype.init = function (display) {
    var this$1 = this;

  var input = this, cm = input.cm;
  var div = input.div = display.lineDiv;
  disableBrowserMagic(div, cm.options.spellcheck);

  on(div, "paste", function (e) {
    if (signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }
    // IE doesn't fire input events, so we schedule a read for the pasted content in this way
    if (ie_version <= 11) { setTimeout(operation(cm, function () { return this$1.updateFromDOM(); }), 20); }
  });

  on(div, "compositionstart", function (e) {
    this$1.composing = {data: e.data, done: false};
  });
  on(div, "compositionupdate", function (e) {
    if (!this$1.composing) { this$1.composing = {data: e.data, done: false}; }
  });
  on(div, "compositionend", function (e) {
    if (this$1.composing) {
      if (e.data != this$1.composing.data) { this$1.readFromDOMSoon(); }
      this$1.composing.done = true;
    }
  });

  on(div, "touchstart", function () { return input.forceCompositionEnd(); });

  on(div, "input", function () {
    if (!this$1.composing) { this$1.readFromDOMSoon(); }
  });

  function onCopyCut(e) {
    if (signalDOMEvent(cm, e)) { return }
    if (cm.somethingSelected()) {
      setLastCopied({lineWise: false, text: cm.getSelections()});
      if (e.type == "cut") { cm.replaceSelection("", null, "cut"); }
    } else if (!cm.options.lineWiseCopyCut) {
      return
    } else {
      var ranges = copyableRanges(cm);
      setLastCopied({lineWise: true, text: ranges.text});
      if (e.type == "cut") {
        cm.operation(function () {
          cm.setSelections(ranges.ranges, 0, sel_dontScroll);
          cm.replaceSelection("", null, "cut");
        });
      }
    }
    if (e.clipboardData) {
      e.clipboardData.clearData();
      var content = lastCopied.text.join("\n");
      // iOS exposes the clipboard API, but seems to discard content inserted into it
      e.clipboardData.setData("Text", content);
      if (e.clipboardData.getData("Text") == content) {
        e.preventDefault();
        return
      }
    }
    // Old-fashioned briefly-focus-a-textarea hack
    var kludge = hiddenTextarea(), te = kludge.firstChild;
    cm.display.lineSpace.insertBefore(kludge, cm.display.lineSpace.firstChild);
    te.value = lastCopied.text.join("\n");
    var hadFocus = document.activeElement;
    selectInput(te);
    setTimeout(function () {
      cm.display.lineSpace.removeChild(kludge);
      hadFocus.focus();
      if (hadFocus == div) { input.showPrimarySelection(); }
    }, 50);
  }
  on(div, "copy", onCopyCut);
  on(div, "cut", onCopyCut);
};

ContentEditableInput.prototype.prepareSelection = function () {
  var result = prepareSelection(this.cm, false);
  result.focus = this.cm.state.focused;
  return result
};

ContentEditableInput.prototype.showSelection = function (info, takeFocus) {
  if (!info || !this.cm.display.view.length) { return }
  if (info.focus || takeFocus) { this.showPrimarySelection(); }
  this.showMultipleSelections(info);
};

ContentEditableInput.prototype.showPrimarySelection = function () {
  var sel = window.getSelection(), cm = this.cm, prim = cm.doc.sel.primary();
  var from = prim.from(), to = prim.to();

  if (cm.display.viewTo == cm.display.viewFrom || from.line >= cm.display.viewTo || to.line < cm.display.viewFrom) {
    sel.removeAllRanges();
    return
  }

  var curAnchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
  var curFocus = domToPos(cm, sel.focusNode, sel.focusOffset);
  if (curAnchor && !curAnchor.bad && curFocus && !curFocus.bad &&
      cmp(minPos(curAnchor, curFocus), from) == 0 &&
      cmp(maxPos(curAnchor, curFocus), to) == 0)
    { return }

  var view = cm.display.view;
  var start = (from.line >= cm.display.viewFrom && posToDOM(cm, from)) ||
      {node: view[0].measure.map[2], offset: 0};
  var end = to.line < cm.display.viewTo && posToDOM(cm, to);
  if (!end) {
    var measure = view[view.length - 1].measure;
    var map = measure.maps ? measure.maps[measure.maps.length - 1] : measure.map;
    end = {node: map[map.length - 1], offset: map[map.length - 2] - map[map.length - 3]};
  }

  if (!start || !end) {
    sel.removeAllRanges();
    return
  }

  var old = sel.rangeCount && sel.getRangeAt(0), rng;
  try { rng = range(start.node, start.offset, end.offset, end.node); }
  catch(e) {} // Our model of the DOM might be outdated, in which case the range we try to set can be impossible
  if (rng) {
    if (!gecko && cm.state.focused) {
      sel.collapse(start.node, start.offset);
      if (!rng.collapsed) {
        sel.removeAllRanges();
        sel.addRange(rng);
      }
    } else {
      sel.removeAllRanges();
      sel.addRange(rng);
    }
    if (old && sel.anchorNode == null) { sel.addRange(old); }
    else if (gecko) { this.startGracePeriod(); }
  }
  this.rememberSelection();
};

ContentEditableInput.prototype.startGracePeriod = function () {
    var this$1 = this;

  clearTimeout(this.gracePeriod);
  this.gracePeriod = setTimeout(function () {
    this$1.gracePeriod = false;
    if (this$1.selectionChanged())
      { this$1.cm.operation(function () { return this$1.cm.curOp.selectionChanged = true; }); }
  }, 20);
};

ContentEditableInput.prototype.showMultipleSelections = function (info) {
  removeChildrenAndAdd(this.cm.display.cursorDiv, info.cursors);
  removeChildrenAndAdd(this.cm.display.selectionDiv, info.selection);
};

ContentEditableInput.prototype.rememberSelection = function () {
  var sel = window.getSelection();
  this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset;
  this.lastFocusNode = sel.focusNode; this.lastFocusOffset = sel.focusOffset;
};

ContentEditableInput.prototype.selectionInEditor = function () {
  var sel = window.getSelection();
  if (!sel.rangeCount) { return false }
  var node = sel.getRangeAt(0).commonAncestorContainer;
  return contains(this.div, node)
};

ContentEditableInput.prototype.focus = function () {
  if (this.cm.options.readOnly != "nocursor") {
    if (!this.selectionInEditor())
      { this.showSelection(this.prepareSelection(), true); }
    this.div.focus();
  }
};
ContentEditableInput.prototype.blur = function () { this.div.blur(); };
ContentEditableInput.prototype.getField = function () { return this.div };

ContentEditableInput.prototype.supportsTouch = function () { return true };

ContentEditableInput.prototype.receivedFocus = function () {
  var input = this;
  if (this.selectionInEditor())
    { this.pollSelection(); }
  else
    { runInOp(this.cm, function () { return input.cm.curOp.selectionChanged = true; }); }

  function poll() {
    if (input.cm.state.focused) {
      input.pollSelection();
      input.polling.set(input.cm.options.pollInterval, poll);
    }
  }
  this.polling.set(this.cm.options.pollInterval, poll);
};

ContentEditableInput.prototype.selectionChanged = function () {
  var sel = window.getSelection();
  return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
    sel.focusNode != this.lastFocusNode || sel.focusOffset != this.lastFocusOffset
};

ContentEditableInput.prototype.pollSelection = function () {
  if (this.readDOMTimeout != null || this.gracePeriod || !this.selectionChanged()) { return }
  var sel = window.getSelection(), cm = this.cm;
  // On Android Chrome (version 56, at least), backspacing into an
  // uneditable block element will put the cursor in that element,
  // and then, because it's not editable, hide the virtual keyboard.
  // Because Android doesn't allow us to actually detect backspace
  // presses in a sane way, this code checks for when that happens
  // and simulates a backspace press in this case.
  if (android && chrome && this.cm.options.gutters.length && isInGutter(sel.anchorNode)) {
    this.cm.triggerOnKeyDown({type: "keydown", keyCode: 8, preventDefault: Math.abs});
    this.blur();
    this.focus();
    return
  }
  if (this.composing) { return }
  this.rememberSelection();
  var anchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
  var head = domToPos(cm, sel.focusNode, sel.focusOffset);
  if (anchor && head) { runInOp(cm, function () {
    setSelection(cm.doc, simpleSelection(anchor, head), sel_dontScroll);
    if (anchor.bad || head.bad) { cm.curOp.selectionChanged = true; }
  }); }
};

ContentEditableInput.prototype.pollContent = function () {
  if (this.readDOMTimeout != null) {
    clearTimeout(this.readDOMTimeout);
    this.readDOMTimeout = null;
  }

  var cm = this.cm, display = cm.display, sel = cm.doc.sel.primary();
  var from = sel.from(), to = sel.to();
  if (from.ch == 0 && from.line > cm.firstLine())
    { from = Pos(from.line - 1, getLine(cm.doc, from.line - 1).length); }
  if (to.ch == getLine(cm.doc, to.line).text.length && to.line < cm.lastLine())
    { to = Pos(to.line + 1, 0); }
  if (from.line < display.viewFrom || to.line > display.viewTo - 1) { return false }

  var fromIndex, fromLine, fromNode;
  if (from.line == display.viewFrom || (fromIndex = findViewIndex(cm, from.line)) == 0) {
    fromLine = lineNo(display.view[0].line);
    fromNode = display.view[0].node;
  } else {
    fromLine = lineNo(display.view[fromIndex].line);
    fromNode = display.view[fromIndex - 1].node.nextSibling;
  }
  var toIndex = findViewIndex(cm, to.line);
  var toLine, toNode;
  if (toIndex == display.view.length - 1) {
    toLine = display.viewTo - 1;
    toNode = display.lineDiv.lastChild;
  } else {
    toLine = lineNo(display.view[toIndex + 1].line) - 1;
    toNode = display.view[toIndex + 1].node.previousSibling;
  }

  if (!fromNode) { return false }
  var newText = cm.doc.splitLines(domTextBetween(cm, fromNode, toNode, fromLine, toLine));
  var oldText = getBetween(cm.doc, Pos(fromLine, 0), Pos(toLine, getLine(cm.doc, toLine).text.length));
  while (newText.length > 1 && oldText.length > 1) {
    if (lst(newText) == lst(oldText)) { newText.pop(); oldText.pop(); toLine--; }
    else if (newText[0] == oldText[0]) { newText.shift(); oldText.shift(); fromLine++; }
    else { break }
  }

  var cutFront = 0, cutEnd = 0;
  var newTop = newText[0], oldTop = oldText[0], maxCutFront = Math.min(newTop.length, oldTop.length);
  while (cutFront < maxCutFront && newTop.charCodeAt(cutFront) == oldTop.charCodeAt(cutFront))
    { ++cutFront; }
  var newBot = lst(newText), oldBot = lst(oldText);
  var maxCutEnd = Math.min(newBot.length - (newText.length == 1 ? cutFront : 0),
                           oldBot.length - (oldText.length == 1 ? cutFront : 0));
  while (cutEnd < maxCutEnd &&
         newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1))
    { ++cutEnd; }
  // Try to move start of change to start of selection if ambiguous
  if (newText.length == 1 && oldText.length == 1 && fromLine == from.line) {
    while (cutFront && cutFront > from.ch &&
           newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1)) {
      cutFront--;
      cutEnd++;
    }
  }

  newText[newText.length - 1] = newBot.slice(0, newBot.length - cutEnd).replace(/^\u200b+/, "");
  newText[0] = newText[0].slice(cutFront).replace(/\u200b+$/, "");

  var chFrom = Pos(fromLine, cutFront);
  var chTo = Pos(toLine, oldText.length ? lst(oldText).length - cutEnd : 0);
  if (newText.length > 1 || newText[0] || cmp(chFrom, chTo)) {
    replaceRange(cm.doc, newText, chFrom, chTo, "+input");
    return true
  }
};

ContentEditableInput.prototype.ensurePolled = function () {
  this.forceCompositionEnd();
};
ContentEditableInput.prototype.reset = function () {
  this.forceCompositionEnd();
};
ContentEditableInput.prototype.forceCompositionEnd = function () {
  if (!this.composing) { return }
  clearTimeout(this.readDOMTimeout);
  this.composing = null;
  this.updateFromDOM();
  this.div.blur();
  this.div.focus();
};
ContentEditableInput.prototype.readFromDOMSoon = function () {
    var this$1 = this;

  if (this.readDOMTimeout != null) { return }
  this.readDOMTimeout = setTimeout(function () {
    this$1.readDOMTimeout = null;
    if (this$1.composing) {
      if (this$1.composing.done) { this$1.composing = null; }
      else { return }
    }
    this$1.updateFromDOM();
  }, 80);
};

ContentEditableInput.prototype.updateFromDOM = function () {
    var this$1 = this;

  if (this.cm.isReadOnly() || !this.pollContent())
    { runInOp(this.cm, function () { return regChange(this$1.cm); }); }
};

ContentEditableInput.prototype.setUneditable = function (node) {
  node.contentEditable = "false";
};

ContentEditableInput.prototype.onKeyPress = function (e) {
  if (e.charCode == 0) { return }
  e.preventDefault();
  if (!this.cm.isReadOnly())
    { operation(this.cm, applyTextInput)(this.cm, String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode), 0); }
};

ContentEditableInput.prototype.readOnlyChanged = function (val) {
  this.div.contentEditable = String(val != "nocursor");
};

ContentEditableInput.prototype.onContextMenu = function () {};
ContentEditableInput.prototype.resetPosition = function () {};

ContentEditableInput.prototype.needsContentAttribute = true;

function posToDOM(cm, pos) {
  var view = findViewForLine(cm, pos.line);
  if (!view || view.hidden) { return null }
  var line = getLine(cm.doc, pos.line);
  var info = mapFromLineView(view, line, pos.line);

  var order = getOrder(line, cm.doc.direction), side = "left";
  if (order) {
    var partPos = getBidiPartAt(order, pos.ch);
    side = partPos % 2 ? "right" : "left";
  }
  var result = nodeAndOffsetInLineMap(info.map, pos.ch, side);
  result.offset = result.collapse == "right" ? result.end : result.start;
  return result
}

function isInGutter(node) {
  for (var scan = node; scan; scan = scan.parentNode)
    { if (/CodeMirror-gutter-wrapper/.test(scan.className)) { return true } }
  return false
}

function badPos(pos, bad) { if (bad) { pos.bad = true; } return pos }

function domTextBetween(cm, from, to, fromLine, toLine) {
  var text = "", closing = false, lineSep = cm.doc.lineSeparator();
  function recognizeMarker(id) { return function (marker) { return marker.id == id; } }
  function close() {
    if (closing) {
      text += lineSep;
      closing = false;
    }
  }
  function addText(str) {
    if (str) {
      close();
      text += str;
    }
  }
  function walk(node) {
    if (node.nodeType == 1) {
      var cmText = node.getAttribute("cm-text");
      if (cmText != null) {
        addText(cmText || node.textContent.replace(/\u200b/g, ""));
        return
      }
      var markerID = node.getAttribute("cm-marker"), range;
      if (markerID) {
        var found = cm.findMarks(Pos(fromLine, 0), Pos(toLine + 1, 0), recognizeMarker(+markerID));
        if (found.length && (range = found[0].find()))
          { addText(getBetween(cm.doc, range.from, range.to).join(lineSep)); }
        return
      }
      if (node.getAttribute("contenteditable") == "false") { return }
      var isBlock = /^(pre|div|p)$/i.test(node.nodeName);
      if (isBlock) { close(); }
      for (var i = 0; i < node.childNodes.length; i++)
        { walk(node.childNodes[i]); }
      if (isBlock) { closing = true; }
    } else if (node.nodeType == 3) {
      addText(node.nodeValue);
    }
  }
  for (;;) {
    walk(from);
    if (from == to) { break }
    from = from.nextSibling;
  }
  return text
}

function domToPos(cm, node, offset) {
  var lineNode;
  if (node == cm.display.lineDiv) {
    lineNode = cm.display.lineDiv.childNodes[offset];
    if (!lineNode) { return badPos(cm.clipPos(Pos(cm.display.viewTo - 1)), true) }
    node = null; offset = 0;
  } else {
    for (lineNode = node;; lineNode = lineNode.parentNode) {
      if (!lineNode || lineNode == cm.display.lineDiv) { return null }
      if (lineNode.parentNode && lineNode.parentNode == cm.display.lineDiv) { break }
    }
  }
  for (var i = 0; i < cm.display.view.length; i++) {
    var lineView = cm.display.view[i];
    if (lineView.node == lineNode)
      { return locateNodeInLineView(lineView, node, offset) }
  }
}

function locateNodeInLineView(lineView, node, offset) {
  var wrapper = lineView.text.firstChild, bad = false;
  if (!node || !contains(wrapper, node)) { return badPos(Pos(lineNo(lineView.line), 0), true) }
  if (node == wrapper) {
    bad = true;
    node = wrapper.childNodes[offset];
    offset = 0;
    if (!node) {
      var line = lineView.rest ? lst(lineView.rest) : lineView.line;
      return badPos(Pos(lineNo(line), line.text.length), bad)
    }
  }

  var textNode = node.nodeType == 3 ? node : null, topNode = node;
  if (!textNode && node.childNodes.length == 1 && node.firstChild.nodeType == 3) {
    textNode = node.firstChild;
    if (offset) { offset = textNode.nodeValue.length; }
  }
  while (topNode.parentNode != wrapper) { topNode = topNode.parentNode; }
  var measure = lineView.measure, maps = measure.maps;

  function find(textNode, topNode, offset) {
    for (var i = -1; i < (maps ? maps.length : 0); i++) {
      var map = i < 0 ? measure.map : maps[i];
      for (var j = 0; j < map.length; j += 3) {
        var curNode = map[j + 2];
        if (curNode == textNode || curNode == topNode) {
          var line = lineNo(i < 0 ? lineView.line : lineView.rest[i]);
          var ch = map[j] + offset;
          if (offset < 0 || curNode != textNode) { ch = map[j + (offset ? 1 : 0)]; }
          return Pos(line, ch)
        }
      }
    }
  }
  var found = find(textNode, topNode, offset);
  if (found) { return badPos(found, bad) }

  // FIXME this is all really shaky. might handle the few cases it needs to handle, but likely to cause problems
  for (var after = topNode.nextSibling, dist = textNode ? textNode.nodeValue.length - offset : 0; after; after = after.nextSibling) {
    found = find(after, after.firstChild, 0);
    if (found)
      { return badPos(Pos(found.line, found.ch - dist), bad) }
    else
      { dist += after.textContent.length; }
  }
  for (var before = topNode.previousSibling, dist$1 = offset; before; before = before.previousSibling) {
    found = find(before, before.firstChild, -1);
    if (found)
      { return badPos(Pos(found.line, found.ch + dist$1), bad) }
    else
      { dist$1 += before.textContent.length; }
  }
}

// TEXTAREA INPUT STYLE

var TextareaInput = function(cm) {
  this.cm = cm;
  // See input.poll and input.reset
  this.prevInput = "";

  // Flag that indicates whether we expect input to appear real soon
  // now (after some event like 'keypress' or 'input') and are
  // polling intensively.
  this.pollingFast = false;
  // Self-resetting timeout for the poller
  this.polling = new Delayed();
  // Used to work around IE issue with selection being forgotten when focus moves away from textarea
  this.hasSelection = false;
  this.composing = null;
};

TextareaInput.prototype.init = function (display) {
    var this$1 = this;

  var input = this, cm = this.cm;

  // Wraps and hides input textarea
  var div = this.wrapper = hiddenTextarea();
  // The semihidden textarea that is focused when the editor is
  // focused, and receives input.
  var te = this.textarea = div.firstChild;
  display.wrapper.insertBefore(div, display.wrapper.firstChild);

  // Needed to hide big blue blinking cursor on Mobile Safari (doesn't seem to work in iOS 8 anymore)
  if (ios) { te.style.width = "0px"; }

  on(te, "input", function () {
    if (ie && ie_version >= 9 && this$1.hasSelection) { this$1.hasSelection = null; }
    input.poll();
  });

  on(te, "paste", function (e) {
    if (signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }

    cm.state.pasteIncoming = true;
    input.fastPoll();
  });

  function prepareCopyCut(e) {
    if (signalDOMEvent(cm, e)) { return }
    if (cm.somethingSelected()) {
      setLastCopied({lineWise: false, text: cm.getSelections()});
    } else if (!cm.options.lineWiseCopyCut) {
      return
    } else {
      var ranges = copyableRanges(cm);
      setLastCopied({lineWise: true, text: ranges.text});
      if (e.type == "cut") {
        cm.setSelections(ranges.ranges, null, sel_dontScroll);
      } else {
        input.prevInput = "";
        te.value = ranges.text.join("\n");
        selectInput(te);
      }
    }
    if (e.type == "cut") { cm.state.cutIncoming = true; }
  }
  on(te, "cut", prepareCopyCut);
  on(te, "copy", prepareCopyCut);

  on(display.scroller, "paste", function (e) {
    if (eventInWidget(display, e) || signalDOMEvent(cm, e)) { return }
    cm.state.pasteIncoming = true;
    input.focus();
  });

  // Prevent normal selection in the editor (we handle our own)
  on(display.lineSpace, "selectstart", function (e) {
    if (!eventInWidget(display, e)) { e_preventDefault(e); }
  });

  on(te, "compositionstart", function () {
    var start = cm.getCursor("from");
    if (input.composing) { input.composing.range.clear(); }
    input.composing = {
      start: start,
      range: cm.markText(start, cm.getCursor("to"), {className: "CodeMirror-composing"})
    };
  });
  on(te, "compositionend", function () {
    if (input.composing) {
      input.poll();
      input.composing.range.clear();
      input.composing = null;
    }
  });
};

TextareaInput.prototype.prepareSelection = function () {
  // Redraw the selection and/or cursor
  var cm = this.cm, display = cm.display, doc = cm.doc;
  var result = prepareSelection(cm);

  // Move the hidden textarea near the cursor to prevent scrolling artifacts
  if (cm.options.moveInputWithCursor) {
    var headPos = cursorCoords(cm, doc.sel.primary().head, "div");
    var wrapOff = display.wrapper.getBoundingClientRect(), lineOff = display.lineDiv.getBoundingClientRect();
    result.teTop = Math.max(0, Math.min(display.wrapper.clientHeight - 10,
                                        headPos.top + lineOff.top - wrapOff.top));
    result.teLeft = Math.max(0, Math.min(display.wrapper.clientWidth - 10,
                                         headPos.left + lineOff.left - wrapOff.left));
  }

  return result
};

TextareaInput.prototype.showSelection = function (drawn) {
  var cm = this.cm, display = cm.display;
  removeChildrenAndAdd(display.cursorDiv, drawn.cursors);
  removeChildrenAndAdd(display.selectionDiv, drawn.selection);
  if (drawn.teTop != null) {
    this.wrapper.style.top = drawn.teTop + "px";
    this.wrapper.style.left = drawn.teLeft + "px";
  }
};

// Reset the input to correspond to the selection (or to be empty,
// when not typing and nothing is selected)
TextareaInput.prototype.reset = function (typing) {
  if (this.contextMenuPending || this.composing) { return }
  var cm = this.cm;
  if (cm.somethingSelected()) {
    this.prevInput = "";
    var content = cm.getSelection();
    this.textarea.value = content;
    if (cm.state.focused) { selectInput(this.textarea); }
    if (ie && ie_version >= 9) { this.hasSelection = content; }
  } else if (!typing) {
    this.prevInput = this.textarea.value = "";
    if (ie && ie_version >= 9) { this.hasSelection = null; }
  }
};

TextareaInput.prototype.getField = function () { return this.textarea };

TextareaInput.prototype.supportsTouch = function () { return false };

TextareaInput.prototype.focus = function () {
  if (this.cm.options.readOnly != "nocursor" && (!mobile || activeElt() != this.textarea)) {
    try { this.textarea.focus(); }
    catch (e) {} // IE8 will throw if the textarea is display: none or not in DOM
  }
};

TextareaInput.prototype.blur = function () { this.textarea.blur(); };

TextareaInput.prototype.resetPosition = function () {
  this.wrapper.style.top = this.wrapper.style.left = 0;
};

TextareaInput.prototype.receivedFocus = function () { this.slowPoll(); };

// Poll for input changes, using the normal rate of polling. This
// runs as long as the editor is focused.
TextareaInput.prototype.slowPoll = function () {
    var this$1 = this;

  if (this.pollingFast) { return }
  this.polling.set(this.cm.options.pollInterval, function () {
    this$1.poll();
    if (this$1.cm.state.focused) { this$1.slowPoll(); }
  });
};

// When an event has just come in that is likely to add or change
// something in the input textarea, we poll faster, to ensure that
// the change appears on the screen quickly.
TextareaInput.prototype.fastPoll = function () {
  var missed = false, input = this;
  input.pollingFast = true;
  function p() {
    var changed = input.poll();
    if (!changed && !missed) {missed = true; input.polling.set(60, p);}
    else {input.pollingFast = false; input.slowPoll();}
  }
  input.polling.set(20, p);
};

// Read input from the textarea, and update the document to match.
// When something is selected, it is present in the textarea, and
// selected (unless it is huge, in which case a placeholder is
// used). When nothing is selected, the cursor sits after previously
// seen text (can be empty), which is stored in prevInput (we must
// not reset the textarea when typing, because that breaks IME).
TextareaInput.prototype.poll = function () {
    var this$1 = this;

  var cm = this.cm, input = this.textarea, prevInput = this.prevInput;
  // Since this is called a *lot*, try to bail out as cheaply as
  // possible when it is clear that nothing happened. hasSelection
  // will be the case when there is a lot of text in the textarea,
  // in which case reading its value would be expensive.
  if (this.contextMenuPending || !cm.state.focused ||
      (hasSelection(input) && !prevInput && !this.composing) ||
      cm.isReadOnly() || cm.options.disableInput || cm.state.keySeq)
    { return false }

  var text = input.value;
  // If nothing changed, bail.
  if (text == prevInput && !cm.somethingSelected()) { return false }
  // Work around nonsensical selection resetting in IE9/10, and
  // inexplicable appearance of private area unicode characters on
  // some key combos in Mac (#2689).
  if (ie && ie_version >= 9 && this.hasSelection === text ||
      mac && /[\uf700-\uf7ff]/.test(text)) {
    cm.display.input.reset();
    return false
  }

  if (cm.doc.sel == cm.display.selForContextMenu) {
    var first = text.charCodeAt(0);
    if (first == 0x200b && !prevInput) { prevInput = "\u200b"; }
    if (first == 0x21da) { this.reset(); return this.cm.execCommand("undo") }
  }
  // Find the part of the input that is actually new
  var same = 0, l = Math.min(prevInput.length, text.length);
  while (same < l && prevInput.charCodeAt(same) == text.charCodeAt(same)) { ++same; }

  runInOp(cm, function () {
    applyTextInput(cm, text.slice(same), prevInput.length - same,
                   null, this$1.composing ? "*compose" : null);

    // Don't leave long text in the textarea, since it makes further polling slow
    if (text.length > 1000 || text.indexOf("\n") > -1) { input.value = this$1.prevInput = ""; }
    else { this$1.prevInput = text; }

    if (this$1.composing) {
      this$1.composing.range.clear();
      this$1.composing.range = cm.markText(this$1.composing.start, cm.getCursor("to"),
                                         {className: "CodeMirror-composing"});
    }
  });
  return true
};

TextareaInput.prototype.ensurePolled = function () {
  if (this.pollingFast && this.poll()) { this.pollingFast = false; }
};

TextareaInput.prototype.onKeyPress = function () {
  if (ie && ie_version >= 9) { this.hasSelection = null; }
  this.fastPoll();
};

TextareaInput.prototype.onContextMenu = function (e) {
  var input = this, cm = input.cm, display = cm.display, te = input.textarea;
  var pos = posFromMouse(cm, e), scrollPos = display.scroller.scrollTop;
  if (!pos || presto) { return } // Opera is difficult.

  // Reset the current text selection only if the click is done outside of the selection
  // and 'resetSelectionOnContextMenu' option is true.
  var reset = cm.options.resetSelectionOnContextMenu;
  if (reset && cm.doc.sel.contains(pos) == -1)
    { operation(cm, setSelection)(cm.doc, simpleSelection(pos), sel_dontScroll); }

  var oldCSS = te.style.cssText, oldWrapperCSS = input.wrapper.style.cssText;
  input.wrapper.style.cssText = "position: absolute";
  var wrapperBox = input.wrapper.getBoundingClientRect();
  te.style.cssText = "position: absolute; width: 30px; height: 30px;\n      top: " + (e.clientY - wrapperBox.top - 5) + "px; left: " + (e.clientX - wrapperBox.left - 5) + "px;\n      z-index: 1000; background: " + (ie ? "rgba(255, 255, 255, .05)" : "transparent") + ";\n      outline: none; border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
  var oldScrollY;
  if (webkit) { oldScrollY = window.scrollY; } // Work around Chrome issue (#2712)
  display.input.focus();
  if (webkit) { window.scrollTo(null, oldScrollY); }
  display.input.reset();
  // Adds "Select all" to context menu in FF
  if (!cm.somethingSelected()) { te.value = input.prevInput = " "; }
  input.contextMenuPending = true;
  display.selForContextMenu = cm.doc.sel;
  clearTimeout(display.detectingSelectAll);

  // Select-all will be greyed out if there's nothing to select, so
  // this adds a zero-width space so that we can later check whether
  // it got selected.
  function prepareSelectAllHack() {
    if (te.selectionStart != null) {
      var selected = cm.somethingSelected();
      var extval = "\u200b" + (selected ? te.value : "");
      te.value = "\u21da"; // Used to catch context-menu undo
      te.value = extval;
      input.prevInput = selected ? "" : "\u200b";
      te.selectionStart = 1; te.selectionEnd = extval.length;
      // Re-set this, in case some other handler touched the
      // selection in the meantime.
      display.selForContextMenu = cm.doc.sel;
    }
  }
  function rehide() {
    input.contextMenuPending = false;
    input.wrapper.style.cssText = oldWrapperCSS;
    te.style.cssText = oldCSS;
    if (ie && ie_version < 9) { display.scrollbars.setScrollTop(display.scroller.scrollTop = scrollPos); }

    // Try to detect the user choosing select-all
    if (te.selectionStart != null) {
      if (!ie || (ie && ie_version < 9)) { prepareSelectAllHack(); }
      var i = 0, poll = function () {
        if (display.selForContextMenu == cm.doc.sel && te.selectionStart == 0 &&
            te.selectionEnd > 0 && input.prevInput == "\u200b") {
          operation(cm, selectAll)(cm);
        } else if (i++ < 10) {
          display.detectingSelectAll = setTimeout(poll, 500);
        } else {
          display.selForContextMenu = null;
          display.input.reset();
        }
      };
      display.detectingSelectAll = setTimeout(poll, 200);
    }
  }

  if (ie && ie_version >= 9) { prepareSelectAllHack(); }
  if (captureRightClick) {
    e_stop(e);
    var mouseup = function () {
      off(window, "mouseup", mouseup);
      setTimeout(rehide, 20);
    };
    on(window, "mouseup", mouseup);
  } else {
    setTimeout(rehide, 50);
  }
};

TextareaInput.prototype.readOnlyChanged = function (val) {
  if (!val) { this.reset(); }
  this.textarea.disabled = val == "nocursor";
};

TextareaInput.prototype.setUneditable = function () {};

TextareaInput.prototype.needsContentAttribute = false;

function fromTextArea(textarea, options) {
  options = options ? copyObj(options) : {};
  options.value = textarea.value;
  if (!options.tabindex && textarea.tabIndex)
    { options.tabindex = textarea.tabIndex; }
  if (!options.placeholder && textarea.placeholder)
    { options.placeholder = textarea.placeholder; }
  // Set autofocus to true if this textarea is focused, or if it has
  // autofocus and no other element is focused.
  if (options.autofocus == null) {
    var hasFocus = activeElt();
    options.autofocus = hasFocus == textarea ||
      textarea.getAttribute("autofocus") != null && hasFocus == document.body;
  }

  function save() {textarea.value = cm.getValue();}

  var realSubmit;
  if (textarea.form) {
    on(textarea.form, "submit", save);
    // Deplorable hack to make the submit method do the right thing.
    if (!options.leaveSubmitMethodAlone) {
      var form = textarea.form;
      realSubmit = form.submit;
      try {
        var wrappedSubmit = form.submit = function () {
          save();
          form.submit = realSubmit;
          form.submit();
          form.submit = wrappedSubmit;
        };
      } catch(e) {}
    }
  }

  options.finishInit = function (cm) {
    cm.save = save;
    cm.getTextArea = function () { return textarea; };
    cm.toTextArea = function () {
      cm.toTextArea = isNaN; // Prevent this from being ran twice
      save();
      textarea.parentNode.removeChild(cm.getWrapperElement());
      textarea.style.display = "";
      if (textarea.form) {
        off(textarea.form, "submit", save);
        if (typeof textarea.form.submit == "function")
          { textarea.form.submit = realSubmit; }
      }
    };
  };

  textarea.style.display = "none";
  var cm = CodeMirror(function (node) { return textarea.parentNode.insertBefore(node, textarea.nextSibling); },
    options);
  return cm
}

function addLegacyProps(CodeMirror) {
  CodeMirror.off = off;
  CodeMirror.on = on;
  CodeMirror.wheelEventPixels = wheelEventPixels;
  CodeMirror.Doc = Doc;
  CodeMirror.splitLines = splitLinesAuto;
  CodeMirror.countColumn = countColumn;
  CodeMirror.findColumn = findColumn;
  CodeMirror.isWordChar = isWordCharBasic;
  CodeMirror.Pass = Pass;
  CodeMirror.signal = signal;
  CodeMirror.Line = Line;
  CodeMirror.changeEnd = changeEnd;
  CodeMirror.scrollbarModel = scrollbarModel;
  CodeMirror.Pos = Pos;
  CodeMirror.cmpPos = cmp;
  CodeMirror.modes = modes;
  CodeMirror.mimeModes = mimeModes;
  CodeMirror.resolveMode = resolveMode;
  CodeMirror.getMode = getMode;
  CodeMirror.modeExtensions = modeExtensions;
  CodeMirror.extendMode = extendMode;
  CodeMirror.copyState = copyState;
  CodeMirror.startState = startState;
  CodeMirror.innerMode = innerMode;
  CodeMirror.commands = commands;
  CodeMirror.keyMap = keyMap;
  CodeMirror.keyName = keyName;
  CodeMirror.isModifierKey = isModifierKey;
  CodeMirror.lookupKey = lookupKey;
  CodeMirror.normalizeKeyMap = normalizeKeyMap;
  CodeMirror.StringStream = StringStream;
  CodeMirror.SharedTextMarker = SharedTextMarker;
  CodeMirror.TextMarker = TextMarker;
  CodeMirror.LineWidget = LineWidget;
  CodeMirror.e_preventDefault = e_preventDefault;
  CodeMirror.e_stopPropagation = e_stopPropagation;
  CodeMirror.e_stop = e_stop;
  CodeMirror.addClass = addClass;
  CodeMirror.contains = contains;
  CodeMirror.rmClass = rmClass;
  CodeMirror.keyNames = keyNames;
}

// EDITOR CONSTRUCTOR

defineOptions(CodeMirror);

addEditorMethods(CodeMirror);

// Set up methods on CodeMirror's prototype to redirect to the editor's document.
var dontDelegate = "iter insert remove copy getEditor constructor".split(" ");
for (var prop in Doc.prototype) { if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0)
  { CodeMirror.prototype[prop] = (function(method) {
    return function() {return method.apply(this.doc, arguments)}
  })(Doc.prototype[prop]); } }

eventMixin(Doc);

// INPUT HANDLING

CodeMirror.inputStyles = {"textarea": TextareaInput, "contenteditable": ContentEditableInput};

// MODE DEFINITION AND QUERYING

// Extra arguments are stored as the mode's dependencies, which is
// used by (legacy) mechanisms like loadmode.js to automatically
// load a mode. (Preferred mechanism is the require/define calls.)
CodeMirror.defineMode = function(name/*, mode, …*/) {
  if (!CodeMirror.defaults.mode && name != "null") { CodeMirror.defaults.mode = name; }
  defineMode.apply(this, arguments);
};

CodeMirror.defineMIME = defineMIME;

// Minimal default mode.
CodeMirror.defineMode("null", function () { return ({token: function (stream) { return stream.skipToEnd(); }}); });
CodeMirror.defineMIME("text/plain", "null");

// EXTENSIONS

CodeMirror.defineExtension = function (name, func) {
  CodeMirror.prototype[name] = func;
};
CodeMirror.defineDocExtension = function (name, func) {
  Doc.prototype[name] = func;
};

CodeMirror.fromTextArea = fromTextArea;

addLegacyProps(CodeMirror);

CodeMirror.version = "5.28.0";

return CodeMirror;

})));

/*!
 * clipboard.js v1.7.1
 * https://zenorocha.github.io/clipboard.js
 *
 * Licensed MIT © Zeno Rocha
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f();}else if(typeof define==="function"&&define.amd){define([],f);}else{var g;if(typeof window!=="undefined"){g=window;}else if(typeof global!=="undefined"){g=global;}else if(typeof self!=="undefined"){g=self;}else{g=this;}g.Clipboard = f();}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var DOCUMENT_NODE_TYPE = 9;

/**
 * A polyfill for Element.matches()
 */
if (typeof Element !== 'undefined' && !Element.prototype.matches) {
    var proto = Element.prototype;

    proto.matches = proto.matchesSelector ||
                    proto.mozMatchesSelector ||
                    proto.msMatchesSelector ||
                    proto.oMatchesSelector ||
                    proto.webkitMatchesSelector;
}

/**
 * Finds the closest parent that matches a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @return {Function}
 */
function closest (element, selector) {
    while (element && element.nodeType !== DOCUMENT_NODE_TYPE) {
        if (typeof element.matches === 'function' &&
            element.matches(selector)) {
          return element;
        }
        element = element.parentNode;
    }
}

module.exports = closest;

},{}],2:[function(require,module,exports){
var closest = require('./closest');

/**
 * Delegates event to a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @param {Boolean} useCapture
 * @return {Object}
 */
function delegate(element, selector, type, callback, useCapture) {
    var listenerFn = listener.apply(this, arguments);

    element.addEventListener(type, listenerFn, useCapture);

    return {
        destroy: function() {
            element.removeEventListener(type, listenerFn, useCapture);
        }
    }
}

/**
 * Finds closest match and invokes callback.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Function}
 */
function listener(element, selector, type, callback) {
    return function(e) {
        e.delegateTarget = closest(e.target, selector);

        if (e.delegateTarget) {
            callback.call(element, e);
        }
    }
}

module.exports = delegate;

},{"./closest":1}],3:[function(require,module,exports){
/**
 * Check if argument is a HTML element.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.node = function(value) {
    return value !== undefined
        && (value instanceof HTMLElement || value instanceof SVGElement)
        && value.nodeType === 1;
};

/**
 * Check if argument is a list of HTML elements.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.nodeList = function(value) {
    var type = Object.prototype.toString.call(value);

    return value !== undefined
        && (type === '[object NodeList]' || type === '[object HTMLCollection]')
        && ('length' in value)
        && (value.length === 0 || exports.node(value[0]));
};

/**
 * Check if argument is a string.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.string = function(value) {
    return typeof value === 'string'
        || value instanceof String;
};

/**
 * Check if argument is a function.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.fn = function(value) {
    var type = Object.prototype.toString.call(value);

    return type === '[object Function]';
};

},{}],4:[function(require,module,exports){
var is = require('./is');
var delegate = require('delegate');

/**
 * Validates all params and calls the right
 * listener function based on its target type.
 *
 * @param {String|HTMLElement|HTMLCollection|NodeList} target
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listen(target, type, callback) {
    if (!target && !type && !callback) {
        throw new Error('Missing required arguments');
    }

    if (!is.string(type)) {
        throw new TypeError('Second argument must be a String');
    }

    if (!is.fn(callback)) {
        throw new TypeError('Third argument must be a Function');
    }

    if (is.node(target)) {
        return listenNode(target, type, callback);
    }
    else if (is.nodeList(target)) {
        return listenNodeList(target, type, callback);
    }
    else if (is.string(target)) {
        return listenSelector(target, type, callback);
    }
    else {
        throw new TypeError('First argument must be a String, HTMLElement, HTMLCollection, or NodeList');
    }
}

/**
 * Adds an event listener to a HTML element
 * and returns a remove listener function.
 *
 * @param {HTMLElement} node
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNode(node, type, callback) {
    node.addEventListener(type, callback);

    return {
        destroy: function() {
            node.removeEventListener(type, callback);
        }
    }
}

/**
 * Add an event listener to a list of HTML elements
 * and returns a remove listener function.
 *
 * @param {NodeList|HTMLCollection} nodeList
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNodeList(nodeList, type, callback) {
    Array.prototype.forEach.call(nodeList, function(node) {
        node.addEventListener(type, callback);
    });

    return {
        destroy: function() {
            Array.prototype.forEach.call(nodeList, function(node) {
                node.removeEventListener(type, callback);
            });
        }
    }
}

/**
 * Add an event listener to a selector
 * and returns a remove listener function.
 *
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenSelector(selector, type, callback) {
    return delegate(document.body, selector, type, callback);
}

module.exports = listen;

},{"./is":3,"delegate":2}],5:[function(require,module,exports){
function select(element) {
    var selectedText;

    if (element.nodeName === 'SELECT') {
        element.focus();

        selectedText = element.value;
    }
    else if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        var isReadOnly = element.hasAttribute('readonly');

        if (!isReadOnly) {
            element.setAttribute('readonly', '');
        }

        element.select();
        element.setSelectionRange(0, element.value.length);

        if (!isReadOnly) {
            element.removeAttribute('readonly');
        }

        selectedText = element.value;
    }
    else {
        if (element.hasAttribute('contenteditable')) {
            element.focus();
        }

        var selection = window.getSelection();
        var range = document.createRange();

        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        selectedText = selection.toString();
    }

    return selectedText;
}

module.exports = select;

},{}],6:[function(require,module,exports){
function E () {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    }

    listener._ = callback;
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}],7:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'select'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('select'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.select);
        global.clipboardAction = mod.exports;
    }
})(this, function (module, _select) {
    'use strict';

    var _select2 = _interopRequireDefault(_select);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    var ClipboardAction = function () {
        /**
         * @param {Object} options
         */
        function ClipboardAction(options) {
            _classCallCheck(this, ClipboardAction);

            this.resolveOptions(options);
            this.initSelection();
        }

        /**
         * Defines base properties passed from constructor.
         * @param {Object} options
         */


        _createClass(ClipboardAction, [{
            key: 'resolveOptions',
            value: function resolveOptions() {
                var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

                this.action = options.action;
                this.container = options.container;
                this.emitter = options.emitter;
                this.target = options.target;
                this.text = options.text;
                this.trigger = options.trigger;

                this.selectedText = '';
            }
        }, {
            key: 'initSelection',
            value: function initSelection() {
                if (this.text) {
                    this.selectFake();
                } else if (this.target) {
                    this.selectTarget();
                }
            }
        }, {
            key: 'selectFake',
            value: function selectFake() {
                var _this = this;

                var isRTL = document.documentElement.getAttribute('dir') == 'rtl';

                this.removeFake();

                this.fakeHandlerCallback = function () {
                    return _this.removeFake();
                };
                this.fakeHandler = this.container.addEventListener('click', this.fakeHandlerCallback) || true;

                this.fakeElem = document.createElement('textarea');
                // Prevent zooming on iOS
                this.fakeElem.style.fontSize = '12pt';
                // Reset box model
                this.fakeElem.style.border = '0';
                this.fakeElem.style.padding = '0';
                this.fakeElem.style.margin = '0';
                // Move element out of screen horizontally
                this.fakeElem.style.position = 'absolute';
                this.fakeElem.style[isRTL ? 'right' : 'left'] = '-9999px';
                // Move element to the same position vertically
                var yPosition = window.pageYOffset || document.documentElement.scrollTop;
                this.fakeElem.style.top = yPosition + 'px';

                this.fakeElem.setAttribute('readonly', '');
                this.fakeElem.value = this.text;

                this.container.appendChild(this.fakeElem);

                this.selectedText = (0, _select2.default)(this.fakeElem);
                this.copyText();
            }
        }, {
            key: 'removeFake',
            value: function removeFake() {
                if (this.fakeHandler) {
                    this.container.removeEventListener('click', this.fakeHandlerCallback);
                    this.fakeHandler = null;
                    this.fakeHandlerCallback = null;
                }

                if (this.fakeElem) {
                    this.container.removeChild(this.fakeElem);
                    this.fakeElem = null;
                }
            }
        }, {
            key: 'selectTarget',
            value: function selectTarget() {
                this.selectedText = (0, _select2.default)(this.target);
                this.copyText();
            }
        }, {
            key: 'copyText',
            value: function copyText() {
                var succeeded = void 0;

                try {
                    succeeded = document.execCommand(this.action);
                } catch (err) {
                    succeeded = false;
                }

                this.handleResult(succeeded);
            }
        }, {
            key: 'handleResult',
            value: function handleResult(succeeded) {
                this.emitter.emit(succeeded ? 'success' : 'error', {
                    action: this.action,
                    text: this.selectedText,
                    trigger: this.trigger,
                    clearSelection: this.clearSelection.bind(this)
                });
            }
        }, {
            key: 'clearSelection',
            value: function clearSelection() {
                if (this.trigger) {
                    this.trigger.focus();
                }

                window.getSelection().removeAllRanges();
            }
        }, {
            key: 'destroy',
            value: function destroy() {
                this.removeFake();
            }
        }, {
            key: 'action',
            set: function set() {
                var action = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'copy';

                this._action = action;

                if (this._action !== 'copy' && this._action !== 'cut') {
                    throw new Error('Invalid "action" value, use either "copy" or "cut"');
                }
            },
            get: function get() {
                return this._action;
            }
        }, {
            key: 'target',
            set: function set(target) {
                if (target !== undefined) {
                    if (target && (typeof target === 'undefined' ? 'undefined' : _typeof(target)) === 'object' && target.nodeType === 1) {
                        if (this.action === 'copy' && target.hasAttribute('disabled')) {
                            throw new Error('Invalid "target" attribute. Please use "readonly" instead of "disabled" attribute');
                        }

                        if (this.action === 'cut' && (target.hasAttribute('readonly') || target.hasAttribute('disabled'))) {
                            throw new Error('Invalid "target" attribute. You can\'t cut text from elements with "readonly" or "disabled" attributes');
                        }

                        this._target = target;
                    } else {
                        throw new Error('Invalid "target" value, use a valid Element');
                    }
                }
            },
            get: function get() {
                return this._target;
            }
        }]);

        return ClipboardAction;
    }();

    module.exports = ClipboardAction;
});

},{"select":5}],8:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './clipboard-action', 'tiny-emitter', 'good-listener'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./clipboard-action'), require('tiny-emitter'), require('good-listener'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.clipboardAction, global.tinyEmitter, global.goodListener);
        global.clipboard = mod.exports;
    }
})(this, function (module, _clipboardAction, _tinyEmitter, _goodListener) {
    'use strict';

    var _clipboardAction2 = _interopRequireDefault(_clipboardAction);

    var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

    var _goodListener2 = _interopRequireDefault(_goodListener);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    var Clipboard = function (_Emitter) {
        _inherits(Clipboard, _Emitter);

        /**
         * @param {String|HTMLElement|HTMLCollection|NodeList} trigger
         * @param {Object} options
         */
        function Clipboard(trigger, options) {
            _classCallCheck(this, Clipboard);

            var _this = _possibleConstructorReturn(this, (Clipboard.__proto__ || Object.getPrototypeOf(Clipboard)).call(this));

            _this.resolveOptions(options);
            _this.listenClick(trigger);
            return _this;
        }

        /**
         * Defines if attributes would be resolved using internal setter functions
         * or custom functions that were passed in the constructor.
         * @param {Object} options
         */


        _createClass(Clipboard, [{
            key: 'resolveOptions',
            value: function resolveOptions() {
                var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

                this.action = typeof options.action === 'function' ? options.action : this.defaultAction;
                this.target = typeof options.target === 'function' ? options.target : this.defaultTarget;
                this.text = typeof options.text === 'function' ? options.text : this.defaultText;
                this.container = _typeof(options.container) === 'object' ? options.container : document.body;
            }
        }, {
            key: 'listenClick',
            value: function listenClick(trigger) {
                var _this2 = this;

                this.listener = (0, _goodListener2.default)(trigger, 'click', function (e) {
                    return _this2.onClick(e);
                });
            }
        }, {
            key: 'onClick',
            value: function onClick(e) {
                var trigger = e.delegateTarget || e.currentTarget;

                if (this.clipboardAction) {
                    this.clipboardAction = null;
                }

                this.clipboardAction = new _clipboardAction2.default({
                    action: this.action(trigger),
                    target: this.target(trigger),
                    text: this.text(trigger),
                    container: this.container,
                    trigger: trigger,
                    emitter: this
                });
            }
        }, {
            key: 'defaultAction',
            value: function defaultAction(trigger) {
                return getAttributeValue('action', trigger);
            }
        }, {
            key: 'defaultTarget',
            value: function defaultTarget(trigger) {
                var selector = getAttributeValue('target', trigger);

                if (selector) {
                    return document.querySelector(selector);
                }
            }
        }, {
            key: 'defaultText',
            value: function defaultText(trigger) {
                return getAttributeValue('text', trigger);
            }
        }, {
            key: 'destroy',
            value: function destroy() {
                this.listener.destroy();

                if (this.clipboardAction) {
                    this.clipboardAction.destroy();
                    this.clipboardAction = null;
                }
            }
        }], [{
            key: 'isSupported',
            value: function isSupported() {
                var action = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ['copy', 'cut'];

                var actions = typeof action === 'string' ? [action] : action;
                var support = !!document.queryCommandSupported;

                actions.forEach(function (action) {
                    support = support && !!document.queryCommandSupported(action);
                });

                return support;
            }
        }]);

        return Clipboard;
    }(_tinyEmitter2.default);

    /**
     * Helper function to retrieve attribute value.
     * @param {String} suffix
     * @param {Element} element
     */
    function getAttributeValue(suffix, element) {
        var attribute = 'data-clipboard-' + suffix;

        if (!element.hasAttribute(attribute)) {
            return;
        }

        return element.getAttribute(attribute);
    }

    module.exports = Clipboard;
});

},{"./clipboard-action":7,"good-listener":4,"tiny-emitter":6}]},{},[8])(8)
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();





var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};



var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};









var taggedTemplateLiteral = function (strings, raw) {
  return Object.freeze(Object.defineProperties(strings, {
    raw: {
      value: Object.freeze(raw)
    }
  }));
};

/*
* Event
* Visit http://createjs.com/ for documentation, updates and examples.
*
* Copyright (c) 2010 gskinner.com, inc.
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * A collection of Classes that are shared across all the CreateJS libraries.  The classes are included in the minified
 * files of each library and are available on the createjs namespace directly.
 *
 * <h4>Example</h4>
 *
 *      myObject.addEventListener("change", createjs.proxy(myMethod, scope));
 *
 * @module CreateJS
 * @main CreateJS
 */

/**
 * Contains properties and methods shared by all events for use with
 * {{#crossLink "EventDispatcher"}}{{/crossLink}}.
 * 
 * Note that Event objects are often reused, so you should never
 * rely on an event object's state outside of the call stack it was received in.
 * @class Event
 * @param {String} type The event type.
 * @param {Boolean} bubbles Indicates whether the event will bubble through the display list.
 * @param {Boolean} cancelable Indicates whether the default behaviour of this event can be cancelled.
 * @constructor
 **/
var Event = function () {
	function Event(type, bubbles, cancelable) {
		classCallCheck(this, Event);

		// public properties:
		/**
   * The type of event.
   * @property type
   * @type String
   **/
		this.type = type;

		/**
   * The object that generated an event.
   * @property target
   * @type Object
   * @default null
   * @readonly
  */
		this.target = null;

		/**
   * The current target that a bubbling event is being dispatched from. For non-bubbling events, this will
   * always be the same as target. For example, if childObj.parent = parentObj, and a bubbling event
   * is generated from childObj, then a listener on parentObj would receive the event with
   * target=childObj (the original target) and currentTarget=parentObj (where the listener was added).
   * @property currentTarget
   * @type Object
   * @default null
   * @readonly
  */
		this.currentTarget = null;

		/**
   * For bubbling events, this indicates the current event phase:<OL>
   * 	<LI> capture phase: starting from the top parent to the target</LI>
   * 	<LI> at target phase: currently being dispatched from the target</LI>
   * 	<LI> bubbling phase: from the target to the top parent</LI>
   * </OL>
   * @property eventPhase
   * @type Number
   * @default 0
   * @readonly
  */
		this.eventPhase = 0;

		/**
   * Indicates whether the event will bubble through the display list.
   * @property bubbles
   * @type Boolean
   * @default false
   * @readonly
  */
		this.bubbles = !!bubbles;

		/**
   * Indicates whether the default behaviour of this event can be cancelled via
   * {{#crossLink "Event/preventDefault"}}{{/crossLink}}. This is set via the Event constructor.
   * @property cancelable
   * @type Boolean
   * @default false
   * @readonly
  */
		this.cancelable = !!cancelable;

		/**
   * The epoch time at which this event was created.
   * @property timeStamp
   * @type Number
   * @default 0
   * @readonly
  */
		this.timeStamp = new Date().getTime();

		/**
   * Indicates if {{#crossLink "Event/preventDefault"}}{{/crossLink}} has been called
   * on this event.
   * @property defaultPrevented
   * @type Boolean
   * @default false
   * @readonly
  */
		this.defaultPrevented = false;

		/**
   * Indicates if {{#crossLink "Event/stopPropagation"}}{{/crossLink}} or
   * {{#crossLink "Event/stopImmediatePropagation"}}{{/crossLink}} has been called on this event.
   * @property propagationStopped
   * @type Boolean
   * @default false
   * @readonly
  */
		this.propagationStopped = false;

		/**
   * Indicates if {{#crossLink "Event/stopImmediatePropagation"}}{{/crossLink}} has been called
   * on this event.
   * @property immediatePropagationStopped
   * @type Boolean
   * @default false
   * @readonly
  */
		this.immediatePropagationStopped = false;

		/**
   * Indicates if {{#crossLink "Event/remove"}}{{/crossLink}} has been called on this event.
   * @property removed
   * @type Boolean
   * @default false
   * @readonly
  */
		this.removed = false;
	}

	// public methods:
	/**
  * Sets {{#crossLink "Event/defaultPrevented"}}{{/crossLink}} to true if the event is cancelable.
  * Mirrors the DOM level 2 event standard. In general, cancelable events that have `preventDefault()` called will
  * cancel the default behaviour associated with the event.
  * @method preventDefault
  **/


	createClass(Event, [{
		key: "preventDefault",
		value: function preventDefault() {
			this.defaultPrevented = this.cancelable && true;
		}
	}, {
		key: "stopPropagation",


		/**
   * Sets {{#crossLink "Event/propagationStopped"}}{{/crossLink}} to true.
   * Mirrors the DOM event standard.
   * @method stopPropagation
   **/
		value: function stopPropagation() {
			this.propagationStopped = true;
		}
	}, {
		key: "stopImmediatePropagation",


		/**
   * Sets {{#crossLink "Event/propagationStopped"}}{{/crossLink}} and
   * {{#crossLink "Event/immediatePropagationStopped"}}{{/crossLink}} to true.
   * Mirrors the DOM event standard.
   * @method stopImmediatePropagation
   **/
		value: function stopImmediatePropagation() {
			this.immediatePropagationStopped = this.propagationStopped = true;
		}
	}, {
		key: "remove",


		/**
   * Causes the active listener to be removed via removeEventListener();
   * 
   * 		myBtn.addEventListener("click", function(evt) {
   * 			// do stuff...
   * 			evt.remove(); // removes this listener.
   * 		});
   * 
   * @method remove
   **/
		value: function remove() {
			this.removed = true;
		}
	}, {
		key: "clone",


		/**
   * Returns a clone of the Event instance.
   * @method clone
   * @return {Event} a clone of the Event instance.
   **/
		value: function clone() {
			return new Event(this.type, this.bubbles, this.cancelable);
		}
	}, {
		key: "set",


		/**
   * Provides a chainable shortcut method for setting a number of properties on the instance.
   *
   * @method set
   * @param {Object} props A generic object containing properties to copy to the instance.
   * @return {Event} Returns the instance the method is called on (useful for chaining calls.)
   * @chainable
  */
		value: function set$$1(props) {
			for (var n in props) {
				this[n] = props[n];
			}
			return this;
		}
	}, {
		key: "toString",


		/**
   * Returns a string representation of this object.
   * @method toString
   * @return {String} a string representation of the instance.
   **/
		value: function toString() {
			return "[Event (type=" + this.type + ")]";
		}
	}]);
	return Event;
}();

/*
* EventDispatcher
* Visit http://createjs.com/ for documentation, updates and examples.
*
* Copyright (c) 2010 gskinner.com, inc.
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
*/

// constructor:
/**
* EventDispatcher provides methods for managing queues of event listeners and dispatching events.
*
* You can either extend EventDispatcher or mix its methods into an existing prototype or instance by using the
* EventDispatcher {{#crossLink "EventDispatcher/initialize"}}{{/crossLink}} method.
* 
* Together with the CreateJS Event class, EventDispatcher provides an extended event model that is based on the
* DOM Level 2 event model, including addEventListener, removeEventListener, and dispatchEvent. It supports
* bubbling / capture, preventDefault, stopPropagation, stopImmediatePropagation, and handleEvent.
* 
* EventDispatcher also exposes a {{#crossLink "EventDispatcher/on"}}{{/crossLink}} method, which makes it easier
* to create scoped listeners, listeners that only run once, and listeners with associated arbitrary data. The 
* {{#crossLink "EventDispatcher/off"}}{{/crossLink}} method is merely an alias to
* {{#crossLink "EventDispatcher/removeEventListener"}}{{/crossLink}}.
* 
* Another addition to the DOM Level 2 model is the {{#crossLink "EventDispatcher/removeAllEventListeners"}}{{/crossLink}}
* method, which can be used to listeners for all events, or listeners for a specific event. The Event object also 
* includes a {{#crossLink "Event/remove"}}{{/crossLink}} method which removes the active listener.
*
* <h4>Example</h4>
* Add EventDispatcher capabilities to the "MyClass" class.
*
*      EventDispatcher.initialize(MyClass.prototype);
*
* Add an event (see {{#crossLink "EventDispatcher/addEventListener"}}{{/crossLink}}).
*
*      instance.addEventListener("eventName", handlerMethod);
*      function handlerMethod(event) {
*          console.log(event.target + " Was Clicked");
*      }
*
* <b>Maintaining proper scope</b><br />
* Scope (ie. "this") can be be a challenge with events. Using the {{#crossLink "EventDispatcher/on"}}{{/crossLink}}
* method to subscribe to events simplifies this.
*
*      instance.addEventListener("click", function(event) {
*          console.log(instance == this); // false, scope is ambiguous.
*      });
*      
*      instance.on("click", function(event) {
*          console.log(instance == this); // true, "on" uses dispatcher scope by default.
*      });
* 
* If you want to use addEventListener instead, you may want to use function.bind() or a similar proxy to manage
* scope.
*
* <b>Browser support</b>
* The event model in CreateJS can be used separately from the suite in any project, however the inheritance model
* requires modern browsers (IE9+).
*      
*
* @class EventDispatcher
* @constructor
**/
var EventDispatcher = function () {
	function EventDispatcher() {
		classCallCheck(this, EventDispatcher);

		// private properties:
		/**
   * @protected
   * @property _listeners
   * @type Object
   **/
		this._listeners = null;

		/**
   * @protected
   * @property _captureListeners
   * @type Object
   **/
		this._captureListeners = null;

		/**
   * A shortcut to the removeEventListener method, with the same parameters and return value. This is a companion to the
   * .on method.
   * 
   * <b>IMPORTANT:</b> To remove a listener added with `on`, you must pass in the returned wrapper function as the listener. See 
   * {{#crossLink "EventDispatcher/on"}}{{/crossLink}} for an example.
   *
   * @method off
   * @param {String} type The string type of the event.
   * @param {Function | Object} listener The listener function or object.
   * @param {Boolean} [useCapture] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
   **/
		this.off = this.removeEventListener;
	}

	// static public methods:
	/**
  * Static initializer to mix EventDispatcher methods into a target object or prototype.
  * 
  * 		EventDispatcher.initialize(MyClass.prototype); // add to the prototype of the class
  * 		EventDispatcher.initialize(myObject); // add to a specific instance
  * 
  * @method initialize
  * @static
  * @param {Object} target The target object to inject EventDispatcher methods into. This can be an instance or a
  * prototype.
  **/


	createClass(EventDispatcher, [{
		key: "addEventListener",


		// public methods:
		/**
   * Adds the specified event listener. Note that adding multiple listeners to the same function will result in
   * multiple callbacks getting fired.
   *
   * <h4>Example</h4>
   *
   *      displayObject.addEventListener("click", handleClick);
   *      function handleClick(event) {
   *         // Click happened.
   *      }
   *
   * @method addEventListener
   * @param {String} type The string type of the event.
   * @param {Function | Object} listener An object with a handleEvent method, or a function that will be called when
   * the event is dispatched.
   * @param {Boolean} [useCapture] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
   * @return {Function | Object} Returns the listener for chaining or assignment.
   **/
		value: function addEventListener(type, listener, useCapture) {
			var listeners = void 0;
			if (useCapture) {
				listeners = this._captureListeners = this._captureListeners || {};
			} else {
				listeners = this._listeners = this._listeners || {};
			}
			var arr = listeners[type];
			if (arr) {
				this.removeEventListener(type, listener, useCapture);
			}
			arr = listeners[type]; // remove may have deleted the array
			if (!arr) {
				listeners[type] = [listener];
			} else {
				arr.push(listener);
			}
			return listener;
		}
	}, {
		key: "on",


		/**
   * A shortcut method for using addEventListener that makes it easier to specify an execution scope, have a listener
   * only run once, associate arbitrary data with the listener, and remove the listener.
   * 
   * This method works by creating an anonymous wrapper function and subscribing it with addEventListener.
   * The wrapper function is returned for use with `removeEventListener` (or `off`).
   * 
   * <b>IMPORTANT:</b> To remove a listener added with `on`, you must pass in the returned wrapper function as the listener, or use
   * {{#crossLink "Event/remove"}}{{/crossLink}}. Likewise, each time you call `on` a NEW wrapper function is subscribed, so multiple calls
   * to `on` with the same params will create multiple listeners.
   * 
   * <h4>Example</h4>
   * 
   * 		var listener = myBtn.on("click", handleClick, null, false, {count:3});
   * 		function handleClick(evt, data) {
   * 			data.count -= 1;
   * 			console.log(this == myBtn); // true - scope defaults to the dispatcher
   * 			if (data.count == 0) {
   * 				alert("clicked 3 times!");
   * 				myBtn.off("click", listener);
   * 				// alternately: evt.remove();
   * 			}
   * 		}
   * 
   * @method on
   * @param {String} type The string type of the event.
   * @param {Function | Object} listener An object with a handleEvent method, or a function that will be called when
   * the event is dispatched.
   * @param {Object} [scope] The scope to execute the listener in. Defaults to the dispatcher/currentTarget for function listeners, and to the listener itself for object listeners (ie. using handleEvent).
   * @param {Boolean} [once=false] If true, the listener will remove itself after the first time it is triggered.
   * @param {*} [data] Arbitrary data that will be included as the second parameter when the listener is called.
   * @param {Boolean} [useCapture=false] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
   * @return {Function} Returns the anonymous function that was created and assigned as the listener. This is needed to remove the listener later using .removeEventListener.
   **/
		value: function on(type, listener, scope, once, data, useCapture) {
			if (listener.handleEvent) {
				scope = scope || listener;
				listener = listener.handleEvent;
			}
			scope = scope || this;
			return this.addEventListener(type, function (evt) {
				listener.call(scope, evt, data);
				once && evt.remove();
			}, useCapture);
		}
	}, {
		key: "removeEventListener",


		/**
   * Removes the specified event listener.
   *
   * <b>Important Note:</b> that you must pass the exact function reference used when the event was added. If a proxy
   * function, or function closure is used as the callback, the proxy/closure reference must be used - a new proxy or
   * closure will not work.
   *
   * <h4>Example</h4>
   *
   *      displayObject.removeEventListener("click", handleClick);
   *
   * @method removeEventListener
   * @param {String} type The string type of the event.
   * @param {Function | Object} listener The listener function or object.
   * @param {Boolean} [useCapture] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
   **/
		value: function removeEventListener(type, listener, useCapture) {
			var listeners = useCapture ? this._captureListeners : this._listeners;
			if (!listeners) {
				return;
			}
			var arr = listeners[type];
			if (!arr) {
				return;
			}
			for (var i = 0, l = arr.length; i < l; i++) {
				if (arr[i] === listener) {
					if (l == 1) {
						delete listeners[type];
					} // allows for faster checks.
					else {
							arr.splice(i, 1);
						}
					break;
				}
			}
		}
	}, {
		key: "removeAllEventListeners",


		/**
   * Removes all listeners for the specified type, or all listeners of all types.
   *
   * <h4>Example</h4>
   *
   *      // Remove all listeners
   *      displayObject.removeAllEventListeners();
   *
   *      // Remove all click listeners
   *      displayObject.removeAllEventListeners("click");
   *
   * @method removeAllEventListeners
   * @param {String} [type] The string type of the event. If omitted, all listeners for all types will be removed.
   **/
		value: function removeAllEventListeners(type) {
			if (!type) {
				this._listeners = this._captureListeners = null;
			} else {
				if (this._listeners) {
					delete this._listeners[type];
				}
				if (this._captureListeners) {
					delete this._captureListeners[type];
				}
			}
		}
	}, {
		key: "dispatchEvent",


		/**
   * Dispatches the specified event to all listeners.
   *
   * <h4>Example</h4>
   *
   *      // Use a string event
   *      this.dispatchEvent("complete");
   *
   *      // Use an Event instance
   *      var event = new Event("progress");
   *      this.dispatchEvent(event);
   *
   * @method dispatchEvent
   * @param {Object | String | Event} eventObj An object with a "type" property, or a string type.
   * While a generic object will work, it is recommended to use a CreateJS Event instance. If a string is used,
   * dispatchEvent will construct an Event instance if necessary with the specified type. This latter approach can
   * be used to avoid event object instantiation for non-bubbling events that may not have any listeners.
   * @param {Boolean} [bubbles] Specifies the `bubbles` value when a string was passed to eventObj.
   * @param {Boolean} [cancelable] Specifies the `cancelable` value when a string was passed to eventObj.
   * @return {Boolean} Returns false if `preventDefault()` was called on a cancelable event, true otherwise.
   **/
		value: function dispatchEvent(eventObj, bubbles, cancelable) {
			if (typeof eventObj == "string") {
				// skip everything if there's no listeners and it doesn't bubble:
				var listeners = this._listeners;
				if (!bubbles && (!listeners || !listeners[eventObj])) {
					return true;
				}
				eventObj = new Event(eventObj, bubbles, cancelable);
			} else if (eventObj.target && eventObj.clone) {
				// redispatching an active event object, so clone it:
				eventObj = eventObj.clone();
			}

			// TODO: it would be nice to eliminate this. Maybe in favour of evtObj instanceof Event? Or !!evtObj.createEvent
			try {
				eventObj.target = this;
			} catch (e) {} // try/catch allows redispatching of native events

			if (!eventObj.bubbles || !this.parent) {
				this._dispatchEvent(eventObj, 2);
			} else {
				var top = this,
				    list = [top];
				while (top.parent) {
					list.push(top = top.parent);
				}
				var i = void 0,
				    l = list.length;

				// capture & atTarget
				for (i = l - 1; i >= 0 && !eventObj.propagationStopped; i--) {
					list[i]._dispatchEvent(eventObj, 1 + (i == 0));
				}
				// bubbling
				for (i = 1; i < l && !eventObj.propagationStopped; i++) {
					list[i]._dispatchEvent(eventObj, 3);
				}
			}
			return !eventObj.defaultPrevented;
		}
	}, {
		key: "hasEventListener",


		/**
   * Indicates whether there is at least one listener for the specified event type.
   * @method hasEventListener
   * @param {String} type The string type of the event.
   * @return {Boolean} Returns true if there is at least one listener for the specified event.
   **/
		value: function hasEventListener(type) {
			var listeners = this._listeners,
			    captureListeners = this._captureListeners;
			return !!(listeners && listeners[type] || captureListeners && captureListeners[type]);
		}
	}, {
		key: "willTrigger",


		/**
   * Indicates whether there is at least one listener for the specified event type on this object or any of its
   * ancestors (parent, parent's parent, etc). A return value of true indicates that if a bubbling event of the
   * specified type is dispatched from this object, it will trigger at least one listener.
   * 
   * This is similar to {{#crossLink "EventDispatcher/hasEventListener"}}{{/crossLink}}, but it searches the entire
   * event flow for a listener, not just this object.
   * @method willTrigger
   * @param {String} type The string type of the event.
   * @return {Boolean} Returns `true` if there is at least one listener for the specified event.
   **/
		value: function willTrigger(type) {
			var o = this;
			while (o) {
				if (o.hasEventListener(type)) {
					return true;
				}
				o = o.parent;
			}
			return false;
		}
	}, {
		key: "toString",


		/**
   * @method toString
   * @return {String} a string representation of the instance.
   **/
		value: function toString() {
			return "[EventDispatcher]";
		}
	}, {
		key: "_dispatchEvent",


		// private methods:
		/**
   * @method _dispatchEvent
   * @param {Object | Event} eventObj
   * @param {Object} eventPhase
   * @protected
   **/
		value: function _dispatchEvent(eventObj, eventPhase) {
			var l = void 0,
			    arr = void 0,
			    listeners = eventPhase <= 2 ? this._captureListeners : this._listeners;
			if (eventObj && listeners && (arr = listeners[eventObj.type]) && (l = arr.length)) {
				try {
					eventObj.currentTarget = this;
				} catch (e) {}
				try {
					eventObj.eventPhase = eventPhase | 0;
				} catch (e) {}
				eventObj.removed = false;

				arr = arr.slice(); // to avoid issues with items being removed or added during the dispatch
				for (var i = 0; i < l && !eventObj.immediatePropagationStopped; i++) {
					var o = arr[i];
					if (o.handleEvent) {
						o.handleEvent(eventObj);
					} else {
						o(eventObj);
					}
					if (eventObj.removed) {
						this.off(eventObj.type, o, eventPhase == 1);
						eventObj.removed = false;
					}
				}
			}
			if (eventPhase === 2) {
				this._dispatchEvent(eventObj, 2.1);
			}
		}
	}], [{
		key: "EventDispatcher",
		value: function EventDispatcher(target) {
			target.addEventListener = p.addEventListener;
			target.on = p.on;
			target.removeEventListener = target.off = p.removeEventListener;
			target.removeAllEventListeners = p.removeAllEventListeners;
			target.hasEventListener = p.hasEventListener;
			target.dispatchEvent = p.dispatchEvent;
			target._dispatchEvent = p._dispatchEvent;
			target.willTrigger = p.willTrigger;
		}
	}]);
	return EventDispatcher;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var DOMUtils = {};
var $ = DOMUtils;
$.query = function (query) {
	var element = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : document.body;

	return query[0] === ">" ? $._childQuery(query, element, $.query) : element.querySelector(query);
};

$.queryAll = function (query) {
	var element = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : document.body;

	return query[0] === ">" ? $._childQuery(query, element, $.queryAll) : element.querySelectorAll(query);
};

$.removeClass = function (element, className) {
	if ($._runOnNodeList($.removeClass, element, className)) {
		return element;
	}
	if (className instanceof RegExp) {
		var arr = (element.getAttribute("class") || "").split(" "),
		    re = className;
		element.setAttribute("class", arr.filter(function (s) {
			return !re.test(s);
		}).join(" "));
	} else {
		var list = element.classList;
		list.remove.apply(list, className.split(" "));
	}
	return element;
};

$.addClass = function (element, className) {
	if ($._runOnNodeList($.addClass, element, className)) {
		return element;
	}

	$.removeClass(element, className);

	var names = className.split(" ");
	for (var i = 0; i < names.length; i++) {
		element.classList.add(names[i]);
	}
	return element;
};

$.toggleClass = function (element, className, value) {
	if ($._runOnNodeList($.toggleClass, element, className, value)) {
		return element;
	}
	var curValue = $.hasClass(element, className);
	if (value == null) {
		value = !curValue;
	} else if (value === curValue) {
		return;
	}
	if (value) {
		$.addClass(element, className);
	} else {
		$.removeClass(element, className);
	}
};

$.hasClass = function (element, className) {
	return !!(element.getAttribute("class") || "").match(new RegExp("\\b\\s?" + className + "\\b", "g"));
};

$.swapClass = function (element, oldClass, newClass) {
	$.removeClass(element, oldClass);
	$.addClass(element, newClass);
	return element;
};

$.remove = function (element) {
	if ($._runOnNodeList($.remove, element)) {
		return element;
	}

	if (element.remove) {
		element.remove();
	} else if (element.parentNode) {
		element.parentNode.removeChild(element);
	}
	return element;
};

/*
 Remove all children from an element.
 When using .innerHTML = ""; IE fails when adding new dom elements via appendChild();
 */
$.empty = function (element) {
	if ($._runOnNodeList($.empty, element)) {
		return element;
	}

	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
	return element;
};

$.create = function (type, className, content, parent) {
	var element = document.createElement(type || "div");
	if (className) {
		element.className = className;
	}
	if (content) {
		element.innerHTML = content;
	}
	if (parent) {
		parent.appendChild(element);
	}
	return element;
};

$.getEl = function (query, scope) {
	if (query instanceof HTMLElement || !query) {
		return query;
	}
	return $.query(query, scope);
};

$.togglePanel = function (element, openEl, closedEl, open) {
	var el1 = $.getEl(openEl, element),
	    el2 = $.getEl(closedEl, element),
	    tmp = void 0,
	    isOpen = !$.hasClass(element, "closed");
	if (open === undefined) {
		open = !isOpen;
	} else {
		open = !!open;
	}
	if (open === isOpen) {
		return;
	}
	if (open) {
		$.removeClass(element, "closed");
		tmp = el2;
		el2 = el1;
		el1 = tmp;
	} else {
		$.addClass(element, "closed");
	}

	el1 && (el1.style.display = "none");
	if (el2) {
		var f = function f(evt) {
			if (evt.target !== element) {
				return;
			}
			el2.style.display = "flex";
			element.removeEventListener("transitionend", f);
		};
		element.addEventListener("transitionend", f);
	}
};

$.transition = function (target, className, then) {
	var f = function f(evt) {
		if (evt.target !== target) {
			return;
		}
		target.removeEventListener("transition", f);
		then();
	};
	target.addEventListener("transitionend", f);
	$.addClass(target, className);
};

$.template = function (strings) {
	for (var _len = arguments.length, keys = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
		keys[_key - 1] = arguments[_key];
	}

	return function (o) {
		var result = strings[0];
		for (var i = 0, l = keys.length; i < l; i++) {
			result += o[keys[i]] + strings[i + 1];
		}
		return result;
	};
};

// TODO: evaluate whether this belongs here. Feels awkward given its specific DOM dependencies.
$.getCSSValue = function (name, prop) {
	var el = $.create("div", name);
	el.style.display = "none";
	el.id = "export";
	document.body.appendChild(el);
	var val = window.getComputedStyle(el).getPropertyValue(prop);
	$.remove(el);
	return val;
};

$._runOnNodeList = function (f, nodelist) {
	if (!nodelist) {
		return true;
	}
	if (nodelist.length === undefined) {
		return false;
	}

	for (var _len2 = arguments.length, rest = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
		rest[_key2 - 2] = arguments[_key2];
	}

	for (var i = 0, l = nodelist.length; i < l; i++) {
		f.call.apply(f, [DOMUtils, nodelist[i]].concat(rest));
	}
	return true;
};

$._childQuery = function (query, el, f) {
	if (!el.id) {
		el.id = "___tmp_id";
	}
	var result = f("#" + el.id + " " + query, el.parentNode);
	if (el.id === "___tmp_id") {
		el.id = "";
	}
	return result;
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Utils = {};
Utils.prepMenuContent = function (content, idMap) {
	if (!idMap.__next_id) {
		idMap.__next_id = 1;
	}
	var kids = content.kids;
	for (var i = 0, l = kids.length; i < l; i++) {
		var o = kids[i];
		// current list implementation requires everything to have an id:
		if (!o.id) {
			o.id = "__id_" + idMap.__next_id++;
		}
		idMap[o.id] = o;
		o.parent = content;
		if (o.kids) {
			Utils.prepMenuContent(o, idMap);
		}
	}
	return content;
};

Utils.find = function (arr, f) {
	for (var i = 0, l = arr.length; i < l; i++) {
		if (f(arr[i])) {
			return arr[i];
		}
	}
};

Utils.findIndex = function (arr, f) {
	for (var i = 0, l = arr.length; i < l; i++) {
		if (f(arr[i])) {
			return i;
		}
	}
	return -1;
};

Utils.copy = function (target, source) {
	for (var n in source) {
		target[n] = source[n];
	}
	return target;
};

Utils.clone = function (o) {
	// this seems hacky, but it's the fastest, easiest approach for now:
	return JSON.parse(JSON.stringify(o));
};

Utils.searchRank = function (o, search) {
	var test = Utils.searchTest;
	search = search.toLowerCase();

	if (o.access) {
		// pattern (My Favorites).
		// text? pattern?
		return test((o.keywords || "") + " " + (o.name || ""), search, 16) + test((o.description || "") + " " + (o.author || ""), search, 8);
	} else {
		// reference.
		return test(o.token, search, 16) + test((o.id || "") + " " + (o.label || ""), search, 8) + test((o.desc || "") + " " + (o.ext || ""), search, 4);
	}
};

Utils.searchTest = function (str, search) {
	var weight = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

	return str && str.toLowerCase().indexOf(search) !== -1 ? weight : 0;
};

Utils.htmlSafe = function (str) {
	return str == null ? "" : ("" + str).replace(/&/g, "&amp;").replace(/</g, "&lt;");
};

Utils.shorten = function (str, length, htmlSafe) {
	var tag = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "";

	if (!str) {
		return str;
	}
	var b = length > 0 && str.length > length;
	if (b) {
		str = str.substr(0, length - 1);
	}
	if (htmlSafe) {
		str = Utils.htmlSafe(str);
	}
	return !b ? str : str + (tag && "<" + tag + ">") + "\u2026" + (tag && "</" + tag + ">");
};

Utils.unescSubstStr = function (str) {
	return str.replace(Utils.SUBST_ESC_RE, function (a, b, c) {
		return Utils.SUBST_ESC_CHARS[b] || String.fromCharCode(parseInt(c, 16));
	});
};

Utils.getRegExp = function (str) {
	// returns a JS RegExp object.
	var match = str.match(/^\/(.+)\/([a-z]+)?$/),
	    regex = null;
	try {
		regex = match ? new RegExp(match[1], match[2] || "") : new RegExp(str, "g");
	} catch (e) {}
	return regex;
};

Utils.decomposeRegEx = function (str) {
	var delim = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "/";

	var index = str.lastIndexOf(delim);
	return index !== -1 ? { source: str.substring(1, index), flags: str.substr(index + 1) } : { source: str, flags: "g" };
};

Utils.isMac = function () {
	return !!navigator.userAgent.match(/Mac\sOS/i);
};

Utils.getCtrlKey = function () {
	return Utils.isMac() ? "cmd" : "ctrl";
};

Utils.now = function () {
	return window.performance ? performance.now() : Date.now();
};

Utils.getUrlParams = function () {
	var match = void 0,
	    re = /([^&=]+)=?([^&]*)/g,
	    params = {};
	var url = window.location.search.substring(1).replace("+", " ");
	while (match = re.exec(url)) {
		params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
	}
	return params;
};

var deferIds = {};
Utils.defer = function (f, id) {
	var t = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

	clearTimeout(deferIds[id]);
	if (f === null) {
		delete deferIds[id];
		return;
	}
	deferIds[id] = setTimeout(function () {
		delete deferIds[id];
		f();
	}, t);
};

Utils.getHashCode = function (s) {
	var hash = 0,
	    l = s.length,
	    i = void 0;
	for (i = 0; i < l; i++) {
		hash = (hash << 5) - hash + s.charCodeAt(i) | 0;
	}
	return hash;
};

Utils.getPatternURL = function (pattern) {
	var url = window.location.origin + "/",
	    id = pattern && pattern.id || "";
	return url + id;
};

Utils.getPatternURLStr = function (pattern) {
	if (!pattern || !pattern.id) {
		return null;
	}
	var url = window.location.host + "/",
	    id = pattern.id;
	return url + id;
};

Utils.getForkName = function (name) {
	var res = / ?\(fork ?(\d*)\)$/.exec(name);
	if (res) {
		var num = (res[1] || 1) * 1 + 1;
		return name.substr(0, res.index) + " (fork " + num + ")";
	}
	return name + " (fork)";
};

Utils.SUBST_ESC_CHARS = {
	// this is just the list supported in Replace. Others: b, f, ", etc.
	n: "\n",
	r: "\r",
	t: "\t",
	"\\": "\\"
};

Utils.SUBST_ESC_RE = /\\([nrt\\]|u([A-Z0-9]{4}))/ig;

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
Utilities for working with CodeMirror.
*/

var CMUtils = {};
CMUtils.create = function (target) {
	var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	var width = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "100%";
	var height = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "100%";

	var keys = {},
	    ctrlKey = Utils.getCtrlKey();
	//keys[ctrlKey + "-Z"] = keys[ctrlKey + "-Y"] = keys["Shift-" + ctrlKey + "-Z"] = () => false; // block CM handling

	var o = Utils.copy({
		lineNumbers: false,
		tabSize: 3,
		indentWithTabs: true,
		extraKeys: keys,
		specialChars: /[ \u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff]/,
		specialCharPlaceholder: function specialCharPlaceholder(ch) {
			return DOMUtils.create("span", ch === " " ? "cm-space" : "cm-special", " ");
		} // needs to be a space so wrapping works
	}, opts);

	var cm = CodeMirror(target, o);
	cm.setSize(width, height);

	if (cm.getOption("maxLength")) {
		cm.on("beforeChange", CMUtils.enforceMaxLength);
	}
	if (cm.getOption("singleLine")) {
		cm.on("beforeChange", CMUtils.enforceSingleLine);
	}

	return cm;
};

CMUtils.getCharIndexAt = function (cm, winX, winY) {
	var pos = cm.coordsChar({ left: winX, top: winY }, "page");
	// test current and prev character, since CM seems to use the center of each character for coordsChar:
	for (var i = 0; i <= 1; i++) {
		var rect = cm.charCoords(pos, "page");
		if (winX >= rect.left && winX <= rect.right && winY >= rect.top && winY <= rect.bottom) {
			return cm.indexFromPos(pos);
		}
		if (pos.ch-- <= 0) {
			break;
		}
	}
	return null;
};
/*
// unused?
CMUtils.getEOLPos = function (cm, pos) {
	if (!isNaN(pos)) {
		pos = cm.posFromIndex(pos);
	}
	let rect = cm.charCoords(pos, "local"), w = cm.getScrollInfo().width;
	return cm.coordsChar({left: w - 1, top: rect.top}, "local");
};
*/
CMUtils.getCharRect = function (cm, index) {
	if (index == null) {
		return null;
	}
	var pos = cm.posFromIndex(index),
	    rect = cm.charCoords(pos);
	rect.x = rect.left;
	rect.y = rect.top;
	rect.width = rect.right - rect.left;
	rect.height = rect.bottom - rect.top;
	return rect;
};

CMUtils.enforceMaxLength = function (cm, change) {
	var maxLength = cm.getOption("maxLength");
	if (maxLength && change.update) {
		var str = change.text.join("\n");
		var delta = str.length - (cm.indexFromPos(change.to) - cm.indexFromPos(change.from));
		if (delta <= 0) {
			return true;
		}
		delta = cm.getValue().length + delta - maxLength;
		if (delta > 0) {
			str = str.substr(0, str.length - delta);
			change.update(change.from, change.to, str.split("\n"));
		}
	}
	return true;
};

CMUtils.enforceSingleLine = function (cm, change) {
	if (change.update) {
		var str = change.text.join("").replace(/(\n|\r)/g, "");
		change.update(change.from, change.to, [str]);
	}
	return true;
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Tooltip = function () {
	function Tooltip(el) {
		var _this = this;

		var transition = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
		classCallCheck(this, Tooltip);

		this.el = DOMUtils.remove(el);
		this.transition = transition;
		this.contentEl = DOMUtils.query(".content", el);
		this.tipEl = DOMUtils.query(".tip", el);
		this.hideF = function (evt) {
			return Date.now() > _this._showT && _this.handleBodyClick(evt);
		};
		this.curId = null;
	}

	createClass(Tooltip, [{
		key: "toggle",
		value: function toggle(id, content, x, y, autohide, th) {
			if (id === this.curId) {
				return this.hide(id);
			}
			this.show(id, content, x, y, autohide, th);
		}
	}, {
		key: "toggleOn",
		value: function toggleOn(id, content, el, autohide, th) {
			if (id === this.curId) {
				return this.hide(id);
			}
			this.showOn(id, content, el, autohide, th);
			this.toggleEl = el;
			DOMUtils.addClass(el, "selected");
		}
	}, {
		key: "hide",
		value: function hide(id) {
			if (id && this.curId !== id) {
				return;
			}
			var el = this.el,
			    elStyle = el.style;
			DOMUtils.empty(DOMUtils.query(".content", DOMUtils.remove(el)));
			DOMUtils.removeClass(el, "flipped");
			document.body.removeEventListener("mousedown", this.hideF);

			if (this.toggleEl) {
				DOMUtils.removeClass(this.toggleEl, "selected");
				this.toggleEl = null;
			}

			// reset position and width so that content wrapping resolves properly:
			elStyle.left = elStyle.top = "0";
			elStyle.width = "";
			if (this.transition) {
				elStyle.opacity = 0;
				elStyle.marginTop = "-0.25em";
			}
			this.curId = null;
		}
	}, {
		key: "show",
		value: function show(id, content, x, y) {
			var autohide = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
			var th = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 0;

			this.hide();
			if (!content) {
				return;
			}

			var el = this.el,
			    elStyle = el.style,
			    contentEl = this.contentEl,
			    body = document.body,
			    pad = 8;
			if (content instanceof HTMLElement) {
				contentEl.appendChild(content);
			} else {
				contentEl.innerHTML = content;
			}

			if (autohide) {
				this._showT = Date.now() + 30; // ignore double clicks and events in the current stack.
				body.addEventListener("mousedown", this.hideF);
			}

			body.appendChild(el);

			var wh = window.innerHeight,
			    ww = window.innerWidth;
			var rect = el.getBoundingClientRect(),
			    w = rect.right - rect.left,
			    h = rect.bottom - rect.top,
			    off = 0;
			if (y + h > wh - pad) {
				DOMUtils.addClass(el, "flipped");
				y -= th;
			}
			if (x - w / 2 < pad) {
				off = pad - x + w / 2;
			} else if (x + w / 2 > ww - pad) {
				off = ww - pad - x - w / 2;
			}
			this.tipEl.style.marginRight = Math.max(-w / 2 + 10, Math.min(w / 2 - 10, off)) * 2 + "px";
			elStyle.width = w + "px";
			elStyle.top = y + "px";
			elStyle.left = x + off + "px";
			if (this.transition) {
				elStyle.opacity = 1;
				elStyle.marginTop = 0;
			}

			this.curId = id;
		}
	}, {
		key: "showOn",
		value: function showOn(id, content, el, autohide) {
			var th = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

			var rect = el.getBoundingClientRect();
			var x = Math.round((rect.left + rect.right) / 2);
			var y = rect.bottom + th;
			var h = rect.bottom - rect.top;
			this.show(id, content, x, y, autohide, h);
		}
	}, {
		key: "handleBodyClick",
		value: function handleBodyClick(evt) {
			var id = this.curId;
			if (this.el.contains(evt.target) || this.toggleEl && this.toggleEl.contains(evt.target)) {
				return;
			}
			this.hide(id);
		}
	}]);
	return Tooltip;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var List = function (_EventDispatcher) {
	inherits(List, _EventDispatcher);

	function List(el, opts) {
		classCallCheck(this, List);

		var _this = possibleConstructorReturn(this, (List.__proto__ || Object.getPrototypeOf(List)).call(this));

		_this.el = el;
		_this.multi = opts.multi;
		_this.template = opts.template;
		_this.data = opts.data;
		if (opts.selected) {
			_this.selected = opts.selected;
		}
		return _this;
	}

	createClass(List, [{
		key: "refresh",
		value: function refresh() {
			var sel = this.selected;
			this.data = this._data;
			this.selected = sel;
		}
	}, {
		key: "handleClick",
		value: function handleClick(evt) {
			var id = evt.currentTarget.dataset.id,
			    old = this.selected;
			if (this.multi) {
				DOMUtils.toggleClass(evt.currentTarget, "selected");
			} else if (this.selected === id) {
				if (id != null) {
					this.dispatchEvent("selclick");
				}
				return;
			} else {
				this.selected = id;
			}
			if (!this.dispatchEvent("change", false, true)) {
				this.selected = old;
			}
		}
	}, {
		key: "scrollTo",
		value: function scrollTo(id) {
			var el = DOMUtils.query("[data-id='" + id + "']", this.el);
			if (!el) {
				return;
			}
			// el.scrollIntoView(); // this is too jumpy, but would handle horizontal.

			var top = el.offsetTop - this.el.offsetTop;
			if (top + el.offsetHeight > this.el.scrollTop + this.el.offsetHeight) {
				this.el.scrollTop = top + el.offsetHeight - this.el.offsetHeight + 10;
			} else if (top < this.el.scrollTop) {
				this.el.scrollTop = top - 10;
			}
		}
	}, {
		key: "data",
		set: function set$$1(data) {
			var _this2 = this;

			// TODO: retain selection?
			DOMUtils.empty(this.el);
			this._data = data;
			if (!data || !data.length) {
				return;
			}
			var f = function f(evt) {
				return _this2.handleClick(evt);
			},
			    template = this.template;
			for (var i = 0, l = data.length; i < l; i++) {
				var o = data[i],
				    label = void 0,
				    id = void 0,
				    selected = void 0;
				if (typeof o === "string") {
					id = o;
					label = template ? template(o) : o;
				} else {
					if (o.hide) {
						continue;
					}
					id = o.id || o.label;
					label = template ? template(o) : o.label;
					selected = o.selected;
				}
				var item = DOMUtils.create("li", selected ? "selected" : null, label, this.el);
				item.dataset.id = id;
				item.item = o;
				item.addEventListener("click", f);
			}
		},
		get: function get$$1() {
			return this._data;
		}
	}, {
		key: "selected",
		set: function set$$1(ids) {
			var _this3 = this;

			DOMUtils.removeClass(DOMUtils.queryAll(".selected", this.el), "selected");
			if (!(ids instanceof Array)) {
				ids = [ids];
			}
			ids.forEach(function (id) {
				return DOMUtils.addClass(DOMUtils.query("[data-id='" + id + "']", _this3.el), "selected");
			});

			if (!this.multi) {
				this.scrollTo(ids[0]);
			}
		},
		get: function get$$1() {
			var els = DOMUtils.queryAll("li.selected", this.el);
			if (!els[0]) {
				return null;
			}
			if (!this.multi) {
				return els[0].dataset.id;
			}
			var ids = [];
			for (var i = 0, l = els.length; i < l; i++) {
				ids.push(els[i].dataset.id);
			}
			return ids;
		}
	}, {
		key: "selectedItem",
		get: function get$$1() {
			var el = DOMUtils.query("li.selected", this.el);
			return el && el.item;
		}
	}]);
	return List;
}(EventDispatcher);

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Server = function () {
	function Server() {
		classCallCheck(this, Server);
	}

	createClass(Server, null, [{
		key: "solve",


		// regex:
		value: function solve(req) {
			return Server._getRequest("regex/solve", { data: JSON.stringify(req) });
		}
	}, {
		key: "version",
		value: function version(flavor) {
			return Server._getRequest("regex/version", { flavor: flavor });
		}

		// patterns:

	}, {
		key: "communitySearch",
		value: function communitySearch(str) {
			var _this = this;

			return Server._getRequest("patterns/search", { query: str || "", startIndex: 0, limit: 100 }, function (data) {
				_this._processPatternList(data);
			});
		}
	}, {
		key: "load",
		value: function load(id) {
			var _this2 = this;

			return Server._getRequest("patterns/load", { patternId: id }, function (data) {
				return _this2._processPattern(data);
			});
		}
	}, {
		key: "save",
		value: function save(pattern, fork) {
			var _this3 = this;

			// clone and prep the pattern object:
			var o = this._prepPattern(pattern, fork);
			return Server._getRequest("patterns/save", o, function (data) {
				return _this3._processPattern(data);
			});
		}
	}, {
		key: "rate",
		value: function rate(id, rating) {
			return Server._getRequest("patterns/rate", { patternId: id, userRating: rating }, function (data) {
				return data.rating = Number(data.rating);
			});
		}
	}, {
		key: "delete",
		value: function _delete(id) {
			return Server._getRequest("patterns/delete", { patternId: id });
		}
	}, {
		key: "favorite",
		value: function favorite(id, value) {
			return Server._getRequest("patterns/favorite", { patternId: id, favorite: !!value });
		}
	}, {
		key: "private",
		value: function _private(id, value) {
			return Server.setAccess(id, value ? "private" : "protected");
		}
	}, {
		key: "setAccess",
		value: function setAccess(id, value) {
			return Server._getRequest("patterns/setAccess", { patternId: id, access: value });
		}
	}, {
		key: "multiFavorite",
		value: function multiFavorite(ids) {
			return Server._getRequest("patterns/multiFavorite", { patternIds: JSON.stringify(ids) });
		}

		// account:

	}, {
		key: "login",
		value: function login(service) {
			window.location = Server.url + "?action=account/login&type=" + service;
		}
	}, {
		key: "logout",
		value: function logout() {
			return Server._getRequest("account/logout", {});
		}
	}, {
		key: "verify",
		value: function verify() {
			return Server._getRequest("account/verify", {});
		}
	}, {
		key: "patterns",
		value: function patterns() {
			var _this4 = this;

			return Server._getRequest("account/patterns", {}, function (data) {
				_this4._processPatternList(data);
				data.results.sort(function (a, b) {
					if (a.favorite !== b.favorite) {
						return b.favorite - a.favorite;
					}
					return b.dateAdded - a.dateAdded;
				});
			});
		}

		// helpers:

	}, {
		key: "_processPatternList",
		value: function _processPatternList(data) {
			data.results.forEach(this._processPattern);
		}
	}, {
		key: "_processPattern",
		value: function _processPattern(o) {
			// parse values:
			o.rating = Number(o.rating);
			o.userRating = Number(o.userRating);
			o.flavor = o.flavor || "js";
			o.text = o.text || null;
			if (o.tool && o.tool.id) {
				o.tool.id = o.tool.id.toLowerCase();
			}
		}
	}, {
		key: "_prepPattern",
		value: function _prepPattern(o, fork) {
			o = Utils.clone(o);
			if (fork) {
				o.parentId = o.id;
				delete o.id;
				o.name = Utils.getForkName(o.name);
			}
			// clear null values:
			if (!o.id) {
				delete o.id;
			}
			if (!o.parentId) {
				delete o.parentId;
			}
			delete o.userId; // this gets added by the server
			o.tool = JSON.stringify(o.tool);
			return o;
		}

		// private methods:

	}, {
		key: "_getRequest",
		value: function _getRequest(action) {
			var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
			var postprocess = arguments[2];

			var req = new XMLHttpRequest(),
			    p = new ServerPromise(req, postprocess),
			    params = [];
			req.open("POST", Server.url);
			req.setRequestHeader("Content-type", "application/x-www-form-urlencoded", true);
			req.timeout = 5000;
			data.action = action;

			if (Server.isLocal && Server.useBeta) {
				data.userId = 111;
			}
			for (var n in data) {
				params.push(n + "=" + encodeURIComponent(data[n]));
			}
			if (Server.isLocal) {
				console.log(data);
			}
			req.send(params.join("&"));
			return p;
		}
	}]);
	return Server;
}();

var ServerPromise = function () {
	function ServerPromise(req, postprocess) {
		var _this5 = this;

		classCallCheck(this, ServerPromise);

		this._req = req;
		this._postprocess = postprocess;
		req.addEventListener("load", function () {
			return _this5._load();
		});
		req.addEventListener("timeout", function (evt) {
			return _this5._error("servercomm");
		});
		req.addEventListener("error", function (evt) {
			return _this5._error("servercomm");
		});
	}

	createClass(ServerPromise, [{
		key: "then",
		value: function then(f, cf, ff) {
			this._loadF = f;
			if (cf) {
				this.catch(cf);
			}
			if (this._data) {
				f(this._data);
			}
			if (ff) {
				this.finally(ff);
			}
			return this;
		}
	}, {
		key: "catch",
		value: function _catch(f) {
			this._errorF = f;
			if (this._err) {
				f(this._err);
			}
			return this;
		}
	}, {
		key: "finally",
		value: function _finally(f) {
			this._finallyF = f;
			if (this._complete) {
				f();
			}
			return this;
		}
	}, {
		key: "abort",
		value: function abort() {
			if (this._complete) {
				return;
			}
			this._complete = true;
			this._req.abort();
			this._finallyF && this._finallyF();
			this._loadF = this._errorF = this._finallyF = null; // just to make sure.
		}
	}, {
		key: "_load",
		value: function _load() {
			var json = void 0;
			this._complete = true;
			if (Server.isLocal) {
				console.log(this._req.response || this._req.responseText);
			}
			try {
				json = JSON.parse(this._req.response || this._req.responseText);
			} catch (e) {
				return this._error(e);
			}
			if (!json.success) {
				return this._error(json.data);
			}
			this._postprocess && this._postprocess(json.data);
			this._data = json.data;
			this._loadF && this._loadF(this._data);
			this._finallyF && this._finallyF();
		}
	}, {
		key: "_error",
		value: function _error(e) {
			this._err = e.data && e.data.error || e.message || e.detail || e.type || String(e);
			this._errorF && this._errorF(this._err);
			this._finallyF && this._finallyF();
		}
	}]);
	return ServerPromise;
}();

Server.isLocal = window.location.hostname === "localhost";
Server.useBeta = Server.isLocal || window.location.hostname === "beta.regexr.com";
Server.host = (Server.useBeta ? "http://beta." : "https://") + "regexr.com";
Server.url = Server.host + "/server/api.php";

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Track = {};
Track.GA_ID = "UA-3579542-6";

Track.page = function (path) {
	gtag("config", Track.GA_ID, { "page_path": "/" + path });
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
Track.event = function (name, category, label) {
	var o = {};
	if (category) {
		o.event_category = category;
	}
	if (label) {
		o.event_label = label;
	}
	gtag("event", name, o);
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var ExpressionLexer = function () {
	function ExpressionLexer() {
		classCallCheck(this, ExpressionLexer);

		this.profile = null;
	}

	createClass(ExpressionLexer, [{
		key: "parse",
		value: function parse(str) {
			if (!this._profile) {
				return null;
			}
			if (str === this.string) {
				return this.token;
			}

			this.token = null;
			this._modes = {};
			this.string = str;
			this.errors = [];
			var capgroups = this.captureGroups = [];
			var namedgroups = this.namedGroups = {};
			var groups = [],
			    refs = [],
			    i = 0,
			    l = str.length;
			var o = void 0,
			    c = void 0,
			    token = void 0,
			    charset = null;
			// previous is the previous token, prv is the previous "active" token (!ignore)
			var prev = null,
			    prv = null;
			var profile = this._profile,
			    unquantifiable = profile.unquantifiable;
			var charTypes = profile.charTypes;
			var closeIndex = str.lastIndexOf("/");

			for (var _i = closeIndex + 1; _i < l; _i++) {
				this._modes[str[_i]] = true;
			}

			while (i < l) {
				c = str[i];

				token = { i: i, l: 1, prev: prev, prv: prv, modes: this._modes };
				if (prev) {
					prev.next = token;
				} else {
					this.token = token;
				}

				if (i === 0 || i >= closeIndex) {
					this.parseFlag(str, token);
				} else if (c === "(" && !charset) {
					this.parseParen(str, token);
					if (token.close === null) {
						token.depth = groups.length;
						groups.push(token);
					}
					if (token.capture) {
						capgroups.push(token);
						token.num = capgroups.length;
						if (token.name && !token.err) {
							if (/\d/.test(token.name[0])) {
								token.err = "badname";
							} else if (namedgroups[token.name]) {
								token.err = "dupname";
								token.related = [namedgroups[token.name]];
							} else {
								namedgroups[token.name] = token;
							}
						}
					}
				} else if (c === ")" && !charset) {
					token.type = "groupclose";
					if (groups.length) {
						o = token.open = groups.pop();
						o.close = token;
					} else {
						token.err = "groupclose";
					}
				} else if (c === "[") {
					charset = this.parseSquareBracket(str, token, charset);
				} else if (c === "]" && charset) {
					token.type = "setclose";
					token.open = charset;
					charset.close = token;
					charset = null;
				} else if (c === "+" && prv && prv.clss === "quant" && profile.tokens.possessive) {
					token.type = "possessive";
					token.related = [prv];
				} else if ((c === "+" || c === "*") && !charset) {
					token.type = charTypes[c];
					token.clss = "quant";
					token.min = c === "+" ? 1 : 0;
					token.max = -1;
				} else if (c === "{" && !charset && str.substr(i).search(/^{\d+,?\d*}/) !== -1) {
					this.parseQuant(str, token);
				} else if (c === "\\") {
					this.parseBackSlash(str, token, charset, closeIndex);
				} else if (c === "?" && !charset) {
					if (!prv || prv.clss !== "quant") {
						token.type = charTypes[c];
						token.clss = "quant";
						token.min = 0;
						token.max = 1;
					} else {
						token.type = "lazy";
						token.related = [prv];
					}
				} else if (c === "-" && charset && prv.code !== undefined && prv.prv && prv.prv.type !== "range") {
					// this may be the start of a range, but we'll need to validate after the next token.
					token.type = "range";
				} else {
					this.parseChar(str, token, charset);
					if (!charset && this._modes.x && /\s/.test(c)) {
						token.ignore = true;
						token.type = "ignorews";
					}
				}

				// post process token:
				// quantifier:
				if (token.clss === "quant") {
					if (!prv || prv.close !== undefined || unquantifiable[prv.type] || prv.open && unquantifiable[prv.open.type]) {
						token.err = "quanttarg";
					} else {
						token.related = [prv.open || prv];
					}
				}

				// js warnings:
				// TODO: this isn't ideal, but I'm hesitant to write a more robust solution for a couple of edge cases.
				if (profile.id === "js" && (token.type === "neglookbehind" || token.type === "poslookbehind")) {
					token.err = "jsfuture";
				}

				// reference:
				if (token.group === true) {
					refs.push(token);
				}

				// conditional:
				var curGroup = groups.length ? groups[groups.length - 1] : null;
				if (curGroup && (curGroup.type === "conditional" || curGroup.type === "conditionalgroup") && token.type === "alt") {
					if (!curGroup.alt) {
						curGroup.alt = token;
					} else {
						token.err = "extraelse";
					}
					token.related = [curGroup];
					token.type = "conditionalelse";
					token.clss = "special";
				}

				// range:
				if (prv && prv.type === "range" && prv.l === 1) {
					this.validateRange(str, token);
				}

				// general:
				if (token.open && !token.clss) {
					token.clss = token.open.clss;
				}
				if (token.err) {
					this.errors.push(token.err);
				}
				i += token.l;
				prev = token;
				if (!token.ignore) {
					prv = token;
				}
			}

			// post processing:
			while (groups.length) {
				this.errors.push(groups.pop().err = "groupopen");
			}
			this.matchRefs(refs, capgroups, namedgroups);
			if (charset) {
				this.errors.push(charset.err = "setopen");
			}

			return this.token;
		}
	}, {
		key: "getRef",
		value: function getRef(token, str) {
			token.clss = "ref";
			token.group = true;
			token.relIndex = this.captureGroups.length;
			token.name = str;
		}
	}, {
		key: "matchRefs",
		value: function matchRefs(refs, indexes, names) {
			while (refs.length) {
				var token = refs.pop(),
				    name = token.name,
				    group = names[name];

				if (!group && !isNaN(name)) {
					var sign = name[0],
					    index = parseInt(name) + (sign === "+" || sign === "-" ? token.relIndex : 0);
					if (sign === "-") {
						index++;
					}
					group = indexes[index - 1];
				}
				if (group) {
					token.group = group;
					token.related = [group];
					token.dir = token.i < group.i ? 1 : !group.close || token.i < group.close.i ? 0 : -1;
				} else {
					delete token.group;
					delete token.relIndex;
					this.refToOctal(token);
					if (token.err) {
						this.errors.push(token.err);
					}
				}
			}
		}
	}, {
		key: "refToOctal",
		value: function refToOctal(token) {
			// PCRE: \# unmatched, \0 \00 \## = octal
			// JS: \# \0 \00 \## = octal
			// PCRE matches \8 \9 to "8" "9"
			// JS: without the u flag \8 \9 match "8" "9" in IE, FF & Chrome, and "\8" "\9" in Safari. We support the former.
			// JS: with the u flag, Chrome & FF throw an esc error, Safari does not.

			// TODO: handle \0 for PCRE? Would need more testing.
			// TODO: this doesn't handle two digit refs with 8/9 in them. Ex. \18 - not even sure what this is interpreted as.
			var name = token.name,
			    profile = this._profile;
			if (token.type !== "numref") {
				// not a simple \4 style reference, so can't decompose into an octal.
				token.err = "unmatchedref";
			} else if (/^[0-7]{2}$/.test(name) || profile.config.reftooctalalways && /^[0-7]$/.test(name)) {
				// octal
				var next = token.next,
				    char = String.fromCharCode(next.code);
				if (next.type === "char" && char >= "0" && char <= "7" && parseInt(name + char, 8) <= 255) {
					name += char;
					this.mergeNext(token);
				}
				token.code = parseInt(name, 8);
				token.clss = "esc";
				token.type = "escoctal";
				delete token.name;
			} else if (name === "8" || name === "9") {
				this.parseEscChar(token, name);
				delete token.name;
			} else {
				token.err = "unmatchedref";
			}
		}
	}, {
		key: "mergeNext",
		value: function mergeNext(token) {
			var next = token.next;
			token.next = next.next;
			token.next.prev = token;
			token.l++;
		}
	}, {
		key: "parseFlag",
		value: function parseFlag(str, token) {
			// note that this doesn't deal with misformed patterns or incorrect flags.
			var i = token.i,
			    c = str[i];
			if (str[i] === "/") {
				token.type = i === 0 ? "open" : "close";
				if (i !== 0) {
					token.related = [this.token];
					this.token.related = [token];
				}
			} else {
				token.type = this._profile.flags[c];
			}
			token.clear = true;
		}
	}, {
		key: "parseChar",
		value: function parseChar(str, token, charset) {
			var c = str[token.i];
			token.type = !charset && this._profile.charTypes[c] || "char";
			if (!charset && c === "/") {
				token.err = "fwdslash";
			}
			if (token.type === "char") {
				token.code = c.charCodeAt(0);
			} else if (ExpressionLexer.ANCHOR_TYPES[token.type]) {
				token.clss = "anchor";
			} else if (token.type === "dot") {
				token.clss = "charclass";
			}
			return token;
		}
	}, {
		key: "parseSquareBracket",
		value: function parseSquareBracket(str, token, charset) {
			var match = void 0;
			if (this._profile.tokens.posixcharclass && (match = str.substr(token.i).match(/^\[(:|\.)([^\]]*?)\1]/))) {
				// posixcharclass: [:alpha:]
				// posixcollseq: [.ch.]
				// currently neither flavor supports posixcollseq, but PCRE does flag as an error:
				// TODO: the expression above currently does not catch [.\].]
				token.l = match[0].length;
				token.value = match[2];
				token.clss = "charclass";
				if (match[1] === ":") {
					token.type = "posixcharclass";
					if (!this._profile.posixCharClasses[match[2]]) {
						token.err = "posixcharclassbad";
					} else if (!charset) {
						token.err = "posixcharclassnoset";
					}
				} else {
					token.type = "posixcollseq";
					// TODO: can this be generalized? Right now, no, because we assign ids that aren't in the profile.
					token.err = "notsupported";
				}
			} else if (!charset) {
				// set [a-z] [aeiou]
				// setnot [^a-z]
				token.type = token.clss = "set";
				if (str[token.i + 1] === "^") {
					token.l++;
					token.type += "not";
				}
				charset = token;
			} else {
				// [[] (square bracket inside a set)
				this.parseChar(str, token, charset);
			}
			return charset;
		}
	}, {
		key: "parseParen",
		value: function parseParen(str, token) {
			/*
   core:
   .		group:
   .		lookahead: ?= ?!
   .		noncap: ?:
   PCRE:
   .		lookbehind: ?<= ?<!
   .		named: ?P<name> ?'name' ?<name>
   .		namedref: ?P=name		Also: \g'name' \k'name' etc
   .		comment: ?#
   .		atomic: ?>
   .		recursion: ?0 ?R		Also: \g<0>
   .		define: ?(DEFINE)
   .		subroutine: ?1 ?-1 ?&name ?P>name
   	conditionalgroup: ?(1)a|b ?(-1)a|b ?(name)a|b
   	conditional: ?(?=if)then|else
   	mode: ?c-i
   	branchreset: ?|
   */

			token.clss = token.type = "group";
			if (str[token.i + 1] !== "?") {
				token.close = null; // indicates that it needs a close token.
				token.capture = true;
				return token;
			}

			var sub = str.substr(token.i + 2),
			    match = void 0,
			    s = sub[0];

			if (s === ":") {
				// (?:foo)
				token.type = "noncapgroup";
				token.close = null;
				token.l = 3;
			} else if (s === ">") {
				// (?>foo)
				token.type = "atomic";
				token.close = null;
				token.l = 3;
			} else if (s === "|") {
				// (?|(a)|(b))
				token.type = "branchreset";
				token.close = null;
				token.l = 3;
				token.err = "branchreseterr";
			} else if (s === "#" && (match = sub.match(/[^)]*\)/))) {
				// (?#foo)
				token.clss = token.type = "comment";
				token.ignore = true;
				token.l = 2 + match[0].length;
			} else if (/^(R|0)\)/.test(sub)) {
				// (?R) (?0)
				token.clss = "ref";
				token.type = "recursion";
				token.l = 4;
			} else if (match = sub.match(/^P=(\w+)\)/i)) {
				// (?P=name)
				token.type = "namedref";
				this.getRef(token, match[1]);
				token.l = match[0].length + 2;
			} else if (/^\(DEFINE\)/.test(sub)) {
				// (?(DEFINE)foo)
				token.type = "define";
				token.close = null;
				token.l = 10;
			} else if (match = sub.match(/^<?[=!]/)) {
				// (?=foo) (?<!foo)
				var isCond = token.prv.type === "conditional";
				token.clss = isCond ? "special" : "lookaround";
				token.close = null;
				s = match[0];
				token.behind = s[0] === "<";
				token.negative = s[+token.behind] === "!";
				token.type = isCond ? "condition" : (token.negative ? "neg" : "pos") + "look" + (token.behind ? "behind" : "ahead");
				if (isCond) {
					token.prv.related = [token];
					token.prv.condition = token;
					token.related = [token.prv];
				}
				token.l = s.length + 2;
			} else if ((match = sub.match(/^'(\w+)'/)) || (match = sub.match(/^P?<(\w+)>/))) {
				// (?'name'foo) (?P<name>foo) (?<name>foo)
				token.type = "namedgroup";
				token.close = null;
				token.name = match[1];
				token.capture = true;
				token.l = match[0].length + 2;
			} else if ((match = sub.match(/^([-+]?\d\d?)\)/)) || (match = sub.match(/^(?:&|P>)(\w+)\)/))) {
				// (?1) (?-1) (?&name) (?P>name)
				token.type = (isNaN(match[1]) ? "named" : "num") + "subroutine";
				this.getRef(token, match[1]);
				token.l = match[0].length + 2;
			} else if ((match = sub.match(/^\(([-+]?\d\d?)\)/)) || (match = sub.match(/^\((\w+)\)/))) {
				// (?(1)a|b) (?(-1)a|b) (?(name)a|b)
				this.getRef(token, match[1]);
				token.clss = "special";
				token.type = "conditionalgroup";
				token.close = null;
				token.l = match[0].length + 2;
			} else if (/^\(\?<?[=!]/.test(sub)) {
				// (?(?=if)then|else)
				token.clss = "special";
				token.type = "conditional";
				token.close = null;
				token.l = 2;
			} else if (this.parseMode(token, sub)) {
				// (?i-x)
				// do nothing. handled by parseMode.
			} else {
				// error, found a (? without matching anything. Treat it as a normal group and let it error out.
				token.close = null;
				token.capture = true;
			}

			if (!this._profile.tokens[token.type]) {
				token.err = "notsupported";
			}

			return token;
		}
	}, {
		key: "parseBackSlash",
		value: function parseBackSlash(str, token, charset, closeIndex) {
			// Note: Chrome does weird things with \x & \u depending on a number of factors, we ignore this.
			var i = token.i,
			    match = void 0,
			    profile = this._profile;
			var sub = str.substr(i + 1),
			    c = sub[0],
			    val = void 0;
			if (i + 1 === (closeIndex || str.length)) {
				token.err = "esccharopen";
				return;
			}

			if (!charset && (match = sub.match(/^\d\d?/))) {
				// \1 to \99
				// write this as a reference for now, and re-write it later if it doesn't match a group
				token.type = "numref";
				this.getRef(token, match[0]);
				token.l += match[0].length;
				return token;
			}
			if (profile.tokens.namedref && !charset && (c === "g" || c === "k")) {
				return this.parseRef(token, sub);
			}

			if (profile.tokens.unicodecat && (c === "p" || c === "P")) {
				// unicode: \p{Ll} \pL
				return this.parseUnicode(token, sub);
			} else if (profile.tokens.escsequence && c === "Q") {
				// escsequence: \Q...\E
				token.type = "escsequence";
				var e = 2;
				if ((i = sub.indexOf("\\E")) !== -1) {
					token.l += i + 2;e += 2;
				} else {
					token.l += closeIndex - token.i - 1;
				}
				token.value = str.substr(token.i + 2, token.l - e);
			} else if (profile.tokens.escunicodeub && this._modes.u && (match = sub.match(/^u\{(\d+)}/))) {
				// unicodeu: \u{0061}
				token.type = "escunicodeub";
				token.l += match[0].length;
				token.code = parseInt(match[1], 16);
			} else if (profile.tokens.escunicodeu && (match = sub.match(/^u([\da-fA-F]{4})/))) {
				// unicode: \uFFFF
				// update SubstLexer if this changes:
				token.type = "escunicodeu";
				token.l += match[0].length;
				token.code = parseInt(match[1], 16);
			} else if (profile.tokens.escunicodexb && (match = sub.match(/^x\{(.*?)}/))) {
				// unicode: \x{FFFF}
				token.type = "escunicodexb";
				token.l += match[0].length;
				val = parseInt(match[1], 16);
				// PCRE errors on more than 2 digits (>255). In theory it should allow 4?
				if (isNaN(val) || val > 255 || /[^\da-f]/i.test(match[1])) {
					token.err = "esccharbad";
				} else {
					token.code = val;
				}
			} else if (match = sub.match(/^x([\da-fA-F]{0,2})/)) {
				// hex ascii: \xFF
				token.type = "eschexadecimal";
				token.l += match[0].length;
				token.code = parseInt(match[1] || 0, 16);
			} else if (match = sub.match(/^c([a-zA-Z])?/)) {
				// control char: \cA \cz
				// also handles: \c
				// not supported in JS strings
				token.type = "esccontrolchar";
				if (match[1]) {
					token.code = match[1].toUpperCase().charCodeAt(0) - 64; // A=65
					token.l += 2;
				} else if (profile.config.ctrlcodeerr) {
					token.l++;
					token.err = "esccharbad";
				} else {
					return this.parseChar(str, token, charset); // this builds the "/" token
				}
			} else if (match = sub.match(/^[0-7]{1,3}/)) {
				// octal ascii: \011
				token.type = "escoctal";
				sub = match[0];
				if (parseInt(sub, 8) > 255) {
					sub = sub.substr(0, 2);
				}
				token.l += sub.length;
				token.code = parseInt(sub, 8);
			} else if (profile.tokens.escoctalo && (match = sub.match(/^o\{(.*?)}/i))) {
				// \o{377}
				token.type = "escoctal";
				token.l += match[0].length;
				val = parseInt(match[1], 8);
				if (isNaN(val) || val > 255 || /[^0-7]/.test(match[1])) {
					token.err = "esccharbad";
				} else {
					token.code = val;
				}
			} else {
				// single char
				if (token.type = profile.escCharTypes[c]) {
					token.l++;
					token.clss = ExpressionLexer.ANCHOR_TYPES[token.type] ? "anchor" : "charclass";
					return token;
				}

				token.code = profile.escCharCodes[c];
				if (token.code === undefined || token.code === false) {
					// unrecognized.
					return this.parseEscChar(token, c);
				}

				// update SubstLexer if this changes:
				token.l++;
				token.type = "esc_" + token.code;
			}
			token.clss = "esc";
			return token;
		}
	}, {
		key: "parseEscChar",
		value: function parseEscChar(token, c) {
			// unrecognized escchar: \u \a \8, etc
			// JS: allowed except if u flag set, Safari still allows \8 \9
			// PCRE: allows \8 \9 but not others // TODO: support?
			var profile = this._profile;
			token.l = 2;
			if (!profile.badEscChars[c] && profile.tokens.escchar && !this._modes.u || profile.escChars[c]) {
				token.type = "escchar";
				token.code = c.charCodeAt(0);
				token.clss = "esc";
			} else {
				token.err = "esccharbad";
			}
		}
	}, {
		key: "parseRef",
		value: function parseRef(token, sub) {
			// namedref: \k<name> \k'name' \k{name} \g{name}
			// namedsubroutine: \g<name> \g'name'
			// numref: \g1 \g+2 \g{2}
			// numsubroutine: \g<-1> \g'1'
			// recursion: \g<0> \g'0'
			var c = sub[0],
			    s = "",
			    match = void 0;
			if (match = sub.match(/^[gk](?:'\w*'|<\w*>|{\w*})/)) {
				s = match[0].substr(2, match[0].length - 3);
				if (c === "k" && !isNaN(s)) {
					s = "";
				} // TODO: specific error for numeric \k?
			} else if (match = sub.match(/^g(?:({[-+]?\d+}|<[-+]?\d+>|'[-+]?\d+')|([-+]?\d+))/)) {
				s = match[2] !== undefined ? match[2] : match[1].substr(1, match[1].length - 2);
			}
			var isRef = c === "k" || !(sub[1] === "'" || sub[1] === "<");
			if (!isRef && s == 0) {
				token.type = "recursion";
				token.clss = "ref";
			} else {
				// namedref, extnumref, namedsubroutine, numsubroutine
				token.type = (isNaN(s) ? "named" : (isRef ? "ext" : "") + "num") + (isRef ? "ref" : "subroutine");
				this.getRef(token, s);
			}
			token.l += match ? match[0].length : 1;
		}
	}, {
		key: "parseUnicode",
		value: function parseUnicode(token, sub) {
			// unicodescript: \p{Cherokee}
			// unicodecat: \p{Ll} \pL
			// not: \P{Ll} \p{^Lu}
			var match = sub.match(/p\{\^?([^}]*)}/i),
			    val = match && match[1],
			    not = sub[0] === "P";
			if (!match && (match = sub.match(/[pP]([LMZSNPC])/))) {
				val = match[1];
			} else {
				not = not !== (sub[2] === "^");
			}
			token.l += match ? match[0].length : 1;
			token.type = "unicodecat";
			if (this._profile.unicodeScripts[val]) {
				token.type = "unicodescript";
			} else if (!this._profile.unicodeCategories[val]) {
				val = null;
			}
			if (not) {
				token.type = "not" + token.type;
			}
			if (!val) {
				token.err = "unicodebad";
			}
			token.value = val;
			token.clss = "charclass";
			return token;
		}
	}, {
		key: "parseMode",
		value: function parseMode(token, sub) {
			// (?i-x)
			// supported modes in PCRE: i-caseinsens, x-freespacing, s-dotall, m-multiline, U-switchlazy, [J-samename]
			var match = sub.match(/^[-a-z]+\)/i);
			if (!match) {
				return;
			}
			var supModes = this._profile.modes;
			var modes = Utils.copy({}, this._modes),
			    bad = false,
			    not = false,
			    s = match[0],
			    c = void 0;
			token.on = token.off = "";

			for (var i = 0, l = s.length - 1; i < l; i++) {
				c = s[i];
				if (c === "-") {
					not = true;continue;
				}
				if (!supModes[c]) {
					bad = true;break;
				}
				modes[c] = !not;

				token.on = token.on.replace(c, "");
				if (not) {
					token.off = token.off.replace(c, "");
					token.off += c;
				} else {
					token.on += c;
				}
			}

			token.clss = "special";
			token.type = "mode";
			token.l = match[0].length + 2;

			if (bad) {
				token.err = "modebad";
				token.errmode = c;
			} else {
				this._modes = modes;
			}
			return token;
		}
	}, {
		key: "parseQuant",
		value: function parseQuant(str, token) {
			// quantifier: {0,3} {3} {1,}
			token.type = token.clss = "quant";
			var i = token.i;
			var end = str.indexOf("}", i + 1);
			token.l += end - i;
			var arr = str.substring(i + 1, end).split(",");
			token.min = parseInt(arr[0]);
			token.max = arr[1] === undefined ? token.min : arr[1] === "" ? -1 : parseInt(arr[1]);
			if (token.max !== -1 && token.min > token.max) {
				token.err = "quantrev";
			}
			return token;
		}
	}, {
		key: "validateRange",
		value: function validateRange(str, end) {
			// char range: [a-z] [\11-\n]
			var next = end,
			    token = end.prv,
			    prv = token.prv;
			if (prv.code === undefined || next.code === undefined) {
				// not a range, rewrite as a char:
				this.parseChar(str, token);
			} else {
				token.clss = "set";
				if (prv.code > next.code) {
					// this gets added here because parse has already moved to the next token:
					this.errors.push(token.err = "rangerev");
				}
				// preserve as separate tokens, but treat as one in the UI:
				next.proxy = prv.proxy = token;
				token.set = [prv, token, next];
			}
		}
	}, {
		key: "profile",
		set: function set$$1(profile) {
			this._profile = profile;
			this.string = this.token = this.errors = this.captureGroups = this.namedGroups = null;
		}
	}]);
	return ExpressionLexer;
}();

ExpressionLexer.ANCHOR_TYPES = {
	"bof": true,
	"eof": true,
	"bos": true,
	"eos": true,
	"abseos": true,
	"wordboundary": true,
	"notwordboundary": true,
	"prevmatchend": true
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var ExpressionHighlighter = function (_EventDispatcher) {
	inherits(ExpressionHighlighter, _EventDispatcher);

	function ExpressionHighlighter(cm) {
		classCallCheck(this, ExpressionHighlighter);

		var _this = possibleConstructorReturn(this, (ExpressionHighlighter.__proto__ || Object.getPrototypeOf(ExpressionHighlighter)).call(this));

		_this.cm = cm;
		_this._activeMarks = [];
		_this._hoverMarks = [];
		_this._hoverToken = null;
		return _this;
	}

	createClass(ExpressionHighlighter, [{
		key: "clear",
		value: function clear() {
			var _this2 = this;

			this.cm.operation(function () {
				var marks = _this2._activeMarks;
				for (var i = 0, l = marks.length; i < l; i++) {
					marks[i].clear();
				}
				marks.length = 0;
			});
		}
	}, {
		key: "draw",
		value: function draw(token) {
			var _this3 = this;

			var cm = this.cm,
			    pre = ExpressionHighlighter.CSS_PREFIX;

			this.clear();
			cm.operation(function () {

				var groupClasses = ExpressionHighlighter.GROUP_CLASS_BY_TYPE;
				var doc = cm.getDoc(),
				    endToken = void 0,
				    marks = _this3._activeMarks;

				while (token) {
					if (token.clear) {
						token = token.next;
						continue;
					}
					token = _this3._calcTokenPos(doc, token);

					var className = pre + (token.clss || token.type);
					if (token.err) {
						className += " " + pre + "error";
					}

					if (className) {
						marks.push(doc.markText(token.startPos, token.endPos, { className: className }));
					}

					if (token.close) {
						endToken = _this3._calcTokenPos(doc, token.close);
						className = groupClasses[token.clss || token.type];
						if (className) {
							className = className.replace("%depth%", token.depth);
							marks.push(doc.markText(token.startPos, endToken.endPos, { className: className }));
						}
					}
					token = token.next;
				}
			});
		}
	}, {
		key: "_drawSelect",


		// private methods:
		value: function _drawSelect(token) {
			var style = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ExpressionHighlighter.CSS_PREFIX + "selected";

			var doc = this.cm.getDoc(),
			    endToken = token.close || token;
			if (token.set) {
				endToken = token.set[token.set.length - 1];
				token = token.set[0];
			}

			this._calcTokenPos(doc, endToken);
			this._calcTokenPos(doc, token);
			this._hoverMarks.push(doc.markText(token.startPos, endToken.endPos, {
				className: style,
				startStyle: style + "-left",
				endStyle: style + "-right"
			}));
		}
	}, {
		key: "_calcTokenPos",
		value: function _calcTokenPos(doc, token) {
			if (token.startPos || token == null) {
				return token;
			}
			token.startPos = doc.posFromIndex(token.i);
			token.endPos = doc.posFromIndex(token.i + token.l);
			return token;
		}
	}, {
		key: "hoverToken",
		set: function set$$1(token) {
			if (token === this._hoverToken) {
				return;
			}
			if (token && token.set && token.set.indexOf(this._hoverToken) !== -1) {
				return;
			}
			while (this._hoverMarks.length) {
				this._hoverMarks.pop().clear();
			}

			this._hoverToken = token;
			if (token) {
				if (token.open) {
					this._drawSelect(token.open);
				} else {
					this._drawSelect(token);
				}
				if (token.related) {
					for (var i = 0, l = token.related.length; i < l; i++) {
						this._drawSelect(token.related[i], ExpressionHighlighter.CSS_PREFIX + "related");
					}
				}
			}

			this.dispatchEvent("hover");
		},
		get: function get$$1() {
			return this._hoverToken;
		}
	}]);
	return ExpressionHighlighter;
}(EventDispatcher);



ExpressionHighlighter.CSS_PREFIX = "exp-";

ExpressionHighlighter.GROUP_CLASS_BY_TYPE = {
	set: ExpressionHighlighter.CSS_PREFIX + "group-set",
	setnot: ExpressionHighlighter.CSS_PREFIX + "group-set",
	group: ExpressionHighlighter.CSS_PREFIX + "group-%depth%",
	lookaround: ExpressionHighlighter.CSS_PREFIX + "group-%depth%"
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var ExpressionHover = function () {
	function ExpressionHover(editor, highlighter) {
		var _this = this;

		classCallCheck(this, ExpressionHover);

		this.editor = editor;
		this.highlighter = highlighter;
		this.isMouseDown = false;
		this.token = null;

		var o = editor.display.lineDiv;
		o.addEventListener("mousemove", function (evt) {
			return _this._handleMouseMove(evt);
		});
		o.addEventListener("mouseout", function (evt) {
			return _this._handleMouseOut(evt);
		});
		o.addEventListener("mousedown", function (evt) {
			return _this._handleMouseDown(evt);
		});
	}

	// private methods:


	createClass(ExpressionHover, [{
		key: "_handleMouseMove",
		value: function _handleMouseMove(evt) {
			if (this.isMouseDown) {
				return;
			}

			var index = void 0,
			    editor = this.editor,
			    token = this.token,
			    target = null;

			if (evt && token && (index = CMUtils.getCharIndexAt(editor, evt.clientX, evt.clientY + window.pageYOffset)) != null) {
				while (token) {
					if (index >= token.i && index < token.i + token.l) {
						target = token;
						break;
					}
					token = token.next;
				}
			}

			while (target) {
				if (target.open) {
					target = target.open;
				} else if (target.proxy) {
					target = target.proxy;
				} else {
					break;
				}
			}

			this.highlighter.hoverToken = target;
			var rect = index != null && CMUtils.getCharRect(editor, index);
			if (rect) {
				rect.right = rect.left = evt.clientX;
			}
			app.tooltip.hover.show("ExpressionHover", app.reference.tipForToken(target), evt.clientX, rect.bottom, true, 0);
		}
	}, {
		key: "_handleMouseOut",
		value: function _handleMouseOut(evt) {
			this.highlighter.hoverToken = null;
			app.tooltip.hover.hide("ExpressionHover");
		}
	}, {
		key: "_handleMouseDown",
		value: function _handleMouseDown(evt) {
			var _this2 = this;

			// TODO: Should this also be in TextHover?
			if (evt.which !== 1 && evt.button !== 1) {
				return;
			}

			this.isMouseDown = true;
			var _f = void 0,
			    t = window.addEventListener ? window : document;
			t.addEventListener("mouseup", _f = function f() {
				t.removeEventListener("mouseup", _f);
				_this2.isMouseDown = false;
			});
		}
	}]);
	return ExpressionHover;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
The core profile essentially defines every feature we support, and is then pared down by other profiles. All values should be y (true).

It also acts in part as pseudo documentation for all of the "type" values.
 */
var y = true;
var n = false;

var core = {
	id: "core",

	flags: {
		"g": "global", // note that this is not a real flag in some flavors, but a different method call
		"i": "caseinsensitive",
		"m": "multiline",
		"s": "dotall",
		"u": "unicode",
		"y": "sticky",
		"x": "extended",
		"U": "ungreedy"
	},

	// reserved characters that need to be escaped:
	escChars: "+*?^$\\.[]{}()|/".split("").reduce(function (o, c) {
		o[c] = y;return o;
	}, {}),

	// escape chars that are specifically not supported by the flavor:
	badEscChars: n,

	escCharCodes: {
		"0": 0, // null
		"a": 7, // bell
		"t": 9, // tab
		"n": 10, // lf
		"v": 11, // vertical tab
		"f": 12, // form feed
		"r": 13, // cr
		"e": 27 // escape
	},

	escCharTypes: {
		"A": "bos",
		"b": "wordboundary",
		"B": "notwordboundary",
		"d": "digit",
		"D": "notdigit",
		"G": "prevmatchend",
		"h": "hwhitespace",
		"H": "nothwhitespace",
		"K": "keepout",
		"N": "notlinebreak",
		"R": "linebreak",
		"s": "whitespace",
		"S": "notwhitespace",
		"v": "vwhitespace",
		"V": "notvwhitespace",
		"w": "word",
		"W": "notword",
		"X": "unicodegrapheme",
		"Z": "eos",
		"z": "abseos"
	},

	charTypes: {
		".": "dot",
		"|": "alt",
		"$": "eof",
		"^": "bof",
		"?": "opt", // also: "lazy"
		"+": "plus", // also: "possessive"
		"*": "star"
	},

	unquantifiable: {
		// all group/set open tokens are unquantifiable by default (ie. tokens with a .close value)
		"quant": y,
		"plus": y,
		"star": y,
		"opt": y,
		"lazy": y,
		"possessive": y,
		"eof": y,
		"bof": y,
		"eos": y,
		"abseos": y,
		"alt": y,
		"open": y,
		"mode": y,
		"comment": y, // TODO: this should actually be ignored by quantifiers.
		"condition": y
	},

	unicodeScripts: {
		// from: http://www.pcre.org/original/doc/html/pcrepattern.html
		"Arabic": y,
		"Armenian": y,
		"Avestan": y,
		"Balinese": y,
		"Bamum": y,
		"Bassa_Vah": y,
		"Batak": y,
		"Bengali": y,
		"Bopomofo": y,
		"Brahmi": y,
		"Braille": y,
		"Buginese": y,
		"Buhid": y,
		"Canadian_Aboriginal": y,
		"Carian": y,
		"Caucasian_Albanian": y,
		"Chakma": y,
		"Cham": y,
		"Cherokee": y,
		"Common": y,
		"Coptic": y,
		"Cuneiform": y,
		"Cypriot": y,
		"Cyrillic": y,
		"Deseret": y,
		"Devanagari": y,
		"Duployan": y,
		"Egyptian_Hieroglyphs": y,
		"Elbasan": y,
		"Ethiopic": y,
		"Georgian": y,
		"Glagolitic": y,
		"Gothic": y,
		"Grantha": y,
		"Greek": y,
		"Gujarati": y,
		"Gurmukhi": y,
		"Han": y,
		"Hangul": y,
		"Hanunoo": y,
		"Hebrew": y,
		"Hiragana": y,
		"Imperial_Aramaic": y,
		"Inherited": y,
		"Inscriptional_Pahlavi": y,
		"Inscriptional_Parthian": y,
		"Javanese": y,
		"Kaithi": y,
		"Kannada": y,
		"Katakana": y,
		"Kayah_Li": y,
		"Kharoshthi": y,
		"Khmer": y,
		"Khojki": y,
		"Khudawadi": y,
		"Lao": y,
		"Latin": y,
		"Lepcha": y,
		"Limbu": y,
		"Linear_A": y,
		"Linear_B": y,
		"Lisu": y,
		"Lycian": y,
		"Lydian": y,
		"Mahajani": y,
		"Malayalam": y,
		"Mandaic": y,
		"Manichaean": y,
		"Meetei_Mayek": y,
		"Mende_Kikakui": y,
		"Meroitic_Cursive": y,
		"Meroitic_Hieroglyphs": y,
		"Miao": y,
		"Modi": y,
		"Mongolian": y,
		"Mro": y,
		"Myanmar": y,
		"Nabataean": y,
		"New_Tai_Lue": y,
		"Nko": y,
		"Ogham": y,
		"Ol_Chiki": y,
		"Old_Italic": y,
		"Old_North_Arabian": y,
		"Old_Permic": y,
		"Old_Persian": y,
		"Old_South_Arabian": y,
		"Old_Turkic": y,
		"Oriya": y,
		"Osmanya": y,
		"Pahawh_Hmong": y,
		"Palmyrene": y,
		"Pau_Cin_Hau": y,
		"Phags_Pa": y,
		"Phoenician": y,
		"Psalter_Pahlavi": y,
		"Rejang": y,
		"Runic": y,
		"Samaritan": y,
		"Saurashtra": y,
		"Sharada": y,
		"Shavian": y,
		"Siddham": y,
		"Sinhala": y,
		"Sora_Sompeng": y,
		"Sundanese": y,
		"Syloti_Nagri": y,
		"Syriac": y,
		"Tagalog": y,
		"Tagbanwa": y,
		"Tai_Le": y,
		"Tai_Tham": y,
		"Tai_Viet": y,
		"Takri": y,
		"Tamil": y,
		"Telugu": y,
		"Thaana": y,
		"Thai": y,
		"Tibetan": y,
		"Tifinagh": y,
		"Tirhuta": y,
		"Ugaritic": y,
		"Vai": y,
		"Warang_Citi": y,
		"Yi": y
	},

	unicodeCategories: {
		// from: http://www.pcre.org/original/doc/html/pcrepattern.html
		"C": y, // Other
		"Cc": y, // Control
		"Cf": y, // Format
		"Cn": y, // Unassigned
		"Co": y, // Private use
		"Cs": y, // Surrogate
		"L": y, // Letter
		"L&": y, // Any letter 
		"Ll": y, // Lower case letter
		"Lm": y, // Modifier letter
		"Lo": y, // Other letter
		"Lt": y, // Title case letter
		"Lu": y, // Upper case letter
		"M": y, // Mark
		"Mc": y, // Spacing mark
		"Me": y, // Enclosing mark
		"Mn": y, // Non-spacing mark
		"N": y, // Number
		"Nd": y, // Decimal number
		"Nl": y, // Letter number
		"No": y, // Other number
		"P": y, // Punctuation
		"Pc": y, // Connector punctuation
		"Pd": y, // Dash punctuation
		"Pe": y, // Close punctuation
		"Pf": y, // Final punctuation
		"Pi": y, // Initial punctuation
		"Po": y, // Other punctuation
		"Ps": y, // Open punctuation
		"S": y, // Symbol
		"Sc": y, // Currency symbol
		"Sk": y, // Modifier symbol
		"Sm": y, // Mathematical symbol
		"So": y, // Other symbol
		"Z": y, // Separator
		"Zl": y, // Line separator
		"Zp": y, // Paragraph separator
		"Zs": y // Space separator
	},

	posixCharClasses: {
		// from: http://www.pcre.org/original/doc/html/pcrepattern.html
		"alnum": y, // letters and digits
		"alpha": y, // letters
		"ascii": y, // character codes 0 - 127
		"blank": y, // space or tab only
		"cntrl": y, // control characters
		"digit": y, // decimal digits (same as \d)
		"graph": y, // printing characters, excluding space
		"lower": y, // lower case letters
		"print": y, // printing characters, including space
		"punct": y, // printing characters, excluding letters and digits and space
		"space": y, // white space (the same as \s from PCRE 8.34)
		"upper": y, // upper case letters
		"word": y, // "word" characters (same as \w)
		"xdigit": y // hexadecimal digits
	},

	modes: {
		"i": "caseinsensitive",
		"s": "dotall",
		"m": "multiline",
		"x": "freespacing",
		"J": "samename",
		"U": "switchlazy"
	},

	tokens: {
		// note that not all of these are actively used in the lexer, but are included for completeness.
		"open": y, // opening /
		"close": y, // closing /
		"char": y, // abc

		// classes:
		// also in escCharTypes and charTypes
		"set": y, // [a-z]
		"setnot": y, // [^a-z]
		"setclose": y, // ]
		"range": y, // [a-z]
		"unicodecat": y, // \p{Ll} \P{^Ll} \pL
		"notunicodecat": y, // \P{Ll} \p{^Ll} \PL
		"unicodescript": y, // \p{Cherokee} \P{^Cherokee}
		"notunicodescript": y, // \P{Cherokee} \p{^Cherokee}
		"posixcharclass": y, // [[:alpha:]]
		// not in supported flavors:	"posixcollseq": y, // [[.foo.]] // this is recognized by the lexer, currently returns "notsupported" error
		// not in supported flavors:	"unicodeblock": y, // \p{InThai} \p{IsThai} and NOT \P
		// not in supported flavors:	"subtract": y, // [base-[subtract]]
		// not in supported flavors:	"intersect": y, // [base&&[intersect]]

		// esc:
		// also in escCharCodes and escCharTypes
		"escoctal": y, // \11
		"escunicodeu": y, // \uFFFF
		"escunicodeub": y, // \u{00A9}
		"escunicodexb": y, // \x{00A9}
		"escsequence": y, // \Q...\E
		"eschexadecimal": y, // \xFF
		"esccontrolchar": y, // \cA
		"escoctalo": y, // \o{377} // resolved to escoctal in lexer, no docs required
		"escchar": y, // \m (unrecognized escapes) // no reference documentation required

		// group:
		"group": y, // (foo)
		"groupclose": y, // )
		"noncapgroup": y, // (?:foo)
		"namedgroup": y, // (?P<name>foo) (?<name>foo) (?'name'foo)
		"atomic": y, // (?>foo|bar)
		"define": y, // (?(DEFINE)foo)
		"branchreset": y, // (?|(a)|(b))

		// lookaround:
		"poslookbehind": y, // (?<=foo)
		"neglookbehind": y, // (?<!foo)
		"poslookahead": y, // (?=foo)
		"neglookahead": y, // (?!foo)

		// ref:
		"namedref": y, // \k<name> \k'name' \k{name} (?P=name)  \g{name}
		"numref": y, // \1
		"extnumref": y, // \g{-1} \g{+1} \g{1} \g1 \g-1
		"recursion": y, // (?R) (?0) \g<0> \g'0'
		"numsubroutine": y, // \g<1> \g'-1' (?1) (?-1)
		"namedsubroutine": y, // \g<name> \g'name' (?&name) (?P>name)

		// quantifiers:
		// also in specialChars
		"quant": y, // {1,2}
		"possessive": y, // ++
		"lazy": y, // ?

		// special:
		"conditional": y, // (?(?=if)then|else)
		"condition": y, // (?=if) any lookaround
		"conditionalelse": y, // |
		"conditionalgroup": y, // (?(1)a|b) (?(-1)a|b) (?(name)a|b)
		"mode": y, // (?i-x) see modes above
		"comment": y // (?#comment)
	},

	substTokens: {
		// named references aren't supported in JS or PCRE / PHP
		"subst_$esc": y, // $$
		"subst_$&match": y, // $&
		"subst_$before": y, // $`
		"subst_$after": y, // $'
		"subst_$group": y, // $1 $99 // resolved to subst_group in lexer, no docs required
		"subst_$bgroup": y, // ${1} ${99} // resolved to subst_group in lexer, no docs required
		"subst_bsgroup": y, // \1 \99 // resolved to subst_group in lexer, no docs required
		"subst_group": y, // $1 \1 \{1} // combined in docs, not used by lexer
		"subst_0match": y, // $0 \0 \{0}

		// this isn't a feature of the engine, but of RegExr:
		"subst_esc": y // \n \r \u1234
	},

	config: {
		"forwardref": y, // \1(a)
		"nestedref": y, // (\1a|b)+
		"ctrlcodeerr": y, // does \c error? (vs decompose)
		"reftooctalalways": y, // does a single digit reference \1 become an octal? (vs remain an unmatched ref)
		"substdecomposeref": y, // will a subst reference decompose? (ex. \3 becomes "\" & "3" if < 3 groups)
		"looseesc": y // should unrecognized escape sequences match the character (ex. \u could match "u") // disabled when `u` flag is set
	},

	docs: {
		// for example:
		//possessive: {desc: "+This will be appended to the existing entry." },
		//namedgroup: {tip: "This will overwrite the existing entry." }
	}
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
The PCRE profile is almost a straight copy of the core profile.
*/
var y$1 = true;
var n$1 = false;

var pcre = {
	id: "pcre",
	label: "PCRE",
	browser: false,

	flags: {
		"u": n$1,
		"y": n$1
	},

	badEscChars: "uUlLN".split("").reduce(function (o, c) {
		o[c] = y$1;return o;
	}, {}),

	escCharCodes: {
		"v": n$1 // vertical tab // PCRE support \v as vertical whitespace
	},

	tokens: {
		"escunicodeu": n$1, // \uFFFF
		"escunicodeub": n$1 // \u{00A9}
		// octalo PCRE 8.34+
	},

	substTokens: {
		"subst_$esc": n$1, // $$
		"subst_$&match": n$1, // $&
		"subst_$before": n$1, // $`
		"subst_$after": n$1 // $'
	},

	config: {
		"reftooctalalways": n$1, // does a single digit reference \1 become an octal? (vs remain an unmatched ref)
		"substdecomposeref": n$1, // will a subst reference decompose? (ex. \3 becomes "\" & "3" if < 3 groups)
		"looseesc": n$1 // should unrecognized escape sequences match the character (ex. \u could match "u") // disabled when `u` flag is set
	},

	docs: {
		"escoctal": { ext: "+<p>The syntax <code>\\o{FFF}</code> is also supported.</p>" },
		"numref": {
			ext: "<p>There are multiple syntaxes for this feature: <code>\\1</code> <code>\\g1</code> <code>\\g{1}</code>.</p>" + "<p>The latter syntaxes support relative values preceded by <code>+</code> or <code>-</code>. For example <code>\\g-1</code> would match the group preceding the reference.</p>"
		},
		"lazy": { ext: "+<p>This behaviour is reversed by the ungreedy (<code>U</code>) flag/modifier.</p>" }
	}
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
The javascript profile disables a large number of features.
*/

var n$2 = false;
function testFlag(flag) {
	try {
		new RegExp(".", flag);
	} catch (e) {
		return n$2;
	}
}
var unicodeFlag = testFlag("u");
var stickyFlag = testFlag("y");

var javascript = {
	id: "js",
	label: "JavaScript",
	browser: true,

	flags: {
		"s": n$2,
		"x": n$2,
		"u": unicodeFlag,
		"y": stickyFlag,
		"U": n$2
	},

	escCharCodes: {
		"a": n$2, // bell
		"e": n$2 // escape
	},

	escCharTypes: {
		"A": n$2, // bos
		"G": n$2, // prevmatchend
		"h": n$2, // hwhitespace
		"H": n$2, // nothwhitespace
		"K": n$2, // keepout
		"N": n$2, // notlinebreak
		"R": n$2, // newline
		"v": n$2, // vwhitespace
		"V": n$2, // notvwhitespace
		"X": n$2, // unicodegrapheme
		"Z": n$2, // eos
		"z": n$2 // abseos
	},

	unicodeScripts: n$2,

	unicodeCategories: n$2,

	posixCharClasses: n$2,

	modes: n$2,

	tokens: {
		// classes:
		// also in escCharSpecials and specialChars
		"unicodecat": n$2, // \p{Ll} \P{^Ll} \pL
		"notunicodecat": n$2, // \P{Ll} \p{^Ll} \PL
		"unicodescript": n$2, // \p{Cherokee} \P{^Cherokee}
		"notunicodescript": n$2, // \P{Cherokee} \p{^Cherokee}
		"posixcharclass": n$2, // [[:alpha:]]

		// esc:
		// also in escCharCodes and escCharSpecials
		"escunicodeub": unicodeFlag, // \u{00A9}
		"escunicodexb": n$2, // \x{00A9}
		"escsequence": n$2, // \Q...\E
		"escoctalo": n$2, // \o{377}

		// group:
		"namedgroup": n$2, // (?P<name>foo) (?<name>foo) (?'name'foo)
		"atomic": n$2, // (?>foo|bar)
		"define": n$2, // (?(DEFINE)foo)
		"branchreset": n$2, // (?|(a)|(b))

		// lookaround:
		"poslookbehind": n$2, // (?<=foo)
		"neglookbehind": n$2, // (?<!foo)

		// ref:
		"namedref": n$2, // \k<name> \k'name' \k{name} (?P=name)  \g{name}
		"extnumref": n$2, // \g{-1} \g{+1} \g{1} \g1 \g-1
		"recursion": n$2, // (?R) (?0) \g<0> \g'0'
		"numsubroutine": n$2, // \g<1> \g'-1' (?1) (?-1)
		"namedsubroutine": n$2, // \g<name> \g'name' (?&name) (?P>name)

		// quantifiers:
		// also in specialChars
		"possessive": n$2,

		// special:
		"conditional": n$2, // (?(?=if)then|else)
		"conditionalif": n$2, // (?=if) any lookaround
		"conditionalelse": n$2, // |
		"conditionalgroup": n$2, // (?(1)a|b) (?(-1)a|b) (?(name)a|b)
		"mode": n$2, // (?i-x) see modes above
		"comment": n$2 // (?#comment)
	},

	config: {
		"forwardref": n$2, // \1(a)
		"nestedref": n$2, // (\1a|b)+
		"ctrlcodeerr": n$2 // does \c error, or decompose?
	},

	substTokens: {
		"subst_0match": n$2, // $0 \0 \{0}
		"subst_$bgroup": n$2, // ${1} ${99}
		"subst_bsgroup": n$2 // \1 \99
	},

	docs: {
		"subst_group": { ext: "" // remove other syntaxes.
		} }
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var profiles = { core: core };
profiles.pcre = merge(core, pcre);
profiles.js = merge(core, javascript);

function merge(p1, p2) {
	// merges p1 into p2, essentially just a simple deep copy without array support.
	for (var n in p1) {
		if (p2[n] === false) {
			continue;
		} else if (_typeof(p1[n]) === "object") {
			p2[n] = merge(p1[n], p2[n] || {});
		} else if (p2[n] === undefined) {
			p2[n] = p1[n];
		}
	}
	return p2;
}

var _templateObject = taggedTemplateLiteral(["<svg class=\"inline check icon\"><use xlink:href=\"#check\"></use></svg> ", ""], ["<svg class=\"inline check icon\"><use xlink:href=\"#check\"></use></svg> ", ""]);

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Expression = function (_EventDispatcher) {
	inherits(Expression, _EventDispatcher);

	function Expression(el) {
		classCallCheck(this, Expression);

		var _this = possibleConstructorReturn(this, (Expression.__proto__ || Object.getPrototypeOf(Expression)).call(this));

		_this.el = el;
		_this.delim = "/";
		_this.lexer = new ExpressionLexer();

		_this._initUI(el);
		app.flavor.on("change", function () {
			return _this._onFlavorChange();
		});
		_this._onFlavorChange();
		return _this;
	}

	createClass(Expression, [{
		key: "showFlags",
		value: function showFlags() {
			this.flagsList.selected = this.flags.split("");
			app.tooltip.toggle.toggleOn("flags", this.flagsEl, this.flagsBtn, true, -2);
		}
	}, {
		key: "toggleFlag",
		value: function toggleFlag(s) {
			var flags = this.flags,
			    i = flags.indexOf(s);
			this.flags = i >= 0 ? flags.replace(s, "") : flags + s;
		}
	}, {
		key: "showFlavors",
		value: function showFlavors() {
			app.tooltip.toggle.toggleOn("flavor", this.flavorEl, this.flavorBtn, true, -2);
		}
	}, {
		key: "insert",
		value: function insert(str) {
			this.editor.replaceSelection(str, "end");
		}

		// private methods:

	}, {
		key: "_initUI",
		value: function _initUI(el) {
			var _this2 = this;

			this.editorEl = DOMUtils.query("> .editor", el);
			var editor = this.editor = CMUtils.create(this.editorEl, {
				autofocus: true,
				maxLength: 2500,
				singleLine: true
			}, "100%", "100%");

			editor.on("mousedown", function (cm, evt) {
				return _this2._onEditorMouseDown(cm, evt);
			});
			editor.on("change", function (cm, evt) {
				return _this2._onEditorChange(cm, evt);
			});
			editor.on("keydown", function (cm, evt) {
				return _this2._onEditorKeyDown(cm, evt);
			});
			// hacky method to disable overwrite mode on expressions to avoid overwriting flags:
			editor.toggleOverwrite = function () {};

			this.errorEl = DOMUtils.query(".icon.alert", this.editorEl);
			this.errorEl.addEventListener("mouseenter", function (evt) {
				return _this2._onMouseError(evt);
			});
			this.errorEl.addEventListener("mouseleave", function (evt) {
				return _this2._onMouseError(evt);
			});

			this.highlighter = new ExpressionHighlighter(editor);
			this.hover = new ExpressionHover(editor, this.highlighter);

			this._setInitialExpression();
			this._initTooltips(el);
			this.value = Expression.DEFAULT_EXPRESSION;
		}
	}, {
		key: "_setInitialExpression",
		value: function _setInitialExpression() {
			var editor = this.editor;
			editor.setValue("/./g");

			// leading /
			editor.getDoc().markText({ line: 0, ch: 0 }, {
				line: 0,
				ch: 1
			}, {
				className: "exp-decorator",
				readOnly: true,
				atomic: true,
				inclusiveLeft: true
			});

			// trailing /g
			editor.getDoc().markText({ line: 0, ch: 2 }, {
				line: 0,
				ch: 4
			}, {
				className: "exp-decorator",
				readOnly: false,
				atomic: true,
				inclusiveRight: true
			});
			this._deferUpdate();
		}
	}, {
		key: "_deferUpdate",
		value: function _deferUpdate() {
			var _this3 = this;

			Utils.defer(function () {
				return _this3._update();
			}, "Expression._update");
		}
	}, {
		key: "_update",
		value: function _update() {
			var expr = this.editor.getValue();
			this.lexer.profile = app.flavor.profile;
			var token = this.lexer.parse(expr);
			DOMUtils.toggleClass(this.editorEl, "error", !!this.lexer.errors.length);
			this.hover.token = token;
			this.highlighter.draw(token);
			this.dispatchEvent("change");
		}
	}, {
		key: "_initTooltips",
		value: function _initTooltips(el) {
			var _this4 = this;

			var template = DOMUtils.template(_templateObject, "label");
			var flavorData = app.flavor.profiles.map(function (o) {
				return { id: o.id, label: o.label + " (" + (o.browser ? "Browser" : "Server") + ")" };
			});

			this.flavorBtn = DOMUtils.query("section.expression .button.flavor", el);
			this.flavorEl = DOMUtils.query("#library #tooltip-flavor");
			this.flavorList = new List(DOMUtils.query("ul.list", this.flavorEl), { data: flavorData, template: template });
			this.flavorList.on("change", function () {
				return _this4._onFlavorListChange();
			});
			this.flavorBtn.addEventListener("click", function (evt) {
				return _this4.showFlavors();
			});
			DOMUtils.query(".icon.help", this.flavorEl).addEventListener("click", function () {
				return app.sidebar.goto("engine");
			});

			this.flagsBtn = DOMUtils.query("section.expression .button.flags", el);
			this.flagsEl = DOMUtils.query("#library #tooltip-flags");
			this.flagsList = new List(DOMUtils.query("ul.list", this.flagsEl), { data: [], multi: true, template: template });
			this.flagsList.on("change", function () {
				return _this4._onFlagListChange();
			});
			this.flagsBtn.addEventListener("click", function (evt) {
				return _this4.showFlags();
			});
			DOMUtils.query(".icon.help", this.flagsEl).addEventListener("click", function () {
				return app.sidebar.goto("flags");
			});
		}

		// event handlers:

	}, {
		key: "_onFlavorListChange",
		value: function _onFlavorListChange() {
			app.tooltip.toggle.hide("flavor");
			app.flavor.value = this.flavorList.selected;
		}
	}, {
		key: "_onFlagListChange",
		value: function _onFlagListChange() {
			var sel = this.flagsList.selected;
			this.flags = sel ? sel.join("") : "";
		}
	}, {
		key: "_onFlavorChange",
		value: function _onFlavorChange() {
			var flavor = app.flavor,
			    profile = flavor.profile;
			this.flavorList.selected = profile.id;
			DOMUtils.query("> .label", this.flavorBtn).innerText = profile.label;

			var supported = Expression.FLAGS.split("").filter(function (n) {
				return !!profile.flags[n];
			});
			var labels = Expression.FLAG_LABELS;
			this.flagsList.data = supported.map(function (n) {
				return { id: n, label: labels[n] };
			});
			this.flags = this.flags.split("").filter(function (n) {
				return !!profile.flags[n];
			}).join("");
		}
	}, {
		key: "_onEditorMouseDown",
		value: function _onEditorMouseDown(cm, evt) {
			// offset by half a character to make accidental clicks less likely:
			var index = CMUtils.getCharIndexAt(cm, evt.clientX - cm.defaultCharWidth() * 0.6, evt.clientY);
			if (index >= cm.getValue().lastIndexOf(this.delim)) {
				this.showFlags();
			}
		}
	}, {
		key: "_onEditorChange",
		value: function _onEditorChange(cm, evt) {
			// catches pasting full expressions in.
			// TODO: will need to be updated to work with other delimeters
			this._deferUpdate();
			var str = evt.text[0];
			if (str.length < 3 || !str.match(/^\/.+[^\\]\/[a-z]*$/ig) || evt.from.ch !== 1 || evt.to.ch != 1 + evt.removed[0].length) {
				// not pasting a full expression.
				return;
			}
			this.value = str;
		}
	}, {
		key: "_onEditorKeyDown",
		value: function _onEditorKeyDown(cm, evt) {
			// Ctrl or Command + D by default, will delete the expression and the flags field, Re: https://github.com/gskinner/regexr/issues/74
			// So we just manually reset to nothing here.
			if ((evt.ctrlKey || evt.metaKey) && evt.keyCode == 68) {
				evt.preventDefault();
				this.pattern = "";
			}
		}
	}, {
		key: "_onMouseError",
		value: function _onMouseError(evt) {
			var tt = app.tooltip.hover,
			    errs = this.lexer.errors;
			if (evt.type === "mouseleave") {
				return tt.hide("error");
			}
			if (errs.length === 0) {
				return;
			}
			var str = errs.length === 1 ? app.reference.getError(errs[0]) : "Errors in the Expression are underlined in <span class='exp-error'>red</span>. Roll over them for details.";
			tt.showOn("error", "<span class='error'>PARSE ERROR:</span> " + str, this.errorEl);
		}
	}, {
		key: "value",
		set: function set$$1(expression) {
			var regex = Utils.decomposeRegEx(expression || Expression.DEFAULT_EXPRESSION, this.delim);
			this.pattern = regex.source;
			this.flags = regex.flags;
		},
		get: function get$$1() {
			return this.editor.getValue();
		}
	}, {
		key: "pattern",
		set: function set$$1(pattern) {
			var index = this.editor.getValue().lastIndexOf(this.delim);
			this.editor.replaceRange(pattern, { line: 0, ch: 1 }, { line: 0, ch: index });
			this._deferUpdate();
		},
		get: function get$$1() {
			return Utils.decomposeRegEx(this.editor.getValue(), this.delim).source;
		}
	}, {
		key: "flags",
		set: function set$$1(flags) {
			flags = app.flavor.validateFlagsStr(flags);
			Track.event("set_flags", "engagement", { flags: flags });
			var str = this.editor.getValue(),
			    index = str.lastIndexOf(this.delim);
			this.editor.replaceRange(flags, { line: 0, ch: index + 1 }, { line: 0, ch: str.length }); // this doesn't work if readOnly is false.
		},
		get: function get$$1() {
			return Utils.decomposeRegEx(this.editor.getValue(), this.delim).flags;
		}
	}, {
		key: "token",
		get: function get$$1() {
			return this.lexer.token;
		}
	}]);
	return Expression;
}(EventDispatcher);

Expression.DEFAULT_EXPRESSION = "/([A-Z])\\w+/g";

Expression.FLAGS = "gimsuxyU"; // for flag order
Expression.FLAG_LABELS = {
	"g": "<em>g</em>lobal",
	"i": "case <em>i</em>nsensitive",
	"m": "<em>m</em>ultiline",
	"s": "<em>s</em>ingle line (dotall)",
	"u": "<em>u</em>nicode",
	"x": "e<em>x</em>tended",
	"y": "stick<em>y</em>",
	"U": "<em>U</em>ngreedy"
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var TextHighlighter = function () {
	function TextHighlighter(editor, canvas) {
		var fill = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "#6CF";
		var stroke = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "#888";
		classCallCheck(this, TextHighlighter);

		this.lineSpacing = 2;
		this.capWidth = 4;
		this.lastBottom = -1;
		this.lastRight = -1;
		this.editor = editor;
		this.canvas = canvas;
		this.fill = fill;
		this.stroke = stroke;
	}

	createClass(TextHighlighter, [{
		key: "_deferUpdate",
		value: function _deferUpdate() {
			var _this = this;

			Utils.defer(function () {
				return _this._update();
			}, "TextHighlighter._update");
		}
	}, {
		key: "_update",
		value: function _update() {
			this.clear();
			var matches = this._matches,
			    hoverMatch = this._hoverMatch,
			    selectedMatch = this._selectedMatch;
			if (!matches || !matches.length) {
				return;
			}

			var cm = this.editor,
			    doc = cm.getDoc();
			var ctx = this.canvas.getContext("2d");
			ctx.fillStyle = this.fill;
			ctx.strokeStyle = this.stroke;
			ctx.lineWidth = 2;

			// find the range of the visible text:
			var scroll = cm.getScrollInfo();
			var top = cm.indexFromPos(cm.coordsChar({
				left: 0,
				top: scroll.top
			}, "local"));
			var bottom = cm.indexFromPos(cm.coordsChar({
				left: scroll.clientWidth,
				top: scroll.top + scroll.clientHeight
			}, "local"));

			for (var i = 0, l = matches.length; i < l; i++) {
				var match = matches[i],
				    start = match.i,
				    end = match.i + match.l - 1;

				if (start > bottom) {
					break;
				} // all done.
				if (end < top || end < start) {
					continue;
				} // not visible, so don't mark.
				var startPos = match.startPos || (match.startPos = doc.posFromIndex(start));
				var endPos = match.endPos || (match.endPos = doc.posFromIndex(end));
				var emphasis = match === hoverMatch || match === selectedMatch;

				var startRect = cm.charCoords(startPos, "local"),
				    endRect = cm.charCoords(endPos, "local");

				if (startRect.bottom === endRect.bottom) {
					this.drawHighlight(ctx, startRect.left, startRect.top, endRect.right, endRect.bottom, scroll.top, false, false, emphasis);
				} else {
					var lw = cm.getScrollInfo().width,
					    lh = cm.defaultTextHeight();
					// render first line:
					this.drawHighlight(ctx, startRect.left, startRect.top, lw - 2, startRect.bottom, scroll.top, false, true, emphasis); // startRect.top+lh
					// render lines in between:
					var y = startRect.top;
					while ((y += lh) < endRect.top - 1) {
						// the -1 is due to fractional issues on FF
						this.drawHighlight(ctx, 0, y, lw - 2, y + startRect.bottom - startRect.top, scroll.top, true, true, emphasis); // lh
					}
					// render last line:
					this.drawHighlight(ctx, 0, endRect.top, endRect.right, endRect.bottom, scroll.top, true, false, emphasis);
					// CMUtils.getEOLPos(this.sourceCM, startPos);
				}
			}
		}
	}, {
		key: "drawHighlight",
		value: function drawHighlight(ctx, left, top, right, bottom, scrollY, startCap, endCap, emphasis) {
			var capW = this.capWidth;

			if (right < 0 || left + 1 >= right) {
				return;
			} // weird bug in CodeMirror occasionally returns negative values
			left = left + 0.5 | 0;
			right = right + 0.5 | 0;
			top = (top + 0.5 | 0) + this.lineSpacing;
			bottom = bottom + 0.5 | 0;

			if (top + 1 > this.lastBottom) {
				this.lastBottom = bottom;
			} else if (left < this.lastRight) {
				left = this.lastRight;
			}
			this.lastRight = right;

			var a = ctx.globalAlpha;
			if (startCap) {
				ctx.globalAlpha = a * 0.5;
				ctx.fillRect(left + 1 | 0, top - scrollY, capW + 1, bottom - top);
				left += capW;
			}
			if (endCap) {
				ctx.globalAlpha = a * 0.5;
				ctx.fillRect(right - capW - 1 | 0, top - scrollY, capW + 1, bottom - top);
				right -= capW;
			}
			ctx.globalAlpha = a;
			ctx.fillRect(left + 1, top - scrollY, right - left - 1, bottom - top);

			if (emphasis) {
				ctx.strokeRect(left + 1, top - scrollY, right - left - 1, bottom - top);
			}
		}
	}, {
		key: "clear",
		value: function clear() {
			this.canvas.width = this.canvas.width;
			this.lastBottom = -1;
		}
	}, {
		key: "matches",
		set: function set$$1(val) {
			this._matches = val;
			this._deferUpdate();
		}
	}, {
		key: "hoverMatch",
		set: function set$$1(val) {
			this._hoverMatch = val;
			this._deferUpdate();
		}
	}, {
		key: "selectedMatch",
		set: function set$$1(val) {
			this._selectedMatch = val;
			this._deferUpdate();
		}
	}]);
	return TextHighlighter;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var TextHover = function () {
	function TextHover(editor, highlighter) {
		var _this = this;

		classCallCheck(this, TextHover);

		this.editor = editor;
		this.highlighter = highlighter;
		this.matches = null;

		var o = editor.display.lineDiv;
		o.addEventListener("mousemove", function (evt) {
			return _this._handleMouseMove(evt);
		});
		o.addEventListener("mouseout", function (evt) {
			return _this._handleMouseOut(evt);
		});
	}

	// private methods:


	createClass(TextHover, [{
		key: "_handleMouseMove",
		value: function _handleMouseMove(evt) {
			var index = void 0,
			    cm = this.editor,
			    match = void 0,
			    matches = this.matches;

			if (matches && matches.length && (index = CMUtils.getCharIndexAt(cm, evt.clientX, evt.clientY + window.pageYOffset)) != null) {
				match = this.highlighter.hoverMatch = app.text.getMatchAt(index);
			}
			var rect = index != null && CMUtils.getCharRect(cm, index);
			if (rect) {
				rect.right = rect.left = evt.clientX;
			}
			app.tooltip.hover.show("TextHover", app.reference.tipForMatch(match, cm.getValue()), evt.clientX, rect.bottom, true, 0);
		}
	}, {
		key: "_handleMouseOut",
		value: function _handleMouseOut(evt) {
			this.highlighter.hoverMatch = null;
			app.tooltip.hover.hide("TextHover");
		}
	}]);
	return TextHover;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Text = function (_EventDispatcher) {
	inherits(Text, _EventDispatcher);

	function Text(el) {
		classCallCheck(this, Text);

		var _this = possibleConstructorReturn(this, (Text.__proto__ || Object.getPrototypeOf(Text)).call(this));

		_this.el = el;
		_this._initUI(el);
		app.on("result", function () {
			return _this._setResult(app.result);
		});
		return _this;
	}

	createClass(Text, [{
		key: "getMatchValue",
		value: function getMatchValue(match) {
			// this also works for groups.
			return match ? this.value.substr(match.i, match.l) : null;
		}
	}, {
		key: "getMatchAt",
		value: function getMatchAt(index, inclusive) {
			// also used by TextHover
			var match = void 0,
			    offset = inclusive ? -1 : 0,
			    matches = this._result && this._result.matches;
			if (!matches) {
				return null;
			}
			for (var i = 0, l = matches.length; i < l; i++) {
				match = matches[i];
				if (match.l + match.i - 1 < index + offset) {
					continue;
				}
				if (match.i > index) {
					break;
				}
				return match;
			}
			return null;
		}

		// private methods:

	}, {
		key: "_initUI",
		value: function _initUI(el) {
			var _this2 = this;

			this.resultEl = DOMUtils.query("> header .result", el);
			this.resultEl.addEventListener("mouseenter", function (evt) {
				return _this2._mouseResult(evt);
			});
			this.resultEl.addEventListener("mouseleave", function (evt) {
				return _this2._mouseResult(evt);
			});

			var textEl = DOMUtils.query("> .editor > .pad", el);
			this.defaultText = DOMUtils.query("textarea", textEl).value;
			var editor = this.editor = CMUtils.create(DOMUtils.empty(textEl), { lineWrapping: true }, "100%", "100%");
			editor.setValue(this.defaultText);

			editor.on("change", function () {
				return _this2._change();
			});
			editor.on("scroll", function () {
				return _this2._update();
			});
			editor.on("cursorActivity", function () {
				return _this2._updateSelected();
			});

			var detector = DOMUtils.create("iframe", "resizedetector", null, textEl),
			    win = detector.contentWindow;
			var canvas = this.canvas = DOMUtils.create("canvas", "highlights", null, textEl);
			textEl.appendChild(editor.display.wrapper); // move the editor on top of the iframe & canvas.

			win.onresize = function () {
				_this2._startResize();
				Utils.defer(function () {
					return _this2._handleResize(win);
				}, "text_resize", 250);
			};
			win.onresize();

			this.highlighter = new TextHighlighter(editor, canvas, DOMUtils.getCSSValue("match", "color"), DOMUtils.getCSSValue("selected-stroke", "color"));
			this.hover = new TextHover(editor, this.highlighter);
		}
	}, {
		key: "_setResult",
		value: function _setResult(val) {
			this._result = val;
			this._updateEmptyCount();
			this._updateResult();
			this._deferUpdate();
		}
	}, {
		key: "_updateResult",
		value: function _updateResult() {
			var result = this._result,
			    matches = result && result.matches,
			    l = matches && matches.length,
			    el = this.resultEl;
			DOMUtils.removeClass(el, "error matches");
			if (result && result.error) {
				el.innerText = "ERROR";
				DOMUtils.addClass(el, "error");
			} else if (l) {
				el.innerHTML = l + " match" + (l > 1 ? "es" : "") + (this._emptyCount ? "*" : "") + (result.time != null ? "<em> (" + parseFloat(result.time).toFixed(1) + "ms)</em>" : "");
				DOMUtils.addClass(el, "matches");
			} else {
				el.innerText = "No match";
			}
			this._updateSelected();
		}
	}, {
		key: "_updateSelected",
		value: function _updateSelected() {
			var match = this.selectedMatch;
			if (this.highlighter.selectedMatch === match) {
				return;
			}
			this.highlighter.selectedMatch = match;
			this.dispatchEvent("select");
		}
	}, {
		key: "_change",
		value: function _change() {
			this.dispatchEvent("change");
		}
	}, {
		key: "_deferUpdate",
		value: function _deferUpdate() {
			var _this3 = this;

			Utils.defer(function () {
				return _this3._update();
			}, "Text._update");
		}
	}, {
		key: "_update",
		value: function _update() {
			var result = this._result,
			    matches = result && result.matches;
			this.hover.matches = this.highlighter.matches = matches;
		}
	}, {
		key: "_startResize",
		value: function _startResize() {
			var canvas = this.canvas,
			    style = canvas.style;
			style.visibility = "hidden";
			style.opacity = 0;
			// keeps it from causing scrollbars:
			canvas.width = canvas.height = 1;
		}
	}, {
		key: "_mouseResult",
		value: function _mouseResult(evt) {
			var tt = app.tooltip.hover,
			    res = this._result,
			    err = res && res.error,
			    str = void 0;
			if (evt.type === "mouseleave") {
				return tt.hide("result");
			}
			if (err) {
				str = "<span class='error'>EXEC ERROR:</span> " + this._errorText(err);
			} else {
				var l = res && res.matches && res.matches.length;
				str = (l || "No") + " match" + (l > 1 ? "es" : "") + " found in " + this.value.length + " characters";
				str += this._emptyCount ? ", including " + this._emptyCount + " empty matches (* not displayed)." : ".";
				var cm = this.editor,
				    sel = cm.listSelections()[0],
				    pos = sel.head;
				var i0 = cm.indexFromPos(pos),
				    i1 = cm.indexFromPos(sel.anchor),
				    range = Math.abs(i0 - i1);
				str += "<hr>Insertion point: line " + pos.line + ", col " + pos.ch + ", index " + i0;
				str += range > 0 ? " (" + range + " character" + (range === 1 ? "" : "s") + " selected)" : "";
			}
			tt.showOn("result", str, this.resultEl, false, -2);
		}
	}, {
		key: "_updateEmptyCount",
		value: function _updateEmptyCount() {
			var result = this._result,
			    matches = result && result.matches;
			this._emptyCount = matches ? matches.reduce(function (v, o) {
				return v + (o.l ? 0 : 1);
			}, 0) : 0;
		}
	}, {
		key: "_errorText",
		value: function _errorText(err) {
			return err.message || app.reference.getError(err.id);
		}
	}, {
		key: "_handleResize",
		value: function _handleResize(el) {
			var canvas = this.canvas,
			    style = canvas.style;
			style.visibility = style.opacity = "";
			canvas.width = el.innerWidth;
			canvas.height = el.innerHeight;
			this.editor.refresh();
			this._deferUpdate();
		}
	}, {
		key: "value",
		set: function set$$1(val) {
			this.editor.setValue(val || this.defaultText);
		},
		get: function get$$1() {
			return this.editor.getValue();
		}
	}, {
		key: "selectedMatch",
		get: function get$$1() {
			var cm = this.editor;
			return this.getMatchAt(cm.indexFromPos(cm.getCursor()), true);
		}
	}]);
	return Text;
}(EventDispatcher);

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Explain = function () {
	function Explain(el) {
		var _this = this;

		classCallCheck(this, Explain);

		this.el = el;
		DOMUtils.addClass(el, "explain");
		this._update();

		this._bound_handleEvent = function (evt) {
			return _this._handleEvent(evt);
		};
		app.expression.addEventListener("change", this._bound_handleEvent);
		app.expression.highlighter.addEventListener("hover", this._bound_handleEvent);
	}

	createClass(Explain, [{
		key: "cleanup",
		value: function cleanup() {
			DOMUtils.empty(this.el);
			DOMUtils.removeClass(this.el, "explain");
			app.expression.removeEventListener("change", this._bound_handleEvent);
			app.expression.highlighter.removeEventListener("hover", this._bound_handleEvent);
		}

		// private methods:

	}, {
		key: "_update",
		value: function _update() {
			var el = DOMUtils.empty(this.el),
			    token = app.expression.token,
			    expr = app.expression.value;
			this._divs = [];
			if (!token || token.next.type === "close") {
				el.innerHTML = "<span class='desc'>Enter an Expression above and it will be explained here.</span>";
				return;
			}
			el.innerHTML = "<span class='desc'>Roll-over elements below to highlight in the Expression above. Click to open in Reference.</span>";
			while ((token = token.next) && token.type !== "close") {

				if (token.proxy || token.open && token.open.proxy) {
					continue;
				}

				var groupClasses = ExpressionHighlighter.GROUP_CLASS_BY_TYPE,
				    pre = ExpressionHighlighter.CSS_PREFIX;
				var i = token.i,
				    end = token.i + token.l,
				    content = expr.substring(i, end).replace("<", "&lt;");
				if (token.set) {
					var set0 = token.set[0],
					    set2 = token.set[2];
					content = "<span class='" + pre + (set0.clss || set0.type) + "'>" + expr.substring(set0.i, set0.i + set0.l) + "</span>";
					content += expr.substring(i, end);
					content += "<span class='" + pre + (set2.clss || set2.type) + "'>" + expr.substring(set2.i, set2.i + set2.l) + "</span>";
				}

				var className = pre + (token.clss || token.type);
				content = "<code class='token " + className + "'>" + content + "</code> ";
				if (!token.open) {
					content += app.reference.tipForToken(token);
				} else {
					content += "&nbsp;";
				}
				var div = DOMUtils.create("div", null, content, el);

				if (token.close) {
					className = groupClasses[token.clss || token.type];
					if (className) {
						className = className.replace("%depth%", Math.min(4, token.depth));
						DOMUtils.addClass(div, className);
					}
					if (token.depth > 3) {
						div.innerHTML = "So... you wanted to see what would happen if you just kept nesting groups, eh? Well, this is it." + " I was going to reward your curiosity with a RegEx joke, but a quick search on google reveals that not even" + " the collective wisdom of the internet can make regular expressions funny. Well, except the whole 'now you've got two problems'" + " shtick, but you've probably heard that one already. Wasn't really worth the effort, was it?";
						token = token.close.prv;
						this._divs.push(div);
						el = div;
						continue;
					}
					el = div;
				}

				div.token = token;

				if (token.open) {
					DOMUtils.addClass(div, "close");
					div.proxy = el;
					el = el.parentNode;
				}

				if (token.err) {
					DOMUtils.addClass(div, "error");
				}

				if (!token.open) {
					div.addEventListener("mouseover", this._handleMouseEvent);
					div.addEventListener("mouseout", this._handleMouseEvent);
					div.addEventListener("click", this._handleMouseEvent);
				}

				if (token.clss === "quant" || token.type === "lazy" || token.type === "possessive") {
					this._insertApplied(div);
				} else {
					this._divs.push(div);
				}
			}
		}
	}, {
		key: "_insertApplied",
		value: function _insertApplied(div) {
			var divs = this._divs,
			    prv = div.token.prv,
			    d = void 0,
			    i = divs.length;
			while ((d = divs[--i]) && d.token !== prv) {} // search backwards for efficiency
			d = d.proxy || d;
			divs.splice(i, 0, div);
			d.insertAdjacentElement("afterend", div);
			DOMUtils.addClass(div, "applied");
		}
	}, {
		key: "_handleHoverChange",
		value: function _handleHoverChange() {
			var token = app.expression.highlighter.hoverToken;
			DOMUtils.removeClass(DOMUtils.queryAll("div.selected", this.el), "selected");
			DOMUtils.removeClass(DOMUtils.queryAll("div.related", this.el), "related");
			if (!token) {
				return;
			}

			var div = this._findDiv(token);
			DOMUtils.addClass(div, "selected");
			if (token.related) {
				for (var i = 0, l = token.related.length; i < l; i++) {
					DOMUtils.addClass(this._findDiv(token.related[i]), "related");
				}
			}
		}
	}, {
		key: "_findDiv",
		value: function _findDiv(token) {
			return Utils.find(this._divs, function (div) {
				return div.token === token;
			});
		}
	}, {
		key: "_handleMouseEvent",
		value: function _handleMouseEvent(evt) {
			var type = evt.type,
			    token = evt.currentTarget.token;
			if (type == "click") {
				app.sidebar.showToken(token);
			} else {
				app.expression.highlighter.hoverToken = type === "mouseout" ? null : token;
			}
			evt.stopPropagation();
		}
	}, {
		key: "_handleEvent",
		value: function _handleEvent(evt) {
			if (evt.type === "change") {
				this._update();
			} else if (evt.type === "hover") {
				this._handleHoverChange();
			}
		}
	}]);
	return Explain;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Details = function () {
	function Details(el) {
		var _this = this;

		classCallCheck(this, Details);

		this.el = el;
		DOMUtils.addClass(el, "details");
		this._update();

		this._bound_handleEvent = function (evt) {
			return _this._handleEvent(evt);
		};
		app.addEventListener("result", this._bound_handleEvent);
		app.text.addEventListener("select", this._bound_handleEvent);
	}

	createClass(Details, [{
		key: "cleanup",
		value: function cleanup() {
			DOMUtils.empty(this.el);
			DOMUtils.removeClass(this.el, "details");
			app.removeEventListener("result", this._bound_handleEvent);
			app.text.removeEventListener("select", this._bound_handleEvent);
			Utils.defer(null, "Details._update");
		}

		// private methods:

	}, {
		key: "_update",
		value: function _update() {
			DOMUtils.empty(this.el);
			DOMUtils.create("div", "desc", "Click a <span class='match'>match</span> above to display match &amp; group details. Mouse over a <code>Group</code> row to highlight it in the Expression.", this.el);
			this._addMatch(app.text.selectedMatch, app.text.value);
		}
	}, {
		key: "_addMatch",
		value: function _addMatch(match, textVal) {
			if (!match) {
				return;
			}
			var groups = match.groups,
			    l = groups && groups.length,
			    ext = l && groups[0].i != null,
			    matchVal = this._getMatchVal(match, textVal),
			    extStr = "",
			    me = match.i + match.l;
			var groupTokens = app.expression.lexer.captureGroups;

			var tableEl = DOMUtils.create("table", null, null, this.el);
			var matchEl = DOMUtils.create("tr", "match", "<td>Match " + match.num + "</td><td>" + this._getRangeStr(match) + "</td><td></td>", tableEl);

			if (l) {
				var inGroups = [],
				    lastIndex = match.i;
				for (var i = 0; i <= l; i++) {
					var group = groups[i],
					    index = group ? group.i : me,
					    num = i + 1,
					    token = groupTokens[i];
					if (ext) {
						for (var j = inGroups.length - 1; j >= 0; j--) {
							var inGroup = inGroups[j],
							    ge = inGroup.i + inGroup.l;
							if (ge > index) {
								break;
							}
							inGroups.pop();
							extStr += Utils.htmlSafe(textVal.substring(lastIndex, ge)) + "</span>";
							lastIndex = ge;
						}
					}
					if (!group) {
						break;
					}
					if (group.l) {
						extStr += Utils.htmlSafe(textVal.substring(lastIndex, index)) + "<span class='group-" + num % 6 + " num-" + num + "'>";
						inGroups.push(group);
						lastIndex = index;
					}
					var val = "<span" + (ext ? " class='group-" + num % 6 + "'" : "") + ">" + this._getMatchVal(group, textVal) + "</span>";
					var label = token.name ? "'" + token.name + "'" : "Group " + num;
					var tr = DOMUtils.create("tr", "group", "<td>" + label + "</td><td>" + this._getRangeStr(group) + "</td><td>" + val + "</td>", tableEl);

					tr.token = token;
					tr.addEventListener("mouseover", this._handleMouseEvent);
					tr.addEventListener("mouseout", this._handleMouseEvent);
				}
				if (ext) {
					extStr += Utils.htmlSafe(textVal.substring(lastIndex, me));
				}
			} else {
				DOMUtils.create("tr", "nogroup", "<td colspan='3'>No groups.</td>", tableEl);
			}

			DOMUtils.query("td:last-child", matchEl).innerHTML = extStr || matchVal;
		}
	}, {
		key: "_getMatchVal",
		value: function _getMatchVal(match, str) {
			var val = match.s || (match.i === undefined ? "" : str.substr(match.i, match.l));
			return val ? Utils.htmlSafe(val) : "<em>&lt;empty&gt;</em>";
		}
	}, {
		key: "_getRangeStr",
		value: function _getRangeStr(match) {
			// we could check for match.l>0 to catch empty matches, but having a weird range might be more accurate.
			return match.i != null ? match.i + "-" + (match.i + match.l - 1) : "n/a";
		}
	}, {
		key: "_handleEvent",
		value: function _handleEvent(evt) {
			var _this2 = this;

			Utils.defer(function () {
				return _this2._update();
			}, "Details._update");
		}
	}, {
		key: "_handleMouseEvent",
		value: function _handleMouseEvent(evt) {
			var type = evt.type,
			    token = evt.currentTarget.token;
			app.expression.highlighter.hoverToken = type === "mouseout" ? null : token;
			if (type === "mouseover") {
				DOMUtils.addClass(DOMUtils.query("span.num-" + token.num, this.el), "hover");
			} else {
				DOMUtils.removeClass(DOMUtils.query("span.hover", this.el), "hover");
			}
			evt.stopPropagation();
		}
	}]);
	return Details;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Replace = function () {
	function Replace(el, cm) {
		var _this = this;

		classCallCheck(this, Replace);

		this.el = el;
		this.editor = cm;

		this._bound_handleEvent = function (evt) {
			return _this._handleEvent(evt);
		};
		app.addEventListener("result", this._bound_handleEvent);

		this._initUI();
		this._update();
	}

	createClass(Replace, [{
		key: "cleanup",
		value: function cleanup() {
			DOMUtils.empty(this.el);
			this.output.value = "";
			DOMUtils.removeClass(this.el, "details");
			app.removeEventListener("result", this._bound_handleEvent);
			Utils.defer(null, "Replace._update");
		}

		// private methods:

	}, {
		key: "_initUI",
		value: function _initUI() {
			this.output = DOMUtils.create("textarea", null, null, this.el);
			this.output.readOnly = true;
		}
	}, {
		key: "_update",
		value: function _update() {
			var o = app.result && app.result.tool,
			    result = o && o.result;
			this.output.value = result || "no result";
		}
	}, {
		key: "_handleEvent",
		value: function _handleEvent(evt) {
			var _this2 = this;

			Utils.defer(function () {
				return _this2._update();
			}, "Replace._update");
		}
	}]);
	return Replace;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var SubstLexer = function () {
	function SubstLexer() {
		classCallCheck(this, SubstLexer);

		this.profile = null;
	}

	createClass(SubstLexer, [{
		key: "parse",
		value: function parse(str) {
			if (!this._profile) {
				return null;
			}

			this.token = null;
			this.string = str;
			this.errors = [];

			// TODO: should this be passed in from Tools?
			var capGroups = app.expression.lexer.captureGroups;

			var prev = null,
			    token = void 0,
			    c = void 0;
			for (var i = 0, l = str.length; i < l; i += token.l) {
				c = str[i];
				token = { prev: prev, i: i, l: 1, subst: true };

				if (c === "$" && i + 1 < l) {
					this.parseDollar(str, token, capGroups);
				} else if (c == "\\" && i + 1 < l) {
					this.parseBackSlash(str, token, capGroups);
				}

				if (!token.type) {
					token.type = "char";
					token.code = c.charCodeAt(0);
				}

				if (prev) {
					prev.next = token;
				}
				if (!this.token) {
					this.token = token;
				}

				if (token.err) {
					// SubstLexer currently doesn't generate any errors.
					this.errors.push(token.err);
				}
				prev = token;
			}

			return this.token;
		}
	}, {
		key: "parseBackSlash",
		value: function parseBackSlash(str, token, capGroups) {
			var match = void 0,
			    sub = str.substr(token.i),
			    profile = this._profile;
			if (profile.substTokens.subst_bsgroup && (match = sub.match(/^\\(\d\d?)/))) {
				this._getRef(match[1], token, capGroups, "subst_bsgroup");
			} else if (match = sub.match(SubstLexer.SUBST_ESC_RE)) {
				if (match[1][0] === "u") {
					token.type = "escunicode";
					token.code = parseInt(match[2], 16);
				} else {
					token.code = profile.escCharCodes[match[1]];
					token.type = "esc_" + token.code;
				}
				if (token.type) {
					token.clss = "esc";
					token.l += match[1].length;
				}
			}
		}
	}, {
		key: "parseDollar",
		value: function parseDollar(str, token, capGroups) {
			// Note: Named groups are not supported in PCRE or JS.
			var match = str.substr(token.i + 1).match(/^([$&`']|\d\d?|{\d\d?})/);
			if (!match) {
				return;
			}
			var d = match[1],
			    type = SubstLexer.$_TYPES[d],
			    profile = this._profile;

			if (type) {
				if (!profile.substTokens[type]) {
					return;
				}
				token.type = type;
				token.clss = "subst";
				token.l += d.length;
			} else {
				this._getRef(d, token, capGroups, d[0] === "{" ? "subst_$bgroup" : "subst_$group");
			}
		}
	}, {
		key: "_getRef",
		value: function _getRef(numStr, token, capGroups, type) {
			if (!this._profile.substTokens[type]) {
				return;
			}
			var num = parseInt(numStr.match(/\d\d?/)[0]),
			    l = 0;
			if (!this._profile.config.substdecomposeref || capGroups[num - 1]) {
				l = numStr.length;
			} else if (num >= 10 && capGroups[(num = num / 10 | 0) - 1]) {
				l = numStr.length - 1;
			}
			if (l) {
				token.l += l;
				// we don't assign the original type, because the docs combine them all into one id:
				token.type = num > 0 ? "subst_group" : "subst_0match";
				token.clss = "subst";
				if (num > 0) {
					token.group = capGroups[num - 1];
				}
			}
		}
	}, {
		key: "profile",
		set: function set$$1(profile) {
			this._profile = profile;
			this.string = this.token = this.errors = null;
		}
	}]);
	return SubstLexer;
}();

SubstLexer.$_TYPES = {
	"$": "subst_$esc",
	"&": "subst_$&match",
	"`": "subst_$before",
	"'": "subst_$after",
	"0": "subst_0match"
};

SubstLexer.SUBST_ESC_RE = new RegExp("^" + Utils.SUBST_ESC_RE.source, "i");

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Tools = function (_EventDispatcher) {
	inherits(Tools, _EventDispatcher);

	function Tools(el) {
		classCallCheck(this, Tools);

		var _this = possibleConstructorReturn(this, (Tools.__proto__ || Object.getPrototypeOf(Tools)).call(this));

		_this.el = el;
		_this._initUI();
		_this.value = null;
		return _this;
	}

	createClass(Tools, [{
		key: "show",
		value: function show(id) {
			if (!id || id === this._toolId) {
				return;
			}
			Track.page("tool/" + id);

			this.toolList.selected = this._toolId = id;
			var input = id === "replace" || id === "list";

			if (this._tool) {
				this._tool.cleanup();
			}

			DOMUtils.toggleClass(DOMUtils.query("> article", this.el), "showinput", input);
			if (input) {
				this.editor.setValue(this._toolValues[id]);
				this.editor.refresh();
				this.editor.focus();
			}

			if (id === "explain") {
				this._tool = new Explain(this.contentEl);
			} else if (id === "details") {
				this._tool = new Details(this.contentEl);
			} else if (id === "replace" || id === "list") {
				this._tool = new Replace(this.resultEl, this.editor);
			}

			this._toolId = id;
			this._updateHighlights();
		}
	}, {
		key: "_initUI",
		value: function _initUI() {
			var _this2 = this;

			var el = this.el;
			this.headerEl = DOMUtils.query("header", this.el);
			this.headerEl.addEventListener("click", function (evt) {
				return _this2._handleHeaderClick(evt);
			});

			this.contentEl = DOMUtils.query("> article > .content", el);
			this.resultEl = DOMUtils.query("> article > .inputtool > .result", el);

			this.toolListEl = DOMUtils.query(".toollist", this.headerEl);
			var data = ["Replace", "List", "Details", "Explain"].map(function (val) {
				return { label: val, id: val.toLowerCase() };
			});
			this.toolList = new List(this.toolListEl, { data: data });
			this.toolList.on("change", function () {
				return _this2._handleListChange();
			});

			var editor = this.editor = CMUtils.create(DOMUtils.query(".inputtool .editor", el), {
				maxLength: 2500,
				singleLine: true
			}, "100%", "100%");

			DOMUtils.query(".help.icon", el).addEventListener("click", function () {
				return app.sidebar.goto(_this2._toolId);
			});

			// TODO: evaluate this living here or in Replace:
			editor.on("change", function () {
				return _this2._handleEditorChange();
			});

			app.flavor.on("change", function () {
				return _this2._updateHighlights();
			});
			app.expression.on("change", function () {
				return _this2._updateHighlights();
			});

			this.lexer = new SubstLexer();
			this.highlighter = new ExpressionHighlighter(editor);
			this.hover = new ExpressionHover(editor, this.highlighter);
		}
	}, {
		key: "_handleEditorChange",
		value: function _handleEditorChange() {
			this._updateHighlights();
			this._toolValues[this._toolId] = this.editor.getValue();
			this.dispatchEvent("change");
		}
	}, {
		key: "_updateHighlights",
		value: function _updateHighlights() {
			if (!this.hasInput) {
				return;
			} // only for Replace & List
			this.lexer.profile = app.flavor.profile;
			var token = this.lexer.parse(this.editor.getValue());
			this.highlighter.draw(token);
			this.hover.token = token;
		}
	}, {
		key: "_handleListChange",
		value: function _handleListChange() {
			this.show(this.toolList.selected);
		}
	}, {
		key: "_handleHeaderClick",
		value: function _handleHeaderClick(evt) {
			if (DOMUtils.hasClass(this.el, "closed") || !this.toolListEl.contains(evt.target)) {
				DOMUtils.togglePanel(this.el, 'article');
			}
		}
	}, {
		key: "value",
		set: function set$$1(o) {
			if (!o) {
				this.show("explain");
				this._toolValues = Utils.copy({}, Tools.DEFAULT_VALUES);
			} else {
				this.show(o.id);
				if (o.input != null) {
					this.editor.setValue(o.input);
				}
			}
		},
		get: function get$$1() {
			return {
				id: this._toolId,
				input: this.input
			};
		}
	}, {
		key: "input",
		get: function get$$1() {
			return this.hasInput ? this.editor.getValue() : null;
		}
	}, {
		key: "hasInput",
		get: function get$$1() {
			var id = this._toolId;
			return id === "replace" || id === "list";
		}
	}]);
	return Tools;
}(EventDispatcher);

Tools.DEFAULT_VALUES = {
	replace: "<< $& >>",
	list: "$&\\n"
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var home = {};
home.id = "home";
home.label = "Menu";
home.desc = "[from HTML]";
home.kids = [{
	label: "Help",
	id: "help",
	desc: "Help for the RegExr application. See the <b>Reference</b> for help with Regular Expressions.",
	kids: [{
		label: "About",
		desc: "Created by <a href='http://twitter.com/gskinner/' target='_blank'>Grant Skinner</a> and the <a href='http://gskinner.com/' target='_blank'>gskinner</a> team, using the <a href='http://createjs.com/' target='_blank'>CreateJS</a> & <a href='http://codemirror.net/' target='_blank'>CodeMirror</a> libraries." + "<p>You can provide feedback or log bugs on <a href='http://github.com/gskinner/regexr/' target='_blank'>GitHub</a>.</p>"
	}, {
		label: "Getting started",
		desc: "RegExr provides real-time visual results, syntax highlighting, tooltips, and undo/redo ({{getCtrlKey()}}-Z / Y) so it's easy and fun to explore Regular Expressions." + "<p>Browse through the <b>Reference</b> and test different tokens to see what they do, then check out the <b>Community</b> to see example patterns.</p>" + "<p>You can also <b>Save</b> your patterns for later reference, or to share with others. <b>Sign In</b> to ensure you don't lose your patterns.</p>",
		kids: [{
			label: "Expression panel",
			desc: "This is where you enter a regular expression to test. The results in the <b>Text</b> and <b>Tools</b> panel will update as you type." + "Roll over the expression for information on each token." + "<p>The buttons to the right allow you to switch RegEx engines, or edit the expression flags.</p>"
		}, {
			label: "Text panel",
			desc: "This is where you enter text to test your expression against. Drag & drop a text file to load its contents." + "<p>Matches will be highlighted as you type. Roll over a match for information on the match and its capture groups. The match count and execution time are shown in the title bar.</p>" + "<p>Lighter colored caps at the start or end of a line indicate the match continues between lines.</p>"
		}, {
			label: "Tools panel",
			desc: "Click the <b>Tools</b> title bar below the <b>Text</b> panel to show or hide the <b>Tools</b> panel." + "<p>Tools provide different ways of working with or exploring your results.</p>",
			kids: [{
				label: "Replace",
				id: "replace",
				desc: "The <b>Replace</b> tool replaces matches with a specified string or pattern." + "<p>Matches in the <b>Text</b> panel are replaced by the substitution string & displayed as you type.</p>" + "<p>Substitution tokens and escaped characters are supported, such as <code>\\n</code>, <code>\\t</code> & <code>\\u0009</code>.</p>" + "<p>Roll over tokens for information, and check out the <b>Reference</b> for more information.</p>"
			}, {
				label: "List",
				id: "list",
				desc: "The <b>List</b> tool lists all found matches." + "<p>You can specify either a simple delimiter (ex. <code>,</code> or <code>\\n</code>), or use substitution tokens to generate more advanced reports. For example, <code>$1\\n</code> would list all group 1 results (in the JavaScript engine).</p>" + "<p>Escaped characters are supported, such as <code>\\n</code>, <code>\\t</code> & <code>\\u0009</code>.</p>" + "<p>Roll over tokens for information.</p>"
			}, {
				label: "Details",
				id: "details",
				desc: "The <b>Details</b> tool displays the full text of a match and its capture groups." + "<p>Click on a highlighted match in the <b>Text</b> panel to display the details for that match.</p>" + "<p>Roll over a group row to highlight that group in your <b>Expression</b>.</p>"
			}, {
				label: "Explain",
				id: "explain",
				desc: "The <b>Explain</b> tool displays a detailed breakdown of the <b>Expression</b>." + "<p>Mouse over the explanation to highlight the related tokens in the <b>Expression</b> panel and vice versa.</p>" + "<p>Click an item in the explanation to show more info in the <b>Reference</b>.</p>"
			}]
		}, {
			label: "Menu",
			desc: "The <b>Menu</b> (this panel) includes <b>Help</b>, a full regular expression <b>Reference</b>, a <b>Cheatsheet</b>, and <b>Save &amp; Share</b> features." + "<p>Tap a selected item in the <b>Reference</b> to insert it into your <b>Expression</b>. Click the arrow beside an example to load it.</p>" + "<p>The library also includes searchable <b>Community</b> submissions, and patterns you've created or favorited in <b>My Patterns</b>.</p>"
		}]
	}, {
		label: "Signing in",
		id: "signin",
		desc: "Before you sign in, RegExr creates a temporary account which relies on a browser cookie. This means you can't access your patterns on other computers, and that you could lose your patterns if your cookies are deleted or expire." + "<p>Signing in creates a permanent account, so you can access your patterns anywhere, anytime.</p>" + "<p>Your existing patterns &amp; favorites will automatically be assigned to the new account.</p>" + "<p>We don't use your info for anything other than signing you into your RegExr account.</p>"
	}, {
		id: "engine",
		label: "RegEx engines",
		desc: "While the core feature set of regular expressions is fairly consistent, different implementations (ex. Perl vs Java) may have different features or behaviours." + "<p>RegExr currently supports JavaScript RegExp executed in your browser and PCRE via PHP.</p>" + "<p>You can switch engines using the dropdown in Expression.</p>",
		kids: [{
			label: "JavaScript",
			desc: "Your browser's JavaScript engine is used to execute RegEx in an asynchronous worker using <code>RegExp.exec()</code>." + "<p>Note that while implementations are mostly consistent, there are small variations between browsers. Here is a short list of known differences:<ul>" + "<li>Older browsers don't support the u or y flags</li>" + "<li>Differences in handling of certain ambiguous escapes: \\8 \\9</li>" + "<li>Chrome handles \\x & \\u escapes slightly differently than other browsers</li>" + "<li>Chrome supports lookbehind, but it isn't yet in the JS spec</li>" + "<li>Safari ignores leading zeros in octal escapes (ex. \\00020)</li>" + "</ul></p>"
		}, {
			label: "PCRE (PHP)",
			desc: "PHP {{getPHPVersion()}} and PCRE {{getPCREVersion()}} are used to execute your pattern on our server."
		}]
	}, {
		label: "Query string support",
		desc: "In addition to the built in <b>Save & Share</b> mechanism, RegExr also supports the ability to pre-populate a pattern via the query string." + "<p>The following query string params are recognized:<ul>" + "<li><code>expression</code> & <code>text</code> - populate their respective fields</li>" + "<li><code>tool</code> - sets the tool (replace, list, details, or explain)</li>" + "<li><code>input</code> - populates the tool input field</li>" + "</ul></p>" + "Ex. <a href='http://regexr.com/?expression=.&text=testing'>regexr.com/?expression=.&text=testing</a>"
	}]
}, { // injected from Reference
	id: "reference"
}, {
	label: "Cheatsheet",
	id: "cheatsheet",
	el: "#cheatsheet"
}, {
	label: "Community",
	id: "community",
	desc: "Welcome to the Community, a searchable database of patterns submitted by users like you." + "<p>After selecting a pattern, use the arrows in this section to load the full pattern or components of it.</p>" + "<p>Help make the Community better by rating patterns, and submitting your own via <b>Search & Share</b> in the menu.</p>",
	search: true,
	kids: []
}, {
	label: "My Patterns",
	id: "favorites",
	desc: "The list above will display any patterns that you create or favorite.",
	search: true,
	kids: []
}, {
	label: "Save & Share",
	id: "share",
	el: "#share_main",
	list: false,
	kids: [{
		label: "Save to my Favorites",
		id: "share_favorites",
		el: "#share_favorites"
	}, {
		label: "Share with the Community",
		id: "share_community",
		el: "#share_community"
	}]
}];

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var LinkRow = function () {
	function LinkRow(el) {
		classCallCheck(this, LinkRow);

		this.el = el;
		this._initUI();
		this.url = null;
	}

	createClass(LinkRow, [{
		key: "showMessage",
		value: function showMessage(message) {
			// for some reason this displays one line too low if it's synchronous:
			setTimeout(function () {
				return app.tooltip.toggle.showOn("linkrow", message, DOMUtils.query(".row.link .copy.icon"), true, 0);
			}, 1);
		}
	}, {
		key: "_initUI",
		value: function _initUI() {
			var _this = this;

			this.el.onclick = function (evt) {
				return _this._onClick(evt);
			};

			var fld = DOMUtils.query(".label", this.el),
			    copyBtn = DOMUtils.query(".copy", this.el);
			var clipboard = new Clipboard(copyBtn, { target: function target() {
					return fld;
				} });
			clipboard.on("success", function () {
				return app.tooltip.toggle.toggleOn("copy", "Copied to clipboard.", copyBtn, true, 3);
			});
			clipboard.on("error", function (e) {
				return app.tooltip.toggle.toggleOn("copy", Utils.getCtrlKey() + "-C to copy.", copyBtn, true, 3);
			}); // TODO: cmd/ctrl
		}
	}, {
		key: "_onClick",
		value: function _onClick(evt) {
			if (DOMUtils.query(".copy", this.el).contains(evt.target)) {
				return;
			}
			if (evt.which === 2 || evt.metaKey || evt.ctrlKey) {
				window.open(Utils.getPatternURL(this._pattern));
			} else {
				if (app.unsaved && !confirm("You have unsaved changes. Load pattern without saving?")) {
					return;
				}
				app.state = Utils.clone(this._pattern);
			}
		}
	}, {
		key: "pattern",
		set: function set$$1(val) {
			var url = Utils.getPatternURLStr(val);
			this._pattern = val;
			DOMUtils.query(".label", this.el).innerText = url || "Shareable link";
			DOMUtils.toggleClass(this.el, "disabled", !url);
			DOMUtils.toggleClass(this.el, "active", !!url);
		}
	}]);
	return LinkRow;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Example = function () {
	function Example(title, ex) {
		classCallCheck(this, Example);

		this.el = DOMUtils.create("div", "example");
		this.title = title;
		this.example = ex;
	}

	createClass(Example, [{
		key: "example",
		set: function set$$1(ex) {
			if (ex === this._example) {
				return;
			}
			this._example = ex;

			var str = "",
			    txt = void 0,
			    exp = void 0,
			    regex = void 0;
			if (ex) {
				exp = ex[0];
				txt = ex[1];
				regex = Utils.getRegExp(exp, "g");
				if (this.title) {
					str += "<h1>" + this.title + "</h1><hr>";
				}
				str += "<code class='expression'><svg class='icon load'><use xlink:href='#load'><title>Load expression</title></use></svg>" + Utils.htmlSafe(exp) + "</code>";
				if (txt && regex) {
					var over = Math.max(0, txt.length - 160),
					    s = txt;
					if (over) {
						s = Utils.htmlSafe(s.substr(0, 159));
					}
					if (regex) {
						s = s.replace(regex, "<em>$&</em>");
					}
					// TODO: this won't match on html elements:
					str += "<hr><code class='text'><svg class='icon load'><use xlink:href='#load'><title>Load text</title></use></svg>" + s + (over ? "<i>\u2026</i>" : "") + "</code>";
				}
			}
			this.el.innerHTML = str;
			if (exp) {
				DOMUtils.query("code.expression > .load", this.el).addEventListener("click", function () {
					// TODO: this will need to be updated when we support other delimiters:
					app.expression.value = exp[0] === "/" ? exp : "/" + exp + "/g";
				});
			}
			if (txt) {
				DOMUtils.query("code.text > .load", this.el).addEventListener("click", function () {
					return app.text.value = txt;
				});
			}
		}
	}]);
	return Example;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// also used for My Patterns.

var CommunityContent = function () {
	function CommunityContent(el) {
		var _this = this;

		classCallCheck(this, CommunityContent);

		this.el = el;
		this.example = new Example();
		el.appendChild(this.example.el);
		DOMUtils.query(".icon.thumbup", el).addEventListener("click", function () {
			return _this._rate(1);
		});
		DOMUtils.query(".icon.thumbdown", el).addEventListener("click", function () {
			return _this._rate(-1);
		});
		DOMUtils.query(".icon.favorites", el).addEventListener("click", function () {
			return _this._favorite();
		});
		this.linkRow = new LinkRow(DOMUtils.query(".row.link", el));
	}

	createClass(CommunityContent, [{
		key: "_updateRating",


		// private methods:
		value: function _updateRating() {
			var o = this._pattern,
			    el = this.el;
			DOMUtils.query(".rating", el).innerText = o.rating.toFixed(1);
			DOMUtils.removeClass(DOMUtils.query(".icon.rate.selected", el), "selected");
			if (o.userRating === 1) {
				DOMUtils.addClass(DOMUtils.query(".icon.thumbup", el), "selected");
			} else if (o.userRating === -1) {
				DOMUtils.addClass(DOMUtils.query(".icon.thumbdown", el), "selected");
			}
		}
	}, {
		key: "_updateFavorite",
		value: function _updateFavorite() {
			var o = this._pattern,
			    el = this.el;
			DOMUtils.toggleClass(DOMUtils.query(".icon.favorites", el), "selected", !!o.favorite);
		}
	}, {
		key: "_rate",
		value: function _rate(val) {
			var _this2 = this;

			var o = this._pattern;
			o.userRating = val === o.userRating ? 0 : val;
			this._updateRating();

			Server.rate(o.id, o.userRating).then(function (data) {
				return _this2._handleRate(data);
			});
		}
	}, {
		key: "_handleRate",
		value: function _handleRate(data) {
			if (data.id === this._pattern.id) {
				this._pattern.rating = data.rating;
				this._updateRating();
			}
		}
	}, {
		key: "_favorite",
		value: function _favorite() {
			var _this3 = this;

			var o = this._pattern;
			Server.favorite(o.id, !o.favorite).then(function (data) {
				return _this3._handleFavorite(data);
			});
		}
	}, {
		key: "_handleFavorite",
		value: function _handleFavorite(data) {
			if (data.id === this._pattern.id) {
				this._pattern.favorite = data.favorite;
				this._updateFavorite();
			}
		}
	}, {
		key: "item",
		set: function set$$1(o) {
			var el = this.el;
			this._pattern = o;
			DOMUtils.query(".author", el).innerText = o.author ? "by " + o.author : "";
			DOMUtils.query(".name.label", el).innerText = o.name;
			DOMUtils.query(".desc", el).innerText = o.description || "No description available.";
			this._updateRating();
			this._updateFavorite();
			this.example.example = [o.expression, o.text];

			this.linkRow.pattern = o;
		}
	}]);
	return CommunityContent;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Status = function () {
	function Status(el) {
		var _this = this;

		classCallCheck(this, Status);

		if (!el) {
			el = document.createElement("div");
		}
		this.el = el;
		DOMUtils.addClass(el, "status");

		el.addEventListener("mouseover", function () {
			return _this._showTooltip();
		});
		el.addEventListener("mouseout", function () {
			return _this._hideTooltip();
		});
	}

	createClass(Status, [{
		key: "distract",
		value: function distract() {
			this.el.innerHTML = '<svg class="icon distractor anim-spin"><use xlink:href="#distractor"></use></svg>';
			this._show();
			return this;
		}
	}, {
		key: "hide",
		value: function hide() {
			var _this2 = this;

			var t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

			this._clearTimeout();
			if (t) {
				this._timeoutId = setTimeout(function () {
					return _this2._hide();
				}, t * 1000);
			} else {
				this._hide();
			}
			return this;
		}
	}, {
		key: "success",
		value: function success() {
			this.el.innerHTML = '<svg class="icon success"><use xlink:href="#check"></use></svg>';
			this._show();
			return this;
		}
	}, {
		key: "error",
		value: function error(msg) {
			var el = this.el;
			el.innerHTML = '<svg class="icon alert"><use xlink:href="#alert"></use></svg>';
			this._show();
			this._ttMsg = msg;
			return this;
		}
	}, {
		key: "_showTooltip",
		value: function _showTooltip() {
			if (!this._ttMsg) {
				return;
			}
			app.tooltip.hover.showOn("status", this._ttMsg, this.el, true, 0);
		}
	}, {
		key: "_hideTooltip",
		value: function _hideTooltip() {
			app.tooltip.hover.hide("status");
		}
	}, {
		key: "_show",
		value: function _show() {
			this.el.style.display = null;
			this._ttMsg = null;
			this._hideTooltip();
			this._clearTimeout();
		}
	}, {
		key: "_hide",
		value: function _hide() {
			this.el.style.display = "none";
			this._hideTooltip();
			this._clearTimeout();
		}
	}, {
		key: "_clearTimeout",
		value: function _clearTimeout() {
			if (this._timeoutId == null) {
				return;
			}
			clearTimeout(this._timeoutId);
			this._timeoutId = null;
		}
	}]);
	return Status;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Account = function (_EventDispatcher) {
	inherits(Account, _EventDispatcher);

	function Account() {
		classCallCheck(this, Account);

		var _this = possibleConstructorReturn(this, (Account.__proto__ || Object.getPrototypeOf(Account)).call(this));

		_this._value = {};
		_this._initUI();
		return _this;
	}

	createClass(Account, [{
		key: "showTooltip",
		value: function showTooltip() {
			app.tooltip.toggle.toggleOn("signin", this.tooltipEl, this.signinBtn, true, 20);
		}

		// private methods:

	}, {
		key: "_initUI",
		value: function _initUI() {
			var _this2 = this;

			var template = function template(o) {
				return '<svg class="icon inline"><use xlink:href="#' + o.toLowerCase() + '"></use></svg>' + o;
			};
			this.signinBtn = DOMUtils.query(".header .signin");
			this.tooltipEl = DOMUtils.query("#library > #tooltip-signin");
			this.signinEl = DOMUtils.query(".signin", this.tooltipEl);
			this.signoutEl = DOMUtils.query(".signout", this.tooltipEl);
			DOMUtils.query(".signoutbtn", this.signoutEl).addEventListener("click", function (evt) {
				return _this2._doSignout();
			});
			this.signinBtn.addEventListener("click", function (evt) {
				return _this2.showTooltip();
			});
			DOMUtils.query(".icon.help", this.signinEl).addEventListener("click", function () {
				return app.sidebar.goto("signin");
			});
			this.signinList = new List(DOMUtils.query("ul.list", this.signinEl), { data: ["GitHub", "Facebook", "Google"], template: template });
			this.signinList.on("change", function () {
				return _this2._signinListChange();
			});
		}
	}, {
		key: "_updateUI",
		value: function _updateUI() {
			var auth = this.authenticated;
			DOMUtils.toggleClass(this.tooltipEl, "authenticated", auth);
			DOMUtils.query(".label", this.signinBtn).innerText = auth ? "Sign Out" : "Sign In";
			if (auth) {
				DOMUtils.query(".username", this.signoutEl).innerText = this.username;
				DOMUtils.query(".type", this.signoutEl).innerText = this.type;
			}
		}
	}, {
		key: "_doSignout",
		value: function _doSignout() {
			var _this3 = this;

			DOMUtils.addClass(this.tooltipEl, "wait");
			Server.logout().then(function (data) {
				_this3._handleSignout(data);
			}).finally(function () {
				return _this3._cleanSignout();
			});
		}
	}, {
		key: "_handleSignout",
		value: function _handleSignout(data) {
			this.value = data;
		}
	}, {
		key: "_cleanSignout",
		value: function _cleanSignout(err) {
			DOMUtils.removeClass(this.tooltipEl, "wait");
		}
	}, {
		key: "_signinListChange",
		value: function _signinListChange() {
			var service = this.signinList.selected.toLowerCase();
			DOMUtils.addClass(this.tooltipEl, "wait");
			Track.event("login", "access", service);
			setTimeout(function () {
				return Server.login(service);
			}, 100);
		}
	}, {
		key: "value",
		get: function get$$1() {
			return this._value;
		},
		set: function set$$1() {
			var val = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

			this._value = val;
			this._updateUI();
			this.dispatchEvent("change");
		}
	}, {
		key: "userId",
		get: function get$$1() {
			return this._value.userId;
		}
	}, {
		key: "author",
		get: function get$$1() {
			return this._value.author || this._value.username || "";
		}
	}, {
		key: "username",
		get: function get$$1() {
			return this._value.username || "";
		}
	}, {
		key: "authenticated",
		get: function get$$1() {
			return !!this._value.username;
		} // this._value.authenticated;

	}, {
		key: "type",
		get: function get$$1() {
			return this._value.type;
		}
	}]);
	return Account;
}(EventDispatcher);

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Share = function (_EventDispatcher) {
	inherits(Share, _EventDispatcher);

	function Share(el) {
		classCallCheck(this, Share);

		var _this = possibleConstructorReturn(this, (Share.__proto__ || Object.getPrototypeOf(Share)).call(this));

		_this.el = el;
		_this._pattern = false;
		_this._initUI();
		app.on("change", function () {
			return _this._handleAppChange();
		});
		app.on("load", function () {
			return _this._handleAppLoad();
		});
		app.account.on("change", function () {
			return _this._handleAccountChange();
		});
		return _this;
	}

	// public methods:


	createClass(Share, [{
		key: "_initUI",


		// private methods:
		value: function _initUI() {
			var _this2 = this;

			var el = this.el;
			this.mainEl = DOMUtils.query("> #share_main", el);
			var comEl = this.communityEl = DOMUtils.query("> #share_community", el);

			// set up header:
			var hEl = DOMUtils.query(".header .file");
			this.hNewBtn = DOMUtils.query(".new", hEl);
			this.hForkBtn = DOMUtils.query(".fork", hEl);
			this.hSaveBtn = DOMUtils.query(".save", hEl);
			DOMUtils.query(".savekey", this.hSaveBtn).innerText = "(" + Utils.getCtrlKey() + "-s)";
			this.hSaveBtn.addEventListener("click", function () {
				return _this2._doSave();
			});
			this.hForkBtn.addEventListener("click", function () {
				return _this2._doSave(true);
			});
			this.hNewBtn.addEventListener("click", function () {
				return _this2._doNew();
			});

			// set up main:
			this._privateRow = DOMUtils.query(".row.private", this.mainEl);
			this._privateRow.addEventListener("click", function () {
				return _this2._doPrivate();
			});
			this._privateStatus = new Status(DOMUtils.query(".status", this._privateRow));
			this._favoritesRow = DOMUtils.query(".row.favorites", this.mainEl);
			this._favoritesRow.addEventListener("click", function () {
				return _this2._doFavorite();
			});
			this._favoritesStatus = new Status(DOMUtils.query(".status", this._favoritesRow));
			this._communityRow = DOMUtils.query(".row.community", this.mainEl);
			this._communityRow.addEventListener("click", function () {
				return _this2._showCommunity();
			});
			DOMUtils.query(".row.signin a", this.mainEl).addEventListener("click", function () {
				return _this2._doSignin();
			});

			// set up link row:
			this._linkRow = new LinkRow(DOMUtils.query(".link.row", this.mainEl));

			// set up save buttons:
			var saveEl = this.saveEl = DOMUtils.query("> .save", this.mainEl);
			this.saveBtn = DOMUtils.query(".button.save", saveEl);
			this.forkBtn = DOMUtils.query(".button.fork", saveEl);
			this.saveBtn.addEventListener("click", function () {
				return _this2._doSave();
			});
			this.forkBtn.addEventListener("click", function () {
				return _this2._doSave(true);
			});
			this.saveStatus = new Status(DOMUtils.query(".status", saveEl));

			// set up input fields:
			var inputsEl = DOMUtils.query(".inputs", saveEl);
			this.nameFld = DOMUtils.query(".name", inputsEl);
			this.authorFld = DOMUtils.query(".author", inputsEl);
			this.descriptionFld = DOMUtils.query(".description", inputsEl);
			this.keywordsFld = DOMUtils.query(".keywords", inputsEl);

			// listen for changes:
			this.nameFld.addEventListener("input", function () {
				return _this2._handleChange();
			});
			this.authorFld.addEventListener("input", function () {
				return _this2._handleChange();
			});
			this.descriptionFld.addEventListener("input", function () {
				return _this2._handleChange();
			});
			this.keywordsFld.addEventListener("input", function () {
				return _this2._handleChange();
			});

			/// set up community:
			var comInputsEl = DOMUtils.query(".inputs", comEl);
			DOMUtils.query(".button.cancel", comEl).addEventListener("click", function () {
				return app.sidebar.goto("share");
			});
			DOMUtils.query(".button.share", comEl).addEventListener("click", function () {
				return _this2._doComSave();
			});
			this.comSaveStatus = new Status(DOMUtils.query(".status", comEl));
			this._comNameFld = DOMUtils.query(".name", comInputsEl);
			this._comAuthorFld = DOMUtils.query(".author", comInputsEl);
			this._comDescriptionFld = DOMUtils.query(".description", comInputsEl);
			this._comKeywordsFld = DOMUtils.query(".keywords", comInputsEl);

			// set up cmd-s listener:
			window.document.addEventListener("keydown", function (evt) {
				return _this2._handleKey(evt);
			});
		}
	}, {
		key: "_updateUI",
		value: function _updateUI() {
			var o = this._pattern,
			    text = void 0;
			var isChanged = this._isChanged(),
			    isNew = this._isNew(),
			    isOwned = this._isOwned();

			DOMUtils.toggleClass([this.forkBtn, this.hForkBtn], "disabled", !this._canFork());
			DOMUtils.toggleClass([this.saveBtn, this.hSaveBtn], "disabled", !this._canSave());

			if (!isOwned) {
				text = "This pattern was created by '" + (o.author || "[anonymous]") + "'.";
			} else if (!isChanged) {
				text = "No unsaved changes.";
			} else if (isNew) {
				text = "Save will create a shareable public link.";
			} else {
				text = "Save will update the current link.";
			}

			if (!isOwned && !isChanged) {
				text += " Fork to create your own copy.";
			} else if (!isNew) {
				text += " Fork will create a new link" + (isChanged ? " with your changes." : ".");
			}

			this._setSaveText(text);

			this._linkRow.pattern = this._pattern.id && this._pattern;

			DOMUtils.toggleClass(this._privateRow, "disabled", isNew || !isOwned);
			DOMUtils.toggleClass(this._favoritesRow, "disabled", isNew || !isOwned);
			DOMUtils.toggleClass(this._communityRow, "disabled", isNew || !isOwned);

			DOMUtils.toggleClass(this._privateRow, "active", o.access === "private");
			DOMUtils.toggleClass(this._favoritesRow, "active", !!o.favorite);
		}
	}, {
		key: "_isNew",
		value: function _isNew() {
			return !this._pattern.id;
		}
	}, {
		key: "_isOwned",
		value: function _isOwned() {
			var o = this._pattern;
			return this._isNew() || o.userId === app.account.userId;
		}
	}, {
		key: "_isChanged",
		value: function _isChanged() {
			return app.unsaved;
		}
	}, {
		key: "_canSave",
		value: function _canSave() {
			return this._isChanged() && this._isOwned();
		}
	}, {
		key: "_canFork",
		value: function _canFork() {
			return !this._isNew();
		}
	}, {
		key: "_pushHistory",
		value: function _pushHistory(pattern) {
			var history = window.history,
			    url = Utils.getPatternURL(pattern);
			var title = "RegExr: " + (pattern.name || "Learn, Build, & Test RegEx");

			if (history.state && pattern.id === history.state.id) {
				history.replaceState(pattern, title, url);
			} else {
				history.pushState(pattern, title, url);
			}
			window.document.title = title;
		}
	}, {
		key: "_handleKey",
		value: function _handleKey(evt) {
			var mac = Utils.isMac();
			if (evt.key === "s" && (mac && evt.metaKey || !mac && evt.ctrlKey)) {
				this._doSave(false);
				evt.preventDefault();
			}
		}
	}, {
		key: "_doSave",
		value: function _doSave(fork) {
			var _this3 = this;

			// if we can't save for some reason, then show the panel.
			if (!fork && !this._canSave()) {
				app.sidebar.goto("share");
				return;
			}

			if (fork && !this._canFork()) {
				return;
			}

			var o = app.state;
			DOMUtils.addClass(DOMUtils.query(".buttons", this.saveEl), "wait");
			this.saveStatus.distract();
			Server.save(o, fork).then(function (data) {
				return _this3._handleSave(data);
			}).catch(function (err) {
				return _this3._handleSaveErr(err);
			});
		}
	}, {
		key: "_handleSave",
		value: function _handleSave(data) {
			var isNew = this._pattern.id == null,
			    isFork = !isNew && data.id !== this._pattern.id;
			DOMUtils.removeClass(DOMUtils.query(".buttons", this.saveEl), "wait");
			this.saveStatus.hide();

			app.state = data;

			if (isFork || isNew) {
				app.sidebar.goto("share");
				if (isFork || !this.name) {
					this.nameFld.focus();
					this.nameFld.select();
				}

				this._linkRow.showMessage("<b>Saved.</b> New share link created. Click to copy to clipboard.");
			}
		}
	}, {
		key: "_handleSaveErr",
		value: function _handleSaveErr(err) {
			DOMUtils.removeClass(DOMUtils.query(".buttons", this.saveEl), "wait");
			this.saveStatus.error(this._getErrMsg(err));
		}
	}, {
		key: "_doNew",
		value: function _doNew() {
			if (app.unsaved && !confirm("You have unsaved changes. Create new pattern without saving?")) {
				return;
			}
			app.state = {
				flavor: app.flavor.value
			};
		}
	}, {
		key: "_doPrivate",
		value: function _doPrivate() {
			var _this4 = this;

			var o = this._pattern;
			this._privateStatus.distract();
			Server.private(o.id, o.access !== "private").then(function (data) {
				return _this4._handlePrivate(data);
			}).catch(function (err) {
				return _this4._handleErr(err, _this4._privateStatus);
			});
		}
	}, {
		key: "_handlePrivate",
		value: function _handlePrivate(data) {
			if (data.id === this._pattern.id) {
				this._pattern.access = data.access;
				this._privateStatus.hide();
				this._updateUI();
			}
		}
	}, {
		key: "_doFavorite",
		value: function _doFavorite() {
			var _this5 = this;

			var o = this._pattern;
			this._favoritesStatus.distract();
			Server.favorite(o.id, !o.favorite).then(function (data) {
				return _this5._handleFavorite(data);
			}).catch(function (err) {
				return _this5._handleErr(err, _this5._favoritesStatus);
			});
		}
	}, {
		key: "_handleFavorite",
		value: function _handleFavorite(data) {
			if (data.id === this._pattern.id) {
				this._pattern.favorite = data.favorite;
				this._favoritesStatus.hide();
				this._updateUI();
			}
		}
	}, {
		key: "_handleErr",
		value: function _handleErr(err, status) {
			status.error(this._getErrMsg(err)).hide(6);
		}
	}, {
		key: "_showCommunity",
		value: function _showCommunity() {
			app.sidebar.goto("share_community");
			this._comNameFld.value = this.name;
			this._comAuthorFld.value = this.author;
			this._comDescriptionFld.value = this.description;
			this._comKeywordsFld.value = this.keywords;
		}
	}, {
		key: "_doComSave",
		value: function _doComSave() {
			var _this6 = this;

			if (!this._comNameFld.value) {
				this._comNameFld.focus();
				return;
			}
			var o = app.state;
			this.name = o.name = this._comNameFld.value;
			this.author = o.author = this._comAuthorFld.value;
			this.description = o.description = this._comDescriptionFld.value;
			this.keywords = o.keywords = this._comKeywordsFld.value;
			o.access = "public";
			DOMUtils.addClass(DOMUtils.query(".buttons", this.communityEl), "wait");
			this.comSaveStatus.distract();
			Server.save(o, true).then(function (data) {
				return _this6._handleComSave(data);
			}).catch(function (err) {
				return _this6._handleComSaveErr(err);
			});
		}
	}, {
		key: "_handleComSave",
		value: function _handleComSave(data) {
			DOMUtils.removeClass(DOMUtils.query(".buttons", this.communityEl), "wait");
			this.comSaveStatus.hide();
			app.sidebar.goto("share");
		}
	}, {
		key: "_handleComSaveErr",
		value: function _handleComSaveErr(err) {
			DOMUtils.removeClass(DOMUtils.query(".buttons", this.communityEl), "wait");
			this.comSaveStatus.error(this._getErrMsg(err));
		}
	}, {
		key: "_handleChange",
		value: function _handleChange() {
			this.dispatchEvent("change");
		}
	}, {
		key: "_handleAppChange",
		value: function _handleAppChange() {
			this._updateUI();
		}
	}, {
		key: "_handleAccountChange",
		value: function _handleAccountChange() {
			var acc = app.account,
			    rowEl = DOMUtils.query(".signin.row", this.mainEl);
			if (!this.authorFld.value) {
				this.authorFld.value = acc.author || acc.username;
			}
			DOMUtils.toggleClass(rowEl, "authenticated", acc.authenticated);
			DOMUtils.query(".username", rowEl).innerText = acc.username;
		}
	}, {
		key: "_handleAppLoad",
		value: function _handleAppLoad() {
			DOMUtils.toggleClass(DOMUtils.query(".save .actions", this.mainEl), "disabled");
		}
	}, {
		key: "_doSignin",
		value: function _doSignin() {
			app.account.showTooltip();
		}
	}, {
		key: "_setSaveText",
		value: function _setSaveText(str) {
			DOMUtils.query(".save .message .label", this.mainEl).innerText = str;
		}
	}, {
		key: "_getErrMsg",
		value: function _getErrMsg(err) {
			return "<span class='error'>ERROR:</span> " + app.reference.getError("servercomm");
		}
	}, {
		key: "value",
		get: function get$$1() {
			return {
				id: this._pattern ? this._pattern.id : null,
				name: this.name,
				author: this.author,
				description: this.description,
				keywords: this.keywords
			};
		}
	}, {
		key: "pattern",
		set: function set$$1(o) {
			this._pattern = o;
			this.name = o.name;
			this.description = o.description;
			this.keywords = o.keywords;

			this._updateUI();
			this._pushHistory(o);
		}
	}, {
		key: "name",
		get: function get$$1() {
			return this.nameFld.value;
		},
		set: function set$$1(val) {
			this.nameFld.value = val || "";
		}
	}, {
		key: "author",
		get: function get$$1() {
			return this.authorFld.value;
		},
		set: function set$$1(val) {
			this.authorFld.value = val || "";
		}
	}, {
		key: "description",
		get: function get$$1() {
			return this.descriptionFld.value;
		},
		set: function set$$1(val) {
			this.descriptionFld.value = val || "";
		}
	}, {
		key: "keywords",
		get: function get$$1() {
			return this.keywordsFld.value;
		},
		set: function set$$1(val) {
			this.keywordsFld.value = val || "";
		}
	}]);
	return Share;
}(EventDispatcher);

var _templateObject$1 = taggedTemplateLiteral(["<svg class=\"icon\"><use xlink:href=\"#", "\"></use></svg>"], ["<svg class=\"icon\"><use xlink:href=\"#", "\"></use></svg>"]);

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Sidebar = function () {
	function Sidebar(el) {
		var _this = this;

		classCallCheck(this, Sidebar);

		this.el = el;
		this.itemEl = null;
		this.openReq = null;
		this._initUI(el);
		this._content = this._prepContent(home);
		this.minList.data = [{ id: "menu", label: "Menu" }].concat(home.kids);
		this.goto("home");
		app.flavor.on("change", function () {
			return _this._onFlavorChange();
		});
		if (app.isNarrow) {
			setTimeout(function () {
				return _this.minimize(true, false);
			}, 1500);
		}
	}

	createClass(Sidebar, [{
		key: "minimize",
		value: function minimize() {
			var val = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
			var track = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

			if (val === this._minimized) {
				return;
			}
			if (val && track) {
				Track.event("minimize_menu", "engagement");
			}
			DOMUtils.togglePanel(this.el, '.full', '.min', !val);
			this._minimized = val;
			this._updateUI();
		}
	}, {
		key: "goto",
		value: function goto(id) {
			this.show(this._idMap[id]);
		}
	}, {
		key: "showToken",
		value: function showToken(token) {
			this.goto(app.reference.idForToken(token));
		}
	}, {
		key: "show",
		value: function show(item) {
			if (!item) {
				return;
			}
			if (item.hide) {
				return this.show(item.parent);
			}
			if (!item || item.id === "menu") {
				return;
			} // expand button on the min menu
			this.minimize(false);
			if (item.id) {
				Track.page("sidebar/" + item.id);
			}

			if (!item.el && !item.kids) {
				if (this.searchMode || !item.parent || item.parent === this.curItem) {
					// in a search, community / favorites, of selecting a leaf child from a list.
					this.selItem = item;
					this.menuList.selected = item.id;
					return this._showContent(item);
				} else if (item.parent !== this.curItem) {
					// trying to jump to a leaf child without previously showing parent.
					this.show(item.parent);
					return this.show(item);
				}
			}

			this._resetFull();

			this.curItem = item;
			DOMUtils.query("h1", this.titleEl).innerText = item.label;
			DOMUtils.query("svg.back.icon use", this.titleEl).setAttribute("xlink:href", "#" + (item.parent ? "arrowleft" : "menu"));
			if (item.el) {
				this._showEl(DOMUtils.query("#library " + item.el));
			} else {
				this._showContent(item);
			}

			if (item.kids && item.list !== false) {
				DOMUtils.removeClass(this.fullEl, "no-list");
				this.menuList.data = item.kids || item.parent.kids;
			}
			if (item.search) {
				DOMUtils.removeClass(this.fullEl, "no-search");
			}

			// special handling:
			if (item.id === "community") {
				this.menuList.template = this.communityListTemplate;
				this._onSearchSubmit();
			} else if (item.id === "favorites") {
				this.menuList.template = this.communityListTemplate;
				this._loadFavorites();
			}
		}
	}, {
		key: "back",
		value: function back() {
			if (this.curItem.parent) {
				this.show(this.curItem.parent);
			} else {
				this.minimize(true);
			}
		}
	}, {
		key: "menuListTemplate",
		value: function menuListTemplate(o) {
			return (o.parent && o.parent.id === "home" ? '<svg class="icon"><use xlink:href="#' + o.id + '"></use></svg>' : "") + '<span class="label">' + (o.label || o.id) + "</span>" + (o.token ? '<span class="token">' + o.token.replace("<", "&lt;") + '</span>' : "") + (o.kids || o.el ? '<svg class="small icon"><use xlink:href="#arrowright"></use></svg>' : "");
		}
	}, {
		key: "communityListTemplate",
		value: function communityListTemplate(o) {
			return '<span class="label">' + Utils.htmlSafe(o.name) + "</span>" + '<span class="rating">' + (o.favorite ? '<svg class="small icon favorites"><use xlink:href="#favorites"></use></svg>' : '') + '<svg class="small icon thumb"><use xlink:href="#thumb"></use></svg>' + o.rating.toFixed(1) + '</span>';
		}

		// private methods:

	}, {
		key: "_initUI",
		value: function _initUI(el) {
			var _this2 = this;

			// set up full width content:
			this.fullEl = DOMUtils.query("> .full", el);

			// title bar:
			this.titleEl = DOMUtils.query("> header", this.fullEl);
			DOMUtils.query("> .close.icon", this.titleEl).addEventListener("click", function () {
				return _this2.minimize(true);
			});
			DOMUtils.query("> .backrow", this.titleEl).addEventListener("click", function () {
				return _this2.back();
			});

			// search:
			this.searchEl = DOMUtils.query("> .search", this.fullEl);
			this.searchFld = DOMUtils.query("> .search > input", this.fullEl);
			this.searchFld.addEventListener("input", function () {
				return _this2._onSearchChange();
			});
			this.searchFld.addEventListener("keyup", function (evt) {
				return evt.keyCode === 13 && _this2._onSearchSubmit();
			});
			var searchBtn = DOMUtils.query("> svg.icon.search", this.searchEl);
			searchBtn.addEventListener("click", function () {
				return _this2._onSearchSubmit();
			});

			// list & content:
			this.listEl = DOMUtils.query("> .list", this.fullEl);
			this.menuList = new List(this.listEl, { data: home.kids, template: this.menuListTemplate });
			this.menuList.on("change", function () {
				return _this2.show(_this2.menuList.selectedItem);
			});
			this.menuList.on("selclick", function () {
				return _this2._onSelClick(_this2.menuList.selectedItem);
			});
			this.contentEl = DOMUtils.query("> .content", this.fullEl);

			// set up minimized sidebar:
			this.minEl = DOMUtils.query("> .min", el);
			this.minEl.addEventListener("click", function () {
				return _this2.minimize(false);
			});

			var template = DOMUtils.template(_templateObject$1, "id");
			this.minList = new List(DOMUtils.query("> .list", this.minEl), { template: template });
			this.minList.on("change", function (evt) {
				_this2.show(_this2.minList.selectedItem);evt.preventDefault();
			});

			// set up special content:
			this.community = new CommunityContent(DOMUtils.query("#library > #community"));
			this.share = new Share(DOMUtils.query("#library > #share"));
			this._prepCheatsheet(); // TODO: switch to a Cheatsheet class.

			DOMUtils.query(".doc > .blocker").addEventListener("mousedown", function (evt) {
				_this2.minimize(true);
			});
		}
	}, {
		key: "_updateUI",
		value: function _updateUI() {
			// TODO: this is cheating a bit:
			var doc = DOMUtils.query(".doc");
			DOMUtils.toggleClass(doc, "fadeback", !this._minimized);
		}
	}, {
		key: "_resetFull",
		value: function _resetFull() {
			if (this.itemEl) {
				DOMUtils.query("#library").appendChild(this.itemEl);
				this.itemEl = null;
			}
			this._abortReq();
			DOMUtils.addClass(this.fullEl, "no-search no-list");
			this.searchFld.value = "";
			this.searchMode = false;
			this.menuList.template = this.menuListTemplate;
			DOMUtils.removeClass(this.searchEl, "wait");
		}
	}, {
		key: "_showContent",
		value: function _showContent(o) {
			if ((this.curItem.id === "community" || this.curItem.id === "favorites") && o !== this.curItem) {
				this._showEl(this.community.el);
				this.community.item = o;
			} else {
				var ref = app.reference;
				this.contentEl.innerHTML = this._isInReference(o) ? ref.getContent(o.id) : ref.fillTags((o.desc || "") + (o.ext || ""), o, ref);
				if (o.example) {
					this.contentEl.appendChild(new Example("Example", o.example).el);
				}
			}
		}
	}, {
		key: "_isInReference",
		value: function _isInReference(o) {
			do {
				if (o.id === "reference") {
					return true;
				}
			} while (o = o.parent);
			return false;
		}
	}, {
		key: "_onSelClick",
		value: function _onSelClick(o) {
			if (o.token) {
				var expr = app.expression;
				if (o.parent.id === "flags") {
					expr.toggleFlag(o.token);
				} else {
					expr.insert(o.token);
				}
			}
		}
	}, {
		key: "_showEl",
		value: function _showEl(el) {
			if (this.itemEl === el) {
				return;
			}
			this.itemEl = el;
			DOMUtils.empty(this.contentEl).appendChild(el);
		}
	}, {
		key: "_prepContent",
		value: function _prepContent(content$$1) {
			// inject reference:
			var i = Utils.findIndex(content$$1.kids, function (o) {
				return o.id === "reference";
			});
			content$$1.kids.splice(i, 1, app.reference.content);
			// grab home content from HTML:
			content$$1.desc = this.contentEl.innerHTML;
			// build idMap:
			this._idMap = { home: content$$1 };
			return Utils.prepMenuContent(content$$1, this._idMap);
		}
	}, {
		key: "_prepCheatsheet",
		value: function _prepCheatsheet() {
			var _this3 = this;

			var els = DOMUtils.queryAll("#cheatsheet *[data-id]");
			for (var i = 0, l = els.length; i < l; i++) {
				els[i].addEventListener("click", function (evt) {
					return _this3.goto(evt.target.dataset.id);
				});
			}
		}
	}, {
		key: "_onSearchChange",
		value: function _onSearchChange() {
			var id = this.curItem.id,
			    search = this.searchFld.value;
			if (id === "reference") {
				this._searchReference(search);
			} else if (id === "favorites") {
				this._searchFavorites(search);
			} else {
				return;
			}
			// TODO: this is a hacky way to reset the content:
			this.contentEl.innerHTML = this.curItem.desc;
			this.itemEl = null;
		}
	}, {
		key: "_searchReference",
		value: function _searchReference(search) {
			var result = app.reference.search(search);
			this.searchMode = !!search;
			this.menuList.data = search ? result : this.curItem.kids;
			// TODO: would be nice to show a "no match" message, but difficult to do with `hide=true` entries
		}
	}, {
		key: "_searchFavorites",
		value: function _searchFavorites(search) {
			var data = this.menuList.data,
			    rank = Utils.searchRank;
			data.forEach(function (o) {
				return o.hide = !rank(o, search);
			});
			this.menuList.data = data;
		}
	}, {
		key: "_onFlavorChange",
		value: function _onFlavorChange() {
			var item = this.selItem || this.curItem;
			if (!this._isInReference(item)) {
				return;
			}
			this.selItem = this.curItem = null;
			this.show(item);
		}
	}, {
		key: "_onSearchSubmit",
		value: function _onSearchSubmit() {
			var _this4 = this;

			this._abortReq();
			var val = this.searchFld.value;
			if (this.curItem.id === "community") {
				if (val) {
					Track.event("search", "engagement", { search_term: val, target: "community" });
				}
				DOMUtils.addClass(this.searchEl, "wait");
				this._showListMsg();
				this.openReq = Server.communitySearch(val).then(function (data) {
					return _this4._showServerResults(data);
				}).catch(function (msg) {
					return _this4._showListMsg(msg);
				}).finally(function () {
					return _this4._reqCleanup();
				});
			}
			this.searchFld.select();
		}
	}, {
		key: "_loadFavorites",
		value: function _loadFavorites() {
			var _this5 = this;

			this._abortReq();
			var val = this.searchFld.value;
			this.openReq = Server.patterns().then(function (data) {
				return _this5._showServerResults(data);
			}).catch(function (msg) {
				return _this5._showListMsg(msg);
			}).finally(function () {
				return _this5._reqCleanup();
			});
			this._showListMsg();
		}
	}, {
		key: "_showListMsg",
		value: function _showListMsg() {
			var msg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "Loading...";

			this.listEl.innerHTML = "<li class='loading'>" + msg + "</li>";
		}
	}, {
		key: "_abortReq",
		value: function _abortReq() {
			if (this.openReq) {
				this.openReq.abort();
			}
			this.openReq = null;
		}
	}, {
		key: "_showServerResults",
		value: function _showServerResults(data) {
			this.menuList.data = data.results;
			if (data.results.length === 0) {
				this._showListMsg(this.curItem.id === "community" ? "No matches." : "No patterns created or favorited.");
			}
		}
	}, {
		key: "_reqCleanup",
		value: function _reqCleanup(msg) {
			DOMUtils.removeClass(this.searchEl, "wait");
		}
	}]);
	return Sidebar;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Reference = function () {
	function Reference(content, flavor, config) {
		var _this = this;

		classCallCheck(this, Reference);

		this._config = config;
		this._flavor = flavor;
		this._flavor.on("change", function () {
			return _this._flavorChange();
		});

		this._injectEscChars(content);

		this._idMap = { reference: content };
		this._content = Utils.prepMenuContent(content, this._idMap);
		this._misc = Utils.prepMenuContent(content.misc, this._idMap);
		this._flavorChange();
	}

	createClass(Reference, [{
		key: "search",
		value: function search(searchStr) {
			function srch(kids, results) {
				for (var i = 0, l = kids.length; i < l; i++) {
					var kid = kids[i],
					    points = 0;
					if (kid.kids) {
						srch(kid.kids, results);continue;
					}
					if (points = Utils.searchRank(kid, searchStr)) {
						kid.__searchPoints = points;
						results.push(kid);
					}
				}
				return results;
			}
			return srch(this.content.kids, []).sort(function (a, b) {
				return b.__searchPoints - a.__searchPoints;
			});
		}
	}, {
		key: "idForToken",
		value: function idForToken(token) {
			if (this._idMap[token.err]) {
				return token.err;
			}
			if (this._idMap[token.type]) {
				return token.type;
			}
			if (this._idMap[token.clss]) {
				return token.clss;
			}
			return token.err || token.type || token.clss;
		}

		// methods used in fillTags:

	}, {
		key: "getChar",
		value: function getChar(token) {
			var chr = Reference.NONPRINTING_CHARS[token.code];
			return chr ? chr : "\"" + String.fromCharCode(token.code) + "\"";
		}
	}, {
		key: "getQuant",
		value: function getQuant(token) {
			var min = token.min,
			    max = token.max;
			return min === max ? min : max === -1 ? min + " or more" : "between " + min + " and " + max;
		}
	}, {
		key: "getUniCat",
		value: function getUniCat(token) {
			return Reference.UNICODE_CATEGORIES[token.value] || "[Unrecognized]";
		}
	}, {
		key: "getModes",
		value: function getModes(token) {
			var str = token.on ? " Enable \"<code>" + token.on + "</code>\"." : "";
			if (token.off) {
				str += " Disable \"<code>" + token.off + "</code>\".";
			}
			return str;
		}
	}, {
		key: "getInsensitive",
		value: function getInsensitive(token) {
			return token.modes ? "Case " + (token.modes.i ? "in" : "") + "sensitive." : "";
		}
	}, {
		key: "getDotAll",
		value: function getDotAll(token) {
			return (token.modes.s ? "including" : "except") + " line breaks";
		}
	}, {
		key: "getLabel",
		value: function getLabel(token) {
			var node = this.getNodeForToken(token);
			return node ? node.label || node.id || "" : token.type;
		}
	}, {
		key: "getDesc",
		value: function getDesc(token) {
			return this.getVal(this.getNodeForToken(token), "desc");
		}
	}, {
		key: "getLazy",
		value: function getLazy(token) {
			return token.modes.U ? "greedy" : "lazy";
		}
	}, {
		key: "getLazyFew",
		value: function getLazyFew(token) {
			return token.modes.U ? "many" : "few";
		}
	}, {
		key: "getPHPVersion",
		value: function getPHPVersion() {
			return this._config.PHPVersion;
		}
	}, {
		key: "getPCREVersion",
		value: function getPCREVersion() {
			return this._config.PCREVersion;
		}
	}, {
		key: "getCtrlKey",
		value: function getCtrlKey() {
			return Utils.getCtrlKey();
		}
	}, {
		key: "getEscChars",
		value: function getEscChars() {
			var o = this._flavor.profile.escChars,
			    str = "";
			for (var n in o) {
				str += n;
			}
			return str;
		}

		/*
  Searches for tags in the string in the format:
  `{{prop.prop}}` or `{{method(prop.prop)}}`
  
  The first format will inject the specified property of the data object.
  For example, `{{a.b}}` would inject the value of `data.a.b`.
  
  The second will inject the results of calling the specified function on the functs object with a property of the data object as it's parameter (or the data object itself if empty).
  For example, `{{myMethod(a.b)}}` would inject the return value of `functs.myMethod(data.a.b)`.
  
  Currently only supports a single param.
   */

	}, {
		key: "fillTags",
		value: function fillTags(str, data, functs, maxLength) {
			var htmlSafe = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;

			var match = void 0;
			while (match = str.match(/{{~?[\w.()]+}}/)) {
				var val = void 0,
				    f = void 0,
				    safe = false;
				val = match[0].substring(2, match[0].length - 2);
				if (val[0] === "~") {
					val = val.substr(1);
					safe = true;
				}
				var match2 = val.match(/\([\w.]*\)/);
				if (match2) {
					f = val.substr(0, match2.index);
					val = match2[0].substring(1, match2[0].length - 1);
				} else {
					f = null;
				}
				var o = data,
				    arr = val.split(".");
				for (var i = 0; i < arr.length; i++) {
					var prop = arr[i];
					if (prop && o) {
						o = o[prop];
					}
				}
				val = o;
				if (f) {
					if (functs[f]) {
						val = functs[f](val);
					} else {
						val = " <b class='exp-error'>[" + f + "]</b> ";
					}
				}
				if (!safe && (maxLength || htmlSafe)) {
					val = Utils.shorten(val, maxLength, htmlSafe, "i");
				}
				str = str.replace(match[0], val);
			}
			return str;
		}

		// returns doc props from the profile or reference as appropriate (ex. tip, desc, ext)

	}, {
		key: "getVal",
		value: function getVal(node, prop) {
			if (!node) {
				return "";
			}
			var pDocs = this._flavor.getDocs(node.id),
			    pRef = pDocs && pDocs[prop];
			if (pRef != null && pRef[0] !== "+") {
				return pRef;
			}
			var ref = node && node[prop] || "";
			return pRef != null ? ref + pRef.substr(1) : ref;
		}
	}, {
		key: "getNodeForToken",
		value: function getNodeForToken(token) {
			var id = this.idForToken(token),
			    clss = token.clss;

			// Special cases:
			if (clss === "quant") {
				id = clss;
			}
			if (clss === "esc" && token.type !== "escsequence") {
				id = "escchar";
			}

			return this.getNode(id);
		}
	}, {
		key: "getNode",
		value: function getNode(id) {
			var map = this._idMap,
			    node = map[id];
			while (node && node.proxy) {
				node = map[node.proxy];
			}
			return node;
		}
	}, {
		key: "getError",
		value: function getError(id, token) {
			// doesn't fill tags.
			return this._content.errors[id] || "no docs for error='" + id + "'";
		}
	}, {
		key: "tipForToken",
		value: function tipForToken(token) {
			if (!token) {
				return null;
			}

			var node = this.getNodeForToken(token),
			    label = void 0,
			    tip = void 0;

			if (token.err) {
				label = "<span class='error'>ERROR: </span>";
				tip = this.getError(token.err);
			} else {
				label = node ? node.label || node.id || "" : token.type;
				tip = this.getVal(node, "tip") || this.getVal(node, "desc");
				if (token.type === "group") {
					label += " #" + token.num;
				}
				label = "<b>" + label[0].toUpperCase() + label.substr(1) + ".</b> ";
			}

			return tip ? label + this.fillTags(tip, token, this, 20) : "no docs for id='" + this.idForToken(token) + "'";
		}
	}, {
		key: "getContent",
		value: function getContent(id) {
			var node = this.getNode(id);
			return this.fillTags(this.getVal(node, "desc") + this.getVal(node, "ext"), node, this);
		}

		// TODO: this isn't necessarily the most ideal place for this method (has nothing to do with Reference). Maybe move into Text?

	}, {
		key: "tipForMatch",
		value: function tipForMatch(match, text) {
			if (!match) {
				return null;
			}
			var more = match.l > 150;
			var str = "<b>match: </b>" + Utils.shorten(text.substr(match.i, match.l), 150, true, "i") + "<br/><b>range: </b><code>" + match.i + "-" + (match.i + match.l - 1) + "</code>";

			var groups = match.groups,
			    l = groups && groups.length;
			for (var i = 0; i < l; i++) {
				if (i > 3 && l > 5) {
					more = false;
					str += "<br><span class='more'>see Details for " + (l - i) + " more</span>";
					break;
				}
				var group = groups[i],
				    s = void 0;
				s = group.i !== undefined ? text.substr(group.i, group.l) : group.s;
				more = more || s && s.length > 50;
				str += i > 0 ? "<br>" : "<hr>";
				str += "<b>group #" + (i + 1) + ": </b>" + Utils.shorten(s, 50, true, "i");
			}
			if (more) {
				str += "<br><span class='more'>see Details for full matches</span>";
			}
			return str;
		}
	}, {
		key: "_flavorChange",


		// private methods:
		value: function _flavorChange() {
			this._updateHide(this.content);
		}
	}, {
		key: "_updateHide",
		value: function _updateHide(o, list) {
			// the list param is for debugging, it is populated with the ids of all nodes that were hidden.
			// parent nodes aren't hidden unless all their children are.
			var kids = o.kids,
			    hide = true;
			if (kids) {
				for (var i = 0, l = kids.length; i < l; i++) {
					hide = this._updateHide(kids[i], list) && hide;
				}
			} else {
				hide = o.show === false || o.show !== true && o.id && !this._flavor.isTokenSupported(o.id);
			}
			if (list && hide) {
				list.push(o.id);
			}
			return o.hide = hide;
		}
	}, {
		key: "_injectEscChars",
		value: function _injectEscChars(content) {
			var kids = Utils.find(content.kids, function (o) {
				return o.id === "escchars";
			}).kids;
			var template = Utils.find(content.misc.kids, function (o) {
				return o.id === "escchar";
			}).tip;
			// \x07 - bell, \x1b - esc
			var chars = "\t\n\v\f\r\0\x07\x1b",
			    tokens = "tnvfr0ae"; // .\\+*?^$[]{}()|/
			for (var i = 0, l = chars.length; i < l; i++) {
				kids.push(this._getEscCharDocs(chars[i], tokens[i], template));
			}
		}
	}, {
		key: "_getEscCharDocs",
		value: function _getEscCharDocs(c, t, template) {
			var code = c.charCodeAt(0),
			    chr = Reference.NONPRINTING_CHARS[code] || c;
			return {
				id: "esc_" + code,
				token: "\\" + (t || c),
				label: chr.toLowerCase(),
				desc: this.fillTags(template, { code: code }, this)
			};
		}
	}, {
		key: "content",
		get: function get$$1() {
			return this._content;
		}
	}]);
	return Reference;
}();

Reference.NONPRINTING_CHARS = {
	"0": "NULL",
	"1": "SOH",
	"2": "STX",
	"3": "ETX",
	"4": "EOT",
	"5": "ENQ",
	"6": "ACK",
	"7": "BELL",
	"8": "BS",
	"9": "TAB", //
	"10": "LINE FEED", //
	"11": "VERTICAL TAB",
	"12": "FORM FEED",
	"13": "CARRIAGE RETURN", //
	"14": "SO",
	"15": "SI",
	"16": "DLE",
	"17": "DC1",
	"18": "DC2",
	"19": "DC3",
	"20": "DC4",
	"21": "NAK",
	"22": "SYN",
	"23": "ETB",
	"24": "CAN",
	"25": "EM",
	"26": "SUB",
	"27": "ESC",
	"28": "FS",
	"29": "GS",
	"30": "RS",
	"31": "US",
	"32": "SPACE", //
	"127": "DEL"
};

Reference.UNICODE_CATEGORIES = {
	// from: http://www.pcre.org/original/doc/html/pcrepattern.html
	"C": "Other",
	"Cc": "Control",
	"Cf": "Format",
	"Cn": "Unassigned",
	"Co": "Private use",
	"Cs": "Surrogate",
	"L": "Letter",
	"L&": "Any letter ",
	"Ll": "Lower case letter",
	"Lm": "Modifier letter",
	"Lo": "Other letter",
	"Lt": "Title case letter",
	"Lu": "Upper case letter",
	"M": "Mark",
	"Mc": "Spacing mark",
	"Me": "Enclosing mark",
	"Mn": "Non-spacing mark",
	"N": "Number",
	"Nd": "Decimal number",
	"Nl": "Letter number",
	"No": "Other number",
	"P": "Punctuation",
	"Pc": "Connector punctuation",
	"Pd": "Dash punctuation",
	"Pe": "Close punctuation",
	"Pf": "Final punctuation",
	"Pi": "Initial punctuation",
	"Po": "Other punctuation",
	"Ps": "Open punctuation",
	"S": "Symbol",
	"Sc": "Currency symbol",
	"Sk": "Modifier symbol",
	"Sm": "Mathematical symbol",
	"So": "Other symbol",
	"Z": "Separator",
	"Zl": "Line separator",
	"Zp": "Paragraph separator",
	"Zs": "Space separator"
};

var _o$errors;

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// this is just raw content for the Reference.
// right now all examples are executed in-browser, so they need to be compatible. Maybe swap to XRegExp at some point.
// TODO: rewrite to use multiline template literals?

var reference_content = {};
var o = reference_content;
o.label = "Reference";
o.id = "reference";
o.search = true, o.desc = "Information on all of the tokens available to create regular expressions.\n\t<p>Click a selected item again to insert it into your Expression.</p>\n\t<p>Click the arrow beside an example to load it.</p>";

o.kids = [{
	label: "Character classes",
	id: "charclasses",
	desc: "Character classes match a character from a specific set. There are a number of predefined character classes and you can also define your own sets.",
	kids: [{
		id: "set",
		label: "character set",
		desc: "Match any character in the set.",
		example: ["[aeiou]", "glib jocks vex dwarves!"],
		token: "[ABC]"
	}, {
		id: "setnot",
		label: "negated set",
		desc: "Match any character that is not in the set.",
		example: ["[^aeiou]", "glib jocks vex dwarves!"],
		token: "[^ABC]"
	}, {
		id: "range",
		tip: "Matches a character in the range {{getChar(prev)}} to {{getChar(next)}} (char code {{prev.code}} to {{next.code}}). {{getInsensitive()}}",
		example: ["[g-s]", "abcdefghijklmnopqrstuvwxyz"],
		desc: "Matches a character having a character code between the two specified characters inclusive.",
		token: "[A-Z]"
	}, {
		id: "posixcharclass",
		tip: "Matches any character in the '{{value}}' POSIX class.",
		label: "POSIX class",
		desc: "Matches any character in the specified POSIX class. Must be in a character set. For example, <code>[[:alnum:]$]</code> will match alphanumeric characters and <code>$</code>.",
		ext: "<p>For a list of classes, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>",
		token: "[:alnum:]"
	}, {
		id: "dot",
		tip: "Matches any character {{getDotAll()}}.",
		desc: "Matches any character except linebreaks.",
		ext: " Equivalent to <code>[^\\n\\r]</code>.",
		example: [".", "glib jocks vex dwarves!"],
		token: "."
	}, {
		label: "match any",
		desc: "A character set that can be used to match any character, including line breaks, without the dotall flag (<code>s</code>)." + "<p>An alternative is <code>[^]</code>, but it is not supported in all browsers.</p>",
		example: ["[\\s\\S]", "glib jocks vex dwarves!"],
		token: "[\\s\\S]"
	}, {
		id: "unicodegrapheme",
		label: "unicode grapheme",
		desc: "Matches any single unicode grapheme (ie. character).",
		ext: " This includes line breaks (regardless of the dotall mode) and graphemes encoded as multiple code points.",
		token: "\\X"
	}, {
		id: "word",
		desc: "Matches any word character (alphanumeric & underscore).",
		ext: " Only matches low-ascii characters (no accented or non-roman characters). Equivalent to <code>[A-Za-z0-9_]</code>",
		example: ["\\w", "bonjour, mon fr\xE8re"],
		token: "\\w"
	}, {
		id: "notword",
		label: "not word",
		desc: "Matches any character that is not a word character (alphanumeric & underscore).",
		ext: " Equivalent to <code>[^A-Za-z0-9_]</code>",
		example: ["\\W", "bonjour, mon fr\xE8re"],
		token: "\\W"
	}, {
		id: "digit",
		desc: "Matches any digit character (0-9).",
		ext: " Equivalent to <code>[0-9]</code>.",
		example: ["\\d", "+1-(444)-555-1234"],
		token: "\\d"
	}, {
		id: "notdigit",
		label: "not digit",
		desc: "Matches any character that is not a digit character (0-9).",
		ext: " Equivalent to <code>[^0-9]</code>.",
		example: ["\\D", "+1-(444)-555-1234"],
		token: "\\D"
	}, {
		id: "whitespace",
		desc: "Matches any whitespace character (spaces, tabs, line breaks).",
		example: ["\\s", "glib jocks vex dwarves!"],
		token: "\\s"
	}, {
		id: "notwhitespace",
		label: "not whitespace",
		desc: "Matches any character that is not a whitespace character (spaces, tabs, line breaks).",
		example: ["\\S", "glib jocks vex dwarves!"],
		token: "\\S"
	}, {
		id: "hwhitespace",
		label: "horizontal whitespace",
		desc: "Matches any horizontal whitespace character (spaces, tabs).",
		token: "\\h"
	}, {
		id: "nothwhitespace",
		label: "not horizontal whitespace",
		desc: "Matches any character that is not a horizontal whitespace character (spaces, tabs).",
		token: "\\H"
	}, {
		id: "vwhitespace",
		label: "vertical whitespace",
		desc: "Matches any vertical whitespace character (line breaks).",
		token: "\\v"
	}, {
		id: "notvwhitespace",
		label: "not vertical whitespace",
		desc: "Matches any character that is not a vertical whitespace character (line breaks).",
		token: "\\V"
	}, {
		id: "linebreak",
		label: "line break",
		desc: "Matches any line break character, including the CRLF pair, and CR / LF individually.",
		token: "\\R"
	}, {
		id: "notlinebreak",
		label: "not line break",
		desc: "Matches any character that is not a line break.",
		ext: " Similar to dot (<code>.</code>) but is unaffected by the dotall flag (<code>s</code>).",
		token: "\\N"
	}, {
		id: "unicodecat",
		tip: "Matches any character in the '{{getUniCat()}}' unicode category.",
		label: "unicode category",
		desc: "Matches a character in the specified unicode category. For example, <code>\\p{Ll}</code> will match any lowercase letter.",
		ext: "<p>For a list of categories, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>" + "<p>There are multiple syntaxes for this feature:</p><p><code>\\p{L}</code> <code>\\pL</code></p>",
		token: "\\p{L}"
	}, {
		id: "notunicodecat",
		tip: "Matches any character that is not in the '{{getUniCat()}}' unicode category.",
		label: "not unicode category",
		desc: "Matches any character that is not in the specified unicode category.",
		ext: "<p>For a list of categories, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>" + "<p>There are multiple syntaxes for this feature:</p><p><code>\\P{L}</code> <code>\\p{^L}</code> <code>\\PL</code></p>",
		token: "\\P{L}"
	}, {
		id: "unicodescript",
		tip: "Matches any character in the '{{value}}' unicode script.",
		label: "unicode script",
		desc: "Matches any character in the specified unicode script. For example, <code>\\p{Arabic}</code> will match characters in the Arabic script.",
		ext: "<p>For a list of scripts, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>",
		token: "\\p{Han}"
	}, {
		id: "notunicodescript",
		tip: "Matches any character that is not in the '{{value}}' unicode script.",
		label: "not unicode script",
		desc: "Matches any character that is not in the specified unicode script.",
		ext: "<p>For a list of scripts, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>" + "<p>There are multiple syntaxes for this feature:</p><p><code>\\P{Han}</code> <code>\\p{^Han}</code>",
		token: "\\P{Han}"
	}]
}, {
	label: "Anchors",
	id: "anchors",
	desc: "Anchors are unique in that they match a position within a string, not a character.",
	kids: [{
		id: "bos",
		label: "beginning of string",
		desc: "Matches the beginning of the string.",
		ext: " Unlike <code>^</code>, this is unaffected by the multiline flag (<code>m</code>). This matches a position, not a character.",
		token: "\\A"
	}, {
		id: "eos",
		label: "end of string",
		desc: "Matches the end of the string.",
		ext: " Unlike <code>$</code>, this is unaffected by the multiline flag (<code>m</code>). This matches a position, not a character.",
		token: "\\Z"
	}, {
		id: "abseos",
		label: "strict end of string",
		desc: "Matches the end of the string. Unlike <code>$</code> or <code>\\Z</code>, it does not allow for a trailing newline.",
		ext: " This is unaffected by the multiline flag (<code>m</code>). This matches a position, not a character.",
		token: "\\z"
	}, {
		id: "bof",
		label: "beginning",
		desc: "Matches the beginning of the string, or the beginning of a line if the multiline flag (<code>m</code>) is enabled.",
		ext: " This matches a position, not a character.",
		example: ["^\\w+", "she sells seashells"],
		token: "^"
	}, {
		id: "eof",
		label: "end",
		desc: "Matches the end of the string, or the end of a line if the multiline flag (<code>m</code>) is enabled.",
		ext: " This matches a position, not a character.",
		example: ["\\w+$", "she sells seashells"],
		token: "$"
	}, {
		id: "wordboundary",
		label: "word boundary",
		desc: "Matches a word boundary position between a word character and non-word character or position (start / end of string).",
		ext: " See the word character class (<code>\w</code>) for more info.",
		example: ["s\\b", "she sells seashells"],
		token: "\\b"
	}, {
		id: "notwordboundary",
		label: "not word boundary",
		desc: "Matches any position that is not a word boundary.",
		ext: " This matches a position, not a character.",
		example: ["s\\B", "she sells seashells"],
		token: "\\B"
	}, {
		id: "prevmatchend",
		label: "previous match end",
		desc: "Matches the end position of the previous match.",
		ext: " This matches a position, not a character.",
		token: "\\G"
	}]
}, {
	label: "Escaped characters",
	id: "escchars",
	desc: "Escape sequences can be used to insert reserved, special, and unicode characters. All escaped characters begin with the <code>\\</code> character.",
	kids: [{
		id: "reservedchar",
		label: "reserved characters",
		desc: "The following character have special meaning, and must be preceded by a <code>\\</code> (backslash) to represent a literal character:" + "<p><code>{{getEscChars()}}</code></p>" + "<p>Within a character set, only <code>\\</code>, <code>-</code>, and <code>]</code> need to be escaped.</p>",
		example: ["\\+", "1 + 1 = 2"],
		token: "\\+",
		show: true
	}, {
		id: "escoctal",
		label: "octal escape",
		desc: "Octal escaped character in the form <code>\\000</code>.",
		ext: " Value must be less than 255 (<code>\\377</code>).", // PCRE profile adds to ext.
		example: ["\\251", "RegExr is \xA92014"],
		token: "\\000"
	}, {
		id: "eschexadecimal",
		label: "hexadecimal escape",
		desc: "Hexadecimal escaped character in the form <code>\\xFF</code>.",
		example: ["\\xA9", "RegExr is \xA92014"],
		token: "\\xFF"
	}, {
		id: "escunicodeu",
		label: "unicode escape",
		desc: "Unicode escaped character in the form <code>\\uFFFF</code>",
		example: ["\\u00A9", "RegExr is \xA92014"],
		token: "\\uFFFF"
	}, {
		id: "escunicodeub",
		label: "extended unicode escape",
		desc: "Unicode escaped character in the form <code>\\u{FFFF}</code>.",
		ext: " Supports a full range of unicode point escapes with any number of hex digits. <p>Requires the unicode flag (<code>u</code>).</p>",
		token: "\\u{FFFF}"
	}, {
		id: "escunicodexb",
		label: "unicode escape",
		desc: "Unicode escaped character in the form <code>\\x{FF}</code>.",
		token: "\\x{FF}"
	}, {
		id: "esccontrolchar",
		label: "control character escape",
		desc: "Escaped control character in the form <code>\\cZ</code>.",
		ext: " This can range from <code>\\cA</code> (SOH, char code 1) to <code>\\cZ</code> (SUB, char code 26). <h1>Example:</h1><code>\\cI</code> matches TAB (char code 9).",
		token: "\\cI"
	}, {
		id: "escsequence",
		label: "escape sequence",
		tip: "Matches the literal string '{{value}}'.",
		desc: "All characters between the <code>\\Q</code> and the <code>\\E</code> are interpreted as a literal string. If <code>\\E</code> is omitted, it continues to the end of the expression.",
		ext: " For example, the expression <code>/\\Q(?.)\\E/</code> will match the string <code>(?.)</code>.",
		token: "\\Q...\\E"
	}]
}, {
	label: "Groups & References",
	id: "groups",
	desc: "Groups allow you to combine a sequence of tokens to operate on them together. Capture groups can be referenced by a backreference and accessed separately in the results.",
	kids: [{
		id: "group",
		label: "capturing group",
		desc: "Groups multiple tokens together and creates a capture group for extracting a substring or using a backreference.",
		example: ["(ha)+", "hahaha haa hah!"],
		token: "(ABC)"
	}, {
		id: "namedgroup",
		label: "named capturing group",
		tip: "Creates a capturing group named '{{name}}'.",
		desc: "Creates a capturing group that can be referenced via the specified name.",
		ext: "<p>There are multiple syntaxes for this feature:</p><p><code>(?'name'ABC)</code> <code>(?P&lt;name>ABC)</code> <code>(?&lt;name>ABC)</code></p>",
		token: "(?'name'ABC)"
	}, {
		id: "namedref",
		label: "named reference",
		tip: "Matches the results of the capture group named '{{group.name}}'.",
		desc: "Matches the results of a named capture group.",
		ext: "<p>There are multiple syntaxes for this feature:</p><p><code>\\k'name'</code> <code>\\k&lt;name></code> <code>\\k{name}</code> <code>\\g{name}</code> <code>(?P=name)</code></p>",
		token: "\\k'name'"
	}, {
		id: "numref",
		label: "numeric reference",
		tip: "Matches the results of capture group #{{group.num}}.",
		desc: "Matches the results of a capture group. For example <code>\\1</code> matches the results of the first capture group & <code>\\3</code> matches the third.",
		// PCRE adds relative and alternate syntaxes in ext
		example: ["(\\w)a\\1", "hah dad bad dab gag gab"],
		token: "\\1"
	}, {
		id: "branchreset",
		label: "branch reset group",
		desc: "Define alternative groups that share the same group numbers.",
		ext: "<p>For example, in <code>(?|(a)|(b))</code> both groups (a and b) would be counted as group #1.",
		token: "(?|(a)|(b))"
	}, {
		id: "noncapgroup",
		label: "non-capturing group",
		desc: "Groups multiple tokens together without creating a capture group.",
		example: ["(?:ha)+", "hahaha haa hah!"],
		token: "(?:ABC)"
	}, {
		id: "atomic",
		label: "atomic group",
		desc: "Non-capturing group that discards backtracking positions once matched.",
		ext: "<p>For example, <code>/(?>ab|a)b/</code> will match <code>abb</code> but not <code>ab</code> because once the <code>ab</code> option has matched, the atomic group prevents backtracking to retry with the <code>a</code> option.</p>",
		token: "(?>ABC)"
	}, {
		id: "define",
		desc: "Used to define named groups for use as subroutines without including them in the match.",
		ext: "<p>For example, <code>/A(?(DEFINE)(?'foo'Z))B\\g'foo'/</code> will match <code>ABZ</code>, because the define group is ignored in the match except to define the <code>foo</code> subroutine that is referenced later with <code>\\g'foo'</code>.</p>",
		token: "(?(DEFINE)(?'foo'ABC))"
	}, {
		id: "numsubroutine",
		label: "numeric subroutine",
		tip: "Matches the expression in capture group #{{group.num}}.",
		desc: "Matches the expression in a capture group. Compare this to a reference, that matches the result." + " For example <code>/(a|b)\\g'1'/</code> can match <code>ab</code>, because the expression <code>a|b</code> is evaluated again.",
		ext: "<p>There are multiple syntaxes for this feature: <code>\\g&lt;1></code> <code>\\g'1'</code> <code>(?1)</code>.</p>" + "<p>Relative values preceded by <code>+</code> or <code>-</code> are also supported. For example <code>\\g<-1></code> would match the group preceding the reference.</p>",
		token: "\\g'1'"
	}, {
		id: "namedsubroutine",
		label: "named subroutine",
		tip: "Matches the expression in the capture group named '{{group.name}}'.",
		desc: "Matches the expression in a capture group. Compare this to a reference, that matches the result.",
		ext: "<p>There are multiple syntaxes for this feature: <code>\\g&lt;name></code> <code>\\g'name'</code> <code>(?&name)</code> <code>(?P>name)</code>.</p>",
		token: "\\g'name'"
	}]
}, {
	label: "Lookaround",
	id: "lookaround",
	desc: "Lookaround lets you match a group before (lookbehind) or after (lookahead) your main pattern without including it in the result." + "<p>Negative lookarounds specify a group that can NOT match before or after the pattern.</p>",
	kids: [{
		id: "poslookahead",
		label: "positive lookahead",
		desc: "Matches a group after the main expression without including it in the result.",
		example: ["\\d(?=px)", "1pt 2px 3em 4px"],
		token: "(?=ABC)"
	}, {
		id: "neglookahead",
		label: "negative lookahead",
		desc: "Specifies a group that can not match after the main expression (if it matches, the result is discarded).",
		example: ["\\d(?!px)", "1pt 2px 3em 4px"],
		token: "(?!ABC)"
	}, {
		id: "poslookbehind",
		label: "positive lookbehind",
		desc: "Matches a group before the main expression without including it in the result.",
		token: "(?<=ABC)"
	}, {
		id: "neglookbehind",
		label: "negative lookbehind",
		desc: "Specifies a group that can not match before the main expression (if it matches, the result is discarded).",
		token: "(?<!ABC)"
	}, {
		id: "keepout",
		label: "keep out",
		desc: "Keep text matched so far out of the returned match, essentially discarding the match up to this point.",
		ext: "For example <code>/o\\Kbar/</code> will match <code>bar</code> within the string <code>foobar</code>",
		token: "\\K"
	}]
}, {
	label: "Quantifiers & Alternation",
	id: "quants",
	desc: "Quantifiers indicate that the preceding token must be matched a certain number of times. By default, quantifiers are greedy, and will match as many characters as possible." + "<hr/>Alternation acts like a boolean OR, matching one sequence or another.",
	kids: [{
		id: "plus",
		desc: "Matches 1 or more of the preceding token.",
		example: ["b\\w+", "b be bee beer beers"],
		token: "+"
	}, {
		id: "star",
		desc: "Matches 0 or more of the preceding token.",
		example: ["b\\w*", "b be bee beer beers"],
		token: "*"
	}, {
		id: "quant",
		label: "quantifier",
		tip: "Match {{getQuant()}} of the preceding token.",
		desc: "Matches the specified quantity of the previous token. " + "<code>{1,3}</code> will match 1 to 3. " + "<code>{3}</code> will match exactly 3. " + "<code>{3,}</code> will match 3 or more. ",
		example: ["b\\w{2,3}", "b be bee beer beers"],
		token: "{1,3}"
	}, {
		id: "opt",
		label: "optional",
		desc: "Matches 0 or 1 of the preceding token, effectively making it optional.",
		example: ["colou?r", "color colour"],
		token: "?"
	}, {
		id: "lazy",
		tip: "Makes the preceding quantifier {{getLazy()}}, causing it to match as {{getLazyFew()}} characters as possible.",
		desc: "Makes the preceding quantifier lazy, causing it to match as few characters as possible.",
		ext: " By default, quantifiers are greedy, and will match as many characters as possible.",
		example: ["b\\w+?", "b be bee beer beers"],
		token: "?"
	}, {
		id: "possessive",
		desc: "Makes the preceding quantifier possessive. It will match as many characters as possible, and will not release them to match subsequent tokens.",
		ext: "<p>For example <code>/.*a/</code> would match <code>aaa</code>, but <code>/.*+a/</code> would not, because the repeating dot would match and not release the last character to match <code>a</code>.</p>",
		token: "+"
	}, {
		id: "alt",
		label: "alternation",
		desc: "Acts like a boolean OR. Matches the expression before or after the <code>|</code>.",
		ext: "<p>It can operate within a group, or on a whole expression. The patterns will be tested in order.</p>",
		example: ["b(a|e|i)d", "bad bud bod bed bid"],
		token: "|"
	}]
}, {
	label: "Special",
	id: "other",
	desc: "Tokens that don't quite fit anywhere else.",
	kids: [{
		id: "comment",
		desc: "Allows you to insert a comment into your expression that is ignored when finding a match.",
		token: "(?#foo)"
	}, {
		id: "conditional",
		desc: "Conditionally matches one of two options based on whether a lookaround is matched.",
		ext: "<p>For example, <code>/(?(?=a)ab|..)/</code> will match <code>ab</code> and <code>zx</code> but not <code>ax</code>, because if the first character matches the condition <code>a</code> then it evaluates the pattern <code>ab</code>.</p>" + "<p>Any lookaround can be used as the condition. A lookahead will start the subsequent match at the start of the condition, a lookbehind will start it after.</p>",
		token: "(?(?=A)B|C)"
	}, {
		id: "conditionalgroup",
		label: "group conditional",
		desc: "Conditionally matches one of two options based on whether group '{{name}}' matched.",
		ext: "<p>For example, <code>/(z)?(?(1)a|b)/</code> will match <code>za</code> because the first capture group matches <code>z</code> successfully, which causes the conditional to match the first option <code>a</code>.</p>" + "<p>The same pattern will also match <code>b</code> on its own, because group 1 doesn't match, so it instead tries to match the second option <code>b</code>.</p>" + "<p>You can reference a group by name, number, or relative position (ex. <code>-1</code>).</p>",
		token: "(?(1)B|C)"
	}, {
		id: "recursion",
		desc: "Attempts to match the full expression again at the current position.",
		ext: "<p>For example, <code>/a(?R)?b/</code> will match any number of <code>a</code> followed by the same number of <code>z</code>: the full text of <code>az</code> or <code>aaaazzzz</code>, but not <code>azzz</code>.</p>" + "<p>There are multiple syntaxes for this feature:</p><p><code>(?R)</code> <code>(?0)</code> <code>\\g<0></code> <code>\\g'0'</code></p>",
		token: "(?R)"
	}, {
		id: "mode",
		label: "mode modifier",
		tip: "{{~getDesc()}}{{~getModes()}}",
		desc: "Enables or disables modes for the remainder of the expression.",
		ext: "Matching modes generally map to expression flags. For example <code>(?i)</code> would enable case insensitivity for the remainder of the expression." + "<p>Multiple modifiers can be specified, and any modifiers that follow <code>-</code> are disabled. For example <code>(?im-s)</code> would enable case insensitivity &amp; multiline modes, and disable dotall.</p>" + "<p>Supported modifiers are: <code>i</code> - case insensitive, <code>s</code> - dotall, <code>m</code> - multiline, <code>x</code> - free spacing, <code>J</code> - allow duplicate names, <code>U</code> - ungreedy.</p>",
		token: "(?i)"
	}]
}, {
	label: "Substitution",
	desc: "These tokens are used in a substitution string to insert different parts of the match.",
	target: "subst",
	id: "subst",
	kids: [{
		id: "subst_$&match",
		label: "match",
		desc: "Inserts the matched text.",
		token: "$&"
	}, {
		id: "subst_0match",
		label: "match",
		desc: "Inserts the matched text.",
		ext: "<p>There are multiple syntaxes for this feature:</p><p><code>$0</code> <code>\\0</code> <code>\\{0}</code></p>",
		token: "$0"
	}, {
		id: "subst_group",
		label: "capture group",
		tip: "Inserts the results of capture group #{{group.num}}.",
		desc: "Inserts the results of the specified capture group. For example, <code>$3</code> would insert the third capture group.",
		// NOTE: javascript profile overrides this:
		ext: "<p>There are multiple syntaxes for this feature:</p><p><code>$1</code> <code>\\1</code> <code>\\{1}</code></p>",
		token: "$1"
	}, {
		id: "subst_$before",
		label: "before match",
		desc: "Inserts the portion of the source string that precedes the match.",
		token: "$`"
	}, {
		id: "subst_$after",
		label: "after match",
		desc: "Inserts the portion of the source string that follows the match.",
		token: "$'"
	}, {
		id: "subst_$esc",
		label: "escaped $",
		desc: "Inserts a dollar sign character ($).",
		token: "$$"
	}, {
		id: "subst_esc",
		label: "escaped characters",
		token: "\\n",
		desc: "For convenience, these escaped characters are supported in the Replace string in RegExr: <code>\\n</code>, <code>\\r</code>, <code>\\t</code>, <code>\\\\</code>, and unicode escapes <code>\\uFFFF</code>. This may vary in your deploy environment."
	}]
}, {
	id: "flags",
	label: "Flags",
	tooltip: "Expression flags change how the expression is interpreted. Click to edit.",
	desc: "Expression flags change how the expression is interpreted. There are three flags in JS: i, g, and m. Flags follow the closing backslash of the expression (ex. <code>/.+/igm</code> ).",
	target: "flags",
	kids: [{
		id: "caseinsensitive",
		label: "ignore case",
		desc: "Makes the whole expression case-insensitive.",
		ext: " For example, <code>/aBc/i</code> would match <code>AbC</code>.",
		token: "i"
	}, {
		id: "global",
		label: "global search",
		tip: "Retain the index of the last match, allowing iterative searches.",
		desc: "Retain the index of the last match, allowing subsequent searches to start from the end of the previous match." + "<p>Without the global flag, subsequent searches will return the same match.</p><hr/>" + "RegExr only searches for a single match when the global flag is disabled to avoid infinite match errors.",
		token: "g"
	}, {
		id: "multiline",
		tip: "Beginning/end anchors (<b>^</b>/<b>$</b>) will match the start/end of a line.",
		desc: "When the multiline flag is enabled, beginning and end anchors (<code>^</code> and <code>$</code>) will match the start and end of a line, instead of the start and end of the whole string." + "<p>Note that patterns such as <code>/^[\\s\\S]+$/m</code> may return matches that span multiple lines because the anchors will match the start/end of <b>any</b> line.</p>",
		token: "m"
	}, {
		id: "unicode",
		tip: "Enables <code>\\x{FFFFF}</code> unicode escapes.",
		desc: "When the unicode flag is enabled, you can use extended unicode escapes in the form <code>\\x{FFFFF}</code>." + "<p>It also makes other escapes stricter, causing unrecognized escapes (ex. <code>\\j</code>) to throw an error.</p>",
		token: "u"
	}, {
		id: "sticky",
		desc: "The expression will only match from its lastIndex position and ignores the global (<code>g</code>) flag if set.",
		ext: " Because each search in RegExr is discrete, this flag has no further impact on the displayed results.",
		token: "y"
	}, {
		id: "dotall",
		desc: "Dot (<code>.</code>) will match any character, including newline.",
		token: "s"
	}, {
		id: "extended",
		desc: "Literal whitespace characters are ignored, except in character sets.",
		token: "x"
	}, {
		id: "ungreedy",
		tip: "Makes quantifiers ungreedy (lazy) by default.",
		desc: "Makes quantifiers ungreedy (lazy) by default. Quantifiers followed by <code>?</code> will become greedy.",
		token: "U"
	}]
}];

// content that isn't included in the Reference menu item:
o.misc = {
	kids: [{
		id: "ignorews",
		label: "ignored whitespace",
		tip: "Whitespace character ignored due to the e<b>x</b>tended flag or mode."
	}, {
		id: "extnumref", // alternative syntaxes.
		proxy: "numref"
	}, {
		id: "char",
		label: "character",
		tip: "Matches a {{getChar()}} character (char code {{code}}). {{getInsensitive()}}"
	}, {
		id: "escchar",
		label: "escaped character",
		tip: "Matches a {{getChar()}} character (char code {{code}})."
	}, {
		id: "open",
		tip: "Indicates the start of a regular expression."
	}, {
		id: "close",
		tip: "Indicates the end of a regular expression and the start of expression flags."
	}, {
		id: "condition",
		tip: "The lookaround to match in resolving the enclosing conditional statement. See 'conditional' in the Reference for info."
	}, {
		id: "conditionalelse",
		label: "conditional else",
		tip: "Delimits the 'else' portion of the conditional."
	}, {
		id: "ERROR",
		tip: "Errors in the expression are underlined in red. Roll over errors for more info."
	}, {
		id: "PREG_INTERNAL_ERROR",
		tip: "Internal PCRE error"
	}, {
		id: "PREG_BACKTRACK_LIMIT_ERROR",
		tip: "Backtrack limit was exhausted."
	}, {
		id: "PREG_RECURSION_LIMIT_ERROR",
		tip: "Recursion limit was exhausted"
	}, {
		id: "PREG_BAD_UTF8_ERROR",
		tip: "Malformed UTF-8 data"
	}, {
		id: "PREG_BAD_UTF8_OFFSET_ERROR",
		tip: "Malformed UTF-8 data"
	}]
};

o.errors = (_o$errors = {
	groupopen: "Unmatched opening parenthesis.",
	groupclose: "Unmatched closing parenthesis.",
	setopen: "Unmatched opening square bracket.",
	rangerev: "Range values reversed. Start char code is greater than end char code.",
	quanttarg: "Invalid target for quantifier.",
	quantrev: "Quantifier minimum is greater than maximum.",
	esccharopen: "Dangling backslash.",
	esccharbad: "Unrecognized or malformed escape character.",
	unicodebad: "Unrecognized unicode category or script.",
	posixcharclassbad: "Unrecognized POSIX character class.",
	posixcharclassnoset: "POSIX character class must be in a character set.",
	notsupported: "The \"{{~getLabel()}}\" feature is not supported in this flavor of RegEx.",
	fwdslash: "Unescaped forward slash. This may cause issues if copying/pasting this expression into code."
}, defineProperty(_o$errors, "esccharbad", "Invalid escape sequence."), defineProperty(_o$errors, "infinite", "The expression can match 0 characters, and therefore matches infinitely."), defineProperty(_o$errors, "timeout", "The expression took longer than 250ms to execute."), defineProperty(_o$errors, "servercomm", "An error occurred while communicating with the server."), defineProperty(_o$errors, "extraelse", "Extra else in conditional group."), defineProperty(_o$errors, "unmatchedref", "Reference to non-existent group \"{{name}}\"."), defineProperty(_o$errors, "modebad", "Unrecognized mode flag \"<code>{{errmode}}</code>\"."), defineProperty(_o$errors, "badname", "Group name can not start with a digit."), defineProperty(_o$errors, "dupname", "Duplicate group name."), defineProperty(_o$errors, "branchreseterr", "<b>Branch Reset.</b> Results will be ok, but RegExr's parser does not number branch reset groups correctly. Coming soon!"), defineProperty(_o$errors, "jsfuture", "The \"{{~getLabel()}}\" feature may not be supported in all browsers."), _o$errors);

/*
classes:
quant
set
special
ref
esc
anchor
charclass
group
comment
 */

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var BrowserSolver = function () {
	function BrowserSolver() {
		classCallCheck(this, BrowserSolver);
	}

	createClass(BrowserSolver, [{
		key: "solve",
		value: function solve(o, callback) {
			var _this = this;

			this._callback = callback;
			this._req = o;

			var text = o.text,
			    regex = void 0;
			try {
				this._regex = regex = new RegExp(o.pattern, o.flags);
			} catch (e) {
				return this._onRegExComplete({ id: "regexparse", name: e.name, message: e.message });
			}

			if (window.Worker) {
				if (this._worker) {
					clearTimeout(this._timeoutId);
					this._worker.terminate();
				}

				var worker = this._worker = new Worker("assets/workers/RegExWorker.js");

				worker.onmessage = function (evt) {
					if (evt.data === "onload") {
						_this._startTime = Utils.now();
						_this._timeoutId = setTimeout(function () {
							_this._doCallback({ id: "timeout" });
							worker.terminate();
						}, 250);
					} else {
						clearTimeout(_this._timeoutId);
						_this._onRegExComplete(evt.data.error, evt.data.matches);
					}
				};

				// we need to pass the pattern and flags as text, because Safari strips the unicode flag when passing a RegExp to a Worker
				worker.postMessage({ pattern: o.pattern, flags: o.flags, text: text });
			} else {
				this._startTime = Utils.now();

				// shared between BrowserSolver & RegExWorker
				var matches = [],
				    match,
				    index,
				    error;
				while (match = regex.exec(text)) {
					if (index === regex.lastIndex) {
						error = { id: "infinite" };break;
					}
					index = regex.lastIndex;
					var groups = match.reduce(function (arr, s, i) {
						return (i === 0 || arr.push({ s: s })) && arr;
					}, []);
					matches.push({ i: match.index, l: match[0].length, groups: groups });
					if (!regex.global) {
						break;
					} // or it will become infinite.
				}
				// end share

				this._onRegExComplete(error, matches);
			}
		}
	}, {
		key: "_onRegExComplete",
		value: function _onRegExComplete(error, matches) {
			var result = {
				time: Utils.now() - this._startTime,
				error: error,
				matches: matches
			};

			var tool = this._req.tool;
			result.tool = { id: tool.id };
			if (!error && tool.input != null) {
				var str = Utils.unescSubstStr(tool.input);
				result.tool.result = tool.id === "replace" ? this._getReplace(str) : this._getList(str);
			}
			this._callback(result);
		}
	}, {
		key: "_getReplace",
		value: function _getReplace(str) {
			return this._req.text.replace(this._regex, str);
		}
	}, {
		key: "_getList",
		value: function _getList(str) {
			var source = this._req.text,
			    result = "",
			    repl = void 0,
			    ref = void 0,
			    trimR = 0,
			    regex = void 0;

			// build a RegExp without the global flag:
			try {
				regex = new RegExp(this._req.pattern, this._req.flags.replace("g", ""));
			} catch (e) {
				return null;
			}

			if (str.search(/\$[&1-9`']/) === -1) {
				trimR = str.length;
				str = "$&" + str;
			}
			while (true) {
				ref = source.replace(regex, "\b");
				var index = ref.indexOf("\b");
				if (index === -1 || ref.length > source.length) {
					break;
				}
				repl = source.replace(regex, str);
				result += repl.substr(index, repl.length - ref.length + 1);
				source = ref.substr(index + 1);
			}
			if (trimR) {
				result = result.substr(0, result.length - trimR);
			}
			return result;
		}
	}]);
	return BrowserSolver;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var ServerSolver = function () {
	function ServerSolver() {
		classCallCheck(this, ServerSolver);
	}

	createClass(ServerSolver, [{
		key: "solve",
		value: function solve(o, callback) {
			var _this = this;

			// unescape tool input:
			if (o.tool.input != null) {
				o.tool.input = Utils.unescSubstStr(o.tool.input);
			}
			if (this._serverPromise) {
				this._serverPromise.abort();
			}
			Utils.defer(function () {
				return _this._solve(o, callback);
			}, "ServerSolver._solve", 250);
		}
	}, {
		key: "_solve",
		value: function _solve(o, callback) {
			var _this2 = this;

			this._callback = callback;
			this._serverPromise = Server.solve(o).then(function (o) {
				return _this2._onLoad(o);
			}).catch(function (o) {
				return _this2._onError(o);
			});
		}
	}, {
		key: "_onLoad",
		value: function _onLoad(data) {
			this._callback(data);
		}
	}, {
		key: "_onError",
		value: function _onError(msg) {
			this._callback({ error: { id: msg } });
		}
	}]);
	return ServerSolver;
}();

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var Flavor = function (_EventDispatcher) {
	inherits(Flavor, _EventDispatcher);

	function Flavor(flavor) {
		classCallCheck(this, Flavor);

		var _this = possibleConstructorReturn(this, (Flavor.__proto__ || Object.getPrototypeOf(Flavor)).call(this));

		_this.value = flavor;
		_this._browserSolver = new BrowserSolver();
		_this._serverSolver = new ServerSolver();
		return _this;
	}

	createClass(Flavor, [{
		key: "isTokenSupported",
		value: function isTokenSupported(id) {
			return !!this._profile._supportMap[id];
		}
	}, {
		key: "getDocs",
		value: function getDocs(id) {
			return this._profile.docs[id];
		}
	}, {
		key: "validateFlags",
		value: function validateFlags(list) {
			var flags = this._profile.flags,
			    dupes = {};
			return list.filter(function (id) {
				return !!flags[id] && !dupes[id] && (dupes[id] = true);
			});
		}
	}, {
		key: "validateFlagsStr",
		value: function validateFlagsStr(str) {
			return this.validateFlags(str.split("")).join("");
		}
	}, {
		key: "isFlagSupported",
		value: function isFlagSupported(id) {
			return !!this._profile.flags[id];
		}
	}, {
		key: "_buildSupportMap",
		value: function _buildSupportMap(profile) {
			if (profile._supportMap) {
				return;
			}
			var map = profile._supportMap = {},
			    props = Flavor.SUPPORT_MAP_PROPS,
			    n = void 0;
			for (n in props) {
				this._addToSupportMap(map, profile[n], !!props[n]);
			}
			var o = profile.escCharCodes,
			    esc = profile.escChars;
			for (n in o) {
				map["esc_" + o[n]] = true;
			}
			for (n in esc) {
				map["esc_" + esc[n]] = true;
			}
		}
	}, {
		key: "_addToSupportMap",
		value: function _addToSupportMap(map, o, rev) {
			if (rev) {
				for (var n in o) {
					map[o[n]] = true;
				}
			} else {
				for (var _n in o) {
					map[_n] = o[_n];
				}
			}
		}
	}, {
		key: "value",
		set: function set$$1(id) {
			var profile = profiles[id || "js"];
			if (!profile || profile === this._profile) {
				return;
			}
			Track.page("flavor/" + id);
			this._profile = profile;
			this._buildSupportMap(profile);
			this.dispatchEvent("change");
		},
		get: function get$$1() {
			return this._profile.id;
		}
	}, {
		key: "profile",
		get: function get$$1() {
			return this._profile;
		}
	}, {
		key: "profiles",
		get: function get$$1() {
			return [profiles.js, profiles.pcre];
		}
	}, {
		key: "solver",
		get: function get$$1() {
			return this._profile.browser ? this._browserSolver : this._serverSolver;
		}
	}]);
	return Flavor;
}(EventDispatcher);

Flavor.SUPPORT_MAP_PROPS = {
	// 1 = reverse, 0 - normal
	flags: 1,
	// escape is handled separately
	// escCharCodes is handled separately
	escCharTypes: 1,
	charTypes: 1,
	// unquantifiables not included
	// unicodeScripts not included
	// unicodeCategories not included
	// posixCharClasses not included
	// modes not included
	tokens: 0,
	substTokens: 0
	// config not included
	// docs not included
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var RefCoverage = function RefCoverage() {
	classCallCheck(this, RefCoverage);

	app.flavor._buildSupportMap(core);
	var ref = app.reference._idMap,
	    undoc = [],
	    unused = [],
	    all = core._supportMap;
	var ignore = {
		"escchar": true, // literal char
		"groupclose": true,
		"setclose": true,
		"condition": true, // proxies to conditional
		"conditionalelse": true, // proxies to conditional
		subst_$group: true, // resolved to subst_group
		subst_$bgroup: true, // resolved to subst_group
		subst_bsgroup: true, // resolved to subst_group
		escoctalo: true // resolved to escoctal
	};

	for (var n in all) {
		if (!ref[n] && !ignore[n]) {
			undoc.push(n);
		}
	}
	for (var _n in ref) {
		if (!all[_n] && !ref[_n].kids) {
			unused.push(_n);
		}
	}

	console.log("--- UNDOCUMENTED IDS ---\n" + undoc.join("\n") + "\n\n--- UNUSED DOCS? ---\n" + unused.join("\n"));
};

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var RegExr = function (_EventDispatcher) {
	inherits(RegExr, _EventDispatcher);

	function RegExr() {
		classCallCheck(this, RegExr);
		return possibleConstructorReturn(this, (RegExr.__proto__ || Object.getPrototypeOf(RegExr)).call(this));
	}

	createClass(RegExr, [{
		key: "init",
		value: function init(state, account) {
			var _this2 = this;

			var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

			this.flavor = new Flavor("js");
			this.reference = new Reference(reference_content, this.flavor, config);
			this._migrateFavorites();
			this._initUI();

			if (state === false) {
				this._localInit();
			} else {
				this.state = state;
			}
			this.account.value = account;
			this._savedHash = null;

			var params = Utils.getUrlParams();
			if (params.expression) {
				this.expression.value = params.expression;
			}
			if (params.text) {
				this.text.value = params.text;
			}
			if (params.tool) {
				this.tools.value = { id: params.tool, input: params.input };
			}

			window.onbeforeunload = function (e) {
				return _this2.unsaved ? "You have unsaved changes." : null;
			};
			this.resetUnsaved();
		}
	}, {
		key: "_localInit",
		value: function _localInit() {
			console.log("local init");
			//Server.verify().then((data) => this.account.value = data);
			new RefCoverage();
		}

		// getter / setters:

	}, {
		key: "resetUnsaved",


		// public methods:
		value: function resetUnsaved() {
			this._savedHash = this.hash;
		}

		// private methods:

	}, {
		key: "_initUI",
		value: function _initUI() {
			var _this3 = this;

			// TODO: break into own Device class? Rename mobile.scss too?
			// mobile setup
			// keep synced with "mobile.scss":
			if (screen.width < 500) {
				document.getElementById("viewport").setAttribute("content", "width=500, user-scalable=0");
			}
			this._matchList = window.matchMedia("(max-width: 900px)");
			this._matchList.addListener(function (q) {
				return _this3.dispatchEvent("narrow");
			}); // currently unused.

			// UI:
			this.el = DOMUtils.query(".container");

			this.tooltip = {
				hover: new Tooltip(DOMUtils.query("#library #tooltip").cloneNode(true)),
				toggle: new Tooltip(DOMUtils.query("#library #tooltip"), true)
			};

			var el = DOMUtils.query(".app > .doc", this.el);
			this.expression = new Expression(DOMUtils.query("> section.expression", el));
			this.text = new Text(DOMUtils.query("> section.text", el));
			this.tools = new Tools(DOMUtils.query("> section.tools", el));

			this.account = new Account();
			this.sidebar = new Sidebar(DOMUtils.query(".app > .sidebar", this.el));
			this.share = this.sidebar.share;

			this.expression.on("change", function () {
				return _this3._change();
			});
			this.text.on("change", function () {
				return _this3._change();
			});
			this.flavor.on("change", function () {
				return _this3._change();
			});
			this.tools.on("change", function () {
				return _this3._change();
			});
			this.share.on("change", function () {
				return _this3._change();
			});
			this._change();
		}
	}, {
		key: "_migrateFavorites",
		value: function _migrateFavorites() {
			var ls = window.localStorage,
			    l = ls.length;
			if (!l || ls.getItem("f_v3") >= "1") {
				return;
			}
			var ids = [];
			for (var i = 0; i < l; i++) {
				var key = ls.key(i),
				    val = ls.getItem(key);
				if (key[0] === "f" && val === "1") {
					ids.push(key.substr(1));
				}
			}
			if (!ids.length) {
				ls.setItem("f_v3", "1");return;
			}
			Server.multiFavorite(ids).then(function () {
				return ls.setItem("f_v3", "1");
			});
		}
	}, {
		key: "_change",
		value: function _change() {
			var _this4 = this;

			this.dispatchEvent("change");
			var solver = this.flavor.solver,
			    exp = this.expression;
			solver.solve({ pattern: exp.pattern, flags: exp.flags, text: this.text.value, tool: this.tools.value }, function (result) {
				return _this4._handleResult(result);
			});
		}
	}, {
		key: "_handleResult",
		value: function _handleResult(result) {
			this.result = this._processResult(result);
			this.dispatchEvent("result");
		}
	}, {
		key: "_processResult",
		value: function _processResult(result) {
			result.matches && result.matches.forEach(function (o, i) {
				return o.num = i;
			});
			return result;
		}
	}, {
		key: "state",
		get: function get$$1() {
			var o = {
				expression: this.expression.value,
				text: this.text.value,
				flavor: this.flavor.value,
				tool: this.tools.value
			};
			// copy share values onto the pattern object:
			return Utils.copy(this.share.value, o);
		},
		set: function set$$1(o) {
			if (!o) {
				return;
			}
			this.flavor.value = o.flavor;
			this.expression.value = o.expression;
			this.text.value = o.text;
			this.tools.value = o.tool;
			this.share.pattern = o;
			this.resetUnsaved();
		}
	}, {
		key: "hash",
		get: function get$$1() {
			var share = this.share;
			return Utils.getHashCode(this.expression.value + "\t" + this.text.value + "\t" + this.flavor.value + "\t" + share.author + "\t" + share.name + "\t" + share.description + "\t" + share.keywords + "\t"
			//+ this.tools.value.input+"\t"
			//+ this.tools.value.id+"\t"
			);
		}
	}, {
		key: "unsaved",
		get: function get$$1() {
			return this.hash !== this._savedHash;
		}
	}, {
		key: "isNarrow",
		get: function get$$1() {
			return this._matchList.matches;
		}
	}]);
	return RegExr;
}(EventDispatcher);

/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var app = new RegExr();

return app;

}());
//# sourceMappingURL=../deploy/regexr.js.map

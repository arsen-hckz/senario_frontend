/* Event handlers without inline attributes.

   The Content-Security-Policy (vercel.json) only runs script files, so
   onclick="..." / onchange="..." / onsubmit="..." attributes are blocked.
   Markup names a handler instead, and the page's script registers it:

     <button data-click="logout">Logout</button>
     snrOn('click', 'logout', function (el, event) { logout(); });

   `el` is the element carrying the data-click/data-change/data-submit
   attribute (what `this` was in the inline handler).

   The listeners sit on document in the capture phase, so a handler runs
   before the event reaches the element's ancestors, as an inline handler
   did: event.stopPropagation() and event.preventDefault() behave the same.
   Nested elements each run their own handler, innermost first, unless one
   stops propagation. */
(function () {
  var handlers = { click: {}, change: {}, submit: {} };

  window.snrOn = function (type, name, fn) {
    handlers[type][name] = fn;
  };

  // Registered names, for checking that every data-* attribute has a handler.
  window.snrOn.names = function (type) {
    return Object.keys(handlers[type]);
  };

  Object.keys(handlers).forEach(function (type) {
    var attr = 'data-' + type;
    document.addEventListener(type, function (event) {
      var el = event.target && event.target.closest ? event.target.closest('[' + attr + ']') : null;
      while (el && !event.cancelBubble) {
        var name = el.getAttribute(attr);
        var fn = handlers[type][name];
        if (fn) fn(el, event);
        else console.error('No ' + type + ' handler registered for "' + name + '"');
        el = el.parentElement ? el.parentElement.closest('[' + attr + ']') : null;
      }
    }, true);
  });
})();

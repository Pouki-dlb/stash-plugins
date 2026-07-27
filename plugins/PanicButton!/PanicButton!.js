(function () {
  "use strict";

  var overlay = null;
  var hidden = false;

  var PANIC_TITLE = "New Tab";
  var savedTitle = null;
  var titleObserver = null;

  var BLANK_FAVICON =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  var savedIconLinks = null;

  function ensureOverlay() {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "panic-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;background:#000;z-index:2147483647;display:none";
    }
    if (!overlay.isConnected) {
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function setPanicTitle(on) {
    var titleEl = document.querySelector("title");
    if (on) {
      savedTitle = document.title;
      document.title = PANIC_TITLE;
      if (titleEl && !titleObserver) {
        titleObserver = new MutationObserver(function () {
          if (document.title !== PANIC_TITLE) document.title = PANIC_TITLE;
        });
        titleObserver.observe(titleEl, { childList: true });
      }
    } else {
      if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
      }
      if (savedTitle !== null) document.title = savedTitle;
    }
  }

  function setPanicFavicon(on) {
    if (on) {
      var links = Array.prototype.slice.call(
        document.querySelectorAll("link[rel~='icon']")
      );
      savedIconLinks = links.map(function (l) {
        return {
          rel: l.getAttribute("rel"),
          href: l.getAttribute("href"),
          type: l.getAttribute("type"),
          sizes: l.getAttribute("sizes"),
        };
      });
      links.forEach(function (l) {
        if (l.parentNode) l.parentNode.removeChild(l);
      });
      var blank = document.createElement("link");
      blank.id = "panic-favicon";
      blank.rel = "icon";
      blank.href = BLANK_FAVICON;
      document.head.appendChild(blank);
    } else {
      var b = document.getElementById("panic-favicon");
      if (b && b.parentNode) b.parentNode.removeChild(b);
      if (savedIconLinks) {
        savedIconLinks.forEach(function (s) {
          var l = document.createElement("link");
          if (s.rel) l.setAttribute("rel", s.rel);
          if (s.href) l.setAttribute("href", s.href);
          if (s.type) l.setAttribute("type", s.type);
          if (s.sizes) l.setAttribute("sizes", s.sizes);
          document.head.appendChild(l);
        });
        savedIconLinks = null;
      }
    }
  }

  function toggle() {
    hidden = !hidden;
    ensureOverlay().style.display = hidden ? "block" : "none";
    setPanicTitle(hidden);
    setPanicFavicon(hidden);
    if (hidden) {
      var media = document.querySelectorAll("video, audio");
      for (var i = 0; i < media.length; i++) {
        try {
          media[i].pause();
        } catch (e) {}
      }
    }
  }

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Insert") {
        e.preventDefault();
        toggle();
      }
    },
    true
  );
})();

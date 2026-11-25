// Per-account storage isolation for same-origin HTML5 games.
//
// Geegle serves every game from one origin, so all games share one
// localStorage. This shim gives each (game, signed-in account) pair its own
// namespaced view of localStorage, which is what makes cloud saves and
// account isolation possible without editing each game's logic.
//
// - Guests (no geegle_profile query parameter) are left untouched.
// - Existing progress written before the shim existed is migrated on first
//   read, so no player loses a save.
// - clear() only removes the current game's keys for the current account.
(function () {
  'use strict';
  var profile = null;
  try {
    profile = new URLSearchParams(window.location.search).get('geegle_profile');
  } catch (error) {
    profile = null;
  }
  if (!profile) return;

  var script = document.currentScript;
  var gameId = (script && script.getAttribute('data-game')) || '';
  if (!gameId) {
    try {
      gameId = decodeURIComponent(window.location.pathname.replace(/^.*\/games\//, '').replace(/\.html$/i, ''));
    } catch (error) {
      gameId = '';
    }
  }
  if (!gameId) return;

  var prefix = 'geegle-game:' + gameId + ':' + profile + ':';
  var original = window.localStorage;
  if (!original) return;
  var proto = Object.getPrototypeOf(original) || window.Storage.prototype;
  var nativeGet = proto.getItem;
  var nativeSet = proto.setItem;
  var nativeRemove = proto.removeItem;
  var nativeKey = proto.key;

  function ownKeys() {
    var keys = [];
    for (var i = 0; i < original.length; i += 1) {
      var key = nativeKey.call(original, i);
      if (typeof key === 'string' && key.indexOf(prefix) === 0) keys.push(key.slice(prefix.length));
    }
    return keys;
  }

  var view = {
    getItem: function (key) {
      var scoped = nativeGet.call(original, prefix + String(key));
      if (scoped !== null) return scoped;
      // One-time migration of progress saved before per-account scoping.
      var legacy = nativeGet.call(original, String(key));
      if (legacy !== null) {
        try { nativeSet.call(original, prefix + String(key), legacy); } catch (error) { /* quota */ }
      }
      return legacy;
    },
    setItem: function (key, value) {
      nativeSet.call(original, prefix + String(key), String(value));
    },
    removeItem: function (key) {
      nativeRemove.call(original, String(key));
      nativeRemove.call(original, prefix + String(key));
    },
    clear: function () {
      var keys = ownKeys();
      for (var i = 0; i < keys.length; i += 1) nativeRemove.call(original, prefix + keys[i]);
    },
    key: function (index) {
      var keys = ownKeys();
      return index >= 0 && index < keys.length ? keys[index] : null;
    },
    get length() {
      return ownKeys().length;
    },
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      get: function () { return view; },
    });
  } catch (error) {
    try { window.localStorage = view; } catch (ignored) { /* older engines */ }
  }
})();

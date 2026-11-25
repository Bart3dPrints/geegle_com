// Per-account storage isolation for same-origin HTML5 games.
//
// Geegle serves every game from one origin, so all games share one
// localStorage. This shim gives each (game, signed-in account) pair its own
// namespaced view of localStorage, which is what makes cloud saves and
// account isolation possible without editing each game's logic.
//
// - Guests (no geegle_profile query parameter) are left untouched.
// - Pre-shim progress is migrated on first read, ONCE: a claim marker
//   records which account migrated each legacy key so the same progress can
//   never be inherited by a second account.
// - removeItem and clear only touch this game+account's prefixed keys.
// - The view is a Proxy, so property-style access (localStorage.foo = 1),
//   getItem/setItem, in ("foo" in localStorage), delete, key() and length
//   all behave like real Storage and all map to the scoped namespace.
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
  var claimKey = function (key) {
    return 'geegle-legacy-claim:' + gameId + ':' + key;
  };
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

  function scopedRead(key) {
    return nativeGet.call(original, prefix + key);
  }

  function legacyRead(key) {
    // Claim-once migration: the first account to read a pre-shim key takes
    // it. A claim marker (independent of account prefixes) makes sure a
    // later, different account never inherits the same progress.
    var legacy = nativeGet.call(original, key);
    if (legacy === null) return null;
    var claim = nativeGet.call(original, claimKey(key));
    if (claim !== null && claim !== profile) return null;
    if (claim === null) {
      try { nativeSet.call(original, claimKey(key), profile); } catch (error) { /* quota */ }
    }
    try { nativeSet.call(original, prefix + key, legacy); } catch (error) { /* quota */ }
    return legacy;
  }

  function get(key) {
    var scoped = scopedRead(String(key));
    if (scoped !== null) return scoped;
    return legacyRead(String(key));
  }

  function set(key, value) {
    nativeSet.call(original, prefix + String(key), String(value));
  }

  function remove(key) {
    // Scoped view only: never delete unscoped keys — they may belong to other
    // games, the platform, or guest progress.
    nativeRemove.call(original, prefix + String(key));
  }

  var view = {
    getItem: function (key) {
      var value = get(String(key));
      return value === null ? null : String(value);
    },
    setItem: function (key, value) {
      set(String(key), value);
    },
    removeItem: function (key) {
      remove(String(key));
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

  var proxy = new Proxy(view, {
    get: function (target, property) {
      if (property in target) {
        var value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      }
      if (typeof property === 'symbol') return undefined;
      var item = get(String(property));
      return item === null ? undefined : item;
    },
    set: function (target, property, value) {
      if (typeof property === 'symbol') return false;
      if (property in target) return false;
      set(String(property), value);
      return true;
    },
    deleteProperty: function (target, property) {
      if (typeof property === 'symbol' || property in target) return false;
      remove(String(property));
      return true;
    },
    has: function (target, property) {
      if (typeof property === 'symbol') return property in target;
      if (property in target) return true;
      return scopedRead(String(property)) !== null || legacyRead(String(property)) !== null;
    },
    ownKeys: function () {
      return ownKeys();
    },
    getOwnPropertyDescriptor: function (target, property) {
      if (typeof property === 'symbol' || property in target) return Object.getOwnPropertyDescriptor(target, property);
      var value = get(String(property));
      return value === null ? undefined : { value: String(value), writable: true, enumerable: true, configurable: true };
    },
  });

  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      get: function () { return proxy; },
    });
  } catch (error) {
    try { window.localStorage = proxy; } catch (ignored) { /* older engines */ }
  }
})();

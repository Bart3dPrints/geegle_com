// Per-account storage isolation for same-origin HTML5 games.
//
// Geegle serves every game from one origin, so without this shim all games and
// all accounts share one localStorage, one sessionStorage and one IndexedDB
// namespace. The shim gives each (game, signed-in account) pair its own view:
//
//   localStorage / sessionStorage -> geegle-game:<gameId>:<account>:
//   IndexedDB databases          -> geegle-game:<gameId>:<account>:<name>
//
// Rules that keep accounts and platform data safe:
//  - Guests (no geegle_profile) are not shimmed at all.
//  - Legacy unscoped progress is adopted exactly once per game (a marker key
//    records the adoption), so two accounts can never inherit the same save.
//  - removeItem only ever deletes this account's scoped key. It never removes
//    an unscoped key, which could belong to another game or to the platform.
//  - clear() only removes this game's keys for this account.
//  - Only databases under this account's prefix are visible or deletable.
//  - Property-style access (localStorage.score = 1), dynamic enumeration and
//    same-origin nested frames are supported.
(function () {
  'use strict';

  var MARK = '__geegleStorageShim';

  function query(win, key) {
    try {
      return new URLSearchParams(win.location.search).get(key);
    } catch (error) {
      return null;
    }
  }

  function gameIdFrom(win) {
    // The platform puts the catalog id in the launch URL, so a game's namespace
    // matches the id its saves are stored under even when the file name differs
    // from the catalog slug.
    var fromQuery = query(win, 'geegle_game');
    if (fromQuery) return fromQuery;
    var script = win.document && win.document.currentScript;
    var declared = script && script.getAttribute && script.getAttribute('data-game');
    if (declared) return declared;
    try {
      return decodeURIComponent(win.location.pathname.replace(/^.*\/games\//, '').replace(/\.html$/i, ''));
    } catch (error) {
      return '';
    }
  }

  /**
   * Build a Storage-shaped view backed by `storage`, limited to `prefix`.
   * A Proxy makes both method calls and property access behave like Storage.
   */
  function storageView(storage, prefix) {
    var proto = Object.getPrototypeOf(storage) || window.Storage.prototype;
    var nativeGet = proto.getItem;
    var nativeSet = proto.setItem;
    var nativeRemove = proto.removeItem;
    var nativeKey = proto.key;

    function scopedKeys() {
      var keys = [];
      var total = storage.length;
      for (var i = 0; i < total; i += 1) {
        var key = nativeKey.call(storage, i);
        if (typeof key === 'string' && key.indexOf(prefix) === 0) keys.push(key.slice(prefix.length));
      }
      return keys;
    }

    var api = {
      getItem: function (key) {
        var value = nativeGet.call(storage, prefix + String(key));
        return value === null ? null : value;
      },
      setItem: function (key, value) {
        nativeSet.call(storage, prefix + String(key), String(value));
      },
      removeItem: function (key) {
        // Scoped only: an unscoped delete could destroy another game's data
        // or platform state that happens to share this key name.
        nativeRemove.call(storage, prefix + String(key));
      },
      clear: function () {
        var keys = scopedKeys();
        for (var i = 0; i < keys.length; i += 1) nativeRemove.call(storage, prefix + keys[i]);
      },
      key: function (index) {
        var keys = scopedKeys();
        return index >= 0 && index < keys.length ? keys[index] : null;
      },
    };

    return new Proxy(api, {
      get: function (target, prop) {
        if (prop === 'length') return scopedKeys().length;
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        var value = target.getItem(prop);
        return value === null ? undefined : value;
      },
      set: function (target, prop, value) {
        if (typeof prop !== 'string') return false;
        target.setItem(prop, value);
        return true;
      },
      deleteProperty: function (target, prop) {
        if (typeof prop === 'string') target.removeItem(prop);
        return true;
      },
      has: function (target, prop) {
        if (prop in target) return true;
        return typeof prop === 'string' && target.getItem(prop) !== null;
      },
      ownKeys: function () {
        return scopedKeys().concat(Object.keys(api));
      },
      getOwnPropertyDescriptor: function (target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop in api) return { configurable: true, enumerable: false, value: api[prop], writable: false };
        var value = api.getItem(prop);
        if (value === null) return undefined;
        return { configurable: true, enumerable: true, value: value, writable: true };
      },
      defineProperty: function (target, prop, descriptor) {
        if (typeof prop === 'string' && 'value' in descriptor) api.setItem(prop, descriptor.value);
        return true;
      },
    });
  }

  /** IndexedDB facade that prefixes every database name with `prefix`. */
  function indexedDbView(nativeIdb, prefix) {
    function strip(name) {
      var value = String(name);
      return value.indexOf(prefix) === 0 ? value.slice(prefix.length) : value;
    }
    return {
      open: function (name, version) {
        return version === undefined
          ? nativeIdb.open(prefix + String(name))
          : nativeIdb.open(prefix + String(name), version);
      },
      deleteDatabase: function (name) {
        return nativeIdb.deleteDatabase(prefix + String(name));
      },
      databases: nativeIdb.databases
        ? function () {
          return nativeIdb.databases().then(function (list) {
            return list
              .filter(function (entry) { return entry.name && entry.name.indexOf(prefix) === 0; })
              .map(function (entry) { return { name: strip(entry.name), version: entry.version }; });
          });
        }
        : undefined,
      cmp: nativeIdb.cmp ? nativeIdb.cmp.bind(nativeIdb) : undefined,
    };
  }

  function defineView(win, name, value) {
    try {
      Object.defineProperty(win, name, { configurable: true, enumerable: true, get: function () { return value; } });
      return true;
    } catch (error) {
      try { win[name] = value; return true; } catch (ignored) { return false; }
    }
  }

  /**
   * Wrappers with explicit save keys call geegleSaveKey(name). The shim scopes
   * every key itself, so the helper returns the name unchanged; without it those
   * games throw inside their save routine and keep progress only in memory.
   * It exists for guests as well, because play without an account must not
   * break either.
   */
  function defineSaveKeyHelper(win) {
    if (typeof win.geegleSaveKey === 'function') return;
    var helper = function (key) { return String(key); };
    try {
      Object.defineProperty(win, 'geegleSaveKey', {
        configurable: true,
        enumerable: false,
        writable: false,
        value: helper,
      });
    } catch (error) {
      try { win.geegleSaveKey = helper; } catch (ignored) { /* locked window */ }
    }
  }

  /**
   * Install the shim in `win`. When called for a nested frame, the parent
   * passes its own profile/gameId so a frame served from a helper page still
   * writes into the same game's namespace.
   */
  function install(win, inherited) {
    try {
      if (!win) return;
      defineSaveKeyHelper(win);
      if (win[MARK]) return;
      var profile = (inherited && inherited.profile) || query(win, 'geegle_profile');
      if (!profile) { win[MARK] = { guest: true }; return; }
      var gameId = (inherited && inherited.gameId) || gameIdFrom(win);
      if (!gameId) { win[MARK] = { guest: true }; return; }
      var prefix = 'geegle-game:' + gameId + ':' + profile + ':';
      win[MARK] = { profile: profile, gameId: gameId, prefix: prefix };

      var local = win.localStorage;
      if (local) {
        var proto = Object.getPrototypeOf(local);
        var nativeGet = proto.getItem;
        // One-time adoption of pre-shim progress. The marker is unscoped and
        // per game, so only the first signed-in account ever inherits it.
        var adoption = 'geegle-legacy-adopted:' + gameId;
        var seen = null;
        try { seen = nativeGet.call(local, adoption); } catch (error) { seen = null; }
        if (seen === null) {
          try {
            proto.setItem.call(local, adoption, '1');
            // Enumerate through Storage.key rather than Object.keys: engines
            // expose stored keys inconsistently as own properties.
            var legacyKeys = [];
            for (var index = 0; index < local.length; index += 1) {
              var key = proto.key.call(local, index);
              if (typeof key === 'string') legacyKeys.push(key);
            }
            legacyKeys.forEach(function (key) {
              if (key.indexOf('geegle-') === 0) return;
              var value = nativeGet.call(local, key);
              if (value !== null) proto.setItem.call(local, prefix + key, value);
            });
          } catch (error) { /* storage disabled; nothing to adopt */ }
        }
        defineView(win, 'localStorage', storageView(local, prefix));
      }

      var session = win.sessionStorage;
      if (session) defineView(win, 'sessionStorage', storageView(session, prefix));

      if (win.indexedDB) defineView(win, 'indexedDB', indexedDbView(win.indexedDB, prefix));

      installFrames(win, { profile: profile, gameId: gameId });
    } catch (error) {
      // A game must still load if the shim cannot install; guests are the
      // fallback, and the platform then reports saves as unavailable.
      try { win[MARK] = { guest: true }; } catch (ignored) { /* locked window */ }
    }
  }

  /** Apply the shim to same-origin nested frames, including future ones. */
  function installFrames(win, inherited) {
    function frame(slot) {
      try {
        install(slot.contentWindow, inherited);
      } catch (error) {
        // Cross-origin frame: it has its own origin and its own storage.
      }
    }
    function all() {
      for (var i = 0; i < win.frames.length; i += 1) frame(win.frames[i]);
    }
    try {
      all();
      win.document.addEventListener('load', function (event) {
        if (event.target && event.target.tagName === 'IFRAME') frame(event.target);
      }, true);
      if (typeof win.MutationObserver === 'function') {
        new win.MutationObserver(all).observe(win.document.documentElement, { childList: true, subtree: true });
      }
    } catch (error) {
      // Older engines: top-level isolation still applies.
    }
  }

  install(window, null);
})();

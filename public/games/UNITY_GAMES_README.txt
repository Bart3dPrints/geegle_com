HOW TO ADD UNITY WEBGL GAMES
=============================

Your site is configured to load Unity WebGL games locally with proper fullscreen support
and cross-origin handling. Follow these steps to add a Unity game:

STEP 1: Export Unity Game
--------------------------
1. In Unity Editor, go to File > Build Settings
2. Select "WebGL" platform
3. Click "Build" and export to a folder (e.g., "MyGame")
4. Unity will create these folders/files:
   - Build/ (contains .data, .wasm, .framework.js, .loader.js)
   - TemplateData/ (optional, contains progress bar assets)
   - index.html (the game loader)
   - StreamingAssets/ (optional)

STEP 2: Add Game to Your Site
------------------------------
1. Create a folder in /public/games/ named after your game (e.g., "my-game")
2. Copy ALL Unity export files into that folder:
   /public/games/my-game/
     ├── Build/
     │   ├── my-game.data
     │   ├── my-game.framework.js
     │   ├── my-game.wasm
     │   └── my-game.loader.js
     ├── TemplateData/ (if exists)
     ├── index.html
     └── StreamingAssets/ (if exists)

STEP 3: Update App.tsx
-----------------------
Add your game to the games array in src/App.tsx:

  {
    id: 'my-game',
    name: 'My Awesome Game',
    url: '/games/my-game/index.html',
    icon: '🎮',
  }

STEP 4: Test Locally
--------------------
The game will be served through Vite's dev server (http://localhost:5173), which
properly serves .wasm and .data files with correct MIME types. This avoids issues
that occur with file:// URLs.

ALTERNATIVE: Use Unity Template
--------------------------------
If you want to customize the game loader, use the unity-template.html:

1. Copy /public/games/unity-template.html to your game folder
2. Rename it to index.html
3. Update the config object with your game's file names:
   - Replace "GAME_NAME" with your actual build name
4. Ensure all paths are relative (./Build/, ./TemplateData/, etc.)

TROUBLESHOOTING
---------------
- "Script Error": Make sure index.html uses relative paths (./Build/ not /Build/)
- ".wasm failed to load": Ensure you're testing via http:// not file://
- "Cross-origin": Add proper allow attributes to iframes (already configured)
- Game too small: Check Unity canvas scaling in index.html

The dev server is automatically started for you - just add your game files
and update App.tsx!

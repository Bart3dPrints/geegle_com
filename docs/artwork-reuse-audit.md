# Artwork reuse audit: open-source and classic titles

This round reviewed 32 catalog IDs, none from the prior 25 withheld candidates.
A playable build, a license on engine code, public metadata, and an iframe
permission are not evidence that a specific image can be republished. Only
cleared entries appear in the generated artwork index. Local originals or
derivatives, their notices, and SHA-256 digests are recorded in
`scripts/artwork-map.json`.

| Catalog ID(s) | Evidence and disposition |
| --- | --- |
| `cl2048` | **Cleared.** Gabriele Cirulli's upstream MIT release includes the touch icon and ships it in the official web game's index. The catalog build credits Cirulli and adds ovolve's AI. Exact original bytes and the MIT notice are bundled. |
| `clgoogledino` | **Cleared.** The Chromium release includes the T. rex sprite and BSD redistribution terms. Only the dinosaur frame is used (cropped and enlarged on a plain background), not any Chrome logos. |
| `clsandboxels` | **Cleared.** R74n names the source image in its official [Screenshots section](https://sandboxels.r74n.com/presskit.html). The pinned press kit releases its contents under CC0 1.0. The project license separately allows screenshots anywhere with credit. The card includes the creator credit on the image. This is not permission to reuse the site's logo or other media. |
| `cl2048cupcakes` | **Withheld.** The Cupcakes build uses distinct photos. An MIT notice for 2048 game logic or a fork's AGPL badge does not establish the photograph rights. No use of the original number-game icon on this variant. |
| `clcheckers`, `clchess` | **Withheld.** Generic rules do not clear the particular game images. The checkers launcher embeds a particular Flash game from an archive; the exact chess edition/art author remains unidentified. |
| `clchessclassic` | **Withheld.** The launcher uses a YouTube Playables mirror. A product page for another same-name edition does not establish a match or a thumbnail license. |
| `clmegachess` | **Withheld.** The launcher uses the UGS mirror; [the same-name creator repository](https://github.com/Gorglomux/Megachess) does not publish sprite terms. The particular mirrored build is not independently matched. |
| `cltetris`, `cltetrisgba`, `cltetrisattack`, `cltetrisgrandmaster2` | **Withheld.** Distinct commercial editions; [Tetris site terms](https://tetris.com/terms-conditions) do not provide a blanket image reuse grant, and no edition-specific icon permission was found. |
| `clsuikapico` | **Withheld.** The [same-theme PICO-8 demake](https://spoike.itch.io/suika-game-demake) is credited to spoike with noncommercial terms; no confirmed exact match and no general reuse grant for this catalog. |
| `cldoom`, `cldoom2`, `cldoom2dos`, `cldoom64`, `cldoomps` | **Withheld.** The [id Software engine release](https://github.com/id-Software/DOOM) requires original game data; no exact-edition artwork grant found. Do not use distinct Freedoom artwork for these games. |
| `clquake`, `clquake2`, `clquake64` | **Withheld.** The [Quake](https://github.com/id-Software/Quake) and [Quake II](https://github.com/id-Software/Quake-2) source releases are not original game-data grants. No permission for edition-specific artwork verified. |
| `clADarkRoom` | **Withheld.** The [creator repository](https://github.com/doublespeakgames/adarkroom) links its social image and has an MPL license, but no image-specific grant was confirmed. [Commons labels the alternate text logo public domain](https://commons.wikimedia.org/wiki/File:A_dark_room_logo.jpg) under a simplicity rationale without a worldwide clearance; preserve the lead, not a published mapping. |
| `clspacecompany` | **Withheld.** The matching [upstream project](https://github.com/sparticle999/SpaceCompany) has a modified MIT notice that requires notifying the creator; the specific logo/favicon grant was not established and no one was contacted. |
| `closu` | **Withheld.** The launcher is WebOsu-2; its inherited code license does not establish provenance for its favicon or clear original osu! branding or rhythm-game art. |
| `clhextris` | **Withheld.** The [upstream press kit](https://hextris.github.io/presskit/info.html) offers logos and refers to the game's GPL license, but does not explicitly extend reuse permission to the press-kit artwork. The repository icon has editable source; obtain an asset grant before publishing. |
| `clceleste`, `clceleste2` | **Withheld.** No asset reuse grant found for Celeste. The sequel's PICO-8 cartridge terms are noncommercial; do not substitute commercial game art or infer rights from another source release. |
| `cl2doom` | **Withheld.** Fan game distinct from id's original; no explicit reuse permission found for fan artwork or underlying art. |
| `clzdoom` | **Withheld.** UZDoom artwork is for a different project; no verified authorization for exact ZDoom imagery. |
| `clantimatterdimensions` | **Withheld.** The [upstream project](https://github.com/IvarK/AntimatterDimensionsSourceCode) is an open-source lead; no confirmed grant for the specific icon. |
| `clflappybird`, `clwordle` | **Withheld.** Clone or mirror artwork is not evidence of permission from the original rights holder. No clearance found for the images used in these exact catalog editions. |

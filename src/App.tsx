import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Mic, Image, Grid2x2 as Grid, User, ArrowLeft, ChevronDown, Settings, X, Palette, Key } from 'lucide-react';

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function isCordKeyword(input: string): boolean {
  return normalizeText(input) === 'cord';
}

function formatGameName(name: string): string {
  const specialCases: { [key: string]: string } = {
    '1v1.lol': '1v1.LoL',
    '1v1 lol': '1v1.LoL',
    'five nights at freddy\'s': "Five Nights at Freddy's",
    'r.e.p.o': 'R.E.P.O',
    'bmx 2': 'BMX 2',
    'bfdi branches': 'BFDI Branches',
    'x-men': 'X-Men',
  };

  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(specialCases)) {
    if (lowerName === key || lowerName.includes(key)) {
      return name.split(' ').map((word, i) => {
        const lowerWord = word.toLowerCase();
        if (lowerName.includes(key) && lowerWord === key.split(' ')[0]) return value;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ').replace(/\b(at|vs|the)\b/gi, (m) => m.toLowerCase());
    }
  }

  return name.split(' ').map(word => {
    if (word.length === 0) return word;
    if (['at', 'vs', 'the', 'and', 'of', 'or', 'in'].includes(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

const PROXY_GAME_IDS = new Set(['heilos', 'doge', 'vapor', 'lucide', 'overcloaked', 'voidproxy1']);
const DONT_SHOW_POPUP = 'geegle_popup_dismissed';

// ── Game list ─────────────────────────────────────────────────────────────────
// TOP: Suggestions first, then Apps (proxies + tools) alphabetically
// BOTTOM: Games alphabetically
const games = [
  // Suggestions always first
  { id: 'suggestions', name: 'Suggestions', url: '/games/suggestions.html', icon: '📝' },

  // Apps (proxies + tools) — keep in current positions
  { id: 'chat-bot', name: 'Chat Bot (A.I)', url: '/games/Chat%20Bot%20(A._.I)%20(1).html', icon: '🤖' },
  { id: 'code-editor', name: 'Code Editor', url: '/games/Code%20Editor%20(1).html', icon: '💻' },
  { id: 'doge', name: 'Dogeub Proxy', url: '/games/doge.html', icon: '🌐' },
  { id: 'heilos', name: 'Heilos Proxy', url: '/games/heilos.html', icon: '🌐' },
  { id: 'lucide', name: 'Lucide Proxy', url: '/games/lucide.html', icon: '🌐' },
  { id: 'overcloaked', name: 'Overcloaked Proxy', url: '/games/overcloaked.html', icon: '🌐' },
  { id: 'soundboard', name: 'Soundboard', url: '/games/Soundboard.html', icon: '🔊' },
  { id: 'vapor', name: 'Vapor V4 Proxy', url: '/games/vapor.html', icon: '🌐' },
  { id: 'voidproxy1', name: 'Void Proxy', url: '/games/voidproxy1.html', icon: '🌐' },

  // ── All other games (alphabetical) ──
  { id: 'cl1', name: '1 (Classic)', url: '/games/cl1.html', icon: '🎮' },
  { id: 'cl1on1soccer', name: '1 on 1 Soccer', url: '/games/cl1on1soccer.html', icon: '⚽' },
  { id: 'cl10bullets', name: '10 Bullets', url: '/games/cl10bullets.html', icon: '🔫' },
  { id: 'cl10minutestildawn', name: '10 Minutes Till Dawn', url: '/games/cl10minutestildawn.html', icon: '🎮' },
  { id: 'cl10morebullets', name: '10 More Bullets', url: '/games/cl10morebullets.html', icon: '🔫' },
  { id: 'cl10yardfight', name: '10 Yard Fight', url: '/games/cl10yardfight.html', icon: '🏈' },
  { id: 'cl100in1nes', name: '100 in 1 NES', url: '/games/cl100in1nes.html', icon: '🎮' },
  { id: 'cl100roomsofenemies', name: '100 Rooms of Enemies', url: '/games/cl100RoomsOfEnemies.html', icon: '🎮' },
  { id: 'cl12minibattles', name: '12 Mini Battles', url: '/games/cl12minibattles.html', icon: '🎮' },
  { id: 'cl13bones', name: '13 Bones', url: '/games/cl13bones.html', icon: '🎮' },
  { id: 'cl1942nes', name: '1942 (NES)', url: '/games/cl1942nes.html', icon: '🎮' },
  { id: 'cl1v1lol', name: '1v1.LoL', url: '/games/cl1v1lol.html', icon: '🎮' },
  { id: 'cl1v1tennis', name: '1v1 Tennis', url: '/games/cl1v1tennis.html', icon: '🏐' },
  { id: 'cl2doom', name: '2 Doom', url: '/games/cl2doom.html', icon: '💀' },
  { id: 'cl234playergame', name: '2-3-4 Player Game', url: '/games/cl234playergame.html', icon: '🎮' },
  { id: 'cl20smallmazes', name: '20 Small Mazes', url: '/games/cl20smallmazes.html', icon: '🎮' },
  { id: 'cl2048', name: '2048', url: '/games/cl2048.html', icon: '🔢' },
  { id: 'cl2048cupcakes', name: '2048 Cupcakes', url: '/games/cl2048cupcakes.html', icon: '🍰' },
  { id: 'cl2dshooting', name: '2D Shooting', url: '/games/cl2Dshooting.html', icon: '🔫' },
  { id: 'cl3dash', name: '3 Dash', url: '/games/cl3dash.html', icon: '🔷' },
  { id: 'cl3dasheditor', name: '3 Dash Editor', url: '/games/cl3dasheditor.html', icon: '🔷' },
  { id: 'cl3pandas', name: '3 Pandas', url: '/games/cl3pandas.html', icon: '🎮' },
  { id: 'cl3pandasfantasy', name: '3 Pandas Fantasy', url: '/games/cl3pandasfantasy.html', icon: '🎮' },
  { id: 'cl3pandasbrazil', name: '3 Pandas in Brazil', url: '/games/cl3pandasbrazil.html', icon: '🎮' },
  { id: 'cl3pandasjapan', name: '3 Pandas in Japan', url: '/games/cl3pandasjapan.html', icon: '🎮' },
  { id: 'cl3pandasnight', name: '3 Pandas Night', url: '/games/cl3pandasnight.html', icon: '🎮' },
  { id: 'cl3slices2', name: '3 Slices 2', url: '/games/cl3slices2.html', icon: '🎮' },
  { id: 'cl3dpinballspacecadet', name: '3D Pinball Space Cadet', url: '/games/cl3dpinballspacecadet.html', icon: '🏀' },
  { id: 'cl40xescape', name: '40x Escape', url: '/games/cl40xescape.html', icon: '🎮' },
  { id: 'cl4thandgoal', name: '4th and Goal', url: '/games/cl4thandgoal.html', icon: '🏈' },
  { id: 'cl500calibercontractz', name: '500 Caliber Contractz', url: '/games/cl500calibercontractz.html', icon: '🎮' },
  { id: 'cl60secondsburgerrun', name: '60 Seconds Burger Run', url: '/games/cl60secondsburgerrun.html', icon: '🍕' },
  { id: 'cl60secondssantarun', name: '60 Seconds Santa Run', url: '/games/cl60secondssantarun.html', icon: '🎮' },
  { id: 'cl64in1nes', name: '64 in 1 NES', url: '/games/cl64in1nes.html', icon: '🎮' },
  { id: 'cl8ballclassic', name: '8 Ball Classic', url: '/games/cl8ballclassic.html', icon: '🎮' },
  { id: 'cl8ballpool', name: '8 Ball Pool', url: '/games/cl8ballpool.html', icon: '🎮' },
  { id: 'cl9007199254740992', name: '9007199254740992', url: '/games/cl9007199254740992.html', icon: '🎮' },
  { id: 'cl99balls', name: '99 Balls', url: '/games/cl99balls.html', icon: '🎮' },
  { id: 'cl99nightsitf', name: '99 Nights in the Forest', url: '/games/cl99nightsitf.html', icon: '🎮' },
  { id: 'cladofai', name: 'A Dance of Fire and Ice', url: '/games/clADOFAI.html', icon: '🎶' },
  { id: 'cladarkroom', name: 'A Dark Room', url: '/games/clADarkRoom.html', icon: '🕯️' },
  { id: 'clabandoned3', name: 'Abandoned 3', url: '/games/clabandoned3.html', icon: '🎮' },
  { id: 'clabsolutemadness', name: 'Absolute Madness', url: '/games/clabsolutemadness.html', icon: '🎮' },
  { id: 'clacecombat2', name: 'Ace Combat 2', url: '/games/clacecombat2.html', icon: '🎮' },
  { id: 'clacecombat3', name: 'Ace Combat 3', url: '/games/clacecombat3.html', icon: '🎮' },
  { id: 'clacegangstertaxi', name: 'Ace Gangster Taxi', url: '/games/clacegangstertaxi.html', icon: '🎮' },
  { id: 'clachievementunlocked', name: 'Achievement Unlocked', url: '/games/clachievementunlocked.html', icon: '🎮' },
  { id: 'clachillies', name: 'Achillies', url: '/games/clachillies.html', icon: '🎮' },
  { id: 'clachillies2', name: 'Achillies 2', url: '/games/clachillies2.html', icon: '🎮' },
  { id: 'cladatewithdeath', name: 'A Date with Death', url: '/games/cladatewithdeath.html', icon: '🎮' },
  { id: 'cladayintheoffice', name: 'A Day in the Office', url: '/games/cladayintheoffice.html', icon: '🎮' },
  { id: 'cladvancewars', name: 'Advance Wars', url: '/games/cladvancewars.html', icon: '🪖' },
  { id: 'cladvancewars2', name: 'Advance Wars 2', url: '/games/cladvancewars2.html', icon: '🪖' },
  { id: 'cladvancewarsdualstrike', name: 'Advance Wars Dual Strike', url: '/games/cladvancewarsdualstrike.html', icon: '🪖' },
  { id: 'cladventneon', name: 'Advent Neon', url: '/games/cladventneon.html', icon: '🎮' },
  { id: 'cladventurecapitalist', name: 'Adventure Capitalist', url: '/games/cladventurecapitalist.html', icon: '💰' },
  { id: 'claflac', name: 'AFLAC', url: '/games/claflac.html', icon: '🦆' },
  { id: 'claftertheweek', name: 'After the Week', url: '/games/claftertheweek.html', icon: '🎮' },
  { id: 'clagariolite', name: 'Agario Lite', url: '/games/clagariolite.html', icon: '🎮' },
  { id: 'clageofwar', name: 'Age of War', url: '/games/clageofwar.html', icon: '⚔️' },
  { id: 'clageofwar2', name: 'Age of War 2', url: '/games/clageofwar2.html', icon: '⚔️' },
  { id: 'clagesofconflict', name: 'Ages of Conflict', url: '/games/clagesofconflict.html', icon: '🎮' },
  { id: 'clagesofempire', name: 'Ages of Empire', url: '/games/clagesofempire.html', icon: '🎮' },
  { id: 'clahoysurvival', name: 'Ahoy Survival', url: '/games/clahoysurvival.html', icon: '🎮' },
  { id: 'clai', name: 'AI', url: '/games/clai.html', icon: '🎮' },
  { id: 'clairlinetycoonidle', name: 'Airline Tycoon Idle', url: '/games/clairlinetycoonidle.html', icon: '👆' },
  { id: 'clakumanorgaiden', name: 'Akumano Gaiden', url: '/games/clakumanorgaiden.html', icon: '🎮' },
  { id: 'claladdinsnes', name: 'Aladdin SNES', url: '/games/claladdinsnes.html', icon: '🎮' },
  { id: 'clalexkiddinmiracleworld', name: 'Alex Kidd in Miracle World', url: '/games/clalexkiddinmiracleworld.html', icon: '🎮' },
  { id: 'clalienhominid', name: 'Alien Hominid', url: '/games/clalienhominid.html', icon: '🌌' },
  { id: 'clalienhominidgba', name: 'Alien Hominid GBA', url: '/games/clalienhominidgba.html', icon: '🌌' },
  { id: 'clalienskyinvasion', name: 'Alien Sky Invasion', url: '/games/clalienskyinvasion.html', icon: '🌌' },
  { id: 'clalientransporter', name: 'Alien Transporter', url: '/games/clalientransporter.html', icon: '🌌' },
  { id: 'clalienvspredator', name: 'Alien vs Predator', url: '/games/clalienvspredator.html', icon: '🌌' },
  { id: 'clallbossesin1', name: 'All Bosses in 1', url: '/games/clallbossesin1.html', icon: '🎮' },
  { id: 'clallocation', name: 'Allocation', url: '/games/clallocation.html', icon: '🎮' },
  { id: 'claltered-beast', name: 'Altered Beast', url: '/games/clAltered%20Beast.html', icon: '🎮' },
  { id: 'clamaze', name: 'Amaze', url: '/games/clamaze.html', icon: '🎮' },
  { id: 'clambulencearush', name: 'Ambulance Rush', url: '/games/clambulencearush.html', icon: '🎮' },
  { id: 'clamidstthesky', name: 'Amidst the Sky', url: '/games/clamidstthesky.html', icon: '🎮' },
  { id: 'clamigopancho', name: 'Amigo Pancho', url: '/games/clamigopancho.html', icon: '🎮' },
  { id: 'clamigopancho2', name: 'Amigo Pancho 2', url: '/games/clamigopancho2.html', icon: '🎮' },
  { id: 'clamigopancho3', name: 'Amigo Pancho 3', url: '/games/clamigopancho3.html', icon: '🎮' },
  { id: 'clamigopancho4', name: 'Amigo Pancho 4', url: '/games/clamigopancho4.html', icon: '🎮' },
  { id: 'clamigopancho5', name: 'Amigo Pancho 5', url: '/games/clamigopancho5.html', icon: '🎮' },
  { id: 'clamigopancho6', name: 'Amigo Pancho 6', url: '/games/clamigopancho6.html', icon: '🎮' },
  { id: 'clamigopancho7', name: 'Amigo Pancho 7', url: '/games/clamigopancho7.html', icon: '🎮' },
  { id: 'clamongus', name: 'Amongus', url: '/games/clamongus.html', icon: '🎮' },
  { id: 'clamorphous', name: 'Amorphous', url: '/games/clamorphous.html', icon: '🎮' },
  { id: 'clantarttycoon', name: 'Antart Tycoon', url: '/games/clantarttycoon.html', icon: '👆' },
  { id: 'clancientsins', name: 'Ancient Sins', url: '/games/clancientsins.html', icon: '🎮' },
  { id: 'clanemonesfall', name: 'Anemone Fall', url: '/games/clanemonesfall.html', icon: '🎮' },
  { id: 'clangrybirds', name: 'Angry Birds', url: '/games/clangrybirds.html', icon: '🐦' },
  { id: 'clangrybirdsshowdown', name: 'Angry Birds Showdown', url: '/games/clangrybirdsshowdown.html', icon: '🐦' },
  { id: 'clangrybirdsslingshotfrenzy', name: 'Angry Birds Slingshot Frenzy', url: '/games/clangrybirdsslingshotfrenzy.html', icon: '🐦' },
  { id: 'clangrybirds-space', name: 'Angry Birds Space', url: '/games/clangrybirds-space.html', icon: '🌌' },
  { id: 'clanimalcrossingwildworld', name: 'Animal Crossing Wild World', url: '/games/clanimalcrossingwildworld.html', icon: '🎮' },
  { id: 'clanimalforestn64', name: 'Animal Forest N64', url: '/games/clanimalforestn64.html', icon: '🎮' },
  { id: 'clannsmb', name: 'Another New Super Mario Bros', url: '/games/clannsmb.html', icon: '🎮' },
  { id: 'clanotherworld', name: 'Another World', url: '/games/clanotherworld.html', icon: '🎮' },
  { id: 'clantimatterdimensions', name: 'Antimatter Dimensions', url: '/games/clantimatterdimensions.html', icon: '♾️' },
  { id: 'clapesvshelium', name: 'Apes vs Helium', url: '/games/clapesvshelium.html', icon: '🦍' },
  { id: 'clapotris', name: 'Apotris', url: '/games/clapotris.html', icon: '🎮' },
  { id: 'clappleshooter', name: 'Apple Shooter', url: '/games/clappleshooter.html', icon: '🔫' },
  { id: 'clappleworm', name: 'Apple Worm', url: '/games/clappleworm.html', icon: '🎮' },
  { id: 'claquaparkio', name: 'Aqua Park IO', url: '/games/claquaparkio.html', icon: '🎮' },
  { id: 'clarcadevolley', name: 'Arcade Volley', url: '/games/clarcadevolley.html', icon: '🎮' },
  { id: 'clarceuslegend', name: 'Arceus Legend', url: '/games/clarceuslegend.html', icon: '⚔️' },
  { id: 'clarcheryworldtour', name: 'Archery World Tour', url: '/games/clarcheryworldtour.html', icon: '🎮' },
  { id: 'clarchesspelago', name: 'Archipelago', url: '/games/clarchesspelago.html', icon: '♟️' },
  { id: 'clarchimedesclient', name: 'Archimedes Client', url: '/games/clarchimedesclient.html', icon: '🎮' },
  { id: 'clarena', name: 'Arena', url: '/games/clarena.html', icon: '🎮' },
  { id: 'clarmormayhem2', name: 'Armor Mayhem 2', url: '/games/clarmormayhem2.html', icon: '🎮' },
  { id: 'clarsonate', name: 'Arsonate', url: '/games/clarsonate.html', icon: '🎮' },
  { id: 'clarthursnightmare', name: "Arthur's Nightmare", url: '/games/clarthursnightmare.html', icon: '🧟' },
  { id: 'clasdutydemands', name: 'As Duty Demands', url: '/games/clasdutydemands.html', icon: '🎮' },
  { id: 'clascent', name: 'Ascent', url: '/games/clascent.html', icon: '🎮' },
  { id: 'clasmallworldcup', name: 'A Small World Cup', url: '/games/clasmallworldcup.html', icon: '🎮' },
  { id: 'classessmentexamination', name: 'Assessment Examination', url: '/games/classessmentexamination.html', icon: '🎮' },
  { id: 'clasteroids', name: 'Asteroids', url: '/games/clasteroids.html', icon: '🌠' },
  { id: 'clasteroidsalt', name: 'Asteroids Alt', url: '/games/clasteroidsALT.html', icon: '🌠' },
  { id: 'clasteroidsarcade', name: 'Asteroids Arcade', url: '/games/clasteroidsarcade.html', icon: '🌠' },
  { id: 'clastraclient', name: 'Astra Client', url: '/games/clastraclient.html', icon: '🎮' },
  { id: 'clastrawasm', name: 'Astra WASM', url: '/games/clastrawasm.html', icon: '🎮' },
  { id: 'clastrosdreamland', name: 'Astros Dreamland', url: '/games/clAstrosDreamland.html', icon: '🌌' },
  { id: 'clastynax', name: 'Astynax', url: '/games/clastynax.html', icon: '🎮' },
  { id: 'clatariadventure', name: 'Atari Adventure', url: '/games/clatariadventure.html', icon: '🎮' },
  { id: 'clattackhole', name: 'Attack Hole', url: '/games/clattackhole.html', icon: '🎮' },
  { id: 'clavalanche', name: 'Avalanche', url: '/games/clavalanche.html', icon: '🏔️' },
  { id: 'claviamasters', name: 'Avia Masters', url: '/games/claviamasters.html', icon: '🎮' },
  { id: 'claviamastersbuggy', name: 'Avia Masters Buggy', url: '/games/claviamastersbuggy.html', icon: '🎮' },
  { id: 'clawesomepirates', name: 'Awesome Pirates', url: '/games/clAwesomePirates.html', icon: '🎮' },
  { id: 'clawesomeplanes', name: 'Awesome Planes', url: '/games/clawesomeplanes.html', icon: '✈️' },
  { id: 'clawesometanks', name: 'Awesome Tanks', url: '/games/clawesometanks.html', icon: '🪖' },
  { id: 'clawesometanks2', name: 'Awesome Tanks 2', url: '/games/clawesometanks2.html', icon: '🪖' },
  { id: 'claxbattler', name: 'Ax Battler', url: '/games/claxbattler.html', icon: '🎮' },
  { id: 'claxisfootballleague', name: 'Axis Football League', url: '/games/claxisfootballleague.html', icon: '⚽' },
  { id: 'clb3313', name: 'B 3313', url: '/games/clB3313.html', icon: '🎮' },
  { id: 'clb3313unabandoneda2', name: 'B 3313 Unabandoned A2', url: '/games/clb3313unabandonedA2.html', icon: '🎮' },
  { id: 'clb3313v102', name: 'B3313 v1.02', url: '/games/clb3313v102.html', icon: '🎮' },
  { id: 'clbabeltower', name: 'Babel Tower', url: '/games/clbabeltower.html', icon: '🎮' },
  { id: 'clbabychiccoadventure', name: 'Baby Chic Co Adventure', url: '/games/clbabychiccoadventure.html', icon: '🎮' },
  { id: 'clbabykaizo', name: 'Baby Kai Zo', url: '/games/clbabykaizo.html', icon: '🎮' },
  { id: 'clbabysniperinvietnam', name: 'Baby Sniper in Vietnam', url: '/games/clbabysniperinvietnam.html', icon: '🔫' },
  { id: 'clbackrooms', name: 'Back Rooms', url: '/games/clbackrooms.html', icon: '🎮' },
  { id: 'clbackrooms2d', name: 'Backrooms 2 D', url: '/games/clbackrooms2D.html', icon: '🎮' },
  { id: 'clbackyardbaseball', name: 'Backyard Baseball', url: '/games/clbackyardbaseball.html', icon: '⚾' },
  { id: 'clbackyardbaseball09', name: 'Backyard Baseball 09', url: '/games/clbackyardbaseball09.html', icon: '⚾' },
  { id: 'clbackyardbaseball10', name: 'Backyard Baseball 10', url: '/games/clbackyardbaseball10.html', icon: '⚾' },
  { id: 'clbackyardfootball', name: 'Backyard Football', url: '/games/clbackyardfootball.html', icon: '⚽' },
  { id: 'clbackyardsoccer', name: 'Backyard Soccer', url: '/games/clbackyardsoccer.html', icon: '⚽' },
  { id: 'clbaconmaydie', name: 'Bacon May Die', url: '/games/clbaconmaydie.html', icon: '🎮' },
  { id: 'clbadbodyguards', name: 'Bad Bodyguards', url: '/games/clbadbodyguards.html', icon: '🎮' },
  { id: 'clbadicecream', name: 'Bad Icecream', url: '/games/clbadicecream.html', icon: '🎮' },
  { id: 'clbadicecream2', name: 'Bad Icecream 2', url: '/games/clbadicecream2.html', icon: '🎮' },
  { id: 'clbadicecream3', name: 'Bad Icecream 3', url: '/games/clbadicecream3.html', icon: '🎮' },
  { id: 'clbadmondaysimulator', name: 'Bad Monday Simulator', url: '/games/clbadmondaysimulator.html', icon: '🎮' },
  { id: 'clbadparenting', name: 'Bad Parenting', url: '/games/clbadparenting.html', icon: '🎮' },
  { id: 'clbadpiggies', name: 'Bad Piggies', url: '/games/clbadpiggies.html', icon: '🎮' },
  { id: 'clbadpiggieslatest', name: 'Bad Piggies Latest', url: '/games/clbadpiggieslatest.html', icon: '🎮' },
  { id: 'clbadtimesim', name: 'Bad Time Sim', url: '/games/clbadtimesim.html', icon: '🎮' },
  { id: 'clbadtimesimulator', name: 'Bad Time Simulator', url: '/games/clbadtimesimulator.html', icon: '🎮' },
  { id: 'clbalatrogba', name: 'Bala Tro GBA', url: '/games/clbalatrogba.html', icon: '🎮' },
  { id: 'clbaldicaseoh', name: 'Bald Icase Oh', url: '/games/clbaldicaseoh.html', icon: '🎮' },
  { id: 'clbaldidecomp', name: 'Bald Ide Comp', url: '/games/clbaldidecomp.html', icon: '🎮' },
  { id: 'clbaldiepstein', name: 'Bald Iepstein', url: '/games/clbaldiepstein.html', icon: '🎮' },
  { id: 'clbaldisbasics', name: 'Bald Is Basics', url: '/games/clbaldisbasics.html', icon: '🎮' },
  { id: 'clbaldisbasicsremaster', name: 'Bald Is Basics Remaster', url: '/games/clbaldisbasicsremaster.html', icon: '🎮' },
  { id: 'clbaldisfunnewschoolultimate', name: 'Bald Is Fun New School Ultimate', url: '/games/clbaldisfunnewschoolultimate.html', icon: '🎮' },
  { id: 'clballblast', name: 'Ball Blast', url: '/games/clballblast.html', icon: '🎮' },
  { id: 'clballistic', name: 'Ballistic', url: '/games/clballistic.html', icon: '🎮' },
  { id: 'clballoonfight', name: 'Balloon Fight', url: '/games/clballoonfight.html', icon: '🎮' },
  { id: 'clballsandbricks', name: 'Balls and Bricks', url: '/games/clballsandbricks.html', icon: '🎮' },
  { id: 'clballsandbricksgood', name: 'Balls and Bricks Good', url: '/games/clballsandbricksgood.html', icon: '🎮' },
  { id: 'clballz', name: 'Ballz', url: '/games/clballz.html', icon: '🎮' },
  { id: 'clbananasimulator', name: 'Banana Simulator', url: '/games/clbananasimulator.html', icon: '🎮' },
  { id: 'clbanbuds', name: 'Banbuds', url: '/games/clbanbuds.html', icon: '🎮' },
  { id: 'clbanditgunslingers', name: 'Band It Gunslingers', url: '/games/clbanditgunslingers.html', icon: '🔫' },
  { id: 'clbanjokazooie', name: 'Banjo Kazooie', url: '/games/clbanjokazooie.html', icon: '🎮' },
  { id: 'clbanjotooie', name: 'Banjo to Oie', url: '/games/clbanjotooie.html', icon: '🎮' },
  { id: 'clbankbreakout2', name: 'Bank Breakout 2', url: '/games/clbankbreakout2.html', icon: '🎮' },
  { id: 'bank-robbery', name: 'Bank Robbery', url: '/games/Bank%20Robbery.html', icon: '🎮' },
  { id: 'clbankrobbery2', name: 'Bank Robbery 2', url: '/games/clbankrobbery2.html', icon: '🎮' },
  { id: 'clbarryhasasecret', name: 'Barry Has Asecret', url: '/games/clbarryhasasecret.html', icon: '🎮' },
  { id: 'clbartblast', name: 'Bart Blast', url: '/games/clbartblast.html', icon: '🎮' },
  { id: 'clbas', name: 'Bas', url: '/games/clbas.html', icon: '🎮' },
  { id: 'clbaseballbros', name: 'Baseball Bros', url: '/games/clbaseballbros.html', icon: '⚾' },
  { id: 'clbaseballnes', name: 'Baseball NES', url: '/games/clbaseballnes.html', icon: '⚾' },
  { id: 'clbasketbattle', name: 'Basket Battle', url: '/games/clbasketbattle.html', icon: '🎮' },
  { id: 'clbasketbros', name: 'Basket Bros', url: '/games/clbasketbros.html', icon: '🎮' },
  { id: 'clbasketrandom', name: 'Basket Random', url: '/games/clbasketrandom.html', icon: '🎮' },
  { id: 'clbasketrandomgood', name: 'Basket Random Good', url: '/games/clbasketrandomgood.html', icon: '🎮' },
  { id: 'clbasketslamdunk2', name: 'Basket Slam Dunk 2', url: '/games/clbasketslamdunk2.html', icon: '🏀' },
  { id: 'clbasketballfrvr', name: 'Basketball FRVR', url: '/games/clbasketballfrvr.html', icon: '🏀' },
  { id: 'clbasketballlegends-1', name: 'Basketball Legends', url: '/games/clbasketballlegends(1).html', icon: '🏀' },
  { id: 'clbasketballstars', name: 'Basketball Stars', url: '/games/clbasketballstars.html', icon: '🏀' },
  { id: 'clbasketballsuperstars', name: 'Basketball Superstars', url: '/games/clbasketballsuperstars.html', icon: '🏀' },
  { id: 'clbatterup', name: 'Batter Up', url: '/games/clbatterup.html', icon: '🎮' },
  { id: 'clbattlekarts', name: 'Battle Karts', url: '/games/clbattlekarts.html', icon: '🏎️' },
  { id: 'clbattlesim', name: 'Battle Sim', url: '/games/clbattlesim.html', icon: '🎮' },
  { id: 'clbattlezone', name: 'Battle Zone', url: '/games/clbattlezone.html', icon: '🎮' },
  { id: 'clbattles', name: 'Battles', url: '/games/clbattles.html', icon: '🎮' },
  { id: 'clbazookaboy', name: 'Bazooka Boy', url: '/games/clbazookaboy.html', icon: '🎮' },
  { id: 'clbballlegend', name: 'Bball Legend', url: '/games/clbballlegend.html', icon: '⚔️' },
  { id: 'clbejeweledtwistds', name: 'Bejeweled Twist DS', url: '/games/clbejeweledtwistds.html', icon: '🎮' },
  { id: 'clbejeweledtwistflash', name: 'Be Jeweled Twist Flash', url: '/games/clbejeweledtwistflash.html', icon: '🎮' },
  { id: 'clbeachboxingsim', name: 'Beach Boxing Sim', url: '/games/clbeachboxingsim.html', icon: '🎮' },
  { id: 'clbeamrider', name: 'Beam Rider', url: '/games/clbeamrider.html', icon: '🎮' },
  { id: 'clbearbarians', name: 'Bear Barians', url: '/games/clbearbarians.html', icon: '🎮' },
  { id: 'clbearsus', name: 'Bearsus', url: '/games/clbearsus.html', icon: '🎮' },
  { id: 'clben10alienforce', name: 'Ben 10 Alien Force', url: '/games/clben10alienforce.html', icon: '🌌' },
  { id: 'clben10omniverse', name: 'Ben 10 Omniverse', url: '/games/clben10omniverse.html', icon: '🎮' },
  { id: 'clben10protector', name: 'Ben 10 Protector', url: '/games/clben10protector.html', icon: '🎮' },
  { id: 'clben10racing', name: 'Ben 10 Racing', url: '/games/clben10racing.html', icon: '🏎️' },
  { id: 'clben10ultimatealien', name: 'Ben 10 Ultimate Alien', url: '/games/clben10ultimatealien.html', icon: '🌌' },
  { id: 'clbendrowned', name: 'Ben Drowned', url: '/games/clbendrowned.html', icon: '🎮' },
  { id: 'clbergentruck201x', name: 'Bergen Truck 201 X', url: '/games/clbergentruck201x.html', icon: '🎮' },
  { id: 'clbfdibranches', name: 'BFDI Branches', url: '/games/clBFDIBranches.html', icon: '🎮' },
  { id: 'clbfdia5b', name: 'Bfdia 5 B', url: '/games/clbfdia5b.html', icon: '🎮' },
  { id: 'clbigflappytowertinysquare', name: 'Big Flap Py Tower Tiny Square', url: '/games/clbigflappytowertinysquare.html', icon: '🐦' },
  { id: 'clbigicetowertinysquare', name: 'Big Ice Tower Tiny Square', url: '/games/clbigicetowertinysquare.html', icon: '🎮' },
  { id: 'clbigneontowertinysquare', name: 'Big Neon Tower Tiny Square', url: '/games/clbigneontowertinysquare.html', icon: '🎮' },
  { id: 'clbigshotboxing2', name: 'Big Shot Boxing 2', url: '/games/clbigshotboxing2.html', icon: '🎮' },
  { id: 'clbig_time_butter_baron', name: 'Big Time Butter Baron', url: '/games/clBig_Time_Butter_Baron.html', icon: '🎮' },
  { id: 'clbigtowertinysquare', name: 'Big Tower Tiny Square', url: '/games/clbigtowertinysquare.html', icon: '🎮' },
  { id: 'clbigtowertinysquare2', name: 'Big Tower Tiny Square 2', url: '/games/clbigtowertinysquare2.html', icon: '🎮' },
  { id: 'clbigtowertinysquare2good', name: 'Big Tower Tiny Square 2 Good', url: '/games/clbigtowertinysquare2good.html', icon: '🎮' },
  { id: 'clbindingofisaccsheeptime', name: 'Binding of Is Acc Sheep Time', url: '/games/clbindingofisaccsheeptime.html', icon: '🎮' },
  { id: 'clbioevil4', name: 'Bio Evil 4', url: '/games/clbioevil4.html', icon: '🎮' },
  { id: 'clbitlifeencrypted', name: 'Bit Life Encrypted', url: '/games/clbitlifeencrypted.html', icon: '🎮' },
  { id: 'clbitplanes', name: 'Bit Planes', url: '/games/clbitplanes.html', icon: '✈️' },
  { id: 'clbitlife', name: 'Bitlife', url: '/games/clbitlife.html', icon: '🎮' },
  { id: 'clblastronaut', name: 'Bl Astronaut', url: '/games/clblastronaut.html', icon: '🌌' },
  { id: 'clblackknight', name: 'Black Knight', url: '/games/clblackknight.html', icon: '⚔️' },
  { id: 'clblackjack', name: 'Blackjack', url: '/games/clblackjack.html', icon: '♟️' },
  { id: 'clblackjackbattle', name: 'Blackjack Battle', url: '/games/clblackjackbattle.html', icon: '♟️' },
  { id: 'clblackjackhhhh', name: 'Blackjack', url: '/games/clblackjackhhhh.html', icon: '♟️' },
  { id: 'clblackout', name: 'Blackout', url: '/games/clblackout.html', icon: '🎮' },
  { id: 'clblacksmithlab', name: 'Blacksmith Lab', url: '/games/clblacksmithlab.html', icon: '🎮' },
  { id: 'clblazedrifter', name: 'Blaze Drifter', url: '/games/clblazedrifter.html', icon: '🎮' },
  { id: 'clbleachvsnaruto', name: 'Bleach vs Naruto', url: '/games/clbleachvsnaruto.html', icon: '🎮' },
  { id: 'clblightborne', name: 'Blight Borne', url: '/games/clblightborne.html', icon: '🎮' },
  { id: 'clblobsstory2', name: 'Blobs Story 2', url: '/games/clblobsstory2.html', icon: '🎮' },
  { id: 'clblockblast', name: 'Block Blast', url: '/games/clblockblast.html', icon: '🎮' },
  { id: 'clblockblastv2', name: 'Block Blast V2', url: '/games/clblockblastv2.html', icon: '🎮' },
  { id: 'clblockcraftparkour', name: 'Block Craft Parkour', url: '/games/clblockcraftparkour.html', icon: '🏃' },
  { id: 'clblockcraftshooter', name: 'Block Craft Shooter', url: '/games/clblockcraftshooter.html', icon: '🔫' },
  { id: 'clblockpost', name: 'Block Post', url: '/games/clblockpost.html', icon: '🎮' },
  { id: 'clblockthepig', name: 'Block the Pig', url: '/games/clblockthepig.html', icon: '🎮' },
  { id: 'clblockydemolitionderby', name: 'Blocky Demolition Derby', url: '/games/clblockydemolitionderby.html', icon: '🎮' },
  { id: 'clblockysnakes', name: 'Blocky Snakes', url: '/games/clblockysnakes.html', icon: '🎮' },
  { id: 'clblood', name: 'Blood', url: '/games/clblood.html', icon: '🎮' },
  { id: 'clbloodmoney', name: 'Blood Money', url: '/games/clbloodmoney.html', icon: '🎮' },
  { id: 'clbloodtournament', name: 'Blood Tournament', url: '/games/clbloodtournament.html', icon: '🎮' },
  { id: 'clbloons', name: 'Bloons', url: '/games/clbloons.html', icon: '🎈' },
  { id: 'clbloons2', name: 'Bloons 2', url: '/games/clbloons2.html', icon: '🎮' },
  { id: 'clbloonspp1', name: 'Bloons Pp 1', url: '/games/clbloonspp1.html', icon: '🎮' },
  { id: 'clbloonspp2', name: 'Bloons Pp 2', url: '/games/clbloonspp2.html', icon: '🎮' },
  { id: 'clbloonspp3', name: 'Bloons Pp 3', url: '/games/clbloonspp3.html', icon: '🎮' },
  { id: 'clbloonspp4', name: 'Bloons Pp 4', url: '/games/clbloonspp4.html', icon: '🎮' },
  { id: 'clbloonspp5', name: 'Bloons Pp 5', url: '/games/clbloonspp5.html', icon: '🎮' },
  { id: 'clbloonstd1', name: 'Bloons Td 1', url: '/games/clbloonsTD1.html', icon: '🎮' },
  { id: 'clbloonstd2', name: 'Bloons Td 2', url: '/games/clbloonsTD2.html', icon: '🎮' },
  { id: 'clbloonstd3', name: 'Bloons Td 3', url: '/games/clbloonsTD3.html', icon: '🎮' },
  { id: 'clbloonstd4', name: 'Bloons Td 4', url: '/games/clbloonsTD4.html', icon: '🎮' },
  { id: 'clbloonstd5', name: 'Bloons Td 5', url: '/games/clbloonsTD5.html', icon: '🎮' },
  { id: 'clbloonstd6scratch', name: 'Bloons Td 6 Scratch', url: '/games/clbloonsTD6scratch.html', icon: '🎮' },
  { id: 'clbtd1', name: 'Bloons Tower Defense 1', url: '/games/clBTD1.html', icon: '🏰' },
  { id: 'clbloxorz', name: 'Bloxorz', url: '/games/clbloxorz.html', icon: '🧩' },
  { id: 'clblumgiracers', name: 'Blum Gi Racers', url: '/games/clblumgiracers.html', icon: '🏎️' },
  { id: 'clblumgirocket', name: 'Blum Gi Rocket', url: '/games/clblumgirocket.html', icon: '🌌' },
  { id: 'clbmx2', name: 'BMX 2', url: '/games/clBMX2.html', icon: '🏎️' },
  { id: 'clbntts', name: 'Bntts', url: '/games/clbntts.html', icon: '🎮' },
  { id: 'clbobasimulator', name: 'Bob Asimulator', url: '/games/clbobasimulator.html', icon: '🎮' },
  { id: 'clbobtherobber', name: 'Bob the Robber', url: '/games/clbobtherobber.html', icon: '🎮' },
  { id: 'clbobtherobber2', name: 'Bob the Robber 2', url: '/games/clbobtherobber2.html', icon: '🎮' },
  { id: 'clbobtherobber5', name: 'Bob the Robber 5', url: '/games/clbobtherobber5.html', icon: '🎮' },
  { id: 'clbollybeat', name: 'Boll Ybeat', url: '/games/clbollybeat.html', icon: '🎵' },
  { id: 'clbomberman', name: 'Bomberman', url: '/games/clbomberman.html', icon: '💣' },
  { id: 'clbomberman2', name: 'Bomberman 2', url: '/games/clbomberman2.html', icon: '🎮' },
  { id: 'clbombermanhero', name: 'Bomberman Hero', url: '/games/clbombermanhero.html', icon: '🎮' },
  { id: 'clbombermanworld', name: 'Bomberman World', url: '/games/clbombermanworld.html', icon: '🎮' },
  { id: 'clbonanza-bros', name: 'Bonanza Bros', url: '/games/clBonanza-Bros.html', icon: '🎮' },
  { id: 'clbonkerssnes', name: 'Bonkers SNES', url: '/games/clbonkerssnes.html', icon: '🎮' },
  { id: 'clboomslingers', name: 'Boom Slingers', url: '/games/clboomslingers.html', icon: '🎮' },
  { id: 'clbottlecracks', name: 'Bottle Cracks', url: '/games/clbottlecracks.html', icon: '🎮' },
  { id: 'clbottleflip3d', name: 'Bottle Flip 3D', url: '/games/clbottleflip3d.html', icon: '🎮' },
  { id: 'clbotwds', name: 'Botwds', url: '/games/clbotwds.html', icon: '🎮' },
  { id: 'clbounceback', name: 'Bounce Back', url: '/games/clbounceback.html', icon: '🎮' },
  { id: 'clbouncemasters', name: 'Bounce Masters', url: '/games/clbouncemasters.html', icon: '🎮' },
  { id: 'clbouncybasketball', name: 'Bouncy Basketball', url: '/games/clbouncybasketball.html', icon: '🏀' },
  { id: 'clbouncymotors', name: 'Bouncy Motors', url: '/games/clbouncymotors.html', icon: '🏎️' },
  { id: 'clbountyofone', name: 'Bounty of One', url: '/games/clBountyOfOne.html', icon: '🎮' },
  { id: 'clbowmaster', name: 'Bow Master', url: '/games/clbowmaster.html', icon: '🎮' },
  { id: 'clbowlalt', name: 'Bowlalt', url: '/games/clbowlalt.html', icon: '🎮' },
  { id: 'bowmasters', name: 'Bowmasters', url: '/games/Bowmasters.html', icon: '🏹' },
  { id: 'clboxhead2playrooms', name: 'Box Head 2 Playrooms', url: '/games/clboxhead2playrooms.html', icon: '🎮' },
  { id: 'clboxheadnightmare', name: 'Box Head Nightmare', url: '/games/clboxheadnightmare.html', icon: '🧟' },
  { id: 'clboxinglive2', name: 'Boxing Live 2', url: '/games/clboxinglive2.html', icon: '🎮' },
  { id: 'clboxingrandom', name: 'Boxing Random', url: '/games/clboxingrandom.html', icon: '🎮' },
  { id: 'clboxinglive-2', name: 'Boxinglive 2', url: '/games/clboxinglive-2.html', icon: '🎮' },
  { id: 'clbrainrot', name: 'Brain Rot', url: '/games/clbrainrot.html', icon: '🎮' },
  { id: 'clbrawlsimulator3d', name: 'Brawl Simulator 3D', url: '/games/clbrawlsimulator3d.html', icon: '🥊' },
  { id: 'clbrawlstars', name: 'Brawl Stars', url: '/games/clBrawlstars.html', icon: '🥊' },
  { id: 'clbreadskate', name: 'Bread Skate', url: '/games/clbreadskate.html', icon: '🎮' },
  { id: 'clbridgerace', name: 'Bridge Race', url: '/games/clbridgerace.html', icon: '🏎️' },
  { id: 'clbrotato', name: 'Brotato', url: '/games/clbrotato.html', icon: '🎮' },
  { id: 'clbtd5', name: 'Btd 5', url: '/games/clbtd5.html', icon: '🏰' },
  { id: 'clbtts', name: 'Btts', url: '/games/clbtts.html', icon: '🎮' },
  { id: 'clbubbleshooter', name: 'Bubble Shooter', url: '/games/clbubbleshooter.html', icon: '🔫' },
  { id: 'clbubbleshooterpirate', name: 'Bubble Shooter Pirate', url: '/games/clbubbleshooterpirate.html', icon: '🔫' },
  { id: 'clbubbletanks', name: 'Bubble Tanks', url: '/games/clbubbletanks.html', icon: '🪖' },
  { id: 'clbubbletanks2', name: 'Bubble Tanks 2', url: '/games/clbubbletanks2.html', icon: '🪖' },
  { id: 'clbubbletanks3', name: 'Bubble Tanks 3', url: '/games/clbubbletanks3.html', icon: '🪖' },
  { id: 'clbubbletanksarenas', name: 'Bubble Tanks Arenas', url: '/games/clbubbletanksarenas.html', icon: '🪖' },
  { id: 'clbubbletankstd', name: 'Bubble Tanks Td', url: '/games/clbubbletankstd.html', icon: '🪖' },
  { id: 'clbubsy', name: 'Bubsy', url: '/games/clbubsy.html', icon: '🎮' },
  { id: 'clbuckshotroulette', name: 'Buckshot Roulette', url: '/games/clbuckshotroulette.html', icon: '🎮' },
  { id: 'clbuildnowgg', name: 'Build Now Gg', url: '/games/clbuildnowgg.html', icon: '⛏️' },
  { id: 'clbulletforce', name: 'Bullet Force', url: '/games/clbulletforce.html', icon: '🔫' },
  { id: 'clbunzobunny', name: 'Bun Zo Bunny', url: '/games/clbunzobunny.html', icon: '🎮' },
  { id: 'clbunnyland', name: 'Bunny Land', url: '/games/clbunnyland.html', icon: '🎮' },
  { id: 'clburgerandfrights', name: 'Burger and Frights', url: '/games/clburgerandfrights.html', icon: '🍕' },
  { id: 'clburgertime', name: 'Burger Time', url: '/games/clburgertime.html', icon: '🍕' },
  { id: 'clburritobison', name: 'Burrito Bison', url: '/games/clburritobison.html', icon: '🎮' },
  { id: 'clburritobison2', name: 'Burrito Bison 2', url: '/games/clburritobison2.html', icon: '🎮' },
  { id: 'clburritobisonlaunchalibre', name: 'Burrito Bison Launch Alibre', url: '/games/clburritobisonlaunchalibre.html', icon: '🎮' },
  { id: 'clburritobisonrevenge', name: 'Burrito Bison Revenge', url: '/games/clburritobisonrevenge.html', icon: '🎮' },
  { id: 'clbushidoblade', name: 'Bushido Blade', url: '/games/clbushidoblade.html', icon: '🎮' },
  { id: 'clbusterjam', name: 'Buster Jam', url: '/games/clBusterJam.html', icon: '🎮' },
  { id: 'clcactusmccoy-1', name: 'Cactus Mccoy', url: '/games/clcactusmccoy(1).html', icon: '🎮' },
  { id: 'clcactusmccoy2-1', name: 'Cactus Mccoy 2', url: '/games/clcactusmccoy2(1).html', icon: '🎮' },
  { id: 'clcallofbattle', name: 'Call of Battle', url: '/games/clcallofbattle.html', icon: '🎮' },
  { id: 'clcamilla', name: 'Camilla', url: '/games/clcamilla.html', icon: '🎮' },
  { id: 'clcandybox1', name: 'Candy Box 1', url: '/games/clcandybox1.html', icon: '🎮' },
  { id: 'clcannonfodder', name: 'Cannon Fodder', url: '/games/clcannonfodder.html', icon: '🎮' },
  { id: 'clcannonballs3d', name: 'Cannonballs 3D', url: '/games/clcannonballs3d.html', icon: '🏀' },
  { id: 'clcaptainlang', name: 'Captain Lang', url: '/games/clcaptainlang.html', icon: '🎮' },
  { id: 'clcaptchaware', name: 'Captcha Ware', url: '/games/clcaptchaware.html', icon: '🪖' },
  { id: 'clcapybaraclicker', name: 'Capybara Click Er', url: '/games/clcapybaraclicker.html', icon: '👆' },
  { id: 'clcarcrash3', name: 'Car Crash 3', url: '/games/clcarcrash3.html', icon: '🎮' },
  { id: 'clcardrawing', name: 'Car Drawing', url: '/games/clcardrawing.html', icon: '♟️' },
  { id: 'clcarkingarena', name: 'Car King Arena', url: '/games/clcarkingarena.html', icon: '🎮' },
  { id: 'clcarrampvspolicechase', name: 'Car Ramp vs Police Chase', url: '/games/clcarrampvspolicechase.html', icon: '🎮' },
  { id: 'clcarstuntsdriving', name: 'Car Stunts Driving', url: '/games/clcarstuntsdriving.html', icon: '🏎️' },
  { id: 'clcareatscar2deluxe', name: 'Care at Scar 2 Deluxe', url: '/games/clcareatscar2deluxe.html', icon: '🎮' },
  { id: 'clcarmods', name: 'Carmods', url: '/games/clcarmods.html', icon: '🎮' },
  { id: 'clcarnivalgamesds', name: 'Carnival Games DS', url: '/games/clcarnivalgamesds.html', icon: '🎮' },
  { id: 'clcastaway', name: 'Castaway', url: '/games/clcastaway.html', icon: '🎮' },
  { id: 'clcastlebloodline', name: 'Castle Bloodline', url: '/games/clcastlebloodline.html', icon: '⚔️' },
  { id: 'clcastlecircleofmoon', name: 'Castle Circle of Moon', url: '/games/clcastlecircleofmoon.html', icon: '⚔️' },
  { id: 'clcastlewarsmodern', name: 'Castle Wars Modern', url: '/games/clcastlewarsmodern.html', icon: '🪖' },
  { id: 'clcastlevania', name: 'Castlevania', url: '/games/clcastlevania.html', icon: '⚔️' },
  { id: 'clcastlevania2', name: 'Castlevania 2', url: '/games/clcastlevania2.html', icon: '⚔️' },
  { id: 'clcastlevania3', name: 'Castlevania 3', url: '/games/clcastlevania3.html', icon: '⚔️' },
  { id: 'clcastlevaniaariaofsorrow', name: 'Castlevania Aria of Sorrow', url: '/games/clcastlevaniaariaofsorrow.html', icon: '⚔️' },
  { id: 'clcastlevaniadawnofsorrow', name: 'Castlevania Dawn of Sorrow', url: '/games/clcastlevaniadawnofsorrow.html', icon: '⚔️' },
  { id: 'clcastlevanianes', name: 'Castlevania NES', url: '/games/clcastlevanianes.html', icon: '⚔️' },
  { id: 'clcatmario', name: 'Cat Mario', url: '/games/clcatmario.html', icon: '🍄' },
  { id: 'clcatmariogood', name: 'Cat Mario Good', url: '/games/clcatmariogood.html', icon: '🍄' },
  { id: 'clcatslovecake2', name: 'Cats Love Cake 2', url: '/games/clcatslovecake2.html', icon: '🎮' },
  { id: 'clcavecrawler', name: 'Cave Crawl Er', url: '/games/clcavecrawler.html', icon: '🎮' },
  { id: 'clcavestory', name: 'Cave Story', url: '/games/clcavestory.html', icon: '🎮' },
  { id: 'clceleste', name: 'Celeste', url: '/games/clceleste.html', icon: '🏔️' },
  { id: 'clceleste2', name: 'Celeste 2', url: '/games/clceleste2.html', icon: '🎮' },
  { id: 'clcelestemariodx', name: 'Celeste Mario DX', url: '/games/clcelestemariodx.html', icon: '🍄' },
  { id: 'clcellardoor', name: 'Cellar Door', url: '/games/clcellardoor.html', icon: '🎮' },
  { id: 'clcentipedearcade', name: 'Centipede Arcade', url: '/games/clcentipedearcade.html', icon: '🎮' },
  { id: 'clchoroqwonderful', name: 'Ch Oro Qwonderful', url: '/games/clchoroqwonderful.html', icon: '🎮' },
  { id: 'clchainofmemories', name: 'Chain of Memories', url: '/games/clchainofmemories.html', icon: '🎮' },
  { id: 'clchaosfaction2', name: 'Chaos Faction 2', url: '/games/clchaosfaction2.html', icon: '🎮' },
  { id: 'clcheckers', name: 'Checkers', url: '/games/clcheckers.html', icon: '♟️' },
  { id: 'clcheesechompers3d', name: 'Cheese Chomper S 3D', url: '/games/clcheesechompers3d.html', icon: '🎮' },
  { id: 'clcheeseisthereason', name: 'Cheese Is the Reason', url: '/games/clcheeseisthereason.html', icon: '🎮' },
  { id: 'cheeserolling', name: 'Cheese Rolling', url: '/games/cheeserolling.html', icon: '🎮' },
  { id: 'clcheshireinachatroom', name: 'Cheshire in Achatroom', url: '/games/clcheshireinachatroom.html', icon: '🎮' },
  { id: 'clchess', name: 'Chess', url: '/games/clchess.html', icon: '♟️' },
  { id: 'clchessclassic', name: 'Chess Classic', url: '/games/clchessclassic.html', icon: '♟️' },
  { id: 'clchibiknight', name: 'Chibi Knight', url: '/games/clchibiknight.html', icon: '⚔️' },
  { id: 'clchickenwar', name: 'Chicken War', url: '/games/clchickenwar.html', icon: '🪖' },
  { id: 'clchickenscream', name: 'Chickens Cream', url: '/games/clchickenscream.html', icon: '🎮' },
  { id: 'clchipschallenge', name: 'Chips Challenge', url: '/games/clchipschallenge.html', icon: '🎮' },
  { id: 'clchoppyorc', name: 'Choppy or C', url: '/games/clchoppyorc.html', icon: '🎮' },
  { id: 'clchronotrigger', name: 'Chrono Trigger', url: '/games/clchronotrigger.html', icon: '🎮' },
  { id: 'clchuzzle', name: 'Chuzzle', url: '/games/clchuzzle.html', icon: '🎮' },
  { id: 'clciviballs', name: 'Civ Iballs', url: '/games/clciviballs.html', icon: '🎮' },
  { id: 'clciviballs2', name: 'Civ Iballs 2', url: '/games/clciviballs2.html', icon: '🎮' },
  { id: 'cla-walk-in-the-forest--v1-0', name: 'A Walk in the Forest (v 1.0)', url: '/games/clA%20Walk%20in%20The%20Forest%20(v1.0).html', icon: '🎮' },
  { id: 'clacko_s-mach-bike-challenge--v1-0', name: "Acko's Mach Bike Challenge v1.0", url: '/games/clAcko_s%20Mach%20Bike%20Challenge%20(v1.0).html', icon: '🏎️' },
  { id: 'clcartoonnetworktabletennisultimatetournament', name: 'Cartoon Network Table Tennis Ultimate Tournament', url: '/games/clCartoonNetworkTableTennisUltimateTournament.html', icon: '🏐' },
  { id: 'clceliasstupidromhack', name: 'Celias Stupid Rom Hack', url: '/games/clCeliasStupidROMHack.html', icon: '🎮' },
  { id: 'clcelltosingularity', name: 'Cell to Singularity', url: '/games/clCellToSingularity.html', icon: '🎮' },
  { id: 'clchickencs', name: 'Chicken CS', url: '/games/clChickenCS.html', icon: '🎮' },
  { id: 'clcircloo2', name: 'Circloo 2', url: '/games/clCircloO2.html', icon: '🎮' },
  { id: 'clcolorboxmustard', name: 'Colorboxmustard', url: '/games/clColorboxmustard.html', icon: '🧩' },
  { id: 'clcrystalcastles', name: 'Crystal Castles', url: '/games/clCrystalCastles.html', icon: '⚔️' },
  { id: 'cldashmetry', name: 'Dashmetry', url: '/games/clDashmetry.html', icon: '🎮' },
  { id: 'cldknescollection-1', name: 'Dknes Collection', url: '/games/clDKNESCollection(1).html', icon: '🎮' },
  { id: 'cldragonballzthelegacyofgoku', name: 'Dragon Ball Z: Legacy of Goku', url: '/games/clDragonBallZTheLegacyofGoku.html', icon: '⚔️' },
  { id: 'cldragonquestix', name: 'Dragon Quest IX', url: '/games/clDragonQuestIX.html', icon: '⚔️' },
  { id: 'cldragonxclient', name: 'Dragonxclient', url: '/games/clDragonxclient.html', icon: '⚔️' },
  { id: 'cleaglercrafttech', name: 'Eagler Craft Tech', url: '/games/clEaglerCraftTech.html', icon: '⛏️' },
  { id: 'cleaglercraft-alpha-126-offline', name: 'Eaglercraft Alpha 126 Offline', url: '/games/clEaglercraft-Alpha-126-Offline.html', icon: '⛏️' },
  { id: 'cleaglercraft-beta-1-3-offline', name: 'Eaglercraft Beta 1.3 Offline', url: '/games/clEaglercraft-Beta-1.3-Offline.html', icon: '⛏️' },
  { id: 'cleaglercraft-beta-13-offline', name: 'Eaglercraft Beta 13 Offline', url: '/games/clEaglercraft-Beta-13-Offline.html', icon: '⛏️' },
  { id: 'cleaglercraft-indev-offline-1', name: 'Eaglercraft Indev Offline', url: '/games/clEaglercraft-Indev-Offline(1).html', icon: '⛏️' },
  { id: 'cleaglercraftl_19_v0_7_0_offline_signed-1', name: 'Eaglercraft L19 v0.7.0 Offline', url: '/games/clEaglercraftL_19_v0_7_0_Offline_Signed(1).html', icon: '⛏️' },
  { id: 'cleaglercraftx188-u29', name: 'Eaglercraft X 1.88 (U29)', url: '/games/clEaglercraftX188(u29).html', icon: '⛏️' },
  { id: 'cleaglercraftx-188u29', name: 'Eaglercraft X 1.88 U29', url: '/games/clEaglercraftX-188u29.html', icon: '⛏️' },
  { id: 'cleaglercraftz_1112-1', name: 'Eaglercraft Z 1112', url: '/games/clEaglercraftZ_1112(1).html', icon: '⛏️' },
  { id: 'clffsonic2', name: 'FFSonic 2', url: '/games/clFFsonic2.html', icon: '💨' },
  { id: 'clffsonic3', name: 'FFSonic 3', url: '/games/clFFsonic3.html', icon: '💨' },
  { id: 'clffsonic4', name: 'FFSonic 4', url: '/games/clFFsonic4.html', icon: '💨' },
  { id: 'clffsonic5', name: 'FFSonic 5', url: '/games/clFFsonic5.html', icon: '💨' },
  { id: 'clffsonic61', name: 'FFSonic 61', url: '/games/clFFsonic61.html', icon: '💨' },
  { id: 'clffsonic62', name: 'FFSonic 62', url: '/games/clFFsonic62.html', icon: '💨' },
  { id: 'clfifainternationalsoccer', name: 'Fif Ainternationalsoccer', url: '/games/clFIFAinternationalsoccer.html', icon: '⚽' },
  { id: 'clfifaroadtoworldcup98', name: 'Fif Aroadtoworldcup 98', url: '/games/clFIFAroadtoworldcup98.html', icon: '🎮' },
  { id: 'clfifasoccer06', name: 'Fif Asoccer 06', url: '/games/clFIFAsoccer06.html', icon: '⚽' },
  { id: 'clfifasoccer95', name: 'Fif Asoccer 95', url: '/games/clFIFAsoccer95.html', icon: '⚽' },
  { id: 'clfifasoccer96', name: 'Fif Asoccer 96', url: '/games/clFIFAsoccer96.html', icon: '⚽' },
  { id: 'clfifasoccer97', name: 'Fif Asoccer 97', url: '/games/clFIFAsoccer97.html', icon: '⚽' },
  { id: 'clfifastreet2', name: 'Fif Astreet 2', url: '/games/clFIFAstreet2.html', icon: '🎮' },
  { id: 'clfifa2000-1', name: 'Fifa 2000', url: '/games/clFIFA2000(1).html', icon: '⚽' },
  { id: 'clfifa99', name: 'Fifa 99', url: '/games/clFIFA99.html', icon: '⚽' },
  { id: 'clgain-ground', name: 'Gain Ground', url: '/games/clGain%20Ground.html', icon: '🎮' },
  { id: 'clgettothetopalthoughthereisnotop', name: 'Gettothetopalthoughthereisnotop', url: '/games/clGettothetopalthoughthereisnotop.html', icon: '🎮' },
  { id: 'clhelios-offline--1', name: 'Helios Offline', url: '/games/clHelios-Offline%20(1).html', icon: '🎮' },
  { id: 'clhinohomo', name: 'Hi No Homo', url: '/games/clHiNoHomo.html', icon: '🎮' },
  { id: 'clhighspeed', name: 'High Speed', url: '/games/clHighSpeed.html', icon: '🏎️' },
  { id: 'clhil-climbracing2', name: 'Hil Climb Racing 2', url: '/games/clHil%20ClimbRacing2.html', icon: '🏎️' },
  { id: 'clhoennslastwish', name: 'Hoenns Last Wish', url: '/games/clHoennsLastWish.html', icon: '🎮' },
  { id: 'clinkwell--v1-04', name: 'Inkwell (v 1.04)', url: '/games/clInkwell%20(v1.04).html', icon: '🎮' },
  { id: 'cljump', name: 'Jump', url: '/games/clJUMP.html', icon: '🏃' },
  { id: 'clkengriffeyjrpresentsmajorleaguebaseball', name: 'Ken Griffey Jr Presents Major League Baseball', url: '/games/clKenGriffeyJrPresentsMajorLeagueBaseball.html', icon: '⚾' },
  { id: 'cllearntofly3debug', name: 'Learn to Fly 3 Debug', url: '/games/clLearnToFly3Debug.html', icon: '🎮' },
  { id: 'cllegacyofgoku', name: 'Legacy of Goku', url: '/games/clLegacyOfGoku.html', icon: '🎮' },
  { id: 'cllse', name: 'Lse', url: '/games/clLSE.html', icon: '🎮' },
  { id: 'clclmadnessambulation', name: 'Madness Am Bulat Ion', url: '/games/clclmadnessambulation.html', icon: '🎮' },
  { id: 'clmario-party-advance', name: 'Mario Party Advance', url: '/games/clMario%20Party%20Advance.html', icon: '🍄' },
  { id: 'clminceraft-i-notmine_v6-1', name: 'Minceraft I Not Mine V6', url: '/games/clMinceraft-I-NotMine_V6(1).html', icon: '🎮' },
  { id: 'clmoemon-emerald-vanilla---v1-1-0', name: 'Moemon Emerald Vanilla+ (v 1.1.0)', url: '/games/clMoemon%20Emerald%20Vanilla+%20(v1.1.0).html', icon: '🎮' },
  { id: 'clnautilusos-1', name: 'Nautilus Os', url: '/games/clNautilusOS(1).html', icon: '🎮' },
  { id: 'clnicktoonsfreezeframefrenzy', name: 'Nicktoons Freeze Frame Frenzy', url: '/games/clNicktoonsFreezeFrameFrenzy.html', icon: '🎮' },
  { id: 'clnutsandboltsscrewingpuzzle', name: 'Nutsand Bolts Screwing Puzzle', url: '/games/clNutsandBoltsScrewingPuzzle.html', icon: '🧩' },
  { id: 'clorangeroulette', name: 'Orange Roulette', url: '/games/clOrangeRoulette.html', icon: '🎮' },
  { id: 'cloutrunarcade', name: 'Outrun Arcade', url: '/games/clOutrunArcade.html', icon: '🏃' },
  { id: 'cloutrungenesis', name: 'Outrun Genesis', url: '/games/clOutrunGenesis.html', icon: '🏃' },
  { id: 'clo-oo', name: 'Öoo', url: '/games/clÖoo.html', icon: '🎮' },
  { id: 'clpapermariopracticehack', name: 'Paper Mario Practice Hack', url: '/games/clPaperMarioPracticeHack.html', icon: '🍄' },
  { id: 'clpokeheartgoldgenerations', name: 'Poke Heartgold Generations', url: '/games/clPokeHeartgoldGenerations.html', icon: '🐾' },
  { id: 'clpokethetaemeraldex', name: 'Poke Theta Emerald EX', url: '/games/clPokeThetaEmeraldEX.html', icon: '🐾' },
  { id: 'clpokemonemeraldrouge', name: 'Pokemonemeraldrouge', url: '/games/clPokemonemeraldrouge.html', icon: '🐾' },
  { id: 'clpokemonrocketedition', name: 'Pokemonrocketedition', url: '/games/clPokemonrocketedition.html', icon: '🐾' },
  { id: 'clpoke-mon-emerald-rush-edition--2-0', name: 'Pokémon Emerald Rush Edition (2.0)', url: '/games/clPokémon%20Emerald%20Rush%20Edition%20(2.0).html', icon: '🐾' },
  { id: 'clpoke-mon-trade-_stache--v1-1', name: 'Pokémon Trade& Stache (v 1.1)', url: '/games/clPokémon%20Trade&_Stache%20(V1.1).html', icon: '🐾' },
  { id: 'clpoke-mon-two--v1-1', name: 'Pokémon Two (v 1.1)', url: '/games/clPokémon%20TWO%20(v1.1).html', icon: '🐾' },
  { id: 'clpoke-monstunningsteel', name: 'Pokémonstunningsteel', url: '/games/clPokémonstunningsteel.html', icon: '🐾' },
  { id: 'clpou', name: 'Pou', url: '/games/clPou.html', icon: '🎮' },
  { id: 'clscamptonthegreatfightrecreate', name: 'Scampton the Great Fight Recreate', url: '/games/clScamptonTheGreatFightRecreate.html', icon: '🎮' },
  { id: 'clskyriders', name: 'Sky Riders', url: '/games/clSkyRiders.html', icon: '🎮' },
  { id: 'clsonic---knuckles---sonic-the-hedgehog-3', name: 'Sonic & Knuckles + Sonic the Hedgehog 3', url: '/games/clSonic%20&%20Knuckles%20+%20Sonic%20The%20Hedgehog%203.html', icon: '💨' },
  { id: 'clsonic1scorerush', name: 'Sonic 1 Score Rush', url: '/games/clSonic1ScoreRush.html', icon: '💨' },
  { id: 'clsonic1thesuperchallenges', name: 'Sonic 1 the Super Challenges', url: '/games/clSonic1TheSuperChallenges.html', icon: '💨' },
  { id: 'clsonic2scorerush', name: 'Sonic 2 Score Rush', url: '/games/clSonic2ScoreRush.html', icon: '💨' },
  { id: 'clsonicinsm64', name: 'Sonic in Sm64', url: '/games/clSonicInSM64.html', icon: '💨' },
  { id: 'clsonicinsmw-1', name: 'Sonicin Smw', url: '/games/clSonicinSMW(1).html', icon: '💨' },
  { id: 'clsovereignoftheskys', name: 'Sovereignoftheskys', url: '/games/clSovereignoftheskys.html', icon: '🎮' },
  { id: 'clspongebobpowerkartgrandprix', name: 'Spongebob Power Kart Grand Prix', url: '/games/clSpongebobPowerKartGrandPrix.html', icon: '🏎️' },
  { id: 'clsportsheadsicehockey', name: 'Sports Heads Ice Hockey', url: '/games/clSportsHeadsIceHockey.html', icon: '🏒' },
  { id: 'clssf2tarcade', name: 'Ssf 2 T Arcade', url: '/games/clSSF2TArcade.html', icon: '🎮' },
  { id: 'clstickmankingdomclash', name: 'Stickman Kingdomclash', url: '/games/clStickmanKingdomclash.html', icon: '🕴️' },
  { id: 'clstreetfighter2hfarcade-1', name: 'Street Fighter 2 Hf Arcade', url: '/games/clStreetFighter2HFArcade(1).html', icon: '🥊' },
  { id: 'clthesunforthevampire', name: 'The Sun for the Vampire', url: '/games/clTheSunForTheVampire.html', icon: '🧛' },
  { id: 'cltuff_client_offline_wasm-1', name: 'Tuff Client Offline Wasm', url: '/games/clTuff_Client_Offline_WASM(1).html', icon: '⚔️' },
  { id: 'cluvuvwevwevweonyetenvewveugwemubwemossas', name: 'Uvuvwevwevwe Onyetenvewve Ugwemubwem Ossas', url: '/games/clUvuvwevwevweOnyetenvewveUgwemubwemOssas.html', icon: '🎮' },
  { id: 'clclashnslash', name: 'Clash Nslash', url: '/games/clclashnslash.html', icon: '🎮' },
  { id: 'clclashofvikings', name: 'Clash of Vikings', url: '/games/clclashofvikings.html', icon: '🎮' },
  { id: 'clclayuncraft', name: 'Clay Un Craft', url: '/games/clclayuncraft.html', icon: '⛏️' },
  { id: 'clclaymore', name: 'Claymore', url: '/games/clclaymore.html', icon: '🎮' },
  { id: 'clcleanupio', name: 'Cleanup IO', url: '/games/clcleanupio.html', icon: '🎮' },
  { id: 'clclearvision', name: 'Clear Vision', url: '/games/clclearvision.html', icon: '🎮' },
  { id: 'clclearvision2', name: 'Clear Vision 2', url: '/games/clclearvision2.html', icon: '🎮' },
  { id: 'clclearvision3', name: 'Clear Vision 3', url: '/games/clclearvision3.html', icon: '🎮' },
  { id: 'clclearvision4', name: 'Clear Vision 4', url: '/games/clclearvision4.html', icon: '🎮' },
  { id: 'clclearvision5', name: 'Clear Vision 5', url: '/games/clclearvision5.html', icon: '🎮' },
  { id: 'clclimbforbrainrots', name: 'Climb for Brain Rots', url: '/games/clclimbforbrainrots.html', icon: '🎮' },
  { id: 'clclover', name: 'Clover', url: '/games/clclover.html', icon: '🎮' },
  { id: 'clclucluland', name: 'Clu Clu Land', url: '/games/clclucluland.html', icon: '🎮' },
  { id: 'clclubbytheseal', name: 'Club by the Seal', url: '/games/clclubbytheseal.html', icon: '🐟' },
  { id: 'clclusterrush', name: 'Cluster Rush', url: '/games/clclusterrush.html', icon: '🎮' },
  { id: 'clcoalllcdemo', name: 'Coal Llc Demo', url: '/games/clcoalllcdemo.html', icon: '🎮' },
  { id: 'clcod4', name: 'Cod 4', url: '/games/clcod4.html', icon: '🎮' },
  { id: 'clcodblackopp', name: 'Cod Black Opp', url: '/games/clcodblackopp.html', icon: '🎮' },
  { id: 'clcoddefiance', name: 'Cod Defiance', url: '/games/clcoddefiance.html', icon: '🎮' },
  { id: 'clcodmodernwarfare', name: 'Cod Modern Warfare', url: '/games/clcodmodernwarfare.html', icon: '🪖' },
  { id: 'clcodworldatwar', name: 'Cod World at War', url: '/games/clcodworldatwar.html', icon: '🪖' },
  { id: 'clcodeorgbutoffline', name: 'Code Org But Offline', url: '/games/clcodeorgbutoffline.html', icon: '🎮' },
  { id: 'clcodercraft', name: 'Code Rcraft', url: '/games/clcodercraft.html', icon: '⛏️' },
  { id: 'clcodenamegordon', name: 'Codename Gordon', url: '/games/clcodenamegordon.html', icon: '🎮' },
  { id: 'codeorg', name: 'Codeorg', url: '/games/codeorg.html', icon: '🎮' },
  { id: 'clcoffeemaker', name: 'Coffee Maker', url: '/games/clcoffeemaker.html', icon: '🎮' },
  { id: 'clcoldfront', name: 'Cold Front', url: '/games/clcoldfront.html', icon: '🎮' },
  { id: 'clcoldpines', name: 'Cold Pines', url: '/games/clcoldpines.html', icon: '🎮' },
  { id: 'clcolorburst3d', name: 'Color Burst 3D', url: '/games/clcolorburst3d.html', icon: '🧩' },
  { id: 'clcolormatch', name: 'Color Match', url: '/games/clcolormatch.html', icon: '🧩' },
  { id: 'clcolorwatersort3d', name: 'Color Water Sort 3D', url: '/games/clcolorwatersort3d.html', icon: '🧩' },
  { id: 'colorbox-mustard', name: 'Colorbox Mustard', url: '/games/Colorbox%20Mustard.html', icon: '🎨' },
  { id: 'clcombopool', name: 'Combo Pool', url: '/games/clcombopool.html', icon: '🎮' },
  { id: 'clcommandandconquer', name: 'Command and Conquer', url: '/games/clcommandandconquer.html', icon: '🎮' },
  { id: 'clcommanderkeen4', name: 'Commander Keen 4', url: '/games/clcommanderkeen4.html', icon: '🎮' },
  { id: 'clcommanderkeen5', name: 'Commander Keen 5', url: '/games/clcommanderkeen5.html', icon: '🎮' },
  { id: 'clcommanderkeen6', name: 'Commander Keen 6', url: '/games/clcommanderkeen6.html', icon: '🎮' },
  { id: 'clconfrontingurself', name: 'Confronting Ur Self', url: '/games/clconfrontingurself.html', icon: '🎮' },
  { id: 'clconfrontingyourself', name: 'Confronting Yourself', url: '/games/clconfrontingyourself.html', icon: '🎮' },
  { id: 'clconkersbadfurday', name: 'Conker Sbad Fur Day', url: '/games/clconkersbadfurday.html', icon: '🎮' },
  { id: 'clcontra', name: 'Contra', url: '/games/clcontra.html', icon: '🎮' },
  { id: 'clcontra3', name: 'Contra 3', url: '/games/clcontra3.html', icon: '🎮' },
  { id: 'clcookieclicker', name: 'Cookie Click Er', url: '/games/clcookieclicker.html', icon: '👆' },
  { id: 'clcookieclickergood', name: 'Cookie Click Er Good', url: '/games/clcookieclickergood.html', icon: '👆' },
  { id: 'clcookieclickermodmenu', name: 'Cookie Click Er Mod Menu', url: '/games/clcookieclickermodmenu.html', icon: '👆' },
  { id: 'clcookie-clicker', name: 'Cookie Clicker', url: '/games/clcookie-clicker.html', icon: '👆' },
  { id: 'clcookingmama', name: 'Cooking Mama', url: '/games/clcookingmama.html', icon: '🍕' },
  { id: 'clcookingmama2', name: 'Cooking Mama 2', url: '/games/clcookingmama2.html', icon: '🍕' },
  { id: 'clcookingmama3', name: 'Cooking Mama 3', url: '/games/clcookingmama3.html', icon: '🍕' },
  { id: 'clcoreball', name: 'Core Ball', url: '/games/clcoreball.html', icon: '🎮' },
  { id: 'clcoryinthehouse', name: 'Cory in the House', url: '/games/clcoryinthehouse.html', icon: '🎮' },
  { id: 'clcotlk', name: 'Cotlk', url: '/games/clcotlk.html', icon: '🎮' },
  { id: 'clcountmastersstickmangames', name: 'Count Masters Stick Man Games', url: '/games/clcountmastersstickmangames.html', icon: '🕴️' },
  { id: 'clcoverorange', name: 'Cover Orange', url: '/games/clcoverorange.html', icon: '🎮' },
  { id: 'clcoverorange2', name: 'Cover Orange 2', url: '/games/clcoverorange2.html', icon: '🎮' },
  { id: 'clcoverorangejourneygangsters', name: 'Cover Orange Journey Gangsters', url: '/games/clcoverorangejourneygangsters.html', icon: '🎮' },
  { id: 'clcoverorangejourneyknights', name: 'Cover Orange Journey Knights', url: '/games/clcoverorangejourneyknights.html', icon: '⚔️' },
  { id: 'clcoverorangejourneypirates', name: 'Cover Orange Journey Pirates', url: '/games/clcoverorangejourneypirates.html', icon: '🎮' },
  { id: 'clcoverorangejourneyspace', name: 'Cover Orange Journey Space', url: '/games/clcoverorangejourneyspace.html', icon: '🌌' },
  { id: 'clcoverorangeplayerspack', name: 'Cover Orange Players Pack', url: '/games/clcoverorangeplayerspack.html', icon: '🎮' },
  { id: 'clcoverorangeplayerspack2', name: 'Cover Orange Players Pack 2', url: '/games/clcoverorangeplayerspack2.html', icon: '🎮' },
  { id: 'clcoverorangeplayerspack3-1', name: 'Cover Orange Players Pack 3', url: '/games/clcoverorangeplayerspack3(1).html', icon: '🎮' },
  { id: 'clcrankit', name: 'Crankit', url: '/games/clcrankit.html', icon: '🎮' },
  { id: 'clcrankitbang', name: 'Crankit!', url: '/games/clcrankit!.html', icon: '🎮' },
  { id: 'clcrash2', name: 'Crash 2', url: '/games/clcrash2.html', icon: '🎮' },
  { id: 'clcrash3', name: 'Crash 3', url: '/games/clcrash3.html', icon: '🎮' },
  { id: 'clcrashbandicoot--1', name: 'Crash Bandicoot', url: '/games/clcrashbandicoot%20(1).html', icon: '🎮' },
  { id: 'clcrashbandicoot2', name: 'Crash Bandicoot 2', url: '/games/clcrashbandicoot2.html', icon: '🎮' },
  { id: 'clcrashteamracing', name: 'Crash Team Racing', url: '/games/clcrashteamracing.html', icon: '🏎️' },
  { id: 'clcrazycars', name: 'Crazy Cars', url: '/games/clcrazycars.html', icon: '🎮' },
  { id: 'clcrazycattle3d', name: 'Crazy Cattle 3D', url: '/games/clcrazycattle3d.html', icon: '🎮' },
  { id: 'clcrazyclimber', name: 'Crazy Climber', url: '/games/clcrazyclimber.html', icon: '🎮' },
  { id: 'clcrazyfrogracer', name: 'Crazy Frog Racer', url: '/games/clcrazyfrogracer.html', icon: '🏎️' },
  { id: 'clcrazymotorcycle', name: 'Crazy Motorcycle', url: '/games/clcrazymotorcycle.html', icon: '🏍️' },
  { id: 'clcrazypenguincatapult', name: 'Crazy Penguin Catapult', url: '/games/clcrazypenguincatapult.html', icon: '🎮' },
  { id: 'clcrazyplanelanding', name: 'Crazy Plane Landing', url: '/games/clcrazyplanelanding.html', icon: '✈️' },
  { id: 'clcrazytaxigba', name: 'Crazy Taxi GBA', url: '/games/clcrazytaxigba.html', icon: '🎮' },
  { id: 'clcrazychicken3d', name: 'Crazy Chicken 3D', url: '/games/clcrazychicken3D.html', icon: '🎮' },
  { id: 'clcreaturecardidle', name: 'Creature Card Idle', url: '/games/clcreaturecardidle.html', icon: '🃏' },
  { id: 'clcreeperworld2', name: 'Creeper World 2', url: '/games/clcreeperworld2.html', icon: '🧟' },
  { id: 'clcreepyinternetstories', name: 'Creepy Internet Stories', url: '/games/clcreepyinternetstories.html', icon: '🧟' },
  { id: 'clcreepynightfunkin', name: 'Creepy Night Funk in', url: '/games/clcreepynightfunkin.html', icon: '🎵' },
  { id: 'clcrimsonmadness', name: 'Crimson Madness', url: '/games/clcrimsonmadness.html', icon: '🎮' },
  { id: 'clcrossyroad', name: 'Crossy Road', url: '/games/clcrossyroad.html', icon: '🐔' },
  { id: 'clcrunchball3000', name: 'Crunch Ball 3000', url: '/games/clcrunchball3000.html', icon: '🎮' },
  { id: 'clcs1-6', name: 'CS 1.6', url: '/games/clcs1.6.html', icon: '🎮' },
  { id: 'clcs6', name: 'CS 6', url: '/games/clcs6.html', icon: '🎮' },
  { id: 'clcsgoclicker', name: 'CS:GO Clicker', url: '/games/clcsgoclicker.html', icon: '👆' },
  { id: 'clcsds', name: 'CSDS', url: '/games/clcsds.html', icon: '🎮' },
  { id: 'clctgpnitro', name: 'CTGP Nitro', url: '/games/clctgpnitro.html', icon: '🎮' },
  { id: 'clcurveball-1', name: 'Curve Ball', url: '/games/clcurveball(1).html', icon: '🎮' },
  { id: 'clcustomersupport', name: 'Customer Support', url: '/games/clcustomersupport.html', icon: '🎮' },
  { id: 'clcuttherope', name: 'Cut the Rope', url: '/games/clcuttherope.html', icon: '🎮' },
  { id: 'clcuttheropeholiday', name: 'Cut the Rope Holiday', url: '/games/clcuttheropeholiday.html', icon: '🎮' },
  { id: 'clcuttheropetimetravel', name: 'Cut the Rope Time Travel', url: '/games/clcuttheropetimetravel.html', icon: '🎮' },
  { id: 'clcvooc', name: 'CVOOC', url: '/games/clcvooc.html', icon: '🎮' },
  { id: 'clcyberbungracing', name: 'Cyberbung Racing', url: '/games/clcyberbungracing.html', icon: '🏎️' },
  { id: 'clcybersensation', name: 'Cyber Sensation', url: '/games/clcybersensation.html', icon: '🎮' },
  { id: 'cldadish', name: 'Dadish', url: '/games/cldadish.html', icon: '🎮' },
  { id: 'cldadnme', name: 'Dad N Me', url: '/games/cldadnme.html', icon: '🎮' },
  { id: 'cldaggerfall', name: 'Daggerfall', url: '/games/cldaggerfall.html', icon: '🎮' },
  { id: 'cldandysworldclicker', name: 'Dandy Sworld Click Er', url: '/games/cldandysworldclicker.html', icon: '👆' },
  { id: 'cldanktomb', name: 'Dank Tomb', url: '/games/cldanktomb.html', icon: '🎮' },
  { id: 'cldasharena', name: 'Dash Arena', url: '/games/cldasharena.html', icon: '🎮' },
  { id: 'cldashio', name: 'Dashio', url: '/games/cldashio.html', icon: '🎮' },
  { id: 'cldatewithiraq', name: 'Date with Iraq', url: '/games/cldatewithiraq.html', icon: '🎮' },
  { id: 'cldborigins', name: 'DB Origins', url: '/games/cldborigins.html', icon: '🎮' },
  { id: 'cldborigins2', name: 'DB Origins 2', url: '/games/cldborigins2.html', icon: '🎮' },
  { id: 'cldbsniper', name: 'DB Sniper', url: '/games/cldbsniper.html', icon: '🔫' },
  { id: 'cldbzattacksaiyans', name: 'DBZ Attack Saiyans', url: '/games/cldbzattacksaiyans.html', icon: '🎮' },
  { id: 'cldbzdevolution', name: 'DBZ Devolution', url: '/games/cldbzdevolution.html', icon: '🎮' },
  { id: 'cldbzsuperwarriorssonic', name: 'DBZ Super Warriors Sonic', url: '/games/cldbzsuperwarriorssonic.html', icon: '💨' },
  { id: 'cldbzwarriors2', name: 'DBZ Warriors 2', url: '/games/cldbzwarriors2.html', icon: '🪖' },
  { id: 'clddlc64', name: 'DDLC 64', url: '/games/clddlc64.html', icon: '🎮' },
  { id: 'cldementium', name: 'Dementium', url: '/games/cldementium.html', icon: '🎮' },
  { id: 'cldeadestate', name: 'Dead Estate', url: '/games/cldeadestate.html', icon: '🧟' },
  { id: 'cldeadfrontieroutbreak', name: 'Dead Frontier Outbreak', url: '/games/cldeadfrontieroutbreak.html', icon: '🧟' },
  { id: 'cldeadfrontieroutbreak2', name: 'Dead Frontier Outbreak 2', url: '/games/cldeadfrontieroutbreak2.html', icon: '🧟' },
  { id: 'cldeadplate', name: 'Dead Plate', url: '/games/cldeadplate.html', icon: '🧟' },
  { id: 'cldeadseat', name: 'Dead Seat', url: '/games/cldeadseat.html', icon: '🧟' },
  { id: 'cldeadzed2', name: 'Dead Zed 2', url: '/games/cldeadzed2.html', icon: '🧟' },
  { id: 'cldeadair', name: 'Deadair', url: '/games/cldeadair.html', icon: '🧟' },
  { id: 'cldeadlydescent', name: 'Deadly Descent', url: '/games/cldeadlydescent.html', icon: '🧟' },
  { id: 'cldeadzed', name: 'Deadzed', url: '/games/cldeadzed.html', icon: '🧟' },
  { id: 'cldeathchase', name: 'Death Chase', url: '/games/cldeathchase.html', icon: '🎮' },
  { id: 'cldeathrun', name: 'Death Run', url: '/games/cldeathrun.html', icon: '🎮' },
  { id: 'cldeblob2', name: 'Deblob 2', url: '/games/cldeblob2.html', icon: '🎮' },
  { id: 'cldecision', name: 'Decision', url: '/games/cldecision.html', icon: '🎮' },
  { id: 'cldecision2', name: 'Decision 2', url: '/games/cldecision2.html', icon: '🎮' },
  { id: 'cldecision3', name: 'Decision 3', url: '/games/cldecision3.html', icon: '🎮' },
  { id: 'cldecisionmedieval', name: 'Decision Medieval', url: '/games/cldecisionmedieval.html', icon: '⚔️' },
  { id: 'cldeepersleep', name: 'Deeper Sleep', url: '/games/cldeepersleep.html', icon: '😴' },
  { id: 'cldeepestsword', name: 'Deepest Sword', url: '/games/cldeepestsword.html', icon: '⚔️' },
  { id: 'cldefendyourcastle', name: 'Defend Your Castle', url: '/games/cldefendyourcastle.html', icon: '⚔️' },
  { id: 'cldefendyournuts', name: 'Defend Your Nuts', url: '/games/cldefendyournuts.html', icon: '🎮' },
  { id: 'cldefendyournuts2', name: 'Defend Your Nuts 2', url: '/games/cldefendyournuts2.html', icon: '🎮' },
  { id: 'cldefenderarcade', name: 'Defender Arcade', url: '/games/cldefenderarcade.html', icon: '🎮' },
  { id: 'cldeltarune', name: 'Delta Rune', url: '/games/cldeltarune.html', icon: '♦️' },
  { id: 'cldeltatraveler', name: 'Delta Traveler', url: '/games/cldeltatraveler.html', icon: '♦️' },
  { id: 'cldemolitionderbycrashracing', name: 'Demolition Derby Crash Racing', url: '/games/cldemolitionderbycrashracing.html', icon: '🏎️' },
  { id: 'cldemonblade', name: 'Demon Blade', url: '/games/cldemonblade.html', icon: '🎮' },
  { id: 'cldemonbluff', name: 'Demon Bluff', url: '/games/cldemonbluff.html', icon: '🎮' },
  { id: 'cldiablo', name: 'Diablo', url: '/games/cldiablo.html', icon: '😈' },
  { id: 'cldiamondhollow', name: 'Diamond Hollow', url: '/games/cldiamondhollow.html', icon: '🎮' },
  { id: 'cldiamondhollow2', name: 'Diamond Hollow 2', url: '/games/cldiamondhollow2.html', icon: '🎮' },
  { id: 'cldiddykong-racing', name: 'Diddy Kong Racing', url: '/games/cldiddykong-racing.html', icon: '🏎️' },
  { id: 'cldieinthedungeon', name: 'Die in the Dungeon', url: '/games/cldieinthedungeon.html', icon: '🎴' },
  { id: 'cldigdug26', name: 'Dig Dug 26', url: '/games/cldigdug26.html', icon: '🎮' },
  { id: 'cldigtochina', name: 'Dig to China', url: '/games/cldigtochina.html', icon: '🎮' },
  { id: 'cldigdeep', name: 'Digdeep', url: '/games/cldigdeep.html', icon: '🎮' },
  { id: 'cldigdug', name: 'Digdug', url: '/games/cldigdug.html', icon: '🎮' },
  { id: 'cldigdug2', name: 'Digdug 2', url: '/games/cldigdug2.html', icon: '🎮' },
  { id: 'cldimensionalincident', name: 'Dimensional Incident', url: '/games/cldimensionalincident.html', icon: '🎮' },
  { id: 'cldinodudes', name: 'Dino Dudes', url: '/games/cldinodudes.html', icon: '🦕' },
  { id: 'cldinorunenterplanetd', name: 'Dino Run Enter Planet D', url: '/games/cldinorunenterplanetd.html', icon: '🦕' },
  { id: 'cldinorunmarathonofdoom', name: 'Dino Run Marathon of Doom', url: '/games/cldinorunmarathonofdoom.html', icon: '🦕' },
  { id: 'cldinorun', name: 'Dinorun', url: '/games/cldinorun.html', icon: '🦕' },
  { id: 'cldiredecks', name: 'Dire Decks', url: '/games/cldiredecks.html', icon: '🎮' },
  { id: 'cldkccompetitioncart', name: 'DK Competition Cart', url: '/games/cldkccompetitioncart.html', icon: '🦍' },
  { id: 'cldodecadragons', name: 'Dodeca Dragons', url: '/games/cldodecadragons.html', icon: '⚔️' },
  { id: 'cldoblox', name: 'Doblox', url: '/games/cldoblox.html', icon: '🎮' },
  { id: 'cldogeminer', name: 'Doge Miner', url: '/games/cldogeminer.html', icon: '🎮' },
  { id: 'cldokidokiliteratureclub', name: 'Doki Doki Literature Club', url: '/games/cldokidokiliteratureclub.html', icon: '📚' },
  { id: 'cldomeromantik', name: 'Domeomantik', url: '/games/cldomeromantik.html', icon: '🎮' },
  { id: 'cldonkeykong', name: 'Donkey Kong', url: '/games/cldonkeykong.html', icon: '🦍' },
  { id: 'cldonkeykong64', name: 'Donkey Kong 64', url: '/games/cldonkeykong64.html', icon: '🦍' },
  { id: 'cldonkeykong94', name: 'Donkey Kong 94', url: '/games/cldonkeykong94.html', icon: '🦍' },
  { id: 'cldonkeykongcountry', name: 'Donkey Kong Country', url: '/games/cldonkeykongcountry.html', icon: '🦍' },
  { id: 'cldonkeykongcountry2', name: 'Donkey Kong Country 2', url: '/games/cldonkeykongcountry2.html', icon: '🦍' },
  { id: 'cldonkeykongcountry3', name: 'Donkey Kong Country 3', url: '/games/cldonkeykongcountry3.html', icon: '🦍' },
  { id: 'cldonkeykongnes', name: 'Donkey Kong NES', url: '/games/cldonkeykongnes.html', icon: '🦍' },
  { id: 'cldontescape', name: 'Dont Escape', url: '/games/cldontescape.html', icon: '🎮' },
  { id: 'cldontescape2', name: 'Dont Escape 2', url: '/games/cldontescape2.html', icon: '🎮' },
  { id: 'cldontescape3', name: 'Dont Escape 3', url: '/games/cldontescape3.html', icon: '🎮' },
  { id: 'cldontyoulectureme', name: "Don't You Lecture Me", url: '/games/cldontyoulectureme.html.html', icon: '🎮' },
  { id: 'cldoodlejump', name: 'Doodle Jump', url: '/games/cldoodlejump.html', icon: '🦘' },
  { id: 'cldoodlejumpgoober', name: 'Doodle Jump Goober', url: '/games/cldoodlejumpgoober.html', icon: '🦘' },
  { id: 'cldoom', name: 'Doom', url: '/games/cldoom.html', icon: '💀' },
  { id: 'cldoom2', name: 'Doom 2', url: '/games/cldoom2.html', icon: '💀' },
  { id: 'cldoom2dos', name: 'Doom 2 Dos', url: '/games/cldoom2dos.html', icon: '💀' },
  { id: 'cldoom2d', name: 'Doom 2D', url: '/games/cldoom2d.html', icon: '💀' },
  { id: 'cldoom2ddos', name: 'Doom 2D Dos', url: '/games/cldoom2dDOS.html', icon: '💀' },
  { id: 'cldoom3pack', name: 'Doom 3 Pack', url: '/games/cldoom3pack.html', icon: '💀' },
  { id: 'cldoom64', name: 'Doom 64', url: '/games/cldoom64.html', icon: '💀' },
  { id: 'cldoomemscripten', name: 'Doom Emscripten', url: '/games/cldoomemscripten.html', icon: '💀' },
  { id: 'cldoomps', name: 'Doomps', url: '/games/cldoomps.html', icon: '💀' },
  { id: 'cldoomzio', name: 'Doomzio', url: '/games/cldoomzio.html', icon: '💀' },
  { id: 'cldoorscastle', name: 'Doors Castle', url: '/games/cldoorscastle.html', icon: '⚔️' },
  { id: 'cldoswasmx', name: 'DOSwasmx', url: '/games/cldoswasmx.html', icon: '🎮' },
  { id: 'cldoubledribble', name: 'Double Dribble', url: '/games/cldoubledribble.html', icon: '🎮' },
  { id: 'cldouchebaglife', name: 'Douchebag Life', url: '/games/cldouchebaglife.html', icon: '🎮' },
  { id: 'cldouchebagworkout2', name: 'Douchebag Workout 2', url: '/games/cldouchebagworkout2.html', icon: '🎮' },
  { id: 'cldownthemountain', name: 'Down the Mountain', url: '/games/cldownthemountain.html', icon: '🎮' },
  { id: 'cldrweedgaster', name: 'Dr. Weedgaster', url: '/games/cldrweedgaster.html', icon: '🎮' },
  { id: 'cldragonquest5ds', name: 'Dragon Quest 5 DS', url: '/games/cldragonquest5ds.html', icon: '⚔️' },
  { id: 'cldragonwarriormonsters', name: 'Dragon Warrior Monsters', url: '/games/cldragonwarriormonsters.html', icon: '⚔️' },
  { id: 'cldragonballadvance', name: 'Dragonball Advance', url: '/games/cldragonballadvance.html', icon: '🏀' },
  { id: 'cldrawclimber', name: 'Draw Climber', url: '/games/cldrawclimber.html', icon: '🎮' },
  { id: 'cldrawtheline', name: 'Draw the Line', url: '/games/cldrawtheline.html', icon: '🎮' },
  { id: 'cldrawntolife', name: 'Drawn to Life', url: '/games/cldrawntolife.html', icon: '🎮' },
  { id: 'cldrawntolife2', name: 'Drawn to Life 2', url: '/games/cldrawntolife2.html', icon: '🎮' },
  { id: 'cldreadheadparkour', name: 'Dread Head Parkour', url: '/games/cldreadheadparkour.html', icon: '🏃' },
  { id: 'cldreader', name: 'Dreader', url: '/games/cldreader.html', icon: '🎮' },
  { id: 'cldriftboss', name: 'Drift Boss', url: '/games/cldriftboss.html', icon: '🎮' },
  { id: 'cldriftsimulator', name: 'Drift Simulator', url: '/games/cldriftsimulator.html', icon: '🎮' },
  { id: 'drive-mad', name: 'Drive Mad', url: '/games/Drive%20Mad%20(1).html', icon: '🚗' },
  { id: 'cldrivemady', name: 'Drive Mad Y', url: '/games/cldrivemady.html', icon: '🚗' },
  { id: 'cldriverussia', name: 'Drive Russia', url: '/games/cldriverussia.html', icon: '🏎️' },
  { id: 'cldrivenwild', name: 'Driven Wild', url: '/games/cldrivenwild.html', icon: '🎮' },
  { id: 'cldrmario', name: 'Dr. Mario', url: '/games/cldrmario.html', icon: '🍄' },
  { id: 'dta6', name: 'DTA 6', url: '/games/dta6.html', icon: '🎮' },
  { id: 'cldubstep', name: 'Dubstep', url: '/games/cldubstep.html', icon: '🎧' },
  { id: 'clduckhunt', name: 'Duck Hunt', url: '/games/clduckhunt.html', icon: '🦆' },
  { id: 'clducklfe5', name: 'Duck Life 5', url: '/games/clducklfe5.html', icon: '🎮' },
  { id: 'clducklife', name: 'Duck Life', url: '/games/clducklife.html', icon: '🐥' },
  { id: 'clducklife2', name: 'Duck Life 2', url: '/games/clducklife2.html', icon: '🐥' },
  { id: 'clducklife3', name: 'Duck Life 3', url: '/games/clducklife3.html', icon: '🐥' },
  { id: 'clducklife4', name: 'Duck Life 4', url: '/games/clducklife4.html', icon: '🐥' },
  { id: 'clducklifebattle', name: 'Duck Life Battle', url: '/games/clducklifebattle.html', icon: '🐥' },
  { id: 'clducklifespace', name: 'Duck Life Space', url: '/games/clducklifespace.html', icon: '🐥' },
  { id: 'clducklingsio', name: 'Ducklings IO', url: '/games/clducklingsio.html', icon: '🐣' },
  { id: 'clducktales', name: 'Ducktales', url: '/games/clducktales.html', icon: '🦆' },
  { id: 'clducktales2', name: 'Ducktales 2', url: '/games/clducktales2.html', icon: '🦆' },
  { id: 'cldud', name: 'Dud', url: '/games/cldud.html', icon: '🎮' },
  { id: 'cldukenukem2', name: 'Duke Nukem 2', url: '/games/cldukenukem2.html', icon: '🎮' },
  { id: 'cldukenukem3d', name: 'Duke Nukem 3D', url: '/games/cldukenukem3d.html', icon: '🎮' },
  { id: 'cldumbwaystodie', name: 'Dumb Ways to Die', url: '/games/cldumbwaystodie.html', icon: '🎮' },
  { id: 'cldumpling', name: 'Dumpling', url: '/games/cldumpling.html', icon: '🎮' },
  { id: 'cldunebuggy', name: 'Dune Buggy', url: '/games/cldunebuggy.html', icon: '🎮' },
  { id: 'cldunedash', name: 'Dune Dash', url: '/games/cldunedash.html', icon: '🎮' },
  { id: 'cldungeondeck', name: 'Dungeon Deck', url: '/games/cldungeondeck.html', icon: '🎴' },
  { id: 'cldungeonraid', name: 'Dungeon Raid', url: '/games/cldungeonraid.html', icon: '⚔️' },
  { id: 'cldungeonsanddegenerategamblers', name: 'Dungeons and Degenerate Gamblers', url: '/games/cldungeonsanddegenerategamblers.html', icon: '⚔️' },
  { id: 'cldunkshot', name: 'Dunk Shot', url: '/games/cldunkshot.html', icon: '🏀' },
  { id: 'clduskchild', name: 'Dusk Child', url: '/games/clduskchild.html', icon: '🎮' },
  { id: 'cldyingdreams', name: 'Dying Dreams', url: '/games/cldyingdreams.html', icon: '🎮' },
  { id: 'cldynamiteheaddy', name: 'Dynamite He Addy', url: '/games/cldynamiteheaddy.html', icon: '🎮' },
  { id: 'cleaglercraft152', name: 'Eagle Rcraft 152', url: '/games/cleaglercraft152.html', icon: '⛏️' },
  { id: 'cleaglercraftlite', name: 'Eagle Rcraft Lite', url: '/games/cleaglercraftlite.html', icon: '⛏️' },
  { id: 'cleaglercraftmagic', name: 'Eagle Rcraft Magic', url: '/games/cleaglercraftmagic.html', icon: '⛏️' },
  { id: 'cleaglercraftnebula', name: 'Eagle Rcraft Nebula', url: '/games/cleaglercraftnebula.html', icon: '⛏️' },
  { id: 'cleaglercraftshadow', name: 'Eagle Rcraft Shadow', url: '/games/cleaglercraftshadow.html', icon: '⛏️' },
  { id: 'cleaglercraftsky', name: 'Eagle Rcraft Sky', url: '/games/cleaglercraftsky.html', icon: '⛏️' },
  { id: 'cleaglerforge', name: 'Eagle Rforge', url: '/games/cleaglerforge.html', icon: '🎮' },
  { id: 'cleagleride', name: 'Eagle Ride', url: '/games/cleagleride.html', icon: '🎮' },
  { id: 'eaglercraft-indev-offline--1', name: 'Eaglercraft Indev Offline', url: '/games/Eaglercraft-Indev-Offline%20(1).html', icon: '⛏️' },
  { id: 'clearntodie', name: 'Earn to Die', url: '/games/clearntodie.html', icon: '🎮' },
  { id: 'clearntodie2', name: 'Earn to Die 2', url: '/games/clearntodie2.html', icon: '🎮' },
  { id: 'clearthtaken', name: 'Earth Taken', url: '/games/clearthtaken.html', icon: '🎮' },
  { id: 'clearthtaken2', name: 'Earth Taken 2', url: '/games/clearthtaken2.html', icon: '🎮' },
  { id: 'clearthtaken3', name: 'Earth Taken 3', url: '/games/clearthtaken3.html', icon: '🎮' },
  { id: 'clearthbound', name: 'Earthbound', url: '/games/clearthbound.html', icon: '🎮' },
  { id: 'clearthbound3', name: 'Earthbound 3', url: '/games/clearthbound3.html', icon: '🎮' },
  { id: 'clearthboundsnes', name: 'Earthbound SNES', url: '/games/clearthboundsnes.html', icon: '🎮' },
  { id: 'clearthwormgg', name: 'Earthworm Gg', url: '/games/clearthwormgg.html', icon: '🎮' },
  { id: 'clearthwormjim--1', name: 'Earthworm Jim', url: '/games/clearthwormjim%20(1).html', icon: '🎮' },
  { id: 'clearthwormjim2--1', name: 'Earthworm Jim 2', url: '/games/clearthwormjim2%20(1).html', icon: '🎮' },
  { id: 'eb-client-v1-0-0r2-wasm', name: 'Eb.client.v 1.0.0 R 2.wasm', url: '/games/EB.Client.V1.0.0R2.WASM.html', icon: '🎮' },
  { id: 'cleccothedolphin', name: 'Ecco the Dolphin', url: '/games/cleccothedolphin.html', icon: '🐟' },
  { id: 'cledelweiss', name: 'Edelweiss', url: '/games/cledelweiss.html', icon: '🎮' },
  { id: 'cleffinghail', name: 'Eff Ing Hail', url: '/games/cleffinghail.html', icon: '🎮' },
  { id: 'cleffingmachines', name: 'Eff Ing Machines', url: '/games/cleffingmachines.html', icon: '🎮' },
  { id: 'cleffingworms', name: 'Eff Ing Worms', url: '/games/cleffingworms.html', icon: '🎮' },
  { id: 'cleffingzombies', name: 'Eff Ing Zombies', url: '/games/cleffingzombies.html', icon: '🧟' },
  { id: 'clegg', name: 'Egg', url: '/games/clegg.html', icon: '🎮' },
  { id: 'cleggycar', name: 'Eggycar', url: '/games/cleggycar.html', icon: '🎮' },
  { id: 'clelasticface', name: 'Elastic Face', url: '/games/clelasticface.html', icon: '🎮' },
  { id: 'clelectricman2', name: 'Electric Man 2', url: '/games/clelectricman2.html', icon: '🎮' },
  { id: 'clelevatoraction', name: 'Elevator Action', url: '/games/clelevatoraction.html', icon: '🎮' },
  { id: 'clelytraflight', name: 'Elytra Flight', url: '/games/clelytraflight.html', icon: '✈️' },
  { id: 'clemujs', name: 'Emujs', url: '/games/clemujs.html', icon: '🎮' },
  { id: 'clenchain', name: 'Enchain', url: '/games/clenchain.html', icon: '🎮' },
  { id: 'clendacopia', name: 'End Aco Pia', url: '/games/clendacopia.html', icon: '🎮' },
  { id: 'clendlesswar4', name: 'Endless War 4', url: '/games/clendlesswar4.html', icon: '🪖' },
  { id: 'clendlesswar5', name: 'Endless War 5', url: '/games/clendlesswar5.html', icon: '🪖' },
  { id: 'clendlesswar5wow', name: 'Endless War 5 Wow', url: '/games/clendlesswar5wow.html', icon: '🪖' },
  { id: 'clendlesswar7', name: 'Endless War 7', url: '/games/clendlesswar7.html', icon: '🪖' },
  { id: 'clenduro', name: 'Enduro', url: '/games/clenduro.html', icon: '🎮' },
  { id: 'clepicbattlefantasy5', name: 'Epic Battle Fantasy 5', url: '/games/clepicbattlefantasy5.html', icon: '🎮' },
  { id: 'clescalatingduel', name: 'Escalating Duel', url: '/games/clescalatingduel.html', icon: '🎮' },
  { id: 'clescaperoad', name: 'Escape Road', url: '/games/clescaperoad.html', icon: '🎮' },
  { id: 'clescaperoad3', name: 'Escape Road 3', url: '/games/clescaperoad3.html', icon: '🎮' },
  { id: 'clescaperoadcity2', name: 'Escape Road City 2', url: '/games/clescaperoadcity2.html', icon: '🎮' },
  { id: 'clescapeschoolduel', name: 'Escape School Duel', url: '/games/clescapeschoolduel.html', icon: '🎮' },
  { id: 'clet', name: 'Et', url: '/games/clet.html', icon: '🎮' },
  { id: 'cletrianoddyssey', name: 'Etria Noddy Ssey', url: '/games/cletrianoddyssey.html', icon: '🎮' },
  { id: 'cleugeneslife', name: 'Eugene Slife', url: '/games/cleugeneslife.html', icon: '🎮' },
  { id: 'cleurovisionsim', name: 'Eurovision Sim', url: '/games/cleurovisionsim.html', icon: '🎮' },
  { id: 'clevilglitch', name: 'Evil Glitch', url: '/games/clevilglitch.html', icon: '🎮' },
  { id: 'clevolution', name: 'Evolution', url: '/games/clevolution.html', icon: '🎮' },
  { id: 'clexcitebike', name: 'Excitebike', url: '/games/clexcitebike.html', icon: '🏎️' },
  { id: 'clexcitebike64', name: 'Excitebike 64', url: '/games/clexcitebike64.html', icon: '🏎️' },
  { id: 'clexitpath', name: 'Exit Path', url: '/games/clexitpath.html', icon: '🎮' },
  { id: 'clexoobservation', name: 'Exo Observation', url: '/games/clexoobservation.html', icon: '🎮' },
  { id: 'clextremerun3d', name: 'Extreme Run 3D', url: '/games/clextremerun3d.html', icon: '🎮' },
  { id: 'clfamidash', name: 'Fa Mid Ash', url: '/games/clfamidash.html', icon: '🎮' },
  { id: 'clfactoryballs', name: 'Factory Balls', url: '/games/clfactoryballs.html', icon: '🎮' },
  { id: 'clfactoryballs2', name: 'Factory Balls 2', url: '/games/clfactoryballs2.html', icon: '🎮' },
  { id: 'clfactoryballs3', name: 'Factory Balls 3', url: '/games/clfactoryballs3.html', icon: '🎮' },
  { id: 'clfactoryballs4', name: 'Factory Balls 4', url: '/games/clfactoryballs4.html', icon: '🎮' },
  { id: 'clfairytalevsonepiece', name: 'Fairytale vs One Piece', url: '/games/clfairytalevsonepiece.html', icon: '✈️' },
  { id: 'clfallguys', name: 'Fall Guys', url: '/games/clfallguys.html', icon: '🎮' },
  { id: 'clfallout', name: 'Fallout', url: '/games/clfallout.html', icon: '🎮' },
  { id: 'clfamidash1-2-8', name: 'Famidash 1.2.8', url: '/games/clfamidash1.2.8.html', icon: '🎮' },
  { id: 'clfamidashalbum1-2-8', name: 'Famidash Album 1.2.8', url: '/games/clfamidashAlbum1.2.8.html', icon: '🎮' },
  { id: 'clfamidashbsides1-2-8', name: 'Famidash B Sides 1.2.8', url: '/games/clfamidashBSides1.2.8.html', icon: '🎮' },
  { id: 'clfamidashcsides1-2-8', name: 'Famidash C Sides 1.2.8', url: '/games/clfamidashCSides1.2.8.html', icon: '🎮' },
  { id: 'clfamidashdsides1-2-8', name: 'Famidash D Sides 1.2.8', url: '/games/clfamidashDSides1.2.8.html', icon: '🎮' },
  { id: 'clfamilyguycorrupted', name: 'Family Guy Corrupted', url: '/games/clfamilyguycorrupted.html', icon: '🎮' },
  { id: 'clfancypantsadventure', name: 'Fancy Pants Adventure', url: '/games/clfancypantsadventure.html', icon: '🎮' },
  { id: 'clfancypantsadventure2', name: 'Fancy Pants Adventure 2', url: '/games/clfancypantsadventure2.html', icon: '🎮' },
  { id: 'clfancypantsadventure3', name: 'Fancy Pants Adventure 3', url: '/games/clfancypantsadventure3.html', icon: '🎮' },
  { id: 'clfancysnowboarding', name: 'Fancy Snowboarding', url: '/games/clfancysnowboarding.html', icon: '🏂' },
  { id: 'clfantasyzone', name: 'Fantasy Zone', url: '/games/clfantasyzone.html', icon: '🎮' },
  { id: 'clfashionbattle', name: 'Fashion Battle', url: '/games/clfashionbattle.html', icon: '🏀' },
  { id: 'clfattygenius', name: 'Fatty Genius', url: '/games/clfattygenius.html', icon: '🎮' },
  { id: 'clfearassessment', name: 'Fear Assessment', url: '/games/clfearassessment.html', icon: '🎮' },
  { id: 'clfearstofathomhomealone', name: 'Fears to Fathom Home Alone', url: '/games/clfearstofathomhomealone.html', icon: '🎮' },
  { id: 'clfeedthevoid', name: 'Feed the Void', url: '/games/clfeedthevoid.html', icon: '🎮' },
  { id: 'clfeedus', name: 'Feedus', url: '/games/clfeedus.html', icon: '🎮' },
  { id: 'clfeedus2', name: 'Feedus 2', url: '/games/clfeedus2.html', icon: '🎮' },
  { id: 'clfeedus3', name: 'Feedus 3', url: '/games/clfeedus3.html', icon: '🎮' },
  { id: 'clfeedus5', name: 'Feedus 5', url: '/games/clfeedus5.html', icon: '🎮' },
  { id: 'clff2ws', name: 'Ff 2 Ws', url: '/games/clff2ws.html', icon: '🎮' },
  { id: 'clff6', name: 'Ff 6', url: '/games/clff6.html', icon: '🎮' },
  { id: 'clffmysticquest', name: 'Ff Mystic Quest', url: '/games/clffmysticquest.html', icon: '⚔️' },
  { id: 'clffsonic1', name: 'FF Sonic 1', url: '/games/clFFsonic1.html', icon: '💨' },
  { id: 'clffaf', name: 'Ffaf', url: '/games/clffaf.html', icon: '🎮' },
  { id: 'clfifa07', name: 'FIFA 07', url: '/games/clFIFA07.html', icon: '⚽' },
  { id: 'clfifa10', name: 'FIFA 10', url: '/games/clFIFA10.html', icon: '⚽' },
  { id: 'clfifa11', name: 'FIFA 11', url: '/games/clFIFA11.html', icon: '⚽' },
  { id: 'clfifa2000', name: 'Fifa 2000', url: '/games/clfifa2000.html', icon: '⚽' },
  { id: 'clfinalearth2', name: 'Final Earth 2', url: '/games/clfinalearth2.html', icon: '🎮' },
  { id: 'clfinalfantasy', name: 'Final Fantasy', url: '/games/clfinalfantasy.html', icon: '🎮' },
  { id: 'clfinalfantasy2nes', name: 'Final Fantasy 2 NES', url: '/games/clfinalfantasy2nes.html', icon: '🎮' },
  { id: 'clfinalfantasy3nes', name: 'Final Fantasy 3 NES', url: '/games/clfinalfantasy3nes.html', icon: '🎮' },
  { id: 'clff3', name: 'Final Fantasy III', url: '/games/clFF3.html', icon: '⚔️' },
  { id: 'clfinalfantasylegend2', name: 'Final Fantasy Legend 2', url: '/games/clfinalfantasylegend2.html', icon: '⚔️' },
  { id: 'clfinalninja', name: 'Final Ninja', url: '/games/clfinalninja.html', icon: '🎮' },
  { id: 'clfinalfantasyii', name: 'Finalfantasy II', url: '/games/clfinalfantasyII.html', icon: '🎮' },
  { id: 'clfinalfantasyix', name: 'Finalfantasy IX', url: '/games/clfinalfantasyIX.html', icon: '🎮' },
  { id: 'clfinalfantasyvi', name: 'Finalfantasy VI', url: '/games/clfinalfantasyVI.html', icon: '🎮' },
  { id: 'clfinalfantasyviid2', name: 'Finalfantasy VI Id 2', url: '/games/clfinalfantasyVIId2.html', icon: '🎮' },
  { id: 'clfinalfantasyviid3', name: 'Finalfantasy VI Id 3', url: '/games/clfinalfantasyVIId3.html', icon: '🎮' },
  { id: 'clfinalfantasyvii', name: 'Finalfantasy VII', url: '/games/clfinalfantasyVII.html', icon: '🎮' },
  { id: 'clfindthealien', name: 'Find the Alien', url: '/games/clfindthealien.html', icon: '🌌' },
  { id: 'clfireblob', name: 'Fire Blob', url: '/games/clfireblob.html', icon: '🎮' },
  { id: 'clfireboyandwatergirl', name: 'Fire Boy and Water Girl', url: '/games/clfireboyandwatergirl.html', icon: '🔫' },
  { id: 'clfireboyandwatergirl2', name: 'Fire Boy and Water Girl 2', url: '/games/clfireboyandwatergirl2.html', icon: '🔫' },
  { id: 'clfireboyandwatergirl3', name: 'Fire Boy and Water Girl 3', url: '/games/clfireboyandwatergirl3.html', icon: '🔫' },
  { id: 'clfireboyandwatergirl5', name: 'Fire Boy and Water Girl 5', url: '/games/clfireboyandwatergirl5.html', icon: '🔫' },
  { id: 'clfireboyandwatergirl6', name: 'Fire Boy and Water Girl 6', url: '/games/clfireboyandwatergirl6.html', icon: '🔫' },
  { id: 'clfireemblem', name: 'Fire Emblem', url: '/games/clfireemblem.html', icon: '🎮' },
  { id: 'clfisquarium', name: 'Fis Qua Rium', url: '/games/clfisquarium.html', icon: '🎮' },
  { id: 'clfisheatgettingbig', name: 'Fish Eat Getting Big', url: '/games/clfisheatgettingbig.html', icon: '🐟' },
  { id: 'clfivenightsatbaldisredone', name: 'Five Nights at Bald Is Redone', url: '/games/clfivenightsatbaldisredone.html', icon: '🎮' },
  { id: 'clfivenightsatepsteins', name: 'Five Nights at Epstein S', url: '/games/clfivenightsatepsteins.html', icon: '🎮' },
  { id: 'clfnaf', name: 'Five Nights at Freddy\\\'s', url: '/games/clFNAF.html', icon: '🧟' },
  { id: 'clfnaf2', name: 'Five Nights at Freddy\\\'s 2', url: '/games/clFNAF2.html', icon: '🧟' },
  { id: 'clfnaf3', name: 'Five Nights at Freddy\\\'s 3', url: '/games/clFNAF3.html', icon: '🧟' },
  { id: 'clfnaf4', name: 'Five Nights at Freddy\\\'s 4', url: '/games/clFNAF4.html', icon: '🧟' },
  { id: 'clfivenightsatshreks', name: 'Five Nights at Shrek S', url: '/games/clfivenightsatshreks.html', icon: '🎮' },
  { id: 'clfivenightsatshrekshotel', name: 'Five Nights at Shrek Shotel', url: '/games/clfivenightsatshrekshotel.html', icon: '🎮' },
  { id: 'clfivenightsatyoshis', name: 'Five Nights at Yoshis', url: '/games/clfivenightsatyoshis.html', icon: '🍄' },
  { id: 'clflappybird', name: 'Flap Py Bird', url: '/games/clflappybird.html', icon: '🐦' },
  { id: 'clflashsonic', name: 'Flash Sonic', url: '/games/clflashsonic.html', icon: '💨' },
  { id: 'clfloodrunner', name: 'Flood Runner', url: '/games/clfloodrunner.html', icon: '🏃' },
  { id: 'clfloodrunner2', name: 'Flood Runner 2', url: '/games/clfloodrunner2.html', icon: '🏃' },
  { id: 'clfloodrunner4', name: 'Flood Runner 4', url: '/games/clfloodrunner4.html', icon: '🏃' },
  { id: 'clfluidism', name: 'Fluid Is M', url: '/games/clfluidism.html', icon: '🎮' },
  { id: 'clfnfaethos', name: 'FNF: A Ethos', url: '/games/clfnfaethos.html', icon: '🎮' },
  { id: 'clfnfagoti', name: 'Fn Fagot I', url: '/games/clfnfagoti.html', icon: '🎮' },
  { id: 'clfnfakage', name: 'Fn Faka Ge', url: '/games/clfnfakage.html', icon: '🎮' },
  { id: 'clfnfannie', name: 'Fn Fannie', url: '/games/clfnfannie.html', icon: '🎮' },
  { id: 'clfnfbside', name: 'FNF: B-Side', url: '/games/clfnfbside.html', icon: '🎮' },
  { id: 'clfnfdsides', name: 'FNF: D-Sides', url: '/games/clfnfdsides.html', icon: '🎮' },
  { id: 'clfnffnaf1', name: 'FNF: FNAF 1', url: '/games/clfnffnaf1.html', icon: '🧟' },
  { id: 'clfnffnaf2', name: 'FNF: FNAF 2', url: '/games/clfnffnaf2.html', icon: '🧟' },
  { id: 'clfnffnaf3', name: 'FNF: FNAF 3', url: '/games/clfnffnaf3.html', icon: '🧟' },
  { id: 'clfnffnatpt', name: 'FNF: FNAF Pt', url: '/games/clfnffnatpt.html', icon: '🎮' },
  { id: 'clfnfhorkglorpgloop', name: 'FNF: Horkglo RPG Loop', url: '/games/clfnfhorkglorpgloop.html', icon: '⚔️' },
  { id: 'clfnfmcmadness', name: 'FNF: MC Madness', url: '/games/clfnfmcmadness.html', icon: '🎮' },
  { id: 'clfnac1', name: 'Fnac 1', url: '/games/clfnac1.html', icon: '🎮' },
  { id: 'clfnac2', name: 'Fnac 2', url: '/games/clfnac2.html', icon: '🎮' },
  { id: 'clfnaf3remastered', name: 'Fnaf 3 Remastered', url: '/games/clfnaf3remastered.html', icon: '🧟' },
  { id: 'clfnaf4halloween', name: 'Fnaf 4 Halloween', url: '/games/clfnaf4halloween.html', icon: '🧟' },
  { id: 'clfnafanimatronics', name: 'Fnaf Animatronics', url: '/games/clfnafanimatronics.html', icon: '🧟' },
  { id: 'clfnafshooter', name: 'Fnaf Shooter', url: '/games/clfnafshooter.html', icon: '🧟' },
  { id: 'clfnafworldd', name: 'Fnaf World D', url: '/games/clfnafworldd.html', icon: '🧟' },
  { id: 'clfnafps', name: 'Fnafps', url: '/games/clfnafps.html', icon: '🧟' },
  { id: 'clfnafsl', name: 'Fnafsl', url: '/games/clfnafsl.html', icon: '🧟' },
  { id: 'clfnafucn', name: 'Fnafucn', url: '/games/clfnafucn.html', icon: '🧟' },
  { id: 'clfnaw', name: 'Fnaw', url: '/games/clfnaw.html', icon: '🎮' },
  { id: 'clfnfanimation', name: 'Fnf Animation', url: '/games/clfnfanimation.html', icon: '🎮' },
  { id: 'clfnfbelowdepths', name: 'Fnf Below Depths', url: '/games/clfnfbelowdepths.html', icon: '🎮' },
  { id: 'clfnfbfdi26', name: 'Fnf Bfd I 26', url: '/games/clfnfbfdi26.html', icon: '🎮' },
  { id: 'clfnfbinarybreakdown', name: 'Fnf Binary Breakdown', url: '/games/clfnfbinarybreakdown.html', icon: '🎮' },
  { id: 'clfnfblackbetrayal', name: 'Fnf Black Betrayal', url: '/games/clfnfblackbetrayal.html', icon: '🎮' },
  { id: 'clfnfcamelliarudeblaster', name: 'Fnf Camellia Rude Blaster', url: '/games/clfnfcamelliarudeblaster.html', icon: '🎮' },
  { id: 'clfnfcandycarrier', name: 'Fnf Candy Carrier', url: '/games/clfnfcandycarrier.html', icon: '🎮' },
  { id: 'clfnfcitytales', name: 'Fnf City Tales', url: '/games/clfnfcitytales.html', icon: '🎮' },
  { id: 'clfnfclassified', name: 'Fnf Classified', url: '/games/clfnfclassified.html', icon: '🎮' },
  { id: 'clfnfcorrosion', name: 'Fnf Corrosion', url: '/games/clfnfcorrosion.html', icon: '🎮' },
  { id: 'clfnfcrunchin', name: 'Fnf Crunch in', url: '/games/clfnfcrunchin.html', icon: '🎮' },
  { id: 'clfnfdeciever', name: 'Fnf Dec Iever', url: '/games/clfnfdeciever.html', icon: '🎮' },
  { id: 'clfnfdesolation', name: 'Fnf Desolation', url: '/games/clfnfdesolation.html', icon: '🎮' },
  { id: 'clfnfdokitakeoverplus', name: 'Fnf Doki Takeover Plus', url: '/games/clfnfdokitakeoverplus.html', icon: '🎮' },
  { id: 'clfnfdropandroll', name: 'Fnf Drop and Roll', url: '/games/clfnfdropandroll.html', icon: '🎮' },
  { id: 'clfnfdusttale', name: 'Fnf Dust Tale', url: '/games/clfnfdusttale.html', icon: '🎮' },
  { id: 'clfnfdustin', name: 'Fnf Dustin', url: '/games/clfnfdustin.html', icon: '🎮' },
  { id: 'clfnffleetway', name: 'Fnf Fleet Way', url: '/games/clfnffleetway.html', icon: '🎮' },
  { id: 'clfnfflippedout', name: 'Fnf Flipped Out', url: '/games/clfnfflippedout.html', icon: '🎮' },
  { id: 'clfnfgamebreakerbundle', name: 'Fnf Game Breaker Bundle', url: '/games/clfnfgamebreakerbundle.html', icon: '🎮' },
  { id: 'clfnfgodot', name: 'Fnf Godot', url: '/games/clfnfgodot.html', icon: '🎮' },
  { id: 'clfnfgoldenapple', name: 'Fnf Golden Apple', url: '/games/clfnfgoldenapple.html', icon: '🎮' },
  { id: 'clfnfheartbreakhavoc', name: 'Fnf Heartbreak Havoc', url: '/games/clfnfheartbreakhavoc.html', icon: '🎮' },
  { id: 'clfnfherobrine', name: 'Fnf Hero Brine', url: '/games/clfnfherobrine.html', icon: '🎮' },
  { id: 'clfnfholiday', name: 'Fnf Holiday', url: '/games/clfnfholiday.html', icon: '🎮' },
  { id: 'clfnfhotline', name: 'Fnf Hotline', url: '/games/clfnfhotline.html', icon: '🎮' },
  { id: 'clfnfhypnoslullaby', name: 'Fnf Hypnos Lullaby', url: '/games/clfnfhypnoslullaby.html', icon: '🎮' },
  { id: 'clfnfimposter3', name: 'Fnf Imposter 3', url: '/games/clfnfimposter3.html', icon: '🎮' },
  { id: 'clfnfimposterv4', name: 'Fnf Imposter V4', url: '/games/clfnfimposterv4.html', icon: '🎮' },
  { id: 'clfnfindiecross', name: 'Fnf Indie Cross', url: '/games/clfnfindiecross.html', icon: '🎮' },
  { id: 'clfnfinfernalbout', name: 'Fnf Infernal Bout', url: '/games/clfnfinfernalbout.html', icon: '🎮' },
  { id: 'clfnfinfiniteirida', name: 'Fnf Infinite Irida', url: '/games/clfnfinfiniteirida.html', icon: '🎮' },
  { id: 'clfnfironlung', name: 'Fnf Iron Lung', url: '/games/clfnfironlung.html', icon: '🎮' },
  { id: 'clfnfjapcreepypasta', name: 'Fnf Jap Creepy Pasta', url: '/games/clfnfjapcreepypasta.html', icon: '🧟' },
  { id: 'clfnfmadnesspoop', name: 'Fnf Madness Poop', url: '/games/clfnfmadnesspoop.html', icon: '🎮' },
  { id: 'clfnfmaginagematches', name: 'Fnf Mag in Age Matches', url: '/games/clfnfmaginagematches.html', icon: '🧩' },
  { id: 'clfnfmariomadnessdside', name: 'Fnf Mario Madness Dside', url: '/games/clfnfmariomadnessdside.html', icon: '🍄' },
  { id: 'clfnfmarioport', name: 'Fnf Mario Port', url: '/games/clfnfmarioport.html', icon: '🍄' },
  { id: 'clfnfmidfight', name: 'Fnf Mid Fight', url: '/games/clfnfmidfight.html', icon: '🎮' },
  { id: 'clfnfmobmod', name: 'Fnf Mob Mod', url: '/games/clfnfmobmod.html', icon: '🎮' },
  { id: 'clfnfpiggyfield', name: 'Fnf Piggy Field', url: '/games/clfnfpiggyfield.html', icon: '🎮' },
  { id: 'clfnfplutoshi', name: 'Fnf Pluto Shi', url: '/games/clfnfplutoshi.html', icon: '🎮' },
  { id: 'clfnfpokepastaperdition', name: 'Fnf Poke Pasta Perdition', url: '/games/clfnfpokepastaperdition.html', icon: '🐾' },
  { id: 'clfnfporifera', name: 'Fnf Porifera', url: '/games/clfnfporifera.html', icon: '🎮' },
  { id: 'clfnfremnants', name: 'Fnf Remnants', url: '/games/clfnfremnants.html', icon: '🎮' },
  { id: 'clfnfretrospecter', name: 'Fnf Retrospect Er', url: '/games/clfnfretrospecter.html', icon: '🎮' },
  { id: 'clfnfrevmixed', name: 'Fnf Rev Mixed', url: '/games/clfnfrevmixed.html', icon: '🎮' },
  { id: 'clfnfrewrite', name: 'Fnf Rewrite', url: '/games/clfnfrewrite.html', icon: '🎮' },
  { id: 'clfnfrhythmicrev', name: 'Fnf Rhythmic Rev', url: '/games/clfnfrhythmicrev.html', icon: '🎵' },
  { id: 'clfnfrottensmoothie', name: 'Fnf Rotten Smoothie', url: '/games/clfnfrottensmoothie.html', icon: '🎮' },
  { id: 'clfnfselfpaced', name: 'Fnf Self Paced', url: '/games/clfnfselfpaced.html', icon: '🏎️' },
  { id: 'clfnfshaggyxmatt', name: 'Fnf Shaggy Xmatt', url: '/games/clfnfshaggyxmatt.html', icon: '🏎️' },
  { id: 'clfnfsohv2', name: 'FNF: SOHV 2', url: '/games/clfnfsohv2.html', icon: '🏎️' },
  { id: 'clfnfsonicexe', name: 'Fnf Sonic Exe', url: '/games/clfnfsonicexe.html', icon: '💨' },
  { id: 'clfnfsonicexe4', name: 'Fnf Sonic Exe 4', url: '/games/clfnfsonicexe4.html', icon: '💨' },
  { id: 'clfnfstarlightmayhem', name: 'Fnf Starlight Mayhem', url: '/games/clfnfstarlightmayhem.html', icon: '🏎️' },
  { id: 'clfnftailsgetstrolled', name: 'Fnf Tails Get Strolled', url: '/games/clfnftailsgetstrolled.html', icon: '💨' },
  { id: 'clfnftooslowfran', name: 'Fnf Too Slow Fran', url: '/games/clfnftooslowfran.html', icon: '🎮' },
  { id: 'clfnftricky', name: 'Fnf Tricky', url: '/games/clfnftricky.html', icon: '🎮' },
  { id: 'clfnftwiddlefinger', name: 'Fnf Twiddlefinger', url: '/games/clfnfTWIDDLEFINGER.html', icon: '🎮' },
  { id: 'clfnfundertale', name: 'Fnf Under Tale', url: '/games/clfnfundertale.html', icon: '🎮' },
  { id: 'clfnfvstabi', name: 'Fnf vs Tabi', url: '/games/clfnfvstabi.html', icon: '🎮' },
  { id: 'clfnfwhitty', name: 'Fnf Whit Ty', url: '/games/clfnfwhitty.html', icon: '🎮' },
  { id: 'clfnfzardy', name: 'Fnf Zard Y', url: '/games/clfnfzardy.html', icon: '🎮' },
  { id: 'clfnfasdf', name: 'Fnfasdf', url: '/games/clfnfasdf.html', icon: '🎮' },
  { id: 'clfnfchara', name: 'Fnfc Hara', url: '/games/clfnfchara.html', icon: '🎮' },
  { id: 'clfnfcory', name: 'Fnfcory', url: '/games/clfnfcory.html', icon: '🎮' },
  { id: 'clfnfdocumic-txtv3', name: 'Fnfdocumic.txtv 3', url: '/games/clfnfdocumic.txtv3.html', icon: '🎮' },
  { id: 'clfnfgfmode', name: 'Fnfg Fmode', url: '/games/clfnfgfmode.html', icon: '🎮' },
  { id: 'clfnfhank', name: 'Fnfhank', url: '/games/clfnfhank.html', icon: '🎮' },
  { id: 'clfnfhex', name: 'Fnfhex', url: '/games/clfnfhex.html', icon: '🎮' },
  { id: 'clfnfmiku', name: 'Fnfmiku', url: '/games/clfnfmiku.html', icon: '🎮' },
  { id: 'clfnfneo', name: 'Fnfneo', url: '/games/clfnfneo.html', icon: '🎮' },
  { id: 'clfnfqt', name: 'Fnfqt', url: '/games/clfnfqt.html', icon: '🎮' },
  { id: 'clfnfstridentcrisis', name: 'Fnfs Trident Crisis', url: '/games/clfnfstridentcrisis.html', icon: '🏎️' },
  { id: 'clfnfshucks-v2', name: 'Fnfshucks V2', url: '/games/clfnfshucks-v2.html', icon: '🏎️' },
  { id: 'clfnfsky', name: 'Fnfsky', url: '/games/clfnfsky.html', icon: '🏎️' },
  { id: 'clfnfsoft', name: 'Fnfsoft', url: '/games/clfnfsoft.html', icon: '🏎️' },
  { id: 'clfnfvoid', name: 'Fnfvoid', url: '/games/clfnfvoid.html', icon: '🎮' },
  { id: 'clfnfwaltenfiles', name: 'Fnfwa Lten Files', url: '/games/clfnfwaltenfiles.html', icon: '🎮' },
  { id: 'clfnfwednesday-infedility', name: 'Fnfwednesday Infedility', url: '/games/clfnfwednesday-infedility.html', icon: '🎮' },
  { id: 'clfocus', name: 'Focus', url: '/games/clfocus.html', icon: '🎮' },
  { id: 'clfolderdungeon', name: 'Folder Dungeon', url: '/games/clfolderdungeon.html', icon: '⚔️' },
  { id: 'clfootballbros', name: 'Football Bros', url: '/games/clfootballbros.html', icon: '⚽' },
  { id: 'clfootballlegends', name: 'Football Legends', url: '/games/clfootballlegends.html', icon: '⚽' },
  { id: 'clforknsausage', name: 'For Kn Sausage', url: '/games/clforknsausage.html', icon: '🎮' },
  { id: 'clfortzone', name: 'Fort Zone', url: '/games/clfortzone.html', icon: '🎮' },
  { id: 'clfpa4p1', name: 'Fpa 4 P 1', url: '/games/clfpa4p1.html', icon: '🎮' },
  { id: 'clfpa4p2', name: 'Fpa 4 P 2', url: '/games/clfpa4p2.html', icon: '🎮' },
  { id: 'clfreegemas', name: 'Free Gem As', url: '/games/clfreegemas.html', icon: '🎮' },
  { id: 'clfreerider', name: 'Free Rider', url: '/games/clfreerider.html', icon: '🎮' },
  { id: 'clfreerider2', name: 'Free Rider 2', url: '/games/clfreerider2.html', icon: '🎮' },
  { id: 'clfreerider3', name: 'Free Rider 3', url: '/games/clfreerider3.html', icon: '🎮' },
  { id: 'clfridaynightfunkin', name: 'Friday Night Funk in', url: '/games/clfridaynightfunkin.html', icon: '🎵' },
  { id: 'friday-night-funkin', name: 'Friday Night Funkin', url: '/games/Friday%20Night%20Funkin.html', icon: '🎵' },
  { id: 'clfroggerarcade', name: 'Frogger Arcade', url: '/games/clfroggerarcade.html', icon: '🎮' },
  { id: 'clfromrusttoash', name: 'From Rust to Ash', url: '/games/clfromrusttoash.html', icon: '🎮' },
  { id: 'clfuschiax', name: 'Fu Schia X', url: '/games/clfuschiax.html', icon: '🎮' },
  { id: 'clfunkinmix', name: 'Funk in Mix', url: '/games/clfunkinmix.html', icon: '🎵' },
  { id: 'clfunnybattle', name: 'Funny Battle', url: '/games/clfunnybattle.html', icon: '🎮' },
  { id: 'clfunnybattle2', name: 'Funny Battle 2', url: '/games/clfunnybattle2.html', icon: '🎮' },
  { id: 'clfunnymadracing', name: 'Funny Mad Racing', url: '/games/clfunnymadracing.html', icon: '🏎️' },
  { id: 'clfunnyshooter2', name: 'Funny Shooter 2', url: '/games/clfunnyshooter2.html', icon: '🔫' },
  { id: 'clfunnyshooter22', name: 'Funny Shooter 22', url: '/games/clfunnyshooter22.html', icon: '🔫' },
  { id: 'clfused240', name: 'Fused 240', url: '/games/clfused240.html', icon: '🎮' },
  { id: 'clfzero', name: 'Fzero', url: '/games/clfzero.html', icon: '🎮' },
  { id: 'clfzerox', name: 'Fzerox', url: '/games/clfzerox.html', icon: '🎮' },
  { id: 'clgachaverse', name: 'Ga Cha Verse', url: '/games/clgachaverse.html', icon: '🎮' },
  { id: 'clgalaga', name: 'Galaga', url: '/games/clgalaga.html', icon: '👾' },
  { id: 'clgameandwatchcollection', name: 'Game and Watch Collection', url: '/games/clgameandwatchcollection.html', icon: '🎮' },
  { id: 'clgamewatchgallery3', name: 'Game Watch Gallery 3', url: '/games/clgamewatchgallery3.html', icon: '🎮' },
  { id: 'clgangstabean', name: 'Gangsta Bean', url: '/games/clgangstabean.html', icon: '🎮' },
  { id: 'clgangstabean2', name: 'Gangsta Bean 2', url: '/games/clgangstabean2.html', icon: '🎮' },
  { id: 'clgangsterbros', name: 'Gangster Bros', url: '/games/clgangsterbros.html', icon: '🎮' },
  { id: 'clgarcello', name: 'Gar Cello', url: '/games/clgarcello.html', icon: '🎮' },
  { id: 'clgarfcaughtinact', name: 'Gar Fcaught in Act', url: '/games/clgarfcaughtinact.html', icon: '🎮' },
  { id: 'clgdwaveover100mb', name: 'Gd Wave Over 100 Mb', url: '/games/clgdwaveover100mb.html', icon: '🎮' },
  { id: 'clgdlite', name: 'Gdlite', url: '/games/clgdlite.html', icon: '🎮' },
  { id: 'clgeneralchaos', name: 'General Chaos', url: '/games/clgeneralchaos.html', icon: '🎮' },
  { id: 'clgenericfightermaybe', name: 'Generic Fighter Maybe', url: '/games/clgenericfightermaybe.html', icon: '🥊' },
  { id: 'geometrydashlite', name: 'Geometry Dash Lite', url: '/games/geometrydashlite.html', icon: '🎮' },
  { id: 'clgeometrydashscratch', name: 'Geometry Dash Scratch', url: '/games/clgeometrydashscratch.html', icon: '🎮' },
  { id: 'clgeometrydashwave', name: 'Geometry Dash Wave', url: '/games/clGeometryDashWave.html', icon: '🎮' },
  { id: 'clgeometryvibes', name: 'Geometry Vibes', url: '/games/clgeometryvibes.html', icon: '🎮' },
  { id: 'clgeorgeandtheprinter', name: 'George and the Printer', url: '/games/clgeorgeandtheprinter.html', icon: '🎮' },
  { id: 'clgetontop', name: 'Get on Top', url: '/games/clgetontop.html', icon: '🎮' },
  { id: 'clgetyoked', name: 'Get Yoked', url: '/games/clgetyoked.html', icon: '🎮' },
  { id: 'clgetawayshootout', name: 'Getaway Shootout', url: '/games/clgetawayshootout.html', icon: '🔫' },
  { id: 'clggshinobi', name: 'Gg Shinobi', url: '/games/clggshinobi.html', icon: '🎮' },
  { id: 'clggshinobi2', name: 'Gg Shinobi 2', url: '/games/clggshinobi2.html', icon: '🎮' },
  { id: 'clghosttrick', name: 'Ghost Trick', url: '/games/clghosttrick.html', icon: '🧟' },
  { id: 'clgimmietheairpod', name: 'Gim Mie the Air Pod', url: '/games/clgimmietheairpod.html', icon: '✈️' },
  { id: 'clglfighters', name: 'Gl Fighters', url: '/games/clglfighters.html', icon: '🥊' },
  { id: 'clgladdihoppers', name: 'Glad Di Hoppers', url: '/games/clgladdihoppers.html', icon: '🎮' },
  { id: 'clgloryhunters', name: 'Glory Hunters', url: '/games/clgloryhunters.html', icon: '🎮' },
  { id: 'clglover', name: 'Glover', url: '/games/clglover.html', icon: '🎮' },
  { id: 'clgooftroopsnes', name: 'Go of Troops NES', url: '/games/clgooftroopsnes.html', icon: '🎮' },
  { id: 'clgoalsouthafrica', name: 'Goal South Africa', url: '/games/clgoalsouthafrica.html', icon: '🎮' },
  { id: 'clgobble', name: 'Gobble', url: '/games/clgobble.html', icon: '🎮' },
  { id: 'clgoingballs', name: 'Going Balls', url: '/games/clgoingballs.html', icon: '🎮' },
  { id: 'clgolddiggerfrvr', name: 'Gold Digger Fr VR', url: '/games/clgolddiggerfrvr.html', icon: '🎮' },
  { id: 'clgoldminer', name: 'Gold Miner', url: '/games/clgoldminer.html', icon: '🎮' },
  { id: 'clgoldenaxe', name: 'Golden Axe', url: '/games/clgoldenaxe.html', icon: '🎮' },
  { id: 'clgoldenaxe2', name: 'Golden Axe 2', url: '/games/clgoldenaxe2.html', icon: '🎮' },
  { id: 'clgoldenaxe3', name: 'Golden Axe 3', url: '/games/clgoldenaxe3.html', icon: '🎮' },
  { id: 'clgoldensun', name: 'Golden Sun', url: '/games/clgoldensun.html', icon: '🎮' },
  { id: 'clgoldensunnds', name: 'Golden Sun Nds', url: '/games/clgoldensunnds.html', icon: '🎮' },
  { id: 'clgoldensunthelostage', name: 'Golden Sun: the Lost Age', url: '/games/clGoldenSunTheLostAge.html', icon: '🎮' },
  { id: 'clgoldeneye007', name: 'Goldeneye 007', url: '/games/clgoldeneye007.html', icon: '🎮' },
  { id: 'clgolfbattle', name: 'Golf Battle', url: '/games/clgolfbattle.html', icon: '⛳' },
  { id: 'clgolforbit', name: 'Golf Orbit', url: '/games/clgolforbit.html', icon: '⛳' },
  { id: 'clgolfsunday', name: 'Golf Sunday', url: '/games/clgolfsunday.html', icon: '⛳' },
  { id: 'clgoodbigtowertinysquare', name: 'Good Big Tower Tiny Square', url: '/games/clgoodbigtowertinysquare.html', icon: '🎮' },
  { id: 'clgoodbigtowertinysquare2', name: 'Good Big Tower Tiny Square 2', url: '/games/clgoodbigtowertinysquare2.html', icon: '🎮' },
  { id: 'clgoodboygalaxy', name: 'Good Boy Galaxy', url: '/games/clgoodboygalaxy.html', icon: '🌌' },
  { id: 'clgoodmonkeymart', name: 'Good Monkey Mart', url: '/games/clgoodmonkeymart.html', icon: '🎮' },
  { id: 'clgoogledino', name: 'Google Dino', url: '/games/clgoogledino.html', icon: '🎮' },
  { id: 'clgorescriptclassic', name: 'Gore Script Classic', url: '/games/clgorescriptclassic.html', icon: '🎮' },
  { id: 'clgorillatag', name: 'Gorilla Tag', url: '/games/clgorillatag.html', icon: '🎮' },
  { id: 'clgotobed', name: 'Gotobed', url: '/games/clgotobed.html', icon: '🎮' },
  { id: 'clgrandescapeprison', name: 'Grand Escape Prison', url: '/games/clgrandescapeprison.html', icon: '🎮' },
  { id: 'clgrandtheftautoadvance', name: 'Grand Theft Auto Advance', url: '/games/clgrandtheftautoadvance.html', icon: '🍄' },
  { id: 'clgrandactionsimulator-ny', name: 'Grandactionsimulator Ny', url: '/games/clgrandactionsimulator-ny.html', icon: '🎮' },
  { id: 'clgranddad', name: 'Granddad', url: '/games/clgranddad.html', icon: '🎮' },
  { id: 'clgranny2', name: 'Granny 2', url: '/games/clgranny2.html', icon: '🎮' },
  { id: 'clgranny22', name: 'Granny 22', url: '/games/clgranny22.html', icon: '🎮' },
  { id: 'clgranny3', name: 'Granny 3', url: '/games/clgranny3.html', icon: '🎮' },
  { id: 'clgrannycreepy', name: 'Granny Creepy', url: '/games/clgrannycreepy.html', icon: '🧟' },
  { id: 'clgrannynightmare', name: 'Granny Nightmare', url: '/games/clgrannynightmare.html', icon: '🧟' },
  { id: 'clgrannyy', name: 'Grannyy', url: '/games/clgrannyy.html', icon: '🎮' },
  { id: 'clgranturismo', name: 'Granturismo', url: '/games/clgranturismo.html', icon: '🎮' },
  { id: 'clgranturismo2', name: 'Granturismo 2', url: '/games/clgranturismo2.html', icon: '🎮' },
  { id: 'clgrassmowing', name: 'Grass Mowing', url: '/games/clgrassmowing.html', icon: '🎮' },
  { id: 'clgravity', name: 'Gravity', url: '/games/clgravity.html', icon: '🎮' },
  { id: 'clgravitymod', name: 'Gravity Mod', url: '/games/clgravitymod.html', icon: '🎮' },
  { id: 'clgreenergrassawaits', name: 'Greener Grass Awaits', url: '/games/clgreenergrassawaits.html', icon: '🎮' },
  { id: 'clgrey-box-testing', name: 'Grey Box Testing', url: '/games/clgrey-box-testing.html', icon: '🎮' },
  { id: 'clgrimacebirthday', name: 'Grimace Birthday', url: '/games/clgrimacebirthday.html', icon: '🎮' },
  { id: 'clgrindcraft', name: 'Grind Craft', url: '/games/clgrindcraft.html', icon: '⛏️' },
  { id: 'clgrn', name: 'Grn', url: '/games/clgrn.html', icon: '🎮' },
  { id: 'clgrowagarden', name: 'Grow Agarden', url: '/games/clgrowagarden.html', icon: '🎮' },
  { id: 'clgrowdenio', name: 'Grow de Nio', url: '/games/clgrowdenio.html', icon: '🎮' },
  { id: 'clgrowyourgarden', name: 'Grow Your Garden', url: '/games/clgrowyourgarden.html', icon: '🎮' },
  { id: 'clgrowmi', name: 'Growmi', url: '/games/clgrowmi.html', icon: '🎮' },
  { id: 'clgta', name: 'Gta', url: '/games/clgta.html', icon: '🎮' },
  { id: 'clgta2', name: 'Gta 2', url: '/games/clgta2.html', icon: '🎮' },
  { id: 'clgta22', name: 'Gta 22', url: '/games/clgta22.html', icon: '🎮' },
  { id: 'clgtachina', name: 'Gta China', url: '/games/clgtachina.html', icon: '🎮' },
  { id: 'clgtaalty', name: 'Gtaalty', url: '/games/clgtaalty.html', icon: '🎮' },
  { id: 'clgtamods', name: 'Gtamods', url: '/games/clgtamods.html', icon: '🎮' },
  { id: 'clguesstheiranswer', name: 'Guess Their Answer', url: '/games/clguesstheiranswer.html', icon: '🎮' },
  { id: 'clgunblood', name: 'Gun Blood', url: '/games/clgunblood.html', icon: '🔫' },
  { id: 'clgunknight', name: 'Gun Knight', url: '/games/clgunknight.html', icon: '🔫' },
  { id: 'clgunmayhem', name: 'Gun Mayhem', url: '/games/clgunmayhem.html', icon: '🔫' },
  { id: 'clgunmayhem2', name: 'Gun Mayhem 2', url: '/games/clgunmayhem2.html', icon: '🔫' },
  { id: 'clgunmayhem2goof', name: 'Gun Mayhem 2 Go of', url: '/games/clgunmayhem2goof.html', icon: '🔫' },
  { id: 'clgunmayhemredux', name: 'Gun Mayhem Red Ux', url: '/games/clgunmayhemredux.html', icon: '🔫' },
  { id: 'clgunnight', name: 'Gun Night', url: '/games/clgunnight.html', icon: '🔫' },
  { id: 'clgun-spin', name: 'Gun Spin', url: '/games/clgun-spin.html', icon: '🔫' },
  { id: 'clgunstarheroes', name: 'Gun Star Heroes', url: '/games/clgunstarheroes.html', icon: '🔫' },
  { id: 'clguncho', name: 'Guncho', url: '/games/clguncho.html', icon: '🔫' },
  { id: 'clgunfighterjessejames', name: 'Gunfighter Jesse James', url: '/games/clgunfighterjessejames.html', icon: '🥊' },
  { id: 'clgunsmoke', name: 'Gunsmoke', url: '/games/clgunsmoke.html', icon: '🔫' },
  { id: 'clgxclient', name: 'GX Client', url: '/games/clGXclient.html', icon: '🎮' },
  { id: 'clgymstack', name: 'Gym Stack', url: '/games/clgymstack.html', icon: '🎮' },
  { id: 'clgyromite', name: 'Gyro Mite', url: '/games/clgyromite.html', icon: '🎮' },
  { id: 'clhacx', name: 'Hacx', url: '/games/clhacx.html', icon: '🎮' },
  { id: 'clhajimeippo', name: 'Hajime no Ippo', url: '/games/clhajimeippo.html', icon: '🎮' },
  { id: 'clhajimenoippo', name: 'Hajime no Ippo', url: '/games/clhajimenoippo.html', icon: '🎮' },
  { id: 'clhalocombatdevolved', name: 'Halo Combat Devolved', url: '/games/clhalocombatdevolved.html', icon: '🎮' },
  { id: 'clhandulum', name: 'Handulum', url: '/games/clhandulum.html', icon: '🎮' },
  { id: 'clhandsofwar--1', name: 'Hands of War', url: '/games/clhandsofwar%20(1).html', icon: '🪖' },
  { id: 'clhandshakes', name: 'Handshakes', url: '/games/clhandshakes.html', icon: '🎮' },
  { id: 'clhangonsms', name: 'Hang on Sms', url: '/games/clhangonsms.html', icon: '🎮' },
  { id: 'clhanger', name: 'Hanger', url: '/games/clhanger.html', icon: '🎮' },
  { id: 'clhanger2', name: 'Hanger 2', url: '/games/clhanger2.html', icon: '🎮' },
  { id: 'clhappyroom', name: 'Happy Room', url: '/games/clhappyroom.html', icon: '🎮' },
  { id: 'clhappywheels', name: 'Happy Wheels', url: '/games/clhappywheels.html', icon: '🎮' },
  { id: 'clhardwaretycoon', name: 'Hardware Tycoon', url: '/games/clhardwaretycoon.html', icon: '👆' },
  { id: 'clharmonyofdissonance', name: 'Harmony of Dissonance', url: '/games/clharmonyofdissonance.html', icon: '🎮' },
  { id: 'clharoldsbadday', name: 'Harold\\\'s Bad Day', url: '/games/clHaroldsbadday.html', icon: '🎮' },
  { id: 'clharvestio', name: 'Harvest IO', url: '/games/clharvestio.html', icon: '🎮' },
  { id: 'clharvestmoon', name: 'Harvest Moon', url: '/games/clharvestmoon.html', icon: '🎮' },
  { id: 'clharvestmoon2', name: 'Harvest Moon 2', url: '/games/clharvestmoon2.html', icon: '🎮' },
  { id: 'clharvestmoon64', name: 'Harvest Moon 64', url: '/games/clharvestmoon64.html', icon: '🎮' },
  { id: 'clhauntthehouse', name: 'Haunt the House', url: '/games/clhauntthehouse.html', icon: '🎮' },
  { id: 'clhauntedschool', name: 'Haunted School', url: '/games/clhauntedschool.html', icon: '🎮' },
  { id: 'clheartandsoul', name: 'Heart and Soul', url: '/games/clheartandsoul.html', icon: '🎮' },
  { id: 'clheartandsoul1-2-1', name: 'Heartandsoul 1.2.1', url: '/games/clheartandsoul1.2.1.html', icon: '🎮' },
  { id: 'clhei-t', name: 'Hei$t', url: '/games/clhei$t.html', icon: '🎮' },
  { id: 'helios-offline--1', name: 'Helios Offline', url: '/games/Helios-Offline%20(1).html', icon: '🎮' },
  { id: 'clhelixjump', name: 'Helix Jump', url: '/games/clhelixjump.html', icon: '🏃' },
  { id: 'clhelltaker', name: 'Hell Taker', url: '/games/clHelltaker.html', icon: '🎮' },
  { id: 'clhellron', name: 'Hellron', url: '/games/clhellron.html', icon: '🎮' },
  { id: 'clhelpnobrakes', name: 'Help No Brakes', url: '/games/clhelpnobrakes.html', icon: '🎮' },
  { id: 'clheretic', name: 'Heretic', url: '/games/clheretic.html', icon: '🎮' },
  { id: 'clhero3flyingrobot', name: 'Hero 3 Flying Robot', url: '/games/clhero3flyingrobot.html', icon: '🎮' },
  { id: 'clherobrinereborn', name: 'Hero Brine Reborn', url: '/games/clherobrinereborn.html', icon: '🎮' },
  { id: 'clhextris', name: 'Hextris', url: '/games/clhextris.html', icon: '🎮' },
  { id: 'clhighstakes', name: 'High Stakes', url: '/games/clhighstakes.html', icon: '🎮' },
  { id: 'clhighwayracer2', name: 'Highway Racer 2', url: '/games/clhighwayracer2.html', icon: '🏎️' },
  { id: 'clhighwaytraffic3d', name: 'Highway Traffic 3D', url: '/games/clhighwaytraffic3d.html', icon: '🎮' },
  { id: 'clhillclimbracinglite', name: 'Hill Climb Racing Lite', url: '/games/clhillclimbracinglite.html', icon: '🏎️' },
  { id: 'clhipsterkickball', name: 'Hipster Kick Ball', url: '/games/clhipsterkickball.html', icon: '🎮' },
  { id: 'clhitsinglereal', name: 'Hit Single Real', url: '/games/clhitsinglereal.html', icon: '🎮' },
  { id: 'clhitstunfly', name: 'Hit Stun Fly', url: '/games/clhitstunfly.html', icon: '🎮' },
  { id: 'clhl2doom', name: 'Hl 2 Doom', url: '/games/clhl2doom.html', icon: '💀' },
  { id: 'clhobo', name: 'Hobo', url: '/games/clhobo.html', icon: '🎮' },
  { id: 'clhobo2', name: 'Hobo 2', url: '/games/clhobo2.html', icon: '🎮' },
  { id: 'clhobo3', name: 'Hobo 3', url: '/games/clhobo3.html', icon: '🎮' },
  { id: 'clhobo4', name: 'Hobo 4', url: '/games/clhobo4.html', icon: '🎮' },
  { id: 'clhobo5', name: 'Hobo 5', url: '/games/clhobo5.html', icon: '🎮' },
  { id: 'clhobo6', name: 'Hobo 6', url: '/games/clhobo6.html', icon: '🎮' },
  { id: 'clhobo7', name: 'Hobo 7', url: '/games/clhobo7.html', icon: '🎮' },
  { id: 'clhobovszombies', name: 'Hobo vs Zombies', url: '/games/clhobovszombies.html', icon: '🧟' },
  { id: 'clholebattle', name: 'Hole Battle', url: '/games/clholebattle.html', icon: '🎮' },
  { id: 'clholeio', name: 'Holeio', url: '/games/clholeio.html', icon: '🎮' },
  { id: 'clhollowknight', name: 'Hollow Knight', url: '/games/clhollowknight.html', icon: '⚔️' },
  { id: 'clhomesheephome', name: 'Home Sheep Home', url: '/games/clhomesheephome.html', icon: '🎮' },
  { id: 'clhorrormickeymouse', name: 'Horror Mickey Mouse', url: '/games/clhorrormickeymouse.html', icon: '🧟' },
  { id: 'clhotdogbush', name: 'Hotdog Bush', url: '/games/clhotdogbush.html', icon: '🎮' },
  { id: 'clhotwax', name: 'Hotwax', url: '/games/clhotwax.html', icon: '🎮' },
  { id: 'clhouseofhazards', name: 'House of Hazards', url: '/games/clhouseofhazards.html', icon: '🎮' },
  { id: 'clhoverracerdrive', name: 'Hover Racer Drive', url: '/games/clhoverracerdrive.html', icon: '🏎️' },
  { id: 'clhuggywuggypixel', name: 'Huggy Wuggy Pixel', url: '/games/clhuggywuggypixel.html', icon: '🎮' },
  { id: 'clhumanexpenditureprogram', name: 'Human Expenditure Program', url: '/games/clhumanexpenditureprogram.html', icon: '🎮' },
  { id: 'clhungryknight', name: 'Hungry Knight', url: '/games/clhungryknight.html', icon: '⚔️' },
  { id: 'clhungrylamu', name: 'Hungry la Mu', url: '/games/clhungrylamu.html', icon: '🎮' },
  { id: 'clhyppersandbox', name: 'Hy Pper Sandbox', url: '/games/clhyppersandbox.html', icon: '🎮' },
  { id: 'clicantbelievegoogleflaggedmeforthenameofthefilelol', name: 'Icant Believe Google Flagged Me for the Name of the File LOL', url: '/games/clicantbelievegoogleflaggedmeforthenameofthefilelol.html', icon: '🎮' },
  { id: 'clice-age-baby', name: 'Ice Age Baby', url: '/games/clice%20age%20baby.html', icon: '🎮' },
  { id: 'cliceclimber', name: 'Ice Climber', url: '/games/cliceclimber.html', icon: '🎮' },
  { id: 'clicefishing', name: 'Ice Fishing', url: '/games/clicefishing.html', icon: '🐟' },
  { id: 'clicedodo', name: 'Icedodo', url: '/games/clicedodo.html', icon: '🎮' },
  { id: 'clicypurplehead', name: 'Icy Purple Head', url: '/games/clicypurplehead.html', icon: '🎮' },
  { id: 'clidlebreakout', name: 'Idle Breakout', url: '/games/clidlebreakout.html', icon: '👆' },
  { id: 'clidlefootballmanager', name: 'Idle Football Manager', url: '/games/clidlefootballmanager.html', icon: '⚽' },
  { id: 'clidleidlegamedev', name: 'Idle Idle Game Dev', url: '/games/clidleidlegamedev.html', icon: '👆' },
  { id: 'clidleminertycoon', name: 'Idle Miner Tycoon', url: '/games/clidleminertycoon.html', icon: '👆' },
  { id: 'clidleminorzamnshes12', name: 'Idle Minerzamnshes 12', url: '/games/clidleminorzamnshes12.html', icon: '👆' },
  { id: 'clidledice', name: 'Idle Dice', url: '/games/clidledice.html', icon: '👆' },
  { id: 'clihateyou', name: 'I Hate You', url: '/games/clihateyou.html', icon: '🎮' },
  { id: 'climpossiblequiz--1', name: 'Impossible Quiz', url: '/games/climpossiblequiz%20(1).html', icon: '🧠' },
  { id: 'climpossiblequiz2', name: 'Impossible Quiz 2', url: '/games/climpossiblequiz2.html', icon: '🧠' },
  { id: 'clintellisphere', name: 'Intellisphere', url: '/games/clintellisphere.html', icon: '🎮' },
  { id: 'clinclementemerald', name: 'Inclement Emerald', url: '/games/clinclementemerald.html', icon: '🎮' },
  { id: 'clindiantrucksimiulator', name: 'Indian Truck Simulator', url: '/games/clindiantrucksimiulator.html', icon: '🎮' },
  { id: 'clinfinitecraft', name: 'Infinite Craft', url: '/games/clinfinitecraft.html', icon: '🌍' },
  { id: 'clinkgame', name: 'Inkgame', url: '/games/clinkgame.html', icon: '🎮' },
  { id: 'clinnkeeper', name: 'Innkeeper', url: '/games/clinnkeeper.html', icon: '🎮' },
  { id: 'clinsidestory', name: 'Inside Story', url: '/games/clinsidestory.html', icon: '🎮' },
  { id: 'clinsomniary', name: 'Insomniary', url: '/games/clinsomniary.html', icon: '🎮' },
  { id: 'clintoruins', name: 'Into Ruins', url: '/games/clintoruins.html', icon: '🎮' },
  { id: 'clintospace', name: 'Into Space', url: '/games/clintospace.html', icon: '🚀' },
  { id: 'clintospace2', name: 'Into Space 2', url: '/games/clintospace2.html', icon: '🚀' },
  { id: 'clintospace3', name: 'Into Space 3', url: '/games/clintospace3.html', icon: '🚀' },
  { id: 'clintothedeepweb', name: 'Into the Deep Web', url: '/games/clintothedeepweb.html', icon: '🎮' },
  { id: 'clintrusion', name: 'Intrusion', url: '/games/clintrusion.html', icon: '🔫' },
  { id: 'cliqball', name: 'Iqball', url: '/games/cliqball.html', icon: '🎮' },
  { id: 'clironsnout', name: 'Iron Snout', url: '/games/clironsnout.html', icon: '🐷' },
  { id: 'clironsoldier', name: 'Iron Soldier', url: '/games/clironsoldier.html', icon: '🪖' },
  { id: 'clirori', name: 'Irori', url: '/games/clirori.html', icon: '🎮' },
  { id: 'clitgetssolonelyhere', name: 'It Gets So Lonely Here', url: '/games/clitgetssolonelyhere.html', icon: '💔' },
  { id: 'cliwbtg', name: 'Iwbtg', url: '/games/cliwbtg.html', icon: '🎮' },
  { id: 'cljacksmith', name: 'Jack Smith', url: '/games/cljacksmith.html', icon: '🎮' },
  { id: 'cljacksmithencryptedorsmthn', name: 'Jack Smith Encrypted', url: '/games/cljacksmithencryptedorsmthn.html', icon: '🎮' },
  { id: 'cljailbreakobbbobob', name: 'Jailbreak Obby', url: '/games/cljailbreakobbbobob.html', icon: '🎮' },
  { id: 'cljamesbondjr', name: 'James Bond Jr', url: '/games/cljamesbondjr.html', icon: '🎮' },
  { id: 'cljazzjackrabbit', name: 'Jazz Jackrabbit', url: '/games/cljazzjackrabbit.html', icon: '🎮' },
  { id: 'cljazzjackrabbit2', name: 'Jazz Jackrabbit 2', url: '/games/cljazzjackrabbit2.html', icon: '🎮' },
  { id: 'cljefflings', name: 'Jefflings', url: '/games/cljefflings.html', icon: '🎮' },
  { id: 'cljellydadhero', name: 'Jelly Dad Hero', url: '/games/cljellydadhero.html', icon: '🎮' },
  { id: 'cljellydrift', name: 'Jelly Drift', url: '/games/cljellydrift.html', icon: '🎮' },
  { id: 'cljellymario', name: 'Jelly Mario', url: '/games/cljellymario.html', icon: '🍄' },
  { id: 'cljellytruck', name: 'Jelly Truck', url: '/games/cljellytruck.html', icon: '🎮' },
  { id: 'cljellytruckgood', name: 'Jelly Truck Good', url: '/games/cljellytruckgood.html', icon: '🎮' },
  { id: 'cljetforcegemini', name: 'Jet Force Gemini', url: '/games/cljetforcegemini.html', icon: '✈️' },
  { id: 'cljetskiracing', name: 'Jet Ski Racing', url: '/games/cljetskiracing.html', icon: '🚤' },
  { id: 'cljetpackjoyride', name: 'Jetpack Joyride', url: '/games/cljetpackjoyride.html', icon: '✈️' },
  { id: 'cljetrush', name: 'Jetrush', url: '/games/cljetrush.html', icon: '✈️' },
  { id: 'cljmocraft', name: 'JMO Craft', url: '/games/cljmocraft.html', icon: '🪨' },
  { id: 'cljohnnytrigger', name: 'Johnny Trigger', url: '/games/cljohnnytrigger.html', icon: '🔫' },
  { id: 'cljohnnyupgrade', name: 'Johnny Upgrade', url: '/games/cljohnnyupgrade.html', icon: '⬆️' },
  { id: 'cljojobaps1', name: 'JoJo Baps 1', url: '/games/cljojobaps1.html', icon: '🎮' },
  { id: 'cljourneyarcade', name: 'Journey Arcade', url: '/games/cljourneyarcade.html', icon: '🎮' },
  { id: 'cljourneydownhill', name: 'Journey Downhill', url: '/games/cljourneydownhill.html', icon: '🎮' },
  { id: 'cljoustarcade', name: 'Joust Arcade', url: '/games/cljoustarcade.html', icon: '🦅' },
  { id: 'cljsvecx', name: 'Jsvecx', url: '/games/cljsvecx.html', icon: '🎮' },
  { id: 'cljumbomario', name: 'Jumbo Mario', url: '/games/cljumbomario.html', icon: '🍄' },
  { id: 'cljumpingshell', name: 'Jumping Shell', url: '/games/cljumpingshell.html', icon: '🐢' },
  { id: 'cljunglebooksnes', name: 'Jungle Books NES', url: '/games/cljunglebooksnes.html', icon: '🎮' },
  { id: 'cljungledeerhunting', name: 'Jungle Deer Hunting', url: '/games/cljungledeerhunting.html', icon: '🎮' },
  { id: 'cljurassicpark', name: 'Jurassic Park', url: '/games/cljurassicpark.html', icon: '🎮' },
  { id: 'cljustaplatformer', name: 'Just a Platformer', url: '/games/cljustaplatformer.html', icon: '🏃' },
  { id: 'cljustfalllol', name: 'Just Fall LOL', url: '/games/cljustfalllol.html', icon: '🎮' },
  { id: 'cljusthitthebutton', name: 'Just Hit the Button', url: '/games/cljusthitthebutton.html', icon: '🎮' },
  { id: 'cljustinclient', name: 'Just in Client', url: '/games/cljustinclient.html', icon: '🎮' },
  { id: 'cljustoneboss', name: 'Just One Boss', url: '/games/cljustoneboss.html', icon: '🎮' },
  { id: 'cljustaplatformere', name: 'Just a Platformer E', url: '/games/cljustaplatformerE.html', icon: '🏃' },
  { id: 'cljustaplatformere2', name: 'Just a Platformer E2', url: '/games/cljustaplatformerE2.html', icon: '🏃' },
  { id: 'clkaizomarioworld', name: 'Kaizo Mario World', url: '/games/clkaizomarioworld.html', icon: '🍄' },
  { id: 'clkalikan', name: 'Kalikan', url: '/games/clkalikan.html', icon: '🎮' },
  { id: 'clkanyezone', name: 'Kanye Zone', url: '/games/clkanyezone.html', icon: '🎤' },
  { id: 'clkapi', name: 'Kapi', url: '/games/clkapi.html', icon: '🎮' },
  { id: 'clkaratebros', name: 'Karate Bros', url: '/games/clkaratebros.html', icon: '🎮' },
  { id: 'clkarlson', name: 'Karlson', url: '/games/clkarlson.html', icon: '🎮' },
  { id: 'clkartbros', name: 'Kart Bros', url: '/games/clkartbros.html', icon: '🏎️' },
  { id: 'clkeroseneclient', name: 'Kerosene Client', url: '/games/clkeroseneclient.html', icon: '🎮' },
  { id: 'clkillover', name: 'Kill Over', url: '/games/clkillover.html', icon: '🎮' },
  { id: 'clkilltheiceagebabyadventure', name: 'Kill the Ice Age Baby Adventure', url: '/games/clkilltheiceagebabyadventure.html', icon: '🎮' },
  { id: 'clkillerinstinct', name: 'Killer Instinct', url: '/games/clkillerinstinct.html', icon: '👊' },
  { id: 'clkimjonguntilepuzzle', name: 'Kim Jong-Un Tile Puzzle', url: '/games/clkimjonguntilepuzzle.html', icon: '🔫' },
  { id: 'clkingdomheartsdays', name: 'Kingdom Hearts Days', url: '/games/clkingdomheartsdays.html', icon: '🎮' },
  { id: 'clkingdomheartsrecoded', name: 'Kingdom Hearts Recoded', url: '/games/clkingdomheartsrecoded.html', icon: '🎮' },
  { id: 'clkingdomheartsrecodedalt', name: 'Kingdom Hearts Recoded Alt', url: '/games/clkingdomheartsrecodedalt.html', icon: '🎮' },
  { id: 'clkirby64', name: 'Kirby 64', url: '/games/clkirby64.html', icon: '⭐' },
  { id: 'clkirby64crystalshards', name: 'Kirby 64 Crystal Shards', url: '/games/clkirby64crystalshards.html', icon: '⭐' },
  { id: 'clkirbyandtheamzingmirror', name: 'Kirby and the Amazing Mirror', url: '/games/clkirbyandtheamzingmirror.html', icon: '⭐' },
  { id: 'clkirbycanvascurse', name: 'Kirby Canvas Curse', url: '/games/clkirbycanvascurse.html', icon: '⭐' },
  { id: 'clkirbysadventure', name: 'Kirby Sadventure', url: '/games/clkirbysadventure.html', icon: '⭐' },
  { id: 'clkirbysdreamland', name: 'Kirby Sdreamland', url: '/games/clkirbysdreamland.html', icon: '⭐' },
  { id: 'clkirbysdreamland3', name: 'Kirby Sdreamland 3', url: '/games/clkirbysdreamland3.html', icon: '⭐' },
  { id: 'clkirbysoftandwet', name: "Kirby's Soft and Wet", url: '/games/clkirbysoftandwet.html', icon: '⭐' },
  { id: 'clkirbysqueaksquad', name: 'Kirby Squeak Squad', url: '/games/clkirbysqueaksquad.html', icon: '⭐' },
  { id: 'clkirbysuperstar', name: 'Kirby Superstar', url: '/games/clkirbysuperstar.html', icon: '⭐' },
  { id: 'clkirbysuperstarultra', name: 'Kirby Superstar Ultra', url: '/games/clkirbysuperstarultra.html', icon: '⭐' },
  { id: 'clkirbytiltandtumble', name: 'Kirby Tilt and Tumble', url: '/games/clkirbytiltandtumble.html', icon: '⭐' },
  { id: 'clkittencannon', name: 'Kitten Cannon', url: '/games/clkittencannon.html', icon: '🐱' },
  { id: 'clklifur', name: 'Klifur', url: '/games/clklifur.html', icon: '🎮' },
  { id: 'clknifehit', name: 'Knife Hit', url: '/games/clknifehit.html', icon: '🎮' },
  { id: 'clknightmaretower', name: 'Knightmare Tower', url: '/games/clknightmaretower.html', icon: '🏰' },
  { id: 'clknockknock', name: 'Knock Knock', url: '/games/clknockknock.html', icon: '🎮' },
  { id: 'clkonkrio', name: 'Konkrio', url: '/games/clkonkrio.html', icon: '🎮' },
  { id: 'clkoopasrevenge', name: "Koopa's Revenge", url: '/games/clkoopasrevenge.html', icon: '🎮' },
  { id: 'clkourio', name: 'Kourio', url: '/games/clkourio.html', icon: '🎮' },
  { id: 'clks2teams', name: 'KS 2 Teams', url: '/games/clks2teams.html', icon: '🎮' },
  { id: 'cllaceysflashgames', name: 'Lacey Sflash Games', url: '/games/cllaceysflashgames.html', icon: '🎮' },
  { id: 'cllambdaclient', name: 'Lambda Client', url: '/games/cllambdaclient.html', icon: '🎮' },
  { id: 'cllastfirered', name: 'Last Firered', url: '/games/cllastfirered.html', icon: '🎮' },
  { id: 'cllasthorizon', name: 'Last Horizon', url: '/games/cllasthorizon.html', icon: '🎮' },
  { id: 'cllaststand', name: 'Last Stand', url: '/games/cllaststand.html', icon: '🎮' },
  { id: 'cllaststand2', name: 'Last Stand 2', url: '/games/cllaststand2.html', icon: '🎮' },
  { id: 'clleaderstrike', name: 'Leader Strike', url: '/games/clleaderstrike.html', icon: '🎮' },
  { id: 'clleapandavoid2', name: 'Leap and Avoid 2', url: '/games/clleapandavoid2.html', icon: '🎮' },
  { id: 'cllearntofly', name: 'Learn to Fly', url: '/games/cllearntofly.html', icon: '🎮' },
  { id: 'cllearntofly2', name: 'Learn to Fly 2', url: '/games/cllearntofly2.html', icon: '🎮' },
  { id: 'cllearntofly2hacked', name: 'Learn to Fly 2 Hacked', url: '/games/cllearntofly2hacked.html', icon: '🎮' },
  { id: 'cllearntofly3', name: 'Learn to Fly 3', url: '/games/cllearntofly3.html', icon: '🎮' },
  { id: 'cllearntoflyidle', name: 'Learn to Fly Idle', url: '/games/cllearntoflyidle.html', icon: '👆' },
  { id: 'cllearntoflyidlehack', name: 'Learn to Fly Idle Hack', url: '/games/cllearntoflyidlehack.html', icon: '👆' },
  { id: 'cllegobatman', name: 'Lego Batman', url: '/games/cllegobatman.html', icon: '🎮' },
  { id: 'cllegobatman2superheroes', name: 'Lego Batman 2 Superheroes', url: '/games/cllegobatman2superheroes.html', icon: '🎮' },
  { id: 'cllegoindianajones', name: 'Lego Indiana Jones', url: '/games/cllegoindianajones.html', icon: '🎮' },
  { id: 'cllegoindianajones2', name: 'Lego Indiana Jones 2', url: '/games/cllegoindianajones2.html', icon: '🎮' },
  { id: 'cllegoninjago', name: 'Lego Ninjago', url: '/games/cllegoninjago.html', icon: '🎮' },
  { id: 'cllegostarwars', name: 'Lego Star Wars', url: '/games/cllegostarwars.html', icon: '🪖' },
  { id: 'cllegostarwars2gba', name: 'Lego Star Wars 2 GBA', url: '/games/cllegostarwars2gba.html', icon: '🪖' },
  { id: 'cllegostarwarsgba', name: 'Lego Star Wars GBA', url: '/games/cllegostarwarsgba.html', icon: '🪖' },
  { id: 'cllemmings', name: 'Lemmings', url: '/games/cllemmings.html', icon: '🎮' },
  { id: 'clletitconsume', name: 'Let It Consume', url: '/games/clletitconsume.html', icon: '🎮' },
  { id: 'clletsgoeevee', name: "Let's Go Eevee", url: '/games/clletsgoeevee.html', icon: '🎮' },
  { id: 'clletsgopikachu', name: 'Lets Go Pikachu', url: '/games/clletsgopikachu.html', icon: '🐾' },
  { id: 'clleveldevil', name: 'Level Devil', url: '/games/clleveldevil.html', icon: '🎮' },
  { id: 'clleverwarriors', name: 'Lever Warriors', url: '/games/clleverwarriors.html', icon: '🪖' },
  { id: 'cllightitup', name: 'Light It Up', url: '/games/cllightitup.html', icon: '🎮' },
  { id: 'cllilrunmo', name: 'Lil Runmo', url: '/games/cllilrunmo.html', icon: '🎮' },
  { id: 'lime', name: 'Lime', url: '/games/lime.html', icon: '🎮' },
  { id: 'cllinerider', name: 'Line Rider', url: '/games/cllinerider.html', icon: '🎮' },
  { id: 'cllinktothepast', name: 'Link to the Past', url: '/games/cllinktothepast.html', icon: '🗡️' },
  { id: 'cllinksawakeningdx', name: 'Links Awakening DX', url: '/games/cllinksawakeningdx.html', icon: '🗡️' },
  { id: 'cllittlealchemy2', name: 'Little Alchemy 2', url: '/games/cllittlealchemy2.html', icon: '⚗️' },
  { id: 'cllittlerunmo', name: 'Little Runmo', url: '/games/cllittlerunmo.html', icon: '🎮' },
  { id: 'cllockthedoor', name: 'Lock the Door', url: '/games/cllockthedoor.html', icon: '🎮' },
  { id: 'clloderunner', name: 'Lode Runner', url: '/games/clloderunner.html', icon: '🏃' },
  { id: 'cllonewolf', name: 'Lone Wolf', url: '/games/cllonewolf.html', icon: '🎮' },
  { id: 'cllosangelesshark', name: 'Los Angeles Shark', url: '/games/cllosangelesshark.html', icon: '🦈' },
  { id: 'cllowknight', name: 'Hollow Knight', url: '/games/cllowknight.html', icon: '⚔️' },
  { id: 'clloz1', name: 'Legend of Zelda 1', url: '/games/clloz1.html', icon: '🎮' },
  { id: 'cllozlinkawakening', name: "Link's Awakening", url: '/games/cllozlinkawakening.html', icon: '🎮' },
  { id: 'cllozminishcap', name: 'Legend of Zelda: Minish Cap', url: '/games/cllozminishcap.html', icon: '🎮' },
  { id: 'cllozoracleofseasons', name: 'Legend of Zelda: Oracle of Seasons', url: '/games/cllozoracleofseasons.html', icon: '🐟' },
  { id: 'cllozphantomhourglass', name: 'Legend of Zelda: Phantom Hourglass', url: '/games/cllozphantomhourglass.html', icon: '🎮' },
  { id: 'lucid', name: 'Lucid', url: '/games/lucid.html', icon: '🎮' },
  { id: 'clluckyblocks', name: 'Lucky Blocks', url: '/games/clluckyblocks.html', icon: '🎮' },
  { id: 'cllumberobby', name: 'Lumber Obby', url: '/games/cllumberobby.html', icon: '🏃' },
  { id: 'cllummm', name: 'Lummm', url: '/games/cllummm.html', icon: '🎮' },
  { id: 'clmachrider', name: 'Mach Rider', url: '/games/clmachrider.html', icon: '🎮' },
  { id: 'clmadalinstuntcars', name: 'Madalin Stunt Cars', url: '/games/clmadalinstuntcars.html', icon: '🎮' },
  { id: 'clmadalinstuntcarsgood', name: 'Madalin Stunt Cars Good', url: '/games/clmadalinstuntcarsgood.html', icon: '🎮' },
  { id: 'clmadalinstuntcarsmultiplayerfixed', name: 'Madalin Stunt Cars Multiplayer Fixed', url: '/games/clmadalinstuntcarsmultiplayerfixed.html', icon: '🎮' },
  { id: 'clmadskillsmotocross2', name: 'Mad Skills Motocross 2', url: '/games/clmadskillsmotocross2.html', icon: '🏎️' },
  { id: 'clmadstick', name: 'Mad Stick', url: '/games/clmadstick.html', icon: '🎮' },
  { id: 'clmadstuntcars2', name: 'Mad Stunt Cars 2', url: '/games/clmadstuntcars2.html', icon: '🎮' },
  { id: 'clmadden93', name: 'Madden 93', url: '/games/clmadden93.html', icon: '🏈' },
  { id: 'clmadden94', name: 'Madden 94', url: '/games/clmadden94.html', icon: '🏈' },
  { id: 'clmadden95', name: 'Madden 95', url: '/games/clmadden95.html', icon: '🏈' },
  { id: 'clmadden96', name: 'Madden 96', url: '/games/clmadden96.html', icon: '🏈' },
  { id: 'clmadden99', name: 'Madden 99', url: '/games/clmadden99.html', icon: '🏈' },
  { id: 'clmaddenfootball', name: 'Madden Football', url: '/games/clmaddenfootball.html', icon: '🏈' },
  { id: 'clmaddenfootball64', name: 'Madden Football 64', url: '/games/clmaddenfootball64.html', icon: '🏈' },
  { id: 'clmaddennfl', name: 'Madden NFL', url: '/games/clmaddennfl.html', icon: '🏈' },
  { id: 'clmaddennfl2000', name: 'Madden NFL 2000', url: '/games/clmaddennfl2000.html', icon: '🏈' },
  { id: 'clmaddennfl2001', name: 'Madden NFL 2001', url: '/games/clmaddennfl2001.html', icon: '🏈' },
  { id: 'clmaddennfl2002', name: 'Madden NFL 2002', url: '/games/clmaddennfl2002.html', icon: '🏈' },
  { id: 'clmaddy98', name: 'Madden 98', url: '/games/clmaddy98.html', icon: '🎮' },
  { id: 'clmadnessaccelerant', name: 'Madness Accelerant', url: '/games/clmadnessaccelerant.html', icon: '🎮' },
  { id: 'clmadnesscombatdefense', name: 'Madness Combat Defense', url: '/games/clmadnesscombatdefense.html', icon: '🎮' },
  { id: 'clmadnesscombatnexus', name: 'Madness Combat Nexus', url: '/games/clmadnesscombatnexus.html', icon: '🎮' },
  { id: 'clmadnessgemini', name: 'Madness Gemini', url: '/games/clmadnessgemini.html', icon: '🎮' },
  { id: 'clmadnesshydraulic', name: 'Madness Hydraulic', url: '/games/clmadnesshydraulic.html', icon: '🎮' },
  { id: 'clmadnessinteractive', name: 'Madness Interactive', url: '/games/clmadnessinteractive.html', icon: '🎮' },
  { id: 'clmadnessoffcolor', name: 'Madness Off Color', url: '/games/clmadnessoffcolor.html', icon: '🧩' },
  { id: 'clmadnesspremediation', name: 'Madness Premediation', url: '/games/clmadnesspremediation.html', icon: '🎮' },
  { id: 'clmadnessretaliation', name: 'Madness Retaliation', url: '/games/clmadnessretaliation.html', icon: '🎮' },
  { id: 'clmadnesss2010', name: 'Madness S 2010', url: '/games/clmadnesss2010.html', icon: '🎮' },
  { id: 'clmadnessstand', name: 'Madness Stand', url: '/games/clmadnessstand.html', icon: '🎮' },
  { id: 'clmagetoweridle', name: 'Mage Tower Idle', url: '/games/clmagetoweridle.html', icon: '👆' },
  { id: 'clmagictiles3', name: 'Magic Tiles 3', url: '/games/clmagictiles3.html', icon: '🎹' },
  { id: 'clmajorasmask', name: "Majora's Mask", url: '/games/clmajorasmask.html', icon: '🗡️' },
  { id: 'clmakesureitsclosed', name: 'Make Sure Its Closed', url: '/games/clmakesureitsclosed.html', icon: '🎮' },
  { id: 'clmami', name: 'Mami', url: '/games/clmami.html', icon: '🎮' },
  { id: 'clmanagod', name: 'Managod', url: '/games/clmanagod.html', icon: '🎮' },
  { id: 'clmarbleracer-1', name: 'Marble Racer', url: '/games/clmarbleracer(1).html', icon: '🏎️' },
  { id: 'clmari0', name: 'Mari 0', url: '/games/clmari0.html', icon: '🎮' },
  { id: 'clmario3', name: 'Mario 3', url: '/games/clmario3.html', icon: '🍄' },
  { id: 'clmario64webgl', name: 'Mario 64 WebGL', url: '/games/clmario64webgl.html', icon: '🍄' },
  { id: 'clmarioandluigisuperstarsaga', name: 'Mario and Luigi Superstar Saga', url: '/games/clmarioandluigisuperstarsaga.html', icon: '🍄' },
  { id: 'clmariobrosnes', name: 'Mario Bros NES', url: '/games/clmariobrosnes.html', icon: '🍄' },
  { id: 'clmariobuilder64-1', name: 'Mario Builder 64', url: '/games/clmariobuilder64(1).html', icon: '🍄' },
  { id: 'clmariocombat', name: 'Mario Combat', url: '/games/clmariocombat.html', icon: '🍄' },
  { id: 'clmariogolf', name: 'Mario Golf', url: '/games/clmariogolf.html', icon: '⛳' },
  { id: 'clmarioismissingdoneright', name: 'Mario Is Missing Done Right', url: '/games/clMarioisMissingDoneRight.html', icon: '🍄' },
  { id: 'clmariokart64', name: 'Mario Kart 64', url: '/games/clmariokart64.html', icon: '🍄' },
  { id: 'clmariokartds', name: 'Mario Kart DS', url: '/games/clmariokartds.html', icon: '🍄' },
  { id: 'clmariokartsupercircuit', name: 'Mario Kart Super Circuit', url: '/games/clmariokartsupercircuit.html', icon: '🍄' },
  { id: 'clmariolostlevels', name: 'Mario Lost Levels', url: '/games/clmariolostlevels.html', icon: '🍄' },
  { id: 'clmariomadness', name: 'Mario Madness', url: '/games/clmariomadness.html', icon: '🍄' },
  { id: 'clmariomakersnes', name: 'Mario Makers NES', url: '/games/clmariomakersnes.html', icon: '🍄' },
  { id: 'clmariominusrabbids', name: 'Mario Minus Rabbids', url: '/games/clmariominusrabbids.html', icon: '🍄' },
  { id: 'clmariopaint', name: 'Mario Paint', url: '/games/clmariopaint.html', icon: '🍄' },
  { id: 'clmarioparty', name: 'Mario Party', url: '/games/clmarioparty.html', icon: '🍄' },
  { id: 'clmarioparty2', name: 'Mario Party 2', url: '/games/clmarioparty2.html', icon: '🍄' },
  { id: 'clmarioparty3', name: 'Mario Party 3', url: '/games/clmarioparty3.html', icon: '🍄' },
  { id: 'clmariopartyds', name: 'Mario Party DS', url: '/games/clmariopartyds.html', icon: '🍄' },
  { id: 'clmariosmysterymeat', name: 'Mario Smystery Meat', url: '/games/clmariosmysterymeat.html', icon: '🍄' },
  { id: 'clmariotennis', name: 'Mario Tennis', url: '/games/clmariotennis.html', icon: '🍄' },
  { id: 'clmariotennisgb', name: 'Mario Tennis Gb', url: '/games/clmariotennisgb.html', icon: '🍄' },
  { id: 'clmariovsluigi', name: 'Mario vs Luigi', url: '/games/clmariovsluigi.html', icon: '🍄' },
  { id: 'clmarvelsuperheroesarcade', name: 'Marvel Super Heroes Arcade', url: '/games/clMarvelSuperHeroesArcade.html', icon: '🎮' },
  { id: 'clmarvelvscapcomps1', name: 'Marvel vs Capcom (PS 1)', url: '/games/clMarvelVsCapcomPS1.html', icon: '🥊' },
  { id: 'clmarvelvsstreetfighter', name: 'Marvel vs Street Fighter', url: '/games/clMarvelVsStreetFighter.html', icon: '🥊' },
  { id: 'clmarvelvsstreetfighterjp', name: 'Marvel vs Street Fighter JP', url: '/games/clmarvelvsstreetfighterjp.html', icon: '🥊' },
  { id: 'clmaskedforcesunlimited', name: 'Masked Forces Unlimited', url: '/games/clmaskedforcesunlimited.html', icon: '🎮' },
  { id: 'clmastermindworldconquerer', name: 'Mastermind World Conquerer', url: '/games/clmastermindworldconquerer.html', icon: '🎮' },
  { id: 'clmatrixrampage', name: 'Matrix Rampage', url: '/games/clmatrixrampage.html', icon: '🎮' },
  { id: 'clmattv2', name: 'Mattv 2', url: '/games/clmattv2.html', icon: '🎮' },
  { id: 'clmauimallard', name: 'Maui Mallard', url: '/games/clmauimallard.html', icon: '🎮' },
  { id: 'clmaxpayne', name: 'Max Payne', url: '/games/clmaxpayne.html', icon: '🎮' },
  { id: 'clmcfpsfbhd', name: 'MCFP SFB HD', url: '/games/clmcfpsfbhd.html', icon: '💀' },
  { id: 'clmcraerally', name: 'McRae Rally', url: '/games/clmcraerally.html', icon: '🎮' },
  { id: 'clmeatboyflash', name: 'Meat Boy Flash', url: '/games/clmeatboyflash.html', icon: '🎮' },
  { id: 'clmeatboy', name: 'Meatboy', url: '/games/clmeatboy.html', icon: '🎮' },
  { id: 'clmedalofhonor-1', name: 'Medal of Honor', url: '/games/clmedalofhonor(1).html', icon: '🎮' },
  { id: 'clmedievil', name: 'MediEvil', url: '/games/clmedievil.html', icon: '🎮' },
  { id: 'clmedievalshark', name: 'Medieval Shark', url: '/games/clmedievalshark.html', icon: '🦈' },
  { id: 'clmegachess', name: 'Mega Chess', url: '/games/clmegachess.html', icon: '♟️' },
  { id: 'clmegaclient', name: 'Mega Client', url: '/games/clmegaclient.html', icon: '🎮' },
  { id: 'clmegaman2', name: 'Mega Man 2', url: '/games/clmegaman2.html', icon: '🤖' },
  { id: 'clmegaman2gba', name: 'Mega Man 2 GBA', url: '/games/clmegaman2gba.html', icon: '🤖' },
  { id: 'clmegaman3', name: 'Mega Man 3', url: '/games/clmegaman3.html', icon: '🤖' },
  { id: 'clmegaman4', name: 'Mega Man 4', url: '/games/clmegaman4.html', icon: '🤖' },
  { id: 'clmegaman5', name: 'Mega Man 5', url: '/games/clmegaman5.html', icon: '🤖' },
  { id: 'clmegaman5gb', name: 'Mega Man 5 GB', url: '/games/clmegaman5gb.html', icon: '🤖' },
  { id: 'clmegaman6', name: 'Mega Man 6', url: '/games/clmegaman6.html', icon: '🤖' },
  { id: 'clmegaman7', name: 'Mega Man 7', url: '/games/clmegaman7.html', icon: '🤖' },
  { id: 'clmegaman8', name: 'Mega Man 8', url: '/games/clmegaman8.html', icon: '🤖' },
  { id: 'clmegamanbasscftf', name: 'Mega Man & Bass CFTF', url: '/games/clmegamanbasscftf.html', icon: '🤖' },
  { id: 'clmegamanbattlechipchallenge', name: 'Mega Man Battle Chip Challenge', url: '/games/clmegamanbattlechipchallenge.html', icon: '🤖' },
  { id: 'clmegamanbn5tc', name: 'Mega Man Bn 5 Tc', url: '/games/clmegamanbn5tc.html', icon: '🤖' },
  { id: 'clmegamanbn5tp', name: 'Mega Man Bn 5 Tp', url: '/games/clmegamanbn5tp.html', icon: '🤖' },
  { id: 'clmegamanbn6cf', name: 'Mega Man Bn 6 Cf', url: '/games/clmegamanbn6cf.html', icon: '🤖' },
  { id: 'clmegamanbn6cg', name: 'Mega Man Bn 6 Cg', url: '/games/clmegamanbn6cg.html', icon: '🤖' },
  { id: 'clmegamanlegends', name: 'Mega Man Legends', url: '/games/clmegamanlegends.html', icon: '🤖' },
  { id: 'clmegamanlegends2', name: 'Mega Man Legends 2', url: '/games/clmegamanlegends2.html', icon: '🤖' },
  { id: 'clmegamanzero', name: 'Mega Man Zero', url: '/games/clmegamanzero.html', icon: '🤖' },
  { id: 'clmegamanzx', name: 'Mega Man Zx', url: '/games/clmegamanzx.html', icon: '🤖' },
  { id: 'clmegamanx', name: 'Mega Manx', url: '/games/clmegamanx.html', icon: '🤖' },
  { id: 'clmegamanx2', name: 'Mega Manx 2', url: '/games/clmegamanx2.html', icon: '🤖' },
  { id: 'clmegamanx3', name: 'Mega Manx 3', url: '/games/clmegamanx3.html', icon: '🤖' },
  { id: 'clmegamanx4', name: 'Mega Manx 4', url: '/games/clmegamanx4.html', icon: '🤖' },
  { id: 'clmegamanx5', name: 'Mega Manx 5', url: '/games/clmegamanx5.html', icon: '🤖' },
  { id: 'clmegamanx6', name: 'Mega Manx 6', url: '/games/clmegamanx6.html', icon: '🤖' },
  { id: 'clmegaminer', name: 'Mega Miner', url: '/games/clmegaminer.html', icon: '🎮' },
  { id: 'clmegacd', name: 'Megacd', url: '/games/clmegacd.html', icon: '🎮' },
  { id: 'clmegaman', name: 'Megaman', url: '/games/clmegaman.html', icon: '🤖' },
  { id: 'clmelonplayground', name: 'Melon Playground', url: '/games/clmelonplayground.html', icon: '🎮' },
  { id: 'clmeowuwu', name: 'Meowuwu', url: '/games/clmeowuwu.html', icon: '🎮' },
  { id: 'clmergeroundracers', name: 'Merge Round Racers', url: '/games/clmergeroundracers.html', icon: '🏎️' },
  { id: 'clmetalgear', name: 'Metal Gear', url: '/games/clmetalgear.html', icon: '🎮' },
  { id: 'clmetalgearsolid', name: 'Metal Gear Solid', url: '/games/clmetalgearsolid.html', icon: '🎮' },
  { id: 'clmetalslug', name: 'Metal Slug', url: '/games/clmetalslug.html', icon: '🎮' },
  { id: 'clmetalslug2', name: 'Metal Slug 2', url: '/games/clmetalslug2.html', icon: '🎮' },
  { id: 'clmetalslugadvance', name: 'Metal Slug Advance', url: '/games/clmetalslugadvance.html', icon: '🎮' },
  { id: 'clmetalslugmission1', name: 'Metal Slug Mission 1', url: '/games/clmetalslugmission1.html', icon: '🎮' },
  { id: 'clmetalslugmission2', name: 'Metal Slug Mission 2', url: '/games/clmetalslugmission2.html', icon: '🎮' },
  { id: 'clmetalsonichyperdrive', name: 'Metal Sonic Hyperdrive', url: '/games/clMetalSonicHyperdrive.html', icon: '💨' },
  { id: 'clmetroid', name: 'Metroid', url: '/games/clmetroid.html', icon: '🚀' },
  { id: 'clmetroid2', name: 'Metroid 2', url: '/games/clmetroid2.html', icon: '🚀' },
  { id: 'clmetroidfusion', name: 'Metroid Fusion', url: '/games/clmetroidfusion.html', icon: '🚀' },
  { id: 'clmetroidprimehunters', name: 'Metroid Prime Hunters', url: '/games/clmetroidprimehunters.html', icon: '🚀' },
  { id: 'clmetroidzeromission', name: 'Metroid Zero Mission', url: '/games/clmetroidzeromission.html', icon: '🚀' },
  { id: 'clmiamishark', name: 'Miami Shark', url: '/games/clmiamishark.html', icon: '🐟' },
  { id: 'clmickeymaniasnes', name: 'Mickey Mania SNES', url: '/games/clmickeymaniasnes.html', icon: '🎮' },
  { id: 'clmicrolife', name: 'Micro Life', url: '/games/clmicrolife.html', icon: '🎮' },
  { id: 'clmicromages', name: 'Micro Mages', url: '/games/clmicromages.html', icon: '🎮' },
  { id: 'clmidwaysgreatesthitsn64', name: 'Midways Greatest Hits N64', url: '/games/clmidwaysgreatesthitsn64.html', icon: '🎮' },
  { id: 'clmightyknight', name: 'Mighty Knight', url: '/games/clmightyknight.html', icon: '⚔️' },
  { id: 'clmightyknight2', name: 'Mighty Knight 2', url: '/games/clmightyknight2.html', icon: '⚔️' },
  { id: 'clmimic', name: 'Mimic', url: '/games/clmimic.html', icon: '🎮' },
  { id: 'clmindwave', name: 'Mind Wave', url: '/games/clmindwave.html', icon: '🎮' },
  { id: 'clmindscape', name: 'Minds Cape', url: '/games/clmindscape.html', icon: '🎮' },
  { id: 'clminecaves', name: 'Mine Caves', url: '/games/clminecaves.html', icon: '🎮' },
  { id: 'clmineshooter', name: 'Mine Shooter', url: '/games/clmineshooter.html', icon: '🔫' },
  { id: 'clminecraft1-8-8', name: 'Minecraft 1 8 8', url: '/games/clminecraft1-8-8.html', icon: '⛏️' },
  { id: 'minecraft', name: 'Minecraft 1.12.2', url: '/games/Minecraft%201.12.2.html', icon: '⛏️' },
  { id: 'clminecraftcasesim', name: 'Minecraft Cases Im', url: '/games/clminecraftcasesim.html', icon: '⛏️' },
  { id: 'clminecraftpocketedition', name: 'Minecraft Pocket Edition', url: '/games/clminecraftpocketedition.html', icon: '⛏️' },
  { id: 'clminecraftshooter', name: 'Minecraft Shooter', url: '/games/clminecraftshooter.html', icon: '🔫' },
  { id: 'minecrafttowerdefense', name: 'Minecraft Tower Defense', url: '/games/MINECRAFTTOWERDEFENSE.html', icon: '⛏️' },
  { id: 'clminesweeperplus', name: 'Minesweeper Plus', url: '/games/clminesweeperplus.html', icon: '🎮' },
  { id: 'clminhero', name: 'Minhero', url: '/games/clminhero.html', icon: '🎮' },
  { id: 'clminicrossword', name: 'Mini Crossword', url: '/games/clminicrossword.html', icon: '⚔️' },
  { id: 'clminiflips', name: 'Mini Flips', url: '/games/clminiflips.html', icon: '🎮' },
  { id: 'clminishooters', name: 'Mini Shooters', url: '/games/clminishooters.html', icon: '🔫' },
  { id: 'clminitooth', name: 'Mini Tooth', url: '/games/clminitooth.html', icon: '🎮' },
  { id: 'clminimart', name: 'Minim Art', url: '/games/clminimart.html', icon: '🎮' },
  { id: 'clmiraginewar', name: 'Mira Gin Ewar', url: '/games/clmiraginewar.html', icon: '🪖' },
  { id: 'clmisslecommand', name: 'Miss Le Command', url: '/games/clmisslecommand.html', icon: '🎮' },
  { id: 'clmk4ampedup', name: 'Mk 4 Am Ped Up', url: '/games/clmk4ampedup.html', icon: '🎮' },
  { id: 'clmkmythologiesn64', name: 'Mk Mythologies N64', url: '/games/clmkmythologiesn64.html', icon: '🎮' },
  { id: 'clmktrilogyps1', name: 'Mk Trilogy Ps 1', url: '/games/clmktrilogyps1.html', icon: '🎮' },
  { id: 'clmmwilywars', name: 'Mm Wily Wars', url: '/games/clmmwilywars.html', icon: '🪖' },
  { id: 'clmmbn3b', name: 'Mmbn 3 B', url: '/games/clmmbn3b.html', icon: '🎮' },
  { id: 'clmmbn3w', name: 'Mmbn 3 W', url: '/games/clmmbn3w.html', icon: '🎮' },
  { id: 'clmmbn4bm', name: 'Mmbn 4 Bm', url: '/games/clmmbn4bm.html', icon: '🎮' },
  { id: 'clmmbn4rs', name: 'Mmbn 4 Rs', url: '/games/clmmbn4rs.html', icon: '🎮' },
  { id: 'clmmbnws', name: 'Mmbnws', url: '/games/clmmbnws.html', icon: '🎮' },
  { id: 'clmmsf2zxn', name: 'Mmsf 2 Zx N', url: '/games/clmmsf2zxn.html', icon: '🎮' },
  { id: 'clmmsf2zxs', name: 'Mmsf 2 Zx S', url: '/games/clmmsf2zxs.html', icon: '🎮' },
  { id: 'clmmsf3ba', name: 'Mmsf 3 Ba', url: '/games/clmmsf3ba.html', icon: '🎮' },
  { id: 'clmmsf3rj', name: 'Mmsf 3 Rj', url: '/games/clmmsf3rj.html', icon: '🎮' },
  { id: 'clmmsfd', name: 'Mmsfd', url: '/games/clmmsfd.html', icon: '🎮' },
  { id: 'clmmsfl', name: 'Mmsfl', url: '/games/clmmsfl.html', icon: '🎮' },
  { id: 'clmmsfp', name: 'Mmsfp', url: '/games/clmmsfp.html', icon: '🎮' },
  { id: 'clmo64-1', name: 'Mo 64', url: '/games/clmo64(1).html', icon: '🎮' },
  { id: 'clmobcontrolhtml5', name: 'Mob Control Html 5', url: '/games/clmobcontrolhtml5.html', icon: '🎮' },
  { id: 'clmobiusrevolution', name: 'Mobius Revolution', url: '/games/clmobiusrevolution.html', icon: '🎮' },
  { id: 'clmomimsleeping', name: 'Momim Sleeping', url: '/games/clmomimsleeping.html', icon: '🎮' },
  { id: 'clmomoscrushers', name: 'Momo Scrusher S', url: '/games/clmomoscrushers.html', icon: '🎮' },
  { id: 'clmoneyrush', name: 'Money Rush', url: '/games/clmoneyrush.html', icon: '🎮' },
  { id: 'clmonkeymart', name: 'Monkey Mart', url: '/games/clmonkeymart.html', icon: '🎮' },
  { id: 'clmonkeymartenc', name: 'Monkey Marten C', url: '/games/clmonkeymartenc.html', icon: '🎮' },
  { id: 'clmonsterderby', name: 'Monster Derby', url: '/games/clmonsterderby.html', icon: '🎮' },
  { id: 'clmonstertracks', name: 'Monster Tracks', url: '/games/clmonstertracks.html', icon: '🎮' },
  { id: 'clmonstertruckcurfew', name: 'Monster Truck Curfew', url: '/games/clmonstertruckcurfew.html', icon: '🎮' },
  { id: 'clmonstertruckportstunt', name: 'Monster Truck Port Stunt', url: '/games/clmonstertruckportstunt.html', icon: '🎮' },
  { id: 'clmonsterswing', name: 'Monsters Wing', url: '/games/clmonsterswing.html', icon: '🎮' },
  { id: 'clmoonemeraldextremerandomizer', name: 'Moon Emerald Extreme Randomize R', url: '/games/clmoonemeraldextremerandomizer.html', icon: '🎮' },
  { id: 'clmortkom4', name: 'Mort Kom 4', url: '/games/clmortkom4.html', icon: '🎮' },
  { id: 'clmortalkombat', name: 'Mortal Kombat', url: '/games/clmortalkombat.html', icon: '👊' },
  { id: 'clmortalkombat2', name: 'Mortal Kombat 2', url: '/games/clmortalkombat2.html', icon: '🥊' },
  { id: 'clmortalkombat2a', name: 'Mortal Kombat 2 a', url: '/games/clmortalkombat2a.html', icon: '🥊' },
  { id: 'clmortalkombat3', name: 'Mortal Kombat 3', url: '/games/clmortalkombat3.html', icon: '🥊' },
  { id: 'clmortalkombat3a', name: 'Mortal Kombat 3 a', url: '/games/clmortalkombat3a.html', icon: '🥊' },
  { id: 'clmortalkombat4', name: 'Mortal Kombat 4', url: '/games/clmortalkombat4.html', icon: '🥊' },
  { id: 'clmortalkombata', name: 'Mortal Kombat a', url: '/games/clmortalkombata.html', icon: '🥊' },
  { id: 'clmortalkombatadvance', name: 'Mortal Kombat Advance', url: '/games/clmortalkombatadvance.html', icon: '🥊' },
  { id: 'clmotherload', name: 'Mother Load', url: '/games/clmotherload.html', icon: '🎮' },
  { id: 'clmotoroadrash', name: 'Moto Road Rash', url: '/games/clmotoroadrash.html', icon: '🏎️' },
  { id: 'clmotox3m2', name: 'Moto X 3 M 2', url: '/games/clmotox3m2.html', icon: '🏎️' },
  { id: 'clmotox3m3', name: 'Moto X 3 M 3', url: '/games/clmotox3m3.html', icon: '🏎️' },
  { id: 'clmotox3mm', name: 'Moto X 3 Mm', url: '/games/clmotox3mm.html', icon: '🏎️' },
  { id: 'clmotox3mpoolparty', name: 'Moto X 3 Mpool Party', url: '/games/clmotox3mpoolparty.html', icon: '🏎️' },
  { id: 'clmotox3mspookyland', name: 'Moto X 3 Mspooky Land', url: '/games/clmotox3mspookyland.html', icon: '🏎️' },
  { id: 'clmotox3mwinter', name: 'Moto X 3 Mwinter', url: '/games/clmotox3mwinter.html', icon: '🏎️' },
  { id: 'clmountainbikeracer', name: 'Mountain Bike Racer', url: '/games/clmountainbikeracer.html', icon: '🏎️' },
  { id: 'clmrdriller', name: 'Mr. Driller', url: '/games/clmrdriller.html', icon: '🎮' },
  { id: 'clmrdriller2', name: 'Mr. Driller 2', url: '/games/clmrdriller2.html', icon: '🎮' },
  { id: 'clmrmine', name: 'Mrmine', url: '/games/clmrmine.html', icon: '🎮' },
  { id: 'clmrracer', name: 'Mrracer', url: '/games/clmrracer.html', icon: '🏎️' },
  { id: 'clmspacman--1', name: 'Ms Pacman', url: '/games/clmspacman%20(1).html', icon: '🎮' },
  { id: 'clmultitask', name: 'Multi Task', url: '/games/clmultitask.html', icon: '🎮' },
  { id: 'clmutilate-a-doll', name: 'Mutilate A Doll', url: '/games/clmutilate-a-doll.html', icon: '🎮' },
  { id: 'clmvpbaseball', name: 'Mvp Baseball', url: '/games/clmvpbaseball.html', icon: '⚾' },
  { id: 'clmxoffroadmaster', name: 'Mx Off Road Master', url: '/games/clmxoffroadmaster.html', icon: '🎮' },
  { id: 'clmyfriendpedro', name: 'My Friend Pedro', url: '/games/clmyfriendpedro.html', icon: '🎮' },
  { id: 'clmyfriendpedroarena', name: 'My Friend Pedro Arena', url: '/games/clmyfriendpedroarena.html', icon: '🎮' },
  { id: 'clmyteardrop', name: 'My Teardrop', url: '/games/clmyteardrop.html', icon: '🎮' },
  { id: 'clnarc', name: 'Narc', url: '/games/clnarc.html', icon: '🎮' },
  { id: 'clnatsuki64', name: 'Natsuki 64', url: '/games/clnatsuki64.html', icon: '🎮' },
  { id: 'clnaturalselection', name: 'Natural Selection', url: '/games/clnaturalselection.html', icon: '🎮' },
  { id: 'nazi-zombies', name: 'Nazi Zombies Portable', url: '/games/Nazi%20Zombies_%20Portable%20(1)%20copy.html', icon: '🧟' },
  { id: 'clnbahangtime', name: 'NBA Hangtime', url: '/games/clNBAhangtime.html', icon: '🏀' },
  { id: 'clnbajam', name: 'NBA Jam', url: '/games/clNBAjam.html', icon: '🏀' },
  { id: 'clnbalive2000', name: 'NBA Live 2000', url: '/games/clnbalive2000.html', icon: '🏀' },
  { id: 'clnbalive2003', name: 'NBA Live 2003', url: '/games/clnbalive2003.html', icon: '🏀' },
  { id: 'clnbajamte', name: 'Nbajam Te', url: '/games/clnbajamTE.html', icon: '🏀' },
  { id: 'clnblox', name: 'Nblox', url: '/games/clnblox.html', icon: '🎮' },
  { id: 'clneonblaster', name: 'Neon Blaster', url: '/games/clneonblaster.html', icon: '🎮' },
  { id: 'clneonrider', name: 'Neon Rider', url: '/games/clneonrider.html', icon: '🎮' },
  { id: 'clnesworldchampion', name: 'NES Worldchampion', url: '/games/clnesworldchampion.html', icon: '🎮' },
  { id: 'clnetattack', name: 'Net Attack', url: '/games/clnetattack.html', icon: '🎮' },
  { id: 'clneverendinglegacy', name: 'Neverending Legacy', url: '/games/clneverendinglegacy.html', icon: '🎮' },
  { id: 'clnewsupermariobros', name: 'New Super Mario Bros', url: '/games/clnewsupermariobros.html', icon: '🍄' },
  { id: 'clnewsupermarioworld2aroundtheworld', name: 'New Super Mario World 2', url: '/games/clNewSuperMarioWorld2AroundtheWorld.html', icon: '🍄' },
  { id: 'clnewyorkshark', name: 'New York Shark', url: '/games/clnewyorkshark.html', icon: '🐟' },
  { id: 'clnewersmbds', name: 'Newer SMB DS', url: '/games/clnewersmbds.html', icon: '🎮' },
  { id: 'clnewgroundsrumble', name: 'Newgrounds Rumble', url: '/games/clnewgroundsrumble.html', icon: '🎮' },
  { id: 'clnextdoor', name: 'Next Door', url: '/games/clnextdoor.html', icon: '🎮' },
  { id: 'clnflblitz', name: 'NFL Blitz', url: '/games/clnflblitz.html', icon: '🎮' },
  { id: 'clnfscarbonowncity', name: 'Nfs Carbon Own City', url: '/games/clnfscarbonowncity.html', icon: '🏎️' },
  { id: 'clnfsmostwanted', name: 'Nfs Most Wanted', url: '/games/clnfsmostwanted.html', icon: '🏎️' },
  { id: 'clnfsporcheunleashed', name: 'Nfs Porc He Unleashed', url: '/games/clnfsporcheunleashed.html', icon: '🏎️' },
  { id: 'clnfsunderground', name: 'Nfs Underground', url: '/games/clnfsunderground.html', icon: '🏎️' },
  { id: 'clnfsunderground2', name: 'Nfs Underground 2', url: '/games/clnfsunderground2.html', icon: '🏎️' },
  { id: 'clngon-1', name: 'Ngon', url: '/games/clngon(1).html', icon: '🎮' },
  { id: 'clnguidle', name: 'Nguidle', url: '/games/clnguidle.html', icon: '👆' },
  { id: 'clnhl2002', name: 'NHL 2002', url: '/games/clnhl2002.html', icon: '🏒' },
  { id: 'clnhl98', name: 'NHL 98', url: '/games/clnhl98.html', icon: '🏒' },
  { id: 'clnhlhitz2003', name: 'NHL Hit Z 2003', url: '/games/clnhlhitz2003.html', icon: '🏒' },
  { id: 'clnickelodeonsuperbrawl2', name: 'Nickelodeon Super Brawl 2', url: '/games/clnickelodeonsuperbrawl2.html', icon: '🥊' },
  { id: 'clnightcatsurvival', name: 'Night Cat Survival', url: '/games/clnightcatsurvival.html', icon: '🎮' },
  { id: 'clnightfire', name: 'Night Fire', url: '/games/clnightfire.html', icon: '🎮' },
  { id: 'clnightclubshowdown', name: 'Nightclub Showdown', url: '/games/clnightclubshowdown.html', icon: '🎮' },
  { id: 'clnightshade', name: 'Nightshade', url: '/games/clnightshade.html', icon: '🎮' },
  { id: 'nikehub', name: 'Nikehub', url: '/games/nikehub.html', icon: '🎮' },
  { id: 'clnimrods', name: 'Nimrods', url: '/games/clnimrods.html', icon: '🎮' },
  { id: 'clninjabrawl', name: 'Ninja Brawl', url: '/games/clninjabrawl.html', icon: '🥊' },
  { id: 'clninjaobbyparkor', name: 'Ninja Ob by Park or', url: '/games/clninjaobbyparkor.html', icon: '🏃' },
  { id: 'clnintendoworldcup', name: 'Nintendo Worldcup', url: '/games/clnintendoworldcup.html', icon: '🎮' },
  { id: 'clnintendogslab', name: 'Nintendogs Lab', url: '/games/clnintendogslab.html', icon: '🎮' },
  { id: 'clnitclient', name: 'Nit Client', url: '/games/clnitclient.html', icon: '🎮' },
  { id: 'clnitromemustdie', name: 'Nitro Me Must Die', url: '/games/clnitromemustdie.html', icon: '🎮' },
  { id: 'clnomoregameasdsadfagfggdfs', name: 'No More Games DS', url: '/games/clnomoregameasdsadfagfggdfs.html', icon: '🎮' },
  { id: 'clnoobminer', name: 'Noob Miner', url: '/games/clnoobminer.html', icon: '🎮' },
  { id: 'clnotyourpawn', name: 'Not Your Pawn', url: '/games/clnotyourpawn.html', icon: '🎮' },
  { id: 'clnovaclient', name: 'Nova Client', url: '/games/clnovaclient.html', icon: '🎮' },
  { id: 'clnplus', name: 'Nplus', url: '/games/clnplus.html', icon: '🎮' },
  { id: 'clnsmbuds', name: 'Nsmbuds', url: '/games/clnsmbuds.html', icon: '🎮' },
  { id: 'clnsmbwds', name: 'Nsmbwds', url: '/games/clnsmbwds.html', icon: '🎮' },
  { id: 'clnubbysnumberfactory', name: 'Nub by Snumber Factory', url: '/games/clnubbysnumberfactory.html', icon: '🎮' },
  { id: 'clnullkevin', name: 'Null Kevin', url: '/games/clnullkevin.html', icon: '🎮' },
  { id: 'clnzp', name: 'Nzp', url: '/games/clnzp.html', icon: '🎮' },
  { id: 'clobby1jumpperclick', name: 'Ob by 1 Jump Per Click', url: '/games/clobby1jumpperclick.html', icon: '🏃' },
  { id: 'clobbybike', name: 'Ob by Bike', url: '/games/clobbybike.html', icon: '🏎️' },
  { id: 'clobbycart', name: 'Ob by Cart', url: '/games/clobbycart.html', icon: '🏃' },
  { id: 'clobbyonlyup', name: 'Ob by Only Up', url: '/games/clobbyonlyup.html', icon: '🏃' },
  { id: 'clobbyrainbowtower', name: 'Ob by Rainbow Tower', url: '/games/clobbyrainbowtower.html', icon: '🏃' },
  { id: 'clobbyslide', name: 'Ob by Slide', url: '/games/clobbyslide.html', icon: '🏃' },
  { id: 'clobbyswing', name: 'Ob by Swing', url: '/games/clobbyswing.html', icon: '🏃' },
  { id: 'clobbyyardsale', name: 'Ob by Yard Sale', url: '/games/clobbyyardsale.html', icon: '🏃' },
  { id: 'clobby456', name: 'Obby 456', url: '/games/clobby456.html', icon: '🏃' },
  { id: 'clobby-99-will-lose', name: 'Obby 99 Will Lose', url: '/games/clobby-99-will-lose.html', icon: '🏃' },
  { id: 'clobeythegame', name: 'Obey the Game', url: '/games/clobeythegame.html', icon: '🎮' },
  { id: 'clocarinaoftime', name: 'Ocarina of Time', url: '/games/clocarinaoftime.html', icon: '🗡️' },
  { id: 'clootmasterquest', name: 'Ocarina of Time Master Quest', url: '/games/clOotMasterQuest.html', icon: '🗡️' },
  { id: 'cloddbotout', name: 'Odd Bot Out', url: '/games/cloddbotout.html', icon: '🎮' },
  { id: 'cloddfuture', name: 'Odd Future', url: '/games/cloddfuture.html', icon: '🎮' },
  { id: 'clofflineparadise', name: 'Offline Paradise', url: '/games/clofflineparadise.html', icon: '🎮' },
  { id: 'clohflip', name: 'Ohflip', url: '/games/clohflip.html', icon: '🎮' },
  { id: 'clomegalayers', name: 'Omega Layers', url: '/games/clomegalayers.html', icon: '🎮' },
  { id: 'clomeganuggetclicker', name: 'Omega Nugget Click Er', url: '/games/clomeganuggetclicker.html', icon: '👆' },
  { id: 'clomnipresent', name: 'Omnipresent', url: '/games/clomnipresent.html', icon: '🎮' },
  { id: 'clonebitadventure', name: 'One Bit Adventure', url: '/games/clonebitadventure.html', icon: '🎮' },
  { id: 'clonepiece', name: 'One Piece', url: '/games/clonepiece.html', icon: '🎮' },
  { id: 'clonepiecefighting', name: 'One Piece Fighting', url: '/games/clonepiecefighting.html', icon: '🎮' },
  { id: 'cloneshotold', name: 'One Shot Old', url: '/games/cloneshotold.html', icon: '🎮' },
  { id: 'clonlyup', name: 'Onlyup', url: '/games/clonlyup.html', icon: '🎮' },
  { id: 'cloperius', name: 'Operius', url: '/games/cloperius.html', icon: '🎮' },
  { id: 'clopposumcountry', name: 'Opp Osum Country', url: '/games/clopposumcountry.html', icon: '🎮' },
  { id: 'cloppositeday', name: 'Opposite Day', url: '/games/cloppositeday.html', icon: '🎮' },
  { id: 'clormmimastickwithclsoitcanberememberedoyeahclalienhominid', name: 'Alien Hominid (Classic)', url: '/games/clormmimastickwithclsoitcanberememberedoyeahclalienhominid.html', icon: '🌌' },
  { id: 'clortalkombat4', name: 'Or Tal Kombat 4', url: '/games/clortalkombat4.html', icon: '🥊' },
  { id: 'clorbofcreation', name: 'Orb of Creation', url: '/games/clorbofcreation.html', icon: '🎮' },
  { id: 'clordinarysonicromhack', name: 'Ordinary Sonic Rom Hack', url: '/games/clordinarysonicromhack.html', icon: '💨' },
  { id: 'cloregontrail', name: 'Oregon Trail', url: '/games/cloregontrail.html', icon: '🎮' },
  { id: 'clorigamiking', name: 'Origami King', url: '/games/clorigamiking.html', icon: '🎮' },
  { id: 'closu', name: 'Osu', url: '/games/closu.html', icon: '🎮' },
  { id: 'clourpleguy', name: 'Our Ple Guy', url: '/games/clourpleguy.html', icon: '🎮' },
  { id: 'clouthold', name: 'Outhold', url: '/games/clouthold.html', icon: '🎮' },
  { id: 'cloutnumbered', name: 'Outnumbered', url: '/games/cloutnumbered.html', icon: '🎮' },
  { id: 'cloverburden', name: 'Overburden', url: '/games/cloverburden.html', icon: '🎮' },
  { id: 'clovo', name: 'Ovo', url: '/games/clovo.html', icon: '🎮' },
  { id: 'clovo2', name: 'Ovo 2', url: '/games/clovo2.html', icon: '🎮' },
  { id: 'clovodimensions', name: 'Ovo Dimensions', url: '/games/clovodimensions.html', icon: '🎮' },
  { id: 'clovofixed', name: 'Ovo Fixed', url: '/games/clovofixed.html', icon: '🎮' },
  { id: 'clpacman', name: 'Pacman', url: '/games/clpacman.html', icon: '👾' },
  { id: 'clpacmansuperfast', name: 'Pacman Super Fast', url: '/games/clpacmansuperfast.html', icon: '🎮' },
  { id: 'clpacmanworld3', name: 'Pacman World 3', url: '/games/clpacmanworld3.html', icon: '🎮' },
  { id: 'clpacmanworldg', name: 'Pacman World G', url: '/games/clpacmanworldg.html', icon: '🎮' },
  { id: 'clpacmanworldpsx', name: 'Pacman World Ps X', url: '/games/clpacmanworldpsx.html', icon: '🎮' },
  { id: 'clpacmana', name: 'Pacmana', url: '/games/clpacmana.html', icon: '🎮' },
  { id: 'clpandameic2', name: 'Panda Mei C 2', url: '/games/clpandameic2.html', icon: '🎮' },
  { id: 'clpapabakeria', name: 'Papa Baker Ia', url: '/games/clpapabakeria.html', icon: '🍕' },
  { id: 'clpapadonut', name: 'Papa Donut', url: '/games/clpapadonut.html', icon: '🍕' },
  { id: 'clpapalouienighthunt2', name: 'Papa Louie Night Hunt 2', url: '/games/clpapalouienighthunt2.html', icon: '🍕' },
  { id: 'clpapalouiewhenburgersattack', name: 'Papa Louie When Burgers Attack', url: '/games/clpapalouiewhenburgersattack.html', icon: '🍕' },
  { id: 'clpapalouiewhenpizzasattack', name: 'Papa Louie When Pizzas Attack', url: '/games/clpapalouiewhenpizzasattack.html', icon: '🍕' },
  { id: 'clpapalouiewhensundaesattack', name: 'Papa Louie When Sundaes Attack', url: '/games/clpapalouiewhensundaesattack.html', icon: '🍕' },
  { id: 'clpapapizzagood', name: 'Papa Pizza Good', url: '/games/clpapapizzagood.html', icon: '🍕' },
  { id: 'clpapapizzagoody', name: 'Papa Pizza Goody', url: '/games/clpapapizzagoody.html', icon: '🍕' },
  { id: 'clpapapizzamamamia', name: 'Papa Pizza Mama Mia', url: '/games/clpapapizzamamamia.html', icon: '🍕' },
  { id: 'clpapascheeseria', name: 'Papas Cheese Ria', url: '/games/clpapascheeseria.html', icon: '🍕' },
  { id: 'clpapascupcakeria', name: 'Papas Cupcake Ria', url: '/games/clpapascupcakeria.html', icon: '🍕' },
  { id: 'clpapasfreezeria', name: 'Papas Freezer Ia', url: '/games/clpapasfreezeria.html', icon: '🍕' },
  { id: 'clpapashotdoggeria', name: 'Papas Hotdog Geri a', url: '/games/clpapashotdoggeria.html', icon: '🍕' },
  { id: 'clpapaspancakeria', name: 'Papas Pancake Ria', url: '/games/clpapaspancakeria.html', icon: '🍕' },
  { id: 'clpapaspastaria', name: 'Papas Past Aria', url: '/games/clpapaspastaria.html', icon: '🌌' },
  { id: 'clpapasscooperia', name: 'Papas Scooper Ia', url: '/games/clpapasscooperia.html', icon: '🍕' },
  { id: 'clpapassushiria', name: 'Papas Sushi Ria', url: '/games/clpapassushiria.html', icon: '🍕' },
  { id: 'clpapastacomia', name: 'Papas Taco Mia', url: '/games/clpapastacomia.html', icon: '🍕' },
  { id: 'clpapaswingeria', name: 'Papas Winger Ia', url: '/games/clpapaswingeria.html', icon: '🍕' },
  { id: 'clpapasburgeriiiaaaaa', name: 'Papasburger Iiiaaaaa', url: '/games/clpapasburgerIIIAAAAA.html', icon: '🍕' },
  { id: 'clpaperio3d', name: 'Paper IO 3D', url: '/games/clpaperio3d.html', icon: '🎮' },
  { id: 'clpaperiomania', name: 'Paper Iomani a', url: '/games/clpaperiomania.html', icon: '🎮' },
  { id: 'clpapermario', name: 'Paper Mario', url: '/games/clpapermario.html', icon: '🍄' },
  { id: 'clpapermariodse', name: 'Paper Mario DSE', url: '/games/clPaperMarioDSE.html', icon: '🍄' },
  { id: 'clpapermariopromode', name: 'Paper Mario Promo de', url: '/games/clpapermariopromode.html', icon: '🍄' },
  { id: 'clpapermariottyd', name: 'Paper Mario Tty D', url: '/games/clpapermariottyd.html', icon: '🍄' },
  { id: 'clpaperio', name: 'Paperio', url: '/games/clpaperio.html', icon: '🎮' },
  { id: 'clparappatherapper', name: 'Parappa the Rapper', url: '/games/clparappatherapper.html', icon: '🎮' },
  { id: 'clparkingfury', name: 'Parking Fury', url: '/games/clparkingfury.html', icon: '🎮' },
  { id: 'clparkingfury2', name: 'Parking Fury 2', url: '/games/clparkingfury2.html', icon: '🎮' },
  { id: 'clparkingfury3', name: 'Parking Fury 3', url: '/games/clparkingfury3.html', icon: '🎮' },
  { id: 'clparkingrush', name: 'Parking Rush', url: '/games/clparkingrush.html', icon: '🎮' },
  { id: 'clpartnersintime', name: 'Partners in Time', url: '/games/clpartnersintime.html', icon: '🎮' },
  { id: 'clpeacekeeper', name: 'Peace Keeper', url: '/games/clpeacekeeper.html', icon: '🎮' },
  { id: 'peach', name: 'Peach', url: '/games/peach.html', icon: '🎮' },
  { id: 'clpeggle', name: 'Peggle', url: '/games/clpeggle.html', icon: '🎮' },
  { id: 'clpenaltykicks', name: 'Penalty Kicks', url: '/games/clpenaltykicks.html', icon: '🎮' },
  { id: 'clpenguinpass', name: 'Penguin Pass', url: '/games/clpenguinpass.html', icon: '🎮' },
  { id: 'clpepsiman', name: 'Pepsi Man', url: '/games/clpepsiman.html', icon: '🎮' },
  { id: 'clpepsimanalt', name: 'Pepsi Man Alt', url: '/games/clpepsimanalt.html', icon: '🎮' },
  { id: 'clpereelous', name: 'Per Eelo US', url: '/games/clpereelous.html', icon: '🎮' },
  { id: 'clperfectdark', name: 'Perfect Dark', url: '/games/clperfectdark.html', icon: '🎮' },
  { id: 'clperfecthotel', name: 'Perfect Hotel', url: '/games/clperfecthotel.html', icon: '🎮' },
  { id: 'clpersona2', name: 'Person A2', url: '/games/clpersona2.html', icon: '🎮' },
  { id: 'clpersona2alt', name: 'Person A2 Alt', url: '/games/clpersona2alt.html', icon: '🎮' },
  { id: 'clpersonaalt', name: 'Person Aalt', url: '/games/clpersonaalt.html', icon: '🎮' },
  { id: 'clpersona', name: 'Persona', url: '/games/clpersona.html', icon: '🎮' },
  { id: 'clpetworld', name: 'Pet World', url: '/games/clpetworld.html', icon: '🎮' },
  { id: 'clphantasystar', name: 'Phantasy Star', url: '/games/clphantasystar.html', icon: '🌌' },
  { id: 'clphantasystar2', name: 'Phantasy Star 2', url: '/games/clphantasystar2.html', icon: '🌌' },
  { id: 'clphantasystar3', name: 'Phantasy Star 3', url: '/games/clphantasystar3.html', icon: '🌌' },
  { id: 'clphantasystar4', name: 'Phantasy Star 4', url: '/games/clphantasystar4.html', icon: '🌌' },
  { id: 'clphasma', name: 'Phasma', url: '/games/clphasma.html', icon: '🎮' },
  { id: 'clpheonixjusticeforall', name: 'Phe on IX Justice for All', url: '/games/clpheonixjusticeforall.html', icon: '🎮' },
  { id: 'clpheonixrightaceattorny', name: 'Phe on IX Right Ace at Torn Y', url: '/games/clpheonixrightaceattorny.html', icon: '🎮' },
  { id: 'clpheonixtrialsandyear', name: 'Phe on IX Trials and Year', url: '/games/clpheonixtrialsandyear.html', icon: '🎮' },
  { id: 'clpiclient', name: 'Pi Client', url: '/games/clpiclient.html', icon: '🎮' },
  { id: 'clpibbyapocalypse', name: 'Pib by Apocalypse', url: '/games/clpibbyapocalypse.html', icon: '🎮' },
  { id: 'clpico8', name: 'Pico 8', url: '/games/clpico8.html', icon: '🎮' },
  { id: 'clpico8edu', name: 'Pico 8 Edu', url: '/games/clpico8edu.html', icon: '🎮' },
  { id: 'clpicodriller', name: 'Pico Dr Iller', url: '/games/clpicodriller.html', icon: '🎮' },
  { id: 'clpicolife', name: 'Pico Life', url: '/games/clpicolife.html', icon: '🎮' },
  { id: 'clpiconightpunkin', name: 'Pico Night Punk in', url: '/games/clpiconightpunkin.html', icon: '🎮' },
  { id: 'clpicosschool', name: "Pico's School", url: '/games/clpicosschool.html', icon: '🎮' },
  { id: 'clpicovsbeardx', name: 'Pico vs. Beard X', url: '/games/clpicovsbeardx.html', icon: '🎮' },
  { id: 'clpicohot', name: 'Picohot', url: '/games/clpicohot.html', icon: '🎮' },
  { id: 'clpiecesofcake', name: 'Pieces of Cake', url: '/games/clpiecesofcake.html', icon: '🎮' },
  { id: 'clpikwip', name: 'Pikwip', url: '/games/clpikwip.html', icon: '🎮' },
  { id: 'clpinballnes', name: 'Pinball NES', url: '/games/clpinballnes.html', icon: '🏀' },
  { id: 'clpingpongchaos', name: 'Ping Pong Chaos', url: '/games/clpingpongchaos.html', icon: '🎮' },
  { id: 'clpinkbike', name: 'Pink Bike', url: '/games/clpinkbike.html', icon: '🏎️' },
  { id: 'clpint', name: 'Pint', url: '/games/clpint.html', icon: '🎮' },
  { id: 'clpitof100trials', name: 'Pit of 100 Trials', url: '/games/clpitof100trials.html', icon: '🎮' },
  { id: 'clpitfall', name: 'Pitfall', url: '/games/clpitfall.html', icon: '🎮' },
  { id: 'clpixelbattlegroundsio', name: 'Pixel Battlegrounds IO', url: '/games/clpixelbattlegroundsio.html', icon: '🎮' },
  { id: 'clpixelclient', name: 'Pixel Client', url: '/games/clpixelclient.html', icon: '🎮' },
  { id: 'clpixelcombat2', name: 'Pixel Combat 2', url: '/games/clpixelcombat2.html', icon: '🎮' },
  { id: 'clpixelgun', name: 'Pixel Gun', url: '/games/clpixelgun.html', icon: '🔫' },
  { id: 'clpixelquestlostidols', name: 'Pixel Quest Lost Idols', url: '/games/clpixelquestlostidols.html', icon: '⚔️' },
  { id: 'clpixelshooter', name: 'Pixel Shooter', url: '/games/clpixelshooter.html', icon: '🔫' },
  { id: 'clpixelspeedrun', name: 'Pixel Speedrun', url: '/games/clpixelspeedrun.html', icon: '🏎️' },
  { id: 'clpixelwarfare', name: 'Pixel Warfare', url: '/games/clpixelwarfare.html', icon: '🪖' },
  { id: 'clpizzapapa', name: 'Pizza Papa', url: '/games/clpizzapapa.html', icon: '👨‍🍳' },
  { id: 'clpizzatower', name: 'Pizza Tower', url: '/games/clpizzatower.html', icon: '🍕' },
  { id: 'clpkmnarutoans', name: 'PKM Naruto ANS', url: '/games/clpkmnarutoans.html', icon: '🎮' },
  { id: 'clplazmaburst', name: 'Plazma Burst', url: '/games/clplazmaburst.html', icon: '🎮' },
  { id: 'clplangman', name: 'Plangman', url: '/games/clplangman.html', icon: '🎮' },
  { id: 'clplanetlife', name: 'Planet Life', url: '/games/clplanetlife.html', icon: '✈️' },
  { id: 'clplantsvszombies', name: 'Plants vs Zombies', url: '/games/clplantsvszombies.html', icon: '🧟' },
  { id: 'clplantsvszombiesnds', name: 'Plants vs Zombies Nds', url: '/games/clplantsvszombiesnds.html', icon: '🧟' },
  { id: 'clplinko', name: 'Plinko', url: '/games/clplinko.html', icon: '🎮' },
  { id: 'clplonky', name: 'Plonky', url: '/games/clplonky.html', icon: '🎮' },
  { id: 'clpokegschronicles', name: 'Pokegs Chronicles', url: '/games/clpokegschronicles.html', icon: '🐾' },
  { id: 'clpogo3d', name: 'Pogo 3D', url: '/games/clpogo3D.html', icon: '🎮' },
  { id: 'clpokeacademylifeforever', name: 'Poke Academy Life Forever', url: '/games/clpokeacademylifeforever.html', icon: '🐾' },
  { id: 'clpokeallin', name: 'Poke All in', url: '/games/clpokeallin.html', icon: '🐾' },
  { id: 'clpokebattlefact', name: 'Poke Battle Fact', url: '/games/clpokebattlefact.html', icon: '🐾' },
  { id: 'clpokeblack', name: 'Poke Black', url: '/games/clpokeblack.html', icon: '🐾' },
  { id: 'clpokeblack2alt', name: 'Poke Black 2 Alt', url: '/games/clpokeblack2alt.html', icon: '🐾' },
  { id: 'clpokeblackalt', name: 'Poke Black Alt', url: '/games/clpokeblackalt.html', icon: '🐾' },
  { id: 'clpokeblazeblack2redux', name: 'Poke Blaze Black 2 Redux', url: '/games/clpokeblazeblack2redux.html', icon: '🐾' },
  { id: 'clpokeblue', name: 'Poke Blue', url: '/games/clpokeblue.html', icon: '🐾' },
  { id: 'clpokeclassic', name: 'Poke Classic', url: '/games/clpokeclassic.html', icon: '🐾' },
  { id: 'clpokecrown', name: 'Poke Crown', url: '/games/clpokecrown.html', icon: '🐾' },
  { id: 'clpokecrystaladvanceredux', name: 'Poke Crystal Advance Redux', url: '/games/clpokecrystaladvanceredux.html', icon: '🐾' },
  { id: 'clpokecrystalclear', name: 'Poke Crystal Clear', url: '/games/clpokecrystalclear.html', icon: '🐾' },
  { id: 'clpokediamond', name: 'Poke Diamond', url: '/games/clpokediamond.html', icon: '🐾' },
  { id: 'clpokedreamstone', name: 'Poke Dream Stone', url: '/games/clpokedreamstone.html', icon: '🐾' },
  { id: 'clpokeeliteredux', name: 'Poke Elite Redux', url: '/games/clpokeeliteredux.html', icon: '🐾' },
  { id: 'clpokeelysiuma', name: 'Poke Elysium A', url: '/games/clpokeelysiuma.html', icon: '🐾' },
  { id: 'clpokeelysiumb', name: 'Poke Elysium B', url: '/games/clpokeelysiumb.html', icon: '🐾' },
  { id: 'clpokeemeraldenhanced', name: 'Poke Emerald Enhanced', url: '/games/clpokeemeraldenhanced.html', icon: '🐾' },
  { id: 'clpokeemeraldexceeded', name: 'Poke Emerald Exceeded', url: '/games/clpokeemeraldexceeded.html', icon: '🐾' },
  { id: 'clpokeemeraldhorizons', name: 'Poke Emerald Horizons', url: '/games/clpokeemeraldhorizons.html', icon: '🐾' },
  { id: 'clpokeemeraldimperium', name: 'Poke Emerald Imperium', url: '/games/clpokeemeraldimperium.html', icon: '🐾' },
  { id: 'clpokeemeraldrandom', name: 'Poke Emerald Random', url: '/games/clpokeemeraldrandom.html', icon: '🐾' },
  { id: 'clpokeemeraldrogue', name: 'Poke Emerald Rogue', url: '/games/clpokeemeraldrogue.html', icon: '🐾' },
  { id: 'clpokeemeraldz', name: 'Poke Emerald Z', url: '/games/clpokeemeraldz.html', icon: '🐾' },
  { id: 'clpokefiregold', name: 'Poke Fire Gold', url: '/games/clpokefiregold.html', icon: '🐾' },
  { id: 'clpokeflora', name: 'Poke Flora', url: '/games/clpokeflora.html', icon: '🐾' },
  { id: 'clpokefrlgplus', name: 'Poke FRLG Plus', url: '/games/clpokefrlgplus.html', icon: '🐾' },
  { id: 'clpokefuseddimension', name: 'Poke Fused Dimension', url: '/games/clpokefuseddimension.html', icon: '🐾' },
  { id: 'clpokegaia', name: 'Poke Gaia', url: '/games/clpokegaia.html', icon: '🐾' },
  { id: 'clpokegoldenshield', name: 'Poke Golden Shield', url: '/games/clpokegoldenshield.html', icon: '🐾' },
  { id: 'clpokeheartgold', name: 'Poke Heartgold', url: '/games/clpokeheartgold.html', icon: '🐾' },
  { id: 'clpokelightplatinum', name: 'Poke Light Platinum', url: '/games/clpokelightplatinum.html', icon: '🐾' },
  { id: 'clpokeliquidcrysta', name: 'Poke Liquid Crystal', url: '/games/clpokeliquidcrysta.html', icon: '🐾' },
  { id: 'clpokemegamoemon', name: 'Poke Mega Moemon', url: '/games/clpokemegamoemon.html', icon: '🐾' },
  { id: 'clpokemoonemerald', name: 'Poke Moon Emerald', url: '/games/clpokemoonemerald.html', icon: '🐾' },
  { id: 'clpokemoongalaxy', name: 'Poke Moon Galaxy', url: '/games/clpokemoongalaxy.html', icon: '🐾' },
  { id: 'clpokemysteryexplorersofsky', name: 'Poke Mystery Explorers of Sky', url: '/games/clpokemysteryexplorersofsky.html', icon: '🐾' },
  { id: 'clpokenameless', name: 'Poke Nameless', url: '/games/clpokenameless.html', icon: '🐾' },
  { id: 'clpokeodyssey', name: 'Poke Odyssey', url: '/games/clpokeodyssey.html', icon: '🐾' },
  { id: 'clpokepasta', name: 'Poke Pasta', url: '/games/clpokepasta.html', icon: '🐾' },
  { id: 'clpokepath', name: 'Poke Path', url: '/games/clpokepath.html', icon: '🐾' },
  { id: 'clpokepearl', name: 'Poke Pearl', url: '/games/clpokepearl.html', icon: '🐾' },
  { id: 'clpokeperfectfirered', name: 'Poke Perfect Firered', url: '/games/clpokeperfectfirered.html', icon: '🐾' },
  { id: 'clpokepicross', name: 'Poke Picross', url: '/games/clpokepicross.html', icon: '🐾' },
  { id: 'clpokepisces', name: 'Poke Pisces', url: '/games/clpokepisces.html', icon: '🐾' },
  { id: 'clpokeplatinum', name: 'Poke Platinum', url: '/games/clpokeplatinum.html', icon: '🐾' },
  { id: 'clpokeplatinumrandomized', name: 'Poke Platinum Randomized', url: '/games/clpokeplatinumrandomized.html', icon: '🐾' },
  { id: 'clpokepureblue', name: 'Poke Pure Blue', url: '/games/clpokepureblue.html', icon: '🐾' },
  { id: 'clpokepuregreen', name: 'Poke Pure Green', url: '/games/clpokepuregreen.html', icon: '🐾' },
  { id: 'clpokepurered', name: 'Poke Pure Red', url: '/games/clpokepurered.html', icon: '🐾' },
  { id: 'clpokerechargedpink', name: 'Poke Recharged Pink', url: '/games/clpokerechargedpink.html', icon: '🐾' },
  { id: 'clpokerechargedyellow', name: 'Poke Recharged Yellow', url: '/games/clpokerechargedyellow.html', icon: '🐾' },
  { id: 'clpokerecordkeepers', name: 'Poke Record Keepers', url: '/games/clpokerecordkeepers.html', icon: '🐾' },
  { id: 'clpokerenegadeplat', name: 'Poke Renegade Plat', url: '/games/clpokerenegadeplat.html', icon: '🐾' },
  { id: 'clpokerocketedition', name: 'Poke Rocket Edition', url: '/games/clpokerocketedition.html', icon: '🐾' },
  { id: 'clpokeruby', name: 'Poke Ruby', url: '/games/clpokeruby.html', icon: '🐾' },
  { id: 'clpokerunandbun', name: 'Poke Run and Bun', url: '/games/clpokerunandbun.html', icon: '🐾' },
  { id: 'clpokescorchedsilver', name: 'Poke Scorched Silver', url: '/games/clpokescorchedsilver.html', icon: '🐾' },
  { id: 'clpokescrambledscarlet', name: 'Poke Scrambled Scarlet', url: '/games/clpokescrambledscarlet.html', icon: '🐾' },
  { id: 'clpokesunsky', name: 'Poke Sun Sky', url: '/games/clpokesunsky.html', icon: '🐾' },
  { id: 'clpoketcg1', name: 'Poke Tcg 1', url: '/games/clpoketcg1.html', icon: '🐾' },
  { id: 'clpoketcg2', name: 'Poke Tcg 2', url: '/games/clpoketcg2.html', icon: '🐾' },
  { id: 'clpokethepit', name: 'Poke the Pit', url: '/games/clpokethepit.html', icon: '🐾' },
  { id: 'clpoketoomanytypes2', name: 'Poke Too Many Types 2', url: '/games/clpoketoomanytypes2.html', icon: '🐾' },
  { id: 'clpoketourmaline', name: 'Poke Tourmaline', url: '/games/clpoketourmaline.html', icon: '🐾' },
  { id: 'clpokeultraviolet', name: 'Poke Ultraviolet', url: '/games/clpokeultraviolet.html', icon: '🐾' },
  { id: 'clpokeunovaemerald', name: 'Poke Unova Emerald', url: '/games/clpokeunovaemerald.html', icon: '🐾' },
  { id: 'clpokevega', name: 'Poke Vega', url: '/games/clpokevega.html', icon: '🐾' },
  { id: 'clpokevoltwhite2redux', name: 'Poke Volt White 2 Redux', url: '/games/clpokevoltwhite2redux.html', icon: '🐾' },
  { id: 'clpokevoyager', name: 'Poke Voyager', url: '/games/clpokevoyager.html', icon: '🐾' },
  { id: 'clpokewhite', name: 'Poke White', url: '/games/clpokewhite.html', icon: '🐾' },
  { id: 'clpokewhite2', name: 'Poke White 2', url: '/games/clpokewhite2.html', icon: '🐾' },
  { id: 'clpokewhite2alt', name: 'Poke White 2 Alt', url: '/games/clpokewhite2alt.html', icon: '🐾' },
  { id: 'clpokeyellow', name: 'Poke Yellow', url: '/games/clpokeyellow.html', icon: '🐾' },
  { id: 'clpokeblack2', name: 'Pokemon Black 2', url: '/games/clpokeblack2.html.html', icon: '🐾' },
  { id: 'clpokeambrosia', name: 'Pokemon Ambrosia', url: '/games/clPokeAmbrosia.html', icon: '🐾' },
  { id: 'clpokemonamnesia', name: 'Pokemon Amnesia', url: '/games/clpokemonamnesia.html', icon: '🐾' },
  { id: 'clpokemonclover', name: 'Pokemon Clover', url: '/games/clpokemonclover.html', icon: '🐾' },
  { id: 'clpokemoncrystal', name: 'Pokemon Crystal', url: '/games/clpokemoncrystal.html', icon: '💎' },
  { id: 'clpokemonemerald', name: 'Pokemon Emerald', url: '/games/clpokemonemerald.html', icon: '💚' },
  { id: 'clpokemonemeraldcrest', name: 'Pokemon Emerald Crest', url: '/games/clpokemonemeraldcrest.html', icon: '🐾' },
  { id: 'clpokemonemeraldimperium', name: 'Pokemon Emerald Imperium', url: '/games/clpokemonemeraldimperium.html', icon: '🐾' },
  { id: 'clpokemonemeraldkaizo', name: 'Pokemon Emerald Kaizo', url: '/games/clpokemonemeraldkaizo.html', icon: '🐾' },
  { id: 'clpokemonemeraldmini', name: 'Pokemon Emerald Mini', url: '/games/clpokemonemeraldmini.html', icon: '🐾' },
  { id: 'clpokeemeraldrogueex', name: 'Pokemon Emerald Rogue EX', url: '/games/clPokeEmeraldRogueEX.html', icon: '🐾' },
  { id: 'clpokemonemeraldseaglass', name: 'Pokemon Emerald Sea Glass', url: '/games/clpokemonemeraldseaglass.html', icon: '🐾' },
  { id: 'clpokemonenergizedemerald', name: 'Pokemon Energized Emerald', url: '/games/clpokemonenergizedemerald.html', icon: '🐾' },
  { id: 'clpokemonevolvedsfdgsdfs', name: 'Pokemon Evolved', url: '/games/clpokemonevolvedsfdgsdfs.html', icon: '🐾' },
  { id: 'clpokemonfirered', name: 'Pokemon Firered', url: '/games/clpokemonfirered.html', icon: '🔥' },
  { id: 'clpokemonfireredandleafgreenplusedition', name: 'Pokemon Firered and Leafgreen Plus Edition', url: '/games/clpokemonfireredandleafgreenplusedition.html', icon: '🐾' },
  { id: 'clpokemonfireredrandomized', name: 'Pokemon Firered Randomized', url: '/games/clpokemonfireredrandomized.html', icon: '🐾' },
  { id: 'clpokefusion3', name: 'Pokemon Fusion 3', url: '/games/clPokeFusion3.html', icon: '🐾' },
  { id: 'clpokemongold', name: 'Pokemon Gold', url: '/games/clpokemongold.html', icon: '🥇' },
  { id: 'clpokemonkaizoironfirered', name: 'Pokemon Kaizo Iron Firered', url: '/games/clpokemonkaizoironfirered.html', icon: '🐾' },
  { id: 'clpokemonlazarus', name: 'Pokemon Lazarus', url: '/games/clpokemonlazarus.html', icon: '🐾' },
  { id: 'clpokemonleafgreen', name: 'Pokemon Leafgreen', url: '/games/clpokemonleafgreen.html', icon: '🌿' },
  { id: 'clpokemonmodernemerald', name: 'Pokemon Modern Emerald', url: '/games/clpokemonmodernemerald.html', icon: '🐾' },
  { id: 'clpokemonmysterydungeon', name: 'Pokemon Mystery Dungeon', url: '/games/clpokemonmysterydungeon.html', icon: '🐾' },
  { id: 'clpokemonquetzal', name: 'Pokemon Quetzal', url: '/games/clpokemonquetzal.html', icon: '🐾' },
  { id: 'clpokemonroaringred', name: 'Pokemon Roaring Red', url: '/games/clpokemonroaringred.html', icon: '🐾' },
  { id: 'clpokemonruby', name: 'Pokemon Ruby', url: '/games/clpokemonruby.html', icon: '♦️' },
  { id: 'clpokemonsapphire', name: 'Pokemon Sapphire', url: '/games/clpokemonsapphire.html', icon: '💙' },
  { id: 'clpokemonshinsigma', name: 'Pokemon Shin Sigma', url: '/games/clpokemonshinsigma.html', icon: '🐾' },
  { id: 'clpokemonsilver', name: 'Pokemon Silver', url: '/games/clpokemonsilver.html', icon: '🥈' },
  { id: 'clpokemonsnap', name: 'Pokemon Snap', url: '/games/clpokemonsnap.html', icon: '🐾' },
  { id: 'clpokemonstadium', name: 'Pokemon Stadium', url: '/games/clpokemonstadium.html', icon: '🐾' },
  { id: 'clpokemonstadium2', name: 'Pokemon Stadium 2', url: '/games/clpokemonstadium2.html', icon: '🐾' },
  { id: 'clpokemontowerdefense', name: 'Pokemon Tower Defense', url: '/games/clpokemontowerdefense.html', icon: '🐾' },
  { id: 'clpokemonultimatefusion', name: 'Pokemon Ultimate Fusion', url: '/games/clpokemonultimatefusion.html', icon: '🐾' },
  { id: 'clpokemonunbound', name: 'Pokemon Unbound', url: '/games/clpokemonunbound.html', icon: '🐾' },
  { id: 'clpokemonvolume1', name: 'Pokemon Volume 1', url: '/games/clpokemonvolume1.html', icon: '🐾' },
  { id: 'clpokemonvolume2', name: 'Pokemon Volume 2', url: '/games/clpokemonvolume2.html', icon: '🐾' },
  { id: 'clpokemonvolume3', name: 'Pokemon Volume 3', url: '/games/clpokemonvolume3.html', icon: '🐾' },
  { id: 'clpokemonvolume4', name: 'Pokemon Volume 4', url: '/games/clpokemonvolume4.html', icon: '🐾' },
  { id: 'clpokemonperfectemerald5-5', name: 'Pokemon Perfect Emerald 5.5', url: '/games/clpokemonperfectemerald5.5.html', icon: '🐾' },
  { id: 'clpokemonsaiph', name: 'Pokemon Saiph', url: '/games/clpokemonsaiph.html', icon: '🐾' },
  { id: 'clpokemonsaiph2', name: 'Pokemon Saiph 2', url: '/games/clpokemonsaiph2.html', icon: '🐾' },
  { id: 'clpokemonslgreen', name: 'Pokemon Leaf Green (S)', url: '/games/clpokemonslgreen.html', icon: '🐾' },
  { id: 'clpokemonsmred', name: 'Pokemon Mystery Red', url: '/games/clpokemonsmred.html', icon: '🐾' },
  { id: 'clpokemonsors', name: 'Pokemon Sors', url: '/games/clpokemonsors.html', icon: '🐾' },
  { id: 'clpokemonsors2', name: 'Pokemon Sors 2', url: '/games/clpokemonsors2.html', icon: '🐾' },
  { id: 'clpokerowe', name: 'Pokerowe', url: '/games/clpokerowe.html', icon: '🐾' },
  { id: 'clpokered', name: 'Pokered', url: '/games/clpokered.html', icon: '🐾' },
  { id: 'clpolicepursuit2', name: 'Police Pursuit 2', url: '/games/clpolicepursuit2.html', icon: '🎮' },
  { id: 'clpolishedcrystal', name: 'Polished Crystal', url: '/games/clpolishedcrystal.html', icon: '🎮' },
  { id: 'clpolytrackbutnotflagged-1', name: 'Poly Track', url: '/games/clpolytrackbutnotflagged(1).html', icon: '🎮' },
  { id: 'clpolytrackworksnow', name: 'Poly Track Works Now', url: '/games/clpolytrackworksnow.html', icon: '🏂' },
  { id: 'clpomgetsinternet', name: 'Pom Gets Internet', url: '/games/clpomgetsinternet.html', icon: '🎮' },
  { id: 'clpoorbunny', name: 'Poor Bunny', url: '/games/clpoorbunny.html', icon: '🎮' },
  { id: 'clpopeyepapi', name: 'Popeye Papi', url: '/games/clpopeyepapi.html', icon: '🎮' },
  { id: 'clporklike', name: 'Pork Like', url: '/games/clporklike.html', icon: '🎮' },
  { id: 'clportal', name: 'Portal', url: '/games/clportal.html', icon: '🎮' },
  { id: 'clportal2d', name: 'Portal 2D', url: '/games/clportal2d.html', icon: '🎮' },
  { id: 'clportaldefendersfastbreak', name: 'Portal Defenders Fast Break', url: '/games/clportaldefendersfastbreak.html', icon: '🎮' },
  { id: 'clportalflash', name: 'Portal Flash', url: '/games/clportalflash.html', icon: '🎮' },
  { id: 'clportaldefenderstd', name: 'Portal Defenders TD', url: '/games/clportaldefendersTD.html', icon: '🎮' },
  { id: 'clporter', name: 'Porter', url: '/games/clporter.html', icon: '🎮' },
  { id: 'clportraitofruin', name: 'Portrait of Ruin', url: '/games/clportraitofruin.html', icon: '🎮' },
  { id: 'clpossessquest', name: 'Possess Quest', url: '/games/clpossessquest.html', icon: '⚔️' },
  { id: 'clpostal', name: 'Postal', url: '/games/clpostal.html', icon: '🎮' },
  { id: 'clpotatomanseeksthetroof', name: 'Potato Man Seeks the Troof', url: '/games/clpotatomanseeksthetroof.html', icon: '🎮' },
  { id: 'clpou-1', name: 'Pou', url: '/games/clpou(1).html', icon: '🎮' },
  { id: 'clpowerslave', name: 'Power Slave', url: '/games/clpowerslave.html', icon: '🎮' },
  { id: 'clpraxisfighterx', name: 'Praxis Fighter X', url: '/games/clpraxisfighterx.html', icon: '👊' },
  { id: 'clprebronzeage', name: 'Pre Bronze Age', url: '/games/clprebronzeage.html', icon: '🎮' },
  { id: 'clprecivilationbronzeage', name: 'Precivilization Bronze Age', url: '/games/clprecivilationbronzeage.html', icon: '🎮' },
  { id: 'clprecisionclient', name: 'Precision Client', url: '/games/clprecisionclient.html', icon: '🎮' },
  { id: 'clprehistoricshark', name: 'Prehistoric Shark', url: '/games/clprehistoricshark.html', icon: '🦈' },
  { id: 'clprestigetree', name: 'Prestige Tree', url: '/games/clprestigetree.html', icon: '🌳' },
  { id: 'clprimary', name: 'Primary', url: '/games/clprimary.html', icon: '🎮' },
  { id: 'clprismarine', name: 'Prismarine', url: '/games/clprismarine.html', icon: '🎮' },
  { id: 'clprismclient', name: 'Prism Client', url: '/games/clprismclient.html', icon: '🎮' },
  { id: 'clprowrestling', name: 'Pro Wrestling', url: '/games/clprowrestling.html', icon: '🎮' },
  { id: 'clprocessortycoon', name: 'Processor Tycoon', url: '/games/clprocessortycoon.html', icon: '👆' },
  { id: 'clprofessorlaytonandthecuriousvillage', name: 'Professor Layton and the Curious Village', url: '/games/clprofessorlaytonandthecuriousvillage.html', icon: '🎮' },
  { id: 'clpuckman', name: 'Puckman', url: '/games/clpuckman.html', icon: '👾' },
  { id: 'clpullfrog', name: 'Pull Frog', url: '/games/clpullfrog.html', icon: '🎮' },
  { id: 'clpumpkinrun', name: 'Pumpkin Run', url: '/games/clpumpkinrun.html', icon: '🎮' },
  { id: 'clpunchout', name: 'Punch Out', url: '/games/clpunchout.html', icon: '🥊' },
  { id: 'clpunchthetrump', name: 'Punch the Trump', url: '/games/clpunchthetrump.html', icon: '👊' },
  { id: 'clpuppethockey', name: 'Puppet Hockey', url: '/games/clpuppethockey.html', icon: '🏒' },
  { id: 'clpuppetmaster', name: 'Puppet Master', url: '/games/clpuppetmaster.html', icon: '🎮' },
  { id: 'clpushyourluck', name: 'Push Your Luck', url: '/games/clpushyourluck.html', icon: '🎮' },
  { id: 'clpuyopuyofever', name: 'Puyo Puyo Fever', url: '/games/clpuyopuyofever.html', icon: '🟡' },
  { id: 'clpvz2gardenless', name: 'PvZ 2 Gardenless', url: '/games/clpvz2gardenless.html', icon: '🎮' },
  { id: 'clpvz', name: 'Plants vs Zombies', url: '/games/clpvz.html', icon: '🎮' },
  { id: 'clpvz2', name: 'Plants vs Zombies 2', url: '/games/clpvz2.html', icon: '🎮' },
  { id: 'pvzm', name: 'PvZ Multiplayer', url: '/games/PVZM.html', icon: '🎮' },
  { id: 'clpyrotoad', name: 'PyroToad', url: '/games/clpyrotoad.html', icon: '🍄' },
  { id: 'clqbert', name: 'Qbert', url: '/games/clqbert.html', icon: '🟠' },
  { id: 'clqbertarcade', name: 'Qbert Arcade', url: '/games/clqbertarcade.html', icon: '🟠' },
  { id: 'clqtrewired', name: 'QT Rewired', url: '/games/clqtrewired.html', icon: '🎮' },
  { id: 'clquake', name: 'Quake', url: '/games/clquake.html', icon: '🔫' },
  { id: 'clquake2', name: 'Quake 2', url: '/games/clquake2.html', icon: '🔫' },
  { id: 'clquake64', name: 'Quake 64', url: '/games/clquake64.html', icon: '🔫' },
  { id: 'clquantumclicker', name: 'Quantum Clicker', url: '/games/clQuantumClicker.html', icon: '👆' },
  { id: 'clquickieworld', name: 'Quickie World', url: '/games/clquickieworld.html', icon: '🎮' },
  { id: 'clqwop', name: 'Qwop', url: '/games/clqwop.html', icon: '🎮' },
  { id: 'repo', name: 'R.E.P.O', url: '/games/R.E.P.O%20copy%20copy%20copy.html', icon: '👻' },
  { id: 'clragollhit', name: 'Ragoll Hit', url: '/games/clragollhit.html', icon: '🎮' },
  { id: 'clracemaster3d', name: 'Race Master 3D', url: '/games/clracemaster3d.html', icon: '🏎️' },
  { id: 'clracingarena', name: 'Racing Arena', url: '/games/clracingarena.html', icon: '🏎️' },
  { id: 'clradracer', name: 'Rad Racer', url: '/games/clradracer.html', icon: '🏎️' },
  { id: 'clradicalred', name: 'Radical Red', url: '/games/clradicalred.html', icon: '🎮' },
  { id: 'clraftwars', name: 'Raft Wars', url: '/games/clraftwars.html', icon: '🛶' },
  { id: 'clraftwars2', name: 'Raft Wars 2', url: '/games/clraftwars2.html', icon: '🛶' },
  { id: 'clragdollachivement', name: 'Ragdoll Achievement', url: '/games/clragdollachivement.html', icon: '🎮' },
  { id: 'clragdollarchers', name: 'Ragdoll Archers', url: '/games/clragdollarchers.html', icon: '🎮' },
  { id: 'clragdolldrop', name: 'Ragdoll Drop', url: '/games/clragdolldrop.html', icon: '🎮' },
  { id: 'clragdollhit', name: 'Ragdoll Hit', url: '/games/clragdollhit.html', icon: '🎮' },
  { id: 'clragdoll-io', name: 'Ragdoll IO', url: '/games/clragdoll-io.html', icon: '🎮' },
  { id: 'clragdollrunners', name: 'Ragdoll Runners', url: '/games/clragdollrunners.html', icon: '🏃' },
  { id: 'clragdollsoccer', name: 'Ragdoll Soccer', url: '/games/clragdollsoccer.html', icon: '⚽' },
  { id: 'clrainbowsix', name: 'Rainbow Six', url: '/games/clrainbowsix.html', icon: '🎮' },
  { id: 'clrainbowsixalt', name: 'Rainbow Six Alt', url: '/games/clrainbowsixalt.html', icon: '🎮' },
  { id: 'clraldiscrackhouse', name: 'Raldis Crack House', url: '/games/clraldiscrackhouse.html', icon: '🎮' },
  { id: 'clravenbase', name: 'Raven Base', url: '/games/clravenbase.html', icon: '🏀' },
  { id: 'clray1', name: 'Ray 1', url: '/games/clray1.html', icon: '🎮' },
  { id: 'clray2', name: 'Ray 2', url: '/games/clray2.html', icon: '🎮' },
  { id: 'clrayman', name: 'Rayman', url: '/games/clrayman.html', icon: '🎮' },
  { id: 'clraze', name: 'Raze', url: '/games/clraze.html', icon: '🔫' },
  { id: 'clraze2', name: 'Raze 2', url: '/games/clraze2.html', icon: '🔫' },
  { id: 'clraze3', name: 'Raze 3', url: '/games/clraze3.html', icon: '🔫' },
  { id: 'clre3', name: 'RE3', url: '/games/clre3.html', icon: '🎮' },
  { id: 'clreachthecore', name: 'Reach the Core', url: '/games/clreachthecore.html', icon: '🎮' },
  { id: 'clreacticore', name: 'Reacticore', url: '/games/clreacticore.html', icon: '🎮' },
  { id: 'clrealflightsim', name: 'Real Flight Sim', url: '/games/clrealflightsim.html', icon: '✈️' },
  { id: 'clrebornclient', name: 'Reborn Client', url: '/games/clrebornclient.html', icon: '🎮' },
  { id: 'clrebuild', name: 'Rebuild', url: '/games/clrebuild.html', icon: '🏗️' },
  { id: 'clrebuild2', name: 'Rebuild 2', url: '/games/clrebuild2.html', icon: '🏗️' },
  { id: 'clrecoil', name: 'Recoil', url: '/games/clrecoil.html', icon: '🎮' },
  { id: 'clredalert', name: 'Red Alert', url: '/games/clredalert.html', icon: '🎮' },
  { id: 'clredball2', name: 'Red Ball 2', url: '/games/clredball2.html', icon: '🎮' },
  { id: 'clredball3', name: 'Red Ball 3', url: '/games/clredball3.html', icon: '🎮' },
  { id: 'clredball4', name: 'Red Ball 4', url: '/games/clRedBall4.html', icon: '🎮' },
  { id: 'clredball4vol2', name: 'Red Ball 4 Vol 2', url: '/games/clredball4vol2.html', icon: '🎮' },
  { id: 'clredball4vol3', name: 'Red Ball 4 Vol 3', url: '/games/clredball4vol3.html', icon: '🎮' },
  { id: 'clredhanded', name: 'Red Handed', url: '/games/clredhanded.html', icon: '🎮' },
  { id: 'clredtierunner', name: 'Red Tie Runner', url: '/games/clredtierunner.html', icon: '🏃' },
  { id: 'redvbluefix', name: 'Red vs Blue Fix', url: '/games/redvbluefix.html', icon: '🎮' },
  { id: 'clredvsblue2', name: 'Red vs Blue 2', url: '/games/clredvsblue2.html', icon: '🎮' },
  { id: 'clredvsbluewar', name: 'Red vs Blue War', url: '/games/clredvsbluewar.html', icon: '🪖' },
  { id: 'clredball', name: 'Redball', url: '/games/clredball.html', icon: '🎮' },
  { id: 'clreignofcentipede', name: 'Reign of Centipede', url: '/games/clreignofcentipede.html', icon: '🎮' },
  { id: 'clrepobad', name: 'Repobad', url: '/games/clrepobad.html', icon: '🎮' },
  { id: 'clresentclient', name: 'Resent Client', url: '/games/clresentclient.html', icon: '🎮' },
  { id: 'clresidentevil', name: 'Resident Evil', url: '/games/clresidentevil.html', icon: '🧟' },
  { id: 'clresidentevil2', name: 'Resident Evil 2', url: '/games/clresidentevil2.html', icon: '🧟' },
  { id: 'clresidentevil2d1', name: 'Resident Evil 2D 1', url: '/games/clresidentevil2d1.html', icon: '🧟' },
  { id: 'clresidentevil2d2', name: 'Resident Evil 2D 2', url: '/games/clresidentevil2d2.html', icon: '🧟' },
  { id: 'clresizer', name: 'Resizer', url: '/games/clresizer.html', icon: '🎮' },
  { id: 'clresortempire', name: 'Resort Empire', url: '/games/clresortempire.html', icon: '🏖️' },
  { id: 'clretrobowl', name: 'Retro Bowl', url: '/games/clretrobowl.html', icon: '🏈' },
  { id: 'clretrobowlcollege', name: 'Retro Bowl College', url: '/games/clretrobowlcollege.html', icon: '🏈' },
  { id: 'clretrohighway', name: 'Retro Highway', url: '/games/clretrohighway.html', icon: '🎮' },
  { id: 'clretropingpong', name: 'Retro Ping Pong', url: '/games/clretropingpong.html', icon: '🎮' },
  { id: 'clreturnman', name: 'Return Man', url: '/games/clreturnman.html', icon: '🏈' },
  { id: 'clreturnman2', name: 'Return Man 2', url: '/games/clreturnman2.html', icon: '🏈' },
  { id: 'clreturntoriddleschool', name: 'Return to Riddle School', url: '/games/clreturntoriddleschool.html', icon: '🎮' },
  { id: 'clrevolutionidle', name: 'Revolution Idle', url: '/games/clrevolutionidle.html', icon: '👆' },
  { id: 'clrewrite2', name: 'Rewrite 2', url: '/games/clrewrite2.html', icon: '🎮' },
  { id: 'clrh', name: 'Rh', url: '/games/clrh.html', icon: '🎮' },
  { id: 'clrhythymymheaven', name: 'Rhythmy Mheaven', url: '/games/clrhythymymheaven.html', icon: '🎮' },
  { id: 'clrhythmheaven', name: 'Rhythm Heaven', url: '/games/clrhythmheaven.html', icon: '🥁' },
  { id: 'clricochetkills2', name: 'Ricochet Kills 2', url: '/games/clricochetkills2.html', icon: '🎮' },
  { id: 'clriddle', name: 'Riddle', url: '/games/clriddle.html', icon: '🎮' },
  { id: 'clriddlemiddleschool', name: 'Riddle Middle School', url: '/games/clriddlemiddleschool.html', icon: '🎮' },
  { id: 'clriddleschool', name: 'Riddle School', url: '/games/clriddleschool.html', icon: '🎮' },
  { id: 'clriddleschool2', name: 'Riddle School 2', url: '/games/clriddleschool2.html', icon: '🎮' },
  { id: 'clriddleschool3', name: 'Riddle School 3', url: '/games/clriddleschool3.html', icon: '🎮' },
  { id: 'clriddletransfer', name: 'Riddle Transfer', url: '/games/clriddletransfer.html', icon: '🎮' },
  { id: 'clriddletransfer2', name: 'Riddle Transfer 2', url: '/games/clriddletransfer2.html', icon: '🎮' },
  { id: 'riddleuneversityfix', name: 'Riddle University Fix', url: '/games/riddleuneversityfix.html', icon: '🎮' },
  { id: 'clriddleschool445544444--444-444', name: 'Riddle School (Alt)', url: '/games/clriddleschool445544444$$444$444.html', icon: '🎮' },
  { id: 'clridgeracer', name: 'Ridge Racer', url: '/games/clridgeracer.html', icon: '🏎️' },
  { id: 'clrisehigher', name: 'Rise Higher', url: '/games/clrisehigher.html', icon: '🎮' },
  { id: 'clristar', name: 'Ristar', url: '/games/clristar.html', icon: '🌌' },
  { id: 'clroadfighter', name: 'Road Fighter', url: '/games/clroadfighter.html', icon: '🥊' },
  { id: 'clroadoffury', name: 'Road of Fury', url: '/games/clroadoffury.html', icon: '🎮' },
  { id: 'clroadofthedead', name: 'Road of the Dead', url: '/games/clroadofthedead.html', icon: '🧟' },
  { id: 'clroadofthedead2', name: 'Road of the Dead 2', url: '/games/clroadofthedead2.html', icon: '🧟' },
  { id: 'clroadrunnernes', name: 'Roadrunner NES', url: '/games/clroadrunnernes.html', icon: '🏃' },
  { id: 'clrocketgoalio', name: 'Rocket Go Alio', url: '/games/clrocketgoalio.html', icon: '🌌' },
  { id: 'clrocketjump', name: 'Rocket Jump', url: '/games/clrocketjump.html', icon: '🚀' },
  { id: 'clrocketknight2--1', name: 'Rocket Knight 2', url: '/games/clrocketknight2%20(1).html', icon: '⚔️' },
  { id: 'clrocketknightadventures', name: 'Rocket Knight Adventures', url: '/games/clrocketknightadventures.html', icon: '⚔️' },
  { id: 'clrocketleague', name: 'Rocket League', url: '/games/clrocketleague.html', icon: '🚗' },
  { id: 'clrocketsoccerderby', name: 'Rocket Soccer Derby', url: '/games/clrocketsoccerderby.html', icon: '⚽' },
  { id: 'clrodha', name: 'Rodha', url: '/games/clrodha.html', icon: '🎮' },
  { id: 'clroguesoul', name: 'Rogue Soul', url: '/games/clroguesoul.html', icon: '🎮' },
  { id: 'clroguesoul2', name: 'Rogue Soul 2', url: '/games/clroguesoul2.html', icon: '🎮' },
  { id: 'clrollyvortex', name: 'Rolly Vortex', url: '/games/clrollyvortex.html', icon: '🎮' },
  { id: 'clrollerballer', name: 'Rollerballer', url: '/games/clrollerballer.html', icon: '🎮' },
  { id: 'clrollingsky', name: 'Rolling Sky', url: '/games/clrollingsky.html', icon: '🎮' },
  { id: 'clrolypolymonster', name: 'Roly Poly Monster', url: '/games/clrolypolymonster.html', icon: '🎮' },
  { id: 'clrooftoprun', name: 'Rooftop Run', url: '/games/clrooftoprun.html', icon: '🎮' },
  { id: 'clrooftopsnipers', name: 'Rooftop Snipers', url: '/games/clrooftopsnipers.html', icon: '🎯' },
  { id: 'clrooftopsnipers2', name: 'Rooftop Snipers 2', url: '/games/clrooftopsnipers2.html', icon: '🎯' },
  { id: 'clroomclicker', name: 'Room Clicker', url: '/games/clroomclicker.html', icon: '👆' },
  { id: 'clrosegold', name: 'Rose Gold', url: '/games/clrosegold.html', icon: '🎮' },
  { id: 'clrotate', name: 'Rotate', url: '/games/clrotate.html', icon: '🎮' },
  { id: 'clroulettehero', name: 'Roulette Hero', url: '/games/clroulettehero.html', icon: '🎮' },
  { id: 'clrouletteknight', name: 'Roulette Knight', url: '/games/clrouletteknight.html', icon: '🎴' },
  { id: 'clrun', name: 'Run', url: '/games/clrun.html', icon: '🏃' },
  { id: 'clrun2', name: 'Run 2', url: '/games/clrun2.html', icon: '🏃' },
  { id: 'clrunningfred', name: 'Running Fred', url: '/games/clrunningfred.html', icon: '🏃' },
  { id: 'clrussianbuckshot', name: 'Russian Buckshot', url: '/games/clrussianbuckshot.html', icon: '🎮' },
  { id: 'clrussiancardriver', name: 'Russian Card River', url: '/games/clrussiancardriver.html', icon: '🏎️' },
  { id: 'clrussiansandbox', name: 'Russian Sandbox', url: '/games/clrussiansandbox.html', icon: '🎮' },
  { id: 'clsaihatestation', name: 'Saihate Station', url: '/games/clsaihatestation.html', icon: '🎮' },
  { id: 'clsandtris', name: 'Sandtris', url: '/games/clsandtris.html', icon: '🎮' },
  { id: 'clsandboxcity', name: 'Sandbox City', url: '/games/clsandboxcity.html', icon: '🎮' },
  { id: 'clsandboxels', name: 'Sandboxels', url: '/games/clsandboxels.html', icon: '🎮' },
  { id: 'clsandsofthecoliseum', name: 'Sands of the Coliseum', url: '/games/clsandsofthecoliseum.html', icon: '🎮' },
  { id: 'clsandstone-1', name: 'Sandstone', url: '/games/clsandstone(1).html', icon: '🎮' },
  { id: 'clsantarun', name: 'Santa Run', url: '/games/clsantarun.html', icon: '🎮' },
  { id: 'clsanty', name: 'Santy', url: '/games/clsanty.html', icon: '🎮' },
  { id: 'clsaszombieassault2', name: 'Sas Zombie Assault 2', url: '/games/clsaszombieassault2.html', icon: '🧟' },
  { id: 'clsatryn', name: 'Satryn', url: '/games/clsatryn.html', icon: '🎮' },
  { id: 'clsaulgoodmanrun', name: 'Saul Goodman Run', url: '/games/clsaulgoodmanrun.html', icon: '🎮' },
  { id: 'clsausageflip', name: 'Sausage Flip', url: '/games/clsausageflip.html', icon: '🎮' },
  { id: 'clsayorisnotebook', name: "Sayori's Notebook", url: '/games/clsayorisnotebook.html', icon: '🎮' },
  { id: 'clscalethedepths', name: 'Scale the Depths', url: '/games/clscalethedepths.html', icon: '🎮' },
  { id: 'clscarletandviolet', name: 'Scarlet and Violet', url: '/games/clscarletandviolet.html', icon: '🎮' },
  { id: 'clscarletshift', name: 'Scarlet Shift', url: '/games/clscarletshift.html', icon: '🎮' },
  { id: 'clscarymazegame', name: 'Scary Maze Game', url: '/games/clscarymazegame.html', icon: '😱' },
  { id: 'clscaryshawarma', name: 'Scary Shawarma', url: '/games/clscaryshawarma.html', icon: '😱' },
  { id: 'clscaryteacher3d', name: 'Scary Teacher 3D', url: '/games/clscaryteacher3d.html', icon: '😱' },
  { id: 'clschoolboyrunaway', name: 'Schoolboy Runaway', url: '/games/clschoolboyrunaway.html', icon: '🎮' },
  { id: 'clscrapmetal3', name: 'Scrap Metal 3', url: '/games/clscrapmetal3.html', icon: '🎮' },
  { id: 'clscrapyarddog', name: 'Scrap Yard Dog', url: '/games/clscrapyarddog.html', icon: '🎮' },
  { id: 'clscratchoptions', name: 'Scratch Options', url: '/games/clscratchoptions.html', icon: '🎮' },
  { id: 'clscribblenauts', name: 'Scribblenauts', url: '/games/clscribblenauts.html', icon: '🎮' },
  { id: 'clscubabear', name: 'Scuba Bear', url: '/games/clscubabear.html', icon: '🎮' },
  { id: 'clsd-thewar', name: 'Sd Thewar', url: '/games/clsd-thewar.html', icon: '🪖' },
  { id: 'clsdf', name: 'Sdf', url: '/games/clsdf.html', icon: '🎮' },
  { id: 'clseamongrel', name: 'Sea Mongrel', url: '/games/clseamongrel.html', icon: '🐟' },
  { id: 'clsecretofmana', name: 'Secret of Man a', url: '/games/clsecretofmana.html', icon: '🎮' },
  { id: 'clsega2gg', name: 'Sega 2 Gg', url: '/games/clsega2gg.html', icon: '🎮' },
  { id: 'clsegasonicthehedgehog', name: 'Sega Sonic the Hedgehog', url: '/games/clSegaSonicTheHedgehog.html', icon: '💨' },
  { id: 'clself', name: 'Self', url: '/games/clself.html', icon: '🎮' },
  { id: 'clsentryfortress', name: 'Sentry Fortress', url: '/games/clsentryfortress.html', icon: '🎮' },
  { id: 'clserenitrove', name: 'Sere Nitro Ve', url: '/games/clserenitrove.html', icon: '🎮' },
  { id: 'clserioussamadvance', name: 'Serious Sam Advance', url: '/games/clserioussamadvance.html', icon: '🎮' },
  { id: 'clservingupmadness', name: 'Serving Up Madness', url: '/games/clservingupmadness.html', icon: '🎮' },
  { id: 'clsevendays', name: 'Seven Days', url: '/games/clsevendays.html', icon: '🎮' },
  { id: 'clsfk', name: 'Sfk', url: '/games/clsfk.html', icon: '🎮' },
  { id: 'clsfk2', name: 'Sfk 2', url: '/games/clsfk2.html', icon: '🎮' },
  { id: 'clsfklaststand', name: 'Sfk Last Stand', url: '/games/clsfklaststand.html', icon: '🎮' },
  { id: 'clsfkleague', name: 'Sfk League', url: '/games/clsfkleague.html', icon: '🎮' },
  { id: 'clshwultimatem', name: 'Sh Wultimate M', url: '/games/clshwultimatem.html', icon: '🎮' },
  { id: 'clshadowcourier', name: 'Shadow Courier', url: '/games/clshadowcourier.html', icon: '🎮' },
  { id: 'clshadowdancer', name: 'Shadow Dancer', url: '/games/clshadowdancer.html', icon: '🎵' },
  { id: 'clshadowdancersecret', name: 'Shadow Dancer Secret', url: '/games/clshadowdancersecret.html', icon: '🎵' },
  { id: 'clshaggy--1', name: 'Shaggy', url: '/games/clshaggy%20(1).html', icon: '🎮' },
  { id: 'clshantaegb', name: 'Shan Tae Gb', url: '/games/clshantaegb.html', icon: '🎮' },
  { id: 'clshapetransform', name: 'Shape Transform', url: '/games/clshapetransform.html', icon: '🎮' },
  { id: 'clshc1', name: 'Shc 1', url: '/games/clshc1.html', icon: '🎮' },
  { id: 'clshc2', name: 'Shc 2', url: '/games/clshc2.html', icon: '🎮' },
  { id: 'clshc3', name: 'Shc 3', url: '/games/clshc3.html', icon: '🎮' },
  { id: 'clshift', name: 'Shift', url: '/games/clshift.html', icon: '🎮' },
  { id: 'clshift2', name: 'Shift 2', url: '/games/clshift2.html', icon: '🎮' },
  { id: 'clshift3', name: 'Shift 3', url: '/games/clshift3.html', icon: '🎮' },
  { id: 'clshiftatmidnight', name: 'Shift at Midnight', url: '/games/clshiftatmidnight.html', icon: '🎮' },
  { id: 'clshinmegamitenseidevilsurvivor', name: 'Shin Mega Mi Tense Idevil Survivor', url: '/games/clshinmegamitenseidevilsurvivor.html', icon: '🎮' },
  { id: 'clshinobi', name: 'Shinobi', url: '/games/clshinobi.html', icon: '🎮' },
  { id: 'clshinobi3', name: 'Shinobi 3', url: '/games/clshinobi3.html', icon: '🎮' },
  { id: 'clshinobirevenge', name: 'Shinobi Revenge', url: '/games/clshinobirevenge.html', icon: '🎮' },
  { id: 'clshoppingcarthero', name: 'Shopping Cart Hero', url: '/games/clshoppingcarthero.html', icon: '🎮' },
  { id: 'clshortlife', name: 'Short Life', url: '/games/clshortlife.html', icon: '🎮' },
  { id: 'clshotout4', name: 'Shot Out 4', url: '/games/clshotout4.html', icon: '🎮' },
  { id: 'clshredmill', name: 'Shred Mill', url: '/games/clshredmill.html', icon: '🎮' },
  { id: 'clshrek-2', name: 'Shrek 2', url: '/games/clshrek-2.html', icon: '🎮' },
  { id: 'clshrubnaut', name: 'Shrub Naut', url: '/games/clshrubnaut.html', icon: '🎮' },
  { id: 'clsideeffects', name: 'Side Effects', url: '/games/clsideeffects.html', icon: '🎮' },
  { id: 'clsidepocket', name: 'Side Pocket', url: '/games/clsidepocket.html', icon: '🎮' },
  { id: 'clsierra7', name: 'Sierra 7', url: '/games/clsierra7.html', icon: '🎮' },
  { id: 'clsilenthill', name: 'Silent Hill', url: '/games/clsilenthill.html', icon: '🎮' },
  { id: 'clsilenthillalt', name: 'Silent Hill Alt', url: '/games/clsilenthillalt.html', icon: '🎮' },
  { id: 'clsilk', name: 'Silk', url: '/games/clsilk.html', icon: '🎮' },
  { id: 'clsilkmelody', name: 'Silk Melody', url: '/games/clsilkmelody.html', icon: '🎮' },
  { id: 'clsiloshowdow', name: 'Silo Show Dow', url: '/games/clsiloshowdow.html', icon: '🎮' },
  { id: 'clsilver', name: 'Silver', url: '/games/clsilver.html', icon: '🎮' },
  { id: 'clsimcity64', name: 'Simcity 64', url: '/games/clsimcity64.html', icon: '🎮' },
  { id: 'clsimpsonsarcade', name: 'Simpsons Arcade', url: '/games/clsimpsonsarcade.html', icon: '🎮' },
  { id: 'clsinglefile', name: 'Single File', url: '/games/clSINGLEFILE.html', icon: '🎮' },
  { id: 'clsixwaystodie', name: 'Six Ways to Die', url: '/games/clsixwaystodie.html', icon: '🎮' },
  { id: 'clskateordie', name: 'Skate or Die', url: '/games/clskateordie.html', icon: '🎮' },
  { id: 'clskateit', name: 'Skateit', url: '/games/clskateit.html', icon: '🎮' },
  { id: 'clskibidiinthebackrooms', name: 'Ski Bidi in the Back Rooms', url: '/games/clskibidiinthebackrooms.html', icon: '🏂' },
  { id: 'clskibidishooter', name: 'Ski Bidi Shooter', url: '/games/clskibidishooter.html', icon: '🔫' },
  { id: 'clskibididibidygyattohiorizzingallovertheplacestillwatermang', name: 'Skibi Didi Bid Yg Yat to Hi or Izz in Gall Over the Place Stillwater Mango Theory Fem Boy Drool', url: '/games/clskibididibidygyattohiorizzingallovertheplacestillwatermangotheoryfemboydrool.html', icon: '🏂' },
  { id: 'clskinwalker', name: 'Skin Walker', url: '/games/clskinwalker.html', icon: '🏂' },
  { id: 'clskong', name: 'Skong', url: '/games/clskong.html', icon: '🎮' },
  { id: 'clskyfactory', name: 'Sky Factory', url: '/games/clskyfactory.html', icon: '🎮' },
  { id: 'clskywire2', name: 'Sky Wire 2', url: '/games/clskywire2.html', icon: '🎮' },
  { id: 'clskyrace-3d', name: 'Skyrace 3D', url: '/games/clskyrace-3d.html', icon: '🏎️' },
  { id: 'clskywire', name: 'Skywire', url: '/games/clskywire.html', icon: '🎮' },
  { id: 'clslalomnes', name: 'Slalom NES', url: '/games/clslalomnes.html', icon: '🎮' },
  { id: 'clslendytubbies', name: 'Slend Ytubb Ies', url: '/games/clslendytubbies.html', icon: '🎮' },
  { id: 'clslenderman', name: 'Slender Man', url: '/games/clslenderman.html', icon: '🧟' },
  { id: 'clsliceitall', name: 'Slice It All', url: '/games/clsliceitall.html', icon: '🎮' },
  { id: 'clslideinthewoods', name: 'Slide in the Woods', url: '/games/clslideinthewoods.html', icon: '🎮' },
  { id: 'clslimelabratory', name: 'Slime la Bra Tory', url: '/games/clslimelabratory.html', icon: '🎮' },
  { id: 'clslipways', name: 'Slip Ways', url: '/games/clslipways.html', icon: '🎮' },
  { id: 'clslitherio', name: 'Slither IO', url: '/games/clslitherio.html', icon: '🎮' },
  { id: 'clslope', name: 'Slope', url: '/games/clslope.html', icon: '⛷️' },
  { id: 'clslope2player', name: 'Slope 2 Player', url: '/games/clslope2player.html', icon: '⛷️' },
  { id: 'clslope3', name: 'Slope 3', url: '/games/clslope3.html', icon: '⛷️' },
  { id: 'clslopeplus', name: 'Slope Plus', url: '/games/clslopeplus.html', icon: '⛷️' },
  { id: 'clslotornot', name: 'Slot or Not', url: '/games/clslotornot.html', icon: '🎮' },
  { id: 'clslowroads', name: 'Slow Roads', url: '/games/clslowroads.html', icon: '🎮' },
  { id: 'clsm63redux', name: 'Sm 63 Red Ux', url: '/games/clsm63redux.html', icon: '🎮' },
  { id: 'clsmadvance2', name: 'Sm Advance 2', url: '/games/clsmadvance2.html', icon: '🎮' },
  { id: 'clsmadvance3', name: 'Sm Advance 3', url: '/games/clsmadvance3.html', icon: '🎮' },
  { id: 'clsm64greenstars', name: 'Sm64 Green Stars', url: '/games/clsm64greenstars.html', icon: '🌌' },
  { id: 'clsm64hiddenstars', name: 'Sm64 Hidden Stars', url: '/games/clsm64hiddenstars.html', icon: '🌌' },
  { id: 'clsm64lastimpact', name: 'Sm64 Last Impact', url: '/games/clsm64lastimpact.html', icon: '🎮' },
  { id: 'clsm64liminaldream', name: 'Sm64 Lim in Al Dream', url: '/games/clsm64liminaldream.html', icon: '🎮' },
  { id: 'clsm64oot', name: 'Sm64 Oot', url: '/games/clsm64oot.html', icon: '🎮' },
  { id: 'clsm64sapphire', name: 'Sm64 Sapphire', url: '/games/clsm64sapphire.html', icon: '🎮' },
  { id: 'smash-hit-ripoff', name: 'Smash Hit Ripoff', url: '/games/Smash%20Hit%20Ripoff.html', icon: '🥊' },
  { id: 'clsmashkarts', name: 'Smash Karts', url: '/games/clsmashkarts.html', icon: '🥊' },
  { id: 'clsmashkartsworking', name: 'Smash Karts Working', url: '/games/clsmashkartsworking.html', icon: '🥊' },
  { id: 'clsmashremix', name: 'Smash Remix', url: '/games/clsmashremix.html', icon: '🥊' },
  { id: 'clsmashremix2-0-1', name: 'Smashremix 2.0.1', url: '/games/clsmashremix2.0.1.html', icon: '🥊' },
  { id: 'clsmb12', name: 'SMB 12', url: '/games/clsmb12.html', icon: '🎮' },
  { id: 'clsmbcrossover', name: 'SMB Crossover', url: '/games/clsmbcrossover.html', icon: '🎮' },
  { id: 'clsmbgameover', name: 'SMB Game Over', url: '/games/clsmbgameover.html', icon: '🎮' },
  { id: 'clsmbremastered', name: 'SMB Remastered', url: '/games/clsmbremastered.html', icon: '🎮' },
  { id: 'clsmbc', name: 'Smbc', url: '/games/clsmbc.html', icon: '🎮' },
  { id: 'clsmc', name: 'Smc', url: '/games/clsmc.html', icon: '🎮' },
  { id: 'clsmgds', name: 'Smgds', url: '/games/clsmgds.html', icon: '🎮' },
  { id: 'clsnailbob', name: 'Snail Bob', url: '/games/clsnailbob.html', icon: '🎮' },
  { id: 'clsnailbob2', name: 'Snail Bob 2', url: '/games/clsnailbob2.html', icon: '🎮' },
  { id: 'clsnailbob3', name: 'Snail Bob 3', url: '/games/clsnailbob3.html', icon: '🎮' },
  { id: 'clsnailbob4space', name: 'Snail Bob 4 Space', url: '/games/clsnailbob4space.html', icon: '🌌' },
  { id: 'clsnailbob5lovestory', name: 'Snail Bob 5 Lovestory', url: '/games/clsnailbob5lovestory.html', icon: '🎮' },
  { id: 'clsnakelike', name: 'Snake Like', url: '/games/clsnakelike.html', icon: '🎮' },
  { id: 'clsnakeis', name: 'Snakeis', url: '/games/clsnakeis.html', icon: '🎮' },
  { id: 'clsnipershot', name: 'Sniper Shot', url: '/games/clsnipershot.html', icon: '🔫' },
  { id: 'clsniperv2', name: 'Sniper V2', url: '/games/clsniperv2.html', icon: '🔫' },
  { id: 'clsnowbros--1', name: 'Snow Bros', url: '/games/clsnowbros%20(1).html', icon: '🏂' },
  { id: 'clsnowbrosgenesis', name: 'Snow Bros Genesis', url: '/games/clSnowBrosGenesis.html', icon: '🏂' },
  { id: 'clsnowbrothers', name: 'Snow Brothers', url: '/games/clsnowbrothers.html', icon: '🏂' },
  { id: 'clsnowrideee', name: 'Snow Ride Ee', url: '/games/clsnowrideee.html', icon: '🏂' },
  { id: 'clsnowrider', name: 'Snow Rider', url: '/games/clsnowrider.html', icon: '🏂' },
  { id: 'snow-rider', name: 'Snow Rider 3D', url: '/games/snow-rider.html', icon: '🏂' },
  { id: 'clsnowridergoodygumdrops', name: 'Snow Rider Goody Gumdrops', url: '/games/clsnowridergoodygumdrops.html', icon: '🏂' },
  { id: 'clsnowriderrrr', name: 'Snow Rider Rrr', url: '/games/clsnowriderrrr.html', icon: '🏂' },
  { id: 'clsnowroad', name: 'Snow Road', url: '/games/clsnowroad.html', icon: '🏂' },
  { id: 'snowwhite', name: 'Snow White', url: '/games/snowwhite.html', icon: '🏂' },
  { id: 'clsnowballio', name: 'Snowball IO', url: '/games/clsnowballio.html', icon: '🏂' },
  { id: 'clsnowboardobby', name: 'Snowboard Ob by', url: '/games/clsnowboardobby.html', icon: '🏃' },
  { id: 'clsnowdrift', name: 'Snowdrift', url: '/games/clsnowdrift.html', icon: '🏂' },
  { id: 'clsnowrid', name: 'Snowrid', url: '/games/clsnowrid.html', icon: '🏂' },
  { id: 'clsoccerbros', name: 'Soccer Bros', url: '/games/clsoccerbros.html', icon: '⚽' },
  { id: 'clsoccernes', name: 'Soccer NES', url: '/games/clsoccernes.html', icon: '⚽' },
  { id: 'clsoccerrandom', name: 'Soccer Random', url: '/games/clsoccerrandom.html', icon: '⚽' },
  { id: 'clsoccerrandomgood', name: 'Soccer Random Good', url: '/games/clsoccerrandomgood.html', icon: '⚽' },
  { id: 'clsodasimulator', name: 'Soda Simulator', url: '/games/clsodasimulator.html', icon: '🎮' },
  { id: 'clsolatrobo', name: 'Sola Tro Bo', url: '/games/clsolatrobo.html', icon: '🎮' },
  { id: 'clsolarclient', name: 'Solar Client', url: '/games/clsolarclient.html', icon: '🎮' },
  { id: 'clsolarsandbox', name: 'Solar Sandbox', url: '/games/clsolarsandbox.html', icon: '🎮' },
  { id: 'clsolarsmash', name: 'Solar Smash', url: '/games/clsolarsmash.html', icon: '🥊' },
  { id: 'clsolitaire', name: 'Solitaire', url: '/games/clsolitaire.html', icon: '✈️' },
  { id: 'clsolstice', name: 'Solstice', url: '/games/clsolstice.html', icon: '🎮' },
  { id: 'clsomari64', name: 'Somari 64', url: '/games/clsomari64.html', icon: '🎮' },
  { id: 'clsoniceexeog', name: 'Son Ice Exe Og', url: '/games/clsoniceexeog.html', icon: '💨' },
  { id: 'clsonicerazor', name: 'Son Ice Razor', url: '/games/clsonicerazor.html', icon: '💨' },
  { id: 'clsonic1contemporary', name: 'Sonic 1 Contemporary', url: '/games/clsonic1contemporary.html', icon: '💨' },
  { id: 'clsonic1mobile', name: 'Sonic 1 Mobile', url: '/games/clsonic1mobile.html', icon: '💨' },
  { id: 'clsonic2mobile', name: 'Sonic 2 Mobile', url: '/games/clsonic2mobile.html', icon: '💨' },
  { id: 'clsonic2pinkedition', name: 'Sonic 2 Pink Edition', url: '/games/clsonic2pinkedition.html', icon: '💨' },
  { id: 'clsonic2timeandplace', name: 'Sonic 2 Time and Place', url: '/games/clsonic2timeandplace.html', icon: '💨' },
  { id: 'clsonic3andknuckles', name: 'Sonic 3 and Knuckles', url: '/games/clsonic3andknuckles.html', icon: '💨' },
  { id: 'clsonic3andsally', name: 'Sonic 3 and Sally', url: '/games/clsonic3andsally.html', icon: '💨' },
  { id: 'clsonic3complete', name: 'Sonic 3 Complete', url: '/games/clsonic3complete.html', icon: '💨' },
  { id: 'clsonic3dblast', name: 'Sonic 3 Dblast', url: '/games/clsonic3dblast.html', icon: '💨' },
  { id: 'clsonic3dblastdx', name: 'Sonic 3 Dblast DX', url: '/games/clsonic3dblastdx.html', icon: '💨' },
  { id: 'clsonicadvance', name: 'Sonic Advance', url: '/games/clsonicadvance.html', icon: '💨' },
  { id: 'clsonicadvance2', name: 'Sonic Advance 2', url: '/games/clsonicadvance2.html', icon: '💨' },
  { id: 'clsonicadvance2sp', name: 'Sonic Advance 2 Sp', url: '/games/clsonicadvance2sp.html', icon: '💨' },
  { id: 'clsonicadvance3', name: 'Sonic Advance 3', url: '/games/clsonicadvance3.html', icon: '💨' },
  { id: 'clsonicandashuro', name: 'Sonic and Ash Uro', url: '/games/clsonicandashuro.html', icon: '💨' },
  { id: 'clsonicandfallingstar', name: 'Sonic and Falling Star', url: '/games/clsonicandfallingstar.html', icon: '💨' },
  { id: 'clsonicandknuckles', name: 'Sonic and Knuckles', url: '/games/clsonicandknuckles.html', icon: '💨' },
  { id: 'clsonicbattle', name: 'Sonic Battle', url: '/games/clsonicbattle.html', icon: '💨' },
  { id: 'clsonicblast', name: 'Sonic Blast', url: '/games/clsonicblast.html', icon: '💨' },
  { id: 'clsoniccdmobile', name: 'Sonic Cd Mobile', url: '/games/clsoniccdmobile.html', icon: '💨' },
  { id: 'clsonicchaos', name: 'Sonic Chaos', url: '/games/clsonicchaos.html', icon: '💨' },
  { id: 'clsonicclassiccollection', name: 'Sonic Classic Collection', url: '/games/clsonicclassiccollection.html', icon: '💨' },
  { id: 'clsonicclassicheroes-1', name: 'Sonic Classic Heroes', url: '/games/clsonicclassicheroes(1).html', icon: '💨' },
  { id: 'clsonicclassics', name: 'Sonic Classics', url: '/games/clSonicClassics.html', icon: '💨' },
  { id: 'clsoniccolors', name: 'Sonic Colors', url: '/games/clsoniccolors.html', icon: '💨' },
  { id: 'clsonicdeltaorigins', name: 'Sonic Delta Origins', url: '/games/clsonicdeltaorigins.html', icon: '💨' },
  { id: 'clsonicdrift', name: 'Sonic Drift', url: '/games/clsonicdrift.html', icon: '💨' },
  { id: 'clsonicdrift2', name: 'Sonic Drift 2', url: '/games/clsonicdrift2.html', icon: '💨' },
  { id: 'clsonichellfiresaga', name: 'Sonic Hellfire Saga', url: '/games/clSonicHellfireSaga.html', icon: '💨' },
  { id: 'clsonicinsmw', name: 'Sonic in SMW', url: '/games/clSonicinSMW.html', icon: '💨' },
  { id: 'clsonicjam', name: 'Sonic Jam', url: '/games/clsonicjam.html', icon: '💨' },
  { id: 'clsoniclabyrinth', name: 'Sonic Labyrinth', url: '/games/clsoniclabyrinth.html', icon: '💨' },
  { id: 'clsonicmania', name: 'Sonic Mania', url: '/games/clsonicmania.html', icon: '💨' },
  { id: 'clsonicmaniaplus', name: 'Sonic Mania Plus', url: '/games/clsonicmaniaplus.html', icon: '💨' },
  { id: 'clsonicmegamix', name: 'Sonic Mega Mix', url: '/games/clsonicmegamix.html', icon: '💨' },
  { id: 'clsonicmon', name: 'Sonic Mon', url: '/games/clsonicmon.html', icon: '💨' },
  { id: 'clsonicmushroomblast', name: 'Sonic Mushroom Blast', url: '/games/clsonicmushroomblast.html', icon: '💨' },
  { id: 'clsonicpocketadventure', name: 'Sonic Pocket Adventure', url: '/games/clsonicpocketadventure.html', icon: '💨' },
  { id: 'clsonicralt', name: 'Sonic Ralt', url: '/games/clsonicralt.html', icon: '💨' },
  { id: 'clsonicrevert', name: 'Sonic Revert', url: '/games/clsonicrevert.html', icon: '💨' },
  { id: 'clsonicrush', name: 'Sonic Rush', url: '/games/clsonicrush.html', icon: '💨' },
  { id: 'clsonicrushadventure', name: 'Sonic Rush Adventure', url: '/games/clsonicrushadventure.html', icon: '💨' },
  { id: 'clsonicscorchedquest', name: 'Sonic Scorched Quest', url: '/games/clsonicscorchedquest.html', icon: '💨' },
  { id: 'clsonicthehedgehog', name: 'Sonic the Hedgehog', url: '/games/clsonicthehedgehog.html', icon: '💨' },
  { id: 'clsonicthehedgehog2', name: 'Sonic the Hedgehog 2', url: '/games/clsonicthehedgehog2.html', icon: '💨' },
  { id: 'clsonicthehedgehog3', name: 'Sonic the Hedgehog 3', url: '/games/clsonicthehedgehog3.html', icon: '💨' },
  { id: 'clsoniccd', name: 'Soniccd', url: '/games/clsoniccd.html', icon: '💨' },
  { id: 'clsonicgg', name: 'Sonicgg', url: '/games/clsonicgg.html', icon: '💨' },
  { id: 'clsonicr', name: 'Sonicr', url: '/games/clsonicr.html', icon: '💨' },
  { id: 'clsonicspinball', name: 'Sonics Pinball', url: '/games/clsonicspinball.html', icon: '💨' },
  { id: 'clsonny2', name: 'Sonny 2', url: '/games/clsonny2.html', icon: '🎮' },
  { id: 'clsortthecourt', name: 'Sort the Court', url: '/games/clsortthecourt.html', icon: '🎮' },
  { id: 'clsotn', name: 'Sotn', url: '/games/clsotn.html', icon: '🎮' },
  { id: 'clsouljumper', name: 'Soul Jumper', url: '/games/clsouljumper.html', icon: '🏃' },
  { id: 'clsouthparkn64', name: 'South Park N64', url: '/games/clsouthparkn64.html', icon: '🎮' },
  { id: 'clspacebarclicker', name: 'Space Bar Click Er', url: '/games/clspacebarclicker.html', icon: '👆' },
  { id: 'clspacecompany', name: 'Space Company', url: '/games/clspacecompany.html', icon: '🌌' },
  { id: 'clspaceharriersms', name: 'Space Harriers Ms', url: '/games/clspaceharriersms.html', icon: '🌌' },
  { id: 'clspaceinvade95', name: 'Space Invade 95', url: '/games/clspaceinvade95.html', icon: '🌌' },
  { id: 'clspaceinvaders', name: 'Space Invaders', url: '/games/clspaceinvaders.html', icon: '🌌' },
  { id: 'clspaceiskey', name: 'Space Is Key', url: '/games/clspaceiskey.html', icon: '🌌' },
  { id: 'clspaceiskey2', name: 'Space Is Key 2', url: '/games/clspaceiskey2.html', icon: '🌌' },
  { id: 'clspaceiskeyxmas', name: 'Space Is Key Xmas', url: '/games/clspaceiskeyxmas.html', icon: '🌌' },
  { id: 'clspacewarsbattleground', name: 'Space Wars Battleground', url: '/games/clspacewarsbattleground.html', icon: '🪖' },
  { id: 'clspecialmission', name: 'Special Mission', url: '/games/clspecialmission.html', icon: '🎮' },
  { id: 'clspeedperclick', name: 'Speed Per Click', url: '/games/clspeedperclick.html', icon: '🏎️' },
  { id: 'clspeedstars', name: 'Speed Stars', url: '/games/clspeedstars.html', icon: '🏎️' },
  { id: 'clspelunky', name: 'Spel Unky', url: '/games/clspelunky.html', icon: '🎮' },
  { id: 'clspewer', name: 'Spewer', url: '/games/clspewer.html', icon: '🎮' },
  { id: 'clspidermanps1', name: 'Spiderman Ps 1', url: '/games/clspidermanps1.html', icon: '🎮' },
  { id: 'clspiralroll', name: 'Spiral Roll', url: '/games/clspiralroll.html', icon: '🎮' },
  { id: 'clspiritsofhell', name: 'Spirits of Hell', url: '/games/clspiritsofhell.html', icon: '🎮' },
  { id: 'clsprinter', name: 'Sprinter', url: '/games/clsprinter.html', icon: '🎮' },
  { id: 'clsprunked', name: 'Sprunk Ed', url: '/games/clsprunked.html', icon: '🎮' },
  { id: 'clsprunkiclicker', name: 'Sprunk Iclick Er', url: '/games/clsprunkiclicker.html', icon: '👆' },
  { id: 'clsprunkipyramixed', name: 'Sprunk Ipyr Amixed', url: '/games/clsprunkipyramixed.html', icon: '🎮' },
  { id: 'clsprunki', name: 'Sprunki', url: '/games/clsprunki.html', icon: '🎮' },
  { id: 'clspyhunter', name: 'Spy Hunter', url: '/games/clspyhunter.html', icon: '🎮' },
  { id: 'clsquidplayground', name: 'Squid Playground', url: '/games/clsquidplayground.html', icon: '🎮' },
  { id: 'clstackballio', name: 'Stack Ball IO', url: '/games/clstackballio.html', icon: '🎮' },
  { id: 'clstacktris', name: 'Stacktris', url: '/games/clstacktris.html', icon: '🎮' },
  { id: 'clstackydash', name: 'Stacky Dash', url: '/games/clstackydash.html', icon: '🎮' },
  { id: 'clstarfox64', name: 'Star Fox 64', url: '/games/clstarfox64.html', icon: '🌌' },
  { id: 'clstarlike', name: 'Star Like', url: '/games/clstarlike.html', icon: '🌌' },
  { id: 'clstarraiders', name: 'Star Raiders', url: '/games/clstarraiders.html', icon: '🌌' },
  { id: 'clstarfox', name: 'Starfox', url: '/games/clstarfox.html', icon: '🌌' },
  { id: 'clstateio', name: 'Stateio', url: '/games/clstateio.html', icon: '🎮' },
  { id: 'clstation141', name: 'Station 141', url: '/games/clstation141.html', icon: '🎮' },
  { id: 'clstationmeltdown', name: 'Station Meltdown', url: '/games/clstationmeltdown.html', icon: '🎮' },
  { id: 'clstationsaturn', name: 'Station Saturn', url: '/games/clstationsaturn.html', icon: '🎮' },
  { id: 'clsteakandjake', name: 'Steak and Jake', url: '/games/clsteakandjake.html', icon: '🎮' },
  { id: 'clstealbrainrot', name: 'Steal Brain Rot', url: '/games/clstealbrainrot.html', icon: '🎮' },
  { id: 'clstealbrainrotonline', name: 'Steal Brain Rot Online', url: '/games/clstealbrainrotonline.html', icon: '🎮' },
  { id: 'clstealthassassin', name: 'Stealth Assassin', url: '/games/clstealthassassin.html', icon: '🎮' },
  { id: 'clstealthmaster', name: 'Stealth Master', url: '/games/clstealthmaster.html', icon: '🎮' },
  { id: 'clsteelempire', name: 'Steel Empire', url: '/games/clsteelempire.html', icon: '🎮' },
  { id: 'clsteelsurge', name: 'Steel Surge', url: '/games/clsteelsurge.html', icon: '🎮' },
  { id: 'clsteepdescent', name: 'Steep Descent', url: '/games/clsteepdescent.html', icon: '🎮' },
  { id: 'clstickarchersbattle', name: 'Stick Archers Battle', url: '/games/clstickarchersbattle.html', icon: '🎮' },
  { id: 'clstickdefenders', name: 'Stick Defenders', url: '/games/clstickdefenders.html', icon: '🎮' },
  { id: 'clstickfighter', name: 'Stick Fighter', url: '/games/clstickfighter.html', icon: '🥊' },
  { id: 'clstickjetchallenge', name: 'Stick Jet Challenge', url: '/games/clstickjetchallenge.html', icon: '✈️' },
  { id: 'clstickmanandguns', name: 'Stick Man and Guns', url: '/games/clstickmanandguns.html', icon: '🔫' },
  { id: 'clstickmanclash', name: 'Stick Man Clash', url: '/games/clstickmanclash.html', icon: '🕴️' },
  { id: 'clstickmanduel', name: 'Stick Man Duel', url: '/games/clstickmanduel.html', icon: '🕴️' },
  { id: 'clstickmangtacity', name: 'Stick Man Gta City', url: '/games/clstickmangtacity.html', icon: '🕴️' },
  { id: 'clstickmanhook', name: 'Stick Man Hook', url: '/games/clstickmanhook.html', icon: '🕴️' },
  { id: 'clstickmankombat2d', name: 'Stick Man Kombat 2D', url: '/games/clstickmankombat2d.html', icon: '🥊' },
  { id: 'clstickmanstealingdiamond', name: 'Stick Man Stealing Diamond', url: '/games/clstickmanstealingdiamond.html', icon: '🕴️' },
  { id: 'clstickminairship', name: 'Stick Min Airship', url: '/games/clstickminairship.html', icon: '✈️' },
  { id: 'clstickminbreakingbank', name: 'Stick Min Breaking Bank', url: '/games/clstickminbreakingbank.html', icon: '🎮' },
  { id: 'clstickminescapingprison', name: 'Stick Min Escaping Prison', url: '/games/clstickminescapingprison.html', icon: '🎮' },
  { id: 'clstickminfleecomplex', name: 'Stick Min Flee Complex', url: '/games/clstickminfleecomplex.html', icon: '🎮' },
  { id: 'clstickrpgcomplete', name: 'Stick RPG Complete', url: '/games/clstickrpgcomplete.html', icon: '⚔️' },
  { id: 'clstickslasher', name: 'Stick Slasher', url: '/games/clstickslasher.html', icon: '🎮' },
  { id: 'clstickwar', name: 'Stick War', url: '/games/clstickwar.html', icon: '🪖' },
  { id: 'clstickwar2', name: 'Stick War 2', url: '/games/clstickwar2.html', icon: '🪖' },
  { id: 'clstickwithit', name: 'Stick with It', url: '/games/clstickwithit.html', icon: '🎮' },
  { id: 'clstormthehouse', name: 'Storm the House', url: '/games/clstormthehouse.html', icon: '🎮' },
  { id: 'clstormthehouse2', name: 'Storm the House 2', url: '/games/clstormthehouse2.html', icon: '🎮' },
  { id: 'clstormthehouse3', name: 'Storm the House 3', url: '/games/clstormthehouse3.html', icon: '🎮' },
  { id: 'clstrangejournet', name: 'Strange Jour Net', url: '/games/clstrangejournet.html', icon: '🎮' },
  { id: 'clstreangeropepolice', name: 'Stre Ange Rope Police', url: '/games/clstreangeropepolice.html', icon: '🎮' },
  { id: 'clstreetfighter1arcade', name: 'Street Fighter 1 Arcade', url: '/games/clStreetFighter1Arcade.html', icon: '🥊' },
  { id: 'clstreetfighter2', name: 'Street Fighter 2', url: '/games/clstreetfighter2.html', icon: '👊' },
  { id: 'clstreetfighter2arcade', name: 'Street Fighter 2 Arcade', url: '/games/clStreetFighter2Arcade.html', icon: '🥊' },
  { id: 'clstreetfighter2cearcade', name: 'Street Fighter 2 CE Arcade', url: '/games/clStreetFighter2CEArcade.html', icon: '🥊' },
  { id: 'clstreetfighter2turbo', name: 'Street Fighter 2 Turbo', url: '/games/clstreetfighter2turbo.html', icon: '🥊' },
  { id: 'clstreetfighteralpha3', name: 'Street Fighter Alpha 3', url: '/games/clstreetfighteralpha3.html', icon: '🥊' },
  { id: 'clstreetfighterumuhsomething', name: 'Street Fighter Umuh Something', url: '/games/clstreetfighterumuhsomething.html', icon: '🥊' },
  { id: 'clstreetofrage', name: 'Street of Rage', url: '/games/clstreetofrage.html', icon: '🎮' },
  { id: 'clstreetofrage2', name: 'Street of Rage 2', url: '/games/clstreetofrage2.html', icon: '🎮' },
  { id: 'clstreetofrage3', name: 'Street of Rage 3', url: '/games/clstreetofrage3.html', icon: '🎮' },
  { id: 'clstrikeforceheroes', name: 'Strikeforce Heroes', url: '/games/clstrikeforceheroes.html', icon: '🎮' },
  { id: 'clstrikeforceheroes2', name: 'Strikeforce Heroes 2', url: '/games/clstrikeforceheroes2.html', icon: '🎮' },
  { id: 'clstrikeforceheroes3', name: 'Strikeforce Heroes 3', url: '/games/clstrikeforceheroes3.html', icon: '🎮' },
  { id: 'clstrikerdummies', name: 'Striker Dummies', url: '/games/clstrikerdummies.html', icon: '🎮' },
  { id: 'clstylesavvy', name: 'Style Savvy', url: '/games/clstylesavvy.html', icon: '🎮' },
  { id: 'clsubwaysurfersbeijing', name: 'Subway Surfers Beijing', url: '/games/clsubwaysurfersbeijing.html', icon: '🏃' },
  { id: 'clsubwaysurfersberlin', name: 'Subway Surfers Berlin', url: '/games/clsubwaysurfersberlin.html', icon: '🏃' },
  { id: 'clsubwaysurfersbuenosaires', name: 'Subway Surfers Buenos Aires', url: '/games/clsubwaysurfersbuenosaires.html', icon: '✈️' },
  { id: 'clsubwaysurfershavana', name: 'Subway Surfers Havana', url: '/games/clsubwaysurfershavana.html', icon: '🏃' },
  { id: 'clsubwaysurfershouston', name: 'Subway Surfers Houston', url: '/games/clsubwaysurfershouston.html', icon: '🏃' },
  { id: 'clsubwaysurfersiceland', name: 'Subway Surfers Iceland', url: '/games/clsubwaysurfersiceland.html', icon: '🏃' },
  { id: 'clsubwaysurferslondon', name: 'Subway Surfers London', url: '/games/clsubwaysurferslondon.html', icon: '🏃' },
  { id: 'clsubwaysurfersmexico', name: 'Subway Surfers Mexico', url: '/games/clsubwaysurfersmexico.html', icon: '🏃' },
  { id: 'clsubwaysurfersmiami', name: 'Subway Surfers Miami', url: '/games/clsubwaysurfersmiami.html', icon: '🏃' },
  { id: 'clsubwaysurfersmonaco', name: 'Subway Surfers Monaco', url: '/games/clsubwaysurfersmonaco.html', icon: '🏃' },
  { id: 'clsubwaysurfersneworeleans', name: 'Subway Surfers New Ore Leans', url: '/games/clsubwaysurfersneworeleans.html', icon: '🏃' },
  { id: 'clsubwaysurfersneworleans', name: 'Subway Surfers New Orleans', url: '/games/clsubwaysurfersneworleans.html', icon: '🏃' },
  { id: 'clsubwaysurferssanfrancisco--1', name: 'Subway Surfers San Francisco', url: '/games/clsubwaysurferssanfrancisco%20(1).html', icon: '🏃' },
  { id: 'clsubwaysurfersstpetersburg', name: 'Subway Surfers St Petersburg', url: '/games/clsubwaysurfersstpetersburg.html', icon: '🏃' },
  { id: 'clsubwaysurferswinterholiday', name: 'Subway Surfers Winter Holiday', url: '/games/clsubwaysurferswinterholiday.html', icon: '🏂' },
  { id: 'clsubwaysurferszurich', name: 'Subway Surfers Zurich', url: '/games/clsubwaysurferszurich.html', icon: '🏃' },
  { id: 'clsugarsugar', name: 'Sugar Sugar', url: '/games/clsugarsugar.html', icon: '🎮' },
  { id: 'clsugaryspire', name: 'Sugary Spire', url: '/games/clsugaryspire.html', icon: '🎮' },
  { id: 'clsuikapico', name: 'Sui Ka Pico', url: '/games/clsuikapico.html', icon: '🎮' },
  { id: 'clsuika', name: 'Suika', url: '/games/clsuika.html', icon: '🎮' },
  { id: 'clsummerrider', name: 'Summer Rider', url: '/games/clsummerrider.html', icon: '🎮' },
  { id: 'clsunandmoon', name: 'Sun and Moon', url: '/games/clsunandmoon.html', icon: '🎮' },
  { id: 'clsupitdept', name: 'Sup It Dept', url: '/games/clsupitdept.html', icon: '🎮' },
  { id: 'clsuperbomberman', name: 'Super Bomberman', url: '/games/clsuperbomberman.html', icon: '🎮' },
  { id: 'clsuperbomberman2', name: 'Super Bomberman 2', url: '/games/clsuperbomberman2.html', icon: '🎮' },
  { id: 'clsuperbomberman3', name: 'Super Bomberman 3', url: '/games/clsuperbomberman3.html', icon: '🎮' },
  { id: 'clsuperbomberman4', name: 'Super Bomberman 4', url: '/games/clsuperbomberman4.html', icon: '🎮' },
  { id: 'clsuperbomberman5', name: 'Super Bomberman 5', url: '/games/clsuperbomberman5.html', icon: '🎮' },
  { id: 'clsuperchibiknight', name: 'Super Chibi Knight', url: '/games/clsuperchibiknight.html', icon: '⚔️' },
  { id: 'clsupercold', name: 'Super Cold', url: '/games/clsupercold.html', icon: '🎮' },
  { id: 'clsuperdarkdeception', name: 'Super Dark Deception', url: '/games/clsuperdarkdeception.html', icon: '🎮' },
  { id: 'clsuperdiagonalmario2', name: 'Super Diagonal Mario 2', url: '/games/clsuperdiagonalmario2.html', icon: '🍄' },
  { id: 'clsuperdromebugs-1', name: 'Super Drome Bugs', url: '/games/clsuperdromebugs(1).html', icon: '🎮' },
  { id: 'clsuperfallingfred', name: 'Super Falling Fred', url: '/games/clsuperfallingfred.html', icon: '🎮' },
  { id: 'clsuperfighters', name: 'Super Fighters', url: '/games/clsuperfighters.html', icon: '🥊' },
  { id: 'clsuperhot', name: 'Super Hot', url: '/games/clsuperhot.html', icon: '🎮' },
  { id: 'clsuperhotlinemiami', name: 'Super Hotline Miami', url: '/games/clsuperhotlinemiami.html', icon: '🎮' },
  { id: 'clsuperhouseofdeadninjas', name: 'Super House of Dead Ninjas', url: '/games/clsuperhouseofdeadninjas.html', icon: '🧟' },
  { id: 'clsuperislandadventure', name: 'Super Island Adventure', url: '/games/clsuperislandadventure.html', icon: '🎮' },
  { id: 'clsuperkidadventure', name: 'Super Kid Adventure', url: '/games/clsuperkidadventure.htm', icon: '🎮' },
  { id: 'clsuperliquidsoccer', name: 'Super Liquid Soccer', url: '/games/clsuperliquidsoccer.html', icon: '⚽' },
  { id: 'clsupermario', name: 'Super Mario', url: '/games/clsupermario.html', icon: '🍄' },
  { id: 'clsupermario3mix', name: 'Super Mario 3 Mix', url: '/games/clsupermario3mix.html', icon: '🍄' },
  { id: 'clsupermario63', name: 'Super Mario 63', url: '/games/clsupermario63.html', icon: '🍄' },
  { id: 'clsupermario64', name: 'Super Mario 64', url: '/games/clsupermario64.html', icon: '🍄' },
  { id: 'clsupermario64ds', name: 'Super Mario 64 DS', url: '/games/clsupermario64ds.html', icon: '🍄' },
  { id: 'clsm64land', name: 'Super Mario 64 Land', url: '/games/clSM64Land.html', icon: '🍄' },
  { id: 'clsupermario74', name: 'Super Mario 74', url: '/games/clsupermario74.html', icon: '🍄' },
  { id: 'clsupermarioallstars', name: 'Super Mario Allstars', url: '/games/clsupermarioallstars.html', icon: '🍄' },
  { id: 'clsupermariobros', name: 'Super Mario Bros', url: '/games/clsupermariobros.html', icon: '🍄' },
  { id: 'clsupermariobros2', name: 'Super Mario Bros 2', url: '/games/clsupermariobros2.html', icon: '🍄' },
  { id: 'clsupermariobros2us', name: 'Super Mario Bros 2 US', url: '/games/clsupermariobros2us.html', icon: '🍄' },
  { id: 'clsupermariobros3', name: 'Super Mario Bros 3', url: '/games/clsupermariobros3.html', icon: '🍄' },
  { id: 'clsupermariobros3real', name: 'Super Mario Bros 3 Real', url: '/games/clsupermariobros3real.html', icon: '🍄' },
  { id: 'clsupermariokart', name: 'Super Mario Kart', url: '/games/clsupermariokart.html', icon: '🍄' },
  { id: 'clsupermarioland', name: 'Super Mario Land', url: '/games/clsupermarioland.html', icon: '🍄' },
  { id: 'clsupermarioland2', name: 'Super Mario Land 2', url: '/games/clsupermarioland2.html', icon: '🍄' },
  { id: 'clsupermarioland2dx', name: 'Super Mario Land 2 DX', url: '/games/clsupermarioland2dx.html', icon: '🍄' },
  { id: 'clsupermariolanddx', name: 'Super Mario Land DX', url: '/games/clsupermariolanddx.html', icon: '🍄' },
  { id: 'clsupermariomon', name: 'Super Mario Mon', url: '/games/clsupermariomon.html', icon: '🍄' },
  { id: 'clsupermariorpg', name: 'Super Mario RPG', url: '/games/clsupermariorpg.html', icon: '🍄' },
  { id: 'clsupermariostarroad', name: 'Super Mario Star Road', url: '/games/clsupermariostarroad.html', icon: '🍄' },
  { id: 'clsupermariostarroadretooled', name: 'Super Mario Star Road Retooled', url: '/games/clsupermariostarroadretooled.html', icon: '🍄' },
  { id: 'clsupermariosunshine64', name: 'Super Mario Sunshine 64', url: '/games/clsupermariosunshine64.html', icon: '🍄' },
  { id: 'clsupermarioworld', name: 'Super Mario World', url: '/games/clsupermarioworld.html', icon: '🍄' },
  { id: 'clsupermarioworldthe-secretofthe7goldenstatues', name: 'Super Mario World - Secret of 7 Golden Statues', url: '/games/clSuperMarioWorldThe%20SecretOfThe7GoldenStatues.html', icon: '🍄' },
  { id: 'clsupermarioworld2', name: 'Super Mario World 2', url: '/games/clsupermarioworld2.html', icon: '🍄' },
  { id: 'clsupermetroid', name: 'Super Metroid', url: '/games/clsupermetroid.html', icon: '🚀' },
  { id: 'clsupermonkeyballjr', name: 'Super Monkey Ball Jr', url: '/games/clsupermonkeyballjr.html', icon: '🎮' },
  { id: 'clsuperoliverworld', name: 'Super Oliver World', url: '/games/clsuperoliverworld.html', icon: '🎮' },
  { id: 'clsuperonionboy2', name: 'Super Onion Boy 2', url: '/games/clsuperonionboy2.html', icon: '🎮' },
  { id: 'clsuperpickleballadventure', name: 'Super Pickle Ball Adventure', url: '/games/clsuperpickleballadventure.html', icon: '🎮' },
  { id: 'clsuperpunchout', name: 'Super Punch Out', url: '/games/clsuperpunchout.html', icon: '🥊' },
  { id: 'clsuperpunchouten', name: 'Super Punch-Out!! (EN)', url: '/games/clSuperPunchOutEN.html', icon: '🥊' },
  { id: 'clsuperpuzzlefighter2turbo', name: 'Super Puzzle Fighter 2 Turbo', url: '/games/clsuperpuzzlefighter2turbo.html', icon: '🧩' },
  { id: 'clsuperpuzzlefighter2turboalt', name: 'Super Puzzle Fighter 2 Turbo Alt', url: '/games/clsuperpuzzlefighter2turboalt.html', icon: '🧩' },
  { id: 'clsupersantakicker', name: 'Super Santa Kicker', url: '/games/clsupersantakicker.html', icon: '🎮' },
  { id: 'clsupersantakicker2', name: 'Super Santa Kicker 2', url: '/games/clsupersantakicker2.html', icon: '🎮' },
  { id: 'clsuperscribblenauts', name: 'Super Scribblenauts', url: '/games/clsuperscribblenauts.html', icon: '🎮' },
  { id: 'clsupersmashbros', name: 'Super Smash Bros', url: '/games/clsupersmashbros.html', icon: '💥' },
  { id: 'clsupersmashflash', name: 'Super Smash Flash', url: '/games/clsupersmashflash.html', icon: '💥' },
  { id: 'clsupersmashflash2', name: 'Super Smash Flash 2', url: '/games/clsupersmashflash2.html', icon: '💥' },
  { id: 'clsupersmashflash2butdifversion', name: 'Super Smash Flash 2 But Dif Version', url: '/games/clsupersmashflash2butdifversion.html', icon: '💥' },
  { id: 'clssf2arcade', name: 'Super Street Fighter 2 Arcade', url: '/games/clSSF2Arcade.html', icon: '🥊' },
  { id: 'clsuperstreetfighter2turbojp', name: 'Super Street Fighter 2 Turbo JP', url: '/games/clsuperstreetfighter2turbojp.html', icon: '🥊' },
  { id: 'clsupertiltbros', name: 'Super Tilt Bros', url: '/games/clsupertiltbros.html', icon: '🎮' },
  { id: 'clsuperc', name: 'Superc', url: '/games/clsuperc.html', icon: '🎮' },
  { id: 'clsupercarrush', name: 'Supercar Rush', url: '/games/clsupercarrush.html', icon: '🎮' },
  { id: 'clsupercastlevaniavi', name: 'Super Castlevania IV', url: '/games/clsupercastlevaniaVI.html', icon: '⚔️' },
  { id: 'clsupernoahsark3d', name: 'Super Noahs Ark 3D', url: '/games/clsupernoahsark3D.html', icon: '🎮' },
  { id: 'clsupersmashflash0-8', name: 'Super Smash Flash 0.8', url: '/games/clsupersmashflash0.8.html', icon: '💥' },
  { id: 'clsupremeduelist', name: 'Supreme Duelist', url: '/games/clsupremeduelist.html', icon: '🎮' },
  { id: 'clsupremeduelist2019', name: 'Supreme Duelist 2019', url: '/games/clSupremeDuelist2019.html', icon: '🎮' },
  { id: 'supremeduelistfix', name: 'Supreme Duelist Fix', url: '/games/supremeduelistfix.html', icon: '🎮' },
  { id: 'clsurvevio', name: 'Surviv.io', url: '/games/clsurvevio.html', icon: '🎮' },
  { id: 'clsurvivalracev2', name: 'Survival Race V2', url: '/games/clsurvivalracev2.html', icon: '🏎️' },
  { id: 'clsurvivorio', name: 'Survivor IO', url: '/games/clsurvivorio.html', icon: '⚔️' },
  { id: 'clsushicat', name: 'Sushi Cat', url: '/games/clsushicat.html', icon: '🎮' },
  { id: 'clsushicat2', name: 'Sushi Cat 2', url: '/games/clsushicat2.html', icon: '🎮' },
  { id: 'clsushiunroll', name: 'Sushi Unroll', url: '/games/clsushiunroll.html', icon: '🎮' },
  { id: 'clswerve', name: 'Swerve', url: '/games/clswerve.html', icon: '🎮' },
  { id: 'clswingforbrainrots', name: 'Swing for Brain Rots', url: '/games/clswingforbrainrots.html', icon: '🎮' },
  { id: 'clswitchblade', name: 'Switchblade', url: '/games/clswitchblade.html', icon: '🎮' },
  { id: 'clswordandshieldultimateplus', name: 'Sword and Shield Ultimate Plus', url: '/games/clswordandshieldultimateplus.html', icon: '⚔️' },
  { id: 'clswordfight', name: 'Sword Fight', url: '/games/clswordfight.html', icon: '⚔️' },
  { id: 'clswordplay', name: 'Swordplay', url: '/games/clswordplay.html', icon: '⚔️' },
  { id: 'clswordsandsandals', name: 'Swords and Sandals', url: '/games/clswordsandsandals.html', icon: '⚔️' },
  { id: 'clswordsandsandals2', name: 'Swords and Sandals 2', url: '/games/clswordsandsandals2.html', icon: '⚔️' },
  { id: 'clswordsandsouls', name: 'Swords and Souls', url: '/games/clswordsandsouls.html', icon: '⚔️' },
  { id: 'clsydneyshark', name: 'Sydney Shark', url: '/games/clsydneyshark.html', icon: '🦈' },
  { id: 'cltabi', name: 'Tabi', url: '/games/cltabi.html', icon: '🎮' },
  { id: 'cltabletanks', name: 'Table Tanks', url: '/games/cltabletanks.html', icon: '🪖' },
  { id: 'cltabletennisworldtour', name: 'Table Tennis World Tour', url: '/games/cltabletennisworldtour.html', icon: '🏐' },
  { id: 'cltacostand', name: 'Taco Stand', url: '/games/cltacostand.html', icon: '🌮' },
  { id: 'cltag', name: 'Tag', url: '/games/cltag-.html', icon: '🎮' },
  { id: 'cltagc3', name: 'TAGC 3', url: '/games/cltagc3.html', icon: '🎮' },
  { id: 'cltagcm', name: 'TAGCM', url: '/games/cltagcm.html', icon: '🎮' },
  { id: 'cltaikonotatsujin', name: 'Taiko no Tatsujin', url: '/games/clTaikonoTatsujin.html', icon: '🥁' },
  { id: 'cltailofthedragon', name: 'Tail of the Dragon', url: '/games/cltailofthedragon.html', icon: '⚔️' },
  { id: 'cltailsadventure', name: 'Tails Adventure', url: '/games/cltailsadventure.html', icon: '💨' },
  { id: 'cltailsskypatrol', name: 'Tails Sky Patrol', url: '/games/cltailsskypatrol.html', icon: '💨' },
  { id: 'cltaisei', name: 'Taisei', url: '/games/cltaisei.html', icon: '🎮' },
  { id: 'cltakeover', name: 'Takeover', url: '/games/cltakeover.html', icon: '🎮' },
  { id: 'cltallmanrun', name: 'Tall Man Run', url: '/games/cltallmanrun.html', icon: '🎮' },
  { id: 'cltallio', name: 'Tallio', url: '/games/cltallio.html', icon: '🎮' },
  { id: 'cltankmayhem', name: 'Tank Mayhem', url: '/games/cltankmayhem.html', icon: '🪖' },
  { id: 'cltankpixel', name: 'Tank Pixel', url: '/games/cltankpixel.html', icon: '🪖' },
  { id: 'cltanktrouble', name: 'Tank Trouble', url: '/games/cltanktrouble.html', icon: '🪖' },
  { id: 'cltanukisunset', name: 'Tanuki Sunset', url: '/games/cltanukisunset.html', icon: '🎮' },
  { id: 'cltanukisunsetuhhhhhhhh', name: 'Tanuki Sunset (Alt)', url: '/games/cltanukisunsetuhhhhhhhh.html', icon: '🎮' },
  { id: 'cltapper', name: 'Tapper', url: '/games/cltapper.html', icon: '🍺' },
  { id: 'cltaproad', name: 'Taproad', url: '/games/cltaproad.html', icon: '🎮' },
  { id: 'cltastyplanet', name: 'Tasty Planet', url: '/games/cltastyplanet.html', icon: '✈️' },
  { id: 'cltboidemo', name: 'TBOI Demo', url: '/games/cltboidemo.html', icon: '🎮' },
  { id: 'cltboilambeternal', name: 'TBOI Lamb Eternal', url: '/games/cltboilambeternal.html', icon: '🎮' },
  { id: 'cltelocation', name: 'Telocation', url: '/games/cltelocation.html', icon: '🎮' },
  { id: 'cltecmobowl', name: 'Tecmo Bowl', url: '/games/cltecmobowl.html', icon: '🎮' },
  { id: 'cltekken2ps1', name: 'Tekken 2 PS1', url: '/games/cltekken2ps1.html', icon: '🥊' },
  { id: 'cltekken3ps1', name: 'Tekken 3 PS1', url: '/games/cltekken3ps1.html', icon: '🥊' },
  { id: 'cltelephonetrouble', name: 'Telephone Trouble', url: '/games/cltelephonetrouble.html', icon: '🎮' },
  { id: 'cltempoverdose', name: 'Tempo Overdose', url: '/games/cltempoverdose.html', icon: '🎮' },
  { id: 'cltempest2000', name: 'Tempest 2000', url: '/games/cltempest2000.html', icon: '🎮' },
  { id: 'cltempleofboom', name: 'Temple of Boom', url: '/games/cltempleofboom.html', icon: '🎮' },
  { id: 'cltemplerun2', name: 'Temple Run 2', url: '/games/cltemplerun2.html', icon: '🎮' },
  { id: 'cltennisnes', name: 'Tennis NES', url: '/games/cltennisnes.html', icon: '🏐' },
  { id: 'clteod', name: 'Teod', url: '/games/clteod.html', icon: '🎮' },
  { id: 'clterra', name: 'Terra', url: '/games/clterra.html', icon: '🎮' },
  { id: 'clterritorialio', name: 'Territorial IO', url: '/games/clterritorialio.html', icon: '🗺️' },
  { id: 'clterritorywar', name: 'Territory War', url: '/games/clterritorywar.html', icon: '🗺️' },
  { id: 'clterritorywar2', name: 'Territory War 2', url: '/games/clterritorywar2.html', icon: '🗺️' },
  { id: 'clterritorywar3', name: 'Territory War 3', url: '/games/clterritorywar3.html', icon: '🗺️' },
  { id: 'cltetris', name: 'Tetris', url: '/games/cltetris.html', icon: '🟦' },
  { id: 'cltetrisattack', name: 'Tetris Attack', url: '/games/cltetrisattack.html', icon: '🟦' },
  { id: 'cltetrisgba', name: 'Tetris GBA', url: '/games/cltetrisgba.html', icon: '🟦' },
  { id: 'cltetrisgrandmaster2', name: 'Tetris Grandmaster 2', url: '/games/cltetrisgrandmaster2.html', icon: '🟦' },
  { id: 'clthanksforremindingmeihadtofixthis', name: 'Thanks for Reminding Mei Had to Fix This', url: '/games/clthanksforremindingmeihadtofixthis.html', icon: '🎮' },
  { id: 'cltheclassroom', name: 'The Classroom', url: '/games/cltheclassroom.html', icon: '🏫' },
  { id: 'cltheclassroom2', name: 'The Classroom 2', url: '/games/cltheclassroom2.html', icon: '🏫' },
  { id: 'cltheclassroom3', name: 'The Classroom 3', url: '/games/cltheclassroom3.html', icon: '🏫' },
  { id: 'clthedeadseat', name: 'The Dead Seat', url: '/games/clthedeadseat.html', icon: '🧟' },
  { id: 'clthedeepestsleep', name: 'The Deepest Sleep', url: '/games/clthedeepestsleep.html', icon: '😴' },
  { id: 'cltheenchantedcave2', name: 'The Enchanted Cave 2', url: '/games/cltheenchantedcave2.html', icon: '🎮' },
  { id: 'cltheimpossiblegame', name: 'The Impossible Game', url: '/games/cltheimpossiblegame.html', icon: '🎮' },
  { id: 'cltheincrediblemachine', name: 'The Incredible Machine', url: '/games/cltheincrediblemachine.html', icon: '🎮' },
  { id: 'clthelaststand', name: 'The Last Stand', url: '/games/clthelaststand.html', icon: '🎮' },
  { id: 'clthelaststandunioncity--1', name: 'The Last Stand Union City', url: '/games/clthelaststandunioncity%20(1).html', icon: '🎮' },
  { id: 'cltheloneranger', name: 'The Lone Ranger', url: '/games/clTheLoneRanger.html', icon: '🎮' },
  { id: 'clthemaninthewindow', name: 'The Man in the Window', url: '/games/clthemaninthewindow.html', icon: '👁️' },
  { id: 'clthesodorrace', name: 'The Sodor Race', url: '/games/clthesodorrace.html', icon: '🏎️' },
  { id: 'clthedude', name: 'The Dude', url: '/games/clthedude.html', icon: '🎮' },
  { id: 'clthemepark', name: 'Theme Park', url: '/games/clthemepark.html', icon: '🎮' },
  { id: 'clthemeparkpsx', name: 'Theme Park PSX', url: '/games/clthemeparkpsx.html', icon: '🎮' },
  { id: 'clthepit', name: 'The Pit', url: '/games/clthepit.html', icon: '🎮' },
  { id: 'clthereisnofile', name: 'There Is No File', url: '/games/clthereisnofile.html', icon: '📁' },
  { id: 'cltheyarecoming', name: 'They Are Coming', url: '/games/cltheyarecoming.html', icon: '🎮' },
  { id: 'thiefpuzzle', name: 'Thief Puzzle', url: '/games/thiefpuzzle.html', icon: '🔓' },
  { id: 'clthisistheonlylevel', name: 'This Is the Only Level', url: '/games/clthisistheonlylevel.html', icon: '🐘' },
  { id: 'clthisistheonlylevel2', name: 'This Is the Only Level 2', url: '/games/clthisistheonlylevel2.html', icon: '🐘' },
  { id: 'clthisistheonlyleveltoo', name: 'This Is the Only Level Too', url: '/games/clthisistheonlyleveltoo.html', icon: '🐘' },
  { id: 'clthreegoblets', name: 'Three Goblets', url: '/games/clthreegoblets.html', icon: '🎮' },
  { id: 'clthrowapotato', name: 'Throw a Potato', url: '/games/clthrowapotato.html', icon: '🎮' },
  { id: 'clthrowapotatoagain', name: 'Throw a Potato Again', url: '/games/clthrowapotatoagain.html', icon: '🎮' },
  { id: 'clthwack', name: 'Thwack', url: '/games/clthwack.html', icon: '🎮' },
  { id: 'cltiberiandawn', name: 'Tiberian Dawn', url: '/games/cltiberiandawn.html', icon: '🎮' },
  { id: 'cltimeshooter2', name: 'Time Shooter 2', url: '/games/cltimeshooter2.html', icon: '🎯' },
  { id: 'cltimeshooter3', name: 'Time Shooter 3', url: '/games/cltimeshooter3.html', icon: '🎯' },
  { id: 'time-shooter-3', name: 'Time Shooter 3 SWAT', url: '/games/Time%20Shooter%203_%20SWAT%20(1).html', icon: '🎯' },
  { id: 'cltimewarriors', name: 'Time Warriors', url: '/games/cltimewarriors.html', icon: '🪖' },
  { id: 'cltinyfishing', name: 'Tiny Fishing', url: '/games/cltinyfishing.html', icon: '🎣' },
  { id: 'cltmnt', name: 'Tmnt', url: '/games/cltmnt.html', icon: '🎮' },
  { id: 'cltmnt2arc', name: 'Tmnt 2 Arc', url: '/games/cltmnt2arc.html', icon: '🎮' },
  { id: 'cltmntturtlesintime', name: 'Tmnt Turtles in Time', url: '/games/cltmntturtlesintime.html', icon: '🎮' },
  { id: 'cltmntarc', name: 'Tmntarc', url: '/games/cltmntarc.html', icon: '🎮' },
  { id: 'cltoastarling', name: 'Toastarling', url: '/games/cltoastarling.html', icon: '🌟' },
  { id: 'cltommorowandyesterday', name: 'Tomorrow and Yesterday', url: '/games/cltommorowandyesterday.html', icon: '🎮' },
  { id: 'cltoasterball', name: 'Toaster Ball', url: '/games/cltoasterball.html', icon: '🎮' },
  { id: 'cltoejam-earl', name: 'ToeJam & Earl', url: '/games/cltoejam&earl.html', icon: '🎮' },
  { id: 'cltoejam-earlpof', name: 'ToeJam & Earl (POF)', url: '/games/cltoejam&earlpof.html', icon: '🎮' },
  { id: 'cltombofthemass', name: 'Tomb of the Mass', url: '/games/cltombofthemass.html', icon: '🎮' },
  { id: 'cltomodachicollection', name: 'Tomodachi Collection', url: '/games/cltomodachicollection.html', icon: '🎮' },
  { id: 'cltonyhawkskater2', name: 'Tony Hawk Skater 2', url: '/games/cltonyhawkskater2.html', icon: '🎮' },
  { id: 'cltonyhawkskater4', name: 'Tony Hawk Skater 4', url: '/games/cltonyhawkskater4.html', icon: '🎮' },
  { id: 'cltonyhawksunderground', name: 'Tony Hawks Underground', url: '/games/cltonyhawksunderground.html', icon: '🎮' },
  { id: 'cltoomanytypes', name: 'Too Many Types', url: '/games/cltoomanytypes.html', icon: '🎮' },
  { id: 'cltopspeedracing3d', name: 'Topspeed Racing 3D', url: '/games/cltopspeedracing3d.html', icon: '🏎️' },
  { id: 'cltosstheturtle', name: 'Toss the Turtle', url: '/games/cltosstheturtle.html', icon: '🐢' },
  { id: 'cltotm', name: 'Totm', url: '/games/cltotm.html', icon: '🎮' },
  { id: 'cltouhou', name: 'Touhou', url: '/games/cltouhou.html', icon: '🎮' },
  { id: 'cltouhou2', name: 'Touhou 2', url: '/games/cltouhou2.html', icon: '🎮' },
  { id: 'cltouhou3', name: 'Touhou 3', url: '/games/cltouhou3.html', icon: '🎮' },
  { id: 'cltouhou4', name: 'Touhou 4', url: '/games/cltouhou4.html', icon: '🎮' },
  { id: 'cltouhou5', name: 'Touhou 5', url: '/games/cltouhou5.html', icon: '🎮' },
  { id: 'cltowerblocks', name: 'Tower Blocks', url: '/games/cltowerblocks.html', icon: '🎮' },
  { id: 'cltowercrash3d', name: 'Tower Crash 3D', url: '/games/cltowercrash3d.html', icon: '🎮' },
  { id: 'cltowerwizard', name: 'Tower Wizard', url: '/games/cltowerwizard.html', icon: '🎮' },
  { id: 'cltownscraper', name: 'Town Scraper', url: '/games/cltownscraper.html', icon: '🎮' },
  { id: 'cltrechoroustrials', name: 'Treacherous Trials', url: '/games/cltrechoroustrials.html', icon: '🎮' },
  { id: 'cltrechoroustrialspart2', name: 'Treacherous Trials Part 2', url: '/games/cltrechoroustrialspart2.html', icon: '🎮' },
  { id: 'cltralalerotralalaescapetungtungtungsahur', name: 'Tralalero Escape', url: '/games/cltralalerotralalaescapetungtungtungsahur.html', icon: '🎮' },
  { id: 'cltrace', name: 'Trace', url: '/games/cltrace.html', icon: '🏎️' },
  { id: 'cltrafficjam3d', name: 'Traffic Jam 3D', url: '/games/cltrafficjam3d.html', icon: '🎮' },
  { id: 'cltrapthecat', name: 'Trap the Cat', url: '/games/cltrapthecat.html', icon: '🐱' },
  { id: 'cltrappedwithjester', name: 'Trapped with Jester', url: '/games/cltrappedwithjester.html', icon: '🎮' },
  { id: 'cltriachnid', name: 'Triachnid', url: '/games/cltriachnid.html', icon: '🎮' },
  { id: 'cltripleplay2000', name: 'Triple Play 2000', url: '/games/cltripleplay2000.html', icon: '🎮' },
  { id: 'cltriviacrack', name: 'Trivia Crack', url: '/games/cltriviacrack.html', icon: '🎮' },
  { id: 'cltrollfacequest1', name: 'Troll Face Quest 1', url: '/games/cltrollfacequest1.html', icon: '⚔️' },
  { id: 'cltrollfacequest10', name: 'Troll Face Quest 10', url: '/games/cltrollfacequest10.html', icon: '⚔️' },
  { id: 'cltrollfacequest11', name: 'Troll Face Quest 11', url: '/games/cltrollfacequest11.html', icon: '⚔️' },
  { id: 'cltrollfacequest12', name: 'Troll Face Quest 12', url: '/games/cltrollfacequest12.html', icon: '⚔️' },
  { id: 'cltrollfacequest13', name: 'Troll Face Quest 13', url: '/games/cltrollfacequest13.html', icon: '⚔️' },
  { id: 'cltrollfacequest2', name: 'Troll Face Quest 2', url: '/games/cltrollfacequest2.html', icon: '⚔️' },
  { id: 'cltrollfacequest3', name: 'Troll Face Quest 3', url: '/games/cltrollfacequest3.html', icon: '⚔️' },
  { id: 'cltrollfacequest4', name: 'Troll Face Quest 4', url: '/games/cltrollfacequest4.html', icon: '⚔️' },
  { id: 'cltrollfacequest5', name: 'Troll Face Quest 5', url: '/games/cltrollfacequest5.html', icon: '⚔️' },
  { id: 'cltrollfacequest6', name: 'Troll Face Quest 6', url: '/games/cltrollfacequest6.html', icon: '⚔️' },
  { id: 'cltrollfacequest7', name: 'Troll Face Quest 7', url: '/games/cltrollfacequest7.html', icon: '⚔️' },
  { id: 'cltrollfacequest8', name: 'Troll Face Quest 8', url: '/games/cltrollfacequest8.html', icon: '⚔️' },
  { id: 'cltrollfacequest9', name: 'Troll Face Quest 9', url: '/games/cltrollfacequest9.html', icon: '⚔️' },
  { id: 'cltrucksim', name: 'Truck Sim', url: '/games/cltrucksim.html', icon: '🎮' },
  { id: 'cltsuzukimaze', name: 'Tsuzuki Maze', url: '/games/cltsuzukimaze.html', icon: '🎮' },
  { id: 'cltupertariotros', name: 'Tupertariotros', url: '/games/cltupertariotros.html', icon: '🎮' },
  { id: 'cltubejumpers', name: 'Tube Jumpers', url: '/games/cltubejumpers.html', icon: '🧍' },
  { id: 'cltuff_client_offline_wasm', name: 'Tuff Client (WASM)', url: '/games/clTuff_Client_Offline_WASM.html', icon: '⚔️' },
  { id: 'cltungtunghorror', name: 'Tung Tung Horror', url: '/games/cltungtunghorror.html', icon: '🧟' },
  { id: 'cltungtungtungsahurobby', name: 'Tung Tung Tung Sahur Obby', url: '/games/cltungtungtungsahurobby.html', icon: '🏃' },
  { id: 'cltunnelrush', name: 'Tunnel Rush', url: '/games/cltunnelrush.html', icon: '🎮' },
  { id: 'cltunnelrushbetter', name: 'Tunnel Rush Better', url: '/games/cltunnelrushbetter.html', icon: '🎮' },
  { id: 'clturokdinosaurhunter', name: 'Turok Dinosaur Hunter', url: '/games/clturokdinosaurhunter.html', icon: '🎮' },
  { id: 'clturbostars', name: 'Turbostars', url: '/games/clturbostars.html', icon: '🌌' },
  { id: 'cltwinshot--1', name: 'Twinshot', url: '/games/cltwinshot%20(1).html', icon: '🎮' },
  { id: 'cltwoball3d', name: 'Two Ball 3D', url: '/games/cltwoball3d.html', icon: '🎮' },
  { id: 'clucds', name: 'Ucds', url: '/games/clucds.html', icon: '🎮' },
  { id: 'cluckyblockobbyeuophratesriver', name: 'Lucky Block Obby Euphrates River', url: '/games/cluckyblockobbyEUOPHRATESRIVER.html', icon: '🏃' },
  { id: 'clufoswampoddysey', name: 'UFO Swamp Odyssey', url: '/games/clufoswampoddysey.html', icon: '🌌' },
  { id: 'clultima', name: 'Ultima', url: '/games/clultima.html', icon: '🎮' },
  { id: 'clultimateassassian2', name: 'Ultimate Assassin 2', url: '/games/clultimateassassian2.html', icon: '🎮' },
  { id: 'clultimateassassian3', name: 'Ultimate Assassin 3', url: '/games/clultimateassassian3.html', icon: '🎮' },
  { id: 'clultimatecardrivingsimulator', name: 'Ultimate Car Driving Simulator', url: '/games/clUltimatecardrivingsimulator.html', icon: '🏎️' },
  { id: 'clultimatemortalkombat', name: 'Ultimate Mortal Kombat', url: '/games/clultimatemortalkombat.html', icon: '👊' },
  { id: 'clultimatemortalkombat3', name: 'Ultimate Mortal Kombat 3', url: '/games/clultimatemortalkombat3.html', icon: '👊' },
  { id: 'clultrakill', name: 'Ultrakill', url: '/games/clultrakill.html', icon: '🎮' },
  { id: 'clumjammerlammy', name: 'Um Jammer Lammy', url: '/games/clumjammerlammy.html', icon: '🎮' },
  { id: 'clumstickmangameidkiforgor', name: 'Umstickman Game (I Forgot)', url: '/games/clumstickmangameidkiforgor.html', icon: '🕴️' },
  { id: 'unownking', name: 'Unown King', url: '/games/unownking.html', icon: '♟️' },
  { id: 'cluncannycatgolf', name: 'Uncanny Cat Golf', url: '/games/cluncannycatgolf.html', icon: '⛳' },
  { id: 'clundertalelb', name: 'Undertale LB', url: '/games/clundertalelb.html', icon: '💙' },
  { id: 'clundertaler', name: 'Undertale R', url: '/games/clundertaler.html', icon: '❤️' },
  { id: 'clundertaleyellow', name: 'Undertale Yellow', url: '/games/clundertaleyellow.html', icon: '💛' },
  { id: 'clunderneath', name: 'Underneath', url: '/games/clunderneath.html', icon: '🎮' },
  { id: 'clundertale-gameboy-1', name: 'Undertale Gameboy', url: '/games/clundertale-gameboy(1).html', icon: '❤️' },
  { id: 'clunfairmario', name: 'Unfair Mario', url: '/games/clunfairmario.html', icon: '🍄' },
  { id: 'clunfairmarioworkquestionmark', name: 'Unfair Mario Work Question Mark', url: '/games/clunfairmarioworkquestionmark.html', icon: '🍄' },
  { id: 'clunfairundyne', name: 'Unfair Undyne', url: '/games/clunfairundyne.html', icon: '✈️' },
  { id: 'clunicyclehero', name: 'Unicycle Hero', url: '/games/clunicyclehero.html', icon: '🚲' },
  { id: 'clunitresdreams', name: 'Unitres Dreams', url: '/games/clunitresdreams.html', icon: '🎮' },
  { id: 'cluno', name: 'Uno', url: '/games/cluno.html', icon: '🃏' },
  { id: 'clunonomercy', name: 'Uno No Mercy', url: '/games/clunonomercy.html', icon: '🃏' },
  { id: 'cluntime', name: 'Untime', url: '/games/cluntime.html', icon: '🎮' },
  { id: 'cluntitledgoosegame', name: 'Untitled Goose Game', url: '/games/cluntitledgoosegame.html', icon: '🎮' },
  { id: 'clupgradecomplete', name: 'Upgrade Complete', url: '/games/clupgradecomplete.html', icon: '🎮' },
  { id: 'clupgradecomplete2', name: 'Upgrade Complete 2', url: '/games/clupgradecomplete2.html', icon: '🎮' },
  { id: 'clupslash', name: 'Upslash', url: '/games/clupslash.html', icon: '🎮' },
  { id: 'clurbanchampion', name: 'Urban Champion', url: '/games/clurbanchampion.html', icon: '🎮' },
  { id: 'clusterrush', name: 'Cluster Rush', url: '/games/clusterrush.html', icon: '🎮' },
  { id: 'cluwuclient', name: 'Uwu Client', url: '/games/cluwuclient.html', icon: '🎮' },
  { id: 'cluzg', name: 'UZG', url: '/games/clUZG.html', icon: '🎮' },
  { id: 'clvampiresurvivors', name: 'Vampire Survivors', url: '/games/clvampiresurvivors.html', icon: '🧛' },
  { id: 'clvanguard', name: 'Vanguard', url: '/games/clvanguard.html', icon: '🎮' },
  { id: 'clvaportrails', name: 'Vapor Trails', url: '/games/clvaportrails.html', icon: '🎮' },
  { id: 'clvex', name: 'Vex', url: '/games/clvex.html', icon: '🎮' },
  { id: 'clvex2', name: 'Vex 2', url: '/games/clvex2.html', icon: '🎮' },
  { id: 'clvex3', name: 'Vex 3', url: '/games/clvex3.html', icon: '🎮' },
  { id: 'clvex3xmas', name: 'Vex 3 Xmas', url: '/games/clvex3xmas.html', icon: '🎮' },
  { id: 'clvex4', name: 'Vex 4', url: '/games/clvex4.html', icon: '🎮' },
  { id: 'clvex5', name: 'Vex 5', url: '/games/clvex5.html', icon: '🎮' },
  { id: 'clvex6', name: 'Vex 6', url: '/games/clvex6.html', icon: '🎮' },
  { id: 'clvex7', name: 'Vex 7', url: '/games/clvex7.html', icon: '🎮' },
  { id: 'clvex8', name: 'Vex 8', url: '/games/clvex8.html', icon: '🎮' },
  { id: 'clvexchallenges', name: 'Vex Challenges', url: '/games/clvexchallenges.html', icon: '🎮' },
  { id: 'clvexx3m', name: 'Vexx 3 M', url: '/games/clvexx3m.html', icon: '🎮' },
  { id: 'clvexx3m2', name: 'Vexx 3 M 2', url: '/games/clvexx3m2.html', icon: '🎮' },
  { id: 'clvibribbon', name: 'Vib-Ribbon', url: '/games/clvibribbon.html', icon: '🎮' },
  { id: 'clvillager', name: 'Villager', url: '/games/clvillager.html', icon: '🎮' },
  { id: 'clvincentmansionofthedead', name: 'Vincent Mansion of the Dead', url: '/games/clvincentmansionofthedead.html', icon: '🧟' },
  { id: 'clvisitor', name: 'Visitor', url: '/games/clvisitor.html', icon: '🎮' },
  { id: 'clvollyballchallenge', name: 'Volleyball Challenge', url: '/games/clvollyballchallenge.html', icon: '🎮' },
  { id: 'clvolleyrandom', name: 'Volley Random', url: '/games/clvolleyrandom.html', icon: '🎮' },
  { id: 'clvolleyball', name: 'Volleyball', url: '/games/clvolleyball.html', icon: '🏐' },
  { id: 'clvortex', name: 'Vortex', url: '/games/clvortex.html', icon: '🎮' },
  { id: 'clvsnonsense', name: 'Vs Nonsense', url: '/games/clvsnonsense.html', icon: '🎮' },
  { id: 'clvssmb', name: 'VS SMB', url: '/games/clVSSMB.html', icon: '🎮' },
  { id: 'clvsagore', name: 'VS Agore', url: '/games/clvsagore.html', icon: '🎮' },
  { id: 'clvvvvvv-1', name: 'VVVVVV', url: '/games/clvvvvvv(1).html', icon: '🎮' },
  { id: 'clwaluigitacostand', name: 'Waluigi Taco Stand', url: '/games/clwaluigitacostand.html', icon: '🌮' },
  { id: 'clwartheknight', name: 'War the Knight', url: '/games/clwartheknight.html', icon: '🪖' },
  { id: 'clwarfare1917', name: 'Warfare 1917', url: '/games/clwarfare1917.html', icon: '🗺️' },
  { id: 'clwarfare1944', name: 'Warfare 1944', url: '/games/clwarfare1944.html', icon: '🗺️' },
  { id: 'clwarioland1', name: 'Wario Land 1', url: '/games/clwarioland1.html', icon: '🍄' },
  { id: 'clwarioland3', name: 'Wario Land 3', url: '/games/clwarioland3.html', icon: '🍄' },
  { id: 'clwarioland4', name: 'Wario Land 4', url: '/games/clwarioland4.html', icon: '🍄' },
  { id: 'clwariowarediy', name: 'Warioware Diy', url: '/games/clwariowarediy.html', icon: '🍄' },
  { id: 'clwariowareinc', name: 'Warioware Inc', url: '/games/clwariowareinc.html', icon: '🍄' },
  { id: 'clwaterpoolio', name: 'Water Pool IO', url: '/games/clwaterpoolio.html', icon: '🎮' },
  { id: 'clwaterworks', name: 'Waterworks', url: '/games/clwaterworks.html', icon: '🎮' },
  { id: 'clwavedash', name: 'Wave Dash', url: '/games/clwavedash.html', icon: '🎮' },
  { id: 'clwaverace64', name: 'Wave Race 64', url: '/games/clwaverace64.html', icon: '🚤' },
  { id: 'clwaverun', name: 'Waverun', url: '/games/clwaverun.html', icon: '🎮' },
  { id: 'clwbml', name: 'WBML', url: '/games/clwbml.html', icon: '🎮' },
  { id: 'clwebecomewhatwebehold', name: 'We Become What We Behold', url: '/games/clwebecomewhatwebehold.html', icon: '🎮' },
  { id: 'clwermhole', name: 'Wormhole', url: '/games/clwermhole.html', icon: '🎮' },
  { id: 'clwebdashers', name: 'Webdashers', url: '/games/clwebdashers.html', icon: '🎮' },
  { id: 'clwebfishing', name: 'Web Fishing', url: '/games/clwebfishing.html', icon: '🎣' },
  { id: 'clweltling', name: 'Weltling', url: '/games/clweltling.html', icon: '🎮' },
  { id: 'clwhackthetheif', name: 'Whack the Thief', url: '/games/clwhackthetheif.html', icon: '👊' },
  { id: 'clwhackyourboss', name: 'Whack Your Boss', url: '/games/clwhackyourboss.html', icon: '👊' },
  { id: 'clwhackyourcomputer', name: 'Whack Your Computer', url: '/games/clwhackyourcomputer.html', icon: '💻' },
  { id: 'clwhatamarioworld', name: 'What a Mario World', url: '/games/clwhatamarioworld.html', icon: '🍄' },
  { id: 'clwheeliebike', name: 'Wheelie Bike', url: '/games/clwheeliebike.html', icon: '🏎️' },
  { id: 'clwheely', name: 'Wheely', url: '/games/clwheely.html', icon: '🎮' },
  { id: 'clwheely2', name: 'Wheely 2', url: '/games/clwheely2.html', icon: '🎮' },
  { id: 'clwheely3', name: 'Wheely 3', url: '/games/clwheely3.html', icon: '🎮' },
  { id: 'clwheely4', name: 'Wheely 4', url: '/games/clwheely4.html', icon: '🎮' },
  { id: 'clwheely5', name: 'Wheely 5', url: '/games/clwheely5.html', icon: '🎮' },
  { id: 'clwheely6', name: 'Wheely 6', url: '/games/clwheely6.html', icon: '🎮' },
  { id: 'clwheely7', name: 'Wheely 7', url: '/games/clwheely7.html', icon: '🎮' },
  { id: 'clwheely8', name: 'Wheely 8', url: '/games/clwheely8.html', icon: '🎮' },
  { id: 'clwilywars--1', name: 'Wily Wars', url: '/games/clwilywars%20(1).html', icon: '🪖' },
  { id: 'clwindowsdoors', name: 'Windows Doors', url: '/games/clwindowsdoors.html', icon: '🎮' },
  { id: 'clwinterfalling', name: 'Winter Falling', url: '/games/clwinterfalling.html', icon: '🏂' },
  { id: 'winterolympics', name: 'Winter Olympics', url: '/games/winterolympics.html', icon: '🏂' },
  { id: 'clwipeout2097', name: 'Wipeout 2097', url: '/games/clwipeout2097.html', icon: '🎮' },
  { id: 'clwipeout2097alt', name: 'Wipeout 2097 Alt', url: '/games/clwipeout2097alt.html', icon: '🎮' },
  { id: 'clwitchcrafttd', name: 'Witchcraft Td', url: '/games/clwitchcrafttd.html', icon: '⛏️' },
  { id: 'wolfchild', name: 'Wolf Child', url: '/games/wolfchild.html', icon: '🎮' },
  { id: 'clwolfenstein', name: 'Wolfenstein', url: '/games/clwolfenstein.html', icon: '🎮' },
  { id: 'clwolfenstein3d', name: 'Wolfenstein 3D', url: '/games/clwolfenstein3d.html', icon: '🎮' },
  { id: 'clwonderboy3', name: 'Wonder Boy 3', url: '/games/clwonderboy3.html', icon: '🎮' },
  { id: 'clwonderboyarcade', name: 'Wonder Boy Arcade', url: '/games/clwonderboyarcade.html', icon: '🎮' },
  { id: 'clwoodworm', name: 'Woodworm', url: '/games/clwoodworm.html', icon: '🎮' },
  { id: 'clwordle', name: 'Wordle', url: '/games/clwordle.html', icon: '🎮' },
  { id: 'clworldcup98', name: 'Worldcup 98', url: '/games/clworldcup98.html', icon: '🎮' },
  { id: 'clworldshardestgame', name: 'Worlds Hardest Game', url: '/games/clworldshardestgame.html', icon: '🎮' },
  { id: 'clworldshardestgame2', name: 'Worlds Hardest Game 2', url: '/games/clworldshardestgame2.html', icon: '🎮' },
  { id: 'clworldshardestgame3', name: 'Worlds Hardest Game 3', url: '/games/clworldshardestgame3.html', icon: '🎮' },
  { id: 'clworldshardestgame4', name: 'Worlds Hardest Game 4', url: '/games/clworldshardestgame4.html', icon: '🎮' },
  { id: 'clwpnfire', name: 'Wpnfire', url: '/games/clwpnfire.html', icon: '🎮' },
  { id: 'clwrassling', name: 'Wrassling', url: '/games/clwrassling.html', icon: '🎮' },
  { id: 'clwreckingcrew', name: 'Wrecking Crew', url: '/games/clwreckingcrew.html', icon: '🎮' },
  { id: 'clwurstclient', name: 'Wurst Client', url: '/games/clwurstclient.html', icon: '🎮' },
  { id: 'clwwfattitude', name: 'Wwf Attitude', url: '/games/clwwfattitude.html', icon: '🎮' },
  { id: 'clwwfsmackdown2', name: 'Wwf Smackdown 2', url: '/games/clwwfsmackdown2.html', icon: '🎮' },
  { id: 'clxmenvsstreetfighter', name: 'X-Men vs Street Fighter', url: '/games/clXMenVSStreetFighter.html', icon: '🥊' },
  { id: 'clxmenchildrenoftheatomarcade', name: 'X-Men: Children of the Atom', url: '/games/clXMenChildrenOfTheAtomArcade.html', icon: '🎮' },
  { id: 'clxevent', name: 'Xevent', url: '/games/clxevent.html', icon: '🎮' },
  { id: 'clxevious', name: 'Xevious', url: '/games/clXevious.html', icon: '🎮' },
  { id: 'clxmenarcade', name: 'Xmen Arcade', url: '/games/clxmenarcade.html', icon: '🎮' },
  { id: 'clxor', name: 'Xor', url: '/games/clxor.html', icon: '🎮' },
  { id: 'clyanderesimulator', name: 'Yand Ere Simulator', url: '/games/clyanderesimulator.html', icon: '🎮' },
  { id: 'clyarsrevenge', name: 'Yar Srevenge', url: '/games/clyarsrevenge.html', icon: '🎮' },
  { id: 'clyellow', name: 'Yellow', url: '/games/clyellow.html', icon: '🎮' },
  { id: 'clyohohoio', name: 'Yoh Oho IO', url: '/games/clyohohoio.html', icon: '🎮' },
  { id: 'clyoshisstrangequest', name: 'Yoshi\\\'s Strange Quest', url: '/games/clYoshisStrangeQuest.html', icon: '🍄' },
  { id: 'clyouarelucky', name: 'You Are Lucky', url: '/games/clyouarelucky.html', icon: '🎮' },
  { id: 'clyouvs100skibidi-1', name: 'You vs 100 Ski Bidi', url: '/games/clyouvs100skibidi(1).html', icon: '🏂' },
  { id: 'clyourturntodie', name: 'Your Turn to Die', url: '/games/clyourturntodie.html', icon: '🎮' },
  { id: 'clyumenikki', name: 'Yume Nikki', url: '/games/clyumenikki.html', icon: '🎮' },
  { id: 'clzdoom', name: 'Zdoom', url: '/games/clzdoom.html', icon: '💀' },
  { id: 'clzelda2thelegendoflink', name: 'Zelda 2 the Legend of Link', url: '/games/clzelda2thelegendoflink.html', icon: '🗡️' },
  { id: 'clzeldaindigoch2', name: 'Zelda Indigoch 2', url: '/games/clZeldaIndigoch2.html', icon: '🗡️' },
  { id: 'clzeldaminishcap', name: 'Zelda Mini Sh Cap', url: '/games/clzeldaminishcap.html', icon: '🗡️' },
  { id: 'clzenword', name: 'Zenword', url: '/games/clzenword.html', icon: '🎮' },
  { id: 'clzetaclient', name: 'Zeta Client', url: '/games/clZetaClient.html', icon: '🎮' },
  { id: 'clzoinkz', name: 'Zoinkz', url: '/games/clzoinkz.html', icon: '🎮' },
  { id: 'clzombieexploder', name: 'Zombie Explode R', url: '/games/clzombieexploder.html', icon: '🧟' },
  { id: 'clzombieroad', name: 'Zombie Road', url: '/games/clzombieroad.html', icon: '🧟' },
  { id: 'clzombierush', name: 'Zombie Rush', url: '/games/clzombierush.html', icon: '🧟' },
  { id: 'clzombiesatemyneighboors', name: 'Zombies Ate My Neighbors', url: '/games/clzombiesatemyneighboors.html', icon: '🧟' },
  { id: 'clzombopaclypse2', name: 'Zombocalypse 2', url: '/games/clzombopaclypse2.html', icon: '🧟' },
  { id: 'clzombotron', name: 'Zombotron', url: '/games/clzombotron.html', icon: '🤖' },
  { id: 'clzombotron2', name: 'Zombotron 2', url: '/games/clzombotron2.html', icon: '🤖' },
  { id: 'clzombotronreboot', name: 'Zombotron Reboot', url: '/games/clzombotronreboot.html', icon: '🤖' },
  { id: 'clzrist', name: 'Zrist', url: '/games/clzrist.html', icon: '🎮' },
  { id: 'clzuma', name: 'Zuma', url: '/games/clzuma.html', icon: '🎮' },
  { id: 'clzumashooter', name: 'Zuma Shooter', url: '/games/clzumashooter.html', icon: '🔫' },
];

const proxies = [
  { id: 'proxy1', name: 'Proxy 1', url: '/proxies/fernproxy.html' },
  { id: 'proxy2', name: 'Proxy 2', url: '/proxies/overcloakedproxy.html' },
  { id: 'proxy3', name: 'Proxy 3', url: '/proxies/voidproxy.html' },
];

// ── Settings helpers ──────────────────────────────────────────────────────────
const SETTINGS_KEY = 'geegle_settings_v1';

interface AppSettings {
  themeColor: string;
  visualTheme: string;
  panicKey: string;
  panicUrl: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeColor: '#6366f1',
  visualTheme: 'default',
  panicKey: '\\',
  panicUrl: 'https://manhasset.instructure.com/',
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Inject theme CSS into document
function applyTheme(settings: AppSettings) {
  const existing = document.getElementById('geegle-theme');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'geegle-theme';
  const c = settings.themeColor;
  const theme = settings.visualTheme;

  let css = `
    :root { --accent: ${c}; --accent-soft: ${c}33; }
    .theme-accent { color: ${c} !important; }
    .theme-accent-bg { background: ${c} !important; }
    .theme-accent-border { border-color: ${c} !important; }
    body { background: #050508 !important; }
  `;

  if (theme === 'liquidglass') {
    css += `
      body { background: linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%) !important; }
      .games-card {
        background: rgba(255,255,255,0.04) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 24px rgba(0,0,0,0.3) !important;
      }
      .games-card:hover {
        background: rgba(255,255,255,0.09) !important;
        backdrop-filter: blur(28px) saturate(220%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 32px rgba(99,102,241,0.25) !important;
      }
    `;
  } else if (theme === 'claymorphism') {
    css += `
      body { background: linear-gradient(145deg, #0f0f14 0%, #1a1a24 50%, #0f0f14 100%) !important; }
      .games-card {
        background: linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)) !important;
        border: 2px solid rgba(255,255,255,0.2) !important;
        border-radius: 24px !important;
        box-shadow: 6px 6px 0 rgba(0,0,0,0.25), inset 2px 2px 4px rgba(255,255,255,0.1) !important;
        backdrop-filter: blur(8px) !important;
      }
      .games-card:hover {
        transform: scale(1.05) translateY(-2px) !important;
        box-shadow: 8px 8px 0 rgba(0,0,0,0.3), inset 2px 2px 6px rgba(255,255,255,0.15) !important;
      }
    `;
  } else if (theme === 'aurora') {
    css += `
      body::before {
        content: '';
        position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background: radial-gradient(ellipse at 20% 50%, rgba(120,40,200,0.15) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 20%, rgba(40,160,200,0.12) 0%, transparent 60%),
                    radial-gradient(ellipse at 60% 80%, rgba(80,200,120,0.1) 0%, transparent 60%);
        animation: aurora-shift 8s ease-in-out infinite alternate;
      }
      @keyframes aurora-shift {
        0% { opacity: 0.6; transform: scale(1); }
        100% { opacity: 1; transform: scale(1.05) translateY(-10px); }
      }
      body { background: linear-gradient(180deg, #050508 0%, #0a0a10 50%, #050508 100%) !important; }
      .games-card {
        background: rgba(255,255,255,0.035) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        backdrop-filter: blur(16px) !important;
      }
    `;
  } else if (theme === 'neubrutalism') {
    css += `
      body { background: #08080c !important; }
      .games-card {
        background: rgba(20,20,30,0.85) !important;
        border: 2.5px solid rgba(255,255,255,0.85) !important;
        border-radius: 8px !important;
        box-shadow: 4px 4px 0 rgba(255,255,255,0.7) !important;
        backdrop-filter: none !important;
      }
      .games-card:hover {
        transform: translate(-2px,-2px) scale(1.03) !important;
        box-shadow: 6px 6px 0 ${c} !important;
        border-color: ${c} !important;
      }
    `;
  } else if (theme === 'abstract3d') {
    css += `
      body { background: linear-gradient(135deg, #0a0a12 0%, #10101a 50%, #08080f 100%) !important; }
      .games-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(99,102,241,0.06) 100%) !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        backdrop-filter: blur(12px) !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2) !important;
        transform-style: preserve-3d;
      }
      .games-card:hover {
        background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(99,102,241,0.1) 100%) !important;
        box-shadow: 0 16px 48px rgba(99,102,241,0.3), inset 0 2px 0 rgba(255,255,255,0.25) !important;
        transform: scale(1.05) rotateX(2deg) !important;
      }
    `;
  } else if (theme === 'dynamic') {
    css += `
      body { background: linear-gradient(90deg, #08080e 0%, #0c0c14 50%, #08080e 100%) !important; }
      .games-card {
        background: rgba(255,255,255,0.04) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        backdrop-filter: blur(8px) !important;
        transition: all 0.15s cubic-bezier(0.34,1.56,0.64,1) !important;
      }
      .games-card:hover {
        background: rgba(255,255,255,0.09) !important;
        border-color: ${c}99 !important;
        transform: scale(1.07) !important;
        box-shadow: 0 0 30px ${c}44 !important;
      }
    `;
  }

  style.textContent = css;
  document.head.appendChild(style);
}

// ── Settings Modal ─────────────────────────────────────────────────────────────
function SettingsModal({ onClose, settings, onChange }: {
  onClose: () => void;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}) {
  const [tab, setTab] = useState<'theme' | 'panic'>('theme');
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [listeningKey, setListeningKey] = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    saveSettings(next);
    onChange(next);
  };

  useEffect(() => {
    if (!listeningKey) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      update({ panicKey: e.key });
      setListeningKey(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listeningKey, local]);

  const themes = [
    { id: 'default', label: 'Default', desc: 'Classic dark UI — exactly as designed', preview: '🎮' },
    { id: 'liquidglass', label: 'Liquid Glass', desc: 'Transparent layered panels with blur & refraction', preview: '💧' },
    { id: 'claymorphism', label: 'Claymorphism', desc: 'Soft 3D rounded clay shapes with depth', preview: '🫧' },
    { id: 'aurora', label: 'Aurora', desc: 'Smooth aurora borealis gradient backgrounds', preview: '🌌' },
    { id: 'neubrutalism', label: 'Neubrutalism', desc: 'Bold outlines, sharp contrast, raw structure', preview: '⬛' },
    { id: 'abstract3d', label: '3D Abstract', desc: 'Metallic reflective textures, dreamlike depth', preview: '🔮' },
    { id: 'dynamic', label: 'Dynamic Live', desc: 'UI reacts to mouse — elements shift and glow', preview: '✨' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, width: '90%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sidebar */}
          <div style={{ width: 160, borderRight: '1px solid rgba(255,255,255,0.08)', padding: '16px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(['theme', 'panic'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent', color: tab === t ? '#a5b4fc' : '#9ca3af', fontSize: 14, fontWeight: tab === t ? 600 : 400, transition: 'all 0.15s', textAlign: 'left' }}>
                {t === 'theme' ? <Palette size={16} /> : <Key size={16} />}
                {t === 'theme' ? 'Theme' : 'Panic Key'}
              </button>
            ))}
          </div>
          {/* Content */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
            {tab === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Accent Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="color" value={local.themeColor} onChange={e => update({ themeColor: e.target.value })}
                      style={{ width: 48, height: 48, border: '2px solid rgba(255,255,255,0.15)', borderRadius: 10, cursor: 'pointer', background: 'none', padding: 2 }} />
                    <input type="text" value={local.themeColor} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) update({ themeColor: e.target.value }); }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f3f4f6', fontSize: 14, padding: '8px 12px', width: 100, outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6'].map(col => (
                        <button key={col} onClick={() => update({ themeColor: col })}
                          style={{ width: 24, height: 24, borderRadius: '50%', background: col, border: local.themeColor === col ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Visual Theme</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {themes.map(th => (
                      <button key={th.id} onClick={() => update({ visualTheme: th.id })}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${local.visualTheme === th.id ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`, background: local.visualTheme === th.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: 22 }}>{th.preview}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: local.visualTheme === th.id ? '#a5b4fc' : '#e5e7eb', fontSize: 14, fontWeight: 600 }}>{th.label}</div>
                          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{th.desc}</div>
                        </div>
                        {local.visualTheme === th.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab === 'panic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Panic Key</label>
                  <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 10 }}>Press this key at any time to instantly redirect to your saved URL.</p>
                  <button
                    onClick={() => setListeningKey(true)}
                    style={{ padding: '12px 20px', borderRadius: 10, border: `2px solid ${listeningKey ? '#6366f1' : 'rgba(255,255,255,0.15)'}`, background: listeningKey ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)', color: listeningKey ? '#a5b4fc' : '#f3f4f6', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', minWidth: 140 }}>
                    {listeningKey ? '⌨️ Press any key...' : (local.panicKey === '\\' ? 'Backslash (\\)' : `Key: ${local.panicKey}`)}
                  </button>
                  {listeningKey && <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>Press the key you want to use as your panic key.</p>}
                </div>
                <div>
                  <label style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Redirect URL</label>
                  <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 10 }}>Where to go when panic key is pressed.</p>
                  <input
                    type="text" value={local.panicUrl}
                    onChange={e => update({ panicUrl: e.target.value })}
                    placeholder="https://example.com"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#f3f4f6', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <p style={{ color: '#a5b4fc', fontSize: 13, margin: 0 }}>
                    ✅ Settings are saved locally on your device and persist across sessions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Star background canvas ────────────────────────────────────────────────────
function StarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const starsRef = useRef<Array<{ x: number; y: number; ox: number; oy: number; r: number; alpha: number }>>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Regenerate stars on resize
      starsRef.current = Array.from({ length: 180 }, () => {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        return { x, y, ox: x, oy: y, r: Math.random() * 1.8 + 0.4, alpha: Math.random() * 0.6 + 0.4 };
      });
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    const ATTRACT_RADIUS = 130;
    const ATTRACT_STRENGTH = 0.28; // how far stars move toward cursor (0–1)
    const LERP = 0.07;             // smoothness of movement

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const s of starsRef.current) {
        const dx = mx - s.ox;
        const dy = my - s.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let tx = s.ox;
        let ty = s.oy;

        if (dist < ATTRACT_RADIUS && dist > 0) {
          const pull = (1 - dist / ATTRACT_RADIUS) * ATTRACT_STRENGTH;
          tx = s.ox + dx * pull;
          ty = s.oy + dy * pull;
        }

        // Smooth rubber-band lerp toward target
        s.x += (tx - s.x) * LERP;
        s.y += (ty - s.y) * LERP;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(135deg, #050508 0%, #0d0d14 50%, #080810 100%)' }}
    />
  );
}

// ── Cord popup ────────────────────────────────────────────────────────────────
function CordPopup({ onClose }: { onClose: (dontRemind: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
      <div style={{ background: '#111827', border: '2px solid #3b82f6', borderRadius: 16, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>ℹ️</div>
        <p style={{ color: '#fff', fontSize: 16, lineHeight: 1.6, margin: '0 0 20px' }}>
          Please wait if you see nothing upon clicking on a Game/Proxy.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9ca3af', fontSize: 14, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
          Don't remind me again
        </label>
        <button onClick={() => onClose(checked)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Easter egg popup ──────────────────────────────────────────────────────────
function EasterEggPopup({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
      <div style={{ background: '#111827', border: '2px solid #facc15', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <h2 style={{ color: '#facc15', fontSize: 24, fontWeight: 700, marginBottom: 16 }}>CONGRATS!!!</h2>
        <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
          Email <a href="mailto:hongbowang0821@gmail.com" style={{ color: '#60a5fa' }}>hongbowang0821@gmail.com</a> for his special method of making fries.. make sure to talk about how delicious potato fries are in the email or he wont believe you...
        </p>
        <button onClick={onClose} style={{ background: '#facc15', color: '#000', border: 'none', borderRadius: 8, padding: '10px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState<'home' | 'games' | 'game' | 'proxy'>('home');
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [proxyUrl, setProxyUrl] = useState('');
  const [selectedProxy, setSelectedProxy] = useState(proxies[0]);
  const [showProxyDropdown, setShowProxyDropdown] = useState(false);

  const [gameSearch, setGameSearch] = useState('');
  const [gameSearchDisplay, setGameSearchDisplay] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCordPopup, setShowCordPopup] = useState(false);
  const [showProxyWarning, setShowProxyWarning] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // Apply theme on mount and when settings change
  useEffect(() => { applyTheme(settings); }, [settings]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const proxyInputRef = useRef<HTMLInputElement>(null);

  // Clear old stale localStorage keys from previous versions
  useEffect(() => {
    ['hideGamesPopup', 'hideGamesPopup_v2'].forEach(k => localStorage.removeItem(k));
  }, []);

  // Panic key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === settings.panicKey && e.target !== proxyInputRef.current) {
        e.preventDefault(); e.stopPropagation();
        const url = settings.panicUrl || 'https://manhasset.instructure.com/';
        if (window.self !== window.top) window.top!.location.href = url;
        else window.location.href = url;
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [settings.panicKey, settings.panicUrl]);

  const goToGames = () => {
    setPage('games');
    setGameSearch('');
    setGameSearchDisplay('');
    if (localStorage.getItem(DONT_SHOW_POPUP) !== 'true') {
      setShowCordPopup(true);
    }
  };

  const handleCordPopupClose = (dontRemind: boolean) => {
    if (dontRemind) localStorage.setItem(DONT_SHOW_POPUP, 'true');
    setShowCordPopup(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInputRef.current?.value || '';
    if (q === 'Bart is Awesome') { setShowEasterEgg(true); return; }
    if (isCordKeyword(q.trim())) { goToGames(); return; }
    if (q.trim()) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
  };

  const handleLuckySearch = () => {
    const q = searchInputRef.current?.value || '';
    if (q === 'Bart is Awesome') { setShowEasterEgg(true); return; }
    if (isCordKeyword(q.trim())) { goToGames(); return; }
    if (q.trim()) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}&btnI=1`, '_blank');
  };

  const handleMainSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === 'Bart is Awesome') setShowEasterEgg(true);
  };

  const handleGameSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setGameSearchDisplay(raw);
    if (raw === 'Bart is Awesome') setShowEasterEgg(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setGameSearch(raw), 200);
  }, []);

  const filteredGames = gameSearch.trim()
    ? games.filter(g => normalizeText(g.name).includes(normalizeText(gameSearch)))
    : games;

  const playGame = (id: string, url: string) => {
    setCurrentGame(url);
    setCurrentGameId(id);
    setPage('game');
    if (PROXY_GAME_IDS.has(id)) setShowProxyWarning(true);
  };

  const handleProxySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = proxyInputRef.current?.value || '';
    if (!q.trim()) return;
    let url = q.trim();
    if (url.includes('.') && !url.includes(' ')) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    setProxyUrl(url);
  };

  // ── Game iframe ─────────────────────────────────────────────────────────────
  if (page === 'game' && currentGame) {
    const isProxyGame = currentGameId && PROXY_GAME_IDS.has(currentGameId);
    return (
      <div className="w-screen h-screen bg-black overflow-hidden relative">
        {showProxyWarning && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 border border-yellow-500 rounded-xl p-6 max-w-sm mx-4 shadow-2xl text-center">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-white font-medium text-base leading-relaxed">Please ignore and exit out of any pop-ups or redirects from these proxies.</p>
              <button onClick={() => setShowProxyWarning(false)} className="mt-5 px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors">Got it</button>
            </div>
          </div>
        )}
        <button
          onClick={() => { setPage('games'); setCurrentGame(null); setCurrentGameId(null); }}
          className={`absolute z-40 p-1.5 bg-gray-800/80 text-white rounded hover:bg-gray-700 transition-colors shadow-lg ${isProxyGame ? 'bottom-4 left-4' : 'top-4 left-4'}`}
          aria-label="Back"
        >
          <ArrowLeft size={14} />
        </button>
        <iframe src={currentGame} className="w-full h-full border-none" title="Game" allow="fullscreen" style={{ display: 'block' }} />
      </div>
    );
  }

  // ── Proxy page ──────────────────────────────────────────────────────────────
  if (page === 'proxy') {
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-3 flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowProxyDropdown(!showProxyDropdown)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 border border-white/20">
              {selectedProxy.name}<ChevronDown size={16} />
            </button>
            {showProxyDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50">
                {proxies.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProxy(p); setShowProxyDropdown(false); setProxyUrl(''); }}
                    className={`w-full text-left px-4 py-2 transition-colors ${selectedProxy.id === p.id ? 'bg-blue-500 text-white' : 'text-white hover:bg-white/10'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={handleProxySearch} className="flex-1 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 focus-within:border-white/40 transition-all">
              <Search size={20} className="text-white/60" />
              <input ref={proxyInputRef} type="text" placeholder="Search or enter URL" onKeyDown={e => { if (e.key === 'Backspace') e.stopPropagation(); }} className="flex-1 outline-none text-white bg-transparent placeholder-white/50 text-base" />
            </div>
            <button type="submit" className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl transition-all font-medium shadow-lg">Go</button>
          </form>
        </div>
        <button onClick={() => { setPage('games'); setProxyUrl(''); }} className="fixed bottom-4 left-4 p-1.5 bg-gray-800/80 text-white rounded hover:bg-gray-700 transition-colors shadow-lg z-50" aria-label="Back">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 relative overflow-hidden">
          {proxyUrl ? (
            <iframe src={proxyUrl} className="w-full h-full border-none" title="Web Proxy" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-8xl mb-6">🐕</div>
                <h2 className="text-5xl font-bold text-white mb-4">Doge Unblocker</h2>
                <p className="text-xl text-white/70">Search the web or enter a URL</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Games grid ──────────────────────────────────────────────────────────────
  if (page === 'games') {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflowY: 'scroll' }}>
        <StarBackground />
        {showCordPopup && <CordPopup onClose={handleCordPopupClose} />}
        {showEasterEgg && <EasterEggPopup onClose={() => setShowEasterEgg(false)} />}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            settings={settings}
            onChange={s => setSettings(s)}
          />
        )}

        {/* Settings button — top left */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            position: 'fixed', top: 16, left: 16, zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 10,
            color: '#d1d5db',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)';
          }}
        >
          <Settings size={15} />
          Settings
        </button>

        <div style={{ position: 'relative', zIndex: 1, padding: 32 }}>
          {/* Sticky header — fades out as user scrolls */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'linear-gradient(to bottom, rgba(5,5,8,0.97) 0%, rgba(5,5,8,0.85) 40%, rgba(5,5,8,0.5) 75%, transparent 100%)',
            backdropFilter: 'blur(10px)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 55%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, black 55%, transparent 100%)',
            textAlign: 'center',
            paddingTop: 24, paddingBottom: 48,
            marginBottom: 16,
          }}>
            <h1 style={{ fontSize: 44, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: '-0.02em' }}>Choose Your Application</h1>
            <button
              onClick={() => setPage('home')}
              style={{ background: 'rgba(55,65,81,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 24px', fontSize: 14, cursor: 'pointer', marginBottom: 16, backdropFilter: 'blur(4px)', transition: 'background 0.2s' }}
            >
              Back to Search
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9999, maxWidth: 420, margin: '0 auto' }}>
              <Search size={16} color="#6b7280" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={gameSearchDisplay}
                onChange={handleGameSearchChange}
                onKeyDown={e => { if (e.key === 'Backspace') e.stopPropagation(); }}
                placeholder="Search games..."
                style={{ flex: 1, outline: 'none', background: 'transparent', color: '#f3f4f6', fontSize: 14, border: 'none' }}
              />
              {gameSearchDisplay && (
                <button onClick={() => { setGameSearchDisplay(''); setGameSearch(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
              )}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 96, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p style={{ color: '#9ca3af', fontSize: 20, fontWeight: 500 }}>No results found</p>
              <p style={{ color: '#4b5563', fontSize: 14, marginTop: 4 }}>Try a different search term</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24, maxWidth: 1400, margin: '0 auto', paddingBottom: 32 }}>
              {filteredGames.map(game => (
                <button
                  key={game.id}
                  className="games-card"
                  onClick={() => playGame(game.id, game.url)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    padding: 28,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'background 0.22s, border-color 0.22s, transform 0.22s, box-shadow 0.22s',
                    backdropFilter: 'blur(6px)',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = 'rgba(255,255,255,0.08)';
                    el.style.borderColor = `${settings.themeColor}99`;
                    el.style.transform = 'scale(1.05)';
                    el.style.boxShadow = `0 4px 24px ${settings.themeColor}33`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = 'rgba(255,255,255,0.03)';
                    el.style.borderColor = 'rgba(255,255,255,0.08)';
                    el.style.transform = 'scale(1)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: 52 }}>{game.icon}</div>
                  <span style={{ color: '#f3f4f6', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>{formatGameName(game.name)}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 13, paddingBottom: 32 }}>
            Bart made this. Thank him. :)
          </div>
        </div>
      </div>
    );
  }

  // ── Home page ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {showEasterEgg && <EasterEggPopup onClose={() => setShowEasterEgg(false)} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          settings={settings}
          onChange={s => setSettings(s)}
        />
      )}
      <header className="flex items-center justify-end px-4 py-3 gap-4">
        <button className="text-sm text-gray-300 hover:underline">Gmail</button>
        <button className="text-sm text-gray-300 hover:underline">Images</button>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors"><Grid size={20} className="text-gray-400" /></button>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors"><User size={20} className="text-gray-400" /></button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-20">
        <div className="text-center mb-8">
          <h1 className="text-7xl font-light mb-2">
            <span className="text-blue-500">G</span><span className="text-red-500">e</span><span className="text-yellow-500">e</span><span className="text-blue-500">g</span><span className="text-green-500">l</span><span className="text-red-500">e</span>
          </h1>
        </div>
        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className={`flex items-center gap-3 px-5 py-3 border border-gray-700 rounded-full transition-shadow duration-200 bg-gray-800 ${isSearchFocused ? 'shadow-lg shadow-gray-900/50' : 'shadow-md shadow-gray-900/30 hover:shadow-lg hover:shadow-gray-900/50'}`}>
            <Search size={20} className="text-gray-500 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              onChange={handleMainSearchChange}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={e => { if (e.key === 'Backspace') e.stopPropagation(); }}
              placeholder="Search Geegle or type a URL"
              className="flex-1 outline-none text-gray-100 text-base bg-transparent placeholder-gray-500"
            />
            <button type="button" className="p-1 hover:bg-gray-700 rounded transition-colors" aria-label="Search by voice" onMouseDown={e => e.preventDefault()}><Mic size={20} className="text-blue-500" /></button>
            <button type="button" className="p-1 hover:bg-gray-700 rounded transition-colors" aria-label="Search by image" onMouseDown={e => e.preventDefault()}><Image size={20} className="text-blue-500" /></button>
          </div>
          <div className="flex items-center justify-center gap-3 mt-8">
            <button type="submit" className="px-6 py-3 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700 hover:shadow-sm border border-gray-700 transition-all">Geegle Search</button>
            <button type="button" onClick={handleLuckySearch} className="px-6 py-3 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700 hover:shadow-sm border border-gray-700 transition-all">I'm Feeling Lucky</button>
          </div>
        </form>
        <div className="mt-8 text-sm text-gray-500">
          Geegle offered in:
          <button className="ml-2 text-blue-500 hover:underline">Español</button>
          <button className="ml-2 text-blue-500 hover:underline">Français</button>
          <button className="ml-2 text-blue-500 hover:underline">Deutsch</button>
        </div>
      </main>
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="px-8 py-3 border-b border-gray-700"><p className="text-sm text-gray-500">United States</p></div>
        <div className="px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-6">
            <button className="text-sm text-gray-500 hover:underline">About</button>
            <button className="text-sm text-gray-500 hover:underline">Advertising</button>
            <button className="text-sm text-gray-500 hover:underline">Business</button>
            <button className="text-sm text-gray-500 hover:underline">How Search works</button>
          </div>
          <div className="flex gap-6">
            <button className="text-sm text-gray-500 hover:underline">Privacy</button>
            <button className="text-sm text-gray-500 hover:underline">Terms</button>
            <button className="text-sm text-gray-500 hover:underline">Settings</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

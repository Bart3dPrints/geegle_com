import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { platformNavigation } from '../../src/landing/platformNavigation.ts';

const {outputFiles} = await build({
  stdin:{resolveDir:process.cwd(),contents:"export {createSaveSession} from './src/lib/cloudSaves'; export {adapterFor} from './src/lib/saveAdapters';"},
  bundle:true,write:false,platform:'node',format:'esm',
  plugins:[{name:'local-fixture', setup(b) {
    b.onResolve({filter:/^\.\/supabase$/},()=>({path:'backend',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const T={}, supabase={}, isSupabaseConfigured=false;'}));
  }}],
});
const {createSaveSession,adapterFor}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function fixture(beginLeave, unmount = () => {}) {
  let desired = true, mounted = true, pending = false, warned = false;
  const navigate = platformNavigation({
    wantsGames: () => desired,
    showGames: v => { mounted = v; if (!v) unmount(); },
    setPending: v => { pending = v; },
    stayOnGames: () => { desired = true; },
    warn: () => { warned = true; },
    beginLeave,
  });
  return {
    route: v => { desired = v; return navigate(); },
    state: () => ({ desired, mounted, pending, warned }),
  };
}

test('player stays mounted until its actual cloud session captures and uploads the last device progress', {timeout:3000}, async t => {
  Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{onLine:true}});
  const data = new Map();
  globalThis.localStorage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const id='clspacebarclicker', user='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const adapter = adapterFor(id,'/games/clspacebarclicker.html');
  const writing=deferred(), ack=deferred();
  const handle=createSaveSession(id,user,adapter,{read:async()=>null,write:async snapshot=>{writing.resolve(snapshot);await ack.promise;return '1';}});
  t.after(()=>handle.dispose());
  await handle.restored;
  const key='geegle-game:'+id+':'+user+':spacebar_clicker_game';
  localStorage.setItem(key,'last click');
  const router=fixture(async()=>(await handle.close()).ok,()=>{void handle.dispose();});
  const back=router.route(false);
  const snapshot=await writing.promise;
  assert.equal(snapshot.localStorage.spacebar_clicker_game,'last click');
  assert.equal(router.state().mounted,true);
  assert.equal(router.state().pending,true);
  ack.resolve(); await back;
  assert.equal(router.state().mounted,false);
  assert.equal(localStorage.getItem(key),'last click');
});

test('declined/failed save keeps Games mounted, restores route, and allows retry', async () => {
  let accepted=false;
  const router=fixture(async()=>accepted);
  await router.route(false);
  assert.deepEqual(router.state(),{desired:true,mounted:true,pending:false,warned:false});
  accepted=true;
  await router.route(false);
  assert.equal(router.state().mounted,false);
});

test('an unexpected close failure warns and does not unmount',async()=>{
  const router=fixture(async()=>{throw Error('offline');});
  await router.route(false);
  assert.deepEqual(router.state(),{desired:true,mounted:true,pending:false,warned:true});
});

test('same-route events do not close; browser Forward during a pending Back respects latest route',async()=>{
  const wait=deferred(); let closes=0;
  const router=fixture(()=>{closes++;return wait.promise;});
  await router.route(true); assert.equal(closes,0);
  const back=router.route(false);
  await router.route(false); await router.route(true);
  wait.resolve(true); await back;
  assert.equal(closes,1);
  assert.deepEqual(router.state(),{desired:true,mounted:true,pending:false,warned:false});
});

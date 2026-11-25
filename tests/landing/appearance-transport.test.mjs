import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { DEFAULT_APPEARANCE, readAppearance } from '../../src/landing/appearance.ts';

const {outputFiles} = await build({stdin:{resolveDir:process.cwd(),contents:"export {accountAppearanceSync} from './src/landing/appearanceSync';"},bundle:true,write:false,format:'esm'});
const {accountAppearanceSync} = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
const A = {...DEFAULT_APPEARANCE,color:'#113355'};
const B = {...DEFAULT_APPEARANCE,color:'#338844'};

function fixture() {
  const state = { id:'alice', rows:new Map(), calls:[], settings:{theme:'dark',servers:{first:2}} };
  let sequence = 0;
  const transport = {
    session:async()=>({id:state.id,token:'token:'+state.id}),
    read:async(id,token,signal)=>{assert.equal(token,'token:'+id);signal.throwIfAborted();return state.rows.get(id) ?? null;},
    write:async(id,token,signal,revision,appearance)=>{
      signal.throwIfAborted();state.calls.push([id,token]);assert.equal(token,'token:'+id);
      if ((state.rows.get(id)?.revision ?? null) !== revision) return null;
      const row={revision:String(++sequence),appearance};state.rows.set(id,row);return row;
    },
  };
  return {state,transport};
}

test('two devices cannot overwrite a concurrent first save or newer revision; unrelated settings are untouched', async()=>{
  const {state,transport}=fixture();
  const one=accountAppearanceSync('alice',transport), two=accountAppearanceSync('alice',transport);
  await one.load();await two.load();
  await one.save(A);
  await assert.rejects(two.save(B),/has changed/);
  assert.deepEqual(state.rows.get('alice').appearance,A);
  await assert.rejects(two.save(B),/Reload/);
  assert.deepEqual(await two.load(),A);
  await one.save(B);
  await assert.rejects(two.save(A),/has changed/);
  assert.deepEqual(state.settings,{theme:'dark',servers:{first:2}});
});

test('storage wipe recovers remote value; missing schema or offline reads never enable writes',async()=>{
  const {state,transport}=fixture();
  const one=accountAppearanceSync('alice',transport); await one.load();await one.save(B);
  const next=accountAppearanceSync('alice',transport);
  assert.deepEqual(readAppearance('alice',await next.load()),B);
  transport.read=async()=>{throw new Error('missing table');};
  await assert.rejects(next.load(),/missing table/);
  await assert.rejects(next.save(A),/Reload/);
  assert.equal(state.calls.length,1);
});

test('changed identity before a request cannot write; disposal ignores even a late successful response',async()=>{
  const {state,transport}=fixture();
  const old=accountAppearanceSync('alice',transport);await old.load();
  state.id='bob';await assert.rejects(old.save(A),/account changed/);
  assert.equal(state.calls.length,0);
  state.id='alice';await old.load();
  let resolve,started;
  const waiting=new Promise(r=>{started=r;});
  transport.write=async(id,token,signal)=>{started([id,token,signal]);return new Promise(r=>{resolve=r;});};
  const pending=old.save(A);const [id,token,signal]=await waiting;
  state.id='bob';old.dispose();
  assert.deepEqual([id,token,signal.aborted],['alice','token:alice',true]);
  resolve({revision:'1',appearance:A});
  await assert.rejects(pending,/no longer active/);
  assert.equal(state.rows.has('bob'),false);
});

test('outgoing account read cannot populate a later identity',async()=>{
  const {transport}=fixture();let release,start;
  const began=new Promise(r=>{start=r;});
  transport.read=async()=>{start();return new Promise(r=>{release=r;});};
  const old=accountAppearanceSync('alice',transport);
  const pending=old.load();await began;old.dispose();
  release({revision:'1',appearance:B});
  await assert.rejects(pending,/no longer active/);
});

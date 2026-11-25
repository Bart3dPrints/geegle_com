import assert from 'node:assert/strict';
import { test } from 'node:test';
import { externalSearch, searchAction } from '../../src/landing/search.ts';

test('library aliases only request guarded navigation, in both modes', () => {
  for (const mode of ['web','lucky']) for (const text of ['games','P-I-R-A-T-E',' Pirate '])
    assert.deepEqual(searchAction(text, mode), { kind:'library' });
});

test('submits encoded text to web search, not a user-provided origin', () => {
  for (const mode of ['web','lucky']) {
    const query = 'https://example.com/?a=b & q=hey';
    const {request} = searchAction(query, mode);
    const url = new URL(externalSearch(request));
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.searchParams.get('q'), query);
    assert.equal(url.searchParams.get('btnI'), mode === 'lucky' ? '1' : null);
  }
  assert.equal(searchAction('   ', 'web').kind, 'empty');
  assert.equal(searchAction('Bart is Awesome', 'lucky').kind, 'surprise');
});

// Testi detti a voce: node --import tsx scripts/check-fuzzy.mts
import assert from 'node:assert/strict';
import { textMatches } from '@/features/venues/filters';
import { distance, fuzzyIncludes, sound } from '@/lib/fuzzy';

assert.equal(sound('Torre Vecchia'), sound('torrevecchia'));
assert.equal(sound('garbatela'), sound('Garbatella'));
assert.equal(distance('kitten', 'sitting'), 3);
assert.ok(fuzzyIncludes('aquanienne', 'circolo aquaniene roma'));
const v = { name: 'Circolo Canottieri Aniene', address: 'Lungotevere dell’Acqua Acetosa 119' };
assert.ok(textMatches(v, 'canottieri aniene'));
assert.ok(textMatches(v, 'impianti sportivi'), 'solo parole generiche non restringono');
assert.ok(!textMatches(v, 'canotieri anien'), 'senza fuzzy niente errori');
assert.ok(!textMatches(v, 'circolo cassia', true), 'fuzzy solo su una parola');
assert.ok(textMatches(v, 'canotieri', true));
console.log('OK');

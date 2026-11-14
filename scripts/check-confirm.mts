// Conferma delle scritture dell'assistente: node --import tsx scripts/check-confirm.mts
import assert from 'node:assert/strict';
import { confirmStore } from '@/features/assistant/confirm-store';

let runs = 0;
const run = async () => (runs++, 'fatto');

// Il modello prova a saltare la domanda: confermato true senza richiesta prima → solo attesa
let r = await confirmStore.request('join:a', 'Ti iscrivo ad A', 'Iscrivimi', true, run);
assert.match(r, /IN ATTESA DI CONFERMA/);
assert.equal(runs, 0, 'senza richiesta prima non si esegue');
// Stessi dati e conferma dopo la richiesta → esegue una volta sola
r = await confirmStore.request('join:a', 'Ti iscrivo ad A', 'Iscrivimi', true, run);
assert.equal(r, 'fatto');
assert.equal(runs, 1);
r = await confirmStore.request('join:a', 'Ti iscrivo ad A', 'Iscrivimi', true, run);
assert.match(r, /Già fatto/);
assert.equal(runs, 1, 'un secondo sì non iscrive due volte');

// Dati cambiati tra domanda e sì → nuova domanda, niente esecuzione
await confirmStore.request('create:{"t":1}', 'Creo X', 'Crea', false, run);
r = await confirmStore.request('create:{"t":2}', 'Creo Y', 'Crea', true, run);
assert.match(r, /IN ATTESA/);
assert.equal(runs, 1);
assert.equal(confirmStore.get()?.summary, 'Creo Y');

// Pulsante: esegue e avvisa l'agente
const told: string[] = [];
confirmStore.setNotifier((t) => told.push(t));
await confirmStore.confirmByButton();
assert.equal(runs, 2);
assert.equal(confirmStore.get()?.state, 'done');
assert.match(told[0], /Conferma/);

// Annulla col pulsante: niente esecuzione, l'agente lo sa
await confirmStore.request('leave:b', 'Annullo B', 'Annulla iscrizione', false, run);
confirmStore.cancel();
assert.equal(confirmStore.get(), null);
assert.match(told[1], /Annulla/);
r = await confirmStore.request('leave:b', 'Annullo B', 'Annulla iscrizione', true, run);
assert.match(r, /IN ATTESA/, 'dopo Annulla un sì a voce richiede di nuovo la domanda');
assert.equal(runs, 2);

// Errore dell'API: si dice, non si lancia
await confirmStore.request('join:c', 'C', 'Iscrivimi', false, async () => {
  throw new Error('L’attività è già iniziata.');
});
r = await confirmStore.request('join:c', 'C', 'Iscrivimi', true, run);
assert.equal(r, 'Errore: L’attività è già iniziata.');
assert.equal(confirmStore.get()?.state, 'error');
console.log('OK');

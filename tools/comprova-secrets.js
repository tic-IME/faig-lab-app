#!/usr/bin/env node
/*
 * FAIG Lab — xarxa de seguretat contra identificadors publicats sense voler
 * Copyright (C) 2026  Institut Maria Espinalt
 * Publicat sota la GNU General Public License v3.0 o posterior. Veure LICENSE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ FA
 *   Recorre els fitxers SEGUITS PER GIT i peta si hi troba un identificador de
 *   fitxer de Google o un correu que no estigui a la llista de coses que són
 *   públiques a posta.
 *
 * QUÈ **NO** ÉS
 *   No és una barrera: quan això s'executa a CI, el codi ja és a GitHub i ja és
 *   públic. Un identificador de Drive no es pot revocar ni rotar com una clau
 *   d'API: si s'escapa, s'ha escapat. És un DETECTOR, i serveix per assabentar-
 *   se'n el mateix dia en lloc de mesos després.
 *   La barrera de debò és una altra i viu en dos llocs:
 *     · backend/ i .clasp.json són a .gitignore i no poden entrar a un commit.
 *     · tools/publica-backend.js no escriu la instantània si hi detecta res.
 *
 * PER QUÈ NO CONTÉ CAP SECRET
 *   Aquest fitxer és públic. La llista de sota NO són secrets a buscar: són els
 *   identificadors que han de ser al repositori i que, si no fossin aquí, farien
 *   petar el check cada dia fins que algú l'ignorés. Un detector que crida el
 *   llop és pitjor que no tenir-ne cap.
 *
 * ÚS
 *   node tools/comprova-secrets.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');

// ── Públics per disseny ──────────────────────────────────────────────────────
// Tots són identificadors que el navegador de qualsevol usuari ja veu, o que van
// impresos en un QR penjat a la paret. No són secrets i han de ser al repositori.
const PUBLICS = [
  // GAS_URL — l'URL del web app desplegat, que l'app crida des del navegador
  'AKfycbxfqvG-tQnvNAuNl3W-Ai5SIY0A9dzh9wMtjYAEfclvcQIu3axxMmRjUs8idEuUXbcH',
  // Client ID d'OAuth — pensat per anar al frontend
  '401812600474-8j16um5i49hu5v1bsjab7trnp7ao2lr8',
  // URL de RESPOSTA del formulari d'incidències (QR a la paret). Actualitzat a la
  // còpia de tic@ el 18/07/2026; el vell (1FAIpQLSepRkglU9...) ja no és a cap fitxer.
  '1FAIpQLSecbKYBsSoSCGay2DSxSHNbGxX-1IXxX8z5sG8muoXTpzz2eQ',
  // URL de RESPOSTA del formulari d'encàrrecs (QR a la paret)
  '1FAIpQLSfLdQD6-Lh6aHJ_Si0z1iUiYSjSjGEv7z2Jhdnd8iU-3B_GTQ',
];

// Fitxers on no té sentit buscar-hi: la llicència és text de tercers i el logo és
// binari.
const IGNORA = [/^LICENSE$/, /\.(png|jpe?g|gif|ico|svg|woff2?)$/i];

// ── Formes ───────────────────────────────────────────────────────────────────
// Un ID de fitxer de Google és una cadena llarga de [A-Za-z0-9_-] que barreja
// dígits, majúscules i minúscules. Els noms de símbol del codi són llargs però no
// porten dígits; per això no hi cauen.
const RE_ID     = /[A-Za-z0-9_-]{25,}/g;
const RE_CORREU = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Correus que són d'exemple o de placeholder, no de ningú.
const CORREUS_OK = [/@el-teu-domini\.cat$/, /@example\.(com|org)$/, /noreply@/i];

function semblaIdGoogle(s) {
  return /[0-9]/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s);
}

function esPublic(s) {
  return PUBLICS.some(function (p) { return p.indexOf(s) !== -1 || s.indexOf(p) !== -1; });
}

function correuOk(c) {
  return CORREUS_OK.some(function (re) { return re.test(c); });
}

function main() {
  const fitxers = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter(function (f) { return !IGNORA.some(function (re) { return re.test(f); }); });

  const problemes = [];

  for (const f of fitxers) {
    let text;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch (err) {
      continue;   // binari o il·legible
    }

    const ids = (text.match(RE_ID) || []).filter(semblaIdGoogle).filter(function (s) {
      return !esPublic(s);
    });
    const correus = (text.match(RE_CORREU) || []).filter(function (c) { return !correuOk(c); });

    const trobat = [...new Set([...ids, ...correus])];
    if (trobat.length > 0) problemes.push({ fitxer: f, trobat: trobat });
  }

  if (problemes.length > 0) {
    console.error('\nIDENTIFICADORS NO PÚBLICS AL REPOSITORI:\n');
    for (const p of problemes) {
      console.error('  ' + p.fitxer);
      for (const t of p.trobat) console.error('      ' + t);
    }
    console.error('\nSi és un identificador del centre: treu-lo del codi (Script Properties');
    console.error('o placeholder) i recorda que si ja s\'ha publicat, esborrar-lo del fitxer');
    console.error('NO l\'esborra de l\'historial de git ni de qui ja hagi clonat el repositori.');
    console.error('Si és públic a posta: afegeix-lo a PUBLICS, en aquest mateix fitxer, amb un');
    console.error('comentari que digui per què.\n');
    process.exit(1);
  }

  console.log('Cap identificador no públic a ' + fitxers.length + ' fitxers seguits per git.');
}

main();

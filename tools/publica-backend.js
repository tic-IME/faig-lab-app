#!/usr/bin/env node
/*
 * FAIG Lab — generador de la instantània pública del backend
 * Copyright (C) 2026  Institut Maria Espinalt
 * Publicat sota la GNU General Public License v3.0 o posterior. Veure LICENSE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ FA
 *   Copia backend/ (carpeta de treball local, FORA de git) cap a apps-script/
 *   (carpeta publicada), substituint els identificadors del centre per
 *   placeholders i estampant a cada fitxer una capçalera amb la data i la
 *   versió desplegada.
 *
 * COM ES FA SERVIR
 *   npx @google/clasp pull            # dins de backend/ — la instantània ha de
 *                                     # sortir del codi VIU, no d'un local que
 *                                     # pot estar endarrerit
 *   node tools/publica-backend.js 57  # 57 = versió desplegada del web app
 *
 * PER QUÈ AQUEST FITXER NO CONTÉ CAP SECRET
 *   És públic. Buscar-hi un identificador escrivint-lo aquí seria exactament la
 *   fuga que volem evitar. Per això TOTES les substitucions i tot el check es
 *   fan PER FORMA (expressions regulars), no per valor. Aquest script no sap
 *   quins són els identificadors del centre i no li calen.
 *
 * EL CHECK ÉS MÉS ESTRICTE QUE UNA LLISTA
 *   Una llista de secrets coneguts només atrapa els que algú ha recordat
 *   d'apuntar-hi. El check per forma atrapa QUALSEVOL identificador de Google i
 *   QUALSEVOL correu que aparegui a la sortida, inclosos els que encara no
 *   existeixen. Si peta, la instantània NO s'escriu.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ARREL   = path.resolve(__dirname, '..');
const ORIGEN  = path.join(ARREL, 'backend');
const DESTI   = path.join(ARREL, 'apps-script');
const FITXERS = ['Code.js', 'Encarrecs.js', 'Incidencies.js', 'appsscript.json'];

// .clasp.json NO és a la llista i no hi ha de ser MAI: conté l'Script ID.

// ── Substitucions ────────────────────────────────────────────────────────────
// Per forma. Cada entrada diu QUÈ busca i amb QUÈ ho substitueix.
const SUBSTITUCIONS = [
  {
    nom: "Form ID d'incidències (crearTriggerIncidencies)",
    re:  /(var FORM_ID\s*=\s*')[A-Za-z0-9_-]{25,}(')/g,
    per: '$1POSA-HI-EL-FORM-ID-D-INCIDENCIES$2',
  },
  {
    nom: 'domini del centre (validateToken)',
    re:  /(\.endsWith\(')@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}('\))/g,
    per: '$1@el-teu-domini.cat$2',
  },
];

// ── Check de secrets ─────────────────────────────────────────────────────────
// Un identificador de fitxer de Google (full, formulari, script) és una cadena
// llarga de [A-Za-z0-9_-] que barreja dígits, majúscules i minúscules. Els noms
// de símbol del codi són llargs però NO porten dígits, i per això no hi cauen.
const RE_ID_GOOGLE = /[A-Za-z0-9_-]{25,}/g;
const RE_CORREU    = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function semblaIdGoogle(s) {
  return /[0-9]/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s);
}

function troballes(text) {
  const ids = (text.match(RE_ID_GOOGLE) || []).filter(semblaIdGoogle);
  const correus = text.match(RE_CORREU) || [];
  return [...new Set([...ids, ...correus])];
}

// ── Capçalera ────────────────────────────────────────────────────────────────
function capcalera(versio, data) {
  return [
    '// ═══════════════════════════════════════════════════════════════════════',
    '// INSTANTÀNIA — AIXÒ NO ÉS LA FONT DE VERITAT.',
    '//',
    '// Generada:  ' + data,
    '// Versió del web app desplegada en aquell moment:  @' + versio,
    '//',
    '// La FONT DE VERITAT del backend és el projecte viu de Google Apps Script.',
    '// Aquest fitxer és una còpia datada per poder llegir i replicar el codi, i',
    '// es desincronitzarà en quant algú toqui el codi viu sense regenerar-la.',
    '// Si la data de sobre és antiga, no et refiïs d\'aquest fitxer.',
    '//',
    '// Regenerar (des de l\'arrel del repositori):',
    '//   cd backend && npx @google/clasp pull && cd ..',
    '//   node tools/publica-backend.js <versió>',
    '//',
    '// Els identificadors del centre estan substituïts per placeholders. Veure',
    '// el README per saber què hi has de posar per replicar l\'app.',
    '// ═══════════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');
}

// ── Programa ─────────────────────────────────────────────────────────────────
function main() {
  const versio = (process.argv[2] || '').trim();
  if (!/^\d+$/.test(versio)) {
    console.error('ERROR: falta la versió desplegada.\n' +
                  '  ús:  node tools/publica-backend.js <versió>\n' +
                  '  ex:  node tools/publica-backend.js 57\n\n' +
                  'La versió és la del desplegament del web app (clasp deployments).\n' +
                  'Va a la capçalera de cada fitxer: sense ella, la instantània no diu\n' +
                  'de quin codi és còpia i no serveix de res.');
    process.exit(1);
  }

  const data = new Date().toISOString().slice(0, 10);
  const generats = [];
  const errors   = [];

  for (const fitxer of FITXERS) {
    const origen = path.join(ORIGEN, fitxer);
    if (!fs.existsSync(origen)) {
      console.error('ERROR: no trobo ' + path.relative(ARREL, origen) +
                    '. Has fet el clasp pull dins de backend/?');
      process.exit(1);
    }

    let text = fs.readFileSync(origen, 'utf8');
    const aplicades = [];

    for (const s of SUBSTITUCIONS) {
      const abans = text;
      text = text.replace(s.re, s.per);
      if (text !== abans) aplicades.push(s.nom);
    }

    // El check va SEMPRE, hagi calgut substituir o no.
    const trobat = troballes(text);
    if (trobat.length > 0) {
      errors.push({ fitxer, trobat });
    }

    // appsscript.json és JSON: no admet comentaris i es copia tal qual.
    const contingut = fitxer.endsWith('.json') ? text : capcalera(versio, data) + text;
    generats.push({ fitxer, contingut, aplicades });
  }

  if (errors.length > 0) {
    console.error('\n╔══════════════════════════════════════════════════════════════╗');
    console.error('║  ATURAT: hi ha identificadors a la sortida. NO s\'ha escrit    ║');
    console.error('║  res a apps-script/.                                          ║');
    console.error('╚══════════════════════════════════════════════════════════════╝\n');
    for (const e of errors) {
      console.error('  ' + e.fitxer + ':');
      for (const t of e.trobat) console.error('      ' + t);
    }
    console.error('\nAixò vol dir que hi ha un identificador del centre al codi que cap');
    console.error('substitució no cobreix. Afegeix-hi una entrada a SUBSTITUCIONS (per');
    console.error('FORMA, mai escrivint el valor real en aquest fitxer, que és públic)');
    console.error('o treu l\'identificador del codi viu cap a Script Properties.\n');
    process.exit(1);
  }

  fs.mkdirSync(DESTI, { recursive: true });
  for (const g of generats) {
    fs.writeFileSync(path.join(DESTI, g.fitxer), g.contingut, 'utf8');
    const nota = g.aplicades.length ? '  ← ' + g.aplicades.join('; ') : '';
    console.log('  escrit  apps-script/' + g.fitxer + nota);
  }

  console.log('\nInstantània generada: ' + data + ', versió @' + versio + '.');
  console.log('Check de secrets: cap identificador de Google ni cap correu a la sortida.');
}

main();

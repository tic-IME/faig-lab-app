// ═══════════════════════════════════════════════════════════════════════
// INSTANTÀNIA — AIXÒ NO ÉS LA FONT DE VERITAT.
//
// Generada:  2026-07-18
// Versió del web app desplegada en aquell moment:  @59
//
// La FONT DE VERITAT del backend és el projecte viu de Google Apps Script.
// Aquest fitxer és una còpia datada per poder llegir i replicar el codi, i
// es desincronitzarà en quant algú toqui el codi viu sense regenerar-la.
// Si la data de sobre és antiga, no et refiïs d'aquest fitxer.
//
// Regenerar (des de l'arrel del repositori):
//   cd backend && npx @google/clasp pull && cd ..
//   node tools/publica-backend.js <versió>
//
// Els identificadors del centre estan substituïts per placeholders. Veure
// el README per saber què hi has de posar per replicar l'app.
//
// Copyright (C) 2026  Institut Maria Espinalt
// Programari lliure sota la GNU GPL v3 o posterior. Veure LICENSE.
// La marca del centre queda FORA de la llicència. Veure el README.
// ═══════════════════════════════════════════════════════════════════════
// ===== Utilitats d'escalada automàtica =====

// Normalitza text per comparar de manera robusta (minúscules, apòstrofs unificats, espais col·lapsats)
function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Nivell numèric d'una urgència (0 = cap acció automàtica ... 3 = risc). Entén escala nova i antiga.
function _nivellUrgencia(urgencia) {
  var u = _norm(urgencia);
  if (u.indexOf('hi ha risc') !== -1) return 3;
  if (u.indexOf("no funciona o l'he aturada") !== -1) return 2;
  if (u.indexOf('però amb algun problema') !== -1) return 1;
  return 0;
}

// Cadena canònica (escala nova) per a cada nivell
function _urgenciaCanonica(nivell) {
  if (nivell >= 3) return '🚨 Hi ha risc (flama, fum, olor de cremat, espurnes...)';
  if (nivell === 2) return '⛔ No funciona o l\'he aturada';
  if (nivell === 1) return '⚠️ Sí, però amb algun problema';
  return '✅ Sí, funciona amb normalitat';
}

// Taula de regles d'escalada. Cada regla: fragment(s) de títol + fragment de resposta (null = qualsevol resposta) + nivell mínim.
// Compara sobre text normalitzat: robust a espais, apòstrofs i emojis dels títols reals del formulari.
function _reglesEscalada(r) {
  var REGLES = [
    // — Nivell 3 (🚨 risc) —
    { titol: ['hi ha hagut flama, espurnes'], resposta: 'sí',                nivell: 3 },
    { titol: ['protocol', 'flama'],           resposta: null,                nivell: 3 },
    { titol: ['flama o incident'],            resposta: null,                nivell: 3 },
    { titol: ['símptoma principal'],          resposta: 'ferida',            nivell: 3 },
    { titol: ['símptoma principal'],          resposta: 'fum dens',          nivell: 3 },
    { titol: ['símptoma principal'],          resposta: 'olor química',      nivell: 3 },
    { titol: ['símptoma principal'],          resposta: 'continua emetent',  nivell: 3 },
    // — Nivell 2 (⛔ màquina fora de servei) —
    { titol: ['símptoma principal'],          resposta: 'encallat',          nivell: 2 },
    { titol: ['símptoma principal'],          resposta: 'air assist',        nivell: 2 },
    { titol: ['errors de sistema'],           resposta: '#900',              nivell: 2 },
    { titol: ["bomba d'aire"],                resposta: 'no funciona',       nivell: 2 },
    { titol: ['filtre de fums'],              resposta: 'no funciona',       nivell: 2 },
    // — Nivell 1 (⚠️ revisió pendent) —
    { titol: ['símptoma principal'],          resposta: 'desplaçat',         nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'aturada elèctrica', nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'altres',            nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'no talla',          nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'no grava',          nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'tall incomplet',    nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'línies desviades',  nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'cremades excessives', nivell: 1 },
    // — Impressores 3D: nivell 3 (🚨 risc) —
    { titol: ['símptomes generals'],          resposta: 'plàstic cremat',      nivell: 3 },
    { titol: ['símptomes generals'],          resposta: 'marques de cremat',   nivell: 3 },
    // — Impressores 3D: nivell 2 (⛔ fora de servei) —
    { titol: ['símptomes generals'],          resposta: "no s'encén",          nivell: 2 },
    { titol: ['símptomes generals'],          resposta: 'no escalfa',          nivell: 2 },
    { titol: ['símptomes generals'],          resposta: 'plàstic fos acumulat', nivell: 2 },
    { titol: ['símptomes generals'],          resposta: 'soroll mecànic fort', nivell: 2 },
    { titol: ['símptoma principal'],          resposta: 'no surt filament',    nivell: 2 },
    { titol: ['símptoma principal'],          resposta: 'embussat',            nivell: 2 },
    // — Impressores 3D: nivell 1 (⚠️ revisió pendent) —
    { titol: ['símptomes generals'],          resposta: "s'atura a mig treball", nivell: 1 },
    { titol: ['símptomes generals'],          resposta: 'capes desplaçades',   nivell: 1 },
    { titol: ['símptomes generals'],          resposta: 'altres',              nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'surt poc filament',   nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'forma irregular',     nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'soroll de clics',     nivell: 1 },
    { titol: ['símptoma principal'],          resposta: 'llisca',              nivell: 1 },
    { titol: ['primera capa'],                resposta: "no s'enganxa",        nivell: 1 },
    { titol: ['primera capa'],                resposta: 'desenganxa',          nivell: 1 },
    // — Plòter i escàner (comparteixen fragment de títol amb les 3D; les seves
    //    opcions "No s'encén", "Soroll mecànic fort", "S'atura a mig treball",
    //    "Altres" i "marques de cremat" ja queden cobertes per regles existents) —
    { titol: ['símptomes generals'],          resposta: 'olor de cremat',      nivell: 3 },
    { titol: ['símptomes generals'],          resposta: 'tall o punxada',      nivell: 3 },
    { titol: ['símptomes generals'],          resposta: 'el capçal no es mou', nivell: 2 },
    { titol: ['símptomes generals'],          resposta: 'es desconnecta',      nivell: 1 },
    { titol: ['símptomes generals'],          resposta: 'connector danyat',    nivell: 1 },
    { titol: ['símptomes generals'],          resposta: 'ha caigut',           nivell: 1 },
    // — Brodadora: pregunta d'alarma pròpia (títol diferent, no hereta res) —
    { titol: ["símptoma d'alarma"],           resposta: 'punxada o ferida',    nivell: 3 },
    { titol: ["símptoma d'alarma"],           resposta: 'olor de cremat',      nivell: 3 },
    { titol: ["símptoma d'alarma"],           resposta: 'agulla trencada',     nivell: 2 },
    { titol: ["símptoma d'alarma"],           resposta: "no s'encén",          nivell: 2 },
    { titol: ["símptoma d'alarma"],           resposta: 'bastidor encallat',   nivell: 1 },
    { titol: ["símptoma d'alarma"],           resposta: 'altres',              nivell: 1 },
    // — Plòter: error de registre —
    { titol: ['fallo del registro'],          resposta: 'sí',                  nivell: 1 }
  ];

  var resultat = { nivell: 0, motius: [] };
  Object.keys(r).forEach(function (titolReal) {
    var tNorm = _norm(titolReal);
    var respNorm = _norm(r[titolReal]);
    if (respNorm === '') return;
    REGLES.forEach(function (regla) {
      var titolCoincideix = regla.titol.every(function (f) { return tNorm.indexOf(_norm(f)) !== -1; });
      if (!titolCoincideix) return;
      var respostaCoincideix = regla.resposta === null
        ? true
        : respNorm.indexOf(_norm(regla.resposta)) !== -1;
      if (!respostaCoincideix) return;
      if (regla.nivell > resultat.nivell) resultat.nivell = regla.nivell;
      resultat.motius.push('«' + r[titolReal] + '» (' + titolReal + ') → mínim ' + _urgenciaCanonica(regla.nivell));
    });
  });
  return resultat;
}

// Paraules clau als textos lliures (només ressaltat al correu; NO canvia l'estat de res)
function _paraulesClauDetectades(textos) {
  var CLAUS = ['flama', 'foc', 'fum', 'crema', 'espurn', 'olor', 'ferida', 'pvc'];
  var trobades = [];
  textos.forEach(function (t) {
    var n = _norm(t.text);
    CLAUS.forEach(function (c) {
      if (n.indexOf(c) !== -1 && trobades.indexOf(c) === -1) trobades.push(c);
    });
  });
  return trobades;
}

// ===== TRIGGER: incidència entrada pel formulari ric =====
// Google ja desa totes les respostes al full; aquí NO registrem res (evitem duplicats).
// Feina: escalar la urgència segons símptomes (mai a la baixa), automatitzar si cal,
// i avisar admins amb TOT el detall i transparència total sobre l'escalada.
function processarIncidencia(e) {
  var r = {};
  var detallLinies = [];
  var textosLliures = [];
  e.response.getItemResponses().forEach(function (ir) {
    var titol = ir.getItem().getTitle();
    var resposta = ir.getResponse();
    if (Array.isArray(resposta)) resposta = resposta.join('; ');
    r[titol] = resposta;
    if (resposta !== '' && resposta !== null) {
      detallLinies.push('• ' + titol + ':\n  ' + resposta);
      var tipus = ir.getItem().getType();
      if (tipus === FormApp.ItemType.TEXT || tipus === FormApp.ItemType.PARAGRAPH_TEXT) {
        textosLliures.push({ titol: titol, text: resposta });
      }
    }
  });

  var maquina        = r['Màquina afectada'] || '';
  var urgenciaUsuari = r['La màquina es pot continuar fent servir?'] || r['Urgència'] || '';
  var nom            = r['Nom i cognom (docent responsable)'] || '(sense nom)';
  var email          = e.response.getRespondentEmail() || '(sense correu)';

  // Escalada automàtica: el sistema mai rebaixa el que diu l'usuari, només ho pot pujar
  var nivellUsuari  = _nivellUrgencia(urgenciaUsuari);
  var escalada      = _reglesEscalada(r);
  var nivellFinal   = Math.max(nivellUsuari, escalada.nivell);
  var urgenciaFinal = nivellFinal > nivellUsuari ? _urgenciaCanonica(nivellFinal) : urgenciaUsuari;

  var nouEstat = _incidenciaAutomatitza(maquina, urgenciaFinal);

  var capEscalada = '';
  if (nivellFinal > nivellUsuari) {
    capEscalada = '⚠️ ESCALADA AUTOMÀTICA DE LA URGÈNCIA\n' +
      'L\'usuari havia marcat: ' + (urgenciaUsuari || '(res)') + '\n' +
      'El sistema ha aplicat: ' + urgenciaFinal + '\n' +
      'Motius:\n- ' + escalada.motius.join('\n- ') + '\n\n';
  }

  var claus = _paraulesClauDetectades(textosLliures);
  var liniaClaus = claus.length > 0
    ? '🔎 Paraules clau detectades als textos lliures: ' + claus.join(', ') + '\n\n'
    : '';

  var detall = capEscalada + liniaClaus +
               'RESPOSTES COMPLETES DEL FORMULARI\n' +
               '--------------------------------\n' +
               detallLinies.join('\n\n');
  _incidenciaAvisaAdmins(nom, email, maquina, urgenciaFinal, detall, nouEstat);
}

// ===== TRIGGER (full): estampa l'estat inicial de la incidència =====
// Va SEPARAT de processarIncidencia expressament. El trigger del formulari no rep
// e.range i per tant no sap a quina fila ha escrit Google; aquest, lligat al full, sí.
// No toca el motor d'escalada: només omple les quatre columnes del Tram C.
function estampaIncidenciaNova(e) {
  // El trigger de full salta amb QUALSEVOL formulari lligat al full mestre (encàrrecs
  // inclosos). Sense aquesta guarda escriuríem columnes on no toca.
  var sheet = e.range.getSheet();
  if (sheet.getName() !== 'Incidències_Respostes') return;

  var fila = e.range.getRow();
  if (fila < 2) return;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    Logger.log('estampaIncidenciaNova: lock no obtingut, fila ' + fila + ': ' + err.message);
    return;
  }

  try {
    var cols = _incidenciaColumnes(sheet);

    // Si ja té ID no reestampem: evita perdre l'estat si el trigger es repeteix.
    var idActual = String(sheet.getRange(fila, cols.id).getValue() || '').trim();
    if (idActual !== '') {
      Logger.log('estampaIncidenciaNova: fila ' + fila + ' ja té ID (' + idActual + '), no es toca.');
      return;
    }

    var id = _incidenciaGeneraId(new Date(), _incidenciaIdsExistents(sheet, cols.id));
    sheet.getRange(fila, cols.id).setValue(id);
    sheet.getRange(fila, cols.estat).setValue('Oberta');
    sheet.getRange(fila, cols.dataCanvi).setValue(new Date());
    sheet.getRange(fila, cols.gestionada).setValue('');
    SpreadsheetApp.flush();
    Logger.log('estampaIncidenciaNova: fila ' + fila + ' → ' + id + ' (Oberta).');
  } catch (err) {
    Logger.log('estampaIncidenciaNova error a la fila ' + fila + ': ' + err.message);
  } finally {
    lock.releaseLock();
  }
}

// ===== D'UN SOL ÚS: connecta el trigger d'estat al FULL mestre =====
// Executar UNA VEGADA des de l'editor web, igual que crearTriggerIncidencies.
function crearTriggerEstatIncidencies() {
  var jaExisteix = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'estampaIncidenciaNova';
  });
  if (jaExisteix) {
    Logger.log('El trigger ja existeix. No se n\'ha creat cap de nou.');
    return;
  }

  ScriptApp.newTrigger('estampaIncidenciaNova')
    .forSpreadsheet(getSheetId())
    .onFormSubmit()
    .create();

  Logger.log('Trigger creat: estampaIncidenciaNova estamparà ID i Estat a cada incidència nova.');
}

// ===== D'UN SOL ÚS: backfill de les incidències antigues =====
// NO EXECUTAR fins que l'Anna ho decideixi. Omple ID_Incidencia i Estat="Oberta"
// NOMÉS a les files que no tenen ID; les que ja en tenen no es toquen (re-executable
// sense duplicar res). L'ID de les files antigues es deriva del Timestamp del
// formulari, no de l'hora d'execució, perquè l'identificador sigui fidel als fets.
function backfillEstatIncidencies() {
  var sheet   = getSheet('Incidències_Respostes');
  var cols    = _incidenciaColumnes(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colTs   = headers.indexOf('Marca de temps') + 1;
  if (colTs === 0) colTs = 1; // el Timestamp del formulari és sempre la columna A

  var ultima = sheet.getLastRow();
  if (ultima < 2) {
    Logger.log('Backfill: no hi ha files.');
    return;
  }

  var ids   = _incidenciaIdsExistents(sheet, cols.id);
  var fets  = 0;
  var salts = 0;

  for (var fila = 2; fila <= ultima; fila++) {
    if (String(sheet.getRange(fila, cols.id).getValue() || '').trim() !== '') {
      salts++;
      continue;
    }

    var ts  = sheet.getRange(fila, colTs).getValue();
    var quan = (ts instanceof Date && !isNaN(ts.getTime())) ? ts : new Date();
    var id  = _incidenciaGeneraId(quan, ids);
    ids.push(id);

    sheet.getRange(fila, cols.id).setValue(id);
    sheet.getRange(fila, cols.estat).setValue('Oberta');
    sheet.getRange(fila, cols.dataCanvi).setValue(quan);
    sheet.getRange(fila, cols.gestionada).setValue('');
    fets++;
  }

  SpreadsheetApp.flush();
  Logger.log('Backfill acabat: ' + fets + ' files omplertes, ' + salts + ' saltades (ja tenien ID).');
}

// ===== TRAM E: alerta per temps (incidències encallades) =====

// Dies laborables a partir dels quals una incidència es considera encallada.
// El llindar és INCLUSIU: amb 3, el TERCER dia laborable ja alerta.
// "Oberta" compta des de la Marca de temps; "En curs", des de Data_Canvi_Estat.
var ALERTA_DIES_OBERTA  = 3;
var ALERTA_DIES_EN_CURS = 10;

// Dies laborables (dilluns-divendres) transcorreguts entre dues dates. El dia del
// report NO compta. No hi ha taula de festius: només s'exclouen dissabtes i diumenges.
// Funció pura; provaDiesLaborables() la cobreix amb dates sintètiques.
function _diesLaborables(desde, fins) {
  if (!(desde instanceof Date) || isNaN(desde.getTime())) return 0;
  if (!(fins  instanceof Date) || isNaN(fins.getTime()))  return 0;
  if (fins <= desde) return 0;

  // Iterem per dates de calendari al MIGDIA: així el canvi d'hora de març i
  // d'octubre no pot fer saltar ni repetir un dia.
  var d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 12, 0, 0);
  var f = new Date(fins.getFullYear(),  fins.getMonth(),  fins.getDate(),  12, 0, 0);

  var dies = 0;
  d.setDate(d.getDate() + 1);
  while (d <= f) {
    var dia = d.getDay();          // 0=diumenge, 6=dissabte
    if (dia !== 0 && dia !== 6) dies++;
    d.setDate(d.getDate() + 1);
  }
  return dies;
}

// Recol·lector: quines incidències creuen el llindar a data 'ara'. Va SEPARAT de
// l'enviament perquè provaAlertaEncallades() el pugui exercitar sense enviar correus
// (l'única via de verificar el tram mentre dura la pausa d'estiu).
function _incidenciesEncallades(ara) {
  var sheet  = getSheet('Incidències_Respostes');
  var valors = sheet.getDataRange().getValues();
  if (valors.length < 2) return [];

  var idx    = _incidenciaIndexCamps(valors[0]);
  var llista = [];

  for (var f = 1; f < valors.length; f++) {
    var fila  = valors[f];
    var estat = String(fila[idx.estat] || '').trim();

    if (estat === 'Resolta') continue;

    var referencia, llindar;
    if (estat === 'En curs') {
      referencia = fila[idx.data_canvi];
      llindar    = ALERTA_DIES_EN_CURS;
    } else {
      // "Oberta" i les que tenen l'Estat BUIT: aquestes últimes són el símptoma
      // d'una fallada silenciosa de l'estampat i el vigilant és l'únic canal
      // automàtic que les pot fer visibles. Es compten des de la Marca de temps.
      referencia = fila[idx.data];
      llindar    = ALERTA_DIES_OBERTA;
    }

    if (!(referencia instanceof Date) || isNaN(referencia.getTime())) continue;

    var dies = _diesLaborables(referencia, ara);
    if (dies < llindar) continue;

    llista.push({
      id:            String(fila[idx.id] || '').trim(),
      maquina:       String(fila[idx.maquina_id] || '').trim(),
      estat:         estat,
      dies:          dies,
      gestionada:    String(fila[idx.gestionada_per] || '').trim(),
      senseEstampar: estat === '',
      fila:          f + 1,
    });
  }

  llista.sort(function (a, b) { return b.dies - a.dies; });
  return llista;
}

function _cosAlertaEncallades(llista) {
  var linies = llista.map(function (i) {
    return '• ' + (i.id || '(sense ID — fila ' + i.fila + ' del full)') +
           ' — ' + (i.maquina || '(sense màquina)') + '\n' +
           '  Estat: ' + (i.estat || '(buit)') +
           ' · Encallada des de fa ' + i.dies + ' dies laborables' +
           ' · Gestiona: ' + (i.gestionada || 'ningú') +
           (i.senseEstampar ? '\n  ⚠️ sense estampar (Estat buit) — revisar' : '');
  });

  return 'Incidències que superen el llindar de temps:\n\n' +
         linies.join('\n\n') + '\n\n' +
         '--------------------------------\n' +
         'Llindars: ' + ALERTA_DIES_OBERTA + ' dies laborables en "Oberta", ' +
         ALERTA_DIES_EN_CURS + ' en "En curs".\n' +
         'Es compten de dilluns a divendres; els festius NO es tenen en compte.\n' +
         'Aquest avís no s\'envia durant el juliol ni l\'agost.';
}

// TRIGGER DE RELLOTGE (diari). No passa per doPost ni pel web app: executa sempre
// l'últim codi desat, o sigui que un clasp push ja el posa al dia.
function alertaIncidenciesEncallades() {
  // PAUSA D'ESTIU: cap alerta al juliol ni a l'agost. Si algú es pregunta per què
  // durant l'estiu no arriba res, la resposta és aquesta i no una avaria.
  var mes = new Date().getMonth();          // 0 = gener
  if (mes === 6 || mes === 7) {             // 6 = juliol, 7 = agost
    Logger.log('Pausa d\'estiu (mes ' + (mes + 1) + '): cap alerta.');
    return;
  }

  try {
    var llista = _incidenciesEncallades(new Date());
    if (llista.length === 0) {
      Logger.log('Cap incidència encallada: no s\'envia cap correu.');
      return;
    }

    var admins = getAdminEmails();
    if (admins.length === 0) {
      Logger.log('Hi ha ' + llista.length + ' incidències encallades, però cap admin a qui avisar.');
      return;
    }

    MailApp.sendEmail({
      to:      admins[0],
      cc:      admins.slice(1).join(','),
      subject: 'FAIG Lab — ' + llista.length + ' ' +
               (llista.length === 1 ? 'incidència encallada' : 'incidències encallades'),
      body:    _cosAlertaEncallades(llista),
    });
    Logger.log('Avís enviat als admins: ' + llista.length + ' incidències encallades.');
  } catch (err) {
    // Com tots els triggers d'aquest projecte: si falla, falla EN SILENCI.
    Logger.log('alertaIncidenciesEncallades error: ' + err.message);
  }
}

// ===== D'UN SOL ÚS: connecta el trigger diari del vigilant =====
function crearTriggerAlertaEncallades() {
  var jaExisteix = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'alertaIncidenciesEncallades';
  });
  if (jaExisteix) {
    Logger.log('El trigger ja existeix. No se n\'ha creat cap de nou.');
    return;
  }

  ScriptApp.newTrigger('alertaIncidenciesEncallades')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  Logger.log('Trigger creat: alertaIncidenciesEncallades s\'executarà cada dia entre les 7 i les 8 (hora de Madrid).');
}

// ===== PROVES DEL TRAM E (executar des de l'editor) =====

// Cobreix _diesLaborables amb dates sintètiques: no cal esperar cap dia real.
// Juliol 2026: 13=dl, 17=dv, 18=ds, 19=dg, 20=dl. Octubre 2026: 23=dv, 26=dl.
function provaDiesLaborables() {
  var casos = [
    ['divendres 17 -> dilluns 20 (el cap de setmana no compta)', new Date(2026,6,17,10), new Date(2026,6,20,10), 1],
    ['dilluns 13 -> dijous 16 (llindar Oberta: alerta)',         new Date(2026,6,13,10), new Date(2026,6,16,10), 3],
    ['dilluns 13 -> divendres 17',                               new Date(2026,6,13,10), new Date(2026,6,17,10), 4],
    ['divendres 10 -> divendres 17 (una setmana)',               new Date(2026,6,10,10), new Date(2026,6,17,10), 5],
    ['mateix dia',                                               new Date(2026,6,15,10), new Date(2026,6,15,18), 0],
    ['dissabte 18 -> dilluns 20',                                new Date(2026,6,18,10), new Date(2026,6,20,10), 1],
    ['divendres 17 -> dissabte 18 (cap de laborable)',           new Date(2026,6,17,10), new Date(2026,6,18,10), 0],
    ['fins ANTERIOR a desde',                                    new Date(2026,6,20,10), new Date(2026,6,13,10), 0],
    ['dilluns 13 -> dilluns 20 (setmana justa)',                 new Date(2026,6,13,10), new Date(2026,6,20,10), 5],
    ['creua el canvi d\'hora: dv 23/10 -> dl 26/10',             new Date(2026,9,23,10), new Date(2026,9,26,10), 1],
  ];

  var ko = 0;
  casos.forEach(function (c) {
    var r  = _diesLaborables(c[1], c[2]);
    var ok = (r === c[3]);
    if (!ok) ko++;
    Logger.log((ok ? 'OK    ' : 'FALLA ') + r + ' (esperat ' + c[3] + ') | ' + c[0]);
  });
  Logger.log(ko === 0 ? '>>> els ' + casos.length + ' casos passen' : '>>> ' + ko + ' CASOS FALLEN');
}

// Exercita el recol·lector amb el full REAL, saltant-se la pausa d'estiu i SENSE
// enviar cap correu. És l'única manera de verificar el tram abans de l'1 de setembre.
function provaAlertaEncallades() {
  var llista = _incidenciesEncallades(new Date());
  Logger.log('Incidències que superarien el llindar ARA MATEIX: ' + llista.length);
  if (llista.length === 0) {
    Logger.log('(cap: amb el full actual no s\'enviaria cap correu)');
    return;
  }
  Logger.log('--- cos del correu que s\'enviaria ---');
  Logger.log(_cosAlertaEncallades(llista));
  Logger.log('--- FI. No s\'ha enviat res. ---');
}

// ===== D'UN SOL ÚS: connecta el trigger al formulari d'incidències =====
// Executar UNA VEGADA des de l'editor web. Crea l'activador onFormSubmit
// del formulari "Registre d'Incidències – FAIG Lab" apuntant a processarIncidencia.
function crearTriggerIncidencies() {
  // El Form ID ja NO és al codi: viu a Script Property FORM_INCIDENCIES_ID (@59),
  // com FORM_ENCARRECS_ID. Si falta, no creem res i ho diem.
  var FORM_ID = PropertiesService.getScriptProperties().getProperty('FORM_INCIDENCIES_ID');
  if (!FORM_ID) {
    Logger.log('FALTA la Script Property FORM_INCIDENCIES_ID. No es crea cap trigger.');
    return;
  }

  // Evitem duplicats: si ja existeix un trigger de processarIncidencia, no en creem un altre.
  // ATENCIÓ AL CUTOVER: aquesta guarda bloqueja la creació si el trigger VELL encara hi és.
  // Cal esborrar-lo ABANS d'executar aquesta funció perquè apunti al formulari nou.
  var jaExisteix = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'processarIncidencia';
  });
  if (jaExisteix) {
    Logger.log('El trigger ja existeix. No se n\'ha creat cap de nou. (Si estàs migrant, ' +
               'esborra primer el trigger vell.)');
    return;
  }

  ScriptApp.newTrigger('processarIncidencia')
    .forForm(FORM_ID)
    .onFormSubmit()
    .create();

  Logger.log('Trigger creat: processarIncidencia sobre el formulari ' + FORM_ID + '.');
}

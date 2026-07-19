// ═══════════════════════════════════════════════════════════════════════
// INSTANTÀNIA — AIXÒ NO ÉS LA FONT DE VERITAT.
//
// Generada:  2026-07-19
// Versió del web app desplegada en aquell moment:  @60
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
// === FAIG · Canonada d'encàrrecs ===
//
// PATRÓ (calcat d'incidències, Trams A i C). Els dos triggers van SEPARATS a posta:
//   - Formulari lligat AL FULL MESTRE: la fila la garanteix GOOGLE, no nosaltres.
//     Si un trigger falla, la fila hi és igualment (sense ID) i es veu. Abans del
//     19/07/2026 la fila l'escrivia processarEncarrec: si fallava, l'encàrrec
//     desapareixia del full i ningú se n'assabentava.
//   - Trigger de FORMULARI (processarEncarrec): NOMÉS avisa els admins. NO escriu
//     cap fila. Viu d'e.response i no sap a quina fila ha escrit Google.
//   - Trigger de FULL (estampaEncarrecNou): estampa ID i Estat. Necessita e.range.
//   NO FUSIONAR-LOS: e.response i e.range no conviuen al mateix tipus de trigger.
//
// El formulari NO es crea mai des d'aquí: ja existeix i s'ADOPTA. Veure
// adoptaFormulariEncarrecs.

const ENCARREC_FULL   = 'Encarrecs_Respostes';
const ENCARREC_ESTATS = ['Rebut', 'Acceptat', 'En producció', 'Llest', 'Entregat', 'Rebutjat'];
const ENCARREC_ESTAT_INICIAL = 'Rebut';
const ENCARREC_PROP_FORM_ID  = 'FORM_ENCARRECS_ID';

// Estats TERMINALS: el filtre per defecte de getEncarrecs els exclou. Aïllats aquí a
// posta i no escampats per la lògica. OJO amb la diferència respecte d'incidències,
// que només en té UN ('Resolta'): aquí n'hi ha DOS.
const ENCARREC_TANCATS = ['Entregat', 'Rebutjat'];

// Subconjunt de camps que viatgen a la llista de l'app: capçalera del full → clau de
// sortida. Les respostes senceres del formulari NO viatgen aquí; el detall es demana
// d'un en un amb getEncarrec.
// El CORREU no hi és a posta: no cal a la llista i el detall el mostra igualment
// (aparella per índex i no necessita saber com es diu la capçalera que hi posa Google).
const ENCARREC_CAMPS_LLISTA = [
  { capcalera: 'Marca de temps',                clau: 'data' },
  { capcalera: 'Títol curt de l\'encàrrec',     clau: 'titol' },
  { capcalera: 'Nom del docent sol·licitant',   clau: 'docent' },
  { capcalera: 'Departament / àmbit',           clau: 'departament' },
  { capcalera: 'ID_Encarrec',                   clau: 'id' },
  { capcalera: 'Estat',                         clau: 'estat' },
  { capcalera: 'Data_Canvi_Estat',              clau: 'data_canvi' },
  { capcalera: 'Gestionat_Per',                 clau: 'gestionat_per' },
];

// Columnes de GESTIÓ, a la dreta de les que escriu Google. Les 4 primeres són el
// bloc del Tram C (les úniques que toca el codi); la resta són el flux FAIG i les
// omple una persona.
// ATENCIÓ: 'Materials / estoc' i 'Observacions' NO són aquí a posta — vénen del
// formulari i les escriu Google a l'esquerra. Re-crear-les duplicaria el camp.
// ATENCIÓ: cap pregunta del formulari es pot dir exactament com cap d'aquestes
// (sobretot 'Estat'): la cerca és per indexOf sobre la capçalera i agafaria la
// primera coincidència, escrivint a la columna equivocada.
const ENCARREC_COLS_GESTIO = [
  'ID_Encarrec',
  'Estat',
  'Data_Canvi_Estat',
  'Gestionat_Per',
  'Padrí/padrina FAIG',
  'Alumnat especialitzat',
  'Espai i reserva',
  'Data planificada',
  'Data feta',
  'Evidència',
  'Notes_FAIG',
];

// ===== FASE 3 (@60): EDICIÓ DELS CAMPS D'EQUIP DES DE L'APP =====
// Les 7 columnes que l'equip omple a mà i que ARA són editables des de la vista de
// gestió. Derivades de ENCARREC_COLS_GESTIO (= gestió MENYS les 4 del sistema): si
// algú hi afegeix una columna de sistema, no cal mantenir dues llistes en paral·lel.
// Són l'ÚNICA llista blanca: updateEncarrecGestio rebutja amb 400 qualsevol clau que
// no hi sigui (formulari, les 4 del sistema i les 2 de traça queden fora).
const ENCARREC_COLS_EQUIP = ENCARREC_COLS_GESTIO.slice(4);

// Subconjunt d'equip que són DATES: s'escriuen com a TEXT pla 'YYYY-MM-DD' amb un
// setNumberFormat('@') PREVI. Lliçó de la Capa 1: escriure '2026-09-15' en una cel·la
// sense format text la converteix en data real i trenca lectura i comparació.
const ENCARREC_COLS_EQUIP_DATA = ['Data planificada', 'Data feta'];

// TRAÇA D'EDICIÓ (decisió b, @60): les escriu SEMPRE el servidor en cada desament
// correcte i MAI el client (dins camps → 400, com 'Estat'). Cadenes LITERALS del full
// verificades per l'Anna: 'Data_Edicio' va SENSE accent a posta. Data_Edicio es
// desa com a text pla (marca de temps), igual que les dates d'equip.
const ENCARREC_COL_EDITAT_PER  = 'Editat_Per';
const ENCARREC_COL_DATA_EDICIO = 'Data_Edicio';

// ===== ADOPCIÓ DEL FORMULARI (executar des de l'editor web) =====
// IDEMPOTENT: es pot tornar a executar sense por. Cada pas comprova si ja està fet
// i ho diu al Logger. NO crea cap formulari: si no en troba cap d'adoptable,
// s'atura amb un error clar. Crear-ne un de nou duplicaria el QR que ja circula.
function adoptaFormulariEncarrecs() {
  var props = PropertiesService.getScriptProperties();

  // GUARDA DE COMPTE, abans de tocar res: si no és el compte bo, ens aturem sense
  // haver mutat el formulari ni el full.
  var trigs = _encarrecTriggersProcessar();
  var form  = _encarrecFormAdoptat(props, trigs);

  Logger.log('Formulari adoptat: "' + form.getTitle() + '"');
  Logger.log('  ID:        ' + form.getId());
  Logger.log('  Respondre: ' + form.getPublishedUrl());
  Logger.log('  Editar:    ' + form.getEditUrl());

  // Les respostes que ja tingui el formulari es COPIARAN a la pestanya nova en
  // lligar-la, i hi entraran sense ID ni Estat (l'estampador només salta amb
  // enviaments nous). Ens aturem: esborrar respostes és una decisió de DADES i la
  // pren l'Anna, no aquest codi. Un cop buit, la funció continua sola.
  var nResp = form.getResponses().length;
  if (nResp > 0 && !_encarrecFullJaLligat(form)) {
    throw new Error('El formulari té ' + nResp + ' resposta/es guardades. En lligar-lo al ' +
                    'full es copiarien a la pestanya nova SENSE ID ni Estat, i hi quedarien ' +
                    'com a files òrfenes. Si són les proves velles, esborra-les des del ' +
                    'formulari (Respostes → ⋮ → Suprimeix totes les respostes) i torna a ' +
                    'executar aquesta funció. Si les vols conservar, digues-ho abans de ' +
                    'continuar: cal decidir què fer amb elles.');
  }

  _encarrecAjustaFormulari(form);
  var sheet = _encarrecPreparaFull(form);
  _encarrecAfegeixColsGestio(sheet);
  _encarrecPreparaTriggers();

  Logger.log('ADOPCIÓ COMPLETA. Pestanya: "' + sheet.getName() + '".');
}

// ELS TRIGGERS PERTANYEN AL COMPTE QUE ELS CREA, i getProjectTriggers() NOMÉS
// retorna els propis: "no el veig" NO vol dir "no existeix". Com que processarEncarrec
// existeix (verificat per l'Anna, 19/07/2026), no veure'l només pot voler dir que
// aquesta execució va des d'un compte diferent del que el va crear. Aturar-se és
// obligatori: continuar faria que _encarrecPreparaTriggers en creés un DE SEGON i
// cada encàrrec enviaria DOS avisos, per sempre i sense cap senyal.
function _encarrecTriggersProcessar() {
  var trigs = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'processarEncarrec';
  });
  if (trigs.length === 0) {
    throw new Error('Des d\'aquest compte no veig cap trigger processarEncarrec, però sabem ' +
                    'que existeix. getProjectTriggers() només retorna els triggers DEL COMPTE ' +
                    'QUE EXECUTA, o sigui que el va crear un compte diferent d\'aquest. ' +
                    'Executa aquesta funció des del compte que veu els quatre activadors del ' +
                    'projecte. NO forcis res des d\'aquí: crearia un segon trigger i cada ' +
                    'encàrrec enviaria dos avisos.');
  }
  return trigs;
}

// Localitza el formulari sense poder-ne crear cap. Tres vies, en ordre:
//   1. Script Property FORM_ENCARRECS_ID (la font de veritat un cop adoptat).
//   2. El trigger processarEncarrec que ja existeix: getTriggerSourceId() ens dona
//      l'ID del formulari al qual està lligat. Així recuperem un ID que fins ara
//      només vivia al Logger d'una execució de fa setmanes.
//   3. Res: error clar demanant l'ID a mà.
function _encarrecFormAdoptat(props, trigs) {
  var id = String(props.getProperty(ENCARREC_PROP_FORM_ID) || '').trim();
  if (id !== '') {
    Logger.log('Form ID llegit de Script Properties.');
    return FormApp.openById(id);
  }

  var origens = trigs
    .filter(function (t) { return t.getTriggerSource() === ScriptApp.TriggerSource.FORMS; })
    .map(function (t) { return t.getTriggerSourceId(); })
    .filter(function (v) { return !!v; });

  var unics = origens.filter(function (v, i) { return origens.indexOf(v) === i; });

  if (unics.length === 1) {
    var form = FormApp.openById(unics[0]);
    props.setProperty(ENCARREC_PROP_FORM_ID, unics[0]);
    Logger.log('Form ID descobert des del trigger processarEncarrec i desat a Script ' +
               'Properties (' + ENCARREC_PROP_FORM_ID + ' = ' + unics[0] + ').');
    return form;
  }

  if (unics.length > 1) {
    throw new Error('Hi ha ' + unics.length + ' triggers processarEncarrec lligats a ' +
                    'formularis DIFERENTS (' + unics.join(', ') + '). Cal decidir a mà quin ' +
                    'és el bo i esborrar els altres abans de continuar.');
  }

  throw new Error('No trobo cap formulari d\'encàrrecs. Desa l\'ID a Script Properties ' +
                  'com a ' + ENCARREC_PROP_FORM_ID + '. L\'ID és el tros de l\'URL D\'EDICIÓ ' +
                  'del formulari: docs.google.com/forms/d/<AIXÒ>/edit (NO serveix l\'URL ' +
                  'pública /d/e/.../viewform: hi surt un identificador diferent).');
}

// Correccions de l'E0 sobre el formulari existent. Cada canvi comprova si ja hi és.
function _encarrecAjustaFormulari(form) {
  // El correu el captura el formulari, no un camp de text que es pot escriure
  // malament. Mateixa lliçó que a incidències.
  if (!form.collectsEmail()) {
    form.setCollectEmail(true);
    Logger.log('  Formulari: activada la captura automàtica del correu.');
  }

  // LA RESTRICCIÓ AL DOMINI NO ES FA DES D'AQUÍ, I ÉS DELIBERAT (19/07/2026).
  // form.setRequireLogin(true) petava de manera DETERMINISTA amb "Failed to edit the
  // form. Please wait and try again." El missatge enganya: no és transitori ni és
  // rate limiting. Prova que ho descarta: a la segona execució setCollectEmail ja es
  // saltava (mode verificat posat), o sigui que requireLogin era la PRIMERA
  // escriptura de l'execució, sense cap ràfega al davant, i va petar igual al mateix
  // punt. Un sleep o un backoff només ho farien petar més lentament.
  // És un paràmetre D'UN SOL ÚS: es posa a mà a Configuració → Respostes → "Restringeix
  // als usuaris d'Institut Maria Espinalt" i es verifica MIRANT-LO, que per a un
  // paràmetre que decideix qui pot enviar encàrrecs és millor garantia que un log.
  // Tampoc en llegim l'estat: requiresLogin() és l'altra meitat del mateix parell
  // sospitós i no volem que una lectura tombi l'adopció.

  // El camp de correu manual queda substituït per la captura automàtica.
  var correu = _encarrecItemPerTitol(form, 'Correu de contacte');
  if (correu) {
    form.deleteItem(correu);
    Logger.log('  Formulari: esborrada la pregunta "Correu de contacte" (ara el captura Google).');
  }

  // CONTEXT FAIG: l'encàrrec ha d'acollir la idea difusa, no només la comanda
  // tancada. Una data obligatòria barra la porta a qui ve a pensar.
  var data = _encarrecItemPerTitol(form, 'Per a quan ho necessites');
  if (data) {
    var dataItem = data.asDateItem();
    if (dataItem.isRequired()) {
      dataItem.setRequired(false);
      Logger.log('  Formulari: "Per a quan ho necessites" ja no és obligatòria.');
    }
    dataItem.setHelpText('Si encara no tens data, deixa-ho en blanc: ho concretem junts.');
  }

  if (!_encarrecItemPerTitol(form, 'Tens una data o fita?')) {
    var fita = form.addListItem()
      .setTitle('Tens una data o fita?')
      .setRequired(true)
      .setChoiceValues([
        'Sí, tinc una data concreta',
        'Aquest trimestre, sense data fixa',
        'Encara no ho sé / ho volem parlar',
      ]);
    if (data) form.moveItem(fita.getIndex(), data.getIndex());
    Logger.log('  Formulari: afegida "Tens una data o fita?" amb sortida per a la idea difusa.');
  }

  var repte = _encarrecItemPerTitol(form, 'Què vols fer? (repte o producte)');
  if (repte) {
    repte.asParagraphTextItem().setHelpText(
      'Descriu el repte i, si ja el saps, el producte final. Si encara és una idea difusa, ' +
      'explica-la tal com la tens: el FAIG t\'acompanya a definir-la.'
    );
  }
}

// Un cop lligat, el formulari acumula respostes REALS i la guarda de respostes
// prèvies deixa de tenir sentit: sense això, tornar a executar l'adopció petaria
// per sempre a partir del primer encàrrec de debò.
function _encarrecFullJaLligat(form) {
  try {
    return form.getDestinationId() === getSheetId();
  } catch (err) {
    return false; // sense destinació: getDestinationId llança
  }
}

function _encarrecItemPerTitol(form, titol) {
  var trobats = form.getItems().filter(function (it) { return it.getTitle() === titol; });
  return trobats.length > 0 ? trobats[0] : null;
}

// Lliga el formulari al full mestre i deixa la pestanya de respostes amb el nom bo.
// La pestanya nova es localitza per DIFERÈNCIA de noms abans/després: getFormUrl()
// no serveix per casar-la (retorna un URL amb un identificador que no és el Form ID).
function _encarrecPreparaFull(form) {
  var sheetId = getSheetId();

  var jaLligat = null;
  try {
    jaLligat = form.getDestinationId();
  } catch (err) {
    jaLligat = null; // sense destinació: getDestinationId llança
  }

  if (jaLligat && jaLligat !== sheetId) {
    throw new Error('El formulari ja aboca a un ALTRE full (' + jaLligat + '), no al mestre ' +
                    '(' + sheetId + '). Cal resoldre-ho a mà: desvincular-lo des del formulari.');
  }

  if (jaLligat === sheetId) {
    var exist = SpreadsheetApp.openById(sheetId).getSheetByName(ENCARREC_FULL);
    if (exist) {
      Logger.log('  Full: el formulari ja aboca a "' + ENCARREC_FULL + '". Res a fer.');
      return exist;
    }
    throw new Error('El formulari ja aboca al full mestre però no hi trobo cap pestanya "' +
                    ENCARREC_FULL + '". Localitza a mà la pestanya de respostes i reanomena-la.');
  }

  var abans = SpreadsheetApp.openById(sheetId).getSheets().map(function (s) { return s.getName(); });
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId);
  SpreadsheetApp.flush();

  var ss      = SpreadsheetApp.openById(sheetId);
  var noves   = ss.getSheets().filter(function (s) { return abans.indexOf(s.getName()) === -1; });

  if (noves.length !== 1) {
    throw new Error('Esperava UNA pestanya nova després de lligar el formulari i n\'he trobat ' +
                    noves.length + '. Localitza-la a mà, reanomena-la "' + ENCARREC_FULL +
                    '" i torna a executar aquesta funció.');
  }

  noves[0].setName(ENCARREC_FULL);
  SpreadsheetApp.flush();
  Logger.log('  Full: formulari lligat al mestre; pestanya reanomenada a "' + ENCARREC_FULL + '".');
  return noves[0];
}

// Afegeix les columnes de gestió que faltin, a la dreta. Idempotent: les que ja hi
// són no es toquen. Les escriu el CODI a posta — una capçalera escrita a mà amb un
// accent de més trencaria la cerca per capçalera en silenci.
function _encarrecAfegeixColsGestio(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  var falten = ENCARREC_COLS_GESTIO.filter(function (c) { return headers.indexOf(c) === -1; });
  if (falten.length === 0) {
    Logger.log('  Columnes de gestió: totes hi són. Res a fer.');
    return;
  }

  var desDe = sheet.getLastColumn() + 1;
  if (sheet.getMaxColumns() < desDe + falten.length - 1) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), desDe + falten.length - 1 - sheet.getMaxColumns());
  }
  sheet.getRange(1, desDe, 1, falten.length).setValues([falten]);
  SpreadsheetApp.flush();
  Logger.log('  Columnes de gestió afegides: ' + falten.join(', '));
}

// El trigger de FORMULARI (processarEncarrec) JA EXISTEIX i es conserva: ara només
// avisa. Aquí només cal afegir-hi el de FULL, que abans no existia.
// AQUESTA FUNCIÓ NO CREA MAI processarEncarrec, a posta: _encarrecTriggersProcessar
// ja ha garantit que el veiem, i crear-ne un de segon (perquè getProjectTriggers no
// veu els d'altres comptes) duplicaria els avisos per sempre.
function _encarrecPreparaTriggers() {
  var trigs = ScriptApp.getProjectTriggers();
  Logger.log('  Trigger: processarEncarrec ja existeix i es conserva (només avisa).');

  var teFull = trigs.some(function (t) {
    return t.getHandlerFunction() === 'estampaEncarrecNou';
  });
  if (!teFull) {
    ScriptApp.newTrigger('estampaEncarrecNou').forSpreadsheet(getSheetId()).onFormSubmit().create();
    Logger.log('  Trigger: creat estampaEncarrecNou (estampat d\'ID i Estat).');
  } else {
    Logger.log('  Trigger: estampaEncarrecNou ja existeix. Res a fer.');
  }
}

// ===== ESTAMPAT (trigger de FULL) =====
// Calcat d'estampaIncidenciaNova. Necessita e.range i per això va lligat al FULL.
function estampaEncarrecNou(e) {
  // El trigger de full salta amb QUALSEVOL formulari lligat al full mestre
  // (incidències incloses). Sense aquesta guarda escriuríem columnes on no toca.
  var sheet = e.range.getSheet();
  if (sheet.getName() !== ENCARREC_FULL) return;

  var fila = e.range.getRow();
  if (fila < 2) return;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    Logger.log('estampaEncarrecNou: lock no obtingut, fila ' + fila + ': ' + err.message);
    return;
  }

  try {
    var cols = _encarrecColumnes(sheet);

    // Si ja té ID no reestampem: evita perdre l'estat si el trigger es repeteix.
    var idActual = String(sheet.getRange(fila, cols.id).getValue() || '').trim();
    if (idActual !== '') {
      Logger.log('estampaEncarrecNou: fila ' + fila + ' ja té ID (' + idActual + '), no es toca.');
      return;
    }

    var id = _encarrecGeneraId(new Date(), _encarrecIdsExistents(sheet, cols.id));
    sheet.getRange(fila, cols.id).setValue(id);
    sheet.getRange(fila, cols.estat).setValue(ENCARREC_ESTAT_INICIAL);
    sheet.getRange(fila, cols.dataCanvi).setValue(new Date());
    sheet.getRange(fila, cols.gestionat).setValue('');
    SpreadsheetApp.flush();
    Logger.log('estampaEncarrecNou: fila ' + fila + ' → ' + id + ' (' + ENCARREC_ESTAT_INICIAL + ').');
  } catch (err) {
    Logger.log('estampaEncarrecNou error a la fila ' + fila + ': ' + err.message);
  } finally {
    lock.releaseLock();
  }
}

// Columnes localitzades SEMPRE pel nom de capçalera, mai per posició: Google
// reorganitza les columnes del full de respostes quan s'edita el formulari.
function _encarrecColumnes(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cols = {
    id:        headers.indexOf('ID_Encarrec') + 1,
    estat:     headers.indexOf('Estat') + 1,
    dataCanvi: headers.indexOf('Data_Canvi_Estat') + 1,
    gestionat: headers.indexOf('Gestionat_Per') + 1,
  };

  var falten = [];
  if (cols.id === 0)        falten.push('ID_Encarrec');
  if (cols.estat === 0)     falten.push('Estat');
  if (cols.dataCanvi === 0) falten.push('Data_Canvi_Estat');
  if (cols.gestionat === 0) falten.push('Gestionat_Per');
  if (falten.length > 0) {
    throw new Error('Columnes no trobades a ' + ENCARREC_FULL + ': ' + falten.join(', '));
  }
  return cols;
}

function _encarrecIdsExistents(sheet, colId) {
  var ultima = sheet.getLastRow();
  if (ultima < 2) return [];
  return sheet.getRange(2, colId, ultima - 1, 1).getValues()
    .map(function (fila) { return String(fila[0] || '').trim(); })
    .filter(function (v) { return v !== ''; });
}

// ENC-YYYYMMDD-HHMMSS. Dos enviaments dins el mateix segon donarien el mateix
// identificador: hi afegim sufix -2, -3... fins que sigui únic. L'esquema antic
// ('ENC-' + getLastRow) es reutilitzava en esborrar files i es duplicava sense lock.
function _encarrecGeneraId(quan, idsExistents) {
  var base = 'ENC-' + Utilities.formatDate(quan, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  if (idsExistents.indexOf(base) === -1) return base;
  var n = 2;
  while (idsExistents.indexOf(base + '-' + n) !== -1) n++;
  return base + '-' + n;
}

// ===== AVÍS (trigger de FORMULARI) =====
// NO escriu cap fila: la garanteix Google. Només avisa els admins amb tot el detall.
// Com a processarIncidencia, no coneix l'ID_Encarrec (el posa l'altre trigger, en
// paral·lel): l'avís identifica l'encàrrec pel títol i el docent, no per l'ID.
function processarEncarrec(e) {
  if (!e || !e.response) {
    Logger.log('processarEncarrec: sense e.response, no faig res.');
    return;
  }

  try {
    var parells = [];
    var r = {};
    e.response.getItemResponses().forEach(function (ir) {
      var titol = ir.getItem().getTitle();
      var resp  = ir.getResponse();
      var text  = Array.isArray(resp) ? resp.join('; ') : String(resp === null ? '' : resp);
      r[titol] = text;
      if (text.trim() !== '') parells.push('• ' + titol + '\n  ' + text);
    });

    var correu = e.response.getRespondentEmail() || '(no capturat)';
    _encarrecAvisaAdmins(
      r['Nom del docent sol·licitant'] || '(sense nom)',
      correu,
      r['Títol curt de l\'encàrrec'] || '(sense títol)',
      parells.join('\n\n')
    );
  } catch (err) {
    Logger.log('processarEncarrec error: ' + err.message);
  }
}

// ===== FASE 2: VISTA DE GESTIÓ =====
// Els endpoints viuen aquí i no a Code.js (on són els d'incidències) perquè les
// constants i els helpers d'encàrrecs ja hi són: separar-los deixaria _encarrecColumnes
// en un fitxer i getEncarrecs en un altre. routeAction, en canvi, és a Code.js.
// NOTA: fem servir _incidenciaValorText (Code.js), que és GENÈRIC malgrat el nom
// (Date → ISO, la resta → text). Reanomenar-lo a _valorText és feina de la FASE 4:
// avui tocaria codi d'incidències que funciona, per pura cosmètica.

// Índex de columna per a cada clau d'ENCARREC_CAMPS_LLISTA, localitzat pel NOM de
// capçalera (mai per posició: Google reorganitza les columnes en editar el formulari).
function _encarrecIndexCamps(headers) {
  var idx    = {};
  var falten = [];
  ENCARREC_CAMPS_LLISTA.forEach(function (c) {
    var i = headers.indexOf(c.capcalera);
    if (i === -1) falten.push(c.capcalera);
    idx[c.clau] = i;
  });
  if (falten.length > 0) {
    throw new Error('Capçaleres no trobades a ' + ENCARREC_FULL + ': ' + falten.join(', '));
  }
  return idx;
}

// Llista per a la vista admin. Per defecte, només els que NO estan tancats.
// body.estat opcional: qualsevol d'ENCARREC_ESTATS | 'totes'.
// Les files sense Estat (trigger fallat) SURTEN a la llista per defecte: amagar-les
// taparia una fallada silenciosa de l'estampat. Mateix criteri que a getIncidencies.
function getEncarrecs(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var filtre = String((body && body.estat) || '').trim();
  if (filtre !== '' && filtre !== 'totes' && ENCARREC_ESTATS.indexOf(filtre) === -1) {
    return errorResponse('Filtre d\'estat no vàlid: "' + filtre + '". Valors admesos: ' +
                         ENCARREC_ESTATS.join(', ') + ', totes', 400);
  }

  var sheet  = getSheet(ENCARREC_FULL);
  var valors = sheet.getDataRange().getValues();
  if (valors.length < 2) return jsonResponse([]);

  var idx;
  try {
    idx = _encarrecIndexCamps(valors[0]);
  } catch (err) {
    return errorResponse(err.message, 500);
  }

  var llista = [];
  for (var f = 1; f < valors.length; f++) {
    var fila  = valors[f];
    var estat = String(fila[idx.estat] || '').trim();

    if (filtre === '') {
      if (ENCARREC_TANCATS.indexOf(estat) !== -1) continue;
    } else if (filtre !== 'totes' && estat !== filtre) {
      continue;
    }

    var item = {};
    ENCARREC_CAMPS_LLISTA.forEach(function (c) {
      item[c.clau] = _incidenciaValorText(fila[idx[c.clau]]);
    });
    llista.push(item);
  }

  // Més recents primer.
  llista.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
  return jsonResponse(llista);
}

// Detall complet d'UN encàrrec: parells pregunta→resposta de tota la fila.
// Aparellem la fila crua amb la fila 1 crua PER ÍNDEX, no per capçalera, i NO fem
// servir sheetToObjects. AVUI el formulari d'encàrrecs no té títols duplicats (a
// diferència del d'incidències, on la pregunta àncora es repeteix a cada secció de
// màquina), o sigui que indexar per nom funcionaria. Ho fem igual perquè costa el
// mateix i perquè el dia que algú afegeixi una pregunta amb un títol que ja existeix,
// sheetToObjects en perdria una EN SILENCI. Aquesta garantia no ha de dependre de que
// ningú no toqui el formulari.
function getEncarrec(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var id = String((body && body.encarrec_id) || '').trim();
  if (!id) return errorResponse('Falta encarrec_id', 400);

  var sheet  = getSheet(ENCARREC_FULL);
  var valors = sheet.getDataRange().getValues();
  if (valors.length < 2) return errorResponse('Encàrrec no trobat: ' + id, 404);

  var headers = valors[0];
  var colId   = headers.indexOf('ID_Encarrec');
  if (colId === -1) {
    return errorResponse('Capçalera no trobada a ' + ENCARREC_FULL + ': ID_Encarrec', 500);
  }

  for (var f = 1; f < valors.length; f++) {
    if (String(valors[f][colId] || '').trim() !== id) continue;

    var fila  = valors[f];
    var camps = [];
    for (var c = 0; c < headers.length; c++) {
      var pregunta = String(headers[c] || '').trim();
      var resposta = _incidenciaValorText(fila[c]);
      if (pregunta === '' || resposta === '') continue;
      camps.push({ pregunta: pregunta, resposta: resposta });
    }

    // Bloc d'EQUIP per al prefill del formulari d'edició (@60): els 7 camps SEMPRE,
    // buits inclosos (a `camps` es salten les respostes buides, però el formulari els
    // necessita tots). Localitzat per nom: 500 sorollós si en falta cap.
    // Les 2 columnes de DATA es serialitzen amb _encarrecValorData (zona de l'script,
    // 'yyyy-MM-dd'), NO amb toISOString: una data real de mitjanit a Madrid en UTC
    // cauria al dia anterior i el prefill mostraria el dia equivocat.
    var gestio = {};
    try {
      var colsEquip = _colsPerNom(sheet, ENCARREC_COLS_EQUIP);
      ENCARREC_COLS_EQUIP.forEach(function (n) {
        var raw = fila[colsEquip[n] - 1];
        gestio[n] = ENCARREC_COLS_EQUIP_DATA.indexOf(n) !== -1
          ? _encarrecValorData(raw)
          : _incidenciaValorText(raw);
      });
    } catch (err) {
      return errorResponse(err.message, 500);
    }

    return jsonResponse({ id: id, camps: camps, gestio: gestio });
  }

  return errorResponse('Encàrrec no trobat: ' + id, 404);
}

// Serialitza un valor de columna de DATA d'equip per al prefill, SEGUR davant la zona
// horària. _incidenciaValorText fa toISOString() (UTC) i desplaçaria una data de
// mitjanit a Madrid al dia anterior. El text 'YYYY-MM-DD' ja desat passa tal qual.
function _encarrecValorData(v) {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? '' :
      Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return _incidenciaValorText(v);
}

// Canvi d'estat del cicle de vida de l'encàrrec.
// LOCK: updateEstatIncidencia NO en té i dos admins alhora hi perdrien un canvi
// (l'últim guanya, sense avís). Aquí sí. La divergència és deliberada; posar-l'hi
// també a incidències és candidat de la FASE 4.
function updateEstatEncarrec(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var nouEstat = String((body && body.estat) || '').trim();
  if (ENCARREC_ESTATS.indexOf(nouEstat) === -1) {
    return errorResponse('Estat no vàlid: "' + nouEstat + '". Valors admesos: ' +
                         ENCARREC_ESTATS.join(', '), 400);
  }

  var id = String((body && body.encarrec_id) || '').trim();
  if (!id) return errorResponse('Falta encarrec_id', 400);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return errorResponse('El sistema està ocupat, torna-ho a provar en uns segons.', 503);
  }

  try {
    var sheet = getSheet(ENCARREC_FULL);
    var cols;
    try {
      cols = _encarrecColumnes(sheet);
    } catch (err) {
      return errorResponse(err.message, 500);
    }

    // Localitzem la fila per ID sobre valors crus, MAI per número de fila i sense
    // sheetToObjects (veure el comentari de getEncarrec).
    var valors = sheet.getDataRange().getValues();
    for (var f = 1; f < valors.length; f++) {
      if (String(valors[f][cols.id - 1] || '').trim() !== id) continue;

      var fila = f + 1; // getValues és 0-indexat; els rangs del full, 1-indexats
      sheet.getRange(fila, cols.estat).setValue(nouEstat);
      sheet.getRange(fila, cols.dataCanvi).setValue(new Date());
      sheet.getRange(fila, cols.gestionat).setValue(usuari.email);
      SpreadsheetApp.flush();
      return jsonResponse({ updated: true, encarrec_id: id, estat: nouEstat });
    }

    return errorResponse('Encàrrec no trobat: ' + id, 404);
  } finally {
    lock.releaseLock();
  }
}

// Edició de les 7 columnes d'EQUIP des de la vista de gestió (@60). NOMÉS ADMIN,
// validat AL SERVIDOR. El principi del projecte: "el full és per llegir i reparar;
// per gestionar, l'app". La gestió d'encàrrecs n'era l'única excepció gran; això la
// tanca.
//
// ESCRIPTURA PER NOM DE CAPÇALERA (_actualitzaFilaPerNom → _colsPerNom), MAI per
// posició: les capçaleres porten espais i barres ('Padrí/padrina FAIG', 'Espai i
// reserva') i un desplaçament silenciós ompliria columnes equivocades per sempre.
// Si en falta cap, 500 sorollós amb la llista.
//
// LLISTA BLANCA DURA: qualsevol clau de body.camps fora d'ENCARREC_COLS_EQUIP → 400.
// Així les 15 del formulari, les 4 del sistema (ID_Encarrec, Estat, Data_Canvi_Estat,
// Gestionat_Per) i les 2 de traça queden fora encara que el client n'enviï de més.
//
// TRAÇA (decisió b): en cada desament CORRECTE s'escriuen Editat_Per (correu de
// l'admin autenticat, del token — no del client) i Data_Edicio (marca de temps, text
// pla). Un intent fallit (400/403/404/500) NO les toca: s'escriuen dins el bloc
// d'èxit, sota lock, un cop localitzada la fila i validat tot.
//
// LAST-WRITE-WINS acceptat i registrat: el lock serialitza (cap fila a mitges) però
// NO hi ha control optimista de concurrència. Dos admins sobre el MATEIX encàrrec:
// l'últim que desa sobreescriu els camps de l'altre en bloc. Amb equip de 8 i
// col·lisions improbables, assumit; la traça (b) hi actua com a control compensatori
// (queda escrit qui ha estat l'últim a tocar-lo i quan).
function updateEncarrecGestio(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var id = String((body && body.encarrec_id) || '').trim();
  if (!id) return errorResponse('Falta encarrec_id', 400);

  var camps = (body && body.camps) || {};
  if (typeof camps !== 'object' || Array.isArray(camps)) {
    return errorResponse('camps ha de ser un objecte {capçalera: valor}', 400);
  }

  var claus = Object.keys(camps);
  var noPermeses = claus.filter(function (k) { return ENCARREC_COLS_EQUIP.indexOf(k) === -1; });
  if (noPermeses.length > 0) {
    return errorResponse('Columna no editable: ' + noPermeses.join(', ') +
                         '. Només es poden editar: ' + ENCARREC_COLS_EQUIP.join(', '), 400);
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return errorResponse('El sistema està ocupat, torna-ho a provar en uns segons.', 503);
  }

  try {
    var sheet = getSheet(ENCARREC_FULL);

    var colId;
    try {
      colId = _colsPerNom(sheet, ['ID_Encarrec'])['ID_Encarrec'];
    } catch (err) {
      return errorResponse(err.message, 500);
    }

    // Localitzem la fila per ID sobre valors crus, MAI per número de fila.
    var valors = sheet.getDataRange().getValues();
    for (var f = 1; f < valors.length; f++) {
      if (String(valors[f][colId - 1] || '').trim() !== id) continue;

      var fila = f + 1; // getValues és 0-indexat; els rangs del full, 1-indexats

      // Camps rebuts (normalitzats a text) + la traça, sempre.
      var aEscriure = {};
      claus.forEach(function (k) {
        aEscriure[k] = String(camps[k] === null || camps[k] === undefined ? '' : camps[k]);
      });
      aEscriure[ENCARREC_COL_EDITAT_PER]  = usuari.email;
      aEscriure[ENCARREC_COL_DATA_EDICIO] = Utilities.formatDate(
        new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      // Text pla: les dues dates d'equip i la marca de temps de traça.
      var colsText = ENCARREC_COLS_EQUIP_DATA.concat([ENCARREC_COL_DATA_EDICIO]);

      try {
        _actualitzaFilaPerNom(sheet, fila, aEscriure, colsText);
      } catch (err) {
        return errorResponse(err.message, 500);
      }
      return jsonResponse({ updated: true, encarrec_id: id });
    }

    return errorResponse('Encàrrec no trobat: ' + id, 404);
  } finally {
    lock.releaseLock();
  }
}

function _encarrecAvisaAdmins(nom, email, titol, detall) {
  var admins = getAdminEmails();
  if (admins.length === 0) {
    Logger.log('_encarrecAvisaAdmins: cap admin a Usuaris_autoritzats, no envio res.');
    return;
  }

  var cos = 'Encàrrec nou als espais maker, de ' + nom + ' (' + email + ').\n\n' +
            'Títol: ' + titol + '\n\n' +
            detall + '\n\n' +
            'Estat inicial: ' + ENCARREC_ESTAT_INICIAL + '. Queda registrat a la pestanya "' +
            ENCARREC_FULL + '" del full mestre.';

  MailApp.sendEmail({
    to: admins[0],
    cc: admins.slice(1).join(','),
    subject: 'FAIG Lab — Encàrrec nou: ' + titol,
    body: cos,
  });
}

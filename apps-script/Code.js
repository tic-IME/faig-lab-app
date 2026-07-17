// ═══════════════════════════════════════════════════════════════════════
// INSTANTÀNIA — AIXÒ NO ÉS LA FONT DE VERITAT.
//
// Generada:  2026-07-17
// Versió del web app desplegada en aquell moment:  @57
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
// ═══════════════════════════════════════════════════════════════════════
// ============================================================
// FAIG Lab — Google Apps Script Backend
// Institut Maria Espinalt
// ============================================================

const ALLOWED_ORIGIN = '*';

// Únics valors admesos a la columna Estat d'Incidències_Respostes. Han de coincidir
// EXACTAMENT amb la validació de dades del full (desplegable de tres valors).
const INCIDENCIA_ESTATS = ['Oberta', 'En curs', 'Resolta'];

// Subconjunt de camps que viatgen a la llista de l'app: capçalera del full → clau de
// sortida. Les ~70 columnes del formulari NO viatgen aquí; el detall complet d'una
// incidència es demana d'una a una (Tram D2). Capçaleres verificades el 16/07/2026.
const INCIDENCIA_CAMPS_LLISTA = [
  { capcalera: 'Marca de temps',                           clau: 'data' },
  { capcalera: 'Màquina afectada',                         clau: 'maquina_id' },
  { capcalera: 'La màquina es pot continuar fent servir?', clau: 'us' },
  { capcalera: 'Nom i cognom (docent responsable)',        clau: 'docent' },
  { capcalera: 'ID_Incidencia',                            clau: 'id' },
  { capcalera: 'Estat',                                    clau: 'estat' },
  { capcalera: 'Data_Canvi_Estat',                         clau: 'data_canvi' },
  { capcalera: 'Gestionada_Per',                           clau: 'gestionada_per' },
];

function getSheetId() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, statusCode) {
  var code = statusCode || 200;
  var payload = JSON.stringify({ status: code, data: data });
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, statusCode) {
  var code = statusCode || 400;
  var payload = JSON.stringify({ status: code, error: message });
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var params = e.parameter || {};
  var action = params.action;
  var token  = params.token;

  if (!action) {
    return jsonResponse({ pong: true, timestamp: new Date().toISOString() });
  }

  if (action === 'approve' && token) {
    return handleTokenAction(token, 'aprovada');
  }

  if (action === 'deny' && token) {
    return handleTokenAction(token, 'denegada');
  }

  return errorResponse('Acció no reconeguda', 400);
}

function handleTokenAction(token, nouEstat) {
  try {
    var sheet  = getSheet('Reserves');
    var data   = sheetToObjects(sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var tokenCol = headers.indexOf('Token_Permis') + 1;
    var estatCol = headers.indexOf('Estat_Reserva') + 1;

    if (tokenCol === 0 || estatCol === 0) {
      return errorResponse('Columnes no trobades', 500);
    }

    for (var i = 0; i < data.length; i++) {
      if (data[i]['Token_Permis'] === token) {
        var rowIndex = i + 2;
        sheet.getRange(rowIndex, estatCol).setValue(nouEstat);

        var reserva = data[i];
        var missatge = nouEstat === 'aprovada'
          ? 'La teva reserva ha estat APROVADA.'
          : 'La teva reserva ha estat DENEGADA.';

        if (reserva['Usuari']) {
          MailApp.sendEmail({
            to: reserva['Usuari'],
            subject: 'FAIG Lab — Reserva ' + nouEstat + ' (' + reserva['ID_Reserva'] + ')',
            body: missatge + '\n\nMàquina: ' + reserva['ID_Maquina'] +
                  '\nData: ' + reserva['Data_Reserva'] +
                  '\nHora: ' + reserva['Hora_Inici'] + ' - ' + reserva['Hora_Final'],
          });
        }

        return ContentService.createTextOutput(
          '<html><body><h2>Reserva ' + nouEstat + '</h2><p>' + missatge + '</p></body></html>'
        ).setMimeType(ContentService.MimeType.HTML);
      }
    }

    return errorResponse('Token no trobat', 404);
  } catch (err) {
    return errorResponse('Error: ' + err.message, 500);
  }
}

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    var token  = body.token;

    if (!token) return errorResponse('Token requerit', 401);

    var usuari = validateToken(token);
    if (!usuari) return errorResponse('Token invàlid o usuari no autoritzat', 403);

    return routeAction(action, body, usuari);
  } catch (err) {
    return errorResponse('Error intern: ' + err.message, 500);
  }
}

function validateToken(accessToken) {
  try {
    var url      = 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + accessToken;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var info     = JSON.parse(response.getContentText());

    if (!info.email) return null;
    var email = info.email.toString().trim().toLowerCase();

    var sheet = getSheet('Usuaris_autoritzats');
    var data  = sheetToObjects(sheet);
    for (var i = 0; i < data.length; i++) {
      var u = data[i];
      if (u['Email_Usuari'].toString().trim().toLowerCase() === email &&
          u['Nivell_Permis'].toString().trim().toUpperCase() === 'ADMIN') {
        return {
          email:    u['Email_Usuari'],
          nom:      u['Nom_Usuari'],
          nivell:   'ADMIN',
          rowIndex: i + 2,
        };
      }
    }

    if (email.endsWith('@el-teu-domini.cat')) {
      var nom = email.split('@')[0];
      return {
        email:    info.email,
        nom:      nom,
        nivell:   'USUARI',
        rowIndex: null,
      };
    }

    return null;

  } catch (err) {
    Logger.log('validateToken error: ' + err.message);
    return null;
  }
}

function routeAction(action, body, usuari) {
  switch (action) {
    case 'getMe':                return getMe(usuari);
    case 'getMaquines':          return getMaquines();
    case 'updateEstatMaquina':   return updateEstatMaquina(body, usuari);
    case 'getHorariSetmana':     return getHorariSetmana(body);
    case 'getReserves':          return getReserves(body);
    case 'createReserva':        return createReserva(body, usuari);
    case 'createReserves':       return createReserves(body, usuari);
    case 'cancelReserva':        return cancelReserva(body, usuari);
    case 'getIncidencies':       return getIncidencies(body, usuari);
    case 'getIncidencia':        return getIncidencia(body, usuari);
    case 'updateEstatIncidencia':return updateEstatIncidencia(body, usuari);
    case 'resolReservesSuspeses':return resolReservesSuspeses(body, usuari);
    case 'getEncarrecs':         return getEncarrecs(body, usuari);
    case 'getEncarrec':          return getEncarrec(body, usuari);
    case 'updateEstatEncarrec':  return updateEstatEncarrec(body, usuari);
    case 'getInventari':         return getInventari();
    case 'registreConsum':       return registreConsum(body, usuari);
    case 'updateMaterial':       return updateMaterial(body, usuari);
    case 'createMaterial':       return createMaterial(body, usuari);
    case 'getUsuaris':           return getUsuaris(usuari);
    case 'createUsuari':         return createUsuari(body, usuari);
    case 'updateUsuari':         return updateUsuari(body, usuari);
    case 'deleteUsuari':         return deleteUsuari(body, usuari);
    case 'getDashboard':         return getDashboard(usuari);
    case 'getProtocol':          return getProtocol(body);
    case 'registreChecklist':    return registreChecklist(body, usuari);
    default: return errorResponse('Acció desconeguda: ' + action, 400);
  }
}

function getMe(usuari) {
  return jsonResponse(usuari);
}

function getMaquines() {
  var data = sheetToObjects(getSheet('Control_Màquines'));
  return jsonResponse(data);
}

function updateEstatMaquina(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet    = getSheet('Control_Màquines');
  var data     = sheetToObjects(sheet);
  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var estatCol = headers.indexOf('Estat_Actual') + 1;

  for (var i = 0; i < data.length; i++) {
    if (data[i]['ID_Maquina'] === body.maquina_id) {
      sheet.getRange(i + 2, estatCol).setValue(body.nou_estat);
      return jsonResponse({ updated: true });
    }
  }
  return errorResponse('Màquina no trobada', 404);
}

// Hora d'Horari_Tallers → 'HH:MM'. ATENCIÓ ALS DOS MÓNS DE FORMATS (font d'error
// nº1 del projecte): Hora_Inici/Hora_Final de Reserves són TEXT 'HH:MM' amb
// capçalera en MAJÚSCULA; Hora_inici/Hora_final d'Horari_Tallers són VALORS
// D'HORA reals amb capçalera en MINÚSCULA. Mai creuar-los sense normalitzar.
//
// L'expressió anterior barrejava getHours() (local) amb getUTCMinutes() (UTC).
// A Madrid no feia mal —el desplaçament és d'hores senceres i no altera els
// minuts—, però les cel·les d'hora es desen a l'època 1899, quan Madrid anava a
// hora local mitjana (uns 15 min, no un desplaçament sencer): allà els minuts sí
// que poden divergir. formatDate elimina la classe de dubte sencera.
function _horariHora(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Madrid', 'HH:mm');
  return excelTimeToHHMM(v);
}

// Graella d'Horari_Tallers. ATENCIÓ: NO és una llista de classes, és una GRAELLA
// EXHAUSTIVA de franges de 30 min (8:00-16:00, dilluns-divendres, els dos
// tallers). Les franges SENSE classe tenen Assignatura_Grup/Professor_titular/
// Correu_Titular BUITS. La condició "hi ha classe" és Assignatura_Grup NO BUIT;
// qui filtri per solapament sense comprovar-ho tindrà classe a totes hores.
// Una classe real són diverses files contigües de 30 min (ex.: ET2n1Tecno
// dilluns = 13:00 + 13:30 + 14:00): qui la mostri ha de fusionar-les.
//
// Capçaleres reals (verificades per captura el 19/07/2026), per ordre:
// ID_Horari · Dia de la setmana (numèric, 2=dilluns...6=divendres) · Dia_Nom ·
// Hora_inici · Hora_final · Assignatura_Grup · Professor_titular · Ubicació ·
// Correu_Titular · Estat_Permís.
// 'Dia de la setmana' no s'exposa (Dia_Nom ja hi és) i Estat_Permís tampoc: és
// del circuit mort d'aprovacions. Es llegeix SEMPRE per nom de capçalera.
function getHorariSetmana(body) {
  var taller = body.taller || '';
  var data   = sheetToObjects(getSheet('Horari_Tallers'));

  var filtrat = data.filter(function(fila) {
    return !taller || fila['Ubicació'] === taller;
  });

  filtrat = filtrat.map(function(fila) {
    return {
      ID_Horari:         fila['ID_Horari'],
      Dia_Nom:           fila['Dia_Nom'],
      Hora_inici:        _horariHora(fila['Hora_inici']),
      Hora_final:        _horariHora(fila['Hora_final']),
      Assignatura_Grup:  fila['Assignatura_Grup'],
      Professor_titular: fila['Professor_titular'],
      Ubicació:          fila['Ubicació'],
      Correu_Titular:    fila['Correu_Titular'],
    };
  });

  return jsonResponse(filtrat);
}

// ── Helpers de format per a reserves ─────────────────────────
// IMPORTANT: les hores del full ('13:00') ja són hora local de Madrid.
// NO les tornem a convertir de zona horària; només les netegem a 'HH:MM'.
//
// REGLA DURA (Capa 1, 16/07/2026): les columnes Hora_Inici/Hora_Final de Reserves
// tenen format TEXT PLA al full (verificat per l'Anna). Aquesta és l'ÚNICA protecció
// contra el bug de desplaçament de l'època 1899: el codi hi escriu la cadena 'HH:MM'
// tal qual i no la converteix mai. Per això TOTA escriptura de reserves passa per
// _reservaEscriu: cap cridador fa appendRow ni setValues pel seu compte.
function _reservaData(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Madrid', 'yyyy-MM-dd');
  var s = String(v);
  if (s.indexOf('T') !== -1) return s.slice(0, 10);

  // Tolerància per a files on Data_Reserva va quedar desada com a DATA REAL en
  // lloc de text: getDisplayValues() les retorna 'dd/mm/aaaa' i la comparació de
  // solapaments (que és per CADENES) no casaria mai amb la nostra 'aaaa-mm-dd',
  // deixant la franja reservable dues vegades sense avís. Passa amb les files
  // anteriors a la correcció del format i amb qualsevol edició manual al full.
  // L'ordre dia/mes surt del locale del full, que és europeu: la fila observada
  // el 17/07/2026 es mostrava '17/07/2026' i 17 no pot ser cap mes.
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];

  return s;
}
function _reservaHora(v) {
  if (v instanceof Date) {
    return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  }
  var m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : String(v);
}

function getReserves(body) {
  var data = sheetToObjectsDisplay(getSheet('Reserves'));

  var filtrat = data.filter(function(r) {
    var okMaquina = !body.maquina_id || r['ID_Maquina'] === body.maquina_id;
    var okData    = !body.data       || _reservaData(r['Data_Reserva']) === body.data;
    return okMaquina && okData;
  });

  filtrat = filtrat.map(function(r) {
    r['Data_Reserva'] = _reservaData(r['Data_Reserva']);
    r['Hora_Inici']   = _reservaHora(r['Hora_Inici']);
    r['Hora_Final']   = _reservaHora(r['Hora_Final']);
    return r;
  });

  return jsonResponse(filtrat);
}

// ===== RESERVES: peces compartides (individual + lot) =====
// Capa 1 (16/07/2026). La individual i la múltiple comparteixen validació i
// escriptura: qualsevol divergència entre les dues seria un bug silenciós.

// Sostre d'un lot. Avui hi ha 12 màquines (Capa 1 no en pot demanar més), però
// l'endpoint accepta llistes d'horaris genèriques i la Capa 2 (sèries setmanals)
// hi cabrà sense tocar això.
var RESERVA_MAX_LOT = 30;

// Estats que NO ocupen la franja: una reserva cancel·lada o suspesa no bloqueja.
var RESERVA_ESTATS_INACTIUS = ['denegada', 'cancel·lada', 'suspesa'];

// Normalitza un item cru del body a la forma interna. Tot cadenes netes.
function _reservaItem(raw, grupPerDefecte) {
  raw = raw || {};
  return {
    maquina_id:    String(raw.maquina_id || '').trim(),
    data:          String(raw.data || '').trim(),
    hora_inici:    String(raw.hora_inici || '').trim(),
    hora_fi:       String(raw.hora_fi || '').trim(),
    grup_projecte: String(raw.grup_projecte || grupPerDefecte || ''),
  };
}

// Forma de les dades. Les hores han d'arribar ja com a 'HH:MM' amb zero al davant:
// timesOverlap compara cadenes lexicogràficament i '9:00' trencaria la comparació.
function _reservaValidaItem(item) {
  if (!item.maquina_id) return 'falta l\'identificador de màquina';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.data)) {
    return 'data no vàlida ("' + item.data + '"), format esperat AAAA-MM-DD';
  }
  if (!/^\d{2}:\d{2}$/.test(item.hora_inici) || !/^\d{2}:\d{2}$/.test(item.hora_fi)) {
    return 'hores no vàlides ("' + item.hora_inici + '"–"' + item.hora_fi + '"), format esperat HH:MM';
  }
  if (item.hora_inici >= item.hora_fi) return 'l\'hora de fi ha de ser posterior a la d\'inici';
  return null;
}

// Franges ja ocupades, en la mateixa forma que un item. UNA lectura de la pestanya.
function _reservesOcupades(sheet) {
  return sheetToObjectsDisplay(sheet)
    .filter(function (r) {
      return RESERVA_ESTATS_INACTIUS.indexOf(r['Estat_Reserva']) === -1;
    })
    .map(function (r) {
      return {
        maquina_id: r['ID_Maquina'],
        data:       _reservaData(r['Data_Reserva']),
        hora_inici: _reservaHora(r['Hora_Inici']),
        hora_fi:    _reservaHora(r['Hora_Final']),
      };
    });
}

// ID_Maquina → Estat_Actual. UNA lectura de Control_Màquines.
function _maquinesEstat() {
  var mapa = {};
  sheetToObjects(getSheet('Control_Màquines')).forEach(function (m) {
    mapa[String(m['ID_Maquina'] || '').trim()] = String(m['Estat_Actual'] || '').trim();
  });
  return mapa;
}

// Mateix criteri que el desplegable del frontend (reserves.js): coincidència
// laxa per 'operativa'. 'Revisió pendent' i 'Standby - No disponible' NO passen.
function _reservaEsOperativa(estat) {
  return String(estat || '').toLowerCase().indexOf('operativa') !== -1;
}

function _reservaSolapament(ocupades, item) {
  for (var i = 0; i < ocupades.length; i++) {
    var o = ocupades[i];
    if (o.maquina_id !== item.maquina_id) continue;
    if (o.data !== item.data) continue;
    if (timesOverlap(o.hora_inici, o.hora_fi, item.hora_inici, item.hora_fi)) return o;
  }
  return null;
}

// Motiu de rebuig en text pla per a l'usuari, o null si l'item és reservable.
// Compartit per la individual i la múltiple: un sol lloc on canviar les regles.
function _reservaMotiuRebuig(item, ocupades, estats) {
  var motiu = _reservaValidaItem(item);
  if (motiu) return motiu;

  if (!estats.hasOwnProperty(item.maquina_id)) return 'no consta a Control_Màquines';
  if (!_reservaEsOperativa(estats[item.maquina_id])) {
    return 'no operativa (' + (estats[item.maquina_id] || 'sense estat') + ')';
  }

  var xoc = _reservaSolapament(ocupades, item);
  if (xoc) {
    return 'ocupada el ' + xoc.data + ' de ' + xoc.hora_inici + ' a ' + xoc.hora_fi;
  }
  return null;
}

// IDs únics dins el lot. Manté el format històric 'RES-<ms>': N reserves creades
// dins el mateix mil·lisegon compartirien identificador si cridéssim getTime() N
// vegades, així que desplacem el contador. El lock serialitza les execucions, de
// manera que la finestra de N ms no pot xocar amb un altre usuari.
function _reservaGeneraIds(n) {
  var base = new Date().getTime();
  var ids  = [];
  for (var i = 0; i < n; i++) ids.push('RES-' + (base + i));
  return ids;
}

// Fila de 10 columnes POSICIONALS de Reserves. L'ordre és el del full.
function _reservaFila(usuari, item, idReserva) {
  return [
    idReserva,             // ID_Reserva
    usuari.email,          // Usuari
    item.maquina_id,       // ID_Maquina
    item.data,             // Data_Reserva
    item.hora_inici,       // Hora_Inici  (TEXT PLA: cadena 'HH:MM' tal qual)
    item.hora_fi,          // Hora_Final  (TEXT PLA: cadena 'HH:MM' tal qual)
    usuari.nom,            // Docent_Responsable
    item.grup_projecte,    // Grup/Projecte
    'confirmada',          // Estat_Reserva
    '',                    // He parlat amb el profe?
  ];
}

// ÚNIC punt d'escriptura de reserves de tot el projecte. Una sola crida a
// setValues per lot: minimitza la finestra d'una fallada parcial (no hi ha
// rollback possible a Apps Script; decisió assumida amb la política
// parcial-amb-avís).
function _reservaEscriu(sheet, files) {
  if (!files || files.length === 0) return;
  var primeraFila = sheet.getLastRow() + 1;

  // appendRow eixamplava la graella tot sol; setValues NO: si el lot depassa les
  // files existents del full, peta. Les afegim abans d'escriure.
  var ultima = primeraFila + files.length - 1;
  if (ultima > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), ultima - sheet.getMaxRows());
  }

  var rang = sheet.getRange(primeraFila, 1, files.length, files[0].length);

  // TEXT PLA FORÇAT DES DEL CODI, no confiat al format del full.
  // Hora_Inici/Hora_Final tenen format text a la columna, però Data_Reserva NO:
  // Sheets parsejava la cadena '2026-07-17', la desava com a data real i la
  // mostrava '17/07/2026'. Això trencava dues coses alhora: el calendari (rebia
  // una data no ISO i descartava l'esdeveniment) i, molt pitjor, la detecció de
  // solapaments, que compara dates com a CADENES — la fila divergent no casava
  // amb res i quedava reservable dues vegades.
  // Les 10 columnes són textuals, així que forcem '@' a tot el rang: la garantia
  // passa a ser del codi i deixa de dependre de com estigui formatat el full.
  rang.setNumberFormat('@');
  rang.setValues(files);
  SpreadsheetApp.flush();
}

// NOTA: gating de permisos (làser/3D) desactivat. El full Usuaris_autoritzats
// no conté dades d'autorització per màquina, així que totes les reserves es
// confirmen directament. Si es vol un circuit d'aprovació, cal dissenyar-lo a part.
function createReserva(body, usuari) {
  var item = _reservaItem(body, body.grup_projecte);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return errorResponse('El sistema està ocupat desant una altra reserva. Torna-ho a provar en uns segons.', 503);
  }

  try {
    var sheet = getSheet('Reserves');
    var motiu = _reservaMotiuRebuig(item, _reservesOcupades(sheet), _maquinesEstat());
    if (motiu) {
      return errorResponse('No s\'ha pogut reservar ' + (item.maquina_id || '(sense màquina)') + ': ' + motiu, 409);
    }

    var ids = _reservaGeneraIds(1);
    _reservaEscriu(sheet, [_reservaFila(usuari, item, ids[0])]);
    return jsonResponse({ id: ids[0], estat: 'confirmada', token: null });
  } finally {
    lock.releaseLock();
  }
}

// Lot de reserves. Endpoint GENÈRIC: rep una llista d'items {maquina_id, data,
// hora_inici, hora_fi} i no assumeix res sobre què tenen en comú.
//   Capa 1 (avui):  N màquines, mateixa franja.
//   Capa 2 (futur): 1 màquina, N franges — hi cap sense tocar el backend.
// Política PARCIAL AMB AVÍS: es reserven les disponibles i les altres tornen a
//'rebutjades' amb el motiu. Zero disponibles → cap escriptura, 200 amb la llista
// buida a 'creades' (no és un error: l'usuari ha de veure per què).
function createReserves(body, usuari) {
  var items = (body && body.items) || [];
  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('Cal una llista "items" amb almenys una reserva', 400);
  }
  if (items.length > RESERVA_MAX_LOT) {
    return errorResponse('Massa reserves en un sol lot (' + items.length + '). Màxim: ' + RESERVA_MAX_LOT, 400);
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return errorResponse('El sistema està ocupat desant una altra reserva. Torna-ho a provar en uns segons.', 503);
  }

  try {
    var sheet    = getSheet('Reserves');
    var ocupades = _reservesOcupades(sheet);  // UNA lectura per a tot el lot
    var estats   = _maquinesEstat();          // UNA lectura per a tot el lot

    var acceptades = [];
    var rebutjades = [];

    items.forEach(function (raw) {
      var item  = _reservaItem(raw, body.grup_projecte);
      var motiu = _reservaMotiuRebuig(item, ocupades, estats);
      if (motiu) {
        rebutjades.push({
          maquina_id: item.maquina_id,
          data:       item.data,
          hora_inici: item.hora_inici,
          hora_fi:    item.hora_fi,
          motiu:      motiu,
        });
        return;
      }
      acceptades.push(item);
      // Una acceptada passa a ocupar la franja: així el lot no es solapa amb ell
      // mateix. Irrellevant a la Capa 1 (màquines diferents), IMPRESCINDIBLE a la
      // Capa 2, on una llista d'horaris solts pot xocar amb ella mateixa.
      ocupades.push(item);
    });

    if (acceptades.length === 0) {
      return jsonResponse({ creades: [], rebutjades: rebutjades });
    }

    var ids   = _reservaGeneraIds(acceptades.length);
    var files = acceptades.map(function (item, i) { return _reservaFila(usuari, item, ids[i]); });
    _reservaEscriu(sheet, files);

    var creades = acceptades.map(function (item, i) {
      return {
        id:         ids[i],
        maquina_id: item.maquina_id,
        data:       item.data,
        hora_inici: item.hora_inici,
        hora_fi:    item.hora_fi,
        estat:      'confirmada',
      };
    });

    return jsonResponse({ creades: creades, rebutjades: rebutjades });
  } finally {
    lock.releaseLock();
  }
}

function cancelReserva(body, usuari) {
  var sheet    = getSheet('Reserves');
  var data     = sheetToObjects(sheet);
  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var estatCol = headers.indexOf('Estat_Reserva') + 1;

  for (var i = 0; i < data.length; i++) {
    if (data[i]['ID_Reserva'] === body.reserva_id) {
      if (data[i]['Usuari'] !== usuari.email && usuari.nivell !== 'ADMIN') {
        return errorResponse('Sense permisos per cancel·lar aquesta reserva', 403);
      }
      sheet.getRange(i + 2, estatCol).setValue('cancel·lada');
      return jsonResponse({ cancelled: true });
    }
  }
  return errorResponse('Reserva no trobada', 404);
}

// ===== INCIDÈNCIES: lògica compartida (app + formulari) =====

function _incidenciaAutomatitza(maquina_id, urgencia) {
  // Escala del formulari (fets observables). L'escala antiga de l'app es va retirar
  // amb la neteja del Tram D: la seva única via d'entrada era createIncidencia.
  var urgenciesAltes = [
    '⚠️ Sí, però amb algun problema',
    '⛔ No funciona o l\'he aturada',
    '🚨 Hi ha risc (flama, fum, olor de cremat, espurnes...)'
  ];
  if (urgenciesAltes.indexOf(urgencia) === -1 || !maquina_id) return null;

  var urgenciesStandby = [
    '⛔ No funciona o l\'he aturada',
    '🚨 Hi ha risc (flama, fum, olor de cremat, espurnes...)'
  ];
  var nouEstat = urgenciesStandby.indexOf(urgencia) !== -1
    ? 'Standby - No disponible'
    : 'Revisió pendent';

  var mSheet    = getSheet('Control_Màquines');
  var mData     = sheetToObjects(mSheet);
  var mHeaders  = mSheet.getRange(1, 1, 1, mSheet.getLastColumn()).getValues()[0];
  var mEstatCol = mHeaders.indexOf('Estat_Actual') + 1;
  for (var i = 0; i < mData.length; i++) {
    if (mData[i]['ID_Maquina'] === maquina_id) {
      mSheet.getRange(i + 2, mEstatCol).setValue(nouEstat);
      break;
    }
  }

  var avui      = new Date();
  var rSheet    = getSheet('Reserves');
  var rData     = sheetToObjects(rSheet);
  var rHeaders  = rSheet.getRange(1, 1, 1, rSheet.getLastColumn()).getValues()[0];
  var rEstatCol = rHeaders.indexOf('Estat_Reserva') + 1;
  for (var j = 0; j < rData.length; j++) {
    var r = rData[j];
    if (r['ID_Maquina'] !== maquina_id) continue;
    if (['denegada', 'cancel·lada', 'suspesa'].indexOf(r['Estat_Reserva']) !== -1) continue;
    if (new Date(r['Data_Reserva']) >= avui) {
      rSheet.getRange(j + 2, rEstatCol).setValue('suspesa');
      sendEmailStandby(r, nouEstat, urgencia);
    }
  }

  return nouEstat;
}

function _incidenciaAvisaAdmins(nom, email, maquina_id, urgencia, detall, nouEstat) {
  var admins = getAdminEmails();
  if (admins.length === 0) return;

  var cos = 'Incidència reportada per ' + nom + ' (' + email + ').\n\n' +
            'Màquina: ' + maquina_id + '\n' +
            'Urgència: ' + urgencia + '\n\n' +
            detall + '\n\n' +
            (nouEstat ? 'Estat màquina actualitzat a: ' + nouEstat + '\n' : 'La màquina no ha canviat d\'estat (urgència no alta).\n');

  MailApp.sendEmail({
    to: admins[0],
    cc: admins.slice(1).join(','),
    subject: 'FAIG Lab — Incidència ' + urgencia + ' a ' + maquina_id,
    body: cos,
  });
}

// ===== TRAM C: cicle de vida de les incidències =====
// Les columnes d'estat es localitzen SEMPRE pel nom de capçalera, mai per posició:
// Google reorganitza les columnes del full de respostes quan s'edita el formulari.
function _incidenciaColumnes(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cols = {
    id:         headers.indexOf('ID_Incidencia') + 1,
    estat:      headers.indexOf('Estat') + 1,
    dataCanvi:  headers.indexOf('Data_Canvi_Estat') + 1,
    gestionada: headers.indexOf('Gestionada_Per') + 1,
  };

  var falten = [];
  if (cols.id === 0)         falten.push('ID_Incidencia');
  if (cols.estat === 0)      falten.push('Estat');
  if (cols.dataCanvi === 0)  falten.push('Data_Canvi_Estat');
  if (cols.gestionada === 0) falten.push('Gestionada_Per');
  if (falten.length > 0) {
    throw new Error('Columnes no trobades a Incidències_Respostes: ' + falten.join(', '));
  }
  return cols;
}

function _incidenciaIdsExistents(sheet, colId) {
  var ultima = sheet.getLastRow();
  if (ultima < 2) return [];
  return sheet.getRange(2, colId, ultima - 1, 1).getValues()
    .map(function (fila) { return String(fila[0] || '').trim(); })
    .filter(function (v) { return v !== ''; });
}

// INC-YYYYMMDD-HHMMSS. Dos enviaments dins el mateix segon donarien el mateix
// identificador: hi afegim sufix -2, -3... fins que sigui únic.
function _incidenciaGeneraId(quan, idsExistents) {
  var base = 'INC-' + Utilities.formatDate(quan, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  if (idsExistents.indexOf(base) === -1) return base;
  var n = 2;
  while (idsExistents.indexOf(base + '-' + n) !== -1) n++;
  return base + '-' + n;
}

// Índex de columna per a cada clau d'INCIDENCIA_CAMPS_LLISTA, localitzat pel NOM de
// capçalera (mai per posició). Compartit per getIncidencies i pel vigilant de temps
// del Tram E. Llança si en falta cap: cada cridador decideix com ho reporta.
function _incidenciaIndexCamps(headers) {
  var idx    = {};
  var falten = [];
  INCIDENCIA_CAMPS_LLISTA.forEach(function (c) {
    var i = headers.indexOf(c.capcalera);
    if (i === -1) falten.push(c.capcalera);
    idx[c.clau] = i;
  });
  if (falten.length > 0) {
    throw new Error('Capçaleres no trobades a Incidències_Respostes: ' + falten.join(', '));
  }
  return idx;
}

function _incidenciaValorText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v).trim();
}

// Llista per a la vista admin. Per defecte, només les que NO estan resoltes.
// body.estat opcional: 'Oberta' | 'En curs' | 'Resolta' | 'totes'.
// Les files sense Estat (trigger fallat, o anteriors al Tram C) SURTEN a la llista
// per defecte: amagar-les taparia una fallada silenciosa de l'estampat.
function getIncidencies(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var filtre = String((body && body.estat) || '').trim();
  if (filtre !== '' && filtre !== 'totes' && INCIDENCIA_ESTATS.indexOf(filtre) === -1) {
    return errorResponse('Filtre d\'estat no vàlid: "' + filtre + '". Valors admesos: ' +
                         INCIDENCIA_ESTATS.join(', ') + ', totes', 400);
  }

  var sheet  = getSheet('Incidències_Respostes');
  var valors = sheet.getDataRange().getValues();
  if (valors.length < 2) return jsonResponse([]);

  var idx;
  try {
    idx = _incidenciaIndexCamps(valors[0]);
  } catch (err) {
    return errorResponse(err.message, 500);
  }

  var llista = [];
  for (var f = 1; f < valors.length; f++) {
    var fila  = valors[f];
    var estat = String(fila[idx.estat] || '').trim();

    if (filtre === '') {
      if (estat === 'Resolta') continue;
    } else if (filtre !== 'totes' && estat !== filtre) {
      continue;
    }

    var item = {};
    INCIDENCIA_CAMPS_LLISTA.forEach(function (c) {
      item[c.clau] = _incidenciaValorText(fila[idx[c.clau]]);
    });
    llista.push(item);
  }

  // Més recents primer.
  llista.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
  return jsonResponse(llista);
}

// Detall complet d'UNA incidència: parells pregunta→resposta de tota la fila.
// Aparellem la fila crua amb la fila 1 crua PER ÍNDEX, MAI per capçalera: el
// formulari té títols de pregunta duplicats a posta (la pregunta àncora és idèntica
// a totes les seccions de màquina, i el títol de 'símptomes generals' el comparteixen
// 3D, plòter i escàner). Indexar per nom en perdria totes menys l'última, en silenci.
// Per això aquesta funció NO pot fer servir sheetToObjects.
function getIncidencia(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var id = String((body && body.incidencia_id) || '').trim();
  if (!id) return errorResponse('Falta incidencia_id', 400);

  var sheet  = getSheet('Incidències_Respostes');
  var valors = sheet.getDataRange().getValues();
  if (valors.length < 2) return errorResponse('Incidència no trobada: ' + id, 404);

  var headers = valors[0];
  var colId   = headers.indexOf('ID_Incidencia');
  if (colId === -1) {
    return errorResponse('Capçalera no trobada a Incidències_Respostes: ID_Incidencia', 500);
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
    return jsonResponse({ id: id, camps: camps });
  }

  return errorResponse('Incidència no trobada: ' + id, 404);
}

// Canvi d'estat del cicle de vida. NO toca l'estat de la màquina: resoldre una
// incidència no reobre res a Control_Màquines (decisió del Tram C).
function updateEstatIncidencia(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var nouEstat = String(body.estat || '').trim();
  if (INCIDENCIA_ESTATS.indexOf(nouEstat) === -1) {
    return errorResponse('Estat no vàlid: "' + nouEstat + '". Valors admesos: ' +
                         INCIDENCIA_ESTATS.join(', '), 400);
  }

  var id = String(body.incidencia_id || '').trim();
  if (!id) return errorResponse('Falta incidencia_id', 400);

  var sheet = getSheet('Incidències_Respostes');
  var cols;
  try {
    cols = _incidenciaColumnes(sheet);
  } catch (err) {
    return errorResponse(err.message, 500);
  }

  var data = sheetToObjects(sheet);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i]['ID_Incidencia'] || '').trim() === id) {
      var fila = i + 2;
      sheet.getRange(fila, cols.estat).setValue(nouEstat);
      sheet.getRange(fila, cols.dataCanvi).setValue(new Date());
      sheet.getRange(fila, cols.gestionada).setValue(usuari.email);
      return jsonResponse({ updated: true, incidencia_id: id, estat: nouEstat });
    }
  }

  return errorResponse('Incidència no trobada: ' + id, 404);
}

function resolReservesSuspeses(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet    = getSheet('Reserves');
  var data     = sheetToObjects(sheet);
  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var estatCol = headers.indexOf('Estat_Reserva') + 1;
  var avui     = new Date();
  var resolt   = 0;

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (r['Estat_Reserva'] !== 'suspesa') continue;
    if (body.maquina_id && r['ID_Maquina'] !== body.maquina_id) continue;

    var dataReserva = new Date(r['Data_Reserva']);
    var nouEstat    = dataReserva >= avui ? 'confirmada' : 'cancel·lada';
    sheet.getRange(i + 2, estatCol).setValue(nouEstat);
    sendEmailResolucio(r, nouEstat);
    resolt++;
  }

  return jsonResponse({ resolt: resolt });
}

function getInventari() {
  var data = sheetToObjects(getSheet('Inventari_materials'));
  return jsonResponse(data);
}

function registreConsum(body, usuari) {
  var invSheet = getSheet('Inventari_materials');
  var invData  = sheetToObjects(invSheet);
  var headers  = invSheet.getRange(1, 1, 1, invSheet.getLastColumn()).getValues()[0];
  var estocCol = headers.indexOf('Estoc_Actual') + 1;

  var material = null;
  var rowIdx   = -1;
  for (var i = 0; i < invData.length; i++) {
    if (invData[i]['ID_Material'] === body.material_id) {
      material = invData[i];
      rowIdx   = i + 2;
      break;
    }
  }
  if (!material) return errorResponse('Material no trobat', 404);

  var nouEstoc = Number(material['Estoc_Actual']) - Number(body.quantitat);
  if (nouEstoc < 0) return errorResponse('Estoc insuficient', 409);

  invSheet.getRange(rowIdx, estocCol).setValue(nouEstoc);

  var regSheet = getSheet('Registre_Consum');
  appendRow(regSheet, [
    'CON-' + new Date().getTime(),
    new Date().toISOString(),
    usuari.email,
    body.material_id,
    body.quantitat,
    body.grup_projecte || '',
  ]);

  return jsonResponse({ nou_estoc: nouEstoc });
}

function updateMaterial(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet   = getSheet('Inventari_materials');
  var data    = sheetToObjects(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (var i = 0; i < data.length; i++) {
    if (data[i]['ID_Material'] === body.material_id) {
      var rowIdx = i + 2;
      var camps  = ['Nom_Material', 'Unitat', 'Categoria', 'Taller', 'Estoc_Actual', 'Estoc_Minim', 'Estat_Alerta'];
      camps.forEach(function(camp) {
        if (body[camp] !== undefined) {
          var col = headers.indexOf(camp) + 1;
          if (col > 0) sheet.getRange(rowIdx, col).setValue(body[camp]);
        }
      });
      return jsonResponse({ updated: true });
    }
  }
  return errorResponse('Material no trobat', 404);
}

function createMaterial(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet = getSheet('Inventari_materials');
  appendRow(sheet, [
    'MAT-' + new Date().getTime(),
    body['Nom_Material']  || '',
    body['Unitat']        || '',
    body['Categoria']     || '',
    body['Taller']        || '',
    body['Estoc_Actual']  || 0,
    body['Estoc_Minim']   || 0,
    body['Estat_Alerta']  || 'OK',
  ]);
  return jsonResponse({ created: true });
}

function getUsuaris(usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);
  var data = sheetToObjects(getSheet('Usuaris_autoritzats'));
  return jsonResponse(data);
}

function createUsuari(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);
  var sheet = getSheet('Usuaris_autoritzats');
  appendRow(sheet, [
    body['Email_Usuari']     || '',
    body['Nom_Usuari']       || '',
    body['Nivell_Permis']    || 'USUARI',
    body['Autoritzat_Laser'] || 'NO',
    body['Autoritzat_3D']    || 'NO',
  ]);
  return jsonResponse({ created: true });
}

function updateUsuari(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet   = getSheet('Usuaris_autoritzats');
  var data    = sheetToObjects(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (var i = 0; i < data.length; i++) {
    if (data[i]['Email_Usuari'] === body['Email_Usuari']) {
      var rowIdx = i + 2;
      var camps  = ['Nom_Usuari', 'Nivell_Permis', 'Autoritzat_Laser', 'Autoritzat_3D'];
      camps.forEach(function(camp) {
        if (body[camp] !== undefined) {
          var col = headers.indexOf(camp) + 1;
          if (col > 0) sheet.getRange(rowIdx, col).setValue(body[camp]);
        }
      });
      return jsonResponse({ updated: true });
    }
  }
  return errorResponse('Usuari no trobat', 404);
}

function deleteUsuari(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet = getSheet('Usuaris_autoritzats');
  var data  = sheetToObjects(sheet);

  for (var i = 0; i < data.length; i++) {
    if (data[i]['Email_Usuari'] === body['Email_Usuari']) {
      sheet.deleteRow(i + 2);
      return jsonResponse({ deleted: true });
    }
  }
  return errorResponse('Usuari no trobat', 404);
}

function getDashboard(usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var maquines    = sheetToObjects(getSheet('Control_Màquines'));
  var reserves    = sheetToObjects(getSheet('Reserves'));
  var incidencies = sheetToObjects(getSheet('Incidències_Respostes'));
  var inventari   = sheetToObjects(getSheet('Inventari_materials'));

  var estatsMaquina = {};
  maquines.forEach(function(m) {
    var estat = m['Estat_Actual'] || 'Desconegut';
    estatsMaquina[estat] = (estatsMaquina[estat] || 0) + 1;
  });

  var avui = new Date();
  avui.setHours(0, 0, 0, 0);
  var reservesActives = reserves.filter(function(r) {
    var d = new Date(r['Data_Reserva']);
    return d >= avui && ['confirmada', 'aprovada'].indexOf(r['Estat_Reserva']) !== -1;
  }).length;

  // Incidències realment pendents (Estat != "Resolta"), no un recompte de 30 dies.
  // Les files amb Estat buit compten com a pendents, igual que a getIncidencies:
  // amagar-les taparia una fallada de l'estampat automàtic.
  var incidenciesObertes = incidencies.filter(function(inc) {
    return String(inc['Estat'] || '').trim() !== 'Resolta';
  }).length;

  var alertesEstoc = inventari.filter(function(m) {
    return Number(m['Estoc_Actual']) <= Number(m['Estoc_Minim']);
  }).map(function(m) {
    return { id: m['ID_Material'], nom: m['Nom_Material'], estoc: m['Estoc_Actual'], minim: m['Estoc_Minim'] };
  });

  return jsonResponse({
    maquines_per_estat:  estatsMaquina,
    reserves_actives:    reservesActives,
    incidencies_obertes: incidenciesObertes,
    alertes_estoc:       alertesEstoc,
    total_maquines:      maquines.length,
  });
}

function getSheet(nom) {
  var ss = SpreadsheetApp.openById(getSheetId());
  var sh = ss.getSheetByName(nom);
  if (!sh) throw new Error('Full no trobat: ' + nom);
  return sh;
}

function sheetToObjects(sheet) {
  var values  = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// Llegeix la pestanya retornant el VALOR VISIBLE de cada cel·la (text tal com
// es mostra). Així una hora '13:00' arriba sempre com a text '13:00', tant si
// la cel·la és text com si és un valor d'hora real, i evitem el problema de
// les dates de 1899 i la zona horària.
// getDisplayValues() és un mètode de Range, NO de Sheet: cal passar per
// getDataRange(), igual que sheetToObjects(). El bug va viure aquí sense
// executar-se mai perquè el clasp push que va portar aquesta funció no va anar
// acompanyat de versió nova del desplegament: el web app seguia servint la
// versió on getReserves encara feia servir sheetToObjects.
function sheetToObjectsDisplay(sheet) {
  var values  = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(sheet, values) {
  sheet.appendRow(values);
}

function excelTimeToHHMM(value) {
  if (!value) return '00:00';
  var s = String(value);
  var parts = s.split(' ');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      var timeParts = parts[i].split(':');
      var h = parseInt(timeParts[0]);
      var min = parseInt(timeParts[1]);
      return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
    }
  }
  if (s.indexOf(':') !== -1 && s.length <= 5) return s;
  if (!isNaN(Number(value))) {
    var total = Math.round(Number(value) * 24 * 60);
    var hores = Math.floor(total / 60);
    var minuts = total % 60;
    return (hores < 10 ? '0' : '') + hores + ':' + (minuts < 10 ? '0' : '') + minuts;
  }
  return s;
}

function generateToken() {
  return Utilities.getUuid().replace(/-/g, '');
}

function timesOverlap(ini1, fi1, ini2, fi2) {
  return ini1 < fi2 && fi1 > ini2;
}

function getDiaNom(dataStr) {
  var dies = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  return dies[new Date(dataStr).getDay()];
}

function getAdminEmails() {
  var data = sheetToObjects(getSheet('Usuaris_autoritzats'));
  return data
    .filter(function(u) { return u['Nivell_Permis'] === 'ADMIN'; })
    .map(function(u) { return u['Email_Usuari']; });
}

function sendEmailPermis(usuari, body, idReserva, token) {
  var admins = getAdminEmails();
  if (admins.length === 0) return;

  var baseUrl    = PropertiesService.getScriptProperties().getProperty('GAS_URL') || '';
  var urlAprovar = baseUrl + '?action=approve&token=' + token;
  var urlDenegar = baseUrl + '?action=deny&token=' + token;

  MailApp.sendEmail({
    to: admins[0],
    cc: admins.slice(1).join(','),
    subject: 'FAIG Lab — Sol·licitud de reserva pendent de permís (' + idReserva + ')',
    body: usuari.nom + ' (' + usuari.email + ') ha sol·licitat una reserva que requereix autorització.\n\n' +
          'Màquina: ' + body.maquina_id + '\n' +
          'Data: ' + body.data + '\n' +
          'Hora: ' + body.hora_inici + ' - ' + body.hora_fi + '\n' +
          'Grup/Projecte: ' + (body.grup_projecte || '-') + '\n\n' +
          '✅ APROVAR: ' + urlAprovar + '\n' +
          '❌ DENEGAR: ' + urlDenegar,
  });
}

function sendEmailStandby(reserva, nouEstat, urgencia) {
  if (!reserva['Usuari']) return;
  MailApp.sendEmail({
    to: reserva['Usuari'],
    subject: 'FAIG Lab — Reserva suspesa per incidència (' + reserva['ID_Reserva'] + ')',
    body: 'La teva reserva ha estat suspesa a causa d\'una incidència a la màquina ' + reserva['ID_Maquina'] + '.\n\n' +
          'Urgència: ' + urgencia + '\n' +
          'Nou estat màquina: ' + nouEstat + '\n\n' +
          'Data reserva: ' + reserva['Data_Reserva'] + '\n' +
          'Hora: ' + reserva['Hora_Inici'] + ' - ' + reserva['Hora_Final'] + '\n\n' +
          'Ens posarem en contacte quan la màquina estigui operativa.',
  });
}

function sendEmailResolucio(reserva, nouEstat) {
  if (!reserva['Usuari']) return;
  var missatge = nouEstat === 'confirmada'
    ? 'La teva reserva suspesa ha estat REACTIVADA i ara és confirmada.'
    : 'La teva reserva suspesa ha estat cancel·lada perquè la data ja ha passat.';
  MailApp.sendEmail({
    to: reserva['Usuari'],
    subject: 'FAIG Lab — Resolució de reserva suspesa (' + reserva['ID_Reserva'] + ')',
    body: missatge + '\n\n' +
          'Màquina: ' + reserva['ID_Maquina'] + '\n' +
          'Data: ' + reserva['Data_Reserva'] + '\n' +
          'Hora: ' + reserva['Hora_Inici'] + ' - ' + reserva['Hora_Final'],
  });
}

function getProtocol(body) {
  var maquines = sheetToObjects(getSheet('Control_Màquines'));
  var maquina  = null;
  for (var i = 0; i < maquines.length; i++) {
    if (maquines[i]['ID_Maquina'] === body.maquina_id) {
      maquina = maquines[i];
      break;
    }
  }
  if (!maquina) return errorResponse('Màquina no trobada', 404);

  var idProtocol = maquina['ID_Protocol'];
  if (!idProtocol) return jsonResponse({ protocol: null });

  var items = sheetToObjects(getSheet('Protocol_Items'));
  var filtrats = items.filter(function(item) {
    return item['ID_Protocol'] === idProtocol;
  });

  return jsonResponse({
    id_protocol: idProtocol,
    maquina_id:  body.maquina_id,
    items:       filtrats,
  });
}

function registreChecklist(body, usuari) {
  var ss    = SpreadsheetApp.openById(getSheetId());
  var sheet = ss.getSheetByName('Registre_Checklists');
  if (!sheet) {
    sheet = ss.insertSheet('Registre_Checklists');
    sheet.appendRow([
      'ID_Checklist','Data_Hora','Email_Usuari','Nom_Usuari',
      'ID_Maquina','ID_Reserva','ID_Protocol',
      'Bloc_Completat','Items_SI_Total','PDF_Descarregat'
    ]);
  }

  var id = 'CHK-' + new Date().getTime();
  sheet.appendRow([
    id,
    new Date().toISOString(),
    usuari.email,
    usuari.nom,
    body.maquina_id     || '',
    body.reserva_id     || '',
    body.id_protocol    || '',
    body.bloc_completat || '',
    body.items_total    || '',
    body.pdf_descarregat ? 'SI' : 'NO',
  ]);

  return jsonResponse({ id_checklist: id, registrat: true });
}

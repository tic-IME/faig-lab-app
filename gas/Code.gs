// ============================================================
// FAIG Lab — Google Apps Script Backend
// Institut Maria Espinalt
// ============================================================

// ── Configuració ────────────────────────────────────────────

const ALLOWED_ORIGIN = '*';

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

// ── doGet ────────────────────────────────────────────────────

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
    var sheet = getSheet('Reserves');
    var data  = sheetToObjects(sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var tokenCol = headers.indexOf('Token_Permis') + 1;
    var estatCol = headers.indexOf('Estat_Reserva') + 1;
    var idCol    = headers.indexOf('ID_Reserva') + 1;

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

        if (reserva['Email_Usuari']) {
          MailApp.sendEmail({
            to: reserva['Email_Usuari'],
            subject: 'FAIG Lab — Reserva ' + nouEstat + ' (' + reserva['ID_Reserva'] + ')',
            body: missatge + '\n\nMàquina: ' + reserva['ID_Maquina'] +
                  '\nData: ' + reserva['Data_Reserva'] +
                  '\nHora: ' + reserva['Hora_Inici'] + ' - ' + reserva['Hora_Fi'],
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

// ── doPost ───────────────────────────────────────────────────

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

// ── Validació OAuth ──────────────────────────────────────────

function validateToken(accessToken) {
  try {
    var url      = 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + accessToken;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var info     = JSON.parse(response.getContentText());

    if (!info.email) return null;

    var sheet = getSheet('Usuaris_autoritzats');
    var data  = sheetToObjects(sheet);

    for (var i = 0; i < data.length; i++) {
      var u = data[i];
      if (u['Email_Usuari'].toString().trim().toLowerCase() === info.email.toString().trim().toLowerCase() && String(u['Autoritzat_Laser']).toUpperCase() !== 'FALSE') {
        return {
          email:             u['Email_Usuari'],
          nom:               u['Nom_Usuari'],
          nivell:            u['Nivell_Permís'],
          autoritzatLaser:   u['Autoritzat_Laser'],
          autoritzat3D:      u['Autoritzat_3D'],
          rowIndex:          i + 2,
        };
      }
    }
    return null;
  } catch (err) {
    Logger.log('validateToken error: ' + err.message);
    return null;
  }
}

// ── Router ───────────────────────────────────────────────────

function routeAction(action, body, usuari) {
  switch (action) {
    // Usuari
    case 'getMe':                return getMe(usuari);
    // Màquines
    case 'getMaquines':          return getMaquines();
    case 'updateEstatMaquina':   return updateEstatMaquina(body, usuari);
    // Horari
    case 'getHorariSetmana':     return getHorariSetmana(body);
    // Reserves
    case 'getReserves':          return getReserves(body);
    case 'createReserva':        return createReserva(body, usuari);
    case 'cancelReserva':        return cancelReserva(body, usuari);
    // Incidències
    case 'createIncidencia':     return createIncidencia(body, usuari);
    case 'resolReservesSuspeses':return resolReservesSuspeses(body, usuari);
    // Inventari
    case 'getInventari':         return getInventari();
    case 'registreConsum':       return registreConsum(body, usuari);
    case 'updateMaterial':       return updateMaterial(body, usuari);
    case 'createMaterial':       return createMaterial(body, usuari);
    // Usuaris (ADMIN)
    case 'getUsuaris':           return getUsuaris(usuari);
    case 'createUsuari':         return createUsuari(body, usuari);
    case 'updateUsuari':         return updateUsuari(body, usuari);
    case 'deleteUsuari':         return deleteUsuari(body, usuari);
    // Dashboard
    case 'getDashboard':         return getDashboard(usuari);

    default: return errorResponse('Acció desconeguda: ' + action, 400);
  }
}

// ── Accions: Usuari ──────────────────────────────────────────

function getMe(usuari) {
  return jsonResponse(usuari);
}

// ── Accions: Màquines ────────────────────────────────────────

function getMaquines() {
  var data = sheetToObjects(getSheet('Control_Màquines'));
  return jsonResponse(data);
}

function updateEstatMaquina(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet   = getSheet('Control_Màquines');
  var data    = sheetToObjects(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idCol   = headers.indexOf('ID_Maquina') + 1;
  var estatCol= headers.indexOf('Estat_Actual') + 1;

  for (var i = 0; i < data.length; i++) {
    if (data[i]['ID_Maquina'] === body.maquina_id) {
      sheet.getRange(i + 2, estatCol).setValue(body.nou_estat);
      return jsonResponse({ updated: true });
    }
  }
  return errorResponse('Màquina no trobada', 404);
}

// ── Accions: Horari ──────────────────────────────────────────

function getHorariSetmana(body) {
  var taller = body.taller || '';
  var data   = sheetToObjects(getSheet('Horari_Tallers'));

  var filtrat = data.filter(function(fila) {
    return !taller || fila['Ubicació'] === taller;
  });

  filtrat = filtrat.map(function(fila) {
    return {
      ID_Horari:          fila['ID_Horari'],
      Dia_Nom:            fila['Dia_Nom'],
      Hora_inici:         excelTimeToHHMM(fila['Hora_inici']),
      Hora_final:         excelTimeToHHMM(fila['Hora_final']),
      Assignatura_Grup:   fila['Assignatura_Grup'],
      Professor_titular:  fila['Professor_titular'],
      Ubicació:           fila['Ubicació'],
      Correu_Titular:     fila['Correu_Titular'],
    };
  });

  return jsonResponse(filtrat);
}

// ── Accions: Reserves ────────────────────────────────────────

function getReserves(body) {
  var data = sheetToObjects(getSheet('Reserves'));

  var filtrat = data.filter(function(r) {
    var okMaquina = !body.maquina_id || r['ID_Maquina'] === body.maquina_id;
    var okData    = !body.data       || r['Data_Reserva'] === body.data;
    return okMaquina && okData;
  });

  return jsonResponse(filtrat);
}

function createReserva(body, usuari) {
  var sheet   = getSheet('Reserves');
  var data    = sheetToObjects(sheet);
  var horaris = sheetToObjects(getSheet('Horari_Tallers'));
  var maquines= sheetToObjects(getSheet('Control_Màquines'));

  // Validació: solapament màquina
  var solapament = data.some(function(r) {
    if (r['ID_Maquina'] !== body.maquina_id) return false;
    if (r['Data_Reserva'] !== body.data) return false;
    if (['denegada', 'cancel·lada'].indexOf(r['Estat_Reserva']) !== -1) return false;
    return timesOverlap(r['Hora_Inici'], r['Hora_Fi'], body.hora_inici, body.hora_fi);
  });
  if (solapament) return errorResponse('Solapament de reserva per aquesta màquina', 409);

  // Validació: horari taller
  var diaSetmana = getDiaNom(body.data);
  var blocatPerTaller = horaris.some(function(h) {
    if (h['Ubicació'] !== body.ubicacio) return false;
    if (h['Dia_Nom'] !== diaSetmana) return false;
    return timesOverlap(
      excelTimeToHHMM(h['Hora_inici']),
      excelTimeToHHMM(h['Hora_final']),
      body.hora_inici,
      body.hora_fi
    );
  });
  if (blocatPerTaller) return errorResponse('Franja ocupada per horari de taller', 409);

  // Comprovació autorització làser / 3D
  var maquina = maquines.find(function(m) { return m['ID_Maquina'] === body.maquina_id; });
  var necessitaPermis = false;
  if (maquina) {
    var tipus = (maquina['Tipus_Maquina'] || '').toLowerCase();
    if (tipus.indexOf('laser') !== -1 && usuari.autoritzatLaser !== 'SI') necessitaPermis = true;
    if (tipus.indexOf('3d')    !== -1 && usuari.autoritzat3D    !== 'SI') necessitaPermis = true;
  }

  var token    = generateToken();
  var idReserva= 'RES-' + new Date().getTime();
  var estat    = necessitaPermis ? 'pendent_permís' : 'confirmada';

  appendRow(sheet, [
    idReserva,
    usuari.email,
    usuari.nom,
    body.maquina_id,
    body.data,
    body.hora_inici,
    body.hora_fi,
    body.grup_projecte || '',
    body.descripcio || '',
    estat,
    new Date().toISOString(),
    necessitaPermis ? token : '',
  ]);

  if (necessitaPermis) {
    sendEmailPermis(usuari, body, idReserva, token);
  }

  return jsonResponse({ id: idReserva, estat: estat, token: necessitaPermis ? token : null });
}

function cancelReserva(body, usuari) {
  var sheet   = getSheet('Reserves');
  var data    = sheetToObjects(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idCol   = headers.indexOf('ID_Reserva') + 1;
  var estatCol= headers.indexOf('Estat_Reserva') + 1;
  var emailCol= headers.indexOf('Email_Usuari') + 1;

  for (var i = 0; i < data.length; i++) {
    if (data[i]['ID_Reserva'] === body.reserva_id) {
      if (data[i]['Email_Usuari'] !== usuari.email && usuari.nivell !== 'ADMIN') {
        return errorResponse('Sense permisos per cancel·lar aquesta reserva', 403);
      }
      sheet.getRange(i + 2, estatCol).setValue('cancel·lada');
      return jsonResponse({ cancelled: true });
    }
  }
  return errorResponse('Reserva no trobada', 404);
}

// ── Accions: Incidències ─────────────────────────────────────

function createIncidencia(body, usuari) {
  var sheet = getSheet('Incidències_Respostes');

  appendRow(sheet, [
    new Date().toISOString(),          // Marca_de_temps
    usuari.email,                      // Adreça_electrònica
    usuari.nom,                        // Nom_cognom_docent
    body.ubicacio || '',               // Ubicació
    body.urgencia || '',               // Urgència
    body.maquina_id || '',             // Màquina_afectada
    body.descripcio || '',             // Descripció_personal
    body.correu_centre || '',          // Correu_centre
  ]);

  // Urgències altes: actualitzar estat màquina i suspendre reserves
  var urgenciesAltes = ['🟠 Problema seriós', '🔴 Màquina aturada', '🚨 Emergència / Risc'];
  if (urgenciesAltes.indexOf(body.urgencia) !== -1 && body.maquina_id) {
    var nouEstat = body.urgencia === '🚨 Emergència / Risc'
      ? 'Standby - No disponible'
      : 'Revisió pendent';

    // Actualitzar estat màquina
    var mSheet  = getSheet('Control_Màquines');
    var mData   = sheetToObjects(mSheet);
    var mHeaders= mSheet.getRange(1, 1, 1, mSheet.getLastColumn()).getValues()[0];
    var mIdCol  = mHeaders.indexOf('ID_Maquina') + 1;
    var mEstatCol= mHeaders.indexOf('Estat_Actual') + 1;
    for (var i = 0; i < mData.length; i++) {
      if (mData[i]['ID_Maquina'] === body.maquina_id) {
        mSheet.getRange(i + 2, mEstatCol).setValue(nouEstat);
        break;
      }
    }

    // Suspendre reserves futures i notificar titulars
    var avui = new Date();
    var rSheet  = getSheet('Reserves');
    var rData   = sheetToObjects(rSheet);
    var rHeaders= rSheet.getRange(1, 1, 1, rSheet.getLastColumn()).getValues()[0];
    var rEstatCol = rHeaders.indexOf('Estat_Reserva') + 1;

    for (var j = 0; j < rData.length; j++) {
      var r = rData[j];
      if (r['ID_Maquina'] !== body.maquina_id) continue;
      if (['denegada', 'cancel·lada', 'suspesa'].indexOf(r['Estat_Reserva']) !== -1) continue;
      var dataReserva = new Date(r['Data_Reserva']);
      if (dataReserva >= avui) {
        rSheet.getRange(j + 2, rEstatCol).setValue('suspesa');
        sendEmailStandby(r, nouEstat, body.urgencia);
      }
    }

    // Email CC a ADMINs
    var admins = getAdminEmails();
    if (admins.length > 0) {
      MailApp.sendEmail({
        to: admins[0],
        cc: admins.slice(1).join(','),
        subject: 'FAIG Lab — Incidència ' + body.urgencia + ' a ' + body.maquina_id,
        body: 'Incidència reportada per ' + usuari.nom + ' (' + usuari.email + ').\n\n' +
              'Màquina: ' + body.maquina_id + '\n' +
              'Urgència: ' + body.urgencia + '\n' +
              'Descripció: ' + body.descripcio + '\n\n' +
              'Estat màquina actualitzat a: ' + nouEstat,
      });
    }
  }

  return jsonResponse({ created: true });
}

function resolReservesSuspeses(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var sheet   = getSheet('Reserves');
  var data    = sheetToObjects(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var estatCol= headers.indexOf('Estat_Reserva') + 1;
  var avui    = new Date();
  var resolt  = 0;

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

// ── Accions: Inventari ───────────────────────────────────────

function getInventari() {
  var data = sheetToObjects(getSheet('Inventari_materials'));
  return jsonResponse(data);
}

function registreConsum(body, usuari) {
  var invSheet = getSheet('Inventari_materials');
  var invData  = sheetToObjects(invSheet);
  var headers  = invSheet.getRange(1, 1, 1, invSheet.getLastColumn()).getValues()[0];
  var idCol    = headers.indexOf('ID_Material') + 1;
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

// ── Accions: Usuaris (ADMIN) ─────────────────────────────────

function getUsuaris(usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);
  var data = sheetToObjects(getSheet('Usuaris_autoritzats'));
  return jsonResponse(data);
}

function createUsuari(body, usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);
  var sheet = getSheet('Usuaris_autoritzats');
  appendRow(sheet, [
    body['Email_Usuari']   || '',
    body['Nom_Usuari']     || '',
    body['Nivell_Permís']  || 'USUARI',
    body['Autoritzat_Laser'] || 'NO',
    body['Autoritzat_3D']  || 'NO',
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
      var camps  = ['Nom_Usuari', 'Nivell_Permís', 'Autoritzat_Laser', 'Autoritzat_3D'];
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

// ── Accions: Dashboard (ADMIN) ───────────────────────────────

function getDashboard(usuari) {
  if (usuari.nivell !== 'ADMIN') return errorResponse('Sense permisos', 403);

  var maquines   = sheetToObjects(getSheet('Control_Màquines'));
  var reserves   = sheetToObjects(getSheet('Reserves'));
  var incidencies= sheetToObjects(getSheet('Incidències_Respostes'));
  var inventari  = sheetToObjects(getSheet('Inventari_materials'));

  // Resum màquines per estat
  var estatsMaquina = {};
  maquines.forEach(function(m) {
    var estat = m['Estat_Actual'] || 'Desconegut';
    estatsMaquina[estat] = (estatsMaquina[estat] || 0) + 1;
  });

  // Reserves actives (confirmades o aprovades avui i endavant)
  var avui = new Date();
  avui.setHours(0, 0, 0, 0);
  var reservesActives = reserves.filter(function(r) {
    var d = new Date(r['Data_Reserva']);
    return d >= avui && ['confirmada', 'aprovada'].indexOf(r['Estat_Reserva']) !== -1;
  }).length;

  // Incidències obertes (últimes 30 dies sense resolució)
  var fa30dies = new Date(avui.getTime() - 30 * 24 * 60 * 60 * 1000);
  var incidenciesObertes = incidencies.filter(function(inc) {
    return new Date(inc['Marca_de_temps']) >= fa30dies;
  }).length;

  // Alertes estoc
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

// ── Helpers ──────────────────────────────────────────────────

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

function appendRow(sheet, values) {
  sheet.appendRow(values);
}

function excelTimeToHHMM(value) {
  if (typeof value === 'string' && value.indexOf(':') !== -1) return value;
  if (typeof value === 'number') {
    var totalMinuts = Math.round(value * 24 * 60);
    var hores       = Math.floor(totalMinuts / 60);
    var minuts      = totalMinuts % 60;
    return (hores < 10 ? '0' : '') + hores + ':' + (minuts < 10 ? '0' : '') + minuts;
  }
  return String(value);
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
    .filter(function(u) { return u['Nivell_Permís'] === 'ADMIN'; })
    .map(function(u) { return u['Email_Usuari']; });
}

function sendEmailPermis(usuari, body, idReserva, token) {
  var admins = getAdminEmails();
  if (admins.length === 0) return;

  var baseUrl   = PropertiesService.getScriptProperties().getProperty('GAS_URL') || '';
  var urlAprovar= baseUrl + '?action=approve&token=' + token;
  var urlDenegar= baseUrl + '?action=deny&token=' + token;

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
  if (!reserva['Email_Usuari']) return;
  MailApp.sendEmail({
    to: reserva['Email_Usuari'],
    subject: 'FAIG Lab — Reserva suspesa per incidència (' + reserva['ID_Reserva'] + ')',
    body: 'La teva reserva ha estat suspesa a causa d\'una incidència a la màquina ' + reserva['ID_Maquina'] + '.\n\n' +
          'Urgència: ' + urgencia + '\n' +
          'Nou estat màquina: ' + nouEstat + '\n\n' +
          'Data reserva: ' + reserva['Data_Reserva'] + '\n' +
          'Hora: ' + reserva['Hora_Inici'] + ' - ' + reserva['Hora_Fi'] + '\n\n' +
          'Ens posarem en contacte quan la màquina estigui operativa.',
  });
}

function sendEmailResolucio(reserva, nouEstat) {
  if (!reserva['Email_Usuari']) return;
  var missatge = nouEstat === 'confirmada'
    ? 'La teva reserva suspesa ha estat REACTIVADA i ara és confirmada.'
    : 'La teva reserva suspesa ha estat cancel·lada perquè la data ja ha passat.';
  MailApp.sendEmail({
    to: reserva['Email_Usuari'],
    subject: 'FAIG Lab — Resolució de reserva suspesa (' + reserva['ID_Reserva'] + ')',
    body: missatge + '\n\n' +
          'Màquina: ' + reserva['ID_Maquina'] + '\n' +
          'Data: ' + reserva['Data_Reserva'] + '\n' +
          'Hora: ' + reserva['Hora_Inici'] + ' - ' + reserva['Hora_Fi'],
  });
}

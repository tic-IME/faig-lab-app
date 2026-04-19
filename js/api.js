/* ============================================================
   FAIG Lab — API client + Toast
   ============================================================ */

/* ── Toast ─────────────────────────────────────────────────── */

window.Toast = (function () {

  const ICONS = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  function show(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
      '<span class="toast-icon">' + (ICONS[type] || '') + '</span>' +
      '<div class="toast-body"><span class="toast-title">' + _escHtml(msg) + '</span></div>';

    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', function () { toast.remove(); });
    }, 4000);
  }

  function ok(msg)      { show(msg, 'success'); }
  function error(msg)   { show(msg, 'error');   }
  function warning(msg) { show(msg, 'warning'); }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { show, ok, error, warning };

})();

/* ── API ────────────────────────────────────────────────────── */

window.API = (function () {

  async function call(action, data) {
    const token = Auth.getToken();

    const body = JSON.stringify({
      token:  token,
      action: action,
      ...(data || {}),
    });

    const response = await fetch(FAIG_CONFIG.GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    body,
    });

    if (!response.ok) {
      throw new Error('Error HTTP ' + response.status);
    }

    const json = await response.json();

    if (json.status < 200 || json.status >= 300) {
      throw new Error(json.error || 'Error desconegut del servidor');
    }

    return json.data;
  }

  // ── Màquines ───────────────────────────────────────────────

  const maquines = {
    getAll() {
      return call('getMaquines');
    },
    updateEstat(id, estat, notes) {
      return call('updateEstatMaquina', {
        maquina_id: id,
        nou_estat:  estat,
        notes:      notes || '',
      });
    },
  };

  // ── Horari ─────────────────────────────────────────────────

  const horari = {
    getSetmana(taller, diaNom) {
      return call('getHorariSetmana', {
        taller:   taller  || '',
        dia_nom:  diaNom  || '',
      });
    },
  };

  // ── Reserves ───────────────────────────────────────────────

  const reserves = {
    get(filters) {
      return call('getReserves', filters || {});
    },
    create(maquinaId, dataReserva, horaInici, horaFinal, docentResponsable, grupProjecte) {
      return call('createReserva', {
        maquina_id:          maquinaId,
        data:                dataReserva,
        hora_inici:          horaInici,
        hora_fi:             horaFinal,
        docent_responsable:  docentResponsable || '',
        grup_projecte:       grupProjecte      || '',
      });
    },
    cancel(id) {
      return call('cancelReserva', { reserva_id: id });
    },
  };

  // ── Incidències ────────────────────────────────────────────

  const incidencies = {
    create(maquinaId, ubicacio, urgencia, descripcio, correuCentre) {
      return call('createIncidencia', {
        maquina_id:    maquinaId,
        ubicacio:      ubicacio      || '',
        urgencia:      urgencia      || '',
        descripcio:    descripcio    || '',
        correu_centre: correuCentre  || '',
      });
    },
  };

  // ── Inventari ──────────────────────────────────────────────

  const inventari = {
    getAll() {
      return call('getInventari');
    },
    registreConsum(materialId, quantitat, grupProjecte) {
      return call('registreConsum', {
        material_id:   materialId,
        quantitat:     quantitat,
        grup_projecte: grupProjecte || '',
      });
    },
    updateMaterial(id, dades) {
      return call('updateMaterial', {
        material_id: id,
        ...dades,
      });
    },
    createMaterial(dades) {
      return call('createMaterial', dades || {});
    },
  };

  // ── Usuaris ────────────────────────────────────────────────

  const usuaris = {
    getAll() {
      return call('getUsuaris');
    },
    create(dades) {
      return call('createUsuari', dades || {});
    },
    update(email, dades) {
      return call('updateUsuari', { Email_Usuari: email, ...dades });
    },
    delete(email) {
      return call('deleteUsuari', { Email_Usuari: email });
    },
  };

  // ── Dashboard ──────────────────────────────────────────────

  const dashboard = {
    get() {
      return call('getDashboard');
    },
  };

  // ── API pública ────────────────────────────────────────────

  return {
    call,
    maquines,
    horari,
    reserves,
    incidencies,
    inventari,
    usuaris,
    dashboard,
  };

})();



// Protocols de seguretat
if (typeof API !== 'undefined') {
  API.protocols = {
get: function(maquinaId) {
      return API.call('getProtocol', { maquina_id: maquinaId });
    },
    registreChecklist: function(data) {
      return API.call('registreChecklist', data);
    },
  };
}
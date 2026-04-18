/* ============================================================
   FAIG Lab — Mòdul Incidències
   ============================================================ */

window.ModulIncidencies = (function () {

  const URGENCIA_CSS = {
    '🟢 Pot esperar':        { cls: 'reserva-confirmada',  label: 'Baixa'    },
    '🟡 Atenció requerida':  { cls: 'reserva-pendent',     label: 'Mitjana'  },
    '🟠 Problema seriós':    { cls: 'reserva-suspesa',     label: 'Alta'     },
    '🔴 Màquina aturada':    { cls: 'reserva-denegada',    label: 'Crítica'  },
    '🚨 Emergència / Risc':  { cls: 'reserva-denegada',    label: 'Emergència'},
  };

  const URGENCIES_ALTES = ['🟠 Problema seriós', '🔴 Màquina aturada', '🚨 Emergència / Risc'];

  let _container = null;
  let _maquines  = [];

  // ── init ──────────────────────────────────────────────────

  async function init(container) {
    _container = container;
    await _carrega();
  }

  // ── Càrrega ───────────────────────────────────────────────

  async function _carrega() {
    _container.innerHTML =
      '<div class="module-header">' +
        '<div class="module-header-left">' +
          '<h2 class="module-title">Incidències</h2>' +
          '<p class="module-subtitle">Reporta un problema amb una màquina del FabLab</p>' +
        '</div>' +
      '</div>' +
      '<div id="inc-body"><div class="spinner-wrap"><div class="spinner"></div></div></div>';

    try {
      _maquines = (await API.maquines.getAll()) || [];
      _renderContingut();
    } catch (err) {
      Toast.error('Error carregant les màquines: ' + err.message);
      document.getElementById('inc-body').innerHTML =
        '<div class="empty-state"><p class="empty-state-desc">No s\'han pogut carregar les dades.</p></div>';
    }
  }

  // ── Render contingut ──────────────────────────────────────

  function _renderContingut() {
    const cos = document.getElementById('inc-body');
    if (!cos) return;

    // Màquines disponibles (exclou standby total)
    const maquinesDisp = _maquines.filter(function (m) {
      return m['Estat_Actual'] !== 'Standby - No disponible';
    });

    const opcMaquines = maquinesDisp.map(function (m) {
      const estat = m['Estat_Actual'] ? ' [' + m['Estat_Actual'] + ']' : '';
      return '<option value="' + _esc(m['ID_Maquina']) + '" data-ubicacio="' + _esc(m['Ubicació'] || '') + '">' +
             _esc((m['ID_Maquina'] || '') + ' — ' + (m['Tipus_Maquina'] || '') + estat) +
             '</option>';
    }).join('');

    const opcUrgencies = (FAIG_CONFIG.URGENCIES || []).map(function (u) {
      return '<option value="' + _esc(u) + '">' + _esc(u) + '</option>';
    }).join('');

    cos.innerHTML =
      // ── Formulari ──
      '<div class="card" style="max-width:640px;margin-bottom:1.5rem;">' +
        '<div class="card-header"><span class="card-title">⚠️ Nova incidència</span></div>' +

        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Màquina afectada *</label>' +
            '<select id="inc-maquina">' +
              '<option value="">— Selecciona màquina —</option>' + opcMaquines +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Ubicació</label>' +
            '<input type="text" id="inc-ubicacio" placeholder="S\'omple automàticament" readonly ' +
                   'style="background:var(--col-bg);opacity:.85;">' +
          '</div>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Urgència *</label>' +
          '<select id="inc-urgencia">' +
            '<option value="">— Selecciona urgència —</option>' + opcUrgencies +
          '</select>' +
        '</div>' +

        '<div id="inc-avis-alta" style="display:none;padding:.65rem .875rem;border-radius:7px;margin-bottom:.75rem;' +
             'background:#fef9c3;border:1px solid #fde68a;font-size:.83rem;color:#854d0e;">' +
          '<strong>⚠️ Urgència alta:</strong> En enviar, la màquina passarà a estat de revisió o standby ' +
          'i totes les reserves futures seran suspeses automàticament. Els administradors rebran un avís per email.' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Descripció del problema *</label>' +
          '<textarea id="inc-desc" placeholder="Descriu el problema amb el màxim detall: quan ha passat, com s\'ha manifestat, si hi ha hagut soroll, fum, error en pantalla..." style="min-height:120px;"></textarea>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Correu de contacte del centre (opcional)</label>' +
          '<input type="email" id="inc-correu" placeholder="incidencies@escolamesample.cat">' +
        '</div>' +

        '<p id="inc-form-error" class="form-error" style="display:none;"></p>' +

        '<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.5rem;">' +
          '<button class="btn-secondary" id="btn-inc-netejar">Neteja</button>' +
          '<button class="btn-danger" id="btn-inc-enviar">Enviar incidència</button>' +
        '</div>' +
      '</div>' +

      // ── Llista ADMIN ──
      (Auth.isAdmin()
        ? '<div id="inc-llista-wrap">' +
            '<h3 style="font-size:.8rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
                 'color:var(--col-text-muted);margin-bottom:.75rem;">Incidències recents (últimes 20)</h3>' +
            '<div id="inc-llista"><div class="spinner-wrap"><div class="spinner"></div></div></div>' +
          '</div>'
        : '');

    // Autoomplert ubicació
    document.getElementById('inc-maquina').addEventListener('change', function () {
      const sel = this.options[this.selectedIndex];
      const ubi = sel ? (sel.dataset.ubicacio || '') : '';
      document.getElementById('inc-ubicacio').value = ubi;
    });

    // Avís urgència alta
    document.getElementById('inc-urgencia').addEventListener('change', function () {
      const avis = document.getElementById('inc-avis-alta');
      avis.style.display = URGENCIES_ALTES.indexOf(this.value) !== -1 ? '' : 'none';
    });

    // Neteja formulari
    document.getElementById('btn-inc-netejar').addEventListener('click', _neteja);

    // Enviar
    document.getElementById('btn-inc-enviar').addEventListener('click', _enviar);

    // Carrega llista si ADMIN
    if (Auth.isAdmin()) {
      _carregaLlista();
    }
  }

  // ── Enviar incidència ─────────────────────────────────────

  async function _enviar() {
    const btn    = document.getElementById('btn-inc-enviar');
    const errEl  = document.getElementById('inc-form-error');
    const maqId  = document.getElementById('inc-maquina').value;
    const ubi    = document.getElementById('inc-ubicacio').value.trim();
    const urg    = document.getElementById('inc-urgencia').value;
    const desc   = document.getElementById('inc-desc').value.trim();
    const correu = document.getElementById('inc-correu').value.trim();

    errEl.style.display = 'none';

    if (!maqId) {
      errEl.textContent   = 'Selecciona la màquina afectada.';
      errEl.style.display = '';
      return;
    }
    if (!urg) {
      errEl.textContent   = 'Selecciona el nivell d\'urgència.';
      errEl.style.display = '';
      return;
    }
    if (!desc) {
      errEl.textContent   = 'La descripció del problema és obligatòria.';
      errEl.style.display = '';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Enviant…';

    try {
      await API.incidencies.create(maqId, ubi, urg, desc, correu);

      if (URGENCIES_ALTES.indexOf(urg) !== -1) {
        Toast.warning('Incidència enviada. La màquina ha canviat d\'estat i les reserves futures han estat suspeses.');
      } else {
        Toast.ok('Incidència reportada correctament. Gràcies!');
      }

      _neteja();

      if (Auth.isAdmin()) {
        _carregaLlista();
      }
    } catch (err) {
      errEl.textContent   = err.message || 'Error enviant la incidència. Torna-ho a intentar.';
      errEl.style.display = '';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Enviar incidència';
    }
  }

  // ── Neteja formulari ──────────────────────────────────────

  function _neteja() {
    const ids = ['inc-maquina', 'inc-ubicacio', 'inc-urgencia', 'inc-desc', 'inc-correu', 'inc-form-error'];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.value = '';
      else el.style.display = 'none';
    });
    const avis = document.getElementById('inc-avis-alta');
    if (avis) avis.style.display = 'none';
    const errEl = document.getElementById('inc-form-error');
    if (errEl) errEl.style.display = 'none';
  }

  // ── Llista incidències (ADMIN) ────────────────────────────

  async function _carregaLlista() {
    const wrap = document.getElementById('inc-llista');
    if (!wrap) return;

    wrap.innerHTML = '<div class="spinner-wrap" style="min-height:80px;"><div class="spinner"></div></div>';

    try {
      // Reutilitza getAll màquines per no tenir endpoint nou; les incidències
      // vénen del dashboard o d'una crida directa si s'implementa.
      // Aquí fem una crida al dashboard per obtenir un resum,
      // i mostrem les darreres 20 incidències del full via getMe de backup.
      // Com que no hi ha endpoint específic getIncidencies, usem getDashboard
      // per al resum i informem l'usuari.
      const dash = await API.dashboard.get();
      _renderLlistaResum(wrap, dash);
    } catch (err) {
      wrap.innerHTML = '<div class="empty-state" style="min-height:80px;">' +
        '<p class="empty-state-desc">No s\'han pogut carregar les incidències recents.</p></div>';
    }
  }

  function _renderLlistaResum(wrap, dash) {
    // El dashboard retorna incidencies_obertes (comptador).
    // Mostrem un resum informatiu i l'estat de les màquines afectades.
    const maquinesProblema = _maquines.filter(function (m) {
      return ['Avariada', 'Revisió pendent', 'Standby - No disponible'].indexOf(m['Estat_Actual']) !== -1;
    });

    if (maquinesProblema.length === 0 && (!dash || dash.incidencies_obertes === 0)) {
      wrap.innerHTML =
        '<div class="empty-state" style="min-height:80px;">' +
          '<span class="empty-state-icon">✅</span>' +
          '<p class="empty-state-title">Cap incidència oberta</p>' +
          '<p class="empty-state-desc">Totes les màquines estan operatives.</p>' +
        '</div>';
      return;
    }

    let html = '';

    if (dash && dash.incidencies_obertes > 0) {
      html += '<div style="padding:.6rem .875rem;border-radius:7px;margin-bottom:.875rem;' +
              'background:#fef9c3;border:1px solid #fde68a;font-size:.85rem;color:#854d0e;">' +
              '⚠️ Hi ha <strong>' + dash.incidencies_obertes + '</strong> incidències reportades els últims 30 dies.' +
              '</div>';
    }

    if (maquinesProblema.length > 0) {
      html += '<div class="table-wrap"><table>' +
        '<thead><tr>' +
          '<th>Màquina</th>' +
          '<th>Tipus</th>' +
          '<th>Ubicació</th>' +
          '<th>Estat actual</th>' +
        '</tr></thead>' +
        '<tbody>';

      maquinesProblema.forEach(function (m) {
        const estat    = m['Estat_Actual'] || '';
        const estatCls = {
          'Avariada':               'estat-avariada',
          'Revisió pendent':        'estat-revisio',
          'Standby - No disponible':'estat-standby',
        }[estat] || 'estat-standby';

        html += '<tr>' +
          '<td><strong>' + _esc(m['ID_Maquina'] || '') + '</strong></td>' +
          '<td>' + _esc(m['Tipus_Maquina'] || '—') + '</td>' +
          '<td>' + _esc(m['Ubicació'] || '—') + '</td>' +
          '<td><span class="estat-badge ' + estatCls + '">' + _esc(estat) + '</span></td>' +
        '</tr>';
      });

      html += '</tbody></table></div>';
      html += '<p style="font-size:.78rem;color:var(--col-text-muted);margin-top:.5rem;">' +
              'Per veure el detall complet de cada incidència, consulta el full <em>Incidències_Respostes</em> al Google Sheets.' +
              '</p>';
    }

    wrap.innerHTML = html;
  }

  // ── Utilitats ─────────────────────────────────────────────

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── API pública ───────────────────────────────────────────

  return { init };

})();

if (window.MODULES !== undefined) {
  MODULES['incidencies'] = ModulIncidencies;
}

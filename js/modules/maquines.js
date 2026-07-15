/* ============================================================
   FAIG Lab — Mòdul Màquines
   ============================================================ */

window.ModulMaquines = (function () {

  const ESTATS = [
    'Operativa',
    'Avariada',
    'Manteniment',
    'Standby - No disponible',
    'Revisió pendent',
  ];

  const ESTAT_CSS = {
    'Operativa':              'estat-operativa',
    'Avariada':               'estat-avariada',
    'Manteniment':            'estat-manteniment',
    'Standby - No disponible':'estat-standby',
    'Revisió pendent':        'estat-revisio',
  };

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
          '<h2 class="module-title">Màquines</h2>' +
          '<p class="module-subtitle">Estat actual de l\'equipament del FabLab</p>' +
        '</div>' +
        '<div class="module-header-actions">' +
          '<button class="btn-secondary btn-sm" id="btn-reload-maq">↻ Actualitza</button>' +
        '</div>' +
      '</div>' +
      '<div id="maq-body"><div class="spinner-wrap"><div class="spinner"></div></div></div>';

    document.getElementById('btn-reload-maq').addEventListener('click', _carrega);

    try {
      _maquines = (await API.maquines.getAll()) || [];
      _renderMaquines();
    } catch (err) {
      Toast.error('Error carregant les màquines: ' + err.message);
      document.getElementById('maq-body').innerHTML =
        '<div class="empty-state"><p class="empty-state-desc">No s\'han pogut carregar les dades.</p></div>';
    }
  }

  // ── Render ────────────────────────────────────────────────

  function _renderMaquines() {
    const cos = document.getElementById('maq-body');
    if (!cos) return;

    if (_maquines.length === 0) {
      cos.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-state-icon">🔧</span>' +
          '<p class="empty-state-title">Cap màquina registrada</p>' +
          '<p class="empty-state-desc">Afegeix màquines al full Control_Màquines del Google Sheets.</p>' +
        '</div>';
      return;
    }

    // Agrupa per Ubicació (taller)
    const tallers = {};
    _maquines.forEach(function (m) {
      const ubi = m['Ubicació'] || 'Sense assignar';
      if (!tallers[ubi]) tallers[ubi] = [];
      tallers[ubi].push(m);
    });

    let html = '';
    Object.keys(tallers).sort().forEach(function (taller) {
      const grup = tallers[taller];

      html += '<div style="margin-bottom:2rem;">' +
        '<h3 style="font-size:.8rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
             'color:var(--col-text-muted);margin-bottom:.875rem;">🏭 ' + _esc(taller) +
             ' <span style="font-weight:400;opacity:.7;">(' + grup.length + ' màquines)</span></h3>' +
        '<div class="card-grid">';

      grup.forEach(function (m) {
        html += _renderCard(m);
      });

      html += '</div></div>';
    });

    cos.innerHTML = html;

    // Listeners selectors estat (ADMIN)
    if (Auth.isAdmin()) {
      cos.querySelectorAll('.sel-estat-maquina').forEach(function (sel) {
        sel.addEventListener('change', function () {
          _canviaEstat(sel.dataset.id, sel.value, sel);
        });
      });
    }

    // Listeners botó incidència: obre el formulari del centre en pestanya nova
    cos.querySelectorAll('.btn-reportar-inc').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.open(_urlIncidencia(btn.dataset.id), '_blank', 'noopener');
      });
    });
  }

  // ── Card màquina ──────────────────────────────────────────

  function _renderCard(m) {
    const estat    = m['Estat_Actual'] || 'Operativa';
    const estatCls = ESTAT_CSS[estat] || 'estat-standby';
    const dataRev  = _formatData(m['Darrera_Revisió']);
    const isAdmin  = Auth.isAdmin();

    // Selector d'estat per ADMIN
    let controlEstat = '';
    if (isAdmin) {
      const opcions = ESTATS.map(function (e) {
        return '<option value="' + _esc(e) + '"' + (estat === e ? ' selected' : '') + '>' + _esc(e) + '</option>';
      }).join('');
      controlEstat =
        '<div class="form-group" style="margin:0;">' +
          '<label>Canvia estat</label>' +
          '<select class="sel-estat-maquina" data-id="' + _esc(m['ID_Maquina']) + '">' +
            opcions +
          '</select>' +
        '</div>';
    } else {
      controlEstat =
        '<span class="estat-badge ' + estatCls + '">' + _esc(estat) + '</span>';
    }

    // Enllaç manual
    const manualLink = m['Manual_URL']
      ? '<a href="' + _esc(m['Manual_URL']) + '" target="_blank" rel="noopener" ' +
          'style="font-size:.78rem;color:var(--col-brand);">📄 Manual</a>'
      : '<span style="font-size:.78rem;color:var(--col-text-muted);">Sense manual</span>';

    return '<div class="card" style="display:flex;flex-direction:column;gap:.875rem;">' +

      // Capçalera card
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">' +
        '<div>' +
          '<p style="font-size:.72rem;color:var(--col-text-muted);margin-bottom:.1rem;">' + _esc(m['ID_Maquina'] || '') + '</p>' +
          '<p style="font-size:1rem;font-weight:700;line-height:1.2;">' + _esc(m['Tipus_Maquina'] || '—') + '</p>' +
        '</div>' +
        (isAdmin ? '' : '<span class="estat-badge ' + estatCls + '">' + _esc(estat) + '</span>') +
      '</div>' +

      // Detalls
      '<div style="display:flex;flex-direction:column;gap:.4rem;font-size:.82rem;color:var(--col-text-muted);">' +
        '<span>📍 ' + _esc(m['Ubicació'] || '—') + '</span>' +
        '<span>🔧 Darrera revisió: <strong style="color:var(--col-text);">' + dataRev + '</strong></span>' +
        manualLink +
      '</div>' +

      // Control estat (admin) o badge
      (isAdmin
        ? '<div style="padding-top:.25rem;border-top:1px solid var(--col-border);">' + controlEstat + '</div>'
        : '') +

      // Botó reportar
      '<button class="btn-danger btn-sm btn-reportar-inc" ' +
        'data-id="' + _esc(m['ID_Maquina']) + '" ' +
        'data-ubicacio="' + _esc(m['Ubicació'] || '') + '" ' +
        'style="width:100%;margin-top:auto;">⚠️ Reportar incidència</button>' +

    '</div>';
  }

  // ── Canvi d'estat (ADMIN) ─────────────────────────────────

  async function _canviaEstat(maquinaId, nouEstat, sel) {
    const anterior = sel.dataset.anterior || sel.querySelector('[selected]')?.value;

    if (!confirm('Canviar estat de ' + maquinaId + ' a "' + nouEstat + '"?')) {
      // Reverteix select si cancel·la
      _carrega();
      return;
    }

    sel.disabled = true;
    try {
      await API.maquines.updateEstat(maquinaId, nouEstat, '');
      Toast.ok('Estat de ' + maquinaId + ' actualitzat a "' + nouEstat + '".');
      // Actualitza localment sense recàrrega completa
      _maquines = _maquines.map(function (m) {
        if (m['ID_Maquina'] === maquinaId) {
          return Object.assign({}, m, { 'Estat_Actual': nouEstat });
        }
        return m;
      });
      sel.disabled = false;
    } catch (err) {
      Toast.error('Error actualitzant estat: ' + err.message);
      await _carrega();
    }
  }

  // ── URL del formulari d'incidències ───────────────────────

  // Preselecciona la màquina al formulari. Els ID_Maquina de Control_Màquines
  // coincideixen amb les opcions del formulari, que governen l'encaminament per seccions.
  function _urlIncidencia(idMaquina) {
    const base = FAIG_CONFIG.FORM_INCIDENCIES_URL || '';
    const entry = FAIG_CONFIG.FORM_INCIDENCIES_ENTRY_MAQUINA;
    if (!base || !idMaquina || !entry) return base;
    const sep = base.indexOf('?') === -1 ? '?' : '&';
    return base + sep + 'usp=pp_url&' + entry + '=' + encodeURIComponent(idMaquina);
  }

  // ── Utilitats ─────────────────────────────────────────────

  function _formatData(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── API pública ───────────────────────────────────────────

  return { init };

})();

if (window.MODULES !== undefined) {
  MODULES['maquines'] = ModulMaquines;
}

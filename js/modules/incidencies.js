/* ============================================================
   FAIG Lab — Mòdul Incidències
   ============================================================ */

window.ModulIncidencies = (function () {

  // Els tres únics valors admesos. Han de coincidir EXACTAMENT amb INCIDENCIA_ESTATS
  // del backend i amb la validació de dades de la columna Estat del full.
  const ESTATS_INC = ['Oberta', 'En curs', 'Resolta'];

  let _container   = null;
  let _maquines    = [];   // carregades per a l'admin; les farà servir el Tram D3
  let _incidencies = [];

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

    // Les màquines només calen per a la vista d'admin de sota la targeta.
    if (Auth.isAdmin()) {
      try {
        _maquines = (await API.maquines.getAll()) || [];
      } catch (err) {
        _maquines = [];
        Toast.error('Error carregant les màquines: ' + err.message);
      }
    }

    _renderContingut();
  }

  // ── Render contingut ──────────────────────────────────────

  function _renderContingut() {
    const cos = document.getElementById('inc-body');
    if (!cos) return;

    const urlForm = FAIG_CONFIG.FORM_INCIDENCIES_URL || '';

    cos.innerHTML =
      // ── Targeta: enllaç al formulari del centre ──
      '<div class="card" style="max-width:640px;margin-bottom:1.5rem;">' +
        '<div class="card-header"><span class="card-title">⚠️ Nova incidència</span></div>' +

        '<p style="font-size:.9rem;line-height:1.55;margin-bottom:1.125rem;">' +
          'Has tingut un problema amb una màquina o al taller? Registra la incidència al formulari ' +
          'del centre. El sistema avisa automàticament els responsables i, si cal, actualitza ' +
          'l\'estat de la màquina.' +
        '</p>' +

        '<div style="display:flex;justify-content:flex-end;">' +
          '<a class="btn-danger" id="btn-inc-formulari" href="' + _esc(urlForm) + '" ' +
             'target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;">' +
            'Obre el formulari d\'incidències' +
          '</a>' +
        '</div>' +
      '</div>' +

      // ── Llista ADMIN ──
      (Auth.isAdmin()
        ? '<div id="inc-llista-wrap">' +
            '<h3 style="font-size:.8rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
                 'color:var(--col-text-muted);margin-bottom:.75rem;">Incidències pendents</h3>' +
            '<div id="inc-llista"><div class="spinner-wrap"><div class="spinner"></div></div></div>' +
          '</div>'
        : '');

    // Carrega llista si ADMIN
    if (Auth.isAdmin()) {
      _carregaLlista();
    }
  }

  // ── Llista incidències (ADMIN) ────────────────────────────

  async function _carregaLlista() {
    const wrap = document.getElementById('inc-llista');
    if (!wrap) return;

    wrap.innerHTML = '<div class="spinner-wrap" style="min-height:80px;"><div class="spinner"></div></div>';

    try {
      // Sense filtre: el backend retorna les que NO estan resoltes.
      _incidencies = (await API.incidencies.getAll()) || [];
      _renderLlista(wrap);
    } catch (err) {
      wrap.innerHTML = '<div class="empty-state" style="min-height:80px;">' +
        '<p class="empty-state-title">No s\'han pogut carregar les incidències</p>' +
        '<p class="empty-state-desc">' + _esc(err.message) + '</p></div>';
    }
  }

  function _renderLlista(wrap) {
    if (_incidencies.length === 0) {
      wrap.innerHTML =
        '<div class="empty-state" style="min-height:80px;">' +
          '<span class="empty-state-icon">✅</span>' +
          '<p class="empty-state-title">Cap incidència pendent</p>' +
          '<p class="empty-state-desc">No hi ha incidències obertes ni en curs.</p>' +
        '</div>';
      return;
    }

    let html = '<div class="table-wrap"><table>' +
      '<thead><tr>' +
        '<th>Data</th>' +
        '<th>Màquina</th>' +
        '<th>Es pot fer servir?</th>' +
        '<th>Reportada per</th>' +
        '<th>Estat</th>' +
        '<th>Gestionada per</th>' +
      '</tr></thead><tbody>';

    _incidencies.forEach(function (inc) {
      html += '<tr>' +
        '<td>' + _esc(_formatData(inc.data)) + '</td>' +
        '<td><strong>' + _esc(inc.maquina_id || '—') + '</strong></td>' +
        '<td>' + _esc(inc.us || '—') + '</td>' +
        '<td>' + _esc(inc.docent || '—') + '</td>' +
        '<td>' + _selectorEstat(inc) + '</td>' +
        '<td>' + _esc(inc.gestionada_per || '—') + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('.sel-estat-inc').forEach(function (sel) {
      sel.dataset.anterior = sel.value;
      sel.addEventListener('change', function () {
        _canviaEstat(sel.dataset.id, sel.value, sel);
      });
    });
  }

  // Una fila sense ID vol dir que l'estampat automàtic ha fallat (el trigger
  // registra els errors només al Logger). La mostrem, però sense selector:
  // updateEstatIncidencia localitza la fila per ID i sense ID no hi ha res a fer.
  function _selectorEstat(inc) {
    const estat = inc.estat || '';

    if (!inc.id) {
      return '<span class="estat-badge estat-standby">Sense ID</span>' +
             '<div style="font-size:.72rem;color:var(--col-text-muted);margin-top:.2rem;">' +
             'Reviseu el full</div>';
    }

    const opcions = ESTATS_INC.map(function (e) {
      return '<option value="' + _esc(e) + '"' + (estat === e ? ' selected' : '') + '>' + _esc(e) + '</option>';
    }).join('');

    return '<select class="sel-estat-inc" data-id="' + _esc(inc.id) + '" ' +
           'style="font-size:.8rem;padding:.25rem .4rem;">' +
           (ESTATS_INC.indexOf(estat) === -1
             ? '<option value="" selected>' + _esc(estat || '(sense estat)') + '</option>'
             : '') +
           opcions + '</select>';
  }

  async function _canviaEstat(incidenciaId, nouEstat, sel) {
    if (!nouEstat) return;

    const anterior = sel.dataset.anterior || '';
    if (!confirm('Canviar la incidència ' + incidenciaId + ' a "' + nouEstat + '"?')) {
      sel.value = anterior;
      return;
    }

    sel.disabled = true;
    try {
      await API.incidencies.updateEstat(incidenciaId, nouEstat);
      Toast.ok('Incidència ' + incidenciaId + ' actualitzada a "' + nouEstat + '".');
      // Recarreguem: si passa a "Resolta" ha de desaparèixer de la llista.
      await _carregaLlista();
    } catch (err) {
      Toast.error('Error actualitzant la incidència: ' + err.message);
      sel.value = anterior;
      sel.disabled = false;
    }
  }

  function _formatData(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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

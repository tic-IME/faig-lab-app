/* ============================================================
   FAIG Lab — Mòdul Incidències
   ============================================================ */

window.ModulIncidencies = (function () {

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
                 'color:var(--col-text-muted);margin-bottom:.75rem;">Incidències recents (últimes 20)</h3>' +
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

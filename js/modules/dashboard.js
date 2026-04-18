/* ============================================================
   FAIG Lab — Mòdul Dashboard (només ADMIN)
   ============================================================ */

window.ModulDashboard = (function () {

  let _container = null;

  // ── init ──────────────────────────────────────────────────

  async function init(container) {
    _container = container;

    if (!Auth.isAdmin()) {
      container.innerHTML =
        '<div class="empty-state" style="min-height:60vh;">' +
          '<span class="empty-state-icon">🔒</span>' +
          '<p class="empty-state-title">Accés restringit</p>' +
          '<p class="empty-state-desc">Aquesta secció és exclusiva per a administradors del FabLab.</p>' +
        '</div>';
      return;
    }

    await _carrega();
  }

  // ── Càrrega ───────────────────────────────────────────────

  async function _carrega() {
    _container.innerHTML =
      '<div class="module-header">' +
        '<div class="module-header-left">' +
          '<h2 class="module-title">Dashboard</h2>' +
          '<p class="module-subtitle">Resum operatiu del FabLab — ' + _avuiLabel() + '</p>' +
        '</div>' +
        '<div class="module-header-actions">' +
          '<button class="btn-secondary btn-sm" id="btn-reload-dash">↻ Actualitza</button>' +
        '</div>' +
      '</div>' +
      '<div id="dash-body"><div class="spinner-wrap"><div class="spinner"></div></div></div>';

    document.getElementById('btn-reload-dash').addEventListener('click', _carrega);

    try {
      const [dash, maquines, reserves, inventari] = await Promise.all([
        API.dashboard.get(),
        API.maquines.getAll(),
        API.reserves.get({}),
        API.inventari.getAll(),
      ]);

      _renderDashboard(dash, maquines || [], reserves || [], inventari || []);
    } catch (err) {
      Toast.error('Error carregant el dashboard: ' + err.message);
      document.getElementById('dash-body').innerHTML =
        '<div class="empty-state"><p class="empty-state-desc">No s\'han pogut carregar les dades.</p></div>';
    }
  }

  // ── Render principal ──────────────────────────────────────

  function _renderDashboard(dash, maquines, reserves, inventari) {
    const cos = document.getElementById('dash-body');
    if (!cos) return;

    const estats      = dash.maquines_per_estat || {};
    const operatives  = estats['Operativa'] || 0;
    const ambProblema = (estats['Avariada'] || 0) + (estats['Revisió pendent'] || 0) + (estats['Standby - No disponible'] || 0);
    const totalMaq    = dash.total_maquines || maquines.length;

    const maqIncidencia = maquines.filter(function (m) {
      return ['Avariada', 'Revisió pendent', 'Standby - No disponible'].indexOf(m['Estat_Actual']) !== -1;
    });

    const alertesEstoc = dash.alertes_estoc || inventari.filter(function (m) {
      return Number(m['Estoc_Actual']) <= Number(m['Estoc_Minim']);
    }).map(function (m) {
      return { id: m['ID_Material'], nom: m['Nom_Material'], estoc: m['Estoc_Actual'], minim: m['Estoc_Minim'], taller: m['Taller'], unitat: m['Unitat'] };
    });

    const avui = _avuiStr();
    const reservesSuspeses = reserves.filter(function (r) {
      return r['Estat_Reserva'] === 'suspesa';
    });
    const reservesFuturesSusp = reservesSuspeses.filter(function (r) { return r['Data_Reserva'] >= avui; });

    let html = '';

    // ── Metric cards ──
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin-bottom:1.75rem;">';

    html += _metricCard('🟢', 'Màquines operatives',
      operatives + ' / ' + totalMaq,
      operatives === totalMaq ? 'Totes operatives' : ambProblema + ' amb incidències',
      operatives === totalMaq ? '#dcfce7' : '#fef9c3',
      operatives === totalMaq ? '#166534' : '#854d0e');

    html += _metricCard('🔴', 'Màquines amb incidència',
      ambProblema,
      ambProblema === 0 ? 'Cap problema actiu' : 'Requereixen atenció',
      ambProblema === 0 ? '#dcfce7' : '#fee2e2',
      ambProblema === 0 ? '#166534' : '#991b1b');

    html += _metricCard('🔖', 'Reserves actives',
      dash.reserves_actives || 0,
      'Confirmades o aprovades avui i endavant',
      '#dbeafe', '#1e40af');

    html += _metricCard('⚠️', 'Alertes d\'estoc',
      alertesEstoc.length,
      alertesEstoc.length === 0 ? 'Estocs correctes' : 'Materials per reposar',
      alertesEstoc.length === 0 ? '#dcfce7' : '#fee2e2',
      alertesEstoc.length === 0 ? '#166534' : '#991b1b');

    html += _metricCard('📋', 'Incidències (30 dies)',
      dash.incidencies_obertes || 0,
      'Reportades el darrer mes',
      '#fef9c3', '#854d0e');

    const reservesSusp = reservesSuspeses.length;
    html += _metricCard('🔶', 'Reserves suspeses',
      reservesSusp,
      reservesSusp === 0 ? 'Cap reserva suspesa' : reservesFuturesSusp.length + ' futures per reactivar',
      reservesSusp === 0 ? '#dcfce7' : '#ffedd5',
      reservesSusp === 0 ? '#166534' : '#9a3412');

    html += '</div>';

    // ── Màquines amb incidència ──
    html += '<div style="margin-bottom:1.75rem;">' +
      _seccioHeader('🔧 Màquines amb incidències pendents', maqIncidencia.length);

    if (maqIncidencia.length === 0) {
      html += _emptyRow('Totes les màquines estan operatives. ✅');
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>ID Màquina</th><th>Tipus</th><th>Ubicació</th><th>Estat</th><th>Darrera revisió</th><th></th>' +
        '</tr></thead><tbody>';

      maqIncidencia.forEach(function (m) {
        const estatCls = {
          'Avariada':               'estat-avariada',
          'Revisió pendent':        'estat-revisio',
          'Standby - No disponible':'estat-standby',
        }[m['Estat_Actual']] || 'estat-standby';

        html += '<tr>' +
          '<td><strong>' + _esc(m['ID_Maquina'] || '') + '</strong></td>' +
          '<td>' + _esc(m['Tipus_Maquina'] || '—') + '</td>' +
          '<td>' + _esc(m['Ubicació'] || '—') + '</td>' +
          '<td><span class="estat-badge ' + estatCls + '">' + _esc(m['Estat_Actual'] || '') + '</span></td>' +
          '<td style="font-size:.82rem;color:var(--col-text-muted);">' + _formatData(m['Darrera_Revisió']) + '</td>' +
          '<td style="text-align:right;">' +
            '<button class="btn-primary btn-sm btn-resolt-maq" ' +
              'data-id="' + _esc(m['ID_Maquina']) + '">✅ Marcar com a resolta</button>' +
          '</td>' +
        '</tr>';
      });

      html += '</tbody></table></div>';
    }
    html += '</div>';

    // ── Alertes estoc ──
    html += '<div style="margin-bottom:1.75rem;">' +
      _seccioHeader('📦 Alertes d\'estoc', alertesEstoc.length);

    if (alertesEstoc.length === 0) {
      html += _emptyRow('Tots els materials estan per sobre del mínim. ✅');
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>Material</th><th>ID</th><th>Taller</th><th>Estoc actual</th><th>Mínim</th><th>Dèficit</th>' +
        '</tr></thead><tbody>';

      alertesEstoc.forEach(function (m) {
        const deficit = Number(m.minim) - Number(m.estoc);
        html += '<tr>' +
          '<td><strong>' + _esc(m.nom || '—') + '</strong></td>' +
          '<td style="font-size:.78rem;color:var(--col-text-muted);">' + _esc(m.id || '') + '</td>' +
          '<td>' + _esc(m.taller || '—') + '</td>' +
          '<td><strong style="color:#dc2626;">' + _esc(String(m.estoc)) + '</strong> ' +
               '<span style="font-size:.78rem;color:var(--col-text-muted);">' + _esc(m.unitat || '') + '</span></td>' +
          '<td>' + _esc(String(m.minim)) + ' <span style="font-size:.78rem;color:var(--col-text-muted);">' + _esc(m.unitat || '') + '</span></td>' +
          '<td><span style="font-size:.8rem;font-weight:700;color:#991b1b;">-' + deficit + ' ' + _esc(m.unitat || '') + '</span></td>' +
        '</tr>';
      });

      html += '</tbody></table></div>';
    }
    html += '</div>';

    // ── Reserves suspeses ──
    html += '<div style="margin-bottom:1.75rem;">' +
      _seccioHeader('🔶 Reserves suspeses', reservesSuspeses.length);

    if (reservesSuspeses.length === 0) {
      html += _emptyRow('Cap reserva suspesa. ✅');
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>ID Reserva</th><th>Màquina</th><th>Data</th><th>Hora</th><th>Usuari</th><th>Grup/Projecte</th><th></th>' +
        '</tr></thead><tbody>';

      reservesSuspeses
        .sort(function (a, b) { return (a['Data_Reserva'] || '') > (b['Data_Reserva'] || '') ? 1 : -1; })
        .forEach(function (r) {
          const esFutura  = r['Data_Reserva'] >= avui;
          const accio     = esFutura
            ? '<button class="btn-primary btn-sm btn-confirm-res" data-maquina="' + _esc(r['ID_Maquina'] || '') + '">✅ Confirmar</button>'
            : '<span style="font-size:.75rem;color:#dc2626;font-weight:600;">⚠️ Data passada — cal reprogramar</span>';

          html += '<tr>' +
            '<td style="font-size:.78rem;color:var(--col-text-muted);">' + _esc(r['ID_Reserva'] || '') + '</td>' +
            '<td><strong>' + _esc(r['ID_Maquina'] || '—') + '</strong></td>' +
            '<td style="white-space:nowrap;">' +
              (esFutura
                ? _formatData(r['Data_Reserva'])
                : '<span style="color:#dc2626;">' + _formatData(r['Data_Reserva']) + '</span>') +
            '</td>' +
            '<td style="white-space:nowrap;font-variant-numeric:tabular-nums;">' +
              _esc(r['Hora_Inici'] || '') + ' – ' + _esc(r['Hora_Fi'] || '') +
            '</td>' +
            '<td style="font-size:.82rem;">' + _esc(r['Nom_Usuari'] || r['Email_Usuari'] || '—') + '</td>' +
            '<td>' + _esc(r['Grup_Projecte'] || '—') + '</td>' +
            '<td style="text-align:right;">' + accio + '</td>' +
          '</tr>';
        });

      html += '</tbody></table></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:.75rem;">' +
          '<button class="btn-secondary btn-sm" id="btn-resol-totes">Resol totes les suspeses</button>' +
        '</div>';
    }
    html += '</div>';

    cos.innerHTML = html;

    // ── Listeners ──

    cos.querySelectorAll('.btn-resolt-maq').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _marcaResolta(btn.dataset.id, btn);
      });
    });

    cos.querySelectorAll('.btn-confirm-res').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _resolReservesMaquina(btn.dataset.maquina, btn);
      });
    });

    const btnResolTotes = cos.querySelector('#btn-resol-totes');
    if (btnResolTotes) {
      btnResolTotes.addEventListener('click', function () {
        _resolTotesSuspeses(btnResolTotes);
      });
    }
  }

  // ── Accions ───────────────────────────────────────────────

  async function _marcaResolta(maquinaId, btn) {
    if (!confirm('Marcar ' + maquinaId + ' com a Operativa i reactivar les reserves suspeses?')) return;

    btn.disabled    = true;
    btn.textContent = '…';

    try {
      await API.maquines.updateEstat(maquinaId, 'Operativa', 'Resolt des del dashboard');
      await API.call('resolReservesSuspeses', { maquina_id: maquinaId });
      Toast.ok('Màquina ' + maquinaId + ' marcada com a operativa. Reserves reactivades.');
      await _carrega();
    } catch (err) {
      Toast.error('Error: ' + err.message);
      btn.disabled    = false;
      btn.textContent = '✅ Marcar com a resolta';
    }
  }

  async function _resolReservesMaquina(maquinaId, btn) {
    btn.disabled    = true;
    btn.textContent = '…';
    try {
      await API.call('resolReservesSuspeses', { maquina_id: maquinaId });
      Toast.ok('Reserves suspeses de ' + maquinaId + ' reactivades.');
      await _carrega();
    } catch (err) {
      Toast.error('Error: ' + err.message);
      btn.disabled    = false;
      btn.textContent = '✅ Confirmar';
    }
  }

  async function _resolTotesSuspeses(btn) {
    if (!confirm('Resol totes les reserves suspeses? Les futures es confirmaran, les passades es cancel·laran.')) return;
    btn.disabled    = true;
    btn.textContent = '…';
    try {
      const res = await API.call('resolReservesSuspeses', {});
      Toast.ok('Resoltes ' + (res.resolt || 0) + ' reserves suspeses.');
      await _carrega();
    } catch (err) {
      Toast.error('Error: ' + err.message);
      btn.disabled    = false;
      btn.textContent = 'Resol totes les suspeses';
    }
  }

  // ── Components HTML ───────────────────────────────────────

  function _metricCard(icon, titol, valor, desc, bgColor, textColor) {
    return '<div class="card" style="border-left:4px solid ' + textColor + ';">' +
      '<div style="display:flex;align-items:center;gap:.625rem;margin-bottom:.4rem;">' +
        '<span style="font-size:1.3rem;">' + icon + '</span>' +
        '<span style="font-size:.78rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--col-text-muted);">' + _esc(titol) + '</span>' +
      '</div>' +
      '<p style="font-size:2rem;font-weight:800;color:' + textColor + ';line-height:1;">' + _esc(String(valor)) + '</p>' +
      '<p style="font-size:.78rem;color:var(--col-text-muted);margin-top:.3rem;">' + _esc(desc) + '</p>' +
    '</div>';
  }

  function _seccioHeader(titol, count) {
    return '<h3 style="font-size:.82rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
           'color:var(--col-text-muted);margin-bottom:.75rem;">' + _esc(titol) +
           ' <span style="font-weight:400;opacity:.7;">(' + count + ')</span></h3>';
  }

  function _emptyRow(msg) {
    return '<div class="card" style="padding:.875rem 1rem;">' +
      '<p style="font-size:.875rem;color:var(--col-text-muted);">' + _esc(msg) + '</p>' +
    '</div>';
  }

  // ── Utilitats ─────────────────────────────────────────────

  function _avuiStr() {
    const d  = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function _avuiLabel() {
    return new Date().toLocaleDateString('ca-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function _formatData(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

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
  MODULES['dashboard'] = ModulDashboard;
}

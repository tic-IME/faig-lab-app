/* ============================================================
   FAIG Lab — Mòdul Calendari setmanal
   ============================================================ */

window.ModulCalendari = (function () {

  const TALLERS   = ['Taller 1', 'Taller 2'];
  const DIES_NOM  = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'];
  const HORA_INICI = 8;
  const HORA_FINAL = 16;

  let _container    = null;
  let _offsetSetmana = 0;   // 0 = setmana actual, -1 = anterior, +1 = següent
  let _horaris      = {};   // { 'Taller 1': [...], 'Taller 2': [...] }
  let _reserves     = [];

  // ── init ──────────────────────────────────────────────────

  async function init(container) {
    _container = container;
    _offsetSetmana = 0;
    await _carrega();
  }

  // ── Càrrega de dades ──────────────────────────────────────

  async function _carrega() {
    _renderEsquelet();
    _setLoading(true);

    try {
      const [dilluns] = _diesSetmana();

      const [hor1, hor2, reservesRaw] = await Promise.all([
        API.horari.getSetmana(TALLERS[0]),
        API.horari.getSetmana(TALLERS[1]),
        API.reserves.get({ data: _dateStr(dilluns) }),
      ]);

      _horaris  = { [TALLERS[0]]: hor1 || [], [TALLERS[1]]: hor2 || [] };
      _reserves = reservesRaw || [];
      console.log('RESERVES CARREGADES:', _reserves);

      _renderSetmana();
    } catch (err) {
      Toast.error('Error carregant el calendari: ' + err.message);
      _setLoading(false);
    }
  }

  // ── Esquelet HTML ─────────────────────────────────────────

  function _renderEsquelet() {
    const dies   = _diesSetmana();
    const label  = _labelSetmana(dies);

    _container.innerHTML =
      '<div class="module-header">' +
        '<div class="module-header-left">' +
          '<h2 class="module-title">Calendari FAIG Lab</h2>' +
          '<p class="module-subtitle" id="cal-subtitle">' + label + '</p>' +
        '</div>' +
        '<div class="module-header-actions">' +
          '<button class="btn-secondary btn-sm" id="btn-setmana-ant">← Anterior</button>' +
          '<button class="btn-secondary btn-sm" id="btn-setmana-seg">Següent →</button>' +
        '</div>' +
      '</div>' +
      '<div id="cal-body"><div class="spinner-wrap"><div class="spinner"></div></div></div>';

    document.getElementById('btn-setmana-ant').addEventListener('click', function () {
      _offsetSetmana--;
      _carrega();
    });
    document.getElementById('btn-setmana-seg').addEventListener('click', function () {
      _offsetSetmana++;
      _carrega();
    });
  }

  // ── Render principal ──────────────────────────────────────

  function _renderSetmana() {
    const dies  = _diesSetmana();
    const label = _labelSetmana(dies);
    const sub   = document.getElementById('cal-subtitle');
    if (sub) sub.textContent = label;

    const franges = _generaFranges();
    let html = '';

    TALLERS.forEach(function (taller) {
      html += '<div class="card" style="margin-bottom:1.25rem;overflow:hidden;">' +
        '<div class="card-header"><span class="card-title">🏭 ' + taller + '</span>' +
          '<span style="font-size:.8rem;color:var(--col-text-muted);">' +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#bfdbfe;margin-right:4px;"></span>Classe ' +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#bbf7d0;margin:0 4px 0 8px;"></span>Reserva ' +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fef08a;margin:0 4px 0 8px;"></span>Solapament' +
          '</span>' +
        '</div>' +
        '<div class="table-wrap" style="border:none;border-radius:0;">' +
          '<table>' +
            '<thead><tr>' +
              '<th style="width:68px;">Hora</th>' +
              dies.map(function (d) {
                return '<th>' + DIES_NOM[d.getDay() - 1] + '<br><small style="font-weight:400;opacity:.7;">' + _dateLabel(d) + '</small></th>';
              }).join('') +
            '</tr></thead>' +
            '<tbody>';

      franges.forEach(function (hora) {
        html += '<tr>';
        html += '<td style="font-size:.78rem;color:var(--col-text-muted);white-space:nowrap;">' + hora + '</td>';
        dies.forEach(function (dia) {
          html += _getCella(taller, dia, hora);
        });
        html += '</tr>';
      });

      html += '</tbody></table></div></div>';
    });

    const body = document.getElementById('cal-body');
    if (body) body.innerHTML = html;

    // Event listeners a les cel·les clicables
   // Calendari només informatiu - reserves es fan des del mòdul Reserves
  }

  // ── Cel·la ────────────────────────────────────────────────

  function _getCella(taller, dia, hora) {
    const diaStr    = _dateStr(dia);
    const diaNom    = DIES_NOM[dia.getDay() - 1];
    const horaFi    = _horaFi(hora);

    const teClasse  = _horaris[taller].some(function (h) {
      return h['Dia_Nom'] === diaNom &&
             _timesOverlap(h['Hora_inici'], h['Hora_final'], hora, horaFi);
    });

    const teReserva = _reserves.some(function (r) {
      console.log('DATA:', r['Data_Reserva'], 'TOKEN:', r['Token_Permis'], 'HORA_I:', r['Hora_Inici'], 'HORA_F:', r['Hora_Final'], 'hora:', hora, 'horaFi:', horaFi);
      return r['Data_Reserva'] === diaStr &&
             _ubicacioEsTaller(r['Token_Permis'] || r['ID_Maquina'], taller) &&
             ['confirmada', 'aprovada', 'pendent_permis'].indexOf(r['Estat_Reserva']) !== -1 &&
             _timesOverlap(r['Hora_Inici'], r['Hora_Final'], hora, horaFi)
});
    const reservaObj = teReserva
      ? _reserves.find(function (r) {
          return r['Data_Reserva'] === diaStr &&
                 _ubicacioEsTaller(r['Token_Permis'] || r['ID_Maquina'], taller) &&
                 ['confirmada', 'aprovada', 'pendent_permis'].indexOf(r['Estat_Reserva']) !== -1 &&
                 _timesOverlap(r['Hora_Inici'], r['Hora_Final'], hora, horaFi);
        })
      : null;

    const classeObj = teClasse
      ? _horaris[taller].find(function (h) {
          return h['Dia_Nom'] === diaNom &&
                 _timesOverlap(h['Hora_inici'], h['Hora_final'], hora, horaFi);
        })
      : null;

    // Solapament
    if (teClasse && teReserva) {
      return '<td style="background:#fef9c3;font-size:.72rem;padding:.3rem .5rem;vertical-align:top;">' +
             '<span title="Solapament classe + reserva">⚠️ Solapament</span>' +
             '<br><small style="opacity:.8;">' + (classeObj['Assignatura_Grup'] || '') + '</small>' +
             '<br><small style="opacity:.8;">' + (reservaObj['Grup_Projecte'] || reservaObj['Nom_Usuari'] || '') + '</small>' +
             '</td>';
    }

    // Classe programada
    if (teClasse && classeObj && classeObj['Assignatura_Grup']) {
      return '<td style="background:#dbeafe;font-size:.72rem;padding:.3rem .5rem;vertical-align:top;">' +
             '<strong style="color:#1e40af;">' + (classeObj['Assignatura_Grup'] || '') + '</strong>' +
             '<br><small style="color:#1e40af;opacity:.8;">' + (classeObj['Professor_titular'] || '') + '</small>' +
             '</td>';
    }

    // Reserva activa
    if (teReserva) {
      const estatCls = 'reserva-' + (reservaObj['Estat_Reserva'] || 'confirmada').replace(/[^a-z]/g, '');
      return '<td style="background:#dcfce7;font-size:.72rem;padding:.3rem .5rem;vertical-align:top;">' +
             '<strong style="color:#166534;">' + (reservaObj['Grup_Projecte'] || '—') + '</strong>' +
             '<br><small style="color:#166534;opacity:.8;">' + (reservaObj['Nom_Usuari'] || '') + '</small>' +
             '<br><span class="reserva-badge ' + estatCls + '" style="margin-top:2px;">' + (reservaObj['Estat_Reserva'] || '') + '</span>' +
             '</td>';
    }

    // Buida i clicable
    const dataAttr = 'data-taller="' + _esc(taller) + '" data-dia="' + diaStr + '" data-hora="' + hora + '"';
    return '<td class="cal-cel-buida" ' + dataAttr +
           ' style="cursor:pointer;transition:background .15s;" ' +
           'onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\'\'">' +
           '</td>';
  }

  // ── Modal nova reserva ─────────────────────────────────────

  function _obreModalReserva(taller, diaStr, hora) {
    const horaFi = _horaFi(hora);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal-card" style="max-width:440px;">' +
        '<div class="modal-header">' +
          '<span class="modal-title">Nova reserva</span>' +
          '<button class="modal-close" id="modal-close-btn">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Taller</label>' +
            '<input type="text" value="' + _esc(taller) + '" readonly style="opacity:.7;">' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="date" id="res-data" value="' + diaStr + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Hora inici</label>' +
              '<input type="time" id="res-hora-ini" value="' + hora + '">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Hora final</label>' +
            '<input type="time" id="res-hora-fi" value="' + horaFi + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Grup / Projecte</label>' +
            '<input type="text" id="res-grup" placeholder="Ex: 3r ESO — Projecte Robot">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descripció (opcional)</label>' +
            '<textarea id="res-desc" placeholder="Descriu breument l\'ús previst..."></textarea>' +
          '</div>' +
          '<p id="res-error" class="form-error" style="display:none;"></p>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-secondary" id="res-cancel-btn">Cancel·la</button>' +
          '<button class="btn-primary" id="res-submit-btn">Crear reserva</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    function _tanca() { backdrop.remove(); }

    backdrop.getElementById = function (id) { return backdrop.querySelector('#' + id); };

    backdrop.querySelector('#modal-close-btn').addEventListener('click', _tanca);
    backdrop.querySelector('#res-cancel-btn').addEventListener('click', _tanca);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) _tanca(); });

    backdrop.querySelector('#res-submit-btn').addEventListener('click', async function () {
      const btn     = backdrop.querySelector('#res-submit-btn');
      const errEl   = backdrop.querySelector('#res-error');
      const data    = backdrop.querySelector('#res-data').value;
      const horaIni = backdrop.querySelector('#res-hora-ini').value;
      const horaFi2 = backdrop.querySelector('#res-hora-fi').value;
      const grup    = backdrop.querySelector('#res-grup').value.trim();

      errEl.style.display = 'none';

      if (!data || !horaIni || !horaFi2) {
        errEl.textContent  = 'Omple tots els camps obligatoris.';
        errEl.style.display = '';
        return;
      }
      if (horaIni >= horaFi2) {
        errEl.textContent  = 'L\'hora final ha de ser posterior a l\'hora d\'inici.';
        errEl.style.display = '';
        return;
      }

      btn.disabled    = true;
      btn.textContent = 'Creant…';

      try {
        const usuari = Auth.getUser();
        await API.reserves.create(
          taller, data, horaIni, horaFi2,
          usuari ? usuari.nom : '',
          grup
        );
        Toast.ok('Reserva creada correctament!');
        _tanca();
        _carrega();
      } catch (err) {
        errEl.textContent   = err.message || 'Error creant la reserva.';
        errEl.style.display = '';
        btn.disabled        = false;
        btn.textContent     = 'Crear reserva';
      }
    });
  }

  // ── Utilitats de data ─────────────────────────────────────

  function _diesSetmana() {
    const avui    = new Date();
    const dia     = avui.getDay();                            // 0=dg, 1=dl…
    const diffDl  = dia === 0 ? -6 : 1 - dia;               // dies fins dilluns
    const dilluns = new Date(avui);
    dilluns.setDate(avui.getDate() + diffDl + _offsetSetmana * 7);
    dilluns.setHours(0, 0, 0, 0);

    return [0, 1, 2, 3, 4].map(function (i) {
      const d = new Date(dilluns);
      d.setDate(dilluns.getDate() + i);
      return d;
    });
  }

  function _dateStr(d) {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function _dateLabel(d) {
    return d.getDate() + '/' + (d.getMonth() + 1);
  }

  function _labelSetmana(dies) {
    return 'Setmana del ' + _dateLabel(dies[0]) + ' al ' + _dateLabel(dies[4]) + '/' + dies[4].getFullYear();
  }

  function _generaFranges() {
    const franges = [];
    for (let h = HORA_INICI; h < HORA_FINAL; h++) {
      franges.push(String(h).padStart(2, '0') + ':00');
      franges.push(String(h).padStart(2, '0') + ':30');
    }
    return franges;
  }

  function _horaFi(hora) {
    const [h, m] = hora.split(':').map(Number);
    const totalMin = h * 60 + m + 30;
    return String(Math.floor(totalMin / 60)).padStart(2, '0') + ':' + String(totalMin % 60).padStart(2, '0');
  }

  function _timesOverlap(ini1, fi1, ini2, fi2) {
    return ini1 < fi2 && fi1 > ini2;
  }

  function _ubicacioEsTaller(ubicacio, taller) {
    if (!ubicacio) return false;
    return String(ubicacio).toLowerCase().indexOf(taller.toLowerCase()) !== -1;
  }

  function _setLoading(on) {
    const body = document.getElementById('cal-body');
    if (body && on) body.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  }

  function _esc(str) {
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── API pública ───────────────────────────────────────────

  return { init };

})();

// Registra el mòdul
if (window.MODULES !== undefined) {
  MODULES['calendari'] = ModulCalendari;
}

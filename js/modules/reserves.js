/* ============================================================
   FAIG Lab — Mòdul Reserves
   ============================================================ */

window.ModulReserves = (function () {

  const ESTATS_ORDRE = ['confirmada', 'aprovada', 'pendent_permís', 'suspesa', 'denegada', 'cancel·lada'];

  let _container = null;
  let _reserves  = [];
  let _maquines  = [];
  let _filtreEstat = '';

  // ── init ──────────────────────────────────────────────────

  async function init(container) {
    _container   = container;
    _filtreEstat = '';
    await _carrega();
  }

  // ── Càrrega ───────────────────────────────────────────────

  async function _carrega() {
    _renderEsquelet();

    try {
      const [reservesRaw, maquinesRaw] = await Promise.all([
        API.reserves.get({}),
        API.maquines.getAll(),
      ]);

      _maquines = maquinesRaw || [];
      const usuari = Auth.getUser();

      _reserves = (reservesRaw || []).filter(function (r) {
        if (Auth.isAdmin()) return true;
        return r['Email_Usuari'] === usuari.email;
      });

      _renderReserves();
    } catch (err) {
      Toast.error('Error carregant les reserves: ' + err.message);
      const cos = document.getElementById('res-body');
      if (cos) cos.innerHTML = '<div class="empty-state"><p class="empty-state-desc">No s\'han pogut carregar les dades.</p></div>';
    }
  }

  // ── Esquelet ──────────────────────────────────────────────

  function _renderEsquelet() {
    const isAdmin = Auth.isAdmin();

    let filtre = '';
    if (isAdmin) {
      filtre = '<select id="res-filtre-estat" class="btn-secondary btn-sm" style="padding:.3rem .6rem;font-size:.82rem;">' +
        '<option value="">Tots els estats</option>' +
        ESTATS_ORDRE.map(function (e) {
          return '<option value="' + e + '"' + (_filtreEstat === e ? ' selected' : '') + '>' + _capitFirst(e) + '</option>';
        }).join('') +
        '</select>';
    }

    _container.innerHTML =
      '<div class="module-header">' +
        '<div class="module-header-left">' +
          '<h2 class="module-title">Reserves</h2>' +
          '<p class="module-subtitle">' + (isAdmin ? 'Totes les reserves del sistema' : 'Les teves reserves') + '</p>' +
        '</div>' +
        '<div class="module-header-actions">' +
          filtre +
          '<button class="btn-primary btn-sm" id="btn-nova-reserva">+ Nova reserva</button>' +
        '</div>' +
      '</div>' +
      '<div id="res-body"><div class="spinner-wrap"><div class="spinner"></div></div></div>';

    document.getElementById('btn-nova-reserva').addEventListener('click', function () {
      _obreModalReserva();
    });

    if (isAdmin) {
      document.getElementById('res-filtre-estat').addEventListener('change', function () {
        _filtreEstat = this.value;
        _renderReserves();
      });
    }
  }

  // ── Render llista ─────────────────────────────────────────

  function _renderReserves() {
    const cos    = document.getElementById('res-body');
    if (!cos) return;

    let llista = _reserves.slice();
    if (_filtreEstat) {
      llista = llista.filter(function (r) { return r['Estat_Reserva'] === _filtreEstat; });
    }

    if (llista.length === 0) {
      cos.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-state-icon">🔖</span>' +
          '<p class="empty-state-title">Cap reserva trobada</p>' +
          '<p class="empty-state-desc">Crea una nova reserva des del botó superior o des del Calendari.</p>' +
        '</div>';
      return;
    }

    // Agrupa per estat
    const grups = {};
    ESTATS_ORDRE.forEach(function (e) { grups[e] = []; });

    llista.forEach(function (r) {
      const estat = r['Estat_Reserva'] || 'confirmada';
      if (!grups[estat]) grups[estat] = [];
      grups[estat].push(r);
    });

    let html = '';
    ESTATS_ORDRE.forEach(function (estat) {
      const grup = grups[estat];
      if (!grup || grup.length === 0) return;

      // Ordena per data desc
      grup.sort(function (a, b) {
        return (b['Data_Reserva'] || '') > (a['Data_Reserva'] || '') ? 1 : -1;
      });

      html += '<div style="margin-bottom:1.5rem;">' +
        '<h3 style="font-size:.8rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
             'color:var(--col-text-muted);margin-bottom:.6rem;">' + _capitFirst(estat) +
             ' <span style="font-weight:400;opacity:.7;">(' + grup.length + ')</span></h3>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr>' +
          '<th>Màquina</th>' +
          '<th>Data</th>' +
          '<th>Hora</th>' +
          '<th>Grup / Projecte</th>' +
          (Auth.isAdmin() ? '<th>Usuari</th>' : '') +
          '<th>Estat</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody>';

      grup.forEach(function (r) {
        const nomMaquina = _nomMaquina(r['ID_Maquina']);
        const esFutura   = r['Data_Reserva'] >= _avuiStr();
        const potCancel  = esFutura && ['confirmada', 'aprovada', 'pendent_permís'].indexOf(r['Estat_Reserva']) !== -1;
        const estatCls   = 'reserva-' + (r['Estat_Reserva'] || '').replace(/[^a-z]/g, '');

        html += '<tr>' +
          '<td><strong>' + _esc(nomMaquina) + '</strong></td>' +
          '<td style="white-space:nowrap;">' + _formatData(r['Data_Reserva']) + '</td>' +
          '<td style="white-space:nowrap;font-variant-numeric:tabular-nums;">' +
            _esc(r['Hora_Inici'] || '') + ' – ' + _esc(r['Hora_Fi'] || '') +
          '</td>' +
          '<td>' + _esc(r['Grup_Projecte'] || '—') + '</td>' +
          (Auth.isAdmin() ? '<td style="font-size:.8rem;color:var(--col-text-muted);">' + _esc(r['Nom_Usuari'] || r['Email_Usuari'] || '') + '</td>' : '') +
          '<td><span class="reserva-badge ' + estatCls + '">' + _esc(r['Estat_Reserva'] || '') + '</span></td>' +
          '<td style="text-align:right;">' +
            (potCancel
              ? '<button class="btn-danger btn-sm btn-cancel-res" data-id="' + _esc(r['ID_Reserva']) + '">Cancel·la</button>'
              : '') +
          '</td>' +
        '</tr>';
      });

      html += '</tbody></table></div></div>';
    });

    cos.innerHTML = html;

    cos.querySelectorAll('.btn-cancel-res').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _cancellaReserva(btn.dataset.id, btn);
      });
    });
  }

  // ── Cancel·lar reserva ────────────────────────────────────

  async function _cancellaReserva(id, btn) {
    if (!confirm('Segur que vols cancel·lar aquesta reserva?')) return;
    btn.disabled    = true;
    btn.textContent = '…';
    try {
      await API.reserves.cancel(id);
      Toast.ok('Reserva cancel·lada.');
      await _carrega();
    } catch (err) {
      Toast.error('Error cancel·lant: ' + err.message);
      btn.disabled    = false;
      btn.textContent = 'Cancel·la';
    }
  }

  // ── Modal nova reserva ────────────────────────────────────

  function _obreModalReserva(maquinaId, dataInicial, horaInicial) {
    const opcMaquines = _maquines.map(function (m) {
      const sel = maquinaId && m['ID_Maquina'] === maquinaId ? ' selected' : '';
      return '<option value="' + _esc(m['ID_Maquina']) + '"' + sel + '>' +
             _esc(m['ID_Maquina'] + ' — ' + (m['Tipus_Maquina'] || '') + ' (' + (m['Ubicació'] || '') + ')') +
             '</option>';
    }).join('');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<span class="modal-title">Nova reserva</span>' +
          '<button class="modal-close" id="modal-close-btn">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Màquina *</label>' +
            '<select id="res-maquina">' +
              '<option value="">— Selecciona màquina —</option>' + opcMaquines +
            '</select>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Data *</label>' +
              '<input type="date" id="res-data" value="' + (dataInicial || _avuiStr()) + '" min="' + _avuiStr() + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Hora inici *</label>' +
              '<input type="time" id="res-hora-ini" value="' + (horaInicial || '08:00') + '" min="08:00" max="15:30" step="1800">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Hora final *</label>' +
            '<input type="time" id="res-hora-fi" value="' + _horaFi(horaInicial || '08:00') + '" min="08:30" max="16:00" step="1800">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Grup / Projecte *</label>' +
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

    // Auto actualitza hora fi quan canvia hora ini
    backdrop.querySelector('#res-hora-ini').addEventListener('change', function () {
      backdrop.querySelector('#res-hora-fi').value = _horaFi(this.value);
    });

    function _tanca() { backdrop.remove(); }
    backdrop.querySelector('#modal-close-btn').addEventListener('click', _tanca);
    backdrop.querySelector('#res-cancel-btn').addEventListener('click', _tanca);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) _tanca(); });

    backdrop.querySelector('#res-submit-btn').addEventListener('click', async function () {
      const btn      = backdrop.querySelector('#res-submit-btn');
      const errEl    = backdrop.querySelector('#res-error');
      const maquina  = backdrop.querySelector('#res-maquina').value;
      const data     = backdrop.querySelector('#res-data').value;
      const horaIni  = backdrop.querySelector('#res-hora-ini').value;
      const horaFi2  = backdrop.querySelector('#res-hora-fi').value;
      const grup     = backdrop.querySelector('#res-grup').value.trim();

      errEl.style.display = 'none';

      if (!maquina || !data || !horaIni || !horaFi2 || !grup) {
        errEl.textContent   = 'Omple tots els camps obligatoris (*).';
        errEl.style.display = '';
        return;
      }
      if (horaIni >= horaFi2) {
        errEl.textContent   = 'L\'hora final ha de ser posterior a l\'hora d\'inici.';
        errEl.style.display = '';
        return;
      }

      btn.disabled    = true;
      btn.textContent = 'Creant…';

      try {
        const usuari = Auth.getUser();
        const result = await API.reserves.create(
          maquina, data, horaIni, horaFi2,
          usuari ? usuari.nom : '',
          grup
        );

        if (result && result.estat === 'pendent_permís') {
          Toast.warning('Reserva creada — pendent de permís. Rebràs un correu quan sigui aprovada.');
        } else {
          Toast.ok('Reserva creada correctament!');
        }
        _tanca();
        await _carrega();
      } catch (err) {
        errEl.textContent   = err.message || 'Error creant la reserva.';
        errEl.style.display = '';
        btn.disabled        = false;
        btn.textContent     = 'Crear reserva';
      }
    });
  }

  // ── Utilitats ─────────────────────────────────────────────

  function _nomMaquina(id) {
    const m = _maquines.find(function (m) { return m['ID_Maquina'] === id; });
    return m ? (id + ' — ' + (m['Tipus_Maquina'] || '')) : (id || '—');
  }

  function _avuiStr() {
    const d  = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function _formatData(str) {
    if (!str) return '—';
    const [yyyy, mm, dd] = str.split('-');
    return dd + '/' + mm + '/' + yyyy;
  }

  function _horaFi(hora) {
    if (!hora) return '08:30';
    const [h, m] = hora.split(':').map(Number);
    const total  = h * 60 + m + 30;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  function _capitFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── API pública ───────────────────────────────────────────

  return { init };

})();

if (window.MODULES !== undefined) {
  MODULES['reserves'] = ModulReserves;
}

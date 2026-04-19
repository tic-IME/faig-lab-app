/* =====================================================
   FAIG Lab — Mòdul Reserves (amb checklist seguretat)
   ===================================================== */

window.ModulReserves = (function () {
  'use strict';

  const COLORS = {
    laser:       '#e74c3c',
    impressio3d: '#3498db',
    ploter:      '#9b59b6',
    brodadora:   '#e67e22',
    escaner:     '#27ae60',
    default:     '#7f8c8d',
  };

  let _container  = null;
  let _calendar   = null;
  let _pendingRes = null;

  // ══════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════
  function init(container) {
    _container = container;
    _renderHTML();
    _initCalendar();
  }

  function _renderHTML() {
    _container.innerHTML = `
      <div class="reserves-wrap p-3">
        <h2 class="mb-1">Reserves de maquinari</h2>
        <p class="text-muted mb-3">Selecciona una franja horària per crear una reserva.</p>
        <div id="reserves-calendar"></div>
      </div>

      <!-- Modal checklist seguretat -->
      <div class="modal fade" id="checklist-modal" tabindex="-1" aria-hidden="true"
           data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header bg-warning-subtle">
              <h5 class="modal-title">
                <i class="bi bi-shield-check me-2"></i>Protocol de seguretat
              </h5>
            </div>
            <div class="modal-body" id="checklist-body"></div>
            <div class="modal-footer flex-column align-items-stretch gap-2">
              <div id="checklist-notes-wrap" class="d-none">
                <label for="checklist-notes" class="form-label fw-semibold">Notes opcionals:</label>
                <textarea id="checklist-notes" class="form-control" rows="2"
                          placeholder="Material, projecte, observacions…"></textarea>
              </div>
              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary"
                        id="btn-checklist-cancel">Cancel·lar</button>
                <button type="button" class="btn btn-primary" disabled
                        id="btn-checklist-ok">Confirmar reserva</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal genèric (selector màquina / detall reserva) -->
      <div class="modal fade" id="res-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="res-modal-title">Reserva</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="res-modal-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary"
                      data-bs-dismiss="modal">Tancar</button>
              <button type="button" class="btn btn-primary" id="res-modal-ok">Continuar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-checklist-cancel').addEventListener('click', function () {
      _hideModal('checklist-modal');
      _pendingRes = null;
      _calendar && _calendar.unselect();
    });
    document.getElementById('btn-checklist-ok').addEventListener('click', _submitReserva);
  }

  // ══════════════════════════════════════════════════
  //  FULLCALENDAR
  // ══════════════════════════════════════════════════
  function _initCalendar() {
    const el = document.getElementById('reserves-calendar');
    if (!el || typeof FullCalendar === 'undefined') {
      console.warn('[Reserves] FullCalendar no disponible.');
      return;
    }
    _calendar = new FullCalendar.Calendar(el, {
      locale:       'ca',
      initialView:  'timeGridWeek',
      slotMinTime:  '08:00:00',
      slotMaxTime:  '21:00:00',
      allDaySlot:   false,
      nowIndicator: true,
      selectable:   true,
      selectMirror: true,
      headerToolbar: {
        left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay',
      },
      buttonText: { today: 'Avui', week: 'Setmana', day: 'Dia' },
      select:     _onSlotSelect,
      eventClick: _onEventClick,
      events:     _fetchEvents,
    });
    _calendar.render();
  }

  function _fetchEvents(info, successCb, failureCb) {
    API.call('getReserves', { start: info.startStr, end: info.endStr })
      .then(function (res) {
        if (!res.ok) { failureCb(res.error || 'Error'); return; }
        successCb((res.reserves || []).map(function (r) {
          return {
            id:              r.id,
            title:           (r.maquina || '') + (r.usuari ? ' · ' + r.usuari : ''),
            start:           r.inici,
            end:             r.fi,
            backgroundColor: COLORS[_slug(r.maquina)] || COLORS.default,
            borderColor:     'transparent',
            extendedProps:   r,
          };
        }));
      })
      .catch(failureCb);
  }

  // ── Selecció franja nova ───────────────────────────
  function _onSlotSelect(info) {
    _pendingRes = { inici: info.startStr, fi: info.endStr };

    document.getElementById('res-modal-title').textContent = 'Nova reserva';
    document.getElementById('res-modal-body').innerHTML = `
      <p><strong>Franja:</strong> ${_fmt(info.start)} – ${_fmtHora(info.end)}</p>
      <label class="form-label mt-2">Màquina:</label>
      <select id="sel-maquina" class="form-select">
        <option value="">— Escull una màquina —</option>
        <option value="laser">Talladora làser</option>
        <option value="impressio3d">Impressora 3D</option>
        <option value="ploter">Plòter de tall</option>
        <option value="brodadora">Brodadora</option>
        <option value="escaner">Escàner 3D</option>
      </select>
    `;
    document.getElementById('res-modal-ok').onclick = function () {
      const maq = document.getElementById('sel-maquina').value;
      if (!maq) { alert('Has de seleccionar una màquina.'); return; }
      _pendingRes.maquina_id = maq;
      _hideModal('res-modal');
      _openChecklist(maq);
    };
    _showModal('res-modal');
  }

  // ── Clic reserva existent ──────────────────────────
  function _onEventClick(info) {
    const r   = info.event.extendedProps;
    const usr = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const pot = usr && (usr.nivell === 'ADMIN' || usr.email === r.email);

    document.getElementById('res-modal-title').textContent = 'Detall de reserva';
    document.getElementById('res-modal-body').innerHTML = `
      <dl class="row small mb-0">
        <dt class="col-5">Màquina</dt><dd class="col-7">${r.maquina || '—'}</dd>
        <dt class="col-5">Usuari</dt> <dd class="col-7">${r.usuari  || '—'}</dd>
        <dt class="col-5">Inici</dt>  <dd class="col-7">${_fmt(new Date(r.inici))}</dd>
        <dt class="col-5">Fi</dt>     <dd class="col-7">${_fmtHora(new Date(r.fi))}</dd>
        <dt class="col-5">Notes</dt>  <dd class="col-7">${r.notes  || '—'}</dd>
      </dl>
      ${pot ? `<button class="btn btn-sm btn-danger mt-3" id="btn-cancel-res">Cancel·lar reserva</button>` : ''}
    `;
    document.getElementById('res-modal-ok').textContent = 'Tancar';
    document.getElementById('res-modal-ok').onclick = function () { _hideModal('res-modal'); };

    if (pot) {
      document.getElementById('btn-cancel-res').addEventListener('click', function () {
        if (!confirm('Segur que vols cancel·lar aquesta reserva?')) return;
        API.call('cancelReserva', { id: info.event.id }).then(function (res) {
          _hideModal('res-modal');
          if (res.ok) { _toast('Reserva cancel·lada.', 'success'); _calendar.refetchEvents(); }
          else { _toast(res.error || 'Error.', 'danger'); }
        });
      });
    }
    _showModal('res-modal');
  }

  // ══════════════════════════════════════════════════
  //  CHECKLIST
  // ══════════════════════════════════════════════════
  function _openChecklist(maquinaId) {
    const body  = document.getElementById('checklist-body');
    const btnOk = document.getElementById('btn-checklist-ok');
    body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning"></div></div>';
    btnOk.disabled = true;
    document.getElementById('checklist-notes-wrap').classList.add('d-none');
    _showModal('checklist-modal');

    API.protocols.get(maquinaId)
      .then(function (res) {
        if (!res.ok || !res.items || !res.items.length) {
          body.innerHTML = '<p class="text-danger">No s\'ha pogut carregar el protocol.</p>';
          return;
        }
        _renderItems(res.maquina, res.items);
      })
      .catch(function () {
        body.innerHTML = '<p class="text-danger">Error de connexió.</p>';
      });
  }

  function _renderItems(nomMaquina, items) {
    const body  = document.getElementById('checklist-body');
    const btnOk = document.getElementById('btn-checklist-ok');
    document.getElementById('checklist-notes-wrap').classList.remove('d-none');

    body.innerHTML = `
      <p class="text-muted mb-3">
        Abans de confirmar la reserva de <strong>${nomMaquina}</strong>,
        has d'acceptar tots els punts del protocol:
      </p>
      <div class="list-group list-group-flush">
        ${items.map(function (item, i) {
          const titol = item.titol || item;
          const desc  = item.descripcio || '';
          return `
          <label class="list-group-item list-group-item-action d-flex gap-3 py-3" for="chk-${i}">
            <input class="form-check-input flex-shrink-0 checklist-cb" type="checkbox" id="chk-${i}">
            <span>
              <strong class="d-block">${titol}</strong>
              ${desc ? `<small class="text-muted">${desc}</small>` : ''}
            </span>
          </label>`;
        }).join('')}
      </div>
      <div class="mt-3 d-flex align-items-center gap-2">
        <div class="progress flex-grow-1" style="height:8px">
          <div class="progress-bar bg-success" id="chk-progress" style="width:0%"></div>
        </div>
        <small class="text-muted" id="chk-counter">0 / ${items.length}</small>
      </div>
    `;

    document.querySelectorAll('.checklist-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const checked = document.querySelectorAll('.checklist-cb:checked').length;
        document.getElementById('chk-progress').style.width = Math.round(checked / items.length * 100) + '%';
        document.getElementById('chk-counter').textContent  = checked + ' / ' + items.length;
        btnOk.disabled = (checked < items.length);
      });
    });
  }

  function _submitReserva() {
    const btnOk = document.getElementById('btn-checklist-ok');
    btnOk.disabled = true;
    btnOk.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardant…';

    const notes = (document.getElementById('checklist-notes') || {}).value || '';
    const items = Array.from(document.querySelectorAll('.checklist-cb:checked'))
                       .map(function (cb) { return cb.id; }).join(',');

    API.protocols.registreChecklist({
      maquina_id:     _pendingRes.maquina_id,
      inici:          _pendingRes.inici,
      fi:             _pendingRes.fi,
      notes:          notes,
      items_validats: items,
    }).then(function (res) {
      _hideModal('checklist-modal');
      _pendingRes = null;
      btnOk.disabled    = false;
      btnOk.textContent = 'Confirmar reserva';
      if (res.ok) {
        _toast('Reserva creada correctament! ✓', 'success');
        _calendar && _calendar.refetchEvents();
      } else {
        _toast(res.error || 'Error en crear la reserva.', 'danger');
      }
    }).catch(function () {
      _toast('Error de connexió.', 'danger');
      btnOk.disabled    = false;
      btnOk.textContent = 'Confirmar reserva';
    });
  }

  // ══════════════════════════════════════════════════
  //  UTILITATS
  // ══════════════════════════════════════════════════
  function _showModal(id) {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
  }
  function _hideModal(id) {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getOrCreateInstance(el).hide();
  }
  function _toast(msg, type) {
    if (typeof UI !== 'undefined' && UI.toast) { UI.toast(msg, type); return; }
    alert(msg);
  }
  function _slug(str) {
    return (str || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  }
  function _fmt(d) {
    return new Date(d).toLocaleString('ca-ES', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  }
  function _fmtHora(d) {
    return new Date(d).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  }

  return { init: init };
})();

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
  let _maquines   = [];   // Control_Màquines de la selecció en curs (Capa 1)

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
      // Es pot arrossegar una selecció PER SOBRE d'una reserva existent: dos
      // docents han de poder reservar màquines DIFERENTS a la mateixa hora, que
      // és el cas d'ús central del taller. La guarda de debò és el backend.
      //
      // Callback i no 'true' a posta: avui aquest calendari només pinta reserves,
      // però al tram de bloqueig hi entraran les classes d'Horari_Tallers com a
      // esdeveniments de fons. Amb 'true' es podria seleccionar per sobre d'una
      // classe el dia que hi siguin; així només s'hi pot per sobre del que està
      // marcat com a reserva, i qualsevol tipus nou queda BLOQUEJAT per defecte.
      selectOverlap: function (event) {
        return !!(event.extendedProps && event.extendedProps.tipus === 'reserva');
      },
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
    API.reserves.get({})
      .then(function (res) {
        const rows = Array.isArray(res) ? res : (res && res.reserves) || [];
        const EXCLOSOS = ['denegada', 'cancel·lada', 'cancelada', 'suspesa'];
        const events = rows
          .filter(function (r) {
            return EXCLOSOS.indexOf(r['Estat_Reserva'] || '') === -1;
          })
          .map(function (r) {
            const dia = _normData(r['Data_Reserva']);
            const ini = _normHora(r['Hora_Inici']);
            const fi  = _normHora(r['Hora_Final']);
            const maq = r['ID_Maquina'] || '';
            const qui = r['Docent_Responsable'] || r['Usuari'] || '';
            const start = dia && ini ? dia + 'T' + ini : null;
            const end   = dia && fi  ? dia + 'T' + fi  : null;
            return {
              id:              r['ID_Reserva'],
              title:           maq + (qui ? ' · ' + qui : ''),
              start:           start,
              end:             end,
              backgroundColor: COLORS[_slug(maq)] || COLORS.default,
              borderColor:     'transparent',
              extendedProps:   {
                // 'tipus' governa selectOverlap: només el que està marcat com a
                // reserva es pot solapar amb una selecció nova. Les classes
                // d'Horari_Tallers del tram de bloqueig portaran un tipus propi.
                tipus:   'reserva',
                maquina: maq,
                usuari:  qui,
                email:   r['Usuari'] || '',
                inici:   start,
                fi:      end,
                notes:   r['Grup/Projecte'] || '',
                estat:   r['Estat_Reserva'] || '',
              },
            };
          })
          .filter(function (e) { return e.start && e.end; });
        successCb(events);
      })
      .catch(failureCb);
  }

  // Normalitza la data (text 'YYYY-MM-DD', ISO o Date) a 'YYYY-MM-DD'
  function _normData(v) {
    if (!v) return '';
    if (v instanceof Date) {
      return v.getFullYear() + '-' +
             ('0' + (v.getMonth() + 1)).slice(-2) + '-' +
             ('0' + v.getDate()).slice(-2);
    }
    const s = String(v);
    return s.indexOf('T') !== -1 ? s.slice(0, 10) : s;
  }

  // Normalitza l'hora (text 'HH:MM[:SS]' o Date) a 'HH:MM'
  function _normHora(v) {
    if (!v) return '';
    if (v instanceof Date) {
      return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
    }
    const m = String(v).match(/(\d{1,2}):(\d{2})/);
    return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
  }

  // ── Selecció franja nova ───────────────────────────
  // Capa 1: N màquines a la MATEIXA franja (sessió de grup). Caselles de selecció
  // en lloc del desplegable d'una sola màquina: sense infraestructura d'UI al
  // projecte, és el control més robust i no depèn de cap llibreria nova.
  function _onSlotSelect(info) {
    _obreNovaReserva(info.startStr, info.endStr, info.start, info.end);
  }

  // Obre el modal de nova reserva per a una franja. Separat de _onSlotSelect
  // perquè també s'hi arriba des del detall d'una reserva existent ("Reservar una
  // altra màquina en aquesta franja"): quan la franja està totalment tapada per un
  // esdeveniment no hi ha cap píxel lliure des d'on arrossegar, i aquell botó és
  // l'ÚNIC camí. selectOverlap sol no ho resol.
  function _obreNovaReserva(iniciStr, fiStr, iniciDate, fiDate) {
    _pendingRes = { inici: iniciStr, fi: fiStr, maquines: [] };
    _maquines   = [];

    const ocupades = _maquinesOcupades(iniciStr, fiStr);
    const nOcup    = Object.keys(ocupades).length;

    document.getElementById('res-modal-title').textContent = 'Nova reserva';
    document.getElementById('res-modal-body').innerHTML = `
      <p><strong>Franja:</strong> ${_fmt(iniciDate)} – ${_fmtHora(fiDate)}</p>
      <label class="form-label mt-2">Màquines:</label>
      <p class="text-muted small mb-2">
        Pots seleccionar-ne més d'una per a la mateixa franja.${nOcup
          ? ' Les que ja estan reservades en aquesta franja surten desactivades.'
          : ''}
      </p>
      <div id="maq-llista" class="border rounded p-2" style="max-height:16rem;overflow-y:auto;">
        <div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>
      </div>
      <div id="maq-avis" class="form-text mt-2"></div>
    `;
    const btnOk = document.getElementById('res-modal-ok');
    btnOk.textContent = 'Continuar';
    btnOk.disabled    = true;
    btnOk.onclick = function () {
      const sel = _seleccionades();
      if (!sel.length) { _toast('Has de seleccionar almenys una màquina.', 'warning'); return; }
      _pendingRes.maquines = sel;
      _hideModal('res-modal');
      _openChecklist(sel);
    };
    _showModal('res-modal');

    // La llista es genera des de Control_Màquines (font de veritat): així el taller
    // de cada màquina sempre coincideix amb el full, i les màquines no operatives
    // surten desactivades. El backend ho torna a comprovar: aquest filtre és
    // comoditat, no la garantia.
    API.maquines.getAll()
      .then(function (maquines) {
        const cont = document.getElementById('maq-llista');
        if (!cont) return;
        _maquines = (Array.isArray(maquines) ? maquines : [])
          .filter(function (m) { return m && m['ID_Maquina']; });

        if (!_maquines.length) {
          cont.innerHTML = '<p class="text-danger small mb-0">No hi ha cap màquina a Control_Màquines.</p>';
          return;
        }

        cont.innerHTML = _maquines.map(function (m, i) {
          const id  = m['ID_Maquina'];
          const ubi = m['Ubicació'] || '';
          const est = String(m['Estat_Actual'] || '');
          const operativa = _esOperativa(est);
          // Motiu pel qual no es pot triar: primer l'estat de la màquina, després
          // que ja estigui reservada en aquesta franja. El modal INFORMA; qui
          // decideix segueix sent el backend.
          const reservada = Object.prototype.hasOwnProperty.call(ocupades, id);
          const motiu = !operativa ? est
                      : reservada  ? 'reservada' + (ocupades[id] ? ' per ' + ocupades[id] : '') + ' en aquesta franja'
                      : '';
          const bloquejada = !operativa || reservada;
          return `
            <label class="d-flex gap-2 align-items-start py-1 ${bloquejada ? 'opacity-50' : ''}" for="maq-${i}">
              <input class="form-check-input flex-shrink-0 mt-1 maq-cb" type="checkbox"
                     id="maq-${i}" value="${id}" data-protocol="${m['ID_Protocol'] || ''}"
                     data-bloquejada="${bloquejada ? '1' : ''}"
                     ${bloquejada ? 'disabled' : ''}>
              <span class="small">
                <strong>${id}</strong>${ubi ? ' <span class="text-muted">· ' + ubi + '</span>' : ''}
                ${motiu ? '<br><span class="text-muted">' + _esc(motiu) + '</span>' : ''}
              </span>
            </label>`;
        }).join('');

        document.querySelectorAll('.maq-cb').forEach(function (cb) {
          cb.addEventListener('change', _onMaquinaToggle);
        });
      })
      .catch(function () {
        const cont = document.getElementById('maq-llista');
        if (cont) cont.innerHTML = '<p class="text-danger small mb-0">No s\'han pogut carregar les màquines.</p>';
      });
  }

  function _esOperativa(estat) {
    return String(estat || '').toLowerCase().indexOf('operativa') !== -1;
  }

  // Màquines ja reservades que creuen la franja → { ID_Maquina: qui }.
  // Surt dels esdeveniments JA PINTATS al calendari, no d'una crida nova: és el
  // mateix que l'usuari té davant i evita que el modal contradigui la vista. No
  // és cap garantia — el backend torna a validar i pot rebutjar-ne alguna amb el
  // motiu (algú altre pot haver reservat mentre el modal era obert).
  function _maquinesOcupades(iniciStr, fiStr) {
    const mapa = {};
    if (!_calendar) return mapa;
    const ini = new Date(iniciStr).getTime();
    const fi  = new Date(fiStr).getTime();
    if (isNaN(ini) || isNaN(fi)) return mapa;

    _calendar.getEvents().forEach(function (ev) {
      const p = ev.extendedProps || {};
      if (p.tipus !== 'reserva' || !ev.start || !ev.end || !p.maquina) return;
      if (ev.start.getTime() < fi && ev.end.getTime() > ini) {
        mapa[p.maquina] = p.usuari || '';
      }
    });
    return mapa;
  }

  function _seleccionades() {
    return Array.from(document.querySelectorAll('.maq-cb:checked'))
                .map(function (cb) { return cb.value; });
  }

  // El checklist de seguretat és per PROTOCOL, no per màquina ni per lot a cegues:
  // un sol checklist només val si totes les màquines del lot comparteixen
  // ID_Protocol (les 5 Enders sí; un làser i una Ender no). Mentre hi hagi res
  // seleccionat, bloquegem les màquines d'altres protocols.
  function _onMaquinaToggle() {
    const marcades = Array.from(document.querySelectorAll('.maq-cb:checked'));
    const protocol = marcades.length ? marcades[0].dataset.protocol : null;

    document.querySelectorAll('.maq-cb').forEach(function (cb) {
      if (cb.checked) return;
      // data-bloquejada la fixa el render (no operativa, o ja reservada en aquesta
      // franja) i no depèn de la selecció: no es pot recalcular aquí o
      // reactivaríem una màquina que el render havia descartat.
      const bloquejada = cb.dataset.bloquejada === '1';
      cb.disabled = bloquejada || (protocol !== null && cb.dataset.protocol !== protocol);
      cb.closest('label').classList.toggle('opacity-50', cb.disabled);
    });

    const avis = document.getElementById('maq-avis');
    if (avis) {
      avis.textContent = marcades.length > 1
        ? marcades.length + ' màquines seleccionades — un sol protocol de seguretat per a totes.'
        : (protocol !== null ? 'Només pots afegir màquines del mateix protocol de seguretat.' : '');
    }
    document.getElementById('res-modal-ok').disabled = (marcades.length === 0);
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
      <hr class="my-3">
      <button class="btn btn-sm btn-outline-primary w-100" id="btn-nova-franja">
        <i class="bi bi-plus-lg me-1"></i>Reservar una altra màquina en aquesta franja
      </button>
      ${pot ? `<button class="btn btn-sm btn-danger mt-3" id="btn-cancel-res">Cancel·lar reserva</button>` : ''}
    `;
    document.getElementById('res-modal-ok').textContent = 'Tancar';
    document.getElementById('res-modal-ok').disabled    = false;
    document.getElementById('res-modal-ok').onclick = function () { _hideModal('res-modal'); };

    // Camí ÚNIC quan la franja està totalment tapada per reserves: no hi ha cap
    // píxel lliure des d'on arrossegar una selecció nova, i selectOverlap només
    // governa si una selecció pot solapar, no si es pot iniciar sobre un
    // esdeveniment. Sense aquest botó, el defecte quedaria a mitges.
    document.getElementById('btn-nova-franja').addEventListener('click', function () {
      _hideModal('res-modal');
      // Deixem tancar el modal abans de reobrir-lo amb contingut nou: Bootstrap
      // s'embolica si es reutilitza la mateixa instància enmig de la transició.
      setTimeout(function () {
        _obreNovaReserva(r.inici, r.fi, new Date(r.inici), new Date(r.fi));
      }, 200);
    });

    if (pot) {
      document.getElementById('btn-cancel-res').addEventListener('click', function () {
        if (!confirm('Segur que vols cancel·lar aquesta reserva?')) return;
        API.reserves.cancel(info.event.id).then(function (res) {
          _hideModal('res-modal');
          if (res && res.cancelled) { _toast('Reserva cancel·lada.', 'success'); _calendar.refetchEvents(); }
          else { _toast((res && res.error) || 'Error.', 'danger'); }
        }).catch(function (err) {
          _hideModal('res-modal');
          _toast((err && err.message) || 'Error en cancel·lar.', 'danger');
        });
      });
    }
    _showModal('res-modal');
  }

  // ══════════════════════════════════════════════════
  //  CHECKLIST
  // ══════════════════════════════════════════════════
  // maquines: array d'IDs, totes del mateix ID_Protocol (ho garanteix _onMaquinaToggle).
  // Per això un sol checklist val per a tot el lot i el demanem per a la primera.
  function _openChecklist(maquines) {
    const body  = document.getElementById('checklist-body');
    const btnOk = document.getElementById('btn-checklist-ok');
    body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning"></div></div>';
    btnOk.disabled = true;
    document.getElementById('checklist-notes-wrap').classList.add('d-none');
    _showModal('checklist-modal');

    API.protocols.get(maquines[0])
      .then(function (res) {
        if (!res.items || !res.items.length) {
          body.innerHTML = '<p class="text-danger">No s\'ha pogut carregar el protocol.</p>';
          return;
        }
        _renderItems(maquines, res.items);
      })
      .catch(function () {
        body.innerHTML = '<p class="text-danger">Error de connexió.</p>';
      });
  }

  function _renderItems(maquines, items) {
    const body  = document.getElementById('checklist-body');
    const btnOk = document.getElementById('btn-checklist-ok');
    document.getElementById('checklist-notes-wrap').classList.remove('d-none');

    const etiqueta = maquines.length === 1
      ? 'la reserva de <strong>' + maquines[0] + '</strong>'
      : 'les <strong>' + maquines.length + ' reserves</strong> (' + maquines.join(', ') + ')';

    body.innerHTML = `
      <p class="text-muted mb-3">
        Abans de confirmar ${etiqueta},
        has d'acceptar tots els punts del protocol:
      </p>
      <div class="list-group list-group-flush">
        ${items.map(function (item, i) {
          const titol = item.Text_Item || item.titol || String(item);
          const desc  = item.Bloc || item.descripcio || '';
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
    btnOk.disabled  = true;
    btnOk.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardant…';

    const notes      = (document.getElementById('checklist-notes') || {}).value || '';
    const itemsTotal = document.querySelectorAll('.checklist-cb').length;
    const inici      = new Date(_pendingRes.inici);
    const fi         = new Date(_pendingRes.fi);

    // Data en LOCAL, mai amb toISOString(): és UTC i una sèrie generada per
    // aritmètica (Capa 2) podria caure al dia anterior. Avui no es notava perquè
    // el calendari comença a les 08:00, però la trampa hi era.
    const data      = _dataLocal(inici);
    const horaInici = _horaLocal(inici);
    const horaFi    = _horaLocal(fi);

    const items = _pendingRes.maquines.map(function (id) {
      return { maquina_id: id, data: data, hora_inici: horaInici, hora_fi: horaFi };
    });
    const franja = { inici: _pendingRes.inici, fi: _pendingRes.fi };

    _creaReserves(items, notes)
      .then(function (res) {
        const creades    = (res && res.creades)    || [];
        const rebutjades = (res && res.rebutjades) || [];
        return _registraChecklists(creades, franja, notes, itemsTotal)
          .then(function () { return { creades: creades, rebutjades: rebutjades }; });
      })
      .then(function (r) {
        _hideModal('checklist-modal');
        _pendingRes = null;
        _restauraBoto(btnOk);
        _avisaResultat(r.creades, r.rebutjades);
        _calendar && _calendar.refetchEvents();
      })
      .catch(function (err) {
        _toast((err && err.message) || 'Error en crear la reserva.', 'danger');
        _restauraBoto(btnOk);
      });
  }

  // UNA màquina → createReserva (el camí de producció de sempre, intacte).
  // N màquines → createReserves (lot amb política parcial-amb-avís). No unifiquem:
  // amb una sola màquina no hi ha res "parcial" i no volem tocar el camí verificat.
  function _creaReserves(items, notes) {
    if (items.length === 1) {
      const it = items[0];
      return API.reserves.create(it.maquina_id, it.data, it.hora_inici, it.hora_fi, '', notes)
        .then(function (res) {
          return {
            creades:    [{ id: (res && res.id) || '', maquina_id: it.maquina_id }],
            rebutjades: [],
          };
        });
    }
    return API.reserves.createMultiple(items, notes);
  }

  // Una fila de checklist per reserva creada: conserva la traçabilitat per màquina
  // que ja hi havia a Registre_Checklists. Seqüencial per no encavalcar escriptures.
  // Les rebutjades no en generen cap: no hi ha reserva a què lligar-les.
  function _registraChecklists(creades, franja, notes, itemsTotal) {
    return creades.reduce(function (cadena, r) {
      return cadena.then(function () {
        return API.protocols.registreChecklist({
          maquina_id:     r.maquina_id,
          inici:          franja.inici,
          fi:             franja.fi,
          notes:          notes,
          reserva_id:     r.id || '',
          id_protocol:    r.maquina_id,
          bloc_completat: 'INICI,DURANT,TANCAMENT',
          items_total:    itemsTotal,
        });
      });
    }, Promise.resolve());
  }

  function _avisaResultat(creades, rebutjades) {
    const ok = creades.map(function (r) { return r.maquina_id; });
    const ko = rebutjades.map(function (r) { return r.maquina_id + ' (' + r.motiu + ')'; });

    if (ok.length && !ko.length) {
      _toast(ok.length === 1
        ? 'Reserva creada correctament! ✓'
        : ok.length + ' reserves creades: ' + ok.join(', ') + ' ✓', 'success');
      return;
    }
    if (ok.length && ko.length) {
      _toast('Reservades: ' + ok.join(', ') + '.\n\n' +
             'No s\'han pogut reservar: ' + ko.join(', ') + '.', 'warning');
      return;
    }
    _toast('No s\'ha pogut reservar cap màquina.\n\n' + ko.join('\n'), 'danger');
  }

  function _restauraBoto(btnOk) {
    btnOk.disabled    = false;
    btnOk.textContent = 'Confirmar reserva';
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
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _slug(str) {
    return (str || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  }
  // Data i hora LOCALS (Europe/Madrid al navegador del centre). Mai toISOString():
  // convertiria a UTC i podria desplaçar el dia. El full espera 'AAAA-MM-DD' i
  // 'HH:MM' amb zero al davant — la comparació de franges del backend és
  // lexicogràfica i '9:00' la trencaria.
  function _dataLocal(d) {
    return d.getFullYear() + '-' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getDate()).slice(-2);
  }
  function _horaLocal(d) {
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
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
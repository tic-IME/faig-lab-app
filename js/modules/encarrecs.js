/* ============================================================
   FAIG Lab — Mòdul Encàrrecs
   ------------------------------------------------------------
   Copyright (C) 2026  Institut Maria Espinalt
   Programari lliure sota la GNU GPL v3 o posterior. Veure LICENSE.
   La marca del centre queda FORA de la llicència. Veure el README.
   ============================================================ */

window.ModulEncarrecs = (function () {

  // Han de coincidir EXACTAMENT amb ENCARREC_ESTATS del backend (Encarrecs.js).
  // Si canvien allà, han de canviar aquí.
  const ESTATS_ENC = ['Rebut', 'Acceptat', 'En producció', 'Llest', 'Entregat', 'Rebutjat'];

  // Opcions del filtre. El valor buit és el que el backend entén com "no tancats":
  // ni Entregat ni Rebutjat. OJO: a diferència d'incidències, aquí hi ha DOS estats
  // terminals, no un.
  const FILTRES = [
    { valor: '',             etiqueta: 'Actius' },
    { valor: 'Rebut',        etiqueta: 'Només rebuts' },
    { valor: 'Acceptat',     etiqueta: 'Només acceptats' },
    { valor: 'En producció', etiqueta: 'Només en producció' },
    { valor: 'Llest',        etiqueta: 'Només llestos' },
    { valor: 'Entregat',     etiqueta: 'Només entregats' },
    { valor: 'Rebutjat',     etiqueta: 'Només rebutjats' },
    { valor: 'totes',        etiqueta: 'Tots' },
  ];

  // Mateixa raó que al mòdul d'incidències: --col-bg és el fons de pàgina i
  // --col-surface el de la targeta. NO inventar variables (--col-bg-alt no existeix).
  const CEL_DETALL = 'background:var(--col-bg);border-top:1px solid var(--col-border);';

  const COLS_TAULA = 6;   // ha de coincidir amb els <th> de _renderLlista (colspan del detall)

  let _container = null;
  let _encarrecs = [];
  let _filtre    = '';
  let _detalls   = {};   // cache id → camps, per no refer la crida en replegar i desplegar

  // ── init ──────────────────────────────────────────────────

  async function init(container) {
    _container = container;
    _renderContingut();
  }

  // ── Render contingut ──────────────────────────────────────

  function _renderContingut() {
    const urlForm = FAIG_CONFIG.FORM_ENCARRECS_URL || '';

    _container.innerHTML =
      '<div class="module-header">' +
        '<div class="module-header-left">' +
          '<h2 class="module-title">Encàrrecs</h2>' +
          '<p class="module-subtitle">Demana un encàrrec als espais maker del FAIG</p>' +
        '</div>' +
      '</div>' +

      // ── Targeta d'invitació: la veu TOTHOM, no només els admins ──
      // És la porta d'entrada del professorat al FAIG i ha de convidar, no amagar-se.
      '<div class="card" style="max-width:640px;margin-bottom:1.5rem;">' +
        '<div class="card-header"><span class="card-title">✋ Fer un encàrrec</span></div>' +

        '<p style="font-size:.9rem;line-height:1.55;margin-bottom:1.125rem;">' +
          'Tens un projecte al cap? Els espais maker t\'acompanyen a fer-lo realitat: des d\'una ' +
          'peça concreta que ja tens dissenyada fins a una idea que encara has de definir. ' +
          '<strong>No cal que ho tinguis tot clar per demanar-ho</strong> — explica\'ns què vols ' +
          'fer i l\'equip FAIG et respon.' +
        '</p>' +

        '<div style="display:flex;justify-content:flex-end;">' +
          (urlForm
            ? '<a class="btn-primary" id="btn-enc-formulari" href="' + _esc(urlForm) + '" ' +
                 'target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;">' +
                'Obre el formulari d\'encàrrecs' +
              '</a>'
            : '<span style="font-size:.82rem;color:var(--col-text-muted);">' +
                'El formulari no està configurat (falta FORM_ENCARRECS_URL a config.js).' +
              '</span>') +
        '</div>' +
      '</div>' +

      // ── Llista ADMIN ──
      (Auth.isAdmin()
        ? '<div id="enc-llista-wrap">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;' +
                 'gap:1rem;flex-wrap:wrap;margin-bottom:.75rem;">' +
              '<h3 style="font-size:.8rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
                   'color:var(--col-text-muted);margin:0;">Gestió d\'encàrrecs</h3>' +
              '<select id="enc-filtre" style="font-size:.8rem;padding:.25rem .4rem;">' +
                FILTRES.map(function (f) {
                  return '<option value="' + _esc(f.valor) + '"' +
                         (_filtre === f.valor ? ' selected' : '') + '>' + _esc(f.etiqueta) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div id="enc-llista"><div class="spinner-wrap"><div class="spinner"></div></div></div>' +
          '</div>'
        : '');

    if (Auth.isAdmin()) {
      const filtre = document.getElementById('enc-filtre');
      if (filtre) {
        filtre.addEventListener('change', function () {
          _filtre = filtre.value;
          _carregaLlista();
        });
      }
      _carregaLlista();
    }
  }

  // ── Llista d'encàrrecs (ADMIN) ────────────────────────────

  async function _carregaLlista() {
    const wrap = document.getElementById('enc-llista');
    if (!wrap) return;

    wrap.innerHTML = '<div class="spinner-wrap" style="min-height:80px;"><div class="spinner"></div></div>';

    try {
      // Sense filtre: el backend retorna els que NO estan tancats.
      _encarrecs = (await API.encarrecs.getAll(_filtre)) || [];
      _renderLlista(wrap);
    } catch (err) {
      wrap.innerHTML = '<div class="empty-state" style="min-height:80px;">' +
        '<p class="empty-state-title">No s\'han pogut carregar els encàrrecs</p>' +
        '<p class="empty-state-desc">' + _esc(err.message) + '</p></div>';
    }
  }

  function _renderLlista(wrap) {
    if (_encarrecs.length === 0) {
      const etiqueta = (FILTRES.find(function (f) { return f.valor === _filtre; }) || {}).etiqueta || '';
      wrap.innerHTML =
        '<div class="empty-state" style="min-height:80px;">' +
          '<span class="empty-state-icon">📭</span>' +
          '<p class="empty-state-title">Cap encàrrec</p>' +
          '<p class="empty-state-desc">No n\'hi ha cap amb el filtre "' + _esc(etiqueta) + '".</p>' +
        '</div>';
      return;
    }

    let html = '<div class="table-wrap"><table>' +
      '<thead><tr>' +
        '<th>Data</th>' +
        '<th>Títol</th>' +
        '<th>Docent</th>' +
        '<th>Departament</th>' +
        '<th>Estat</th>' +
        '<th>Gestionat per</th>' +
      '</tr></thead><tbody>';

    _encarrecs.forEach(function (enc) {
      // Sense ID no hi ha detall possible: getEncarrec localitza la fila per ID.
      html += '<tr' +
        (enc.id ? ' class="fila-enc" style="cursor:pointer;"' : '') +
        ' data-id="' + _esc(enc.id || '') + '">' +
        '<td>' + _esc(_formatData(enc.data)) + '</td>' +
        '<td><strong>' + _esc(enc.titol || '—') + '</strong></td>' +
        '<td>' + _esc(enc.docent || '—') + '</td>' +
        '<td>' + _esc(enc.departament || '—') + '</td>' +
        '<td>' + _selectorEstat(enc) + '</td>' +
        '<td>' + _esc(enc.gestionat_per || '—') + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<p style="font-size:.78rem;color:var(--col-text-muted);margin-top:.5rem;">' +
            'Fes clic a un encàrrec per veure la resposta completa del formulari.</p>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('.sel-estat-enc').forEach(function (sel) {
      sel.dataset.anterior = sel.value;
      sel.addEventListener('change', function () {
        _canviaEstat(sel.dataset.id, sel.value, sel);
      });
    });

    wrap.querySelectorAll('.fila-enc').forEach(function (tr) {
      tr.addEventListener('click', function (ev) {
        // El selector d'estat viu dins la fila: no ha d'obrir el detall.
        if (ev.target.closest('select')) return;
        _toggleDetall(tr);
      });
    });
  }

  // ── Detall d'un encàrrec ──────────────────────────────────

  async function _toggleDetall(tr) {
    const id = tr.dataset.id;
    const seguent = tr.nextElementSibling;

    if (seguent && seguent.classList.contains('fila-detall')) {
      seguent.remove();
      return;
    }

    const detall = document.createElement('tr');
    detall.className = 'fila-detall';
    detall.innerHTML = '<td colspan="' + COLS_TAULA + '" style="' + CEL_DETALL + '">' +
                       '<div class="spinner-wrap" style="min-height:60px;"><div class="spinner"></div></div></td>';
    tr.insertAdjacentElement('afterend', detall);

    try {
      if (!_detalls[id]) {
        const res = await API.encarrecs.get(id);
        _detalls[id] = (res && res.camps) || [];
      }
      detall.innerHTML = '<td colspan="' + COLS_TAULA + '" style="' + CEL_DETALL + 'padding:.875rem;">' +
                         _renderCamps(_detalls[id]) + '</td>';
    } catch (err) {
      detall.innerHTML = '<td colspan="' + COLS_TAULA + '" style="' + CEL_DETALL + 'padding:.875rem;' +
                         'font-size:.82rem;color:var(--col-text-muted);">' +
                         'No s\'ha pogut carregar el detall: ' + _esc(err.message) + '</td>';
    }
  }

  function _renderCamps(camps) {
    if (!camps || camps.length === 0) {
      return '<p style="font-size:.82rem;color:var(--col-text-muted);margin:0;">Sense respostes registrades.</p>';
    }

    return '<dl style="margin:0;display:grid;grid-template-columns:minmax(180px,1fr) 2fr;gap:.5rem .875rem;">' +
      camps.map(function (c) {
        return '<dt style="font-size:.78rem;font-weight:600;color:var(--col-text-muted);">' +
                 _esc(c.pregunta) + '</dt>' +
               '<dd style="font-size:.85rem;margin:0;white-space:pre-wrap;line-height:1.5;' +
                 'color:var(--col-text);">' + _esc(_formatValor(c.resposta)) + '</dd>';
      }).join('') +
    '</dl>';
  }

  // El backend serialitza les dates del full com a ISO. Les tornem a hora local amb
  // el mateix format que la columna Data de la llista.
  const ISO_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  function _formatValor(val) {
    const s = String(val || '');
    return ISO_DATA.test(s) ? _formatData(s) : s;
  }

  // Una fila sense ID vol dir que l'estampat automàtic ha fallat (el trigger registra
  // els errors només al Logger). La mostrem, però sense selector: updateEstatEncarrec
  // localitza la fila per ID i sense ID no hi ha res a fer.
  function _selectorEstat(enc) {
    const estat = enc.estat || '';

    if (!enc.id) {
      return '<span class="estat-badge estat-standby">Sense ID</span>' +
             '<div style="font-size:.72rem;color:var(--col-text-muted);margin-top:.2rem;">' +
             'Reviseu el full</div>';
    }

    const opcions = ESTATS_ENC.map(function (e) {
      return '<option value="' + _esc(e) + '"' + (estat === e ? ' selected' : '') + '>' + _esc(e) + '</option>';
    }).join('');

    return '<select class="sel-estat-enc" data-id="' + _esc(enc.id) + '" ' +
           'style="font-size:.8rem;padding:.25rem .4rem;">' +
           (ESTATS_ENC.indexOf(estat) === -1
             ? '<option value="" selected>' + _esc(estat || '(sense estat)') + '</option>'
             : '') +
           opcions + '</select>';
  }

  async function _canviaEstat(encarrecId, nouEstat, sel) {
    if (!nouEstat) return;

    const anterior = sel.dataset.anterior || '';
    if (!confirm('Canviar l\'encàrrec ' + encarrecId + ' a "' + nouEstat + '"?')) {
      sel.value = anterior;
      return;
    }

    sel.disabled = true;
    try {
      await API.encarrecs.updateEstat(encarrecId, nouEstat);
      Toast.ok('Encàrrec ' + encarrecId + ' actualitzat a "' + nouEstat + '".');
      // El detall conté les columnes d'estat de la fila: la cache queda obsoleta.
      delete _detalls[encarrecId];
    } catch (err) {
      Toast.error('Error actualitzant l\'encàrrec: ' + err.message);
      sel.value = anterior;
      sel.disabled = false;
      return;
    }

    // Recarreguem: amb el filtre per defecte, un "Entregat" o "Rebutjat" desapareix.
    await _carregaLlista();
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
  MODULES['encarrecs'] = ModulEncarrecs;
}

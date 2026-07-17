/* ============================================================
   FAIG Lab — Mòdul Incidències
   ------------------------------------------------------------
   Copyright (C) 2026  Institut Maria Espinalt
   Programari lliure sota la GNU GPL v3 o posterior. Veure LICENSE.
   La marca del centre queda FORA de la llicència. Veure el README.
   ============================================================ */

window.ModulIncidencies = (function () {

  // Els tres únics valors admesos. Han de coincidir EXACTAMENT amb INCIDENCIA_ESTATS
  // del backend i amb la validació de dades de la columna Estat del full.
  const ESTATS_INC = ['Oberta', 'En curs', 'Resolta'];

  // Valor exacte de la llista ESTATS de js/modules/maquines.js i de la columna
  // Estat_Actual de Control_Màquines. Si canvia allà, ha de canviar aquí.
  const MAQUINA_OPERATIVA = 'Operativa';

  // Opcions del filtre. El valor buit és el que el backend entén com "no resoltes".
  const FILTRES = [
    { valor: '',        etiqueta: 'Obertes i en curs' },
    { valor: 'Oberta',  etiqueta: 'Només obertes' },
    { valor: 'En curs', etiqueta: 'Només en curs' },
    { valor: 'Resolta', etiqueta: 'Només resoltes' },
    { valor: 'totes',   etiqueta: 'Totes' },
  ];

  // Fons del panell de detall. --col-bg és el fons de pàgina i --col-surface el de
  // la targeta: fer-los servir així dona el contrast d'encaix en tots dos temes.
  // NO inventar variables: --col-bg-alt no existeix i el fallback pintava el panell
  // gairebé blanc en tema fosc, amb el text també blanc a sobre (incident 16/07/2026).
  const CEL_DETALL = 'background:var(--col-bg);border-top:1px solid var(--col-border);';

  let _container   = null;
  let _maquines    = [];   // per al suggeriment d'estat en resoldre (D3)
  let _incidencies = [];
  let _filtre      = '';
  let _detalls     = {};   // cache id → camps, per no refer la crida en replegar i desplegar

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
            '<div style="display:flex;align-items:center;justify-content:space-between;' +
                 'gap:1rem;flex-wrap:wrap;margin-bottom:.75rem;">' +
              '<h3 style="font-size:.8rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
                   'color:var(--col-text-muted);margin:0;">Incidències</h3>' +
              '<select id="inc-filtre" style="font-size:.8rem;padding:.25rem .4rem;">' +
                FILTRES.map(function (f) {
                  return '<option value="' + _esc(f.valor) + '"' +
                         (_filtre === f.valor ? ' selected' : '') + '>' + _esc(f.etiqueta) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div id="inc-llista"><div class="spinner-wrap"><div class="spinner"></div></div></div>' +
          '</div>'
        : '');

    // Carrega llista si ADMIN
    if (Auth.isAdmin()) {
      const filtre = document.getElementById('inc-filtre');
      if (filtre) {
        filtre.addEventListener('change', function () {
          _filtre = filtre.value;
          _carregaLlista();
        });
      }
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
      _incidencies = (await API.incidencies.getAll(_filtre)) || [];
      _renderLlista(wrap);
    } catch (err) {
      wrap.innerHTML = '<div class="empty-state" style="min-height:80px;">' +
        '<p class="empty-state-title">No s\'han pogut carregar les incidències</p>' +
        '<p class="empty-state-desc">' + _esc(err.message) + '</p></div>';
    }
  }

  function _renderLlista(wrap) {
    if (_incidencies.length === 0) {
      const etiqueta = (FILTRES.find(function (f) { return f.valor === _filtre; }) || {}).etiqueta || '';
      wrap.innerHTML =
        '<div class="empty-state" style="min-height:80px;">' +
          '<span class="empty-state-icon">✅</span>' +
          '<p class="empty-state-title">Cap incidència</p>' +
          '<p class="empty-state-desc">No n\'hi ha cap amb el filtre "' + _esc(etiqueta) + '".</p>' +
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
      // Sense ID no hi ha detall possible: getIncidencia localitza la fila per ID.
      html += '<tr' +
        (inc.id ? ' class="fila-inc" style="cursor:pointer;"' : '') +
        ' data-id="' + _esc(inc.id || '') + '">' +
        '<td>' + _esc(_formatData(inc.data)) + '</td>' +
        '<td><strong>' + _esc(inc.maquina_id || '—') + '</strong></td>' +
        '<td>' + _esc(inc.us || '—') + '</td>' +
        '<td>' + _esc(inc.docent || '—') + '</td>' +
        '<td>' + _selectorEstat(inc) + '</td>' +
        '<td>' + _esc(inc.gestionada_per || '—') + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<p style="font-size:.78rem;color:var(--col-text-muted);margin-top:.5rem;">' +
            'Fes clic a una incidència per veure la resposta completa del formulari.</p>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('.sel-estat-inc').forEach(function (sel) {
      sel.dataset.anterior = sel.value;
      sel.addEventListener('change', function () {
        _canviaEstat(sel.dataset.id, sel.value, sel);
      });
    });

    wrap.querySelectorAll('.fila-inc').forEach(function (tr) {
      tr.addEventListener('click', function (ev) {
        // El selector d'estat viu dins la fila: no ha d'obrir el detall.
        if (ev.target.closest('select')) return;
        _toggleDetall(tr);
      });
    });
  }

  // ── Detall d'una incidència (D2) ──────────────────────────

  async function _toggleDetall(tr) {
    const id = tr.dataset.id;
    const seguent = tr.nextElementSibling;

    if (seguent && seguent.classList.contains('fila-detall')) {
      seguent.remove();
      return;
    }

    const detall = document.createElement('tr');
    detall.className = 'fila-detall';
    detall.innerHTML = '<td colspan="6" style="' + CEL_DETALL + '">' +
                       '<div class="spinner-wrap" style="min-height:60px;"><div class="spinner"></div></div></td>';
    tr.insertAdjacentElement('afterend', detall);

    try {
      if (!_detalls[id]) {
        const res = await API.incidencies.get(id);
        _detalls[id] = (res && res.camps) || [];
      }
      detall.innerHTML = '<td colspan="6" style="' + CEL_DETALL + 'padding:.875rem;">' +
                         _renderCamps(_detalls[id]) + '</td>';
    } catch (err) {
      detall.innerHTML = '<td colspan="6" style="' + CEL_DETALL + 'padding:.875rem;' +
                         'font-size:.82rem;color:var(--col-text-muted);">' +
                         'No s\'ha pogut carregar el detall: ' + _esc(err.message) + '</td>';
    }
  }

  function _renderCamps(camps) {
    if (!camps || camps.length === 0) {
      return '<p style="font-size:.82rem;color:var(--col-text-muted);margin:0;">Sense respostes registrades.</p>';
    }

    // La resposta és la dada principal: --col-text (15.6:1 clar, 15.7:1 fosc).
    // La pregunta és l'etiqueta: --col-text-muted, el to estàndard de l'app
    // (6.07:1 en fosc; 4.47:1 en clar, just per sota de l'AA de 4.5 — és el
    // mateix valor que ja tenen els subtítols de mòdul sobre --col-bg, no una
    // regressió d'aquí: esmenar-ho seria canviar el token global del tema).
    return '<dl style="margin:0;display:grid;grid-template-columns:minmax(180px,1fr) 2fr;gap:.5rem .875rem;">' +
      camps.map(function (c) {
        return '<dt style="font-size:.78rem;font-weight:600;color:var(--col-text-muted);">' +
                 _esc(c.pregunta) + '</dt>' +
               '<dd style="font-size:.85rem;margin:0;white-space:pre-wrap;line-height:1.5;' +
                 'color:var(--col-text);">' + _esc(_formatValor(c.resposta)) + '</dd>';
      }).join('') +
    '</dl>';
  }

  // El backend serialitza les dates del full com a ISO (_incidenciaValorText).
  // Les tornem a hora local amb el mateix format que la columna Data de la llista.
  const ISO_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  function _formatValor(val) {
    const s = String(val || '');
    return ISO_DATA.test(s) ? _formatData(s) : s;
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

    // Capturem la incidència ABANS de recarregar: _carregaLlista reemplaça _incidencies.
    const inc = _incidencies.find(function (i) { return i.id === incidenciaId; });

    sel.disabled = true;
    try {
      await API.incidencies.updateEstat(incidenciaId, nouEstat);
      Toast.ok('Incidència ' + incidenciaId + ' actualitzada a "' + nouEstat + '".');
      // El detall conté les columnes d'estat de la fila: la cache queda obsoleta.
      delete _detalls[incidenciaId];
    } catch (err) {
      Toast.error('Error actualitzant la incidència: ' + err.message);
      sel.value = anterior;
      sel.disabled = false;
      return;
    }

    // El suggeriment va DESPRÉS del canvi ja desat i mai el pot desfer: si aquí
    // falla res, la incidència es queda resolta igualment.
    if (nouEstat === 'Resolta') {
      await _suggereixOperativa(inc);
    }

    // Recarreguem: amb el filtre per defecte, una "Resolta" desapareix de la llista.
    await _carregaLlista();
  }

  // ── Suggeriment de màquina operativa (D3) ─────────────────

  // En resoldre una incidència, la màquina pot haver quedat en un estat no operatiu
  // (l'escalada automàtica del backend l'hi posa). Ho OFERIM; no s'executa mai sol:
  // resoldre una incidència no canvia l'estat de la màquina (decisió del Tram C).
  async function _suggereixOperativa(inc) {
    if (!inc || !inc.maquina_id) return;

    // Estat fresc: _maquines es va carregar en entrar al mòdul i pot ser de fa
    // estona. El suggeriment afirma una cosa sobre la màquina a qui l'ha de decidir,
    // i resoldre és una acció rara: una crida extra aquí surt a compte.
    try {
      _maquines = (await API.maquines.getAll()) || _maquines;
    } catch (err) {
      // Amb el que tinguem en memòria n'hi ha prou per a un suggeriment.
    }

    const maq = _maquines.find(function (m) { return m['ID_Maquina'] === inc.maquina_id; });
    if (!maq) return;                                     // esborrada o reanomenada
    if (maq['Estat_Actual'] === MAQUINA_OPERATIVA) return;

    const estatActual = maq['Estat_Actual'] || '(sense estat)';
    const accepta = confirm(
      'Incidència ' + inc.id + ' resolta.\n\n' +
      'La màquina ' + inc.maquina_id + ' encara consta com a "' + estatActual + '".\n\n' +
      'Vols marcar-la com a Operativa?'
    );
    if (!accepta) return;

    try {
      await API.maquines.updateEstat(inc.maquina_id, MAQUINA_OPERATIVA, '');
      Toast.ok('Màquina ' + inc.maquina_id + ' marcada com a Operativa.');
    } catch (err) {
      Toast.error('No s\'ha pogut actualitzar la màquina: ' + err.message);
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

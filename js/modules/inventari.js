/* ============================================================
   FAIG Lab — Mòdul Inventari
   ============================================================ */

window.ModulInventari = (function () {

  let _container = null;
  let _materials  = [];

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
          '<h2 class="module-title">Inventari</h2>' +
          '<p class="module-subtitle">Materials i consums del FabLab</p>' +
        '</div>' +
        '<div class="module-header-actions">' +
          (Auth.isAdmin()
            ? '<button class="btn-primary btn-sm" id="btn-nou-material">+ Nou material</button>'
            : '') +
          '<button class="btn-secondary btn-sm" id="btn-reload-inv" style="margin-left:.4rem;">↻ Actualitza</button>' +
        '</div>' +
      '</div>' +
      '<div id="inv-body"><div class="spinner-wrap"><div class="spinner"></div></div></div>';

    document.getElementById('btn-reload-inv').addEventListener('click', _carrega);
    if (Auth.isAdmin()) {
      document.getElementById('btn-nou-material').addEventListener('click', function () {
        _obreModalNouMaterial();
      });
    }

    try {
      _materials = (await API.inventari.getAll()) || [];
      _renderInventari();
    } catch (err) {
      Toast.error('Error carregant l\'inventari: ' + err.message);
      document.getElementById('inv-body').innerHTML =
        '<div class="empty-state"><p class="empty-state-desc">No s\'han pogut carregar les dades.</p></div>';
    }
  }

  // ── Render principal ──────────────────────────────────────

  function _renderInventari() {
    const cos = document.getElementById('inv-body');
    if (!cos) return;

    if (_materials.length === 0) {
      cos.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-state-icon">📦</span>' +
          '<p class="empty-state-title">Inventari buit</p>' +
          '<p class="empty-state-desc">Afegeix materials des del botó "Nou material" o directament al Google Sheets.</p>' +
        '</div>';
      return;
    }

    const perReposar = _materials.filter(function (m) {
      return String(m['Estat_Alerta'] || '').indexOf('REPOSAR') !== -1 ||
             Number(m['Estoc_Actual']) <= Number(m['Estoc_Minim']);
    });

    let html = '';

    // Alerta global
    if (perReposar.length > 0) {
      html += '<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;' +
              'border-radius:var(--radius);background:#fef2f2;border:1.5px solid #fecaca;' +
              'margin-bottom:1.25rem;">' +
        '<span style="font-size:1.4rem;">🚨</span>' +
        '<div>' +
          '<strong style="color:#991b1b;">Materials per reposar: ' + perReposar.length + '</strong>' +
          '<p style="font-size:.82rem;color:#b91c1c;margin-top:.15rem;">' +
            perReposar.map(function (m) { return _esc(m['Nom_Material'] || m['ID_Material']); }).join(', ') +
          '</p>' +
        '</div>' +
      '</div>';
    }

    // Agrupa per Categoria → Taller
    const categories = {};
    _materials.forEach(function (m) {
      const cat    = m['Categoria'] || 'Sense categoria';
      const taller = m['Taller']    || 'Sense taller';
      if (!categories[cat]) categories[cat] = {};
      if (!categories[cat][taller]) categories[cat][taller] = [];
      categories[cat][taller].push(m);
    });

    Object.keys(categories).sort().forEach(function (cat) {
      html += '<div style="margin-bottom:1.75rem;">' +
        '<h3 style="font-size:.82rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
             'color:var(--col-text-muted);margin-bottom:.875rem;">📦 ' + _esc(cat) + '</h3>';

      Object.keys(categories[cat]).sort().forEach(function (taller) {
        const grup = categories[cat][taller];

        html += '<p style="font-size:.78rem;font-weight:600;color:var(--col-text-muted);' +
                'margin-bottom:.4rem;margin-left:.1rem;">🏭 ' + _esc(taller) + '</p>' +
                '<div class="table-wrap" style="margin-bottom:1rem;"><table>' +
                '<thead><tr>' +
                  '<th>Material</th>' +
                  '<th>ID</th>' +
                  '<th>Estoc actual</th>' +
                  '<th>Mínim</th>' +
                  '<th>Estat</th>' +
                  '<th></th>' +
                '</tr></thead><tbody>';

        grup.forEach(function (m) {
          const baix = Number(m['Estoc_Actual']) <= Number(m['Estoc_Minim']);
          const alerta = String(m['Estat_Alerta'] || '').indexOf('REPOSAR') !== -1 || baix;

          html += '<tr>' +
            '<td><strong>' + _esc(m['Nom_Material'] || '—') + '</strong></td>' +
            '<td style="font-size:.78rem;color:var(--col-text-muted);">' + _esc(m['ID_Material'] || '') + '</td>' +
            '<td>' +
              '<span style="font-size:1rem;font-weight:700;color:' + (baix ? '#dc2626' : 'var(--col-text)') + ';">' +
              _esc(String(m['Estoc_Actual'] || 0)) + '</span>' +
              ' <span style="font-size:.8rem;color:var(--col-text-muted);">' + _esc(m['Unitat'] || '') + '</span>' +
            '</td>' +
            '<td style="color:var(--col-text-muted);">' + _esc(String(m['Estoc_Minim'] || 0)) + ' ' + _esc(m['Unitat'] || '') + '</td>' +
            '<td>' +
              (alerta
                ? '<span style="font-size:.78rem;font-weight:700;color:#991b1b;background:#fee2e2;' +
                  'padding:.15rem .45rem;border-radius:20px;">🚨 REPOSAR</span>'
                : '<span style="font-size:.78rem;color:#166534;background:#dcfce7;' +
                  'padding:.15rem .45rem;border-radius:20px;">✅ OK</span>') +
            '</td>' +
            '<td style="text-align:right;white-space:nowrap;">' +
              '<button class="btn-secondary btn-sm btn-consum" ' +
                'data-id="' + _esc(m['ID_Material']) + '" ' +
                'data-nom="' + _esc(m['Nom_Material'] || '') + '" ' +
                'data-unitat="' + _esc(m['Unitat'] || '') + '" ' +
                'data-estoc="' + _esc(String(m['Estoc_Actual'] || 0)) + '" ' +
                'style="margin-right:.25rem;">Registrar consum</button>' +
              (Auth.isAdmin()
                ? '<button class="btn-secondary btn-sm btn-editar-mat" ' +
                  'data-id="' + _esc(m['ID_Material']) + '">Editar</button>'
                : '') +
            '</td>' +
          '</tr>';
        });

        html += '</tbody></table></div>';
      });

      html += '</div>';
    });

    cos.innerHTML = html;

    cos.querySelectorAll('.btn-consum').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _obreModalConsum(btn.dataset.id, btn.dataset.nom, btn.dataset.unitat, Number(btn.dataset.estoc));
      });
    });

    if (Auth.isAdmin()) {
      cos.querySelectorAll('.btn-editar-mat').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const mat = _materials.find(function (m) { return m['ID_Material'] === btn.dataset.id; });
          if (mat) _obreModalEditarMaterial(mat);
        });
      });
    }
  }

  // ── Modal registrar consum ────────────────────────────────

  function _obreModalConsum(matId, nomMat, unitat, estocActual) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal-card" style="max-width:400px;">' +
        '<div class="modal-header">' +
          '<span class="modal-title">Registrar consum</span>' +
          '<button class="modal-close" id="con-close">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Material</label>' +
            '<input type="text" value="' + _esc(nomMat) + '" readonly style="opacity:.7;">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Estoc disponible</label>' +
            '<input type="text" value="' + _esc(String(estocActual)) + ' ' + _esc(unitat) + '" readonly style="opacity:.7;">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Quantitat gastada *</label>' +
            '<input type="number" id="con-quantitat" min="1" max="' + estocActual + '" step="1" placeholder="0" style="font-size:1.1rem;">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Grup / Projecte *</label>' +
            '<input type="text" id="con-grup" placeholder="Ex: 2n ESO — Robot seguidor">' +
          '</div>' +
          '<p id="con-error" class="form-error" style="display:none;"></p>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-secondary" id="con-cancel">Cancel·la</button>' +
          '<button class="btn-primary" id="con-submit">Registrar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);
    backdrop.querySelector('#con-quantitat').focus();

    function _tanca() { backdrop.remove(); }
    backdrop.querySelector('#con-close').addEventListener('click', _tanca);
    backdrop.querySelector('#con-cancel').addEventListener('click', _tanca);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) _tanca(); });

    backdrop.querySelector('#con-submit').addEventListener('click', async function () {
      const btn      = backdrop.querySelector('#con-submit');
      const errEl    = backdrop.querySelector('#con-error');
      const quantitat= Number(backdrop.querySelector('#con-quantitat').value);
      const grup     = backdrop.querySelector('#con-grup').value.trim();

      errEl.style.display = 'none';

      if (!quantitat || quantitat <= 0) {
        errEl.textContent = 'Introdueix una quantitat vàlida (> 0).';
        errEl.style.display = ''; return;
      }
      if (quantitat > estocActual) {
        errEl.textContent = 'La quantitat supera l\'estoc disponible (' + estocActual + ' ' + unitat + ').';
        errEl.style.display = ''; return;
      }
      if (!grup) {
        errEl.textContent = 'El grup/projecte és obligatori.';
        errEl.style.display = ''; return;
      }

      btn.disabled = true; btn.textContent = 'Registrant…';

      try {
        const res = await API.inventari.registreConsum(matId, quantitat, grup);
        Toast.ok('Consum registrat. Nou estoc: ' + (res.nou_estoc !== undefined ? res.nou_estoc : '—') + ' ' + unitat);
        _tanca();
        await _carrega();
      } catch (err) {
        errEl.textContent = err.message || 'Error registrant el consum.';
        errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Registrar';
      }
    });
  }

  // ── Modal editar material (ADMIN) ─────────────────────────

  function _obreModalEditarMaterial(mat) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<span class="modal-title">Editar material</span>' +
          '<button class="modal-close" id="edit-close">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          _campForm('edit-nom',    'Nom del material *',   'text',   mat['Nom_Material'] || '') +
          '<div class="form-row">' +
            _campForm('edit-unitat',  'Unitat',               'text',   mat['Unitat']    || '') +
            _campForm('edit-cat',     'Categoria',            'text',   mat['Categoria'] || '') +
          '</div>' +
          '<div class="form-row">' +
            _campForm('edit-taller',  'Taller',               'text',   mat['Taller']    || '') +
            _campForm('edit-estoc',   'Estoc actual *',       'number', mat['Estoc_Actual'] || 0) +
          '</div>' +
          _campForm('edit-minim',  'Estoc mínim *',        'number', mat['Estoc_Minim'] || 0) +
          '<p id="edit-error" class="form-error" style="display:none;"></p>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-secondary" id="edit-cancel">Cancel·la</button>' +
          '<button class="btn-primary" id="edit-submit">Desar canvis</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    function _tanca() { backdrop.remove(); }
    backdrop.querySelector('#edit-close').addEventListener('click', _tanca);
    backdrop.querySelector('#edit-cancel').addEventListener('click', _tanca);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) _tanca(); });

    backdrop.querySelector('#edit-submit').addEventListener('click', async function () {
      const btn   = backdrop.querySelector('#edit-submit');
      const errEl = backdrop.querySelector('#edit-error');
      const nom   = backdrop.querySelector('#edit-nom').value.trim();
      const estoc = Number(backdrop.querySelector('#edit-estoc').value);
      const minim = Number(backdrop.querySelector('#edit-minim').value);

      errEl.style.display = 'none';
      if (!nom) {
        errEl.textContent = 'El nom del material és obligatori.';
        errEl.style.display = ''; return;
      }

      btn.disabled = true; btn.textContent = 'Desant…';

      try {
        await API.inventari.updateMaterial(mat['ID_Material'], {
          Nom_Material:  nom,
          Unitat:        backdrop.querySelector('#edit-unitat').value.trim(),
          Categoria:     backdrop.querySelector('#edit-cat').value.trim(),
          Taller:        backdrop.querySelector('#edit-taller').value.trim(),
          Estoc_Actual:  estoc,
          Estoc_Minim:   minim,
          Estat_Alerta:  estoc <= minim ? '🚨 REPOSAR' : 'OK',
        });
        Toast.ok('Material actualitzat correctament.');
        _tanca();
        await _carrega();
      } catch (err) {
        errEl.textContent = err.message || 'Error desant els canvis.';
        errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Desar canvis';
      }
    });
  }

  // ── Modal nou material (ADMIN) ────────────────────────────

  function _obreModalNouMaterial() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<span class="modal-title">Nou material</span>' +
          '<button class="modal-close" id="nou-close">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          _campForm('nou-id',     'ID Material *',        'text',   '',  'Ex: MAT-FILAMENT-PLA') +
          _campForm('nou-nom',    'Nom del material *',   'text',   '',  'Ex: Filament PLA 1.75mm') +
          '<div class="form-row">' +
            _campForm('nou-unitat',  'Unitat *',          'text',   '',  'Ex: kg, unitats, m...') +
            _campForm('nou-cat',     'Categoria *',       'text',   '',  'Ex: Impressió 3D') +
          '</div>' +
          '<div class="form-row">' +
            _campForm('nou-taller',  'Taller *',          'text',   '',  'Ex: Taller 1') +
            _campForm('nou-estoc',   'Estoc inicial *',   'number', 0) +
          '</div>' +
          _campForm('nou-minim',  'Estoc mínim *',        'number', 0) +
          '<p id="nou-error" class="form-error" style="display:none;"></p>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn-secondary" id="nou-cancel">Cancel·la</button>' +
          '<button class="btn-primary" id="nou-submit">Crear material</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);
    backdrop.querySelector('#nou-id').focus();

    function _tanca() { backdrop.remove(); }
    backdrop.querySelector('#nou-close').addEventListener('click', _tanca);
    backdrop.querySelector('#nou-cancel').addEventListener('click', _tanca);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) _tanca(); });

    backdrop.querySelector('#nou-submit').addEventListener('click', async function () {
      const btn   = backdrop.querySelector('#nou-submit');
      const errEl = backdrop.querySelector('#nou-error');

      const idMat  = backdrop.querySelector('#nou-id').value.trim();
      const nom    = backdrop.querySelector('#nou-nom').value.trim();
      const unitat = backdrop.querySelector('#nou-unitat').value.trim();
      const cat    = backdrop.querySelector('#nou-cat').value.trim();
      const taller = backdrop.querySelector('#nou-taller').value.trim();
      const estoc  = Number(backdrop.querySelector('#nou-estoc').value);
      const minim  = Number(backdrop.querySelector('#nou-minim').value);

      errEl.style.display = 'none';

      if (!idMat || !nom || !unitat || !cat || !taller) {
        errEl.textContent = 'Omple tots els camps obligatoris (*).';
        errEl.style.display = ''; return;
      }
      if (_materials.some(function (m) { return m['ID_Material'] === idMat; })) {
        errEl.textContent = 'Ja existeix un material amb aquest ID.';
        errEl.style.display = ''; return;
      }

      btn.disabled = true; btn.textContent = 'Creant…';

      try {
        await API.inventari.createMaterial({
          ID_Material:  idMat,
          Nom_Material: nom,
          Unitat:       unitat,
          Categoria:    cat,
          Taller:       taller,
          Estoc_Actual: estoc,
          Estoc_Minim:  minim,
          Estat_Alerta: estoc <= minim ? '🚨 REPOSAR' : 'OK',
        });
        Toast.ok('Material "' + nom + '" creat correctament.');
        _tanca();
        await _carrega();
      } catch (err) {
        errEl.textContent = err.message || 'Error creant el material.';
        errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Crear material';
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  function _campForm(id, label, type, value, placeholder) {
    return '<div class="form-group">' +
      '<label>' + _esc(label) + '</label>' +
      '<input type="' + type + '" id="' + id + '" value="' + _esc(String(value)) + '"' +
      (placeholder ? ' placeholder="' + _esc(placeholder) + '"' : '') +
      (type === 'number' ? ' min="0" step="1"' : '') +
      '>' +
    '</div>';
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
  MODULES['inventari'] = ModulInventari;
}

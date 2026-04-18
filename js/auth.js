/* ============================================================
   FAIG Lab — Auth module
   ============================================================ */

window.Auth = (function () {

  const SESSION_TOKEN_KEY = 'faig_token';
  const SESSION_USER_KEY  = 'faig_user';

  let _tokenClient = null;
  let _token       = null;
  let _user        = null;
  let _onReady     = null;

  // ── Init ──────────────────────────────────────────────────

  function init(onReadyCallback) {
    _onReady = onReadyCallback;

    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const savedUser  = sessionStorage.getItem(SESSION_USER_KEY);

    if (savedToken && savedUser) {
      _token = savedToken;
      _user  = JSON.parse(savedUser);
      _verifyWithGAS();
    } else {
      _showLoginUI();
    }
  }

  // ── Login UI ──────────────────────────────────────────────

  function _showLoginUI() {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      setTimeout(_showLoginUI, 200);
      return;
    }
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: FAIG_CONFIG.GOOGLE_CLIENT_ID,
      scope: FAIG_CONFIG.OAUTH_SCOPE,
      callback: _handleTokenResponse,
    });
    document.getElementById('app-login').style.display = 'flex';
    document.getElementById('app-main').style.display = 'none';
  }

  // ── Token response ────────────────────────────────────────

  function _handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) {
      _showLoginError('Error d\'autenticació: ' + tokenResponse.error);
      return;
    }

    _token = tokenResponse.access_token;
    sessionStorage.setItem(SESSION_TOKEN_KEY, _token);
    _verifyWithGAS();
  }

  // ── Verify with GAS ───────────────────────────────────────

  async function _verifyWithGAS() {
    try {
      const user = await API.call('getMe');

      if (!user || !user.email) {
        _clearSession();
        _showLoginUI();
        _showLoginError('El teu compte no està autoritzat a FAIG Lab. Contacta amb un administrador.');
        return;
      }

      _user = user;
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(_user));

      // Actualitza badge de rol amb data-nivell per als colors CSS
      const roleBadge = document.getElementById('user-role');
      if (roleBadge) {
        roleBadge.setAttribute('data-nivell', _user.nivell || '');
      }

      if (typeof _onReady === 'function') {
        _onReady(_user);
      }
    } catch (_err) {
      _clearSession();
      _showLoginUI();
      _showLoginError('El teu compte no està autoritzat a FAIG Lab. Contacta amb un administrador.');
    }
  }

  // ── login / logout ────────────────────────────────────────

  function login() {
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.style.display = 'none';

    if (!_tokenClient) {
      _showLoginUI();
    }
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function logout() {
    if (_token) {
      google.accounts.oauth2.revoke(_token, function () {});
    }
    _clearSession();
    location.reload();
  }

  // ── Helpers ───────────────────────────────────────────────

  function _clearSession() {
    _token = null;
    _user  = null;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

  function _showLoginError(msg) {
    const errEl = document.getElementById('login-error');
    if (!errEl) return;
    errEl.textContent    = msg;
    errEl.style.display  = '';
  }

  // ── Getters ───────────────────────────────────────────────

  function getToken()   { return _token; }
  function getUser()    { return _user;  }
  function isLoggedIn() { return !!_token && !!_user; }
  function isAdmin()    { return !!_user && _user.nivell === 'ADMIN'; }
  function isUsuari()   { return !!_user && _user.nivell === 'USUARI'; }

  // ── API pública ───────────────────────────────────────────

  return {
    init,
    login,
    logout,
    getToken,
    getUser,
    isLoggedIn,
    isAdmin,
    isUsuari,
  };

})();

const FAIG_CONFIG = {
  GAS_URL: 'PENDENT',
  GOOGLE_CLIENT_ID: 'PENDENT',
  OAUTH_SCOPE: 'openid email profile',
  APP_NAME: 'FAIG Lab',
  CENTRE: 'Institut Maria Espinalt',
  NIVELLS: {
    ADMIN: 'ADMIN',
    USUARI: 'USUARI',
    ALUMNE: 'ALUMNE',
  },
  ESTATS_MAQUINA: {
    OPERATIVA: 'Operativa',
    AVARIAD: 'Avariada',
    MANTENIMENT: 'Manteniment',
    STANDBY: 'Standby - No disponible',
    REVISIO: 'Revisió pendent',
  },
  ESTATS_RESERVA: {
    CONFIRMADA: 'confirmada',
    PENDENT_PERMIS: 'pendent_permís',
    APROVADA: 'aprovada',
    DENEGADA: 'denegada',
    SUSPESA: 'suspesa',
    CANCELADA: 'cancel·lada',
  },
  URGENCIES: [
    '🟢 Pot esperar',
    '🟡 Atenció requerida',
    '🟠 Problema seriós',
    '🔴 Màquina aturada',
    '🚨 Emergència / Risc',
  ],
};

Object.freeze(FAIG_CONFIG);

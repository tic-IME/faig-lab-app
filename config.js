const FAIG_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxfqvG-tQnvNAuNl3W-Ai5SIY0A9dzh9wMtjYAEfclvcQIu3axxMmRjUs8idEuUXbcH/exec',
  GOOGLE_CLIENT_ID: '401812600474-8j16um5i49hu5v1bsjab7trnp7ao2lr8.apps.googleusercontent.com',
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

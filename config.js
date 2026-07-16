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
  // Formulari públic d'incidències del centre (via única d'entrada; motor de regles al backend)
  FORM_INCIDENCIES_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSepRkglU9XDUAO5pefruvbvxSkV4RyJxP_GrZ69_qQjQmAAlg/viewform',
  // Entry ID de la pregunta de màquina del formulari: permet preseleccionar-la amb usp=pp_url
  FORM_INCIDENCIES_ENTRY_MAQUINA: 'entry.1463811996',
  // Formulari públic d'encàrrecs als espais maker (via única d'entrada, igual que incidències).
  // Viu aquí i no a Script Properties perquè NO és cap secret (el mateix URL va imprès en un QR
  // a la paret) i perquè un botó que depengués d'una crida al backend tindria un mode de fallada
  // a canvi de res. La neteja de la FASE 4 va del BACKEND (Form ID d'edició, Script ID), no
  // d'aquesta config pública. Sense preemplenat: l'encàrrec no va lligat a cap màquina.
  FORM_ENCARRECS_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSfLdQD6-Lh6aHJ_Si0z1iUiYSjSjGEv7z2Jhdnd8iU-3B_GTQ/viewform',
};

Object.freeze(FAIG_CONFIG);

# assets

## Logo del centre

Fitxer actual: **`logo_lluerna_verd.png`** — la lluerna de l'Institut Maria
Espinalt.

L'app el mostra a la barra lateral i a la pantalla d'entrada, i el llegeix de
`LOGO_URL` a `config.js` (arrel del repositori). **El nom del fitxer és
indiferent**: manda el que digui `LOGO_URL`.

**Si el fitxer no hi és, l'app NO es trenca**: es queda amb l'emoji ⚙ de sempre.
La imatge només substitueix l'emoji si carrega de debò.

Per a un centre que repliqui l'app: deixeu el vostre logo en aquesta carpeta i
apunteu-hi `LOGO_URL`, o buideu `LOGO_URL` per quedar-vos amb l'emoji.

### Especificacions del fitxer

- **Format**: PNG amb **fons transparent** (el logo va sobre el blau fosc de la
  barra lateral i sobre la targeta blanca del login: amb fons opac es veuria el
  rectangle).
- **Alçada**: **60 px mínim**, idealment **96 px** (es mostra a 30 px a la barra
  i 48 px al login; el doble cobreix les pantalles retina).
- **Amplada**: lliure, proporcional. L'app la limita a 120 px a la barra lateral
  i 220 px al login, i escala mantenint la proporció.
- **Pes**: per sota de 50 kB.
- **Contrast**: ha de llegir-se sobre **fons fosc** (barra lateral, #0f2a52) i
  sobre **fons clar** (targeta de login). Un logo tot negre desapareixerà a la
  barra: si el vostre ho és, feu servir la versió blanca o monocroma clara.

Si preferiu SVG, canvieu l'extensió a `config.js`: l'app no assumeix el format.

## Llicència

**El logo i la marca del centre NO entren a la llicència GPL-3.0** que cobreix
el codi. Veure el README de l'arrel.

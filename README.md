# FAIG Lab

Sistema de gestió de l'espai maker (FAIG Lab) de l'**Institut Maria Espinalt**
(Barcelona). Gestiona reserves de màquines, checklists de seguretat, incidències,
inventari i una canonada d'encàrrecs del professorat.

Està fet per funcionar amb el que un institut ja té: **un compte de Google
Workspace i res més**. Sense servidor, sense base de dades, sense cap cost.

---

## Què és un centre FAIG

FAIG és un programa de centres amb espai maker. El bessó no és la maquinària: és
que **el professorat pugui materialitzar projectes amb l'acompanyament d'un
equip**, incloent-hi els projectes que encara no sap definir.

Això no és retòrica de README: està escrit dins l'app. El formulari d'encàrrecs
no obliga a posar una data (té l'opció *«Encara no ho sé / ho volem parlar»*), i
la porta d'entrada diu explícitament *«No cal que ho tinguis tot clar per
demanar-ho»*. Si repliqueu l'app, aquesta és la peça que val la pena copiar
abans que cap altra.

---

## Arquitectura — tres peces

```
┌─────────────────┐   HTTPS + token OAuth   ┌──────────────────┐
│   FRONTEND      │ ──────────────────────► │    BACKEND       │
│   HTML/CSS/JS   │                         │  Google Apps     │
│   GitHub Pages  │ ◄────────────────────── │  Script (web app)│
└─────────────────┘         JSON            └────────┬─────────┘
                                                     │
                                            ┌────────▼─────────┐
                                            │   DADES          │
                                            │  Full de càlcul  │
                                            │  + Google Forms  │
                                            └──────────────────┘
```

| Peça | Què és | On viu |
|---|---|---|
| **Frontend** | HTML/CSS/JS estàtic, sense build ni dependències de node | Aquest repositori, publicat amb GitHub Pages |
| **Backend** | Un projecte de Google Apps Script desplegat com a web app | Apps Script. Còpia llegible a [`apps-script/`](apps-script/) |
| **Dades** | Un full de càlcul de Google amb ~12 pestanyes, més dos formularis | Google Drive |

L'autenticació és **Google Identity Services** al navegador; el backend valida el
token contra l'API de Google i comprova el correu contra la pestanya
`Usuaris_autoritzats`.

### `apps-script/` és una INSTANTÀNIA, no la font de veritat

La font de veritat del backend és **el projecte viu d'Apps Script**. La carpeta
[`apps-script/`](apps-script/) és una còpia **datada i sanejada** perquè es pugui
llegir i replicar el codi sense accés al nostre projecte.

Cada fitxer comença amb una capçalera que diu **de quin dia és i de quina versió
desplegada**. Es desincronitzarà: si la data és antiga, no us hi refieu. Es
regenera amb `node tools/publica-backend.js <versió>` després d'un `clasp pull`.

Els identificadors del centre hi són substituïts per **placeholders**. Cerqueu
`POSA-HI-` i `el-teu-domini.cat`.

---

## ⚠️ LA REGLA D'OR: els noms exactes

> **Aquesta és la font d'error número u del projecte. Llegiu-la abans de tocar
> res.**
>
> El backend localitza les columnes **pel text exacte de la capçalera**. Un
> accent, un espai de més, un apòstrof tipogràfic (`'`) en lloc del recte (`'`),
> una majúscula: qualsevol diferència i **la columna deixa d'existir per al codi**.
>
> Segons el camí, això peta amb un error clar **o falla en silenci**. Els camins
> que escriuen amb `appendRow` ho fan **per POSICIÓ**: si canvieu l'ordre de les
> columnes, l'app escriurà a la columna equivocada **sense dir res**.
>
> Copieu i enganxeu els noms d'aquest document. **No els reteclegeu.**

Trampes concretes que ja ens han picat:

- `Incidències_Respostes` porta accents. `Encarrecs_Respostes` **no en porta**.
- `Hora_Inici`/`Hora_Final` (Reserves) van en **majúscula** i són **text**;
  `Hora_inici`/`Hora_final` (Horari_Tallers) van en **minúscula** i són **valors
  d'hora reals**. Són dos móns diferents i no s'han de barrejar mai.
- `Grup/Projecte` porta una **barra**.
- `Padrí/padrina FAIG`, `Departament / àmbit`, `Nom del docent sol·licitant`
  (punt volat), `Títol curt de l'encàrrec` (apòstrof recte).
- **Cap pregunta d'un formulari es pot dir exactament `Estat`**: el codi busca la
  primera coincidència i escriuria a la columna equivocada.

---

## Guia de rèplica des de zero

Tot això es fa **des del compte institucional del centre** (nosaltres en diem
`tic@`), mai des d'un compte personal: el professorat interí pot desaparèixer del
domini, i els triggers i els formularis pertanyen a qui els crea.

### 1. El full de càlcul mestre

Creeu un full nou. **Configuració → Zona horària: la vostra** (per defecte Google
en posa una d'americana; a nosaltres ens va desplaçar totes les dates 9 hores).

Creeu aquestes pestanyes amb **aquests noms i aquest ordre de columnes**.

#### `Control_Màquines` — el catàleg de màquines

| # | Capçalera | Notes |
|---|---|---|
| 1 | `ID_Maquina` | Identificador únic. Ex.: `3D-ENDER-01`, `LASER-FLUX-01` |
| 2 | `ID_Protocol` | Enllaça amb `Protocol_Items` |
| 3 | `Tipus_Maquina` | |
| 4 | `Ubicació` | Ha de casar EXACTAMENT amb `Ubicació` d'`Horari_Tallers` |
| 5 | `Estat_Actual` | `Operativa`, `Avariada`, `Manteniment`, `Standby - No disponible`, `Revisió pendent` |
| 6 | `Imatge_Maquina` | **Informativa: cap codi la llegeix** |
| 7 | `Darrera_Revisió` | |
| 8 | `Manual_URL` | |

Aquest full és **la font autoritativa dels IDs de màquina**. Les opcions del
formulari d'incidències hi han de casar una a una.

#### `Usuaris_autoritzats` — qui pot entrar

| # | Capçalera |
|---|---|
| 1 | `Email_Usuari` |
| 2 | `Nom_Usuari` |
| 3 | `Nivell_Permis` |
| 4 | `Autoritzat_Laser` |
| 5 | `Autoritzat_3D` |

L'ordre és **obligatori**: `createUsuari` hi escriu per posició.

`Nivell_Permis` amb el valor exacte `ADMIN` dona permisos d'administració.
Qualsevol altre correu del domini del centre entra com a usuari normal.

> **Limitació honesta:** avui `validateToken` només distingeix `ADMIN` de la
> resta. Els altres valors de `Nivell_Permis` **no es llegeixen**.

#### `Reserves`

| # | Capçalera | | # | Capçalera |
|---|---|---|---|---|
| 1 | `ID_Reserva` | | 7 | `Docent_Responsable` |
| 2 | `Usuari` | | 8 | `Grup/Projecte` |
| 3 | `ID_Maquina` | | 9 | `Estat_Reserva` |
| 4 | `Data_Reserva` | | 10 | `He parlat amb el profe?` |
| 5 | `Hora_Inici` | | 11 | `Token_Permis` |
| 6 | `Hora_Final` | | 12 | `Email_Titular` |

El codi escriu les **10 primeres per posició**. Les columnes 11-12 són d'un
circuit d'aprovacions per correu que no s'executa mai.

> **⚠️ Aquesta pestanya té una trampa que ens va costar un dia.** `Data_Reserva`,
> `Hora_Inici` i `Hora_Final` han de contenir **text pla** (`'AAAA-MM-DD'` i
> `'HH:MM'`), no valors de data ni d'hora.
>
> **Google Sheets PARSEJA les cadenes en escriure-les si la cel·la no té format
> text.** Escriure-hi `'2026-09-14'` en una cel·la de format automàtic la
> converteix en una DATA REAL. El codi es protegeix sol (`setNumberFormat('@')`
> abans d'escriure), però si hi poseu files a mà, poseu-les com a text.
>
> No és cosmètic: la detecció de solapaments **compara dates com a cadenes**, i
> una fila amb la data desada com a data real deixa la franja reservable dues
> vegades sense cap avís.

#### `Horari_Tallers` — la graella de classes

| # | Capçalera | Notes |
|---|---|---|
| 1 | `ID_Horari` | |
| 2 | `Dia de la setmana` | Numèric: 2 = dilluns … 6 = divendres |
| 3 | `Dia_Nom` | |
| 4 | `Hora_inici` | **minúscula**, valor d'hora real |
| 5 | `Hora_final` | **minúscula**, valor d'hora real |
| 6 | `Assignatura_Grup` | |
| 7 | `Professor_titular` | |
| 8 | `Ubicació` | Ha de casar amb `Ubicació` de `Control_Màquines` |
| 9 | `Correu_Titular` | |
| 10 | `Estat_Permís` | No es llegeix |

> **NO és una llista de classes: és una graella exhaustiva** de franges de 30
> minuts que cobreix tot l'horari lectiu, els dos tallers inclosos. Les franges
> **sense** classe hi són igualment, amb `Assignatura_Grup` buit.
>
> **La condició «hi ha classe» és `Assignatura_Grup` NO BUIT.** Qui filtri sense
> comprovar-ho tindrà classe a totes hores.

#### `Protocol_Items` — els checklists de seguretat

| # | Capçalera | Notes |
|---|---|---|
| 1 | `ID_Protocol` | **Contracte.** Enllaça amb `Control_Màquines` |
| 2 | `Bloc` | **Contracte.** Es pinta com a descripció de l'ítem |
| 3 | `Ordre` | **Cap codi la llegeix** — veure l'avís |
| 4 | `Text_Item` | **Contracte.** Es pinta com a títol de l'ítem |
| 5 | `Obligatori` | **Cap codi la llegeix** — veure l'avís |

> **⚠️ Dues columnes prometen coses que el codi no compleix.** Els ítems surten en
> **ordre de fila del full**, no per la columna `Ordre`: canviar-la no fa res.
> I `Obligatori` és decorativa: la interfície **exigeix marcar-los tots**, digui
> el que digui la columna.
>
> Si repliqueu l'app: per ordenar els ítems, **ordeneu les files**.

Les màquines que comparteixen `ID_Protocol` comparteixen checklist. Un sol
checklist val per a un lot de reserves **només si totes les màquines comparteixen
`ID_Protocol`** — el contrari seria una mentida de seguretat.

#### `Inventari_materials`

| # | Capçalera | | # | Capçalera |
|---|---|---|---|---|
| 1 | `ID_Material` | | 5 | `Taller` |
| 2 | `Nom_Material` | | 6 | `Estoc_Actual` |
| 3 | `Unitat` | | 7 | `Estoc_Minim` |
| 4 | `Categoria` | | 8 | `Estat_Alerta` |

L'ordre és **obligatori**: `createMaterial` hi escriu per posició.

#### `Registre_Consum`

| # | Capçalera |
|---|---|
| 1 | `ID_Consum` |
| 2 | `Data_Hora` |
| 3 | `Usuari` |
| 4 | `ID_Material` |
| 5 | `Quantitat_Gastada` |
| 6 | `Grup/Projecte` |

L'ordre és **obligatori**: el codi **hi escriu i no la llegeix mai**, o sigui que
un error d'ordre aquí **no petarà mai**. Es limitarà a omplir columnes
equivocades per sempre.

#### `Registre_Checklists`

**No cal que la creeu**: `registreChecklist` la crea sola la primera vegada, amb
la capçalera correcta. Si la voleu avançar:

`ID_Checklist` · `Data_Hora` · `Email_Usuari` · `Nom_Usuari` · `ID_Maquina` ·
`ID_Reserva` · `ID_Protocol` · `Bloc_Completat` · `Items_SI_Total` ·
`PDF_Descarregat`

#### `Incidències_Respostes` i `Encarrecs_Respostes`

**Aquestes dues no es creen a mà.** Les crea Google en lligar cada formulari al
full (pas 2), i després es **reanomenen** amb aquests noms exactes.

Google hi escriu una columna per pregunta, i **el títol de cada pregunta es
converteix en la capçalera**. Això vol dir que **els títols de les preguntes són
part del contracte**: reescriure'n un trenca el codi que el busca.

Els títols que el codi busca per nom:

| Pestanya | Títol de pregunta que és contracte |
|---|---|
| `Incidències_Respostes` | `Marca de temps` (la posa Google) |
| | `Màquina afectada` |
| | `La màquina es pot continuar fent servir?` |
| | `Nom i cognom (docent responsable)` |
| `Encarrecs_Respostes` | `Marca de temps` (la posa Google) |
| | `Nom del docent sol·licitant` |
| | `Departament / àmbit` |
| | `Títol curt de l'encàrrec` |

La resta de columnes les genera el formulari i el codi no les anomena: hi són,
surten al detall de l'app, i podeu canviar-les lliurement.

**A la dreta de les de Google**, afegiu-hi a mà les columnes de gestió:

- `Incidències_Respostes` (4): `ID_Incidencia` · `Estat` · `Data_Canvi_Estat` ·
  `Gestionada_Per`
- `Encarrecs_Respostes` (11): `ID_Encarrec` · `Estat` · `Data_Canvi_Estat` ·
  `Gestionat_Per` · `Padrí/padrina FAIG` · `Alumnat especialitzat` ·
  `Espai i reserva` · `Data planificada` · `Data feta` · `Evidència` ·
  `Notes_FAIG`

Les **4 primeres** de cada llista les escriu el codi; la resta són a mà.

> Ull: `Gestionada_Per` (incidències, femení) i `Gestionat_Per` (encàrrecs,
> masculí) **no s'escriuen igual**. És així al codi.

---

### 2. Els dos formularis

Creeu-los **des del compte institucional** i **lligueu-los al full mestre**
(Respostes → *Enllaça amb un full de càlcul* → el full existent). Google crearà
una pestanya de respostes: **reanomeneu-la** a `Incidències_Respostes` o
`Encarrecs_Respostes`.

> **Per què lligar-los i no escriure les files des del codi:** així **la fila la
> garanteix Google**. Si un trigger falla, la fila hi és igualment i es veu que
> li falta l'ID. Amb el disseny contrari, una fallada de trigger fa desaparèixer
> l'encàrrec del full **i ningú se n'assabenta**.

Activeu **Recull adreces electròniques → Verificat**: obliga a iniciar sessió i
captura el correu de qui respon.

> **Restricció al domini:** l'opció *«Restringeix als usuaris de…»* pot no
> existir al vostre Workspace (al nostre no hi és, i cridar
> `form.setRequireLogin(true)` des del codi peta amb un error que enganya:
> «Failed to edit the form. Please wait and try again», que **no és transitori**).
> Si la teniu, activeu-la a mà. Si no, el mode Verificat ja dona identitat
> traçable.

**Formulari d'incidències.** Ha de tenir una pregunta amb la màquina afectada
amb **una opció per cada `ID_Maquina`** de `Control_Màquines`, escrites igual.
El motor d'escalada casa fragments de text de les preguntes i les opcions: si
en reescriviu una, reviseu la taula `REGLES` d'`Incidencies.js`.

**Formulari d'encàrrecs.** Feu que la data **no sigui obligatòria** i afegiu-hi
una pregunta tipus *«Tens una data o fita?»* amb una sortida *«Encara no ho sé /
ho volem parlar»*. Sense això, qui ve amb una idea difusa a demanar
acompanyament queda barrat a la porta per un camp de data — que és exactament el
contrari del que fa un centre FAIG.

### 3. El backend

1. Creeu un projecte d'Apps Script i copieu-hi els fitxers d'[`apps-script/`](apps-script/).
2. Substituïu els placeholders (`POSA-HI-…`, `el-teu-domini.cat`).
3. **Configuració → Propietats de l'script**, afegiu-hi:
   - `SHEET_ID` — l'ID del vostre full mestre
   - `GAS_URL` — l'URL del web app (la sabreu al pas 4; torneu-hi després)
   - `FORM_ENCARRECS_ID` — l'ID **d'edició** del formulari d'encàrrecs
4. **Desplega → Desplegament nou → Aplicació web**, amb *Executa com a: jo* i
   *Qui hi té accés: qualsevol*. Copieu-ne l'URL.
5. Torneu al pas 3 i ompliu `GAS_URL`.

> **⚠️ La regla que més ens ha costat:** el web app serveix el **snapshot de la
> versió desplegada**, no l'últim codi desat. **Qualsevol canvi de codi necessita
> una versió nova del desplegament.** Un `clasp push` sense versió nova no és
> inofensiu: deixa codi que sembla desplegat i que explotarà quan algú desplegui
> mesos després, per un motiu sense relació.
>
> **Editeu SEMPRE el desplegament existent → versió nova.** Un «desplegament nou»
> genera una URL diferent que l'app no crida.
>
> Els **triggers** són l'excepció: sempre executen l'últim codi desat.

### 4. Els triggers

Creeu-los **tots des del mateix compte**. `ScriptApp.getProjectTriggers()` només
retorna els del compte que executa: «no el veig» **no vol dir «no existeix»**, i
codi que crea un trigger «si no hi és» en pot crear un de segon i duplicar avisos
per sempre.

| Funció | Tipus | Feina |
|---|---|---|
| `processarIncidencia` | Formulari (incidències) | Motor d'escalada + avís |
| `estampaIncidenciaNova` | Full mestre, en enviar formulari | Estampa `ID_Incidencia` i `Estat` |
| `processarEncarrec` | Formulari (encàrrecs) | Avís als admins |
| `estampaEncarrecNou` | Full mestre, en enviar formulari | Estampa `ID_Encarrec` i `Estat` |
| `alertaIncidenciesEncallades` | Rellotge, diari | Avisa d'incidències encallades |

Els dos triggers de **full** salten amb **tots dos formularis**: cadascun
comprova el nom de la pestanya i surt si no és la seva. **Aquestes dues guardes
són imprescindibles**: sense elles, un encàrrec escriuria a les columnes
d'incidències.

Els triggers de formulari (`e.response`) i els de full (`e.range`) **no es poden
fusionar**: cap dels dos rep el que necessita l'altre.

### 5. El frontend

1. Feu un fork o una còpia d'aquest repositori i activeu **GitHub Pages**.
2. Creeu un **Client ID d'OAuth 2.0** (tipus *Aplicació web*) a Google Cloud, amb
   l'origen de les Pages autoritzat.
3. Editeu [`config.js`](config.js) — és a **l'arrel**, no a `js/`:

| Clau | Què hi va |
|---|---|
| `GAS_URL` | L'URL del web app del pas 3 |
| `GOOGLE_CLIENT_ID` | El Client ID d'OAuth |
| `CENTRE` | El nom del vostre centre |
| `FORM_INCIDENCIES_URL` | URL **de resposta** del formulari d'incidències |
| `FORM_ENCARRECS_URL` | URL **de resposta** del formulari d'encàrrecs |
| `FORM_INCIDENCIES_ENTRY_MAQUINA` | Veure sota |
| `LOGO_URL` | El vostre logo, o buit per quedar-vos amb l'emoji |

`FORM_INCIDENCIES_ENTRY_MAQUINA` és l'`entry.NNNNNNNN` de la pregunta de màquina:
serveix per obrir el formulari amb la màquina ja preseleccionada des de la seva
targeta. El traieu del menú ⋮ del formulari → *Emplena prèviament el formulari*.

> Si algú canvia aquella pregunta, **l'entry ID canvia i el preemplenat deixa de
> funcionar en silenci**.

Res de tot això és secret: són valors que el navegador de qualsevol usuari ja veu,
o que van impresos en un QR penjat a la paret.

---

## Desenvolupament

No hi ha build ni dependències: obriu els fitxers i editeu-los.

El backend es treballa amb [clasp](https://github.com/google/clasp):

```bash
cd backend                          # carpeta local, FORA de git
npx @google/clasp pull              # SEMPRE abans d'editar
npx @google/clasp push              # NO redesplega el web app
npx @google/clasp deploy -i <id> -d "..."   # versió nova sobre el desplegament existent
cd .. && node tools/publica-backend.js <versió>   # regenera apps-script/
```

**`clasp push` + versió nova + regenerar la instantània van junts.**

`node tools/comprova-secrets.js` comprova que no hi hagi identificadors del
centre al repositori. També s'executa a cada push (GitHub Actions).

---

## Llicència

Codi publicat sota la **GNU General Public License v3.0 o posterior**. Veure
[LICENSE](LICENSE).

> **La marca del centre queda FORA de la llicència.** El logo de l'Institut
> Maria Espinalt ([`assets/`](assets/)), el nom del centre i la seva imatge
> gràfica **no** es publiquen sota la GPL i no en podeu fer ús. Si repliqueu
> l'app, substituïu el logo pel vostre i canvieu `CENTRE` a `config.js`.

## Què NO hi ha en aquest repositori

- **Materials de difusió** (cartells, guies d'usuari, retolació dels tallers,
  presentacions): viuen a la unitat compartida del centre. Aquí, només codi i
  documentació de rèplica.
- **La carpeta de treball del backend** (`backend/`) i el seu `.clasp.json`, que
  porta l'Script ID.
- **Cap identificador del centre**: ni l'ID del full mestre, ni els IDs d'edició
  dels formularis, ni cap correu.

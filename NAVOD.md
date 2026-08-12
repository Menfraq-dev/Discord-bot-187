# 187 Strassenbande — Discord bot

## Co bot umí

- **Uvítací zpráva** s logem do welcome kanálu
- **Automatické role** při příchodu — fronta s opakováním, zvládne i nával lidí
- **Logy**: připojení, odchod, vyhození a ban (u kicku i banu ukáže kdo a proč)
- **`/vysilacka`** — panel s primární a sekundární frekvencí, tlačítka Status / Změna / PANIC. Panic přeladí sám a pingne roli.
- **`/rank`** — povýší člena a odebere mu starý rank
- **`/hierarchie`** — pošle strukturu frakce i s popisky
- **`/vsemroli`** — hromadně přidá nebo odebere roli všem
- **`/clear`** — smaže zprávy, kanál zůstane
- **`/info`** — panel s náhodně generovanými IP a hesly
- **`/text`** — víceřádkový text jako embed

Příkazy smí jen `staffRole` z configu a admini. Tlačítka jsou pro všechny.

---

## Nastavení

1. **`config.js`** — vyplň všechna místa označená `VLOZ_...`, hlavně IDs ranků
2. **`.env`** — vytvoř soubor s jediným řádkem: `TOKEN=tvuj_token`
3. V **Developer Portal** zapni `SERVER MEMBERS INTENT` a `MESSAGE CONTENT INTENT`
4. V nastavení serveru přetáhni roli bota **nad všechny ranky**, které má nastavovat

## Spuštění

```bash
npm install
node index.js
```

Vyžaduje **Node 20 nebo vyšší**.

---

## Hosting

Free plány mívají nestabilní síť. Projevuje se to chybou `EAI_AGAIN`,
nedoručenými zprávami nebo hláškou „Aplikace neodpovídá".

Bot je na to připravený — zprávy zkouší odeslat až čtyřikrát a role
řadí do fronty. Ale u interakcí dává Discord jen 3 sekundy na odpověď
a to už se z kódu ovlivnit nedá. Když síť vázne, tlačítka a příkazy
budou padat bez ohledu na to, jak je bot napsaný.

**Spolehlivější varianty:**

| Kde | Cena | Poznámka |
|---|---|---|
| Hetzner CX22 | ~120 Kč/měs | nejlepší poměr, Německo |
| Contabo VPS S | ~150 Kč/měs | víc výkonu, pomalejší disky |
| Sparked Host | od ~90 Kč/měs | Pterodactyl, netřeba Linux |
| Bot-Hosting.net Premium | od ~60 Kč/měs | nejlevnější upgrade |

Na VPS bota pusť přes pm2, ať běží i po odhlášení a sám se nahodí po restartu:

```bash
npm install -g pm2
pm2 start index.js --name 187bot
pm2 startup && pm2 save
```

Logy pak `pm2 logs 187bot`, restart `pm2 restart 187bot`.

---

## Diagnostika

Bot při startu zkontroluje všechny kanály a průběžně hlásí:

| Značka | Co znamená |
|---|---|
| `[KANÁL]` | kontrola kanálů při startu |
| `[INTERAKCE]` | každý příkaz i se zpožděním a pingem |
| `[POTVRZENÍ]` | interakce vypršela dřív, než šlo odpovědět |
| `[SPOJENÍ]` | výpadky a obnovení spojení s Discordem |
| `[ROLE]` | komu se přidala role a komu ne |
| `[WELCOME]`, `[LOG]` | odesílání zpráv |

Když se sypou `[LAG]` nebo `[SPOJENÍ]` řádky, problém je v síti hostingu.

---

## Soubory

| Soubor | K čemu |
|---|---|
| `index.js` | kód bota |
| `config.js` | IDs kanálů, rolí a nastavení |
| `logo.png` | logo do embedů |
| `.env` | token — **do gitu nepatří** |
| `radio.json` | stav frekvencí, vytvoří se sám |

## Časté problémy

**`/rank` hází chybu** — role bota není nad ranky v nastavení serveru.

**Role se nepřidávají** — zkontroluj `[ROLE]` řádky v konzoli, řeknou přesný důvod.

**Příkazy se neukazují** — dej Ctrl+R v Discordu.

**`Chybí TOKEN`** — soubor `.env` neexistuje nebo se jmenuje `.env.txt`.

**`Used disallowed intents`** — nemáš zapnuté intenty v Developer Portal.

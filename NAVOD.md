# 187 Strassenbande — Discord bot

## Co bot umí

- **Automatická role** — každý nový člen dostane roli (třeba Umfeld) hned po příchodu
- **Uvítací zpráva** — embed do welcome kanálu s avatarem a pořadovým číslem člena
- **Logy** — kdo se připojil, kdo odešel (i s jeho rankem), a každá změna rolí
- **Vysílačka** — `/vysilacka` pošle panel se třemi tlačítky; kdokoliv klikne, napíše zprávu do okna a ta se odešle do rádio kanálu
- **Ranky** — `/rank` povýší člena a automaticky mu sundá starý rank, takže má vždy jen jeden
- **Panel s rolemi** — `/panel` pošle tlačítka, kterými si lidi berou role sami
- **Hierarchie** — `/hierarchie` vypíše celou strukturu frakce

---

## 1. Vytvoření bota

1. Jdi na https://discord.com/developers/applications a dej **New Application**
2. V levém menu **Bot** → **Reset Token** → token si zkopíruj (ukáže se jen jednou)
3. Na stejné stránce zapni oba přepínače:
   - **SERVER MEMBERS INTENT**
   - **MESSAGE CONTENT INTENT**

   Bez prvního nebudou fungovat logy ani uvítačka.
4. V menu **OAuth2 → URL Generator** zaškrtni `bot` a `applications.commands`,
   dole pak `Manage Roles`, `Send Messages`, `Embed Links`, `View Channels`,
   `Mention Everyone`. Vygenerovaným odkazem bota pozveš na server.

## 2. Nastavení

1. V Discordu: **Nastavení → Pokročilé → Vývojářský režim** zapnout
2. Pravý klik na kanál/roli → **Kopírovat ID**
3. Otevři `config.js` a vyplň všechna místa, kde je `VLOZ_...`
4. Přejmenuj `.env.example` na `.env` a vlož do něj token

## 3. Spuštění

```bash
npm install
node index.js
```

Když se vypíše `[OK] Přihlášen jako ...`, běží to.

---

## Důležité: pořadí rolí

V **Nastavení serveru → Role** přetáhni roli bota **nad všechny ranky**,
které má nastavovat. Discord nedovolí botovi sáhnout na roli, která je
výš než ta jeho — je to nejčastější důvod, proč `/rank` nefunguje.

## Hostování 24/7

Doma na PC to běží jen dokud máš zapnutý počítač. Na nonstop provoz se
hodí **Pterodactyl panel** (většina CZ herních hostingů ho má za pár
stovek měsíčně) nebo malé VPS, kde bota pustíš přes `pm2`:

```bash
npm install -g pm2
pm2 start index.js --name 187bot
pm2 save
```

## Příkazy

| Příkaz | Kdo | Co dělá |
|---|---|---|
| `/vysilacka` | Manage Messages | pošle panel s tlačítky (stačí jednou) |
| tlačítka v panelu | **všichni** | otevřou okno na text, u 10-13 pingne @here |
| `/rank clen: rank:` | vedení + admin | nastaví rank a odebere starý |
| `/panel` | Manage Roles | pošle tlačítka s rolemi |
| `/hierarchie` | kdokoliv | vypíše strukturu frakce |

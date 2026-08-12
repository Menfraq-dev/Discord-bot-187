// ==========================================================
//  187 STRASSENBANDE - Discord bot
//  Spuštění: node index.js
// ==========================================================

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  MessageFlags,
  AuditLogEvent,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const fs = require("node:fs");

const config = require("./config.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.GuildMember],
});

// ---------- POMOCNÉ FUNKCE ----------

const path = require("node:path");

const LOGO_PATH = path.join(__dirname, "logo.png");

// ---------- VYSÍLAČKA: FREKVENCE ----------

const FREQ_MIN = 1.11;
const FREQ_MAX = 999.99;
const STATE_PATH = path.join(__dirname, "radio.json");

// Ochrana proti spamu
const radioCooldown = new Map();
const RADIO_COOLDOWN_MS = 15000;

// Za jak dlouho se smažou zprávy z vysílačky (5 s)
const ZPRAVA_SMAZAT_PO_MS = 5000;

// Stav vysílačky se ukládá do souboru, aby přežil restart bota
let radio = {
  primary: null,
  secondary: null,
  active: "primary", // na které z nich se právě vysílá
  changedBy: null,
  changedAt: null,
  panic: false,
  panelChannelId: null,
  panelMessageId: null,
};

// Aktuální frekvence = ta, na které zrovna jsou
function currentFreq() {
  return radio.active === "primary" ? radio.primary : radio.secondary;
}

function loadRadio() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      radio = { ...radio, ...JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) };
    }
  } catch (err) {
    console.error("[RADIO] Nepodařilo se načíst stav:", err.message);
  }
  if (!radio.primary) radio.primary = randomFreq();
  if (!radio.secondary) radio.secondary = randomFreq();
  saveRadio();
}

function saveRadio() {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(radio, null, 2));
  } catch (err) {
    console.error("[RADIO] Nepodařilo se uložit stav:", err.message);
  }
}

// Náhodná frekvence 1.11 – 999.99, nikdy stejná jako ty, co už běží
function randomFreq() {
  let f;
  do {
    f = (Math.random() * (FREQ_MAX - FREQ_MIN) + FREQ_MIN).toFixed(2);
  } while (f === radio.primary || f === radio.secondary);
  return f;
}

// ZMĚNA: vylosuje obě frekvence znovu a vrátí zpátky na primární
function novePasmo(userId) {
  const stara = currentFreq();
  radio.primary = randomFreq();
  radio.secondary = randomFreq();
  radio.active = "primary";
  radio.changedBy = userId;
  radio.changedAt = Date.now();
  radio.panic = false;
  saveRadio();
  return { stara, nova: currentFreq() };
}

// PANIC: přehodí na tu druhou frekvenci a spálenou nahradí novou
function panicSwitch(userId) {
  const stara = currentFreq();

  if (radio.active === "primary") {
    radio.active = "secondary";
    radio.primary = randomFreq(); // spálenou přegeneruj
  } else {
    radio.active = "primary";
    radio.secondary = randomFreq();
  }

  radio.changedBy = userId;
  radio.changedAt = Date.now();
  radio.panic = true;
  saveRadio();
  return { stara, nova: currentFreq() };
}

// Embed panelu — používá se při vytvoření i při každé aktualizaci
function panelEmbed() {
  const zmena = radio.changedAt
    ? `<t:${Math.floor(radio.changedAt / 1000)}:R>`
    : "nikdy";

  return new EmbedBuilder()
    .setColor(radio.panic ? config.colors.red : config.colors.main)
    .setTitle("📡 RADIO PANEL")
    .setDescription(
      `### AKTUÁLNÍ FREKVENCE\n` +
        `# \`${currentFreq()}\` MHz\n\n` +
        (radio.panic ? `🔴 **Poslední změna byla PANIC**\n\n` : "") +
        `Aktuálně jste na: \`${radio.active === "primary" ? "PRIMÁRNÍ" : "SEKUNDÁRNÍ"}\`\n\n` +
        `🔵 Primární frekvence: \`${radio.primary}\` MHz\n` +
        `🟠 Sekundární frekvence: \`${radio.secondary}\` MHz\n\n` +
        `Změněno: ${zmena}` +
        (radio.changedBy ? ` — <@${radio.changedBy}>` : "")
    )
    .setThumbnail("attachment://logo.png");
}

// Přepíše zprávu s panelem, ať tam vždy svítí aktuální frekvence
async function updatePanel() {
  if (!radio.panelChannelId || !radio.panelMessageId) return;
  try {
    const ch = await client.channels.fetch(radio.panelChannelId);
    const msg = await ch.messages.fetch(radio.panelMessageId);
    await msg.edit({ embeds: [panelEmbed()], components: [panelButtons()] });
  } catch (err) {
    console.error("[RADIO] Panel nejde aktualizovat:", err.message);
  }
}

function panelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("radio_status")
      .setLabel("Status")
      .setEmoji("📡")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("radio_change")
      .setLabel("Změna frekvence")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("radio_panic")
      .setLabel("PANIC")
      .setEmoji("🚨")
      .setStyle(ButtonStyle.Danger)
  );
}

// Příkazy, které smí kdokoliv (zatím žádné)
const VOLNE_PRIKAZY = [];

// Má člověk právo používat příkazy bota?
function maPristup(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.staffRole && member.roles.cache.has(config.staffRole)) return true;
  return false;
}

// Při startu projde kanály z configu a řekne, co nesedí
async function zkontrolujKanaly() {
  for (const [nazev, id] of Object.entries(config.channels)) {
    if (!id || id.startsWith("VLOZ")) {
      console.warn(`[KANÁL] ${nazev}: v configu není vyplněný`);
      continue;
    }

    try {
      const ch = await client.channels.fetch(id);

      if (!ch) {
        console.error(`[KANÁL] ${nazev}: kanál ${id} neexistuje`);
        continue;
      }

      if (!ch.isTextBased()) {
        console.error(`[KANÁL] ${nazev}: "${ch.name}" není textový kanál`);
        continue;
      }

      const prava = ch.permissionsFor(client.user);
      const chybi = [];
      if (!prava?.has(PermissionFlagsBits.ViewChannel)) chybi.push("Zobrazit kanál");
      if (!prava?.has(PermissionFlagsBits.SendMessages)) chybi.push("Posílat zprávy");
      if (!prava?.has(PermissionFlagsBits.EmbedLinks)) chybi.push("Vkládat odkazy");

      if (chybi.length) {
        console.error(`[KANÁL] ${nazev} (#${ch.name}): chybí práva — ${chybi.join(", ")}`);
      } else {
        console.log(`[KANÁL] ${nazev}: #${ch.name} OK`);
      }
    } catch (err) {
      console.error(`[KANÁL] ${nazev}: ${id} nejde načíst — ${err.message}`);
    }
  }

  // audit log je potřeba na rozpoznání kicku a banu
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const bot = await guild.members.fetchMe();
    if (!bot.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      console.warn(
        "[PRÁVA] Chybí Zobrazit audit log — u vyhození a banu nepůjde zjistit kdo a proč."
      );
    }
  } catch (err) {
    console.error("[PRÁVA] Nejde ověřit:", err.message);
  }
}

// ---------- FRONTA NA AUTOMATICKÉ ROLE ----------
// Když se připojí víc lidí naráz, Discord odmítá rychlé změny rolí.
// Proto se zpracovávají jeden po druhém a při neúspěchu se to zkusí znovu.

const frontaRoli = [];
let frontaBezi = false;

const POKUSU = 4;              // kolikrát to zkusit
const PAUZA_MEZI_LIDMI = 1200; // ms mezi členy
const PAUZA_PO_CHYBE = 3000;   // ms před dalším pokusem

function zaradDoFronty(member) {
  const role = (config.autoRoles ?? []).filter((id) => id && !id.startsWith("VLOZ"));
  if (!role.length) {
    console.warn("[ROLE] V configu nemáš vyplněnou žádnou autoRoles.");
    return;
  }

  frontaRoli.push({ member, role, pokus: 0 });
  if (!frontaBezi) zpracujFrontu();
}

async function zpracujFrontu() {
  frontaBezi = true;

  while (frontaRoli.length) {
    const job = frontaRoli.shift();
    const { member } = job;

    // člověk mohl mezitím odejít
    if (!member.guild.members.cache.has(member.id)) {
      const porad = await member.guild.members.fetch(member.id).catch(() => null);
      if (!porad) {
        console.warn(`[ROLE] ${member.user.tag} už na serveru není, přeskakuji.`);
        continue;
      }
    }

    const chybejici = [];

    for (const id of job.role) {
      const role = member.guild.roles.cache.get(id);

      if (!role) {
        console.error(`[ROLE] Role ${id} na serveru neexistuje — špatné ID?`);
        continue;
      }

      const bot = await member.guild.members.fetchMe();
      if (role.position >= bot.roles.highest.position) {
        console.error(`[ROLE] Na roli "${role.name}" nedosáhnu — přetáhni moji roli nad ni.`);
        continue;
      }

      if (!member.roles.cache.has(id)) chybejici.push(role);
    }

    if (!chybejici.length) {
      await pauza(PAUZA_MEZI_LIDMI);
      continue;
    }

    try {
      await member.roles.add(chybejici, "Automatická role při příchodu");
      console.log(
        `[ROLE] ${member.user.tag} dostal: ${chybejici.map((r) => r.name).join(", ")}`
      );
    } catch (err) {
      job.pokus++;

      if (job.pokus < POKUSU) {
        console.warn(
          `[ROLE] ${member.user.tag} — pokus ${job.pokus}/${POKUSU} selhal (${err.message}), zkusím znovu.`
        );
        frontaRoli.push(job); // zpátky na konec fronty
        await pauza(PAUZA_PO_CHYBE);
      } else {
        console.error(
          `[ROLE] ${member.user.tag} — role se nepodařilo přidat ani po ${POKUSU} pokusech: ${err.message}`
        );
      }
    }

    await pauza(PAUZA_MEZI_LIDMI);
  }

  frontaBezi = false;
}

function pauza(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isLeadership(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return config.leadershipRoles.some((id) => member.roles.cache.has(id));
}

// ---------- INFO PANEL APLIKACE ----------

function nahodneIP(kolik = 3) {
  const out = [];
  for (let i = 0; i < kolik; i++) {
    const a = Math.floor(Math.random() * 900) + 100;
    const b = Math.floor(Math.random() * 900) + 100;
    const c = Math.floor(Math.random() * 900) + 100;
    const port = Math.floor(Math.random() * 9000) + 1000;
    out.push(`${a}.${b}.${c}:${port}`);
  }
  return out;
}

function nahodnaHesla(kolik = 7) {
  const out = new Set();
  while (out.size < kolik) {
    out.add(String(Math.floor(Math.random() * 900000) + 100000));
  }
  return [...out];
}

function infoEmbed() {
  const ips = nahodneIP(3).map((x) => `\`${x}\``).join("\n");
  const hesla = nahodnaHesla(7).map((x) => `\`${x}\``).join("\n");

  return new EmbedBuilder()
    .setColor(config.colors.main)
    .setAuthor({ name: "Informace" })
    .setTitle("Funkčnost této aplikace:")
    .setDescription(
      `**Tato aplikace funguje jako webový prohlížeč pod různými IP adresami viz níže**\n\n` +
        `${ips}\n\n` +
        `**Tyto IP adresy se vždy píšou do anonymního režimu buď v mobilu nebo na zařízeních k tomu určených**\n\n` +
        `**Dále se musí uživatel přihlásit pod heslem které se pravidelně mění**\n\n` +
        `${hesla}\n\n` +
        `**Celá aplikace se zálohuje a její konverzace se vždy maže po 24 hodinách, ` +
        `historie je vždy dohledatelná v zálohách na jiném serveru.**`
    )
    .setThumbnail("attachment://logo.png")
    .setFooter({ text: "187 Strassenbande" })
    .setTimestamp();
}

function infoButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("info_refresh")
      .setLabel("Obnovit přístupy")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary)
  );
}

// Odešle zprávu a při síťovém výpadku to zkusí znovu
async function posliSPokusy(kanalId, payload, popis = "zpráva", pokusu = 4) {
  for (let i = 1; i <= pokusu; i++) {
    try {
      const ch = await client.channels.fetch(kanalId);
      if (!ch) {
        console.error(`[${popis}] Kanál ${kanalId} neexistuje.`);
        return null;
      }
      return await ch.send(payload);
    } catch (err) {
      const sit = ["EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(
        err.code
      );

      if (i < pokusu && (sit || err.status >= 500)) {
        console.warn(
          `[${popis}] Pokus ${i}/${pokusu} selhal (${err.code ?? err.message}), zkusím znovu.`
        );
        await pauza(2000 * i); // pauza se prodlužuje
        continue;
      }

      console.error(`[${popis}] Nepodařilo se odeslat: ${err.message}`);
      return null;
    }
  }
  return null;
}

async function sendLog(embed) {
  if (!config.channels.logs || config.channels.logs.startsWith("VLOZ")) {
    console.warn("[LOG] V configu není vyplněný kanál pro logy.");
    return;
  }

  await posliSPokusy(config.channels.logs, { embeds: [embed] }, "LOG");
}

function rankOfMember(member) {
  return config.ranks.find((r) => member.roles.cache.has(r.roleId));
}

// ---------- SLASH PŘÍKAZY ----------

const commands = [
  new SlashCommandBuilder()
    .setName("vysilacka")
    .setDescription("Pošle panel vysílačky s tlačítky")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Nastaví člena na rank ve frakci")
    .addUserOption((o) => o.setName("clen").setDescription("Kdo").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("rank")
        .setDescription("Nový rank")
        .setRequired(true)
        .addChoices(
          ...config.ranks.map((r) => ({ name: r.name.normalize("NFKC"), value: r.key }))
        )
    )
    .addStringOption((o) => o.setName("duvod").setDescription("Důvod (jde do logu)")),

  new SlashCommandBuilder()
    .setName("hierarchie")
    .setDescription("Vypíše hierarchii frakce"),

  new SlashCommandBuilder()
    .setName("vsemroli")
    .setDescription("Přidá nebo odebere roli všem na serveru")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((o) =>
      o.setName("role").setDescription("Která role").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("akce")
        .setDescription("Přidat nebo odebrat")
        .setRequired(true)
        .addChoices(
          { name: "Přidat", value: "add" },
          { name: "Odebrat", value: "remove" }
        )
    )
    .addStringOption((o) =>
      o
        .setName("komu")
        .setDescription("Komu to dát (výchozí: jen lidem)")
        .addChoices(
          { name: "Jen lidem", value: "lide" },
          { name: "Jen botům", value: "boti" },
          { name: "Všem včetně botů", value: "vsem" }
        )
    ),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Smaže zprávy v kanálu (kanál zůstane)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) =>
      o
        .setName("pocet")
        .setDescription("Kolik zpráv smazat (1–100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((o) =>
      o.setName("od").setDescription("Smazat jen zprávy od tohohle člověka")
    ),
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Pošle info panel aplikace s přístupy")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName("text")
    .setDescription("Otevře okno a pošle napsaný text jako embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((o) =>
      o.setName("kanal").setDescription("Kam to poslat (výchozí: tenhle kanál)")
    )
    .addStringOption((o) =>
      o
        .setName("barva")
        .setDescription("Barva pruhu vlevo")
        .addChoices(
          { name: "Žlutá", value: "main" },
          { name: "Zelená", value: "green" },
          { name: "Červená", value: "red" },
          { name: "Šedá", value: "grey" }
        )
    )
    .addBooleanOption((o) =>
      o.setName("logo").setDescription("Přidat logo vpravo nahoru")
    ),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, config.guildId),
    { body: commands }
  );
  console.log(`[OK] Zaregistrováno ${commands.length} příkazů.`);
  console.log(
    `[INFO] Čas kontejneru: ${new Date().toISOString()} | ` +
      `ping na Discord: ${Math.round(client.ws.ping)} ms`
  );
}

// ---------- START ----------

client.once("clientReady", async () => {
  console.log(`[OK] Přihlášen jako ${client.user.tag}`);
  client.user.setActivity("187 Strassenbande");
  loadRadio();
  await zkontrolujKanaly();
  console.log(`[OK] Frekvence — primární: ${radio.primary} | sekundární: ${radio.secondary}`);
  try {
    await registerCommands();
  } catch (err) {
    console.error("[CHYBA] Registrace příkazů selhala:", err.message);
  }
});

// ---------- PŘÍCHOD ČLENA ----------

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== config.guildId) return;

  // automatické role — do fronty, ať to zvládne i nával lidí
  zaradDoFronty(member);

  // uvítací zpráva
  const created = member.user.createdAt.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const welcome = new EmbedBuilder()
    .setColor(config.colors.main)
    .setAuthor({
      name: member.user.username,
      iconURL: member.user.displayAvatarURL({ size: 128 }),
    })
    .setDescription(
      `• Dorazil ${member}\n` +
        `• Nezapomeň si přečíst <#${config.channels.rules}>\n` +
        `🗓️ Účet vytvořen: ${created}`
    )
    .setThumbnail("attachment://logo.png");

  await posliSPokusy(
    config.channels.welcome,
    {
      embeds: [welcome],
      files: [{ attachment: LOGO_PATH, name: "logo.png" }],
    },
    "WELCOME"
  );

  // log
  const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  await sendLog(
    new EmbedBuilder()
      .setColor(config.colors.green)
      .setAuthor({ name: "Připojil se", iconURL: member.user.displayAvatarURL() })
      .setDescription(`${member} — \`${member.user.tag}\``)
      .addFields(
        { name: "ID", value: `\`${member.id}\``, inline: true },
        { name: "Stáří účtu", value: `${accountAge} dní`, inline: true },
        { name: "Členů celkem", value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp()
  );
});

// ---------- ODCHOD / VYHOZENÍ ----------

client.on("guildMemberRemove", async (member) => {
  if (member.guild.id !== config.guildId) return;

  const rank = member.roles ? rankOfMember(member) : null;
  const joined = member.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
    : "neznámo";

  // Chvilku počkej, než se zapíše audit log
  await new Promise((r) => setTimeout(r, 1500));

  let kickedBy = null;
  let duvod = null;
  let banned = false;

  try {
    const logy = await member.guild.fetchAuditLogs({ limit: 6 });
    const zaznam = logy.entries.find(
      (e) =>
        e.target?.id === member.id &&
        Date.now() - e.createdTimestamp < 10000 &&
        (e.action === AuditLogEvent.MemberKick || e.action === AuditLogEvent.MemberBanAdd)
    );

    if (zaznam) {
      if (zaznam.action === AuditLogEvent.MemberBanAdd) {
        banned = true; // ban řeší vlastní událost, tady to přeskoč
      } else {
        kickedBy = zaznam.executor;
        duvod = zaznam.reason;
      }
    }
  } catch (err) {
    console.error("[LOG] Audit log nejde načíst:", err.message);
  }

  if (banned) return;

  const embed = new EmbedBuilder()
    .setColor(kickedBy ? config.colors.red : config.colors.grey)
    .setAuthor({
      name: kickedBy ? "Vyhozen" : "Odešel",
      iconURL: member.user.displayAvatarURL(),
    })
    .setDescription(`\`${member.user.tag}\``)
    .addFields(
      { name: "ID", value: `\`${member.id}\``, inline: true },
      { name: "Rank", value: rank ? `${rank.symbol} ${rank.name}` : "žádný", inline: true },
      { name: "Připojen", value: joined, inline: true }
    )
    .setTimestamp();

  if (kickedBy) {
    embed.addFields(
      { name: "Vyhodil", value: `${kickedBy}`, inline: true },
      { name: "Důvod", value: duvod ?? "neuveden", inline: true }
    );
  }

  await sendLog(embed);
});

// ---------- BAN ----------

client.on("guildBanAdd", async (ban) => {
  if (ban.guild.id !== config.guildId) return;

  await new Promise((r) => setTimeout(r, 1500));

  let bannedBy = null;
  let duvod = ban.reason ?? null;

  try {
    const logy = await ban.guild.fetchAuditLogs({
      limit: 5,
      type: AuditLogEvent.MemberBanAdd,
    });
    const zaznam = logy.entries.find(
      (e) => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 10000
    );
    if (zaznam) {
      bannedBy = zaznam.executor;
      duvod = duvod ?? zaznam.reason;
    }
  } catch (err) {
    console.error("[LOG] Audit log nejde načíst:", err.message);
  }

  await sendLog(
    new EmbedBuilder()
      .setColor(config.colors.red)
      .setAuthor({ name: "Zabanován", iconURL: ban.user.displayAvatarURL() })
      .setDescription(`\`${ban.user.tag}\``)
      .addFields(
        { name: "ID", value: `\`${ban.user.id}\``, inline: true },
        { name: "Zabanoval", value: bannedBy ? `${bannedBy}` : "neznámo", inline: true },
        { name: "Důvod", value: duvod ?? "neuveden", inline: true }
      )
      .setTimestamp()
  );
});

// ---------- INTERAKCE ----------

client.on("interactionCreate", async (interaction) => {
  // Pojistka: jakákoliv nezachycená chyba v handleru se tady odchytí,
  // aby uživateli nezůstalo viset "Aplikace neodpověděla včas".
  try {
    await zpracujInterakci(interaction);
  } catch (err) {
    // 10062/40060 = interakce vypršela nebo už byla potvrzena, nic s tím nenaděláme
    if (err.code === 10062 || err.code === 40060) return;
    console.error("[INTERAKCE] Chyba:", err);
    const zprava = "Něco se pokazilo. Zkus to prosím znovu.";
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(zprava);
      } else if (interaction.isRepliable()) {
        await interaction.reply({ content: zprava, flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
      // uz se neda nic delat
    }
  }
});

async function zpracujInterakci(interaction) {
  // Kolik času uteklo od chvíle, kdy člověk klikl, než to dorazilo k botovi.
  // Discord dává celkem 3 sekundy, takže velké číslo = problém se sítí hostingu.
  const zpozdeni = Date.now() - interaction.createdTimestamp;
  const co =
    interaction.commandName ?? interaction.customId ?? interaction.type;

  console.log(
    `[INTERAKCE] "${co}" od ${interaction.user.tag} | ` +
      `zpoždění ${zpozdeni} ms | ping ${Math.round(client.ws.ping)} ms`
  );

  if (zpozdeni > 2500) {
    console.warn("[LAG] Zpoždění je skoro na limitu 3 s — síť hostingu vázne.");
  }

  // Discord dává na potvrzení jen 3 sekundy. Potvrď hned jako úplně
  // první věc, ať se to nestihne rozbít ničím, co přijde potom.
  // Výjimka je /text — ten musí otevřít okno, a to po potvrzení nejde.
  if (interaction.isChatInputCommand() && interaction.commandName !== "text") {
    // tyhle příkazy vidí všichni, zbytek je soukromý
    const verejne = ["rank", "vysilacka"].includes(interaction.commandName);
    try {
      await interaction.deferReply(
        verejne ? {} : { flags: MessageFlags.Ephemeral }
      );
    } catch (err) {
      if (err.code === 10062) {
        console.error(
          `[POTVRZENÍ] "${interaction.commandName}" vypršelo dřív, ` +
            `než jsem stihl odpovědět (zpoždění bylo ${zpozdeni} ms). ` +
            `Kliknutí k botovi dorazilo pozdě — problém je v síti hostingu.`
        );
        return;
      }
      console.error(`[POTVRZENÍ] Selhalo: ${err.message} (kód ${err.code})`);
      return;
    }
  }

  // Příkazy smí jen staff role (a admin).
  if (interaction.isChatInputCommand() && !VOLNE_PRIKAZY.includes(interaction.commandName)) {
    if (!maPristup(interaction.member)) {
      const zprava = "Na tenhle příkaz nemáš oprávnění.";
      return interaction.deferred
        ? interaction.editReply(zprava)
        : interaction.reply({ content: zprava, flags: MessageFlags.Ephemeral });
    }
  }

  // --- tlačítka vysílačky ---
  if (interaction.isButton() && interaction.customId.startsWith("radio_")) {
    const akce = interaction.customId.slice(6);

    // Discord dává na odpověď jen 3 s, tak mu to potvrď hned
    // a teprve pak dělej pomalé věci (přepis panelu, odeslání zprávy).
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      if (err.code !== 10062) console.error("[RADIO] Defer selhal:", err.message);
      return;
    }

    // --- STATUS ---
    if (akce === "status") {
      const zmena = radio.changedAt
        ? `<t:${Math.floor(radio.changedAt / 1000)}:R>`
        : "nikdy";

      return interaction.editReply({
        content:
          `📡 Vysíláte na **${currentFreq()} MHz** ` +
          `(${radio.active === "primary" ? "PRIMÁRNÍ" : "SEKUNDÁRNÍ"})\n` +
          `🔵 Primární: \`${radio.primary}\` MHz\n` +
          `🟠 Sekundární: \`${radio.secondary}\` MHz\n` +
          `Poslední změna: ${zmena}` +
          (radio.panic ? `\n🔴 Poslední změna byla PANIC.` : ""),
      });
    }

    // --- cooldown na změnu i panic ---
    const last = radioCooldown.get(interaction.user.id) ?? 0;
    const zbyva = RADIO_COOLDOWN_MS - (Date.now() - last);
    if (zbyva > 0) {
      return interaction.editReply(
        `Vysílačka se přehřívá, zkus to za ${Math.ceil(zbyva / 1000)} s.`
      );
    }
    radioCooldown.set(interaction.user.id, Date.now());

    const ping = config.panicPingRole ? `<@&${config.panicPingRole}> ` : "";
    const mentions = {
      roles: config.panicPingRole ? [config.panicPingRole] : [],
    };

    // --- ZMĚNA FREKVENCE ---
    if (akce === "change") {
      const { stara, nova } = novePasmo(interaction.user.id);
      updatePanel();

      try {
        const ch = await client.channels.fetch(config.channels.radio);
        const msg = await ch.send({
          content:
            `${ping}🔄 **ZMĚNA FREKVENCE** — \`${stara}\` MHz ➜ ` +
            `**${nova} MHz** (PRIMÁRNÍ). Všichni přeladit.`,
          allowedMentions: mentions,
        });

        setTimeout(() => {
          msg.delete().catch(() => {});
        }, ZPRAVA_SMAZAT_PO_MS);
      } catch (err) {
        console.error("[RADIO] Chyba při oznámení:", err.message);
      }

      return interaction.editReply(`Nová frekvence: **${nova} MHz**`);
    }

    // --- PANIC ---
    if (akce === "panic") {
      const { stara, nova } = panicSwitch(interaction.user.id);
      updatePanel();

      const pasmo = radio.active === "primary" ? "PRIMÁRNÍ" : "SEKUNDÁRNÍ";

      try {
        const ch = await client.channels.fetch(config.channels.radio);
        const msg = await ch.send({
          content:
            `${ping}🚨 **PANIC** — frekvence \`${stara}\` MHz je spálená. ` +
            `Okamžitě přeladit na **${nova} MHz** (${pasmo}).`,
          allowedMentions: mentions,
        });

        setTimeout(() => {
          msg.delete().catch(() => {});
        }, ZPRAVA_SMAZAT_PO_MS);
      } catch (err) {
        console.error("[RADIO] Chyba při panicu:", err.message);
      }

      return interaction.editReply(`PANIC odeslán. Nová frekvence: **${nova} MHz**`);
    }

    return interaction.editReply("Neznámé tlačítko.");
  }

  // --- odeslání textu z okna ---
  if (interaction.isModalSubmit() && interaction.customId.startsWith("textmodal_")) {
    const [, kanalId, barva, logoFlag] = interaction.customId.split("_");
    const nadpis = interaction.fields.getTextInputValue("nadpis").trim();
    const obsah = interaction.fields.getTextInputValue("obsah");

    const embed = new EmbedBuilder()
      .setColor(config.colors[barva] ?? config.colors.main)
      .setDescription(obsah);

    if (nadpis) embed.setTitle(nadpis);
    if (logoFlag === "1") embed.setThumbnail("attachment://logo.png");

    try {
      const ch = await client.channels.fetch(kanalId);
      await ch.send({
        embeds: [embed],
        files: logoFlag === "1" ? [{ attachment: LOGO_PATH, name: "logo.png" }] : [],
      });
      return interaction.editReply(`Odesláno do <#${kanalId}>.`);
    } catch (err) {
      console.error("[TEXT] Chyba:", err.message);
      return interaction.editReply("Nepovedlo se odeslat. Nemám v tom kanálu práva?");
    }
  }

  // --- obnovení přístupů v info panelu ---
  if (interaction.isButton() && interaction.customId === "info_refresh") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: "Přístupy může obnovovat jen vedení.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await interaction.update({
        embeds: [infoEmbed()],
        components: [infoButtons()],
      });
    } catch (err) {
      console.error("[INFO] Nejde obnovit:", err.message);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // --- /vysilacka (pošle panel) ---
  if (interaction.commandName === "vysilacka") {
    const msg = await interaction.editReply({
      embeds: [panelEmbed()],
      components: [panelButtons()],
      files: [{ attachment: LOGO_PATH, name: "logo.png" }],
    });

    // zapamatuj si zprávu, ať ji jde později přepisovat
    radio.panelChannelId = msg.channelId;
    radio.panelMessageId = msg.id;
    saveRadio();
    return;
  }

  // --- /rank ---
  if (interaction.commandName === "rank") {
    if (!isLeadership(interaction.member)) {
      return interaction.editReply("Na tohle nemáš oprávnění.");
    }

    const target = await interaction.guild.members.fetch(
      interaction.options.getUser("clen").id
    );
    const rankKey = interaction.options.getString("rank");
    const duvod = interaction.options.getString("duvod") ?? "neuveden";
    const newRank = config.ranks.find((r) => r.key === rankKey);
    const oldRank = rankOfMember(target);

    try {
      // odeber všechny ostatní ranky, přidej nový
      const toRemove = config.ranks
        .filter((r) => r.key !== rankKey && target.roles.cache.has(r.roleId))
        .map((r) => r.roleId);

      if (toRemove.length) await target.roles.remove(toRemove, `Změna ranku: ${duvod}`);
      await target.roles.add(newRank.roleId, `Změna ranku: ${duvod}`);
    } catch (err) {
      return interaction.editReply(
        "Nepovedlo se. Bot musí mít roli výš než ranky, které nastavuje."
      );
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.main)
      .setTitle("Změna ranku")
      .setDescription(
        `${target} je nyní **${newRank.symbol} ${newRank.name}**\n` +
          `Předtím: ${oldRank ? `${oldRank.symbol} ${oldRank.name}` : "bez ranku"}`
      )
      .addFields(
        { name: "Provedl", value: `${interaction.user}`, inline: true },
        { name: "Důvod", value: duvod, inline: true }
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // --- /hierarchie ---
  if (interaction.commandName === "hierarchie") {
    const embed = new EmbedBuilder()
      .setColor(config.colors.main)
      .setTitle("187 STRASSENBANDE — HIERARCHIE")
      .setThumbnail("attachment://logo.png");

    // každý rank jako vlastní blok s popiskem
    for (const [i, r] of config.ranks.entries()) {
      embed.addFields({
        name: `${i + 1}. ${r.symbol} ${r.name.normalize("NFKC")}`,
        value: `\`\`\`${r.desc ?? "—"}\`\`\``,
      });
    }

    try {
      const ch = await client.channels.fetch(config.channels.hierarchy);
      await ch.send({
        embeds: [embed],
        files: [{ attachment: LOGO_PATH, name: "logo.png" }],
      });
      return interaction.editReply(
        `Hierarchie odeslána do <#${config.channels.hierarchy}>.`
      );
    } catch (err) {
      console.error("[HIERARCHIE] Chyba:", err.message);
      return interaction.editReply(
        "Nepovedlo se. Zkontroluj ID kanálu hierarchy v configu."
      );
    }
  }

  // --- /vsemroli ---
  if (interaction.commandName === "vsemroli") {
    const role = interaction.options.getRole("role");
    const akce = interaction.options.getString("akce");
    const komu = interaction.options.getString("komu") ?? "lide";

    // Bot nesmí sahat na roli, která je výš než jeho vlastní
    const botMember = await interaction.guild.members.fetchMe();
    if (role.position >= botMember.roles.highest.position) {
      return interaction.editReply(
        `Na roli ${role} nedosáhnu — přetáhni moji roli nad ni v nastavení serveru.`
      );
    }
    if (role.managed) {
      return interaction.editReply(
        "Tuhle roli spravuje integrace (bot nebo boost), ručně přidávat nejde."
      );
    }

    // Načti všechny členy serveru
    let vsichni;
    try {
      vsichni = await interaction.guild.members.fetch();
    } catch (err) {
      return interaction.editReply(
        "Nepodařilo se načíst členy. Zkontroluj SERVER MEMBERS INTENT v Developer Portal."
      );
    }

    const cil = vsichni.filter((m) => {
      if (komu === "lide" && m.user.bot) return false;
      if (komu === "boti" && !m.user.bot) return false;
      return akce === "add" ? !m.roles.cache.has(role.id) : m.roles.cache.has(role.id);
    });

    if (cil.size === 0) {
      return interaction.editReply(
        `Nikoho měnit netřeba — všichni už to mají tak, jak chceš.`
      );
    }

    await interaction.editReply(
      `Zpracovávám ${cil.size} členů. U větších serverů to chvíli trvá, ` +
        `Discord nedovolí měnit role rychleji.`
    );

    let hotovo = 0;
    let chyby = 0;

    for (const [, m] of cil) {
      try {
        if (akce === "add") {
          await m.roles.add(role.id, `Hromadně: ${interaction.user.tag}`);
        } else {
          await m.roles.remove(role.id, `Hromadně: ${interaction.user.tag}`);
        }
        hotovo++;
      } catch (err) {
        chyby++;
      }

      // pauza kvůli limitům Discordu
      await new Promise((r) => setTimeout(r, 350));

      // průběžně hlaš postup
      if (hotovo % 25 === 0) {
        await interaction
          .editReply(`Hotovo ${hotovo} / ${cil.size}...`)
          .catch(() => {});
      }
    }

    const slovo = akce === "add" ? "přidána" : "odebrána";
    return interaction.editReply(
      `Role ${role} ${slovo} u **${hotovo}** členů.` +
        (chyby ? `\nU ${chyby} se to nepovedlo (nejspíš mají vyšší roli než já).` : "")
    );
  }

  // --- /clear ---
  if (interaction.commandName === "clear") {
    const pocet = interaction.options.getInteger("pocet");
    const od = interaction.options.getUser("od");

    try {
      // Když filtrujeme podle člověka, musíme nabrat širší vzorek
      const nabrat = od ? 100 : pocet;
      const zpravy = await interaction.channel.messages.fetch({ limit: nabrat });

      const HRANICE = 14 * 24 * 60 * 60 * 1000; // Discord neumí mazat starší 14 dní
      const ted = Date.now();

      let vyber = [...zpravy.values()].filter(
        (m) => !m.pinned && ted - m.createdTimestamp < HRANICE
      );

      if (od) vyber = vyber.filter((m) => m.author.id === od.id);
      vyber = vyber.slice(0, pocet);

      if (vyber.length === 0) {
        return interaction.editReply(
          "Nic ke smazání. Zprávy starší 14 dní ani připnuté Discord smazat nedovolí."
        );
      }

      const smazano = await interaction.channel.bulkDelete(vyber, true);

      return interaction.editReply(
        `Smazáno **${smazano.size}** zpráv${od ? ` od ${od}` : ""}.` +
          (smazano.size < pocet
            ? `\nZbytek byl starší 14 dní nebo připnutý, ty Discord mazat nedovolí.`
            : "")
      );
    } catch (err) {
      console.error("[CLEAR] Chyba:", err.message);
      return interaction.editReply(
        "Nepovedlo se. Zkontroluj, že mám v tomhle kanálu právo Spravovat zprávy."
      );
    }
  }

  // --- /info ---
  if (interaction.commandName === "info") {
    try {
      const ch = await client.channels.fetch(config.channels.info);
      await ch.send({
        embeds: [infoEmbed()],
        components: [infoButtons()],
        files: [{ attachment: LOGO_PATH, name: "logo.png" }],
      });
      return interaction.editReply("Info panel odeslán.");
    } catch (err) {
      console.error("[INFO] Chyba:", err.message);
      return interaction.editReply("Nepovedlo se. Zkontroluj ID info kanálu v configu.");
    }
  }

  // --- /text: otevře okno na víceřádkový text ---
  if (interaction.commandName === "text") {
    const kanal = interaction.options.getChannel("kanal") ?? interaction.channel;
    const barva = interaction.options.getString("barva") ?? "main";
    const logo = interaction.options.getBoolean("logo") ?? false;

    const modal = new ModalBuilder()
      .setCustomId(`textmodal_${kanal.id}_${barva}_${logo ? 1 : 0}`)
      .setTitle("Text do embedu")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("nadpis")
            .setLabel("Nadpis (nepovinný)")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("obsah")
            .setLabel("Text — enter dělá nový řádek")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Piš normálně, odstavce i prázdné řádky fungují.")
            .setMaxLength(4000)
            .setRequired(true)
        )
      );

    try {
      return await interaction.showModal(modal);
    } catch (err) {
      console.error(`[TEXT] Okno nešlo otevřít: ${err.message} (kód ${err.code})`);
      return;
    }
  }
}

// ---------- OŠETŘENÍ PÁDŮ ----------

process.on("unhandledRejection", (err) => console.error("[UNHANDLED]", err));

// Každých 5 minut ohlásí, jestli spojení s Discordem drží
setInterval(() => {
  const ping = Math.round(client.ws.ping);
  if (!client.isReady()) {
    console.error("[SPOJENÍ] Bot není připojený k Discordu!");
  } else if (ping > 500 || ping < 0) {
    console.warn(`[SPOJENÍ] Vysoký ping: ${ping} ms`);
  }
}, 5 * 60 * 1000);

client.on("shardDisconnect", () => console.error("[SPOJENÍ] Odpojeno od Discordu."));
client.on("shardReconnecting", () => console.warn("[SPOJENÍ] Připojuji se znovu..."));
client.on("shardResume", () => console.log("[SPOJENÍ] Spojení obnoveno."));
client.on("error", (err) => console.error("[KLIENT]", err.message));

if (!process.env.TOKEN) {
  console.error("[CHYBA] Chybí TOKEN v souboru .env");
  process.exit(1);
}

client.login(process.env.TOKEN);

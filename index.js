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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const config = require("./config.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});

// ---------- POMOCNÉ FUNKCE ----------

const path = require("node:path");

const line = "»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»";
const LOGO_PATH = path.join(__dirname, "logo.png");

// Styly vysílání — používá je panel, tlačítka i výsledný embed
const RADIO_STYLES = {
  normal: { button: "Vysílání", tag: "» VYSÍLÁNÍ", color: 0x2e9e4f },
  important: { button: "Důležité", tag: "» DŮLEŽITÉ", color: 0xf2c53d },
  urgent: { button: "10-13 Nouze", tag: "» 10-13 NALÉHAVÉ", color: 0xd2342a },
};

// Ochrana proti spamu: kdo naposledy vysílal a kdy
const radioCooldown = new Map();
const RADIO_COOLDOWN_MS = 15000;

function isLeadership(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return config.leadershipRoles.some((id) => member.roles.cache.has(id));
}

async function sendLog(embed) {
  try {
    const ch = await client.channels.fetch(config.channels.logs);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (err) {
    console.error("[LOG] Nepodařilo se odeslat log:", err.message);
  }
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
    .setName("panel")
    .setDescription("Pošle panel s rolemi na kliknutí")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("hierarchie")
    .setDescription("Vypíše hierarchii frakce"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, config.guildId),
    { body: commands }
  );
  console.log(`[OK] Zaregistrováno ${commands.length} příkazů.`);
}

// ---------- START ----------

client.once("clientReady", async () => {
  console.log(`[OK] Přihlášen jako ${client.user.tag}`);
  client.user.setActivity("187 Strassenbande");
  try {
    await registerCommands();
  } catch (err) {
    console.error("[CHYBA] Registrace příkazů selhala:", err.message);
  }
});

// ---------- PŘÍCHOD ČLENA ----------

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== config.guildId) return;

  // automatická role
  if (config.autoRole && !config.autoRole.startsWith("VLOZ")) {
    try {
      await member.roles.add(config.autoRole, "Automatická role při příchodu");
    } catch (err) {
      console.error("[ROLE] Nepodařilo se přidat autorole:", err.message);
    }
  }

  // uvítací zpráva
  try {
    const ch = await client.channels.fetch(config.channels.welcome);
    if (ch) {
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

      await ch.send({
        embeds: [welcome],
        files: [{ attachment: LOGO_PATH, name: "logo.png" }],
      });
    }
  } catch (err) {
    console.error("[WELCOME] Chyba:", err.message);
  }

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

// ---------- ODCHOD ČLENA ----------

client.on("guildMemberRemove", async (member) => {
  if (member.guild.id !== config.guildId) return;

  const rank = member.roles ? rankOfMember(member) : null;
  const joined = member.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
    : "neznámo";

  await sendLog(
    new EmbedBuilder()
      .setColor(config.colors.red)
      .setAuthor({ name: "Odešel", iconURL: member.user.displayAvatarURL() })
      .setDescription(`\`${member.user.tag}\``)
      .addFields(
        { name: "ID", value: `\`${member.id}\``, inline: true },
        { name: "Rank", value: rank ? `${rank.symbol} ${rank.name}` : "žádný", inline: true },
        { name: "Připojen", value: joined, inline: true },
        { name: "Členů zbývá", value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp()
  );
});

// ---------- ZMĚNA ROLÍ ----------

client.on("guildMemberUpdate", async (oldM, newM) => {
  if (newM.guild.id !== config.guildId) return;

  const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id));
  const removed = oldM.roles.cache.filter((r) => !newM.roles.cache.has(r.id));
  if (added.size === 0 && removed.size === 0) return;

  const embed = new EmbedBuilder()
    .setColor(config.colors.grey)
    .setAuthor({ name: "Změna rolí", iconURL: newM.user.displayAvatarURL() })
    .setDescription(`${newM} — \`${newM.user.tag}\``)
    .setTimestamp();

  if (added.size) embed.addFields({ name: "Přidáno", value: added.map((r) => `+ ${r.name}`).join("\n") });
  if (removed.size) embed.addFields({ name: "Odebráno", value: removed.map((r) => `- ${r.name}`).join("\n") });

  await sendLog(embed);
});

// ---------- INTERAKCE ----------

client.on("interactionCreate", async (interaction) => {
  // --- tlačítka vysílačky: otevře okno na text ---
  if (interaction.isButton() && interaction.customId.startsWith("radio_")) {
    const typ = interaction.customId.slice(6);
    const style = RADIO_STYLES[typ];
    if (!style) return;

    // cooldown
    const last = radioCooldown.get(interaction.user.id) ?? 0;
    const zbyva = RADIO_COOLDOWN_MS - (Date.now() - last);
    if (zbyva > 0) {
      return interaction.reply({
        content: `Klid, vysílačka se přehřívá. Zkus to za ${Math.ceil(zbyva / 1000)} s.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`radiomodal_${typ}`)
      .setTitle(`Vysílačka — ${style.button}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("text")
            .setLabel("Co chceš vysílat?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Napiš zprávu...")
            .setMaxLength(1500)
            .setRequired(true)
        )
      );

    return interaction.showModal(modal);
  }

  // --- odeslání vysílání z okna ---
  if (interaction.isModalSubmit() && interaction.customId.startsWith("radiomodal_")) {
    const typ = interaction.customId.slice(11);
    const style = RADIO_STYLES[typ];
    if (!style) return;

    const text = interaction.fields.getTextInputValue("text");
    const rank = rankOfMember(interaction.member);

    const embed = new EmbedBuilder()
      .setColor(style.color)
      .setAuthor({
        name: rank
          ? `${rank.symbol} ${interaction.member.displayName}`
          : interaction.member.displayName,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle(style.tag)
      .setDescription(`${line}\n${text}\n${line}`)
      .setFooter({ text: rank ? rank.name.normalize("NFKC") : "bez ranku" })
      .setTimestamp();

    try {
      const ch = await client.channels.fetch(config.channels.radio);
      const msg = await ch.send({
        content: typ === "urgent" ? "@here" : null,
        embeds: [embed],
        allowedMentions: { parse: typ === "urgent" ? ["everyone"] : [] },
      });

      radioCooldown.set(interaction.user.id, Date.now());

      return interaction.reply({
        content: `Odesláno: ${msg.url}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error("[RADIO] Chyba:", err.message);
      return interaction.reply({
        content: "Nepodařilo se odeslat. Zkontroluj ID kanálu vysílačky a práva bota.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // --- tlačítka rolí ---
  if (interaction.isButton() && interaction.customId.startsWith("role_")) {
    const roleId = interaction.customId.slice(5);
    const member = interaction.member;

    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        return interaction.reply({
          content: `Role <@&${roleId}> odebrána.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await member.roles.add(roleId);
      return interaction.reply({
        content: `Role <@&${roleId}> přidána.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      return interaction.reply({
        content: "Nepovedlo se. Zkontroluj, jestli má bot roli výš než tuhle.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  if (!interaction.isChatInputCommand()) return;

  // --- /vysilacka (pošle panel) ---
  if (interaction.commandName === "vysilacka") {
    const embed = new EmbedBuilder()
      .setColor(config.colors.main)
      .setTitle("VYSÍLAČKA")
      .setDescription(
        `${line}\n` +
          `Klikni na tlačítko podle toho, jak je to naléhavé.\n` +
          `Otevře se okno, kam napíšeš zprávu.\n\n` +
          `${RADIO_STYLES.normal.button} — běžné hlášení\n` +
          `${RADIO_STYLES.important.button} — něco důležitého\n` +
          `${RADIO_STYLES.urgent.button} — nouze, pingne @here\n${line}`
      )
      .setThumbnail("attachment://logo.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("radio_normal")
        .setLabel(RADIO_STYLES.normal.button)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("radio_important")
        .setLabel(RADIO_STYLES.important.button)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("radio_urgent")
        .setLabel(RADIO_STYLES.urgent.button)
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      files: [{ attachment: LOGO_PATH, name: "logo.png" }],
    });
  }

  // --- /rank ---
  if (interaction.commandName === "rank") {
    if (!isLeadership(interaction.member)) {
      return interaction.reply({
        content: "Na tohle nemáš oprávnění.",
        flags: MessageFlags.Ephemeral,
      });
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
      return interaction.reply({
        content: "Nepovedlo se. Bot musí mít roli výš než ranky, které nastavuje.",
        flags: MessageFlags.Ephemeral,
      });
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

    await sendLog(embed);
    return interaction.reply({ embeds: [embed] });
  }

  // --- /panel ---
  if (interaction.commandName === "panel") {
    const valid = config.selfRoles.filter((r) => !r.roleId.startsWith("VLOZ"));
    if (!valid.length) {
      return interaction.reply({
        content: "V configu nemáš vyplněné žádné selfRoles.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.main)
      .setTitle("ROLE NA KLIKNUTÍ")
      .setDescription(
        `${line}\nKlikni na tlačítko a roli si přidáš.\n` +
          `Kliknutím znovu si ji zase sundáš.\n${line}`
      );

    const row = new ActionRowBuilder().addComponents(
      valid.slice(0, 5).map((r) =>
        new ButtonBuilder()
          .setCustomId(`role_${r.roleId}`)
          .setLabel(`${r.emoji} ${r.label}`)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // --- /hierarchie ---
  if (interaction.commandName === "hierarchie") {
    const list = config.ranks
      .map((r, i) => `\`${i + 1}.\` ${r.symbol} ${r.name}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(config.colors.main)
      .setTitle("187 STRASSENBANDE — HIERARCHIE")
      .setDescription(`${line}\n${list}\n${line}`)
      .setThumbnail("attachment://logo.png")
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      files: [{ attachment: LOGO_PATH, name: "logo.png" }],
    });
  }
});

// ---------- OŠETŘENÍ PÁDŮ ----------

process.on("unhandledRejection", (err) => console.error("[UNHANDLED]", err));

if (!process.env.TOKEN) {
  console.error("[CHYBA] Chybí TOKEN v souboru .env");
  process.exit(1);
}

client.login(process.env.TOKEN);

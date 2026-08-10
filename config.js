// ==========================================================
//  187 STRASSENBANDE - konfigurace bota
//  Sem vyplň ID kanálů a rolí ze svého serveru.
//  ID získáš tak, že si v Discordu zapneš Nastavení >
//  Pokročilé > Vývojářský režim, pak pravý klik > Kopírovat ID.
// ==========================================================

module.exports = {
  // ---- ZÁKLAD ----
  guildId: "1506403721469493438",

  // ---- KANÁLY ----
  channels: {
    welcome: "1506403721934930073",   // sem chodí uvítací zpráva
    logs: "1506403724409704576",      // sem chodí logy (příchod/odchod/ranky)
    radio: "1506403722635378873",     // sem chodí vysílačka
    rules: "1506403721934930077",     // jen se odkazuje v uvítačce
  },

  // ---- AUTOMATICKÁ ROLE PŘI PŘÍCHODU ----
  // Každý nový člen dostane tuhle roli automaticky.
  autoRole: "1506403721469493442",
            "1506403721469493444",

  // ---- KDO SMÍ POVYŠOVAT A VYSÍLAT ----
  // Role, které mohou používat /rank a /panel.
  leadershipRoles: [
    "1506403721507246122",
  ],

  // ---- HIERARCHIE FRAKCE ----
  // Pořadí odshora dolů. Bot při povýšení odebere všechny
  // ostatní ranky z tohohle seznamu, takže má člen vždy jen jeden.
  ranks: [
    { key: "boss",         name: "𝗕𝗼𝘀𝘀",          symbol: "♛", roleId: "1506403721507246122" },
    { key: "unterboss",    name: "𝗨𝗻𝘁𝗲𝗿𝗯𝗼𝘀𝘀",     symbol: "♚", roleId: "1506403721507246121" },
    { key: "berater",      name: "𝗕𝗲𝗿𝗮𝘁𝗲𝗿",       symbol: "♜", roleId: "1506403721494401043" },
    { key: "vollstrecker", name: "𝗩𝗼𝗹𝗹𝘀𝘁𝗿𝗲𝗰𝗸𝗲𝗿",  symbol: "✠", roleId: "1506403721494401039" },
    { key: "capo",         name: "𝗖𝗮𝗽𝗼",          symbol: "❖", roleId: "1506403721494401038" },
    { key: "soldat",       name: "𝗦𝗼𝗹𝗱𝗮𝘁",        symbol: "✦", roleId: "1506403721469493445" },
    { key: "umfeld",       name: "𝗨𝗺𝗳𝗲𝗹𝗱",        symbol: "◈", roleId: "1506403721469493444" },
  ],

  // ---- ROLE NA KLIKNUTÍ (panel s tlačítky) ----
  // Tyhle si lidi berou sami přes /panel. Ranky sem NEDÁVEJ.
  selfRoles: [
    { label: "Oznámení",  emoji: "◈", roleId: "VLOZ_ID_ROLE_OZNAMENI" },
    { label: "Eventy",    emoji: "✦", roleId: "VLOZ_ID_ROLE_EVENTY" },
    { label: "Streamy",   emoji: "✧", roleId: "VLOZ_ID_ROLE_STREAMY" },
  ],

  // ---- VZHLED ----
  colors: {
    main: 0xf2c53d,     // žlutá z loga
    green: 0x2e9e4f,    // zelená z loga
    red: 0xd2342a,      // červená z loga
    grey: 0x2b2d31,
  },

  // Obrázek do uvítací zprávy (nepovinné, nech prázdné nebo dej URL)
  bannerUrl: "",
};

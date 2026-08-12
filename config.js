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
    info: "1506403721934930078",      // sem chodí info panel aplikace
    hierarchy: "1506403721934930076", // sem chodí /hierarchie
  },

  // ---- AUTOMATICKÉ ROLE PŘI PŘÍCHODU ----
  // Každý nový člen dostane všechny role z tohohle seznamu.
  // Klidně přidej další řádky, jen nezapomeň čárku.
  autoRoles: [
    "1506403721469493442",
    "1506403721469493444",
  ],

  // ---- KDO SMÍ POUŽÍVAT PŘÍKAZY ----
  // Tahle role má přístup ke všem příkazům kromě /objednavka,
  // která je záměrně pro všechny. Admin projde vždy.
  staffRole: "1506403721507246124",

  // ---- KOHO PINGNOUT PŘI PANICU ----
  panicPingRole: "1506403721469493442",

  // ---- KDO SMÍ POVYŠOVAT A VYSÍLAT ----
  // Role, které mohou používat /rank a /panel.
  leadershipRoles: [
    "VLOZ_ID_ROLE_BOSS",
    "VLOZ_ID_ROLE_UNTERBOSS",
    "VLOZ_ID_ROLE_BERATER",
  ],

  // ---- HIERARCHIE FRAKCE ----
  // Pořadí odshora dolů. Bot při povýšení odebere všechny
  // ostatní ranky z tohohle seznamu, takže má člen vždy jen jeden.
  // Popisky si klidně přepiš, /hierarchie je vypisuje pod každý rank.
  ranks: [
    {
      key: "boss", name: "𝗕𝗼𝘀𝘀", symbol: "♛",
      roleId: "VLOZ_ID_ROLE_BOSS",
      desc: "Hlava organizace určující směr frakce a rozhodující o nejdůležitějších záležitostech.",
    },
    {
      key: "unterboss", name: "𝗨𝗻𝘁𝗲𝗿𝗯𝗼𝘀𝘀", symbol: "♚",
      roleId: "VLOZ_ID_ROLE_UNTERBOSS",
      desc: "Pravá ruka Bosse dohlížející na chod organizace a koordinaci vedení.",
    },
    {
      key: "berater", name: "𝗕𝗲𝗿𝗮𝘁𝗲𝗿", symbol: "♜",
      roleId: "VLOZ_ID_ROLE_BERATER",
      desc: "Vyjednavač frakce. Domlouvá dohody s ostatními organizacemi a řeší vnitřní spory.",
    },
    {
      key: "vollstrecker", name: "𝗩𝗼𝗹𝗹𝘀𝘁𝗿𝗲𝗰𝗸𝗲𝗿", symbol: "✠",
      roleId: "VLOZ_ID_ROLE_VOLLSTRECKER",
      desc: "Síla frakce. Zajišťuje ochranu členů, vymáhání dohod a vede akce v terénu.",
    },
    {
      key: "capo", name: "𝗖𝗮𝗽𝗼", symbol: "◈",
      roleId: "VLOZ_ID_ROLE_CAPO",
      desc: "Vede vlastní skupinu uvnitř frakce a odpovídá za své lidi vedení.",
    },
    {
      key: "mitglied", name: "𝗠𝗶𝘁𝗴𝗹𝗶𝗲𝗱", symbol: "❖",
      roleId: "VLOZ_ID_ROLE_MITGLIED",
      desc: "Plnohodnotný člen s hlasem na schůzích a přístupem k majetku frakce.",
    },
    {
      key: "soldat", name: "𝗦𝗼𝗹𝗱𝗮𝘁", symbol: "✦",
      roleId: "VLOZ_ID_ROLE_SOLDAT",
      desc: "Aktivní člen jezdící na akce. Plní úkoly zadané Capem nebo vedením.",
    },
    {
      key: "rookie", name: "𝗥𝗼𝗼𝗸𝗶𝗲", symbol: "✧",
      roleId: "VLOZ_ID_ROLE_ROOKIE",
      desc: "Nováček ve zkušební době. Pohybuje se pouze v doprovodu vyššího ranku.",
    },
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

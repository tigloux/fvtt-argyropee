import ArgyropeeActorSheet from "./actor-sheet.mjs";

export default class NPCSheet extends ArgyropeeActorSheet {
  constructor(options={}) {
    super(options);
    this.tabGroups = { primary: "skills" };
  }
  
    static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "actor", "npc"],
    position: { width: 950, height: 700 }
  };

  static PARTS = {
    body: { template: "systems/argyropee/templates/actor-npc.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillsList = CONFIG.ARGYROPEE.competences; 
    
    // --- CORRECTION : Définir les bons onglets pour le PNJ ---
    const activeTab = this.tabGroups.primary || "skills";
    context.tabs = {
      primary: {
        tabs: [
          { id: "skills", label: "Compétences", cssClass: activeTab === "skills" ? "active" : "" },
          { id: "combat", label: "Combat", cssClass: activeTab === "combat" ? "active" : "" },
          { id: "background", label: "Biographie", cssClass: activeTab === "background" ? "active" : "" }
        ]
      }
    };
    context.tab = { id: activeTab };

    return context;
  }
}
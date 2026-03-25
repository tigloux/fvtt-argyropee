import ArgyropeeActorSheet from "./actor-sheet.mjs";

export default class MonsterSheet extends ArgyropeeActorSheet {
  constructor(options={}) {
    super(options);
    this.tabGroups = { primary: "skills" };
  }
  
    static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "actor", "monster"],
    position: { width: 950, height: 750 }
  };

  static PARTS = {
    body: { template: "systems/argyropee/templates/actor-monster.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillsList = CONFIG.ARGYROPEE.competences;
    
    // --- CORRECTION : Définir les bons onglets pour le Monstre ---
    const activeTab = this.tabGroups.primary || "skills";
    context.tabs = {
      primary: {
        tabs: [
          { id: "skills", label: "Compétences", cssClass: activeTab === "skills" ? "active" : "" },
          { id: "attacks", label: "Attaques", cssClass: activeTab === "attacks" ? "active" : "" },
          { id: "notes", label: "Notes", cssClass: activeTab === "notes" ? "active" : "" }
        ]
      }
    };
    context.tab = { id: activeTab };

    const notes = this.document.system.biographie?.notes || "";
    context.enrichedNotes = await TextEditor.enrichHTML(notes, { async: true });
    
    return context;
  }
}
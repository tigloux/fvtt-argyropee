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

    const bg = this.document.system.background || {};
    
    // On transforme le code HTML brut en HTML "enrichi" lisible par Foundry
    context.enrichedPhysique = await TextEditor.enrichHTML(bg.physique || "", { async: true });
    context.enrichedAmours   = await TextEditor.enrichHTML(bg.amours || "", { async: true });
    context.enrichedEnnemis  = await TextEditor.enrichHTML(bg.ennemis || "", { async: true });
    context.enrichedFamille  = await TextEditor.enrichHTML(bg.famille || "", { async: true });
    context.enrichedAmis     = await TextEditor.enrichHTML(bg.amis || "", { async: true });
    context.enrichedTravail  = await TextEditor.enrichHTML(bg.travail || "", { async: true });
    
    return context;
  }
}
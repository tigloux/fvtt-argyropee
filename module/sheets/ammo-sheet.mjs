import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class AmmoSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "ammo"],
    position: { width: 500, height: 500 },
    window: {
        resizable: true // Permet de redimensionner pour voir le scroll
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { template: "systems/argyropee/templates/item-ammo.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    
    context.ammoCategories = {
        "Flèches": "Flèches (Arcs)",
        "Carreaux": "Carreaux (Arbalètes)",
        "Poudre": "Poudre & Balles (Armes à feu)",
        "Jet": "Jet (Frondes, Sarbacanes)"
    };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description || "", { async: true, relativeTo: this.document }
    );
    return context;
  }
}
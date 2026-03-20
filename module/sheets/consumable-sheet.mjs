import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class ConsumableSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "consumable"],
    position: { width: 520, height: 600 },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { template: "systems/argyropee/templates/item-consumable.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    
    context.consoTypes = {
        "Potion": "Potion / Baume (Soin)",
        "Alchimie": "Produit Alchimique (Utilitaire)",
        "Drogue": "Drogue (Stupéfiant)",
        "Poison": "Poison / Toxine"
    };

    context.forms = { "Liquide": "Liquide", "Poudre": "Poudre", "Gaz": "Gaz", "Pâte": "Pâte", "Pilule": "Pilule" };
    context.addictions = { "Nulle": "Nulle", "Légère": "Légère", "Modérée": "Modérée", "Forte": "Forte" };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description || "", { async: true, relativeTo: this.document }
    );
    return context;
  }
}
import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class TrapSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "trap"],
    position: { width: 520, height: 600 },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { template: "systems/argyropee/templates/item-trap.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    
    context.trapTypes = {
        "Entrave": "Entrave & Enfermement",
        "Alarme": "Alarme & Déclencheur",
        "Létal": "Létal & Blessant",
        "Exotique": "Exotique & Alchimique"
    };

    context.statuses = {
        "Inventaire": "Dans l'inventaire",
        "Déployé": "Déployé sur le terrain",
        "Désamorcé": "Désamorcé / Cassé"
    };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description || "", { async: true, relativeTo: this.document }
    );
    return context;
  }
}
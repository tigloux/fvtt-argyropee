import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class DiseaseSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "disease"],
    position: { width: 500, height: 550 },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { template: "systems/argyropee/templates/item-disease.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    context.origins = { "Naturelle": "Naturelle (Endurance Phys.)", "Magique": "Magique (Sens Magique)" };
    
    return context;
  }
}
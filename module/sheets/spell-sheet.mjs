import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class SpellSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "spell"],
    position: { width: 500, height: 600 },
    actions: { setTab: SpellSheet.#onSetTab, editImage: SpellSheet.#onEditImage },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { template: "systems/argyropee/templates/item-spell.hbs", scrollable: [".sheet-body"] }
  };

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new FilePicker({
      type: "image", current: current,
      callback: async path => {
        await this.document.update({ [attr]: path });
        this.render({ parts: ["header"] });
      }
    });
    return fp.browse();
  }

  static #onSetTab(event, target) {
    const tab = target.dataset.tab;
    const group = target.dataset.group;
    this.tabGroups[group] = tab;
    this.render(); 
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    
    // Les 12 Domaines (Naturelle, Élémentaire, Industrielle + Sang)
    context.spellDomains = {
        "Faune": "Faune (Naturelle)", "Flore": "Flore (Naturelle)", "Toxines": "Toxines (Naturelle)", "Sang": "Sang (Secret)",
        "Air": "Air (Élémentaire)", "Eau": "Eau (Élémentaire)", "Feu": "Feu (Élémentaire)", "Terre": "Terre (Élémentaire)",
        "Électricité": "Électricité (Indus.)", "Métal": "Métal (Indus.)", "Textile": "Textile (Indus.)", "Verre": "Verre (Indus.)"
    };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description || "", { async: true, relativeTo: this.document }
    );
    return context;
  }
}
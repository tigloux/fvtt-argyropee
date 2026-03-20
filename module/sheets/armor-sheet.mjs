import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class ArmorSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "armor"],
    position: { width: 500, height: 550 },
    window: {
        resizable: true // Permet de redimensionner pour voir le scroll
    },
    actions: { setTab: ArmorSheet.#onSetTab, editImage: ArmorSheet.#onEditImage },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { template: "systems/argyropee/templates/item-armor.hbs", scrollable: [".sheet-body"] }
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
    
    context.armorTypes = {
        "Armure": "Armure / Vêtement",
        "Bouclier": "Bouclier",
        "Casque": "Casque"
    };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description || "", { async: true, relativeTo: this.document }
    );
    return context;
  }
}
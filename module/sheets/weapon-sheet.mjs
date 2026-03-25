import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class WeaponSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "weapon"],
    position: { width: 500, height: 600 },
    actions: {
      setTab: WeaponSheet.#onSetTab,
      editImage: WeaponSheet.#onEditImage
    },
    window: {
        resizable: true // Permet de redimensionner pour voir le scroll
    },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { 
        template: "systems/argyropee/templates/item-weapon.hbs",
        scrollable: [".sheet-body"] 
    }
  };

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new FilePicker({
      type: "image",
      current: current,
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
    
    // Préparation des types d'armes
    context.weaponTypes = {
        "Courante": "Courante",
        "Guerre": "Guerre",
        "Feu": "Arme à Feu",
        "Dissimulée": "Dissimulée"
    };

    // Préparation des compétences de combat (récupérées de la config globale)
    context.combatSkills = {
        "rixe": CONFIG.ARGYROPEE.competences["rixe"],
        "combat_rapproche": CONFIG.ARGYROPEE.competences["combat_rapproche"],
        "combat_distance": CONFIG.ARGYROPEE.competences["combat_distance"]
    };
    // Préparation du type de munitions
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
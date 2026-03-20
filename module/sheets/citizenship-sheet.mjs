import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class CitizenshipSheet extends ArgyropeeItemSheet {
  
  constructor(options={}) {
    super(options);
    this.tabGroups = {
      primary: "body"
    };
  }

  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "citizenship"],
    position: { width: 450, height: 500 },
    tag: "form",
    window: {
        resizable: true // Permet de redimensionner pour voir le scroll
    },
    form: {
      handler: CitizenshipSheet.#onSubmitForm,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      editImage: CitizenshipSheet.#onEditImage,
      create: CitizenshipSheet.#onEffectControl,
      edit: CitizenshipSheet.#onEffectControl,
      delete: CitizenshipSheet.#onEffectControl,
      setTab: CitizenshipSheet.#onSetTab
    }
  };

  static PARTS = {
    header: { 
        template: "systems/argyropee/templates/item-header.hbs" 
    },
    body: { 
        template: "systems/argyropee/templates/item-citizenship.hbs",
        scrollable: [".sheet-body"] // Rend la zone de description scrollable
    }
  };
  
  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new FilePicker({
      type: "image",
      current: current,
      callback: path => {
        this.document.update({ [attr]: path });
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

  static async #onSubmitForm(event, form, formData) {
    const updateData = foundry.utils.expandObject(formData.object);
    await this.document.update(updateData);
  }

  static async #onEffectControl(event, target) {
    const action = target.dataset.action;
    const effectId = target.closest(".effect")?.dataset.effectId;
    const effect = effectId ? this.document.effects.get(effectId) : null;

    switch ( action ) {
      case "create":
        return this.document.createEmbeddedDocuments("ActiveEffect", [{
          name: "Nouvel Effet",
          icon: "icons/svg/aura.svg",
          origin: this.document.uuid,
          disabled: false
        }]);
      case "edit":
        return effect.sheet.render(true);
      case "delete":
        return effect.delete();
    }
  }

  /** @override */ 
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const activeTab = this.tabGroups.primary || "body";

    context.system = this.document.system;
    context.item = this.document;
    context.effects = this.document.effects;

    // Variables de permissions pour l'éditeur ProseMirror
    context.editable = this.isEditable;
    context.owner = this.document.isOwner;

    // Utilisation simplifiée de TextEditor et protection avec || ""
    context.enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
        this.document.system.description || "", 
        {
            secrets: this.document.isOwner,
            relativeTo: this.document
        }
    );

    context.tabs = {
      primary: {
        tabs: [
          { id: "body", label: "Description", icon: "fas fa-file-alt", cssClass: activeTab === "body" ? "active" : "" },
          { id: "effects", label: "Effets", icon: "fas fa-bolt", cssClass: activeTab === "effects" ? "active" : "" }
        ]
      }
    };

    context.tab = { id: activeTab, cssClass: "active" };
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Masquage manuel des parties qui ne correspondent pas à l'onglet actif
    // C'est une sécurité supplémentaire pour ApplicationV2
    const activeTab = this.tabGroups.primary;
    const parts = this.element.querySelectorAll(".tab");
    parts.forEach(p => {
        if (p.dataset.tab === activeTab) p.classList.add("active");
        else p.classList.remove("active");
    });
  }
}
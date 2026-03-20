import ArgyropeeItemSheet from "./item-sheet.mjs";

export default class ProfessionSheet extends ArgyropeeItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["argyropee", "sheet", "item", "profession"],
    position: { width: 480, height: 550 },
    actions: {
      setTab: ProfessionSheet.#onSetTab,
      editImage: ProfessionSheet.#onEditImage
    },
    form: { 
      submitOnChange: true,
      closeOnSubmit: false 
    }
  };

  static PARTS = {
    header: { template: "systems/argyropee/templates/item-header.hbs" },
    body: { 
        template: "systems/argyropee/templates/item-profession.hbs",
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
        this.render({ parts: ["header"] }); // Force le header à redessiner l'image
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
    
    // Sécurité vitale pour que le header trouve {{item.name}}
    context.item = this.document;

    const catObj = {
      "Agriculture, Élevage et Foresterie": ["empathie_animale", "herboristerie"],
      "Affaires et Commerce": ["bagout", "commerce"],
      "Architecture & Construction": ["sciences_techniques", "urbanisme"],
      "Arts & Sports": ["art", "endurance_physique"],
      "Artisanat": ["artisanat", "commerce"],
      "Chômeurs, Travailleurs Indépendants et Parias": ["fouille", "furtivite"],
      "Criminalité": ["furtivite", "piegeage"],
      "Éducation, Sciences et Mathématiques": ["deduction", "sciences_naturelles"],
      "Communication": ["bagout", "conduite"],
      "Gouvernement & Loi": ["charisme", "faux_usage_faux"],
      "Hospitalité & Travail Communautaire": ["artisanat", "detection"],
      "Militaire & Sécurité": ["combat_distance", "combat_rapproche"],
      "Religion": ["charisme", "sciences_religieuses"],
      "Santé": ["endurance_morale", "medecine"],
      "Transport": ["conduite", "pratique_nautique"]
    };

    // Prépare un objet propre pour le selectOptions de la catégorie
    context.categoryOptions = Object.keys(catObj).reduce((obj, key) => {
        obj[key] = key;
        return obj;
    }, {});

    // Récupérer les clés des compétences pour la catégorie actuelle
    const rawSkills = catObj[this.document.system.category] || [];

    // Créer un objet { "cle_technique": "Nom Lisible" } pour la liste déroulante
    context.bonusSkillOptions = {};
    for ( let key of rawSkills ) {
        // Va chercher le nom dans CONFIG.ARGYROPEE.competences, ou garde la clé par défaut
        context.bonusSkillOptions[key] = CONFIG.ARGYROPEE.competences[key] || key;
    }

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description || "", { async: true, relativeTo: this.document }
    );

    return context;
  }
}
/**
 * Fiche d'item parente pour Argyropée
 */
export default class ArgyropeeItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {
  
  // Définit l'onglet par défaut à l'ouverture
  constructor(options={}) {
    super(options);
    this.tabGroups = { primary: "body" };
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    actions: {
      setTab: ArgyropeeItemSheet.#onSetTab,
      addEffect: ArgyropeeItemSheet.#onAddEffect,
      editEffect: ArgyropeeItemSheet.#onEditEffect,
      deleteEffect: ArgyropeeItemSheet.#onDeleteEffect,
      toggleEffect: ArgyropeeItemSheet.#onToggleEffect
    }
  };

  // --- ACTIONS DES ONGLETS ---
  static #onSetTab(event, target) {
    const tab = target.dataset.tab;
    const group = target.dataset.group;
    this.tabGroups[group] = tab;
    this.render();
  }

  // --- ACTIONS DES EFFETS ACTIFS ---
  static async #onAddEffect(event, target) {
    return ActiveEffect.create({
      name: "Nouvel Effet",
      icon: "icons/svg/aura.svg",
      origin: this.document.uuid,
      transfer: false // TRÈS IMPORTANT : L'effet s'appliquera au porteur
    }, {parent: this.document}).then(effect => effect.sheet.render(true));
  }

  static async #onEditEffect(event, target) {
    const effectId = target.closest(".effect").dataset.effectId;
    const effect = this.document.effects.get(effectId);
    if (effect) effect.sheet.render(true);
  }

  static async #onDeleteEffect(event, target) {
    const effectId = target.closest(".effect").dataset.effectId;
    const effect = this.document.effects.get(effectId);
    if (effect) effect.delete();
  }

  static async #onToggleEffect(event, target) {
    const effectId = target.closest(".effect").dataset.effectId;
    const effect = this.document.effects.get(effectId);
    if (effect) effect.update({disabled: !effect.disabled});
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Transmission des données
    context.system = this.document.system;
    context.effects = this.document.effects; // On envoie les effets au HTML

    // Création dynamique de la navigation
    const activeTab = this.tabGroups.primary || "body";
    context.tabs = {
      primary: {
        tabs: [
          { id: "description", label: "Description", icon: "fas fa-file-alt", cssClass: activeTab === "description" ? "active" : "" },
          { id: "body", label: "Détails", icon: "fas fa-file-alt", cssClass: activeTab === "body" ? "active" : "" },
          { id: "effects", label: "Effets", icon: "fas fa-bolt", cssClass: activeTab === "effects" ? "active" : "" }
        ]
      }
    };
    context.tab = { id: activeTab };

    return context;
  }
  
  //Mémorisation de la position du scroll
  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // 1. On cible la zone scrollable de la fiche objet
    const scrollableArea = this.element.querySelector(".sheet-body");
    
    if (scrollableArea) {
        // 2. On restaure la position sauvegardée
        if (this._savedScrollTop !== undefined) {
            scrollableArea.scrollTop = this._savedScrollTop;
        }

        // 3. On sauvegarde la position en temps réel
        scrollableArea.addEventListener("scroll", (event) => {
            this._savedScrollTop = event.target.scrollTop;
        });
    }
  }
}
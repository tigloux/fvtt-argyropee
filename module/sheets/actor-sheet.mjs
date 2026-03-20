/**
 * Fiche d'acteur principale pour Argyropée utilisant ApplicationV2
 */
export default class ArgyropeeActorSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  
  // 1. Ajout du constructeur pour l'onglet par défaut
  constructor(options={}) {
    super(options);
    this.tabGroups = { primary: "competences" };
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["argyropee", "sheet", "actor"],
    position: { width: 1000, height: 700 },
    // Cette option indique à Foundry de surveiller le scroll dans ces sélecteurs
    scrollY: [".sheet-body"],
    window: {
        resizable: true // Permet de redimensionner pour voir le scroll
    },
    form: {
      submitOnChange: false, // Permet de sauvegarder sans écraser manuellement
      closeOnSubmit: false
    }, 
    actions: {
      rollComp: ArgyropeeActorSheet.#onRollComp,
      // ACTION POUR L'INITIATIVE
      rollInitiative: async function(event, target) {
        return this.document.rollArgyropeeInitiative();
      },

      // ACTION POUR LE REPOS
      rest: ArgyropeeActorSheet.#onRest,

      setSkill: async function(event, target) {
          event.preventDefault();
          event.stopPropagation();
          
          const body = this.element.querySelector(".sheet-body");
          const scrollPos = body ? body.scrollTop : 0;

          const rawValue = parseInt(target.dataset.value);
          const compPath = target.closest(".skill-dots").dataset.compKey; 
          const skillKey = compPath.split('.').pop();
          const label = target.closest(".comp-item").querySelector(".skill-roll-btn").innerText;

          // Magie Foundry : On compare le total actuel et la base pure en base de données
          // pour déduire TOUS les bonus (Active Effects, Armure, Métier...)
          const baseActuelle = this.document._source.system.competences[skillKey] || 0;
          const totalActuel = this.document.system.competences[skillKey] || 0;
          const totalBonus = totalActuel - baseActuelle;
          
          // Si on clique sur le jeton qui correspond exactement au score actuel, 
          // c'est qu'on veut le retirer (donc on soustrait 1).
          let value = rawValue;
          if (value === totalActuel) {
              value -= 1;
          }

          // La nouvelle base à enregistrer
          let baseValue = value - totalBonus;
          let futurTotal = value;
          let warning = "";

          // Si le joueur clique en dessous du bonus apporté par les effets
          if (baseValue < 0) {
              baseValue = 0;
              futurTotal = totalBonus; // Le total minimum possible
              warning = `
              <div style="color: darkred; font-size: 0.9em; margin-top: 10px; padding: 5px; border: 1px dashed darkred; background: rgba(139,0,0,0.05);">
                <b>Avertissement :</b> Le personnage possède un bonus total de <b>+${totalBonus}</b> grâce à son équipement ou ses états. Le total de la compétence ne peut pas descendre en dessous de ${totalBonus} !
              </div>`;
          }

          const confirm = await foundry.applications.api.DialogV2.confirm({
              window: { title: "Modification de Compétence" },
              content: `
                <p>Ajuster les points de base de <b>${label}</b> à <b>${baseValue}</b> ?</p>
                <p><i>(Avec l'équipement et les effets, le score total sera de <b>${futurTotal}</b>)</i></p>
                ${warning}
              `,
              rejectClose: false,
              modal: true
          });

          if (confirm) {
              await this.document.update({ [compPath]: baseValue });
              if (body) {
                  setTimeout(() => {
                      const newBody = this.element.querySelector(".sheet-body");
                      if (newBody) newBody.scrollTop = scrollPos;
                  }, 1);
              }
          }
      },
      editItem: ArgyropeeActorSheet.#onEditItem,
      deleteItem: ArgyropeeActorSheet.#onDeleteItem,
      setTab: ArgyropeeActorSheet.#onSetTab,
      editImage: ArgyropeeActorSheet.#onEditImage,
      toggleEquip: ArgyropeeActorSheet.#onToggleEquip,
      rollAttack: ArgyropeeActorSheet.#onRollAttack,
      castSpell: ArgyropeeActorSheet.#onCastSpell,
      decreaseQuantity: ArgyropeeActorSheet.#onDecreaseQuantity,
      increaseQuantity: ArgyropeeActorSheet.#onIncreaseQuantity,
      useConsumable: ArgyropeeActorSheet.#onUseConsumable,
      deployTrap: ArgyropeeActorSheet.#onDeployTrap,
      deleteEffect: ArgyropeeActorSheet.#onDeleteEffect,
      rollDisease: ArgyropeeActorSheet.#onRollDisease,
      addDiseaseSuccess: ArgyropeeActorSheet.#onAddDiseaseSuccess,
      toggleActiveMetier: ArgyropeeActorSheet.#onToggleActiveMetier,
    }
  };

  // On définit les "parties" de la fiche (HTML)
  static PARTS = {
    header: { template: "systems/argyropee/templates/actor-header.hbs" },
    body: { template: "systems/argyropee/templates/actor-body.hbs" }
  };

  /** * @override 
   * Remplace le titre technique par le simple nom du personnage
   */
  get title() {
    return this.document.name;
  }

  // 3. NOUVELLES MÉTHODES STATIQUES (à ajouter)
  static #onSetTab(event, target) {
    const tab = target.dataset.tab;
    const group = target.dataset.group;
    this.tabGroups[group] = tab;
    this.render(); 
  }

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new FilePicker({
      type: "image",
      current: current,
      callback: async path => {
        await this.document.update({ [attr]: path });
        this.render({parts: ["header"]}); 
      }
    });
    return fp.browse();
  }

  // Action : Réduire la quantité
  static async #onDecreaseQuantity(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item && item.system.quantity > 0) {
        await item.update({"system.quantity": item.system.quantity - 1});
    }
  }

  // Action : Augmenter la quantité
  static async #onIncreaseQuantity(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) {
        await item.update({"system.quantity": item.system.quantity + 1});
    }
  }

  // Action : Consommer une potion, une drogue ou un poison
  static async #onUseConsumable(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) return this.document.consumeItem(item);
  }

  // Action : Supprimer un Effet Actif (État préjudiciable)
  static async #onDeleteEffect(event, target) {
    const effectId = target.closest("[data-effect-id]").dataset.effectId;
    const effect = this.document.effects.get(effectId);
    if (effect) await effect.delete();
  }

  // Jet de lutte contre la maladie
  static async #onRollDisease(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;

    // Détermine la compétence à lancer
    const skillKey = item.system.origin === "Magique" ? "sens_magique" : "endurance_physique";
    
    ui.notifications.info(`Jet de lutte contre ${item.name} en cours...`);
    
    // NOUVEAU : On appelle directement la fonction de l'acteur !
    return this.document.rollComp(skillKey);
  }

  // Ajouter un succès manuellement
  static async #onAddDiseaseSuccess(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;

    if (item.system.remedyRequired) {
        ui.notifications.warn("Cette maladie est incurable naturellement. Elle nécessite un traitement spécifique !");
        return;
    }

    let newPassed = item.system.testsPassed + 1;
    
    if (newPassed >= item.system.testsRequired) {
        ui.notifications.info(`${this.document.name} a vaincu la maladie : ${item.name} !`);
        await item.delete(); // Guérison ! L'objet et ses Effets Actifs disparaissent.
    } else {
        await item.update({ "system.testsPassed": newPassed });
    }
  }

  // Action : Définir un métier comme étant le métier Actif
  static async #onToggleActiveMetier(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const clickedItem = this.document.items.get(itemId);

    if (!clickedItem) return;

    // Si on clique sur le métier qui est DÉJÀ actif, on le désactive.
    if (clickedItem.system.isActive) {
      await clickedItem.update({ "system.isActive": false });
    } else {
      // Magie Foundry : On met à jour TOUS les items de type "metier" en une seule fois.
      // Seul celui cliqué passe à "true", les autres passent à "false".
      const updates = this.document.items
        .filter(i => i.type === "metier")
        .map(i => ({
          _id: i.id,
          "system.isActive": i.id === itemId
        }));
      
      await this.document.updateEmbeddedDocuments("Item", updates);
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // 1. Définition de l'onglet actif
    const activeTab = this.tabGroups.primary || "competences";
    const actor = this.document;
    
    // On prépare les données pour Handlebars
    context.actor = actor;
    context.system = this.document.system;
    context.config = CONFIG.ARGYROPEE; // Utile pour les listes de compétences
    
    // On prépare un objet pour trier les items
    context.itemsByType = {
      citoyennete: [],
      metier: [],
      armesEquipees: [],
      armesInventaire: [],
      armuresEquipees: [],
      armuresInventaire: [],
      arme: [],
      armure: [],
      sort: [],
      munition: [],
      piege: [],
      consommable: [],
      maladie: []
    };

    // On boucle sur tous les items possédés par l'acteur et on les range
    for ( let item of this.document.items ) {
      
      // Tri spécifique pour les Armes
      if (item.type === "arme") {
          context.itemsByType.arme.push(item);
          if (item.system.equipped) {
              context.itemsByType.armesEquipees.push(item);
          } else {
              context.itemsByType.armesInventaire.push(item);
          }
      }
      // Tri spécifique pour les Armures
      else if (item.type === "armure") {
          context.itemsByType.armure.push(item);  
          if (item.system.equipped) {
              context.itemsByType.armuresEquipees.push(item);
          } else {
              context.itemsByType.armuresInventaire.push(item);
          }
      }
      // Tri classique pour le reste
      else if ( context.itemsByType[item.type] !== undefined ) {
        context.itemsByType[item.type].push(item);
      }
    }

    context.activeMetier = context.itemsByType.metier.find(m => m.system.isActive === true);

    // --- TEXTES ENRICHIS POUR LE BACKGROUND ---
    const bg = this.document.system.background || {};
    context.enrichedPhysique = await TextEditor.enrichHTML(bg.physique || "", { async: true });
    context.enrichedFamille = await TextEditor.enrichHTML(bg.famille || "", { async: true });
    context.enrichedAmours = await TextEditor.enrichHTML(bg.amours || "", { async: true });
    context.enrichedAmis = await TextEditor.enrichHTML(bg.amis || "", { async: true });
    context.enrichedEnnemis = await TextEditor.enrichHTML(bg.ennemis || "", { async: true });
    context.enrichedTravail = await TextEditor.enrichHTML(bg.travail || "", { async: true });

    // --- LISTE DES EFFETS ACTIFS SÉPARÉS ---
    context.systemEffects = [];
    context.itemEffects = [];

    for (let effect of this.document.effects) {
        // Si l'origine de l'effet contient "Item", il vient d'une arme, d'un sort, d'un poison...
        if (effect.origin && effect.origin.includes("Item")) {
            context.itemEffects.push(effect);
        } else {
            // Sinon, c'est un état préjudiciable appliqué manuellement (système)
            context.systemEffects.push(effect);
        }
    }

    // --- MOTEUR DE COULEURS DES COMPÉTENCES ---
    context.skillsData = {};
    if (this.document.type === "character") {
      for (const [key, label] of Object.entries(CONFIG.ARGYROPEE.competences)) {
          // 1. On récupère la BASE pure (enregistrée en base de données)
          let baseCount = this.document._source.system.competences[key] || 0;
          
          // 2. On compte les sources
          let metierCount = 0;
          let citCount = 0;
          
          for (let item of this.document.items) {
              if (item.type === "metier" && item.system.chosenBonusSkill === key) metierCount += 1;
              
              // On gère la liste des compétences de Citoyenneté
              if (item.type === "citoyennete" && item.system.bonusInitial) {
                  // Sépare les mots par les virgules et enlève les espaces
                  const keys = item.system.bonusInitial.split(',').map(s => s.trim());
                  if (keys.includes(key)) citCount += 1;
              }
          }

          // 3. On calcule le score attendu (Base + Métier + Citoyenneté) et le score réel
          let expectedScore = baseCount + metierCount + citCount;
          let totalScore = this.document.system.competences[key] || 0;
          let dots = [];
          
          // 4. Distribution des couleurs jeton par jeton
          for (let i = 0; i < 7; i++) {
              let cssClass = "empty";
              let tooltip = "Vide";
              
              if (i < totalScore) {
                  // --- POINTS POSSÉDÉS ---
                  if (baseCount > 0) {
                      cssClass = "filled base"; tooltip = "Création / XP"; baseCount--;
                  } else if (metierCount > 0) {
                      cssClass = "filled metier"; tooltip = "Bonus de Métier"; metierCount--;
                  } else if (citCount > 0) {
                      cssClass = "filled citoyennete"; tooltip = "Bonus de Citoyenneté"; citCount--;
                  } else {
                      cssClass = "filled temp"; tooltip = "Bonus Temporaire / Magique";
                  }
              } else if (i < expectedScore) {
                  // --- POINTS PERDUS (MALUS) ---
                  // Si on est au-dessus du total réel mais en dessous du score attendu, c'est un point perdu !
                  cssClass = "filled malus"; 
                  tooltip = "Point neutralisé (Malus d'état)";
              }
              
              dots.push({ value: i + 1, cssClass: cssClass, tooltip: tooltip });
          }
          
          context.skillsData[key] = { label: label, dots: dots };
        }
    }

    // 4. Configuration des onglets
    context.tabs = {
      primary: {
        tabs: [
          { id: "competences", label: "Compétences", icon: "fas fa-brain", cssClass: activeTab === "competences" ? "active" : "" },
          { id: "combat", label: "Combat", icon: "fas fa-swords", cssClass: activeTab === "combat" ? "active" : "" },
          { id: "equipement", label: "Équipement", icon: "fas fa-backpack", cssClass: activeTab === "equipement" ? "active" : "" },
          { id: "background", label: "Background", icon: "fas fa-book-open", cssClass: activeTab === "background" ? "active" : "" },
          { id: "etats", label: "Santé & États", icon: "fas fa-heartbeat", cssClass: activeTab === "etats" ? "active" : "" }
        ]
      }
    };
    context.tab = { id: activeTab, cssClass: "active" };

    // Calcul de la richesse totale en Sous
    const richesse = this.document.system.richesse || {lingots: 0, florins: 0, deniers: 0, sous: 0};
    context.totalSous = (richesse.lingots * 10000) + (richesse.florins * 100) + (richesse.deniers * 10) + richesse.sous;

    return context;
  }

  static async #onRollComp(event, target) {
    // 1. On récupère la clé de la compétence cliquée (ex: "agilite")
    const element = target.closest("[data-comp]");
    if (!element) return;
    const skillKey = element.dataset.comp;
    
    // 2. On passe le relais à l'acteur (qui va ouvrir sa propre boîte de dialogue)
    return this.document.rollComp(skillKey);
  }

  // Action : Ouvrir la fiche de l'item quand on clique sur l'icône Éditer
  static async #onEditItem(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if ( item ) item.sheet.render(true);
  }

  // Action : Supprimer l'item quand on clique sur la corbeille
  static async #onDeleteItem(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    // Supprimer l'item supprimera automatiquement ses effets actifs de l'acteur !
    if ( item ) await item.delete();
  }

  // Action : Équiper ou Déséquiper une arme
  static async #onToggleEquip(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if ( item ) {
      // Inverse la valeur booléenne actuelle (true devient false, et inversement)
      await item.update({ "system.equipped": !item.system.equipped });
    }
  }

  // Action : Lancer une attaque avec l'arme
  static async #onRollAttack(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if ( item ) {
      // On envoie l'objet arme à la nouvelle fonction de l'acteur
      return this.document.rollWeaponAttack(item);
    }
  }

  // NOUVELLE MÉTHODE Lancer un sort
  static async #onCastSpell(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if ( item ) return this.document.castSpell(item);
  }

  // NOUVELLE MÉTHODE Déployer un piège
  static async #onDeployTrap(event, target) {
    const itemId = target.closest(".item").dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) return this.document.deployTrap(item);
  }

  // Action : Gérer la nuit de repos
  static async #onRest(event, target) {
    event.preventDefault();
    return this.document.rest();
  }

  //Conservation de la position du scroll
  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // 1. On cible la zone de votre fiche qui contient la barre de défilement
    const scrollableArea = this.element.querySelector(".sheet-body");
    
    if (scrollableArea) {
        // 2. Après le redessin de la fiche, on restaure la position sauvegardée
        if (this._savedScrollTop !== undefined) {
            scrollableArea.scrollTop = this._savedScrollTop;
        }

        // 3. On écoute le défilement pour sauvegarder la position en temps réel
        scrollableArea.addEventListener("scroll", (event) => {
            this._savedScrollTop = event.target.scrollTop;
        });
    }
  }

  /** @override */
  _onChangeForm(event, formConfig) {
    super._onChangeForm(event, formConfig);

    // 1. Utilisation du nouveau namespace pour V13
    const { FormDataExtended } = foundry.applications.ux;
    
    // 2. Extraction des données du formulaire
    const formData = new FormDataExtended(this.element).object;
    
    // --- Blocage de la Santé au Maximum ---
    if (formData["system.sante.value"] !== undefined) {
        const maxHealth = this.document.system.santeMax;
        if (formData["system.sante.value"] > maxHealth) {
            formData["system.sante.value"] = maxHealth;
            ui.notifications.info("Les PS ne peuvent pas dépasser le maximum. Utilisez les PS Temporaires !");
        }
    }

    // 3. Sécurité : On s'assure de ne pas envoyer un nom vide/undefined
    // Si 'name' est dans formData mais qu'il est vide, on le supprime 
    // pour que Foundry garde l'ancien nom au lieu de générer une erreur.
    if (!formData.name) delete formData.name;

    // 4. Mise à jour du document
    console.log("Argyropée | Sauvegarde des données :", formData);
    return this.document.update(formData);
  }
}
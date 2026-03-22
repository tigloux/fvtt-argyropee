/**
 * Fichier principal d'initialisation du système Argyropée.
 * @module argyropee
 * * ARCHITECTURE :
 * Ce fichier configure le système (DataModels, Sheets, Status Effects) lors du chargement
 * et contient tous les "Hooks" (écouteurs d'événements) pour l'automatisation du monde
 * (gestion des tours de combat, destruction d'objets, système anti-mort).
 */

import { ArgyropeeActor } from "./documents/actor.mjs";
import ArgyropeeActorSheet from "./sheets/actor-sheet.mjs";
import CitizenshipSheet from "./sheets/citizenship-sheet.mjs";
import ProfessionSheet from "./sheets/profession-sheet.mjs";
import WeaponSheet from "./sheets/weapon-sheet.mjs";
import ArmorSheet from "./sheets/armor-sheet.mjs";
import SpellSheet from "./sheets/spell-sheet.mjs";
import AmmoSheet from "./sheets/ammo-sheet.mjs";
import ConsumableSheet from "./sheets/consumable-sheet.mjs";
import TrapSheet from "./sheets/trap-sheet.mjs";
import DiseaseSheet from "./sheets/disease-sheet.mjs";
import NPCSheet from "./sheets/npc-sheet.mjs";
import MonsterSheet from "./sheets/monster-sheet.mjs";
import { addChatListeners } from "./helpers/chat-listeners.mjs";
import { 
  ArgyropeeActorData, 
  CitizenshipData, 
  ProfessionData, 
  WeaponData, 
  ArmorData, 
  SpellData,
  ConsumableData, 
  TrapData,
  AmmunitionData,
  DiseaseData,
  ArgyropeeMonsterData,
  ArgyropeeNPCData
} from "./data-models.mjs";

// ==========================================
// HELPERS & CONSTANTES
// ==========================================

/** Helper Handlebars basique pour additionner deux valeurs dans les templates HTML */
Handlebars.registerHelper('add', function(a, b) {
  return a + b;
});

/** * Dictionnaire central du système.
 * DEV : La section 'categories' est cruciale car c'est elle qui permet d'appliquer
 * les malus globaux (ex: flags.argyropee.modificateurs.physique) aux bonnes compétences.
 */
const ARGYROPEE = {
  competences: {
    agilite: "Agilité",
    alchimie: "Alchimie",
    art: "Art",
    artificerie: "Artificerie",
    artisanat: "Artisanat",
    bagout: "Bagout",
    charisme: "Charisme",
    combat_distance: "Combat à distance",
    combat_rapproche: "Combat rapproché",
    commerce: "Commerce",
    conduite: "Conduite",
    deduction: "Déduction",
    detection: "Détection",
    empathie_animale: "Empathie animale",
    endurance_morale: "Endurance morale",
    endurance_physique: "Endurance physique",
    escalade: "Escalade",
    faux_usage_faux: "Faux et usage de faux",
    fouille: "Fouille",
    furtivite: "Furtivité",
    herboristerie: "Herboristerie",
    medecine: "Médecine",
    piegeage: "Piégeage",
    pratique_nautique: "Pratique nautique",
    rixe: "Rixe",
    sciences_naturelles: "Sciences naturelles",
    sciences_religieuses: "Sciences religieuses",
    sciences_sociales: "Sciences sociales",
    sciences_techniques: "Sciences techniques",
    sens_magique: "Sens magique",
    serrurerie: "Serrurerie",
    urbanisme: "Urbanisme"
  },
  // Catégories de compétences
  categories: {
    agilite: "physique",
    alchimie: "intellectuelle",
    art: "sociale",
    artificerie: "intellectuelle",
    artisanat: "intellectuelle",
    bagout: "sociale",
    charisme: "sociale",
    combat_distance: "physique",
    combat_rapproche: "physique",
    commerce: "sociale",
    conduite: "intellectuelle",
    deduction: "intellectuelle",
    detection: "intellectuelle",
    empathie_animale: "sociale",
    endurance_morale: "intellectuelle",
    endurance_physique: "physique",
    escalade: "physique",
    faux_usage_faux: "intellectuelle",
    fouille: "intellectuelle",
    furtivite: "physique",
    herboristerie: "intellectuelle",
    medecine: "intellectuelle",
    piegeage: "intellectuelle",
    pratique_nautique: "physique",
    rixe: "physique",
    sciences_naturelles: "intellectuelle",
    sciences_religieuses: "intellectuelle",
    sciences_sociales: "intellectuelle",
    sciences_techniques: "intellectuelle",
    sens_magique: "intellectuelle",
    serrurerie: "intellectuelle",
    urbanisme: "intellectuelle"
  }
};

// ==========================================
// CLASSES PERSONNALISÉES
// ==========================================

/**
 * Extension du Combat Tracker de Foundry.
 * Redirige le jet d'initiative natif vers notre propre méthode rollArgyropeeInitiative().
 */
class ArgyropeeCombat extends Combat {
  async rollInitiative(ids, options={}) {
    // Le tracker peut envoyer un seul ID (clic sur un dé) ou plusieurs (Lancer Tout)
    ids = typeof ids === "string" ? [ids] : ids;
    
    // Pour chaque combattant concerné, on appelle la fonction de sa fiche !
    for ( let id of ids ) {
      const combatant = this.combatants.get(id);
      if ( combatant && combatant.actor ) {
        await combatant.actor.rollArgyropeeInitiative();
      }
    }
    return this;
  }
}

// ==========================================
// INITIALISATION DE FOUNDRY
// ==========================================

Hooks.once("init", async() => {
  console.log("Argyropée | Initialisation du système...");
  //Chargement des compétences
  CONFIG.ARGYROPEE = ARGYROPEE;
  
  // Configuration du combat et de la formule d'initiative par défaut
  CONFIG.Combat.documentClass = ArgyropeeCombat;
  
  // Configuration de l'initiative native
  CONFIG.Combat.initiative = {
    formula: "(1d10 % 10) + @initiativeFinale",
    decimals: 0
  };
  
  // Liaison de la classe d'Acteur
  CONFIG.Actor.documentClass = ArgyropeeActor;
  
  // Enregistrement du modèle de données pour les personnages
  CONFIG.Actor.dataModels = {
    "character": ArgyropeeActorData,
    "npc": ArgyropeeNPCData,
    "monster": ArgyropeeMonsterData
  };
  
  // Enregistrement complet des types d'items
  CONFIG.Item.dataModels = {
    "citoyennete": CitizenshipData,
    "metier": ProfessionData,
    "arme": WeaponData,
    "armure": ArmorData,
    "sort": SpellData,
    "consommable": ConsumableData,
    "piege": TrapData,
    "munition": AmmunitionData,
    "maladie": DiseaseData
  };
  
  // Enregistrement des fiches d'Acteurs
  DocumentSheetConfig.registerSheet(Actor, "argyropee", ArgyropeeActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "Fiche de Personnage Argyropée"
  });
  
  DocumentSheetConfig.registerSheet(Actor, "argyropee", NPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "PNJ"
  });
  
  DocumentSheetConfig.registerSheet(Actor, "argyropee", MonsterSheet, {
    types: ["monster"],
    makeDefault: true,
    label: "Monstre"
  });
  
  // Enregistrement des fiches d'items
  Items.unregisterSheet("core", ItemSheet); // On retire la fiche par défaut
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", CitizenshipSheet, {
    types: ["citoyennete"],
    makeDefault: true,
    label: "Citoyenneté"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", ProfessionSheet, {
    types: ["metier"],
    makeDefault: true,
    label: "Métier"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", WeaponSheet, {
    types: ["arme"],
    makeDefault: true,
    label: "Arme"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", ArmorSheet, {
    types: ["armure"],
    makeDefault: true,
    label: "Armure"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", SpellSheet, {
    types: ["sort"],
    makeDefault: true,
    label: "Sort"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", AmmoSheet, {
    types: ["munition"],
    makeDefault: true,
    label: "Munition"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", ConsumableSheet, {
    types: ["consommable"],
    makeDefault: true,
    label: "Consommable"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", TrapSheet, {
    types: ["piege"],
    makeDefault: true,
    label: "Piège"
  });
  
  DocumentSheetConfig.registerSheet(Item, "argyropee", DiseaseSheet, {
    types: ["maladie"],
    makeDefault: true,
    label: "Maladie"
  });
  
  // ==========================================
  // ÉTATS PRÉJUDICIABLES D'ARGYROPÉE
  // ==========================================
  // DEV : C'est ici que vous pouvez ajouter de nouveaux statuts. 
  // Les clés utilisées ici communiquent directement avec actor.mjs pour moduler les compétences.
  CONFIG.statusEffects = [
    { id: "a_terre", name: "À terre", img: "systems/argyropee/css/assets/icones/argyropee_icones_a-terre.webp" }, // Automatisé
    { id: "affame", name: "Affamé", img: "systems/argyropee/css/assets/icones/argyropee_icones_affamé.webp" }, // Automatisé - Macro MJ pour augmenter le niveau de Faim
    { id: "assoiffe", name: "Assoiffé", img: "systems/argyropee/css/assets/icones/argyropee_icones_assoiffé.webp" }, // Automatisé - Macro MJ pour augmenter le niveau de Soif
    { id: "agrippe", name: "Agrippé", img: "systems/argyropee/css/assets/icones/argyropee_icones_agrippé.webp" }, // Automatisé
    { 
      id: "aveugle", name: "Aveuglé", img: "systems/argyropee/css/assets/icones/argyropee_icones_aveuglé.webp", // Automatisé
      // Active un drapeau pour signaler la cécité 
      changes: [{ key: "flags.argyropee.aveugle", mode: 5, value: "true" }] 
    },
    { 
      id: "assourdi", name: "Assourdi", img: "systems/argyropee/css/assets/icones/argyropee_icones_assourdi.webp", // Automatisé
      // Active un drapeau pour signaler l'assourdissement'
      changes: [{ key: "flags.argyropee.assourdi", mode: 5, value: "true" }]
    },
    { id: "brule", name: "Brûlé", img: "systems/argyropee/css/assets/icones/argyropee_icones_brulé.webp" }, // Automatisé
    { id: "drogue", name: "Drogué", img: "systems/argyropee/css/assets/icones/argyropee_icones_drogué.webp" },
    { 
      id: "ebloui", name: "Ébloui", img: "systems/argyropee/css/assets/icones/argyropee_icones_aveuglé.webp", // Automatisé
      changes: [{ key: "flags.argyropee.ebloui", mode: 5, value: "true" }] 
    },
    { id: "effraye", name: "Effrayé", img: "systems/argyropee/css/assets/icones/argyropee_icones_effrayé.webp" },
    { id: "empoisonne", name: "Empoisonné", img: "systems/argyropee/css/assets/icones/argyropee_icones_empoisonné.webp" },
    { 
      id: "enchevetre", name: "Enchevêtré", img: "systems/argyropee/css/assets/icones/argyropee_icones_enchevetré.webp",
    },
    { 
      id: "epuise", name: "Épuisé", img: "systems/argyropee/css/assets/icones/argyropee_icones_épuisé.webp", // Automatisé
      changes: [
        { key: "flags.argyropee.modificateurs.physique", mode: 2, value: "-4" },
        { key: "flags.argyropee.modificateurs.intellectuelle", mode: 2, value: "-4" },
        { key: "flags.argyropee.cantRun", mode: 5, value: "true"}
      ]
    },
    { 
      id: "fatigue", name: "Fatigué", img: "systems/argyropee/css/assets/icones/argyropee_icones_fatigué.webp", // Automatisé
      changes: [
        { key: "flags.argyropee.modificateurs.physique", mode: 2, value: "-2" },
        { key: "flags.argyropee.modificateurs.intellectuelle", mode: 2, value: "-2" },
        { key: "flags.argyropee.cantRun", mode: 5, value: "true"}
      ] 
    },
    { id: "gele", name: "Gelé", img: "systems/argyropee/css/assets/icones/argyropee_icones_gelé.webp" }, // Automatisé
    { id: "hemorragique", name: "Hémorragique", img: "systems/argyropee/css/assets/icones/argyropee_icones_hémorragique.webp" }, // Automatisé
    { id: "inconscient", name: "Inconscient", img: "systems/argyropee/css/assets/icones/argyropee_icones_inconscient.webp" },
    { id: "malade", name: "Malade", img: "systems/argyropee/css/assets/icones/argyropee_icones_malade.webp" },
    { id: "mort", name: "Mort", img: "systems/argyropee/css/assets/icones/argyropee_icones_mort.webp" },
    { id: "nauseeux", name: "Nauséeux", img: "systems/argyropee/css/assets/icones/argyropee_icones_nauséeux.webp" },
    { id: "noye", name: "Noyé", img: "systems/argyropee/css/assets/icones/argyropee_icones_noyé.webp" },
    { id: "paralyse", name: "Paralysé", img: "systems/argyropee/css/assets/icones/argyropee_icones_paralysé.webp" },
    { 
      id: "saoul", name: "Saoul", img: "systems/argyropee/css/assets/icones/argyropee_icones_saoul.webp", // Automatisé
      changes: [
        { key: "flags.argyropee.modificateurs.physique", mode: 2, value: "-2" },
        { key: "flags.argyropee.modificateurs.intellectuelle", mode: 2, value: "-3" },
        { key: "flags.argyropee.modificateurs.sociale", mode: 2, value: "2" }
      ]
    },
    { 
      id: "secoue", name: "Secoué", img: "systems/argyropee/css/assets/icones/argyropee_icones_secoué.webp", // Automatisé
      changes: [{ key: "flags.argyropee.malusGlobal", mode: 2, value: "-2" }]
    },
    { 
      id: "stresse", name: "Stressé", img: "systems/argyropee/css/assets/icones/argyropee_icones_stressé.webp",
      changes: [{ key: "flags.argyropee.malusGlobal", mode: 2, value: "-1" }] 
    },
    { 
      id: "sevrage", name: "En Sevrage", img: "systems/argyropee/css/assets/icones/argyropee_icones_sevrage.webp",
      changes: [
        { key: "flags.argyropee.malusGlobal", mode: 2, value: "-1" },
        { key: "flags.argyropee.malusGlobal", mode: 2, value: "-2" }
        // etc. Ajoutez les malus globaux que vous souhaitez pour le sevrage
      ]
    }
  ];
  
  // Remplacement des overlays de base de Foundry
  CONFIG.specialStatusEffects.DEFEATED = "mort";
  CONFIG.specialStatusEffects.BLIND = "aveugle";
  
  // Préchargement des Partials Handlebars
  const templatePaths = [
    "systems/argyropee/templates/actor-nav.hbs"
    // Ajout possible d'autres partials ici plus tard (ex: item-card.hbs, etc.)
  ];
  await loadTemplates(templatePaths);
  console.log("Argyropée | Système prêt !");
});

Hooks.on("renderChatLog", (app, html, data) => {
  addChatListeners(html);
});

// ==========================================
// HOOKS DU SYSTÈME (AUTOMATISATION)
// ==========================================

/**
 * Écoute la mise à jour d'un objet.
 * Utilisé pour détruire automatiquement l'objet si sa quantité tombe à 0 ou moins.
 */
Hooks.on("updateItem", async (item, changes, options, userId) => {
  // 1. On s'assure que c'est bien le joueur actuel qui a fait la modification
  if (game.user.id !== userId) return;
  
  // 2. On vérifie que l'objet appartient bien à un Acteur (on ne supprime pas les objets dans les Compendiums/Dossiers !)
  if (!item.parent) return;
  
  // 3. Si la mise à jour concerne la quantité...
  if (foundry.utils.hasProperty(changes, "system.quantity")) {
    const newQty = foundry.utils.getProperty(changes, "system.quantity");
    
    // ... et qu'elle tombe à 0 ou moins, on supprime l'objet !
    if (newQty <= 0) {
      await item.delete();
      ui.notifications.info(`L'objet ${item.name} a été retiré de l'inventaire car son stock est épuisé.`);
    }
  }
});

/**
 * Déclenché à chaque changement de tour dans le Combat Tracker.
 * Gère les durées personnalisées, les dégâts continus, l'agrippement et la nausée.
 */
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (!game.user.isGM) return;
  
  const combatant = combat.combatant; // Plus fiable que combatantId
  if (!combatant || !combatant.actor) return;
  const actor = combatant.actor;
  
  console.log(`Argyropée | --- Tour de ${actor.name} ---`);
  
  // --- A. SUIVI DES EFFETS (Via nos Flags sécurisés) ---
  for (let e of actor.effects) {
    // On vérifie si notre drapeau personnalisé est présent
    const isCustomDuration = e.getFlag("argyropee", "customDuration");
    
    if (isCustomDuration) {
      let maxRounds = e.getFlag("argyropee", "maxRounds");
      let startR = e.getFlag("argyropee", "startRound") ?? combat.round;
      
      let roundsElapsed = combat.round - startR;
      let remainingRounds = maxRounds - roundsElapsed;
      
      console.log(`Argyropée | Effet ${e.name} : ${remainingRounds} tours restants sur ${maxRounds}`);
      
      if (remainingRounds > 0) {
        ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients("GM"),
          content: `<div style="padding: 5px; border-left: 3px solid #171f69; background: #f0f0e6; color: #333;">
                        ⏳ L'état <b>${e.name}</b> sur <b>${actor.name}</b> se dissipe dans <b>${remainingRounds} tour(s)</b>.
                    </div>`
        });
      } else {
        ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients("GM"),
          content: `
                    <div style="border: 2px solid #5a1212; border-radius: 5px; overflow: hidden; margin-top: 5px;">
                        <header style="background: #5a1212; color: white; padding: 5px; font-weight: bold; text-align: center;">
                            <i class="fas fa-hourglass-end"></i> Effet Expiré !
                        </header>
                        <div style="padding: 10px; background: #fff; text-align: center; color: #333;">
                            Le temps est écoulé pour <b>${e.name}</b> sur <b>${actor.name}</b>.<br><br>
                            <button class="argyropee-remove-effect" data-action="removeExpiredEffect" data-effect-uuid="${e.uuid}" data-effect-id="${e.id}" style="cursor: pointer; background: #eee; border: 1px solid #ccc; padding: 5px; border-radius: 3px;">
                                <i class="fas fa-trash"></i> Retirer l'état
                            </button>
                        </div>
                    </div>`
        });
      }
    }
  }
  
  // --- B. GESTION DES DÉGÂTS CONTINUS (Hémorragie & Brûlure) ---
  const isHemorragic = actor.statuses.has("hemorragique");
  const isBrule = actor.statuses.has("brule");
  const isGele = actor.statuses.has("gele");
  
  if (isHemorragic || isBrule || isGele) {
    const healthPath = actor.type === "character" ? "system.sante.value" : "system.health.value";
    const currentHealth = foundry.utils.getProperty(actor, healthPath) || 0;
    
    let degats = 0;
    let raisons = [];
    if (isHemorragic) { degats += 1; raisons.push("son hémorragie"); }
    if (isBrule) { degats += 1; raisons.push("ses brûlures"); }
    if (isGele) { degats += 1; raisons.push("ses engelures"); }
    
    const newHealth = currentHealth - degats; 
    await actor.update({ [healthPath]: newHealth });
    
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: `
              <div style="border: 2px solid darkred; border-radius: 5px; overflow: hidden;">
                <header style="background: darkred; color: white; padding: 5px; font-weight: bold;">
                    <i class="fas fa-tint"></i> Dégâts continus
                </header>
                <div style="padding: 10px; background: rgba(139, 0, 0, 0.1); color: darkred;">
                    <b>${actor.name}</b> perd <b>${degats} Point(s) de Santé</b> à cause de ${raisons.join(" et ")}.
                </div>
              </div>`
    });
    
    if (actor.type === "monster" && newHealth <= 0 && !actor.statuses.has("mort")) {
      await actor.toggleStatusEffect("mort", { active: true });
      ChatMessage.create({ content: `<b style="color: darkred;">${actor.name} succombe à ses blessures !</b>` });
    } 
    else if (actor.type !== "monster" && newHealth == 0 && !actor.statuses.has("inconscient")) {
      await actor.toggleStatusEffect("inconscient", { active: true });
      ChatMessage.create({ content: `<b>${actor.name} sombre dans l'inconscience !</b>` });
    }
  }
  
  // --- C. GESTION DE L'ÉTAT AGRIPPÉ ---
  const isAgrippe = actor.statuses.has("agrippe");
  
  if (isAgrippe) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: `
            <div style="border: 2px solid #192a51; border-radius: 5px; overflow: hidden; margin-top: 5px;">
                <header style="background: #192a51; color: white; padding: 5px; font-weight: bold; text-align: center;">
                    <i class="fas fa-hand-rock"></i> Personnage Agrippé
                </header>
                <div style="padding: 10px; background: #fff; text-align: center; color: #333;">
                    <b>${actor.name}</b> est agrippé(e) et ne peut rien faire d'autre que tenter de se dégager.<br><br>
                    <i>Ciblez (Touche T) votre agresseur avant de cliquer :</i><br><br>
                    <button type="button" data-action="escapeGrapple" data-actor-id="${actor.id}" style="cursor: pointer; background: #eee; border: 1px solid #ccc; padding: 5px; border-radius: 3px;">
                        <i class="fas fa-running"></i> Tenter de se libérer
                    </button>
                </div>
            </div>`
    });
  }
  
  // --- D. GESTION DE L'ÉTAT NAUSÉEUX ---
  const isNauseeux = actor.statuses.has("nauseeux") || actor.statuses.has("nauséeux");
  
  if (isNauseeux) {
    // On lance le d100
    const roll = new Roll("1d100");
    await roll.evaluate();
    
    // 50% de chance (de 1 à 50 = vomi, de 51 à 100 = contenu)
    const aVomi = roll.total <= 50;
    
    const color = aVomi ? "#5a8a12" : "#192a51"; // Vert "malade" ou Bleu classique
    const icon = aVomi ? "fa-biohazard" : "fa-shield-virus";
    const title = aVomi ? "Crise de nausée !" : "Nausée contenue";
    const text = aVomi 
    ? `<b>${actor.name}</b> est pris(e) de violents vomissements <b>(Jet : ${roll.total})</b>.<br><br><i>Son tour est passé automatiquement !</i>`
    : `<b>${actor.name}</b> parvient de justesse à réprimer sa nausée <b>(Jet : ${roll.total})</b>.<br><br><i>Le personnage peut agir normalement.</i>`;
    
    // On affiche le résultat dans le chat pour que tout le monde comprenne ce qu'il se passe
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: `
            <div style="border: 2px solid ${color}; border-radius: 5px; overflow: hidden; margin-top: 5px;">
                <header style="background: ${color}; color: white; padding: 5px; font-weight: bold; text-align: center;">
                    <i class="fas ${icon}"></i> ${title}
                </header>
                <div style="padding: 10px; background: #fff; text-align: center; color: #333;">
                    ${text}
                </div>
            </div>`
    });
    
    // Si le personnage vomit, on commande au Combat Tracker de passer au tour suivant
    if (aVomi) {
      // Petite pause d'une seconde et demie pour que les joueurs aient le temps 
      // de voir le message apparaître avant que le tour ne saute à la personne suivante
      setTimeout(async () => {
        await game.combat.nextTurn();
      }, 1500);
    }
  }
  
  // --- E. GESTION DES DÉGÂTS CONTINUS MAGIQUES (Chantier 2) ---
  let totalDmgContinus = 0;
  let messagesContinus = [];
  
  // On parcourt tous les effets actifs du combattant
  for (let effet of actor.effects) {
    if (effet.disabled) continue;
    
    let formuleDegats = null;
    let msgAmbiance = "subit des dégâts continus";
    
    // Lecture des Changements
    for (let change of effet.changes) {
      if (change.key === "flags.argyropee.degatsContinus") formuleDegats = change.value;
      if (change.key === "flags.argyropee.messageDegats") msgAmbiance = change.value;
    }
    
    if (formuleDegats) {
      let degatsValue = 0;
      if (!isNaN(formuleDegats)) {
        degatsValue = parseInt(formuleDegats);
      } else {
        let r = new Roll(String(formuleDegats));
        await r.evaluate();
        degatsValue = r.total;
      }
      totalDmgContinus += degatsValue;
      messagesContinus.push(`- <b>${effet.name || effet.label}</b> : ${degatsValue} dégât(s) <i>(${msgAmbiance})</i>`);
    }
  }
  
  if (totalDmgContinus > 0) {
    const healthPath = actor.type === "character" ? "system.sante.value" : "system.health.value";
    const currentHealth = foundry.utils.getProperty(actor, healthPath) || 0;
    const newHealth = Math.max(0, currentHealth - totalDmgContinus);
    
    await actor.update({ [healthPath]: newHealth });
    
    let chatContent = `
            <div class="argyropee-roll damage">
                <header><i class="fas fa-biohazard"></i> Affliction(s) magique(s)</header>
                <div class="roll-body">
                    ${messagesContinus.join("<br>")}
                    <div class="roll-result-box" style="border-color: darkred; color: darkred; margin-top: 10px;">
                        <b>Total perdu : ${totalDmgContinus} PS</b>
                    </div>
                </div>
            </div>`;
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chatContent });
    
    // Vérification mort/inconscience
    if (actor.type === "monster" && newHealth <= 0 && !actor.statuses.has("mort")) {
      await actor.toggleStatusEffect("mort", { active: true });
      ChatMessage.create({ content: `<b style="color: darkred;">${actor.name} succombe à ses blessures !</b>` });
    } else if (actor.type !== "monster" && newHealth == 0 && !actor.statuses.has("inconscient")) {
      await actor.toggleStatusEffect("inconscient", { active: true });
      ChatMessage.create({ content: `<b>${actor.name} sombre dans l'inconscience !</b>` });
    }
  }
});

/**
 * Nettoyage lors de la suppression d'un effet.
 * Ex: Retrait de drapeaux spécifiques ou remise à zéro de la Santé Temporaire.
 */
Hooks.on("deleteActiveEffect", async (effect, options, userId) => {
  // Seul le MJ fait le nettoyage pour éviter les doublons
  if (!game.user.isGM) return;
  if (!effect.parent || !(effect.parent instanceof Actor)) return;
  
  if (effect.statuses.has("affame")) {
    await effect.parent.unsetFlag("argyropee", "malusFaim");
  }
  if (effect.statuses.has("assoiffe")) {
    await effect.parent.unsetFlag("argyropee", "malusSoif");
  }
  
  // SANTÉ TEMPORAIRE (Suppression)
  if (effect.getFlag("argyropee", "grantedTemp")) {
      const isPC = effect.parent.type === "character";
      const tempPath = isPC ? "system.sante.temp" : "system.health.temp";
      
      // Quand le sort se termine, on remet les PV temporaires à 0
      // (La santé normale n'est pas touchée, on ne tombe donc jamais sous 0 !)
      await effect.parent.update({ [tempPath]: 0 });
      
      ui.notifications.info(`L'effet s'estompe. Les Points de Santé Temporaires de ${effect.parent.name} se dissipent.`);
  }
});

/**
 * Gère l'expiration des effets magiques ou d'états *en dehors* du combat.
 */
Hooks.on("updateWorldTime", async (worldTime, dt) => {
  if (!game.user.isGM) return;
  
  // On parcourt tous les tokens présents sur la carte actuelle
  for (let token of canvas.tokens.placeables) {
    if (!token.actor) continue;
    
    const expiredEffects = token.actor.effects.filter(e => e.duration && e.duration.remaining !== null && e.duration.remaining <= 0);
    
    for (let e of expiredEffects) {
      await e.delete();
    }
  }
});

/**
 * Intercepte la création d'un effet pour calculer des valeurs dynamiques
 * (ex: lancer les dés pour savoir combien de tours on est "Secoué" ou "Aveuglé",
 * ou encore évaluer la formule de Santé Temporaire accordée par un sort).
 */
Hooks.on("createActiveEffect", async (effect, options, userId) => {
  // Seul le joueur qui crée l'effet gère cette partie
  if (game.user.id !== userId) return;
  if (!effect.parent || !(effect.parent instanceof Actor)) return;
  
  // Si on a DÉJÀ mis notre drapeau, on ne relance pas les dés (sécurité)
  if (effect.getFlag("argyropee", "customDuration")) return;
  
  const isSecoue = (effect.statuses && effect.statuses.has("secoue")) || effect.name.includes("Secoué");
  const isAveugle = (effect.statuses && effect.statuses.has("aveugle")) || effect.name.includes("Aveuglé") || effect.name.includes("Blind");
  
  if (isSecoue || isAveugle) {
    let tours = 0; let secondes = 0;
    
    if (isSecoue) {
      const roll = new Roll("1d10"); await roll.evaluate();
      tours = roll.total; secondes = tours * 5;
    } else if (isAveugle) {
      const roll = new Roll("2d10 + 10"); await roll.evaluate();
      secondes = roll.total; tours = Math.ceil(secondes / 5);
    }
    
    console.log(`Argyropée | Mise à jour de l'effet APRÈS création : ${tours} tours.`);
    
    // On fait une vraie mise à jour en base de données de l'effet existant
    await effect.update({
      "flags.argyropee.customDuration": true,
      "flags.argyropee.maxRounds": tours,
      "flags.argyropee.startRound": game.combat ? game.combat.round : 0
    });
    
    const title = isSecoue ? "Choc subi !" : "Perte de la vue !";
    const icon = isSecoue ? "fa-bolt" : "fa-eye-slash";
    const color = isSecoue ? "#b35900" : "darkred";
    
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: effect.parent }),
      content: `
              <div style="border: 2px solid ${color}; border-radius: 5px; overflow: hidden;">
                <header style="background: ${color}; color: white; padding: 5px; font-weight: bold;">
                    <i class="fas ${icon}"></i> ${title}
                </header>
                <div style="padding: 10px; background: #fff;">
                    <b>${effect.parent.name}</b> reçoit cet état pour ${tours} tours !
                </div>
              </div>`
    });
  }
  // ==========================================
  // SANTÉ TEMPORAIRE
  // ==========================================
  const tempHpChange = effect.changes.find(c => c.key === "flags.argyropee.santeTemp");
  
  if (tempHpChange) {
      let formula = String(tempHpChange.value);
      
      // Permet au MJ d'utiliser l'Endurance Morale comme valeur !
      if (formula.includes("@endurance_morale")) {
          const endMorale = effect.parent.system.competences?.endurance_morale || 0;
          formula = formula.replace(/@endurance_morale/g, endMorale);
      }
      
      // On calcule la valeur (au cas où c'est un jet de dé ou une addition)
      const roll = new Roll(formula);
      await roll.evaluate();
      const tempValue = roll.total;

      const isPC = effect.parent.type === "character";
      const tempPath = isPC ? "system.sante.temp" : "system.health.temp";
      const currentTemp = foundry.utils.getProperty(effect.parent, tempPath) || 0;

      // Les PV temporaires ne se cumulent généralement pas, on prend la meilleure valeur
      if (tempValue > currentTemp) {
          await effect.parent.update({ [tempPath]: tempValue });
          
          // On pose un marqueur pour s'en souvenir à la fin du sort
          await effect.setFlag("argyropee", "grantedTemp", true);
          
          ui.notifications.info(`✨ ${effect.parent.name} gagne ${tempValue} Points de Santé Temporaires !`);
      }
  }
});

/**
 * Gère le Drag & Drop des gabarits magiques depuis le chat vers la carte.
 */
Hooks.on("dropCanvasData", async (canvas, data) => {
  // On vérifie si ce qu'on lâche est bien notre gabarit de sort
  if (data.type === "MeasuredTemplate") {
    
    // On prépare les données du gabarit à créer
    const templateData = {
      t: data.t || "circle",
      user: game.user.id,
      distance: data.distance,
      direction: 0,
      // La magie de Foundry : il calcule automatiquement la position X et Y de la souris sur la grille !
      x: data.x, 
      y: data.y, 
      fillColor: data.fillColor || game.user.color
    };
    
    // On grave le gabarit sur la scène active
    await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
    
    // On retourne false pour dire à Foundry que nous avons géré ce "Drop" nous-mêmes
    return false;
  }
});

// ==========================================
// SYSTÈME ANTI-MORT (Miracle Magique)
// ==========================================

/**
 * Étape 1 : Interception des données de santé *avant* sauvegarde.
 * Si le personnage doit tomber à 0 PV ou moins, on regarde s'il a le flag "antiMort".
 * Si oui, on bloque mathématiquement la descente à 0.
 */
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  // Seul le joueur ou MJ qui déclenche la perte de PV fait le calcul
  if (game.user.id !== userId) return;
  
  // On vérifie le bon chemin de santé selon si c'est un PJ ou un PNJ/Monstre
  const healthPath = actor.type === "character" ? "system.sante.value" : "system.health.value";
  
  // Si la mise à jour concerne bien la santé
  if (foundry.utils.hasProperty(changes, healthPath)) {
    const newHealth = foundry.utils.getProperty(changes, healthPath);
    
    // Si la santé tombe à 0 ou en dessous
    if (newHealth <= 0) {
      // On cherche un effet magique contenant la clé "antiMort"
      const antiMortEffect = actor.effects.find(e => !e.disabled && e.changes.some(c => c.key === "flags.argyropee.antiMort"));
      
      if (antiMortEffect) {
        // MIRACLE ! On force la santé à rester à 0 (ce qui évite les valeurs négatives fatales)
        foundry.utils.setProperty(changes, healthPath, 0); 
        
        // On glisse un mot secret à l'étape suivante pour lui dire de déclencher l'animation
        options.antiMortTriggered = antiMortEffect.id; 
      }
    }
  }
});

/**
 * Étape 2 : Résolution après sauvegarde.
 * Si l'étape 1 a déclenché l'Anti-Mort, on consomme l'effet magique et on affiche un message épique.
 */
Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (game.user.id !== userId) return;
  
  // Si l'intercepteur de mort a été déclenché à l'étape précédente
  if (options.antiMortTriggered) {
    const effect = actor.effects.get(options.antiMortTriggered);
    
    if (effect) {
      const effectName = effect.name || effect.label;
      
      // 1. On consomme le sort
      await effect.delete();
      
      // 2. On s'assure de purger les états d'inconscience ou de mort si le système a essayé de les mettre
      if (actor.statuses.has("inconscient")) await actor.toggleStatusEffect("inconscient", { active: false });
      if (actor.statuses.has("mort")) await actor.toggleStatusEffect("mort", { active: false });
      
      // 3. On affiche un message pour la table !
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `
                <div style="border: 2px solid #b8860b; border-radius: 5px; overflow: hidden; margin-top: 5px; box-shadow: 0 0 15px rgba(184, 134, 11, 0.5);">
                    <header style="background: #b8860b; color: white; padding: 5px; font-weight: bold; text-align: center; text-transform: uppercase;">
                        <i class="fas fa-heartbeat"></i> Miracle de Survie !
                    </header>
                    <div style="padding: 10px; background: #fff; text-align: center; color: #333;">
                        <b>${actor.name}</b> s'effondre... mais la magie de <b>${effectName}</b> s'enclenche instantanément !<br><br>
                        <span style="font-size: 1.2em; color: darkred; font-weight: bold;">La mort est repoussée !</span>
                    </div>
                </div>`
      });
    }
  }
});
/**
 * Fichier définissant l'architecture de la base de données (DataModels) d'Argyropée.
 * @module data-models
 * * ARCHITECTURE :
 * Utilise l'API TypeDataModel de Foundry (V11+). Ces classes définissent les champs 
 * stricts enregistrés dans la base de données pour chaque type d'Acteur et d'Item.
 * La méthode `prepareDerivedData()` calcule les valeurs temporaires (Santé Max, Initiative)
 * à chaque ouverture ou modification de la fiche.
 */

const fields = foundry.data.fields;

// ==========================================
// MODÈLES DE DONNÉES DES ACTEURS
// ==========================================

/**
 * Modèle de données pour un Personnage Joueur (PJ).
 * Contient les 32 compétences sous forme de valeurs (0 à 7).
 */
export class ArgyropeeActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Bloc État Civil
      biographie: new fields.SchemaField({
        citoyennete: new fields.StringField({ initial: "" }),
        age: new fields.NumberField({ initial: null }),
        taille: new fields.StringField({ initial: "" }),
        poids: new fields.StringField({ initial: "" }),
        sexe: new fields.StringField({ initial: "" })
      }),

      // BACKGROUND ---
      background: new fields.SchemaField({
        physique: new fields.HTMLField({ initial: "" }),
        famille: new fields.HTMLField({ initial: "" }),
        amours: new fields.HTMLField({ initial: "" }),
        amis: new fields.HTMLField({ initial: "" }),
        ennemis: new fields.HTMLField({ initial: "" }),
        travail: new fields.HTMLField({ initial: "" })
      }),

      // Panache (Règle spécifique )
      panache: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        bonusPermanent: new fields.NumberField({ initial: 0, integer: true, min: 0 })
      }),

      // Richesse & Monnaie
      richesse: new fields.SchemaField({
        lingots: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        florins: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        deniers: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
        sous: new fields.NumberField({ initial: 0, integer: true, min: 0 })
      }),

      // Métiers (5 emplacements comme sur le PDF)
      metiers: new fields.ArrayField(new fields.SchemaField({
        nom: new fields.StringField({ initial: "" }),
        rang: new fields.StringField({ initial: "" }),
        bonus: new fields.NumberField({ initial: 0 }),
        salaire: new fields.StringField({ initial: "" })
      }), { initial: Array(5).fill({}) }), // On pré-remplit 5 métiers vides

      // Compétences
      competences: new fields.SchemaField({
        agilite: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        alchimie: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        art: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        artificerie: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        artisanat: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        bagout: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        charisme: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        combat_distance: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        combat_rapproche: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        commerce: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        conduite: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        deduction: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        detection: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        empathie_animale: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        endurance_morale: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        endurance_physique: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        escalade: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        faux_usage_faux: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        fouille: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        furtivite: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        herboristerie: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        medecine: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        piegeage: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        pratique_nautique: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        rixe: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        sciences_naturelles: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        sciences_religieuses: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        sciences_sociales: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        sciences_techniques: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        sens_magique: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        serrurerie: new fields.NumberField({ initial: 0, min: 0, max: 7 }),
        urbanisme: new fields.NumberField({ initial: 0, min: 0, max: 7 })
      }),
      sante: new fields.SchemaField({
        value: new fields.NumberField({ initial: 10, integer: true }),
        temp: new fields.NumberField({ initial: 0, integer: true, min: 0 }) // Gestion des PS temporaires
      })
    };
  }

  /**
   * Calculs dérivés (Automatisations basées sur les règles d'Argyropée).
   * ARCHITECTURE : Cette fonction n'écrase pas les données en base, elle les calcule
   * dynamiquement (Armure, Initiative, Santé Max) pour l'affichage de la feuille
   * et l'utilisation par les jets de dés.
   */
  prepareDerivedData() {
    const actor = this.parent;
    if ( !actor.items ) return;

    let armorPenalty = 0;

    // 1. Application des bonus des Items (Métiers et Citoyenneté)
    // Note : Foundry réinitialise les valeurs du schéma avant cette fonction, 
    // donc les +1 ne se cumulent pas à chaque rafraîchissement.
    for ( let item of actor.items ) {
        
        // --- Logique des Métiers ---
        if ( item.type === "metier" ) {
            // Bonus de catégorie (+1 à la compétence choisie)
            const skillKey = item.system.chosenBonusSkill;
            if ( skillKey && this.competences[skillKey] !== undefined ) {
                this.competences[skillKey] += 1;
            }
            
            // Stocker le bonus de rang (1-5) 
            item.professionBonus = item.system.rank;
        }

        // Calcul du malus d'armure global (uniquement si équipé !)
        if ( item.type === "armure" && item.system.equipped ) {
            armorPenalty += (item.system.penalty || 0);
        }
    }

    // 2. Application automatique du Malus d'Armure aux 4 compétences physiques
    // (Le malus étant négatif, on l'additionne)
    if (this.competences.agilite !== undefined) this.competences.agilite += armorPenalty;
    if (this.competences.escalade !== undefined) this.competences.escalade += armorPenalty;
    if (this.competences.furtivite !== undefined) this.competences.furtivite += armorPenalty;
    if (this.competences.pratique_nautique !== undefined) this.competences.pratique_nautique += armorPenalty;

    // 2. Santé MAX = 2 + Endurance Morale + Endurance Physique
    // On utilise les valeurs potentiellement augmentées par le métier ci-dessus
    this.santeMax = 2 + 
      (this.competences.endurance_morale || 0) + 
      (this.competences.endurance_physique || 0);

    // 3. Initiative de base = Agilité + Détection
    this.initiativeBase = 
      (this.competences.agilite || 0) + 
      (this.competences.detection || 0);

    // 4. Charge légère = 10 + (2 x Endurance Physique)
    this.chargeLegere = 10 + (2 * (this.competences.endurance_physique || 0));

    // 5. Calcul du poids total porté
    this.poidsTotal = actor.items.reduce((acc, item) => {
      return acc + (item.system.weight || 0);
    }, 0);

    this.initiativeFinale = this.initiativeBase;
  }
}

// ==========================================
// MODÈLES DE DONNÉES DES OBJETS (ITEMS)
// ==========================================

// --- 1. Citoyenneté ---
export class CitizenshipData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ initial: "" }),
      bonusInitial: new fields.StringField({ initial: "" }),
      origin: new fields.StringField({ required: true, initial: "Gyropéenne" }) //
    };
  }
}

// --- 2. Métier ---
export class ProfessionData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ initial: "" }),
      category: new fields.StringField({ initial: "" }), //
      rank: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }), //
      dailyWage: new fields.NumberField({ initial: 0, min: 0 }), //
      isMilitary: new fields.BooleanField({ initial: false }), //
      chosenBonusSkill: new fields.StringField({ initial: "" }),
      isActive: new fields.BooleanField({ initial: false })
    };
  }
}

// --- 3. Arme ---
export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields; // Raccourci nécessaire
    return {
      description: new fields.HTMLField({ initial: "" }),
      weaponType: new fields.StringField({ initial: "Courante" }), // Courante, Guerre, Feu, Dissimulée
      damage: new fields.StringField({ initial: "1d6" }),
      range: new fields.NumberField({ initial: 0 }), // 0 = Corps à corps
      weight: new fields.NumberField({ initial: 0, min: 0 }),
      price: new fields.NumberField({ initial: 0, min: 0 }),
      quantity: new fields.NumberField({ initial: 1, min: 0 }),
      
      // NOUVEAUX CHAMPS POUR LE COMBAT
      equipped: new fields.BooleanField({ initial: false }), // L'arme est-elle en main ?
      consumeAmmo: new fields.BooleanField({ initial: false }), // Utilise-t-elle des munitions ?
      ammoType: new fields.StringField({ initial: "" }), // Type de munition (ex: "Balles en plomb")
      associatedSkill: new fields.StringField({ initial: "combat_rapproche" }) // Rixe, Combat rapproché, Combat à distance
    };
  }
}

// --- 4. Armure & Bouclier ---
export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      armorType: new fields.StringField({ initial: "Armure" }), // Armure, Bouclier, Casque
      equipped: new fields.BooleanField({ initial: false }), // Est-ce porté ?
      protection: new fields.NumberField({ initial: 0, min: 0 }), // Valeur X
      resistance: new fields.SchemaField({
        value: new fields.NumberField({ initial: 5, min: 0 }), // Valeur Y actuelle
        max: new fields.NumberField({ initial: 5, min: 0 })    // Valeur Y max
      }),
      penalty: new fields.NumberField({ initial: 0, max: 0 }), // Malus (doit être négatif ou 0)
      weight: new fields.NumberField({ initial: 0, min: 0 }),
      price: new fields.NumberField({ initial: 0, min: 0 })
    };
  }
}

// --- 5. Sortilège ---
export class SpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ initial: "" }),
      domain: new fields.StringField({ initial: "" }), //
      range: new fields.StringField({ initial: "Contact" }), //
      area: new fields.StringField({ initial: "" }), //
      resist: new fields.BooleanField({ initial: true }), //
      cost: new fields.NumberField({ initial: 1, min: 0 }), //
      canBeDiscreet: new fields.BooleanField({ initial: false }) //
    };
  }
}

// --- 5. Munitions ---
export class AmmunitionData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      ammoType: new fields.StringField({ initial: "Flèches" }), // Flèches, Carreaux, Poudre, Jet
      quantity: new fields.NumberField({ initial: 10, min: 0 }),
      damageBonus: new fields.StringField({ initial: "" }), // ex: "+1" ou "+1d4"
      breakageChance: new fields.NumberField({ initial: 25, min: 0, max: 100 }), // 25% par défaut
      weight: new fields.NumberField({ initial: 0, min: 0 }),
      price: new fields.NumberField({ initial: 0, min: 0 })
    };
  }
}

// --- 6. Consommables & Poisons ---
export class ConsumableData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      consumableType: new fields.StringField({ initial: "Potion" }), // Potion, Alchimie, Drogue, Poison
      form: new fields.StringField({ initial: "Liquide" }), // Liquide, Poudre, Gaz, Pâte, Pilule
      quantity: new fields.NumberField({ initial: 1, min: 0 }),
      addiction: new fields.StringField({ initial: "Nulle" }), // Nulle, Légère, Modérée, Forte
      antidoteType: new fields.StringField({ initial: "" }), // Ce qu'il guérit ou nécessite
      consumeOnUse: new fields.BooleanField({ initial: true }), // Se détruit à l'usage
      weight: new fields.NumberField({ initial: 0, min: 0 }),
      price: new fields.NumberField({ initial: 0, min: 0 })
    };
  }
}

// --- 7. Pièges ---
export class TrapData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      trapType: new fields.StringField({ initial: "Létal" }), // Entrave, Alarme, Létal, Exotique
      status: new fields.StringField({ initial: "Inventaire" }), // Inventaire, Déployé, Désamorcé
      damage: new fields.StringField({ initial: "" }), // ex: "3", "1d6"
      area: new fields.StringField({ initial: "" }), // ex: "2m"
      quantity: new fields.NumberField({ initial: 1, min: 0 }),
      weight: new fields.NumberField({ initial: 0, min: 0 }),
      price: new fields.NumberField({ initial: 0, min: 0 })
    };
  }
}

// --- 8. Maladie ---
export class DiseaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      origin: new fields.StringField({ initial: "Naturelle" }), // "Naturelle" ou "Magique"
      testsRequired: new fields.NumberField({ initial: 3, min: 1, integer: true }),
      testsPassed: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      remedyRequired: new fields.BooleanField({ initial: false }),
      treatment: new fields.StringField({ initial: "" }) // Description du remède
    };
  }
}

/**
 * Fonction utilitaire générant le schéma des compétences pour PNJs/Monstres.
 * DEV : Contrairement aux PJs qui ont des scores, les PNJ ont de simples cases à cocher (Booléens)
 * pour signifier s'ils sont "Privilégiés" ou non dans une compétence.
 * @returns {Object} Schéma de champs booléens.
 */
function getPnjSkillSchema() {
    const fields = foundry.data.fields;
    const skills = {};
    const skillKeys = [
        "agilite", "alchimie", "art", "artificerie", "artisanat", "bagout", "charisme", "combat_distance", "combat_rapproche", "commerce", "conduite", "deduction", "detection", "empathie_animale", "endurance_morale", "endurance_physique", "escalade", "faux_usage_faux", "fouille", "furtivite", "herboristerie", "medecine", "piegeage", "pratique_nautique", "rixe", "sciences_naturelles", "sciences_religieuses", "sciences_sociales", "sciences_techniques", "sens_magique", "serrurerie", "urbanisme"
    ];
    // Pour chaque compétence, on crée un simple Booléen (Case à cocher)
    skillKeys.forEach(key => { skills[key] = new fields.BooleanField({ initial: false }); });
    return skills;
}

// --- Personnage Non-Joueur (Humain) ---
export class ArgyropeeNPCData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      background: new fields.SchemaField({
        physique: new fields.HTMLField({ initial: "" }),
        amours: new fields.HTMLField({ initial: "" }),
        ennemis: new fields.HTMLField({ initial: "" }),
        famille: new fields.HTMLField({ initial: "" }),
        amis: new fields.HTMLField({ initial: "" }),
        travail: new fields.HTMLField({ initial: "" })
      }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ initial: 10, min: 0 }),
        max: new fields.NumberField({ initial: 10, min: 0 })
      }),
      panache: new fields.SchemaField({
        value: new fields.NumberField({ initial: 3, min: 0 }),
        max: new fields.NumberField({ initial: 3, min: 0 })
      }),
      initiativeBonus: new fields.NumberField({ initial: 0 }),
      skills: new fields.SchemaField(getPnjSkillSchema()),
      special: new fields.SchemaField({
        melancolie: new fields.BooleanField({ initial: false }),
        chatimentVermeil: new fields.BooleanField({ initial: false })
      })
    };
  }
}

// --- Monstre / Créature / Animal ---
export class ArgyropeeMonsterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      biographie: new fields.SchemaField({ notes: new fields.HTMLField({ initial: "" }) }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ initial: 15, min: 0 }),
        max: new fields.NumberField({ initial: 15, min: 0 })
      }),
      protection: new fields.NumberField({ initial: 0, min: 0 }), // Uniquement X
      initiativeBonus: new fields.NumberField({ initial: 2 }),
      skills: new fields.SchemaField(getPnjSkillSchema()),
      movement: new fields.SchemaField({
        sol: new fields.NumberField({ initial: 1.0, min: 0 }),
        vol: new fields.NumberField({ initial: 0, min: 0 }),
        nage: new fields.NumberField({ initial: 0, min: 0 })
      }),
      environment: new fields.StringField({ initial: "" }),
      weaknesses: new fields.StringField({ initial: "" }),
      isSwarm: new fields.BooleanField({ initial: false })
    };
  }
}
import * as Dice from "../helpers/dice.mjs"; // On importe notre super moteur de dés !

/**
 * Classe d'acteur personnalisée pour Argyropée
 */
export class ArgyropeeActor extends Actor {

  /** @override */
  prepareDerivedData() {
    // 1. On laisse Foundry préparer les données de base de l'acteur
    super.prepareDerivedData();
    
    // 2. On ne s'occupe que des Personnages (les monstres/PNJ fonctionnent différemment dans ton système)
    if (this.type !== "character") return;
    
    // --- DISTRIBUTION DES MODIFICATEURS DE CATÉGORIE ---
    // On liste les 3 grandes catégories d'Argyropée
    const categories = ["physique", "intellectuelle", "sociale"];
    
    for (let cat of categories) {
      // On lit le drapeau (ex: flags.argyropee.modificateurs.physique)
      const mod = parseInt(foundry.utils.getProperty(this, `flags.argyropee.modificateurs.${cat}`)) || 0;
      
      if (mod !== 0) {
        // On parcourt toutes les compétences définies dans ton système
        for (let [skillKey, skillCat] of Object.entries(CONFIG.ARGYROPEE.categories)) {
          // Si la compétence appartient à la bonne catégorie (ex: physique)
          if (skillCat === cat) {
            // A. On applique mathématiquement le bonus/malus à la valeur
            this.system.competences[skillKey] = (this.system.competences[skillKey] || 0) + mod;
            
            // B. MAGIE FOUNDRY : On force l'affichage du cercle coloré (vert ou rouge) !
            this.overrides = this.overrides || {};
            this.overrides[`system.competences.${skillKey}`] = this.system.competences[skillKey];
          }
        }
      }
    }
  }
  
  /** Calcule le Panache pour la journée */
  async asyncRefreshPanache() {
    return Dice.refreshPanache(this);
  }
  
  /** Effectue un jet de compétence selon les règles d'Argyropée */
  async rollComp(skillKey) {
    return Dice.rollSkill(this, skillKey);
  }

  /** Effectue un jet d'initiative */
  async rollArgyropeeInitiative() {
    return Dice.rollInitiative(this);
  }

  /** Effectue un jet d'attaque avec une arme */
  async rollWeaponAttack(weapon) {
    return Dice.rollAttack(this, weapon);
  }

  /** Lancer un sortilège */
  async castSpell(spell) {
    return Dice.castSpell(this, spell);
  }

  /** Utiliser ou consommer un objet (Potions, Poisons...) */
  async consumeItem(item) {
    return Dice.consumeItem(this, item);
  }

  /** Déploie un piège sur le terrain */
  async deployTrap(trap) {
    return Dice.deployTrap(this, trap);
  }

  /** Gère la nuit de repos (Santé + Panache) */
  async rest() {
    return Dice.rest(this);
  }
}
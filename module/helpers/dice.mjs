/**
 * Fichier centralisant toute la logique des jets de dés, du combat et des actions d'Argyropée.
 * @module dice
 * * ARCHITECTURE :
 * Ce fichier gère la résolution mécanique. Les fenêtres de dialogue utilisent 
 * la nouvelle API DialogV2 de Foundry V13+ pour assurer la pérennité du système.
 */

/**
 * Régénère la réserve de Panache matinale d'un acteur.
 * @param {ArgyropeeActor} actor - L'acteur qui se réveille.
 * @returns {Promise<ChatMessage>} Le message de chat affichant le résultat.
 */
export async function refreshPanache(actor) {
    const roll = new Roll("1d10");
    await roll.evaluate();
    const deBrut = roll.terms[0].results[0].result;
    const deArgyropee = deBrut === 10 ? 0 : deBrut; // Règle d'Argyropée : le 10 vaut 0.
    
    const bonusPermanent = actor.system.panache.bonus || 0;
    const nouveauTotal = 10 + deArgyropee + bonusPermanent;
    
    await actor.update({ "system.panache.value": nouveauTotal });
    
    return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `
        <div class="argyropee-roll panache">
          <header><i class="fas fa-sun"></i> Réveil Matinal</header>
          <div class="roll-body">
            <p style="text-align: center;">${actor.name} regagne son Panache pour la journée.</p>
            <div class="roll-result-box">
              10 + ${deArgyropee} (Dé) + ${bonusPermanent} (Bonus) = <br>
              <span class="dice-total">${nouveauTotal} Points</span>
            </div>
          </div>
        </div>`
    });
}

/**
 * Lance un test de compétence (Gère la différence entre PJs et PNJs).
 * @param {ArgyropeeActor} actor - Le lanceur (PJ, PNJ ou Monstre).
 * @param {string} skillKey - La clé système de la compétence (ex: "agilite").
 * @returns {Promise<ChatMessage|void>} Le résultat du jet dans le chat.
 */
export async function rollSkill(actor, skillKey) {
    const label = CONFIG.ARGYROPEE.competences[skillKey] || skillKey;
    let compValeur = 0;
    let pnjRollDetails = "";
    
    // 1. Récupération de la catégorie et du modificateur d'état
    // DEV : getProperty est crucial ici car les Active Effects créent parfois des flags mal formatés.
    const categorie = CONFIG.ARGYROPEE.categories[skillKey];
    let modCategorie = 0;
    if (categorie) {
        const flagValue = foundry.utils.getProperty(actor, `flags.argyropee.modificateurs.${categorie}`);
        if (flagValue) modCategorie = parseInt(flagValue) || 0;
    }
    
    // 2. Calcul de la valeur de compétence selon le type d'acteur
    if (actor.type === "character") {
        // DEV : Pour les PJs, les modificateurs de catégorie (-2 Fatigue etc.) sont DÉJÀ 
        // soustraits de la valeur de base par `actor.mjs` (prepareDerivedData).
        compValeur = actor.system.competences[skillKey] || 0;
    } else {
        // DEV : Les PNJs n'ont pas de système de jetons de couleurs. On doit appliquer 
        // le malus de catégorie à la volée après leur jet de d6.
        const isPrivileged = actor.system.skills[skillKey];
        const pnjSkillRoll = new Roll("1d6");
        await pnjSkillRoll.evaluate();
        const d6Result = pnjSkillRoll.total;
        
        const baseD6 = isPrivileged ? d6Result : Math.floor(d6Result / 2);
        compValeur = baseD6 + modCategorie;
        
        pnjRollDetails = ` <br><span style="color: darkred;">(Rang dynamique : 1d6 = ${d6Result}${isPrivileged ? '' : ' divisé par 2'})</span>`;
        if (modCategorie !== 0) {
            pnjRollDetails += `<br><span style="color: darkmagenta; font-weight: bold;">${modCategorie > 0 ? '+' : ''}${modCategorie} (Catégorie ${categorie})</span>`;
        }
    }
    
    // --- GESTION DES MALUS D'ÉTATS GLOBAUX ---
    const isAffame = actor.statuses.has("affame");
    const isAssoiffe = actor.statuses.has("assoiffe");
    let malusFaim = isAffame ? (actor.flags?.argyropee?.malusFaim || 1) : 0;
    let malusSoif = isAssoiffe ? (actor.flags?.argyropee?.malusSoif || 1) : 0;
    
    let modificateurGlobal = (parseInt(actor.flags?.argyropee?.malusGlobal) || 0) - malusFaim - malusSoif; 
    let modificateurTotal = modificateurGlobal;

    // Récupération des métiers pour la boite de dialogue
    const metiers = actor.items.filter(i => i.type === "metier");
    let metierOptions = `<option value="0">Aucun métier applicable (+0)</option>`;
    metiers.forEach(m => {
        metierOptions += `<option value="${m.system.rank}">${m.name} - Rang ${m.system.rank} (+${m.system.rank})</option>`;
    });
    
    const content = `
      <form>
        <p>Test de <b>${label}</b></p>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Sens sollicité :</label>
          <select name="sens" style="width: 100%;">
            <option value="aucun">Aucun / Général</option>
            <option value="vue">Vue</option>
            <option value="ouie">Ouïe</option>
            <option value="odorat">Odorat</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Bonus de Profession :</label>
          <select name="metierBonus" style="width: 100%;">${metierOptions}</select>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Autre modificateur :</label>
          <input type="number" name="autreBonus" value="0" style="width: 100%;">
        </div>
      </form>`;
    
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Test : ${label}` },
        content: content,
        ok: {
            label: "Lancer le dé",
            callback: (event, button) => {
                const form = button.form;
                return { 
                    sens: form.elements.sens.value, // On récupère le sens choisi
                    metierBonus: parseInt(form.elements.metierBonus.value) || 0, 
                    autreBonus: parseInt(form.elements.autreBonus.value) || 0 
                };
            }
        }
    });
    
    if (!result) return;
    
    const roll = new Roll("1d10");
    await roll.evaluate();
    
    let deBrut = roll.terms[0].results[0].result;
    const deArgyropee = deBrut === 10 ? 0 : deBrut;
    
    // --- VÉRIFICATION DES SENS (Cécité, Surdité...) ---
    const isBlind = actor.flags?.argyropee?.aveugle;
    const isDazzled = actor.flags?.argyropee?.ebloui;
    const isDeaf = actor.flags?.argyropee?.assourdi;
    
    let echecAutomatique = false;
    let malusSens = 0;
    let warningSens = "";
    
    if (result.sens === "vue") {
        if (isBlind) {
            echecAutomatique = true;
            warningSens = `<div class="warning-box" style="color: darkred; background: #ffcccc; border: 1px solid darkred; padding: 5px; text-align: center; margin-bottom: 5px; font-weight: bold;">⚠️ LE PERSONNAGE EST AVEUGLÉ ! (Échec Automatique)</div>`;
        } else if (isDazzled) {
            malusSens = -2;
            warningSens = `<div class="warning-box" style="color: #b35900; background: #ffe6cc; border: 1px solid #b35900; padding: 5px; text-align: center; margin-bottom: 5px; font-weight: bold;">⚠️ ÉBLOUI : -2 au test visuel.</div>`;
        }
    }
    if (result.sens === "ouie") {
        if (isDeaf) {
            echecAutomatique = true;
            warningSens = `<div class="warning-box" style="color: darkred; background: #ffcccc; border: 1px solid darkred; padding: 5px; text-align: center; margin-bottom: 5px; font-weight: bold;">⚠️ LE PERSONNAGE EST ASSOURDI ! (Échec Automatique)</div>`;
        }
    }
    
    // Calcul du total
    const total = deArgyropee + compValeur + result.metierBonus + result.autreBonus + modificateurTotal + malusSens;
    
    let reussiteLabel = "", cssClass = "";
    if (total >= 15) { reussiteLabel = "RÉUSSITE CRITIQUE !"; cssClass = "crit-success"; }
    else if (total >= 10) { reussiteLabel = "RÉUSSITE"; cssClass = "success"; }
    else if (total <= 0) { reussiteLabel = "ÉCHEC CRITIQUE"; cssClass = "crit-fail"; }
    else { reussiteLabel = "ÉCHEC"; cssClass = "fail"; }
    
    const chatContent = `
      <div class="argyropee-roll skill" data-actor-id="${actor.id}" data-de-naturel="${deArgyropee}" data-roll-type="skill">
        <header><i class="fas fa-dice-d10"></i> Test de <b>${label}</b></header>
        <div class="roll-body">
            ${warningSens}
            <div class="roll-details">
                ${deArgyropee} (Dé) + ${compValeur} (Comp)
                ${result.metierBonus ? `<br>+ ${result.metierBonus} (Métier)` : ''} 
                ${result.autreBonus ? `<br>+ ${result.autreBonus} (Autre)` : ''}
                ${modificateurTotal !== 0 ? `<br><span style="color: darkred; font-weight: bold;">${modificateurGlobal} (États)</span>` : ''}
                ${malusSens !== 0 ? `<br><span style="color: darkorange; font-weight: bold;">${malusSens} (Ébloui)</span>` : ''}
                ${malusFaim > 0 ? `<br><span style="color: #8b4513; font-weight: bold;">-${malusFaim} (Affamé)</span>` : ''}
                ${malusSoif > 0 ? `<br><span style="color: #1e90ff; font-weight: bold;">-${malusSoif} (Assoiffé)</span>` : ''}
                ${pnjRollDetails}
            </div>
            <div class="roll-result-box">
                <div class="dice-total ${cssClass}">${reussiteLabel}<br>(${total})</div>
            </div>
            ${deArgyropee < 9 && actor.system.panache?.value > 0 ? 
    `<button class="burn-panache action-btn" data-action="spendPanache">Dépenser 1 Panache (Reste: ${actor.system.panache.value - 1})</button>` : ''}
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent, rolls: [roll] });
}

/**
 * Lance l'initiative et l'insère dans le Combat Tracker.
 * @param {ArgyropeeActor} actor - L'acteur rejoignant le combat.
 */
export async function rollInitiative(actor) {
    const initFinale = actor.type === "character" ? (actor.system.initiativeFinale || 0) : (actor.system.initiativeBonus || 0);
    
    const roll = new Roll("1d10");
    await roll.evaluate();
    let deBrut = roll.terms[0].results[0].result;
    const deArgyropee = deBrut === 10 ? 0 : deBrut;
    const total = deArgyropee + initFinale;
    
    if (game.combat) {
        const combatants = actor.isToken ? game.combat.combatants.filter(c => c.tokenId === actor.token.id) : game.combat.combatants.filter(c => c.actorId === actor.id);
        for ( let c of combatants ) await game.combat.setInitiative(c.id, total);
    }
    
    const content = `
      <div class="argyropee-roll skill" data-actor-id="${actor.id}">
        <header><i class="fas fa-bolt"></i> Jet d'<b>Initiative</b></header>
        <div class="roll-body">
            <div class="roll-details">${deArgyropee} (Dé) + ${initFinale} (Init. Finale)</div>
            <div class="roll-result-box">
                <div class="dice-total">${total}</div>
            </div>
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: content, rolls: [roll] });
}

/**
 * Traite une attaque avec une arme (Gestion des munitions, états, cibles, etc.).
 * @param {ArgyropeeActor} actor - L'attaquant.
 * @param {Item} weapon - L'arme utilisée.
 */
export async function rollAttack(actor, weapon) {
    const skillKey = weapon.system.associatedSkill || "combat_rapproche";
    const label = CONFIG.ARGYROPEE.competences[skillKey] || skillKey;
    let compValeur = 0;
    let pnjRollDetails = "";
    
    // 1. Modificateur d'état spécifique à la catégorie de compétence de l'arme
    const categorie = CONFIG.ARGYROPEE.categories[skillKey];
    let modCategorie = 0;
    if (categorie) {
        const flagValue = foundry.utils.getProperty(actor, `flags.argyropee.modificateurs.${categorie}`);
        if (flagValue) modCategorie = parseInt(flagValue) || 0;
    }
    
    // 2. Calcul de la valeur selon le type d'acteur
    if (actor.type === "character") {
        compValeur = actor.system.competences[skillKey] || 0;
    } else {
        const isPrivileged = actor.system.skills[skillKey];
        const pnjSkillRoll = new Roll("1d6");
        await pnjSkillRoll.evaluate();
        const d6Result = pnjSkillRoll.total;
        
        const baseD6 = isPrivileged ? d6Result : Math.floor(d6Result / 2);
        compValeur = baseD6 + modCategorie;
        
        pnjRollDetails = ` <br><span style="color: darkred;">(Rang dynamique : 1d6 = ${d6Result}${isPrivileged ? '' : ' divisé par 2'})</span>`;
        if (modCategorie !== 0) {
            pnjRollDetails += `<br><span style="color: darkmagenta; font-weight: bold;">${modCategorie > 0 ? '+' : ''}${modCategorie} (Catégorie ${categorie})</span>`;
        }
    }
    
    // --- GESTION DES MUNITIONS ---
    let compatibleAmmo = [];
    if (weapon.system.consumeAmmo) {
        compatibleAmmo = actor.items.filter(i => i.type === "munition" && i.system.ammoType === weapon.system.ammoType && i.system.quantity > 0);
        if (compatibleAmmo.length === 0) {
            ui.notifications.warn(`Impossible de tirer : Aucune munition en réserve pour ${weapon.name} !`);
            return;
        }
    }
    
    const metiers = actor.items.filter(i => i.type === "metier");
    let metierOptions = `<option value="0">Aucun métier applicable (+0)</option>`;
    metiers.forEach(m => { metierOptions += `<option value="${m.system.rank}">${m.name} - Rang ${m.system.rank} (+${m.system.rank})</option>`; });
    
    let ammoSelectHtml = "";
    if (weapon.system.consumeAmmo) {
        let ammoOptions = compatibleAmmo.map(a => `<option value="${a.id}">${a.name} - Reste: ${a.system.quantity} ${a.system.damageBonus ? `(Dégâts: ${a.system.damageBonus})` : ""}</option>`).join("");
        ammoSelectHtml = `
        <div class="form-group" style="margin-bottom: 10px; background: rgba(0,0,0,0.05); padding: 5px; border: 1px solid #7a7971;">
          <label style="font-weight: bold;">Munition à utiliser :</label>
          <select name="selectedAmmo" style="width: 100%;">${ammoOptions}</select>
        </div>`;
    }
    
    const content = `
      <form>
        <p>Attaque avec <b>${weapon.name}</b> (Jet de ${label})</p>
        ${ammoSelectHtml}
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Bonus de Profession :</label>
          <select name="metierBonus" style="width: 100%;">${metierOptions}</select>
        </div>
        <div class="form-group" style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
          <label style="font-weight: bold;">Viser une zone précise (-2) :</label>
          <input type="checkbox" name="viser">
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Embuscade / Autre modificateur :</label>
          <input type="number" name="autreBonus" value="0" style="width: 100%;">
        </div>
      </form>`;
    
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Attaque : ${weapon.name}` },
        content: content,
        ok: {
            label: "Frapper !",
            callback: (event, button) => {
                const form = button.form;
                return { 
                    metierBonus: parseInt(form.elements.metierBonus.value) || 0, 
                    viser: form.elements.viser.checked ? -2 : 0, 
                    autreBonus: parseInt(form.elements.autreBonus.value) || 0, 
                    selectedAmmoId: form.elements.selectedAmmo ? form.elements.selectedAmmo.value : null 
                };
            }
        }
    });
    
    if (!result) return;
    
    let munitionTexte = "", baseDamage = weapon.system.damage || "0", ammoEffectsHtml = "";
    
    // --- CONSOMMATION DES MUNITIONS ET RÉCUPÉRATION DES BONUS ---
    if (weapon.system.consumeAmmo && result.selectedAmmoId) {
        const ammo = actor.items.get(result.selectedAmmoId);
        if (ammo) {
            await ammo.update({"system.quantity": ammo.system.quantity - 1});
            munitionTexte = `<div class="roll-result-box">Munition : <b>${ammo.name}</b><br><i>(Reste: ${ammo.system.quantity - 1})</i></div>`;
            if (ammo.system.damageBonus) {
                const bonus = ammo.system.damageBonus.trim();
                baseDamage += bonus.startsWith("+") || bonus.startsWith("-") ? bonus : `+${bonus}`;
            }

            // Transfert des boutons d'effets (ex: Projectiles de verre => Hémorragie)
            const munitionEffets = ammo.effects.filter(e => !e.transfer);
            if (munitionEffets.length > 0) {
                ammoEffectsHtml = `
                    <div class="roll-details" style="margin-top: 5px;"><b>Effets de la munition :</b></div>
                    ${munitionEffets.map(e => `<button type="button" class="damage-btn" data-action="applySpellEffect" data-spell-id="${ammo.id}" data-effect-id="${e.id}"><i class="fas fa-tint"></i> ${e.name}</button>`).join("")}`;
            }
        }
    }
    
    const roll = new Roll("1d10");
    await roll.evaluate();
    let deBrut = roll.terms[0].results[0].result;
    const deArgyropee = deBrut === 10 ? 0 : deBrut;
    
    let malusGlobal = parseInt(actor.flags?.argyropee?.malusGlobal) || 0; 
    const isBlind = actor.flags?.argyropee?.aveugle;
    const warningAveugle = isBlind ? `<div class="warning-box">⚠️ LE TIREUR EST AVEUGLÉ !</div>` : "";
    
    // ==========================================
    // VÉRIFICATION DE LA CIBLE : ÉTAT "À TERRE"
    // ==========================================
    let bonusCibleATerre = 0;
    let messageATerre = "";
    
    const targets = game.user.targets;
    if (targets.size > 0) {
        // On cible le premier token sélectionné par le joueur
        const targetToken = Array.from(targets)[0];
        const targetActor = targetToken.actor;
        
        if (targetActor) {
            const isATerre = targetActor.statuses.has("a_terre");
            
            if (isATerre) {
                bonusCibleATerre = 2; // Le fameux bonus de +2
                messageATerre = `<br><span style="color: darkgreen; font-weight: bold;">+ 2 (Cible à terre)</span>`;
            }
        }
    }
    
    // ==========================================
    // MOTEUR GÉNÉRIQUE DE BONUS D'ATTAQUE
    // ==========================================
    // ARCHITECTURE : Lit dynamiquement tous les drapeaux d'effets magiques du lanceur
    // pour appliquer des buffs d'attaque/dégâts selon le type d'arme.let bonusMagiqueAttaque = 0;
    let bonusMagiqueDegats = 0;
    let desMagiquesDegats = "";
    let texteMagie = "";
    let effetsAConsommer = []; 
    
    // 1. DÉFINITION DU TYPE D'ATTAQUE
    const competenceArme = weapon.system.associatedSkill;
    const isMelee = ["rixe", "combat_rapproche"].includes(competenceArme);
    const isRanged = ["combat_distance"].includes(competenceArme);
    
    // 2. PARCOURS DES EFFETS ACTIFS
    if (actor.effects) {
        for (let effet of actor.effects) {
            // On ignore les effets désactivés
            if (effet.disabled) continue;
            
            let aDesBonus = false;
            let nomEffet = effet.name || effet.label;
            
            // Variables temporaires pour lire l'onglet "Changements"
            let conditionArme = null;
            let aAttaque = 0;
            let aDegats = 0;
            let aDegatsDes = "";
            let isUnique = false;
            
            // On parcourt les "Changements" configurés dans l'interface de Foundry
            // DEV : Pensez à ajouter vos nouvelles clés (Flags) d'extension de règles ici.
            for (let change of effet.changes) {
                if (change.key === "flags.argyropee.typeAttaque") conditionArme = change.value;
                if (change.key === "flags.argyropee.bonusAttaque") aAttaque += Number(change.value);
                if (change.key === "flags.argyropee.bonusDegats") aDegats += Number(change.value);
                if (change.key === "flags.argyropee.bonusDegatsDes") aDegatsDes += ` + ${change.value}`;
                if (change.key === "flags.argyropee.usageUnique" && change.value === "true") isUnique = true;
            }

            // Fallback (Macros MJs obsolètes)
            if (effet.flags?.argyropee?.typeAttaque) conditionArme = effet.flags.argyropee.typeAttaque;
            if (effet.flags?.argyropee?.bonusAttaque) aAttaque += Number(effet.flags.argyropee.bonusAttaque);
            if (effet.flags?.argyropee?.bonusDegats) aDegats += Number(effet.flags.argyropee.bonusDegats);
            if (effet.flags?.argyropee?.bonusDegatsDes) aDegatsDes += ` + ${effet.flags.argyropee.bonusDegatsDes}`;
            if (effet.flags?.argyropee?.usageUnique) isUnique = true;
            
            // Si aucun bonus pertinent n'est trouvé, on passe à l'effet suivant
            if (aAttaque === 0 && aDegats === 0 && aDegatsDes === "") continue;
            
            // --- LE FILTRE INTELLIGENT D'ARME ---
            if (conditionArme === "melee" && !isMelee) continue;
            if (conditionArme === "distance" && !isRanged) continue;
            
            // --- APPLICATION DES BONUS ---
            if (aAttaque !== 0) {
                bonusMagiqueAttaque += aAttaque;
                texteMagie += `<br><span style="color: #607d8b;">✨ ${nomEffet} : +${aAttaque} Attaque</span>`;
                aDesBonus = true;
            }
            if (aDegats !== 0) {
                bonusMagiqueDegats += aDegats;
                texteMagie += `<br><span style="color: #d84315;">🔥 ${nomEffet} : +${aDegats} Dégâts</span>`;
                aDesBonus = true;
            }
            if (aDegatsDes !== "") {
                desMagiquesDegats += aDegatsDes;
                texteMagie += `<br><span style="color: #0277bd;">⚡ ${nomEffet} : ${aDegatsDes} Dégâts</span>`;
                aDesBonus = true;
            }
            
            // Préparation pour la suppression si c'est à usage unique
            if (aDesBonus && isUnique) {
                effetsAConsommer.push(effet.id);
            }
        }
    }

    // ==========================================
    // AURAS DE RIPOSTE (Dégâts de Retour)
    // ==========================================
    // ARCHITECTURE : Si on attaque au CàC et que la cible a une Aura de flammes/épines,
    // on gère les dégâts sur l'attaquant en direct.
    let texteRetourAura = "";
    
    // On définit si on attaque au CàC
    const compAura = weapon.system.associatedSkill;
    const isAttaqueMelee = ["rixe", "combat_rapproche"].includes(compAura);

    // Si on a ciblé quelqu'un ET qu'on l'attaque au corps-à-corps
    if (targets.size > 0 && isAttaqueMelee) {
        const targetActorAura = Array.from(targets)[0].actor;

        if (targetActorAura && targetActorAura.effects) {
            for (let effet of targetActorAura.effects) {
                if (effet.disabled) continue;

                let formuleRetour = null;
                let msgRetour = "vous blesse en retour";

                for (let change of effet.changes) {
                    if (change.key === "flags.argyropee.degatsRetour") formuleRetour = change.value;
                    if (change.key === "flags.argyropee.messageRetour") msgRetour = change.value;
                }

                if (formuleRetour) {
                    let degatsRetourValue = 0;
                    if (!isNaN(formuleRetour)) {
                        degatsRetourValue = parseInt(formuleRetour);
                    } else {
                        let r = new Roll(String(formuleRetour));
                        await r.evaluate();
                        degatsRetourValue = r.total;
                    }

                    texteRetourAura += `
                    <div style="background: #ffebee; border: 1px solid darkred; padding: 5px; margin-top: 10px; color: darkred; font-size: 0.9em;">
                        <b>⚠️ AURA (${effet.name || effet.label})</b><br>
                        <i>${msgRetour} !</i><br>
                        => <b>${actor.name}</b> subit <b>${degatsRetourValue} dégât(s)</b> !
                    </div>`;
                }
            }
        }
    }
    
    // Calcul final de la réussite d'attaque
    const total = deArgyropee + compValeur + result.metierBonus + result.viser + result.autreBonus + malusGlobal + bonusCibleATerre + bonusMagiqueAttaque;
    
    // Construction de la chaîne de dés de dégâts (ex: "1d8 + 2 + 1d6")
    let finalDamage = baseDamage; 
    
    // S'il y a un bonus fixe (ex: +2), on l'ajoute proprement avec un " + "
    if (bonusMagiqueDegats > 0) {
        finalDamage += ` + ${bonusMagiqueDegats}`;
    }
    
    // S'il y a des dés bonus (ex: " + 1d6"), on les ajoute à la suite
    if (desMagiquesDegats !== "") {
        finalDamage += desMagiquesDegats;
    }

    let reussiteLabel = "", cssClass = "", degatsHtml = "";
    if (total >= 15) {
        reussiteLabel = "RÉUSSITE CRITIQUE !"; cssClass = "crit-success";
        
        // Règle du critique: Double le nombre de dés (ex: 1d6 devient 2d6)
        let doubleDamage = finalDamage.replace(/^(\d+)d(\d+)/i, (match, dCount, dFaces) => `${parseInt(dCount) * 2}d${dFaces}`);
        degatsHtml = `
          <div class="roll-result-box" style="border-color: darkgreen;">
              <b>Exploit martial ! Choisissez :</b>
              <button type="button" class="damage-btn" data-action="rollDamage" data-formula="${doubleDamage}" data-weapon="${weapon.name} (Doublés)"><i class="fas fa-tint"></i> Dégâts x2</button>
              <button type="button" class="action-btn" data-action="rollDamage" data-formula="${finalDamage}" data-weapon="${weapon.name} (+ Manœuvre)"><i class="fas fa-fist-raised"></i> Dégâts + Manœuvre</button>
          </div>`;
    } else if (total >= 10) {
        reussiteLabel = "L'ATTAQUE TOUCHE !"; cssClass = "success";
        degatsHtml = `<button type="button" class="damage-btn" data-action="rollDamage" data-formula="${finalDamage}" data-weapon="${weapon.name}"><i class="fas fa-tint"></i> Lancer les dégâts (${finalDamage})</button>`;
    } else if (total <= 0) { reussiteLabel = "ÉCHEC CRITIQUE"; cssClass = "crit-fail"; } 
    else { reussiteLabel = "ATTAQUE ESQUIVÉE / RATÉE"; cssClass = "fail"; }
    
    const chatContent = `
      <div class="argyropee-roll attack" data-actor-id="${actor.id}" data-de-naturel="${deArgyropee}" data-roll-type="attack" data-item-id="${weapon.id}">
        <header><i class="fas fa-crosshairs"></i>  <b>${weapon.name}</b></header>
        <div class="roll-body">
            ${warningAveugle}
            ${munitionTexte}
            <div class="roll-details">
                ${deArgyropee} (Dé) + ${compValeur} (${label})
                ${result.metierBonus ? `<br>+ ${result.metierBonus} (Métier)` : ''} 
                ${result.viser ? `<br>- 2 (Visée)` : ''}
                ${result.autreBonus ? `<br>+ ${result.autreBonus} (Autre)` : ''}
                ${pnjRollDetails}
                ${malusGlobal < 0 ? `<br><span style="color: darkred;">${malusGlobal} (États)</span>` : ''}
                ${messageATerre}
            </div>
            <div class="roll-result-box">
                <div class="dice-total ${cssClass}">${reussiteLabel}<br>(${total})</div>
            </div>
            ${degatsHtml}
            ${ammoEffectsHtml}
            ${texteRetourAura}
            ${deArgyropee < 9 && actor.system.panache.value > 0 ? `<button class="burn-panache action-btn" data-action="spendPanache">Dépenser 1 Panache (Reste: ${actor.system.panache.value - 1})</button>` : ''}
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent, rolls: [roll] });
}

/**
 * Lance un sortilège, déduit le Panache et prépare l'application de ses effets.
 * @param {ArgyropeeActor} actor - L'enchanteur.
 * @param {Item} spell - Le sortilège casté.
 */
export async function castSpell(actor, spell) {
    const panacheActuel = actor.system.panache.value;
    const costNormal = spell.system.cost || 1;
    const costDiscreet = costNormal + 1; // Règle d'Argyropée : Discrétion = +1 pt de Panache
    
    if ( panacheActuel < costNormal ) { ui.notifications.warn(`Pas assez de Panache (${panacheActuel}) !`); return; }
    
    let modeOptions = `<option value="normal">Incantation Normale (${costNormal} Panache)</option>`;
    if ( spell.system.canBeDiscreet ) {
        if ( panacheActuel >= costDiscreet ) modeOptions += `<option value="discreet">Incantation Discrète (${costDiscreet} Panache)</option>`;
        else modeOptions += `<option value="normal" disabled>Incantation Discrète (Panache insuffisant)</option>`;
    }
    
    const content = `
      <form>
        <p>Lancement de <b>${spell.name}</b></p>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Mode de lancement :</label>
          <select name="castMode" style="width: 100%;">${modeOptions}</select>
        </div>
      </form>`;
    
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Lancer le sort : ${spell.name}` },
        content: content,
        ok: { label: "Incanter", callback: (event, button) => button.form.elements.castMode.value }
    });
    
    if (!result) return;
    
    const finalCost = result === "discreet" ? costDiscreet : costNormal;
    await actor.update({ "system.panache.value": panacheActuel - finalCost });
    
    const modeLabel = result === "discreet" ? `<br><i>(Lancement Discret)</i>` : "";
    const resistText = spell.system.resist ? `<div style="color: darkred; font-weight: bold; margin-top: 5px;">Jet de Résistance permis</div>` : "";
    
    // Génération des boutons d'application d'effets (seulement ceux non transférés au lanceur)
    const activeEffects = spell.effects.filter(e => !e.transfer);
    let effectsHtml = "";
    if (activeEffects.length > 0) {
        effectsHtml = `<hr><div class="roll-details"><b>Appliquer les effets :</b></div>
            ${activeEffects.map(e => `<button type="button" class="effect-btn" data-action="applySpellEffect" data-spell-id="${spell.id}" data-effect-id="${e.id}"><i class="fas fa-sparkles"></i> Appliquer : ${e.name}</button>`).join("")}`;
    }
    
    // ==========================================
    // GÉNÉRATION DU GABARIT DE ZONE (Drag & Drop)
    // ==========================================
    let templateHtml = "";
    if (spell.system.area) {
        let areaStr = spell.system.area.toLowerCase();
        
        // On cherche un nombre dans le texte de la zone (ex: "30 mètres" -> 30)
        let areaMatch = areaStr.match(/(\d+)/); 
        let distance = areaMatch ? parseInt(areaMatch[1]) : 0;
        
        // Si on a un nombre ET que ce n'est pas une zone strictement "personnelle"
        if (distance > 0 && !areaStr.includes("personnel")) {
            
            // Petite détection intelligente de la forme (par défaut : cercle)
            let shape = "circle";
            if (areaStr.includes("cône") || areaStr.includes("cone")) shape = "cone";
            else if (areaStr.includes("ligne") || areaStr.includes("faisceau")) shape = "ray";
            else if (areaStr.includes("carré") || areaStr.includes("rectangle")) shape = "rect";
            
            templateHtml = `
            <div class="template-drag" draggable="true" data-distance="${distance}" data-shape="${shape}" 
                 style="margin-top: 10px; padding: 5px; background: rgba(25, 42, 81, 0.1); border: 2px dashed #192a51; text-align: center; cursor: grab; border-radius: 5px; color: #192a51; font-weight: bold;">
                <i class="fas fa-arrows-alt"></i> Glissez cette zone (${distance}m) sur la carte
            </div>`;
        }
    }
    
    // On intègre la variable ${templateHtml} dans le rendu final
    const chatContent = `
      <div class="argyropee-roll spell" data-actor-id="${actor.id}">
        <header><i class="fas fa-magic"></i>  <b>${spell.name}</b></header>
        <div class="roll-body">
            <div class="roll-details">
                Domaine de <b>${spell.system.domain}</b> ${modeLabel}<br>
                Portée: ${spell.system.range || '-'} | Zone: ${spell.system.area || '-'}
            </div>
            <div class="roll-result-box justify">${spell.system.description}</div>
            <div style="text-align: center;">${resistText}</div>
            ${templateHtml}
            ${effectsHtml}
            <div class="roll-footer">
                -${finalCost} point(s) de Panache (Reste : ${panacheActuel - finalCost})
            </div>
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent });
}

/**
 * Consomme un objet (Potion, Drogue, Poison) et en tire les bénéfices (Soin ou Purge).
 * @param {ArgyropeeActor} actor - L'utilisateur de l'objet.
 * @param {Item} item - Le consommable.
 */
export async function consumeItem(actor, item) {
    const currentQty = item.system.quantity || 0;
    if (currentQty <= 0) { ui.notifications.warn(`Vous n'avez plus de ${item.name} en stock !`); return; }
    const newQty = currentQty - 1;
    
    let healFormula = null;
    let statusesToCure = [];
    let effectsToApply = [];
    
    // ARCHITECTURE : Lit les effets pour trouver s'il s'agit d'une potion de soin (flags.argyropee.heal) 
    // ou d'un antidote (flags.argyropee.cureStatus), et prépare les autres effets (ex: buff).
    for (let e of item.effects) {
        let isInstant = false;
        e.changes.forEach(c => {
            if (c.key === "flags.argyropee.heal") { healFormula = c.value; isInstant = true; }
            if (c.key === "flags.argyropee.cureStatus") { statusesToCure.push(...c.value.split(',').map(s => s.trim())); isInstant = true; }
        });
        if (!isInstant || e.changes.length > 1) {
            const effectData = e.toObject(); effectData.origin = item.uuid; effectsToApply.push(effectData);
        }
    }
    
    let chatExtraText = "";
    if (healFormula) {
        const roll = new Roll(healFormula); await roll.evaluate(); const healAmount = roll.total;
        const currentHealth = actor.system.health?.value || actor.system.sante?.value || 0;
        const maxHealth = actor.system.health?.max || actor.system.santeMax || 15; 
        const newHealth = Math.min(currentHealth + healAmount, maxHealth);
        const healthPath = actor.type === "character" ? "system.sante.value" : "system.health.value";
        await actor.update({ [healthPath]: newHealth });
        chatExtraText += `<br><span style="color: #3b78b6; font-weight: bold;">+${healAmount} Points de Santé regagnés !</span>`;
    }
    
    if (statusesToCure.length > 0) {
        for (let statusId of statusesToCure) {
            const effectToRemove = actor.effects.find(eff => eff.statuses.has(statusId));
            if (effectToRemove) { await effectToRemove.delete(); chatExtraText += `<br><span style="color: darkblue; font-weight: bold;">L'état "${statusId}" a été guéri.</span>`; }
        }
    }
    
    if (effectsToApply.length > 0) {
        await actor.createEmbeddedDocuments("ActiveEffect", effectsToApply);
        chatExtraText += `<br><i>Ses effets actifs se manifestent...</i>`;
    }
    
    if (newQty <= 0) await item.delete(); else await item.update({"system.quantity": newQty});
    
    let themeClass = "consumable";
    let icon = "fa-flask"; // Icône par défaut (Alchimie, Drogue...)
    
    if (item.system.consumableType === "Poison") {
        themeClass = "poison";
        icon = "fa-skull-crossbones";
    } else if (item.system.consumableType === "Potion") {
        // C'est désormais lié au TYPE "Potion" de l'objet, et non plus au fait qu'il soigne !
        themeClass = "potion";
        icon = "fa-heartbeat"; // Ou "fa-vial" si vous préférez une fiole classique
    }
    
    const chatContent = `
      <div class="argyropee-roll ${themeClass}" data-actor-id="${actor.id}">
        <header><i class="fas ${icon}"></i>  <b>${item.name}</b></header>
        <div class="roll-body">
            <div class="roll-details"><i>${item.system.consumableType} (${item.system.form})</i></div>
            <div class="roll-result-box justify">${item.system.description}</div>
            <div class="roll-details">${chatExtraText}</div>
            <div class="roll-footer">Quantité restante : ${newQty}</div>
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent });
}

/**
 * Pose un piège sur le terrain, affichant ses boutons de dégâts/effets pour le MJ.
 * @param {ArgyropeeActor} actor - Le poseur.
 * @param {Item} trap - Le piège.
 */
export async function deployTrap(actor, trap) {
    if (trap.system.quantity <= 0) { ui.notifications.warn(`Plus de ${trap.name} en réserve !`); return; }
    
    await trap.update({ "system.quantity": trap.system.quantity - 1, "system.status": "Déployé" });
    
    const activeEffects = trap.effects.filter(e => !e.transfer);
    let effectsHtml = "";
    if (activeEffects.length > 0) {
        effectsHtml = `${activeEffects.map(e => `<button type="button" class="trap-btn" data-action="applySpellEffect" data-spell-id="${trap.id}" data-effect-id="${e.id}"><i class="fas fa-bolt"></i> Appliquer : ${e.name}</button>`).join("")}`;
    }
    
    let damageHtml = "";
    if (trap.system.damage) {
        damageHtml = `<button type="button" class="damage-btn" data-action="rollDamage" data-formula="${trap.system.damage}" data-weapon="${trap.name}"><i class="fas fa-tint"></i> Infliger Dégâts (${trap.system.damage})</button>`;
    }
    
    const chatContent = `
      <div class="argyropee-roll trap" data-actor-id="${actor.id}">
        <header><i class="fas fa-cog"></i> Piège déployé : <b>${trap.name}</b></header>
        <div class="roll-body">
            <div class="roll-details"><i>Ce piège est désormais actif sur le terrain.</i><br>Zone : ${trap.system.area || "Contact"}</div>
            <div class="roll-result-box justify">${trap.system.description}</div>
            ${damageHtml}
            ${effectsHtml}
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent });
}

/**
 * Effectue un repos (récupération de Santé et/ou Panache).
 * @param {ArgyropeeActor} actor - L'acteur qui se repose.
 */
export async function rest(actor) {
    const maxHealth = Number(actor.system.santeMax) || 0;
    const currentHealth = Number(actor.system.sante?.value) || 0;
    const currentPanache = Number(actor.system.panache?.value) || 0;
    const panacheBonus = Number(actor.system.panache?.bonusPermanent) || 0;
    
    const content = `
      <div style="padding-bottom: 10px;">
        <p style="font-size: 1.1em; margin-top: 0;">Votre repos a-t-il duré assez longtemps (6 à 8 heures ininterrompues) ?</p>
        <fieldset style="border: 1px solid #192a51; padding: 10px; margin-bottom: 10px; border-radius: 3px;">
          <legend style="font-weight: bold; color: #192a51;"><i class="fas fa-moon"></i> Qualité du sommeil</legend>
          <label style="display: block; margin-bottom: 8px; cursor: pointer;">
            <input type="radio" name="sleepQuality" value="normal" checked>
            <b>Nuit normale</b> (ou Pilule d'endormissement)
          </label>
          <label style="display: block; margin-bottom: 8px; cursor: pointer;">
            <input type="radio" name="sleepQuality" value="perturbe">
            <b>Sommeil perturbé / Cauchemars</b> <i>(Panache récupéré divisé par 2)</i>
          </label>
          <label style="display: block; cursor: pointer;">
            <input type="radio" name="sleepQuality" value="alchimique">
            <b>Sommeil alchimique / Efialtis</b> <i>(Aucun Panache récupéré)</i>
          </label>
        </fieldset>
        <fieldset style="border: 1px solid #004a2e; padding: 10px; border-radius: 3px;">
          <legend style="font-weight: bold; color: #004a2e;"><i class="fas fa-magic"></i> Aide Médicale</legend>
          <label style="display: block; cursor: pointer;">
            <input type="checkbox" name="stimulation">
            Sous l'effet du sort <b>Stimulation médicinale</b> <i>(Soins augmentés à 1/2)</i>
          </label>
        </fieldset>
      </div>
    `;
    
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: "Nuit de Repos" },
        content: content,
        ok: {
            label: "Se reposer",
            icon: "fas fa-bed",
            callback: (event, button) => {
                return { 
                    quality: button.form.querySelector('input[name="sleepQuality"]:checked').value, 
                    stim: button.form.querySelector('input[name="stimulation"]').checked 
                };
            }
        },
        rejectClose: false
    });
    
    if (!result) return;
    
    let healthFraction = result.stim ? 2 : 3;
    let healthHeal = Math.ceil(maxHealth / healthFraction);
    let newHealth = Math.min(currentHealth + healthHeal, maxHealth);
    let healthRecovered = newHealth - currentHealth;
    
    let newPanache = currentPanache; 
    let panacheChatText = "";
    let roll = null;
    
    if (result.quality === "alchimique") {
        panacheChatText = "<i style='color: darkred;'>Sommeil artificiel : L'esprit n'a pu se reposer. La réserve de Panache reste inchangée.</i>";
    } else {
        roll = new Roll("1d10");
        await roll.evaluate();
        const deBrut = roll.terms[0].results[0].result;
        const deArgyropee = deBrut === 10 ? 0 : deBrut;
        
        let panacheCalcule = 10 + deArgyropee + panacheBonus;
        
        if (result.quality === "perturbe") {
            panacheCalcule = Math.floor(panacheCalcule / 2);
            panacheChatText = `Sommeil agité : Réserve fixée à <b>${panacheCalcule}</b> Panache <i>(Total divisé par 2)</i>.`;
        } else {
            panacheChatText = `Nuit réparatrice : Réserve restaurée à <b>${panacheCalcule}</b> Panache.`;
        }
        newPanache = panacheCalcule;
    }
    
    await actor.update({ "system.sante.value": newHealth, "system.panache.value": newPanache });
    
    let chatContent = `
      <div class="argyropee-roll rest">
        <header><i class="fas fa-bed"></i> Repos de ${actor.name}</header>
        <div class="roll-body">
            <div class="roll-result-box">
                <p style="margin-top: 0; color: #004a2e;"><b>Santé :</b> Le corps récupère <b>+${healthRecovered}</b> PS.</p>
                <p style="margin-bottom: 0;"><b>Panache :</b> ${panacheChatText}</p>
            </div>
            <div class="roll-footer">
                Note : Si le personnage était Épuisé, assurez-vous de retirer l'état manuellement s'il a dormi plus de 8 heures.
            </div>
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent, rolls: roll ? [roll] : null });
}

/**
 * Tente de se libérer de l'état "Agrippé" par un jet d'opposition.
 * @param {ArgyropeeActor} actor - L'acteur qui tente de s'évader.
 */
export async function escapeGrapple(actor) {
    // 1. L'effet est-il bien présent ?
    const grappleEffect = actor.effects.find(e => e.statuses?.has("agrippe"));
    if (!grappleEffect) {
        ui.notifications.warn(`Argyropée : ${actor.name} n'est plus sous l'état Agrippé !`);
        return;
    }
    
    // 2. A-t-il bien ciblé son agresseur ?
    const targets = game.user.targets;
    if (targets.size !== 1) {
        ui.notifications.warn("Argyropée : Veuillez cibler (Touche T) exactement UN adversaire (celui qui vous agrippe).");
        return;
    }
    const targetActor = Array.from(targets)[0].actor;
    
    // 3. Choix de la compétence
    const content = `
      <form>
        <p><b>${actor.name}</b> tente de se dégager de l'étreinte de <b>${targetActor.name}</b>.</p>
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-weight: bold;">Compétence à utiliser :</label>
          <select name="skill" style="width: 100%;">
            <option value="agilite">Agilité</option>
            <option value="rixe">Rixe</option>
          </select>
        </div>
      </form>`;
    
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: "Se dégager de l'étreinte" },
        content: content,
        ok: { label: "Tenter l'évasion", callback: (event, button) => button.form.elements.skill.value }
    });
    
    if (!result) return;
    
    // 4. Fonction utilitaire pour récupérer les compétences
    const getSkillValue = async (act, skillKey) => {
        if (act.type === "character") return act.system.competences?.[skillKey] || 0;
        const isPrivileged = act.system.skills?.[skillKey];
        const pnjRoll = new Roll("1d6"); await pnjRoll.evaluate();
        return isPrivileged ? pnjRoll.total : Math.floor(pnjRoll.total / 2);
    };
    
    const actorSkillVal = await getSkillValue(actor, result);
    const targetSkillVal = await getSkillValue(targetActor, "rixe"); // Le défenseur résiste toujours avec Rixe
    
    // 5. Jet de l'évadé
    const actorRoll = new Roll("1d10"); await actorRoll.evaluate();
    const actorDe = actorRoll.terms[0].results[0].result === 10 ? 0 : actorRoll.terms[0].results[0].result;
    const actorMalus = parseInt(actor.flags?.argyropee?.malusGlobal) || 0;
    const actorTotal = actorDe + actorSkillVal + actorMalus;
    const actorSuccess = actorTotal >= 10;
    
    let targetRollHtml = "";
    let finalResultHtml = "";
    
    // 6. Résolution de l'opposition
    if (actorSuccess) {
        // L'évadé a réussi son jet, le défenseur doit résister
        const targetRoll = new Roll("1d10"); await targetRoll.evaluate();
        const targetDe = targetRoll.terms[0].results[0].result === 10 ? 0 : targetRoll.terms[0].results[0].result;
        const targetMalus = parseInt(targetActor.flags?.argyropee?.malusGlobal) || 0;
        const targetTotal = targetDe + targetSkillVal + targetMalus;
        const targetSuccess = targetTotal >= 10;
        
        targetRollHtml = `
            <div style="margin-top: 10px; border-top: 1px solid #192a51; padding-top: 5px;">
                <b>Résistance de ${targetActor.name} (Rixe) :</b><br>
                ${targetDe} (Dé) + ${targetSkillVal} (Comp) ${targetMalus !== 0 ? ` <span style="color:darkred">(${targetMalus} Malus)</span>` : ''} = <b>${targetTotal}</b><br>
                ${targetSuccess ? `<span style="color: darkred; font-weight: bold;">L'adversaire maintient sa prise !</span>` : `<span style="color: darkgreen; font-weight: bold;">L'adversaire lâche prise.</span>`}
            </div>`;
        
        if (!targetSuccess) {
            // Succès de l'évadé ET Échec du défenseur -> Libération !
            finalResultHtml = `<div class="roll-result-box" style="border-color: darkgreen; color: darkgreen; font-weight: bold; font-size: 1.1em; margin-top: 10px;">ÉVASION RÉUSSIE !</div>`;
            await grappleEffect.delete();
        } else {
            // Égalité (Succès - Succès) -> Reste agrippé
            finalResultHtml = `<div class="roll-result-box" style="border-color: darkred; color: darkred; font-weight: bold; font-size: 1.1em; margin-top: 10px;">ÉCHEC (Prise maintenue)</div>`;
        }
    } else {
        // L'évadé rate son jet d'office
        finalResultHtml = `<div class="roll-result-box" style="border-color: darkred; color: darkred; font-weight: bold; font-size: 1.1em; margin-top: 10px;">ÉVASION RATÉE</div>`;
    }
    
    // 7. Affichage global
    const labelCompActor = result === "agilite" ? "Agilité" : "Rixe";
    const chatContent = `
      <div class="argyropee-roll skill" data-actor-id="${actor.id}">
        <header><i class="fas fa-people-arrows"></i> Libération d'Agrippement</header>
        <div class="roll-body">
            <div class="roll-details">
                <b>${actor.name} (${labelCompActor}) :</b><br>
                ${actorDe} (Dé) + ${actorSkillVal} (Comp) ${actorMalus !== 0 ? ` <span style="color:darkred">(${actorMalus} Malus)</span>` : ''} = <b>${actorTotal}</b><br>
                ${actorSuccess ? `<span style="color: darkgreen; font-weight: bold;">Tentative valide.</span>` : `<span style="color: darkred; font-weight: bold;">N'arrive pas à se dégager.</span>`}
            </div>
            ${targetRollHtml}
            ${finalResultHtml}
        </div>
      </div>`;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: chatContent });
}
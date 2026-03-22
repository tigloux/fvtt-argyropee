/**
 * Fichier gérant l'interactivité du journal de discussion (Chat) d'Argyropée.
 * @module chat-listeners
 * * ARCHITECTURE :
 * Ce fichier écoute les clics sur les boutons générés par `dice.mjs` dans le chat.
 * C'est ici que sont résolus : l'application des dégâts (avec gestion d'armure),
 * l'utilisation du Panache après un jet, et le nettoyage des états expirés.
 */

import { escapeGrapple } from "./dice.mjs";

/**
 * Attache les écouteurs d'événements au journal de chat de Foundry VTT.
 * @param {HTMLElement|jQuery} html - L'élément DOM du chat (Gère la compatibilité jQuery V11/V12 vers DOM natif V13+).
 */
export async function addChatListeners(html) {
    // Sécurité V13 : si html est un tableau (jQuery fallback), on prend le premier élément natif
    const chatElement = html.length ? html[0] : html;
    
    chatElement.addEventListener('click', async (ev) => {
        
        // ==========================================
        // 0. APPLIQUER UN EFFET (SORT, MUNITION, POISON)
        // ==========================================
        // DEV : Bouton généré quand une munition, un sort ou un piège a des effets non-transférés.
        const spellBtn = ev.target.closest('button[data-action="applySpellEffect"]');
        if (spellBtn) {
            ev.preventDefault();
            
            // 1. Récupération des IDs
            const itemId = spellBtn.dataset.spellId; // On recycle ce dataset pour les munitions
            const effectId = spellBtn.dataset.effectId;
            
            // 2. Trouver le message et l'acteur de manière robuste (Gère les PNJs sur la carte)
            const messageElement = spellBtn.closest(".message");
            const messageId = messageElement.dataset.messageId;
            const message = game.messages.get(messageId);
            
            if (!message) return;
            
            const actor = ChatMessage.getSpeakerActor(message.speaker); 
            
            if (!actor) {
                ui.notifications.error("Impossible de retrouver le tireur/lanceur.");
                return;
            }
            
            // 3. Récupérer l'objet (munition, sort...)
            const item = actor.items.get(itemId);
            if (!item) {
                ui.notifications.error("L'objet n'existe plus dans l'inventaire.");
                return;
            }
            
            // 4. Récupérer l'effet
            const effect = item.effects.get(effectId);
            if (!effect) {
                ui.notifications.error("L'effet n'a pas été trouvé sur l'objet.");
                return;
            }
            
            // 5. Vérifier les cibles
            const targets = game.user.targets;
            if (targets.size === 0) {
                ui.notifications.warn("Veuillez d'abord cibler un pion (Touche T) !");
                return;
            }
            
            // 6. APPLICATION OU SOIN D'URGENCE (PURGE)
            let statusesToCure = [];
            let isInstantPurge = false;

            // On regarde dans l'onglet "Changements" si le MJ a configuré une purge
            for (let change of effect.changes) {
                if (change.key === "flags.argyropee.cureStatus") {
                    statusesToCure.push(...change.value.split(',').map(s => s.trim()));
                    isInstantPurge = true;
                }
            }

            // Application de la logique sur toutes les cibles
            for (let target of targets) {
                const targetActor = target.actor;
                if (!targetActor) continue;

                if (isInstantPurge) {
                    // --- LOGIQUE DE SOIN D'URGENCE ---
                    let soigne = false;
                    for (let statusId of statusesToCure) {
                        const effectToRemove = targetActor.effects.find(eff => eff.statuses.has(statusId));
                        if (effectToRemove) {
                            // 1. On demande à Foundry de retirer le statut "proprement" (met à jour le Token et l'icône)
                            await targetActor.toggleStatusEffect(statusId, { active: false });
                            
                            // 2. Ceinture et bretelles : on s'assure que le document est bien supprimé de la base de données
                            if (targetActor.effects.has(effectToRemove.id)) {
                                await targetActor.deleteEmbeddedDocuments("ActiveEffect", [effectToRemove.id]);
                            }
                            
                            ui.notifications.info(`${targetActor.name} a été guéri(e) de l'état : ${statusId}`);
                            soigne = true;
                        }
                    }
                    if (!soigne) {
                        ui.notifications.warn(`${targetActor.name} ne souffre d'aucun de ces états.`);
                    }

                } else {
                    // --- LOGIQUE D'APPLICATION CLASSIQUE (Buff / Débuff) ---
                    let effectData = effect.toObject();
                    effectData.origin = item.uuid; // Traçabilité de l'origine
                    
                    // On vérifie si la cible ne possède pas déjà l'effet (évite de spammer 10 fois le même buff)
                    const alreadyHas = targetActor.effects.find(e => e.origin === effectData.origin && e.name === effectData.name);
                    
                    if (!alreadyHas) {
                        await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
                        ui.notifications.info(`L'effet magique '${effect.name}' a été appliqué sur ${targetActor.name}.`);
                    } else {
                        ui.notifications.warn(`${targetActor.name} possède déjà cet effet.`);
                    }
                }
            }
            
            return;
            
        }
        
        // ==========================================
        // 1. LANCER LES DÉGÂTS (Création de la boîte de dégâts)
        // ==========================================
        const damageBtn = ev.target.closest('button[data-action="rollDamage"]');
        if (damageBtn) {
            ev.preventDefault();
            const formula = damageBtn.dataset.formula;
            const weaponName = damageBtn.dataset.weapon;
            
            const roll = new Roll(formula);
            await roll.evaluate();
            
            const content = `
          <div class="argyropee-roll damage">
              <header><i class="fas fa-tint"></i> Dégâts : <b>${weaponName}</b></header>
              <div class="roll-body">
                  <div class="roll-details">${roll.formula}</div>
                  <div class="roll-result-box">
                      <div class="dice-total">${roll.total}</div>
                  </div>
                  <button type="button" class="damage-btn" data-action="applyDamage" data-damage="${roll.total}">
                      <i class="fas fa-heart-broken"></i> Encaisser les dégâts
                  </button>
                  <div class="roll-footer">Sélectionnez d'abord le pion de la cible</div>
              </div>
          </div>
      `;
            
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker(),
                content: content,
                rolls: [roll]
            });
            return; 
        }
        
        // ==========================================
        // 2. ENCAISSER LES DÉGÂTS (Résolution sur la cible)
        // ==========================================
        // ARCHITECTURE : C'est ici que l'armure (X et Y) et la Santé Temporaire sont calculées
        // avant d'entamer les vrais Points de Santé du personnage ciblé.
        const applyBtn = ev.target.closest('button[data-action="applyDamage"]');
        if (applyBtn) {
            ev.preventDefault();
            const damage = parseInt(applyBtn.dataset.damage);
            const tokens = canvas.tokens.controlled;
            
            if (tokens.length === 0) {
                ui.notifications.warn("Argyropée : Veuillez sélectionner au moins un pion (token) sur la carte !");
                return;
            }
            
            for (let t of tokens) {
                const actor = t.actor;
                if (!actor) continue;
                
                const isPC = actor.type === "character";
                const healthPath = isPC ? "system.sante.value" : "system.health.value";
                const prevSante = foundry.utils.getProperty(actor, healthPath) || 0;
                const prevTemp = isPC ? (actor.system.sante.temp || 0) : 0; // Seul le PJ a des Temp pour le moment
                
                // Calcul de l'Armure
                let protectionX = 0;
                let prevY = null, newY = null, armorId = "", armorName = "Aucune armure (ou détruite)";
                let activeArmor = null;
                
                if (actor.type === "monster") {
                    protectionX = actor.system.protection || 0;
                    if (protectionX > 0) armorName = "Protection Naturelle";
                } else {
                    let protections = actor.items.filter(i => i.type === "armure" && i.system.equipped && i.system.resistance.value > 0);
                    if (protections.length === 0 && actor.type === "npc") {
                        protections = actor.items.filter(i => i.type === "armure" && i.system.resistance.value > 0);
                    }
                    activeArmor = protections.find(p => p.system.armorType === "Bouclier") || protections.find(p => p.system.armorType === "Armure");
                    
                    if (activeArmor) {
                        protectionX = activeArmor.system.protection || 0;
                        prevY = activeArmor.system.resistance.value;
                        newY = Math.max(0, prevY - 1);
                        armorId = activeArmor.id;
                        armorName = activeArmor.name;
                        await activeArmor.update({"system.resistance.value": newY});
                    }
                }
                
                // Calcul des dégâts absorbés par l'armure
                let degatsSubis = Math.max(0, damage - protectionX);
                let newTemp = prevTemp;
                
                // Les Points Temporaires absorbent les dégâts restants
                if (newTemp > 0) {
                    if (degatsSubis <= newTemp) {
                        newTemp -= degatsSubis;
                        degatsSubis = 0;
                    } else {
                        degatsSubis -= newTemp;
                        newTemp = 0;
                    }
                }
                
                const newSante = prevSante - degatsSubis;
                
                // Mise à jour
                let updateData = { [healthPath]: newSante };
                if (isPC) updateData["system.sante.temp"] = newTemp;
                await actor.update(updateData);
                
                // Message récapitulatif
                const summaryContent = `
                <div class="argyropee-roll damage">
                    <header>Dégâts à ${actor.name}</header>
                    <div class="roll-body">
                        <div class="roll-details">
                            <b>Attaque :</b> ${damage} dégâts<br>
                            <b style="color: #004a2e;">${armorName} :</b> -${protectionX} dégâts<br>
                            ${prevTemp > 0 ? `<b style="color: #004a2e;">Santé Temporaire :</b> absorbe ${prevTemp - newTemp} dégâts<br>` : ''}
                        </div>
                        <div class="roll-result-box">
                            <b style="color: darkred; font-size: 1.1em;">Dégâts réels : ${degatsSubis}</b><br>
                            Santé : ${prevSante} ➔ <b>${newSante}</b>
                        </div>
                        <button type="button" class="undo-btn" data-action="undoDamage" data-actor-uuid="${actor.uuid}" data-prev-sante="${prevSante}" data-prev-temp="${prevTemp}" data-armor-id="${armorId}" data-prev-y="${prevY !== null ? prevY : ''}">
                            <i class="fas fa-undo"></i> Annuler l'encaissement
                        </button>
                    </div>
                </div>
            `;
                
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({token: t.document}),
                    content: summaryContent
                });
            }
            return;
        }
        
        // ==========================================
        // 3. ANNULER LES DÉGÂTS (Undo)
        // ==========================================
        // DEV : Restaurera les points de vie, la santé temporaire et la structure (Y) de l'armure.
        const undoBtn = ev.target.closest('button[data-action="undoDamage"]');
        if (undoBtn) {
            ev.preventDefault();
            
            const actorUuid = undoBtn.dataset.actorUuid;
            const actor = await fromUuid(actorUuid);
            
            if (!actor) {
                ui.notifications.error("Impossible d'annuler : le pion n'existe plus sur la carte.");
                return;
            }
            
            const isPC = actor.type === "character";
            const healthPath = isPC ? "system.sante.value" : "system.health.value";
            const prevSante = parseInt(undoBtn.dataset.prevSante);
            const prevTemp = parseInt(undoBtn.dataset.prevTemp) || 0;
            
            let updateData = { [healthPath]: prevSante };
            if (isPC) updateData["system.sante.temp"] = prevTemp;
            
            await actor.update(updateData);
            
            const armorId = undoBtn.dataset.armorId;
            if (armorId && armorId !== "") {
                const prevY = parseInt(undoBtn.dataset.prevY);
                const armor = actor.items.get(armorId);
                if (armor) {
                    await armor.update({"system.resistance.value": prevY});
                }
            }
            
            ui.notifications.info(`Les dégâts sur ${actor.name} ont été annulés !`);
            undoBtn.remove();
            return;
        }
        
        // ==========================================
        // 4. LOGIQUE DU PANACHE (Dépense Post-Jet)
        // ==========================================
        // ARCHITECTURE : Permet au joueur de booster un dé raté après coup.
        // Ouvre une modale pour choisir combien de points dépenser, puis déclenche `executePanacheRoll()`.
        const panacheBtn = ev.target.closest('.burn-panache');
        if (panacheBtn) {
            ev.preventDefault();
            const messageDiv = panacheBtn.closest(".argyropee-roll");
            const panacheActor = game.actors.get(messageDiv.dataset.actorId);
            const deNaturel = parseInt(messageDiv.dataset.deNaturel);
            
            if (!panacheActor) return;
            
            const panacheActuel = panacheActor.system.panache.value;
            const besoinMaxDe = 9 - deNaturel;
            const maxAutorise = Math.min(panacheActuel, besoinMaxDe);
            
            if (maxAutorise <= 0) {
                ui.notifications.warn("Vous ne pouvez pas ajouter de Panache à ce jet.");
                return; // Ce return est à l'intérieur du bloc, il n'arrête que le panache
            }
            
            const { DialogV2 } = foundry.applications.api;
            // Note: On retire le 'await' ici car nous sommes dans un gestionnaire d'événements synchrone
            DialogV2.prompt({
                window: { title: "Utiliser son Panache" },
                content: `
            <div style="text-align: center;">
              <p>Dé actuel : <b>${deNaturel}</b> (Max autorisé : ${maxAutorise})</p>
              <hr>
              <p>Combien de points dépenser ?</p>
              <input type="number" id="panache-input" value="1" min="1" max="${maxAutorise}" 
                     style="width: 50px; text-align: center; font-size: 1.5rem;">
              <p><small>Points disponibles : ${panacheActuel}</small></p>
            </div>
          `,
                ok: { label: "Dépenser", callback: (event, btn) => btn.form.elements["panache-input"].valueAsNumber },
                rejectClose: false
            }).then(async (points) => {
                if (points > 0) {
                    await executePanacheRoll(panacheActor, messageDiv, points);
                    panacheBtn.remove(); 
                }
            });
            
            return; // On arrête la cascade de clics ici, car on a géré le panache
        }
        
        // ==========================================
        // 5. RETIRER UN EFFET EXPIRÉ (Bouton d'alerte chat)
        // ==========================================
        const removeEffectBtn = ev.target.closest('button[data-action="removeExpiredEffect"]');
        if (removeEffectBtn) {
            ev.preventDefault();
            console.log("Argyropée | 1. Clic détecté sur le bouton de suppression !");
            
            const effectUuid = removeEffectBtn.dataset.effectUuid;
            console.log(`Argyropée | 2. UUID récupéré depuis le bouton : ${effectUuid}`);
            
            if (!effectUuid || effectUuid === "undefined") {
                ui.notifications.error("L'UUID de l'effet est manquant sur le bouton.");
                return;
            }

            // On va chercher l'effet de manière asynchrone
            fromUuid(effectUuid).then(async (effect) => {
                console.log("Argyropée | 3. Effet retrouvé dans la base de données :", effect);
                
                if (effect) {
                    const actorName = effect.parent?.name || "le personnage";
                    const effectName = effect.name;

                    await effect.delete();
                    console.log(`Argyropée | 4. Effet ${effectName} supprimé avec succès.`);
                    
                    ui.notifications.info(`L'état ${effectName} a été retiré de ${actorName}.`);
                    
                    removeEffectBtn.disabled = true;
                    removeEffectBtn.innerHTML = "<i class='fas fa-check'></i> Effet retiré";
                    removeEffectBtn.style.background = "#d4edda";
                    removeEffectBtn.style.color = "#155724";
                } else {
                    console.log("Argyropée | ERREUR : L'effet est introuvable avec cet UUID.");
                    ui.notifications.warn("Cet effet a déjà été retiré ou n'existe plus.");
                }
            }).catch(err => {
                console.error("Argyropée | Erreur lors de la recherche de l'UUID :", err);
            });
            
            return;
        }

        // ==========================================
        // 6. SE LIBÉRER D'UN AGRIPPEMENT (Bouton d'alerte chat)
        // ==========================================
        const escapeBtn = ev.target.closest('button[data-action="escapeGrapple"]');
        if (escapeBtn) {
            ev.preventDefault();
            
            const actorId = escapeBtn.dataset.actorId;
            const actor = game.actors.get(actorId);
            
            if (actor) {
                // On lance la résolution du jet d'évasion
                escapeGrapple(actor);
            } else {
                ui.notifications.error("Impossible de retrouver le personnage agrippé.");
            }
            return;
        }
    });

    // ==========================================
    // 7. GESTION DU DRAG & DROP (Gabarits de sorts magiques)
    // ==========================================
    chatElement.addEventListener('dragstart', (ev) => {
        // On vérifie si l'élément qu'on attrape est bien notre boîte de gabarit
        const dragEl = ev.target.closest('.template-drag');
        if (dragEl) {
            // On récupère la distance et la forme cachées dans le HTML
            const distance = parseFloat(dragEl.dataset.distance) || 5;
            const shape = dragEl.dataset.shape || "circle";
            
            // On prépare le "colis" pour Foundry. 
            // Type "MeasuredTemplate" est un mot de passe natif de Foundry.
            const dragData = {
                type: "MeasuredTemplate",
                distance: distance,
                t: shape,
                fillColor: game.user.color || "#192a51", // Utilise la couleur du joueur !
            };
            
            // On attache le colis à la souris
            ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
            ev.dataTransfer.effectAllowed = "copy";
        }
    });
}

// ==========================================
// FONCTIONS INTERNES 
// ==========================================

/**
 * Calcule le nouveau résultat après l'ajout de Panache et crée un second message (Gère Compétences ET Attaques).
 * @param {ArgyropeeActor} actor - L'acteur qui a dépensé le panache.
 * @param {HTMLElement} messageDiv - L'élément HTML du message d'origine (pour y lire le dé et le total).
 * @param {number} points - Le nombre de points de panache dépensés.
 */
async function executePanacheRoll(actor, messageDiv, points) {
    await actor.update({"system.panache.value": actor.system.panache.value - points});
    
    const deNaturel = parseInt(messageDiv.dataset.deNaturel);
    const nouveauDe = deNaturel + points;
    const rollType = messageDiv.dataset.rollType || "skill";
    
    const totalOriginal = parseInt(messageDiv.querySelector(".dice-total").innerText.match(/\d+/)[0]);
    const nouveauTotal = totalOriginal + points;
    
    let reussiteLabel = "";
    let cssClass = "";
    let degatsHtml = "";
    
    if (rollType === "attack") {
        const weaponId = messageDiv.dataset.itemId;
        const weapon = actor.items.get(weaponId);
        
        if (nouveauTotal >= 15) {
            reussiteLabel = "RÉUSSITE CRITIQUE !";
            cssClass = "crit-success";
            if (weapon) {
                let doubleDamage = weapon.system.damage.replace(/^(\d+)d(\d+)/i, (match, dCount, dFaces) => {
                    return `${parseInt(dCount) * 2}d${dFaces}`;
                });
                degatsHtml = `
                  <div class="roll-result-box" style="border-color: darkgreen;">
                      <b>Exploit martial ! Choisissez :</b>
                      <button type="button" class="damage-btn" data-action="rollDamage" data-formula="${doubleDamage}" data-weapon="${weapon.name} (Doublés)"><i class="fas fa-tint"></i> Dégâts x2</button>
                      <button type="button" class="action-btn" data-action="rollDamage" data-formula="${weapon.system.damage}" data-weapon="${weapon.name} (+ Manœuvre)"><i class="fas fa-fist-raised"></i> Dégâts + Manœuvre</button>
                  </div>`;
            }
        } else if (nouveauTotal >= 10) {
            reussiteLabel = "L'ATTAQUE TOUCHE !";
            cssClass = "success";
            if (weapon) {
                degatsHtml = `<button type="button" class="damage-btn" data-action="rollDamage" data-formula="${weapon.system.damage}" data-weapon="${weapon.name}"><i class="fas fa-tint"></i> Lancer les dégâts (${weapon.system.damage})</button>`;
            }
        } else if (nouveauTotal <= 0) {
            reussiteLabel = "ÉCHEC CRITIQUE"; cssClass = "crit-fail";
        } else {
            reussiteLabel = "ATTAQUE ESQUIVÉE / RATÉE"; cssClass = "fail";
        }
    } else {
        if (nouveauTotal <= 0) { reussiteLabel = "Échec Critique"; cssClass = "crit-fail"; } 
        else if (nouveauTotal <= 7) { reussiteLabel = "Échec Simple"; cssClass = "fail"; } 
        else if (nouveauTotal <= 9) { reussiteLabel = "Réussite Partielle"; cssClass = "partial"; } 
        else if (nouveauTotal <= 14) { reussiteLabel = "Réussite Simple"; cssClass = "success"; } 
        else { reussiteLabel = "Réussite Critique"; cssClass = "crit-success"; }
    }
    
    const content = `
    <div class="argyropee-roll panache">
      <header><i class="fas fa-sun"></i> Effort de Panache !</header>
      <div class="roll-body">
          <div class="roll-details">${actor.name} puise dans ses réserves (+${points} points).</div>
          <div class="roll-result-box">
              Nouveau dé : ${deNaturel} + ${points} = <b>${nouveauDe}</b>
              <div class="dice-total ${cssClass}">${reussiteLabel}<br>(${nouveauTotal})</div>
          </div>
          ${degatsHtml}
      </div>
    </div>
  `;
    
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: content });
}
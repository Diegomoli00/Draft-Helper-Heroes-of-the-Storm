import { HEROES_DATA } from './data.js';
import { MAPS } from './data.js';

// Mappa predefinita dei punteggi per gli eroi appena aggiunti
const DEFAULT_MAP_SCORES = MAPS.reduce((acc, map) => {
    acc[map] = 3; // Punteggio neutro
    return acc;
}, {});

const ROLES = ['Tank', 'Bruiser', 'Melee Assassin', 'Ranged Assassin', 'Healer', 'Support'];
const EXCLUDEDROLES = ['Melee Assassin', 'Support'];
const SAMEROLES = ['Melee Assassin', 'Ranged Assassin', 'Support'];

// Pesi per il calcolo del punteggio
const SCORE_WEIGHTS = {
    map: 1,
    synergy: 2.5,
    counter: 2.5,
    countered: 2.5,
    roleBonus: 5.0 // Grande bonus per riempire un ruolo mancante
};

// --- FUNZIONI DI INIZIALIZZAZIONE UI ---

/** Inizializza le dropdown/checkbox con i dati degli eroi e delle mappe. */
function initializeUI() {
    const mapSelect = document.getElementById('mapSelect');
    const alliedContainer = document.getElementById('alliedHeroesContainer');
    const enemyContainer = document.getElementById('enemyHeroesContainer');
    const bannedContainer = document.getElementById('bannedHeroesContainer');
    const roleToPick = document.getElementById('roleToPick');

    // 1. Inizializza Mappe
    mapSelect.innerHTML = '<option value="">Select Map...</option>';
    MAPS.forEach(map => {
        const option = document.createElement('option');
        option.value = map;
        option.textContent = map;
        mapSelect.appendChild(option);
    });

    // 2. Inizializza Mappe
    roleToPick.innerHTML = '<option value="">Select Role...</option>';
    ROLES.forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        roleToPick.appendChild(option);
    });
    

    // 3. Inizializza Eroi (Alleati & Avversari)
    // Filtra per eroi con dati completi (ovvero: hanno il mapScore per la prima mappa)
    const availableHeroes = HEROES_DATA.filter(hero => hero.mapScore[MAPS[0]]);
    
    availableHeroes.sort((a, b) => a.name.localeCompare(b.name)).forEach(hero => {
        const checkboxHtml = `
            <label class="flex items-center space-x-2 text-sm">
                <input type="checkbox" name="__HERO_TYPE__" value="${hero.id}" 
                        class="hero-checkbox form-checkbox h-4 w-4 __COLOR_CLASS__ bg-gray-700 border-gray-600 rounded">
                <span>${hero.name} <span class="text-gray-400">(${hero.role})</span></span>
            </label>
        `;

        // Checkbox Bannati
        bannedContainer.innerHTML += checkboxHtml
            .replace('__HERO_TYPE__', 'bannedHero')
            .replace('__COLOR_CLASS__', 'text-green-500');
        

        // Checkbox Alleati
        alliedContainer.innerHTML += checkboxHtml
            .replace('__HERO_TYPE__', 'alliedHero')
            .replace('__COLOR_CLASS__', 'text-green-500');
        
        // Checkbox Avversari
        enemyContainer.innerHTML += checkboxHtml
            .replace('__HERO_TYPE__', 'enemyHero')
            .replace('__COLOR_CLASS__', 'text-purple-500');
    });

    // Aggiunge listener per limitare a 4 alleati e 5 nemici
    setupCheckboxLimits('alliedHero', 4);
    setupCheckboxLimits('enemyHero', 5);
}

/** Imposta il limite di selezione per i gruppi di checkbox. */
function setupCheckboxLimits(name, limit) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
            
            // Impedisce la selezione se il limite è superato
            if (checked.length > limit) {
                checkbox.checked = false;
                displayMessage(`Errore: Puoi selezionare un massimo di ${limit} Eroi ${name.includes('allied') ? 'Alleati' : 'Avversari'}.`, true);
                return; 
            }
            
            // Logica di prevenzione doppia selezione (Alleato vs Nemico)
            const otherName = name === 'alliedHero' ? 'enemyHero' : 'alliedHero';
            const otherCheckbox = document.querySelector(`input[name="${otherName}"][value="${checkbox.value}"]`);
            
            if (checkbox.checked && otherCheckbox && otherCheckbox.checked) {
                    otherCheckbox.checked = false;
                    displayMessage(`Attenzione: ${HEROES_DATA.find(h => h.id === checkbox.value).name} è stato rimosso dalla lista ${otherName === 'alliedHero' ? 'Alleati' : 'Avversari'}. Un eroe può essere selezionato solo una volta.`, false);
            }
        });
    });
}

/** Mostra un messaggio di stato/errore nell'area risultati */
function displayMessage(message, isError = true) {
    const list = document.getElementById('suggestionsList');
    const colorClass = isError ? 'bg-yellow-900 text-yellow-300' : 'bg-blue-900 text-blue-300';
    list.innerHTML = `<p class="text-center p-4 rounded-lg ${colorClass}">${message}</p>`;
}


// --- LOGICA DI DRAFTING ---

/** Calcola i suggerimenti in base agli input dell'utente. */
function calculateSuggestions() {
    const selectedMap = document.getElementById('mapSelect').value;
    const alliedIds = Array.from(document.querySelectorAll('input[name="alliedHero"]:checked')).map(el => el.value);
    const enemyIds = Array.from(document.querySelectorAll('input[name="enemyHero"]:checked')).map(el => el.value);
    const bannedIds = Array.from(document.querySelectorAll('input[name="bannedHero"]:checked')).map(el => el.value);
    const roleToPick = document.getElementById('roleToPick').value;
    
    // Verifica input minimi
    if (!selectedMap) {
        return displayMessage("Please, select a Map.");
    }

    // Identifica gli eroi già selezionati (sia alleati che nemici)
    const pickedHeroIds = [...alliedIds, ...enemyIds, ...bannedIds];

    // Calcola i ruoli mancanti nella squadra alleata
    const alliedHeroes = HEROES_DATA.filter(h => alliedIds.includes(h.id));
    const enemyHeroes = HEROES_DATA.filter(h => enemyIds.includes(h.id));
    const alliedRoles = alliedHeroes.map(h => h.role);

    const neededRoles = ROLES.filter(role => !alliedRoles.includes(role) && !EXCLUDEDROLES.includes(role));
    // DPZ = DPS + Support, ruoli che competono per i 2 slot flessibili
    const flexibleRoles = alliedRoles.filter(role => SAMEROLES.includes(role));
    if (flexibleRoles.length < 2) {
        neededRoles.push('Melee Assassin', 'Ranged Assassin', 'Support');
    }


    const suggestions = [];

    // Itera su tutti gli eroi disponibili per trovare il migliore
    for (const candidateHero of HEROES_DATA) {
        // Salta gli eroi già scelti
        if (roleToPick && candidateHero.role !== roleToPick){
            continue;
        }

        if (pickedHeroIds.includes(candidateHero.id)) {
            continue;
        }
        
        // Salta gli eroi che non hanno punteggi per la mappa selezionata (dovrebbe essere raro con l'inizializzazione)
        if (!candidateHero.mapScore[selectedMap]) {
            continue;
        }


        let score = 0;
        let explanation = [];
        
        // 1. Punteggio Mappa (Peso 1.5)
        const mapScore = candidateHero.mapScore[selectedMap] || 0;
        score += mapScore * SCORE_WEIGHTS.map;
        explanation.push(`Mappa (${selectedMap}): ${mapScore * SCORE_WEIGHTS.map.toFixed(1)} punti (Valore base: ${mapScore}/5)`);

        // 2. Punteggio Sinergia (Alleati) (Peso 2.0)
        let synergyScore = 0;
        let synergyName="";
        alliedIds.forEach(alliedId => {
            if (candidateHero.synergy && candidateHero.synergy.includes(alliedId)) {
                synergyName += alliedId + " "
                synergyScore += 1; // +1 per ogni alleato con cui ha sinergia
            }
        });
        score += synergyScore * SCORE_WEIGHTS.synergy;
        if (synergyScore > 0) {
            explanation.push(`Sinergia Alleata: ${synergyScore * SCORE_WEIGHTS.synergy.toFixed(1)} punti (Sinergia con ${synergyName})`);
        }

        // 3. Punteggio Counter (Avversari) (Peso 2.5)
        let counterScore = 0;
        let counterName="";
        enemyHeroes.forEach(enemyHeroes => {
            // Controlla se l'eroe candidato è contrastato dall'eroe nemico
            if (enemyHeroes.countered.includes(candidateHero.id)) {
                counterName += enemyHeroes.id + " "
                counterScore += 1; // +1 per ogni nemico che il candidato contrasta
            }
        });
        score += counterScore * SCORE_WEIGHTS.counter;
        if (counterScore > 0) {
            explanation.push(`Counter Avversario: ${counterScore * SCORE_WEIGHTS.counter.toFixed(1)} punti (Contrasta ${counterName})`);
        }

        // 4. Countered Score (Opponents)
        let counteredScore = 0;
        let counteredList = [];

        enemyIds.forEach(enemyId => {
            if (candidateHero.countered && candidateHero.countered.includes(enemyId)) {
                counteredScore -= 1;
                const enemyHero = HEROES_DATA.find(h => h.id === enemyId);
                counteredList.push(enemyHero ? enemyHero.name : enemyId);
            }
        });

        score += counteredScore * SCORE_WEIGHTS.countered;

        if (counteredScore < 0) {
            explanation.push(
                `Countered by: ${(counteredScore * SCORE_WEIGHTS.countered).toFixed(1)} points (by: ${counteredList.join(', ')})`
            );
        }

        
        // 5. Bonus Ruolo Mancante (Peso 5.0)
        let roleBonus = 0;
        if (neededRoles.includes(candidateHero.role)) {
            roleBonus = SCORE_WEIGHTS.roleBonus;
            score += roleBonus;
            explanation.push(`**BONUS RUOLO**: ${roleBonus.toFixed(1)} punti (Manca il ruolo: ${candidateHero.role})`);
        }

        suggestions.push({
            hero: candidateHero.name,
            role: candidateHero.role,
            score: score,
            explanation: explanation
        });
    }

    // Ordina per punteggio decrescente
    suggestions.sort((a, b) => b.score - a.score);

    // Visualizza i risultati
    renderSuggestions(suggestions.slice(0, 10), alliedRoles, neededRoles);
}

/** Renderizza la lista di suggerimenti nella UI. */
function renderSuggestions(topSuggestions, alliedRoles, neededRoles) {
    const list = document.getElementById('suggestionsList');
    
    // Visualizza la composizione attuale del team
    const alliedRolesString = alliedRoles.length > 0 ? alliedRoles.join(', ') : 'Nessun ruolo selezionato';
    const neededRolesString = neededRoles.length > 0 ? neededRoles.join(', ') : 'Tutti i ruoli sono coperti (teoricamente)';

    let html = `
        <div class="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700">
            <p class="text-sm text-gray-400">Ruoli Alleati Selezionati: <span class="text-green-300 font-medium">${alliedRolesString}</span></p>
            <p class="text-sm text-gray-400">Ruoli Mancanti Prioritari: <span class="text-red-300 font-bold">${neededRolesString}</span></p>
        </div>
    `;

    if (topSuggestions.length === 0) {
        html += '<p class="text-center text-yellow-300 bg-yellow-900 p-4 rounded-lg">Nessun eroe disponibile. Assicurati di non aver selezionato tutti gli eroi.</p>';
    } else {
        topSuggestions.forEach((suggestion, index) => {
            const rankColor = index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-600';
            const roleColor = {
                'Tank': 'text-red-500',
                'Bruiser': 'text-orange-500',
                'Melee Assassin': 'text-yellow-500',
                'Ranged Assassin': 'text-purple-500',
                'Healer': 'text-green-500',
                'Support': 'text-teal-500'
            }[suggestion.role] || 'text-gray-400';

            html += `
                <div class="suggested-hero card p-4 rounded-xl transition-shadow cursor-pointer bg-gray-800 border border-gray-700 mb-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <span class="w-8 h-8 flex items-center justify-center rounded-full font-bold text-gray-900 ${rankColor}">${index + 1}</span>
                            <div>
                                <h3 class="text-xl font-bold ${roleColor}">${suggestion.hero}</h3>
                                <p class="text-sm text-gray-400">${suggestion.role}</p>
                            </div>
                        </div>

                        <div class="text-right">
                            <span class="text-2xl font-extrabold text-red-400">${suggestion.score.toFixed(1)}</span>
                            <span class="text-sm text-gray-500 block">Punteggio Totale</span>
                        </div>
                    </div>

                    <!-- Sezione espandibile -->
                    <div class="details hidden mt-3 p-4 bg-gray-900 rounded-lg border border-gray-700">
                        <h4 class="text-lg font-bold mb-2 text-white border-b border-gray-600 pb-1">Dettaglio Punteggio:</h4>
                        <ul class="text-sm text-gray-300 space-y-1 list-disc pl-5">
                            ${suggestion.explanation.map(exp => `<li>${exp}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });
    }

    list.innerHTML = html;

    // Attiva il toggle al click su ciascuna card
    document.querySelectorAll('.suggested-hero').forEach(card => {
        card.addEventListener('click', () => {
            const details = card.querySelector('.details');
            details.classList.toggle('hidden');
        });
    });
}

function filterHeroes(containerId, searchTerm) {
    const container = document.getElementById(containerId);
    const query = searchTerm.toLowerCase();
    const checkboxes = container.querySelectorAll('label');

    checkboxes.forEach(label => {
        const text = label.textContent.toLowerCase();
        label.style.display = text.includes(query) ? '' : 'none';
    });
}
// Espongo alcune funzioni sul window per l'HTML inline (oninput / onclick)

window.initializeUI = initializeUI;
window.calculateSuggestions = calculateSuggestions;
window.filterHeroes = filterHeroes;
document.addEventListener("DOMContentLoaded", initializeUI);
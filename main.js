const CLE_API = 'a06cefd21bcfe179404023316c1ede7ecab94915b9a7959ae201c44927632b26';

document.addEventListener('DOMContentLoaded', () => {
    initialiserModeSombre();
    initialiserMenuJours();
    configurerEcouteursEvenements();
    window.historiqueMeteo = new HistoriqueMeteo();
});

function formaterDateEnFrancais(chaineDate) {
    const date = new Date(chaineDate);
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

    const jourSemaine = joursSemaine[date.getDay()];
    const jour = date.getDate().toString().padStart(2, '0');
    const nomMois = mois[date.getMonth()];

    return `${jourSemaine} ${jour} ${nomMois}`;
}

function initialiserModeSombre() {
    const boutonTheme = document.getElementById('themeToggle');
    const corpsDocument = document.body;
    const prefereSchemaSombre = window.matchMedia('(prefers-color-scheme: dark)');

    const appliquerTheme = (estSombre) => {
        if (estSombre) {
            corpsDocument.classList.add('dark-mode');
        } else {
            corpsDocument.classList.remove('dark-mode');
        }
    };

    const themeSauvegarde = localStorage.getItem('darkMode');
    if (themeSauvegarde === 'enabled') {
        appliquerTheme(true);
    } else if (themeSauvegarde === 'disabled') {
        appliquerTheme(false);
    } else {
        appliquerTheme(prefereSchemaSombre.matches);
    }

    boutonTheme.addEventListener('click', () => {
        const estModeSombre = corpsDocument.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', estModeSombre ? 'enabled' : 'disabled');
    });

    prefereSchemaSombre.addEventListener('change', (e) => {
        if (localStorage.getItem('darkMode') === null) {
            appliquerTheme(e.matches);
        }
    });
}

function initialiserMenuJours() {
    const selectionJours = document.getElementById("daysSelect");
    const valeurJours = document.getElementById("days-value");

    const mettreAJourTexteJours = (jours) => {
        const nombreJours = parseInt(jours, 10);
        const texte = `${nombreJours} jour${nombreJours > 1 ? "s" : ""}`;
        valeurJours.textContent = texte;
        selectionJours.setAttribute('aria-valuenow', nombreJours);
        selectionJours.setAttribute('aria-valuetext', texte);
    };

    mettreAJourTexteJours(selectionJours.value);
    selectionJours.addEventListener("input", () => mettreAJourTexteJours(selectionJours.value));
}

function configurerEcouteursEvenements() {
    const inputCodePostal = document.getElementById('code-postal');
    const boutonValidation = document.getElementById('validationButton');
    const formulairePostal = document.getElementById('postal_form');

    inputCodePostal.addEventListener('input', debounce(gererInputCodePostal, 300));
    formulairePostal.addEventListener('submit', (e) => {
        e.preventDefault();
        gererRechercheMeteo();
    });
    boutonValidation.addEventListener('click', (e) => {
        e.preventDefault();
        gererRechercheMeteo();
    });
}

function debounce(func, delai) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delai);
    };
}

async function gererInputCodePostal(evenement) {
    const codePostal = evenement.target.value.trim();
    const selectCommune = document.getElementById('communeSelect');
    const boutonValidation = document.getElementById('validationButton');

    selectCommune.style.display = "none";
    boutonValidation.style.display = "none";

    if (!/^\d{5}$/.test(codePostal)) return;

    const communes = await recupererCommunesParCodePostal(codePostal);
    selectCommune.innerHTML = '<option value="" disabled selected>Sélectionnez une commune</option>';

    if (communes.length === 0) return;

    communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune.code;
        option.textContent = commune.nom;
        option.dataset.lat = commune.centre.coordinates[1].toString();
        option.dataset.lon = commune.centre.coordinates[0].toString();
        selectCommune.appendChild(option);
    });

    selectCommune.style.display = "block";
    boutonValidation.style.display = "block";
}

async function recupererCommunesParCodePostal(codePostal) {
    const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}&fields=code,nom,centre&boost=population&limit=10`;
    const reponse = await fetch(url);
    const donnees = await reponse.json();
    return donnees;
}

async function recupererMeteoParCommune(codeInsee, jours) {
    const url = `https://api.meteo-concept.com/api/forecast/daily?token=${CLE_API}&insee=${encodeURIComponent(codeInsee)}`;
    const reponse = await fetch(url);
    const donnees = await reponse.json();
    return donnees.forecast.slice(0, jours);
}

async function gererRechercheMeteo() {
    const selectCommune = document.getElementById('communeSelect');
    const selectJours = document.getElementById('daysSelect');
    const inputCodePostal = document.getElementById('code-postal');
    const infoMeteo = document.getElementById("weatherInformation");

    if (selectCommune.selectedIndex <= 0) return;

    const optionSelectionnee = selectCommune.options[selectCommune.selectedIndex];
    const communeSelectionnee = optionSelectionnee.value;
    const latitude = optionSelectionnee.dataset.lat;
    const longitude = optionSelectionnee.dataset.lon;
    const joursSelectionnes = parseInt(selectJours.value, 10);
    const codePostal = inputCodePostal.value;
    const nomCommune = optionSelectionnee.textContent;

    infoMeteo.innerHTML = '<div class="loading">Chargement des données météo...</div>';
    infoMeteo.style.display = "block";

    const donneesMeteo = await recupererMeteoParCommune(communeSelectionnee, joursSelectionnes);
    if (donneesMeteo.length === 0) return;

    afficherDonneesMeteo(donneesMeteo, joursSelectionnes, latitude, longitude);
    window.historiqueMeteo.ajouterAHistorique({
        commune: nomCommune,
        codePostal: codePostal,
        codeInsee: communeSelectionnee,
        latitude: latitude,
        longitude: longitude,
        jours: joursSelectionnes
    });
}

function afficherDonneesMeteo(donneesMeteo, joursSelectionnes, latitude, longitude) {
    const infoMeteo = document.getElementById("weatherInformation");
    const afficherLat = document.getElementById('checkbox-lat')?.checked || false;
    const afficherLon = document.getElementById('checkbox-lon')?.checked || false;
    const afficherPluie = document.getElementById('checkbox-rain')?.checked || false;
    const afficherVent = document.getElementById('checkbox-wind')?.checked || false;
    const afficherDirVent = document.getElementById('checkbox-winddir')?.checked || false;

    const formaterValeur = (valeur, unite = '', valeurDefaut = 'N/A') => {
        if (valeur === null || valeur === undefined || valeur === '') return valeurDefaut;
        return `${valeur}${unite}`;
    };

    let sectionCoordonnees = '';
    if (afficherLat || afficherLon) {
        sectionCoordonnees = `
        <div class="coordinates">
            ${afficherLat ? `<p><strong>Latitude :</strong> ${parseFloat(latitude).toFixed(4)}°</p>` : ''}
            ${afficherLon ? `<p><strong>Longitude :</strong> ${parseFloat(longitude).toFixed(4)}°</p>` : ''}
            <hr>
        </div>`;
    }

    infoMeteo.innerHTML = `
    <h2>Prévisions météo pour les ${joursSelectionnes} prochain${joursSelectionnes > 1 ? 's' : ''} jour${joursSelectionnes > 1 ? 's' : ''}</h2>
    ${sectionCoordonnees}
    <div class="weather-cards-container">
        ${donneesMeteo.map((jour) => {
            const tmin = formaterValeur(jour.tmin, '°C');
            const tmax = formaterValeur(jour.tmax, '°C');
            const probarain = formaterValeur(jour.probarain, '%');
            const rr10 = formaterValeur(jour.rr10, ' mm');
            const vent10m = formaterValeur(jour.wind10m, ' km/h');
            const dirVent10m = formaterValeur(jour.dirwind10m, '°');

            return `
            <div class="weather-card">
                <h3 style="color: aqua;">${formaterDateEnFrancais(jour.datetime)}</h3>
                <div class="weather-details">
                    <p><strong>Températures :</strong> ${tmin} à ${tmax}</p>
                    <p><strong>Probabilité de pluie :</strong> ${probarain}</p>
                    ${afficherPluie ? `<p><strong>Cumul de pluie :</strong> ${rr10}</p>` : ''}
                    ${afficherVent ? `<p><strong>Vent moyen :</strong> ${vent10m}</p>` : ''}
                    ${afficherDirVent ? `<p><strong>Direction du vent :</strong> ${dirVent10m}</p>` : ''}
                </div>
            </div>
            `;
        }).join('')}
    </div>
    `;

    infoMeteo.style.display = "block";
}

function afficherNotification(message, type = "info") {
    let notification = document.querySelector('.notification');
    if (notification) notification.remove();

    notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 300);
    }, 4000);
}

class HistoriqueMeteo {
    constructor() {
        this.nombreMaxElementsHistorique = 10;
        this.cleStockage = 'weatherHistory';
        this.init();
    }

    init() {
        this.creerSectionHistorique();
        this.chargerHistorique();
        this.associerEvenements();
    }

    creerSectionHistorique() {
        const menuSelection = document.getElementById('selectionMenu');
        const htmlHistorique = `
            <div class="option-section" id="historySection">
                <h3>
                    <i class="fas fa-history" aria-hidden="true"></i> Historique des recherches
                    <button type="button" id="clearHistoryBtn" class="clear-history-btn" title="Vider l'historique">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </h3>
                <div id="historyContainer" class="history-container">
                    <p class="no-history">Aucune recherche effectuée</p>
                </div>
            </div>
        `;
        menuSelection.insertAdjacentHTML('beforeend', htmlHistorique);
    }

    chargerHistorique() {
        const historique = JSON.parse(localStorage.getItem(this.cleStockage) || '[]');
        this.afficherHistorique(historique);
    }

    ajouterAHistorique(donneesRecherche) {
        let historique = JSON.parse(localStorage.getItem(this.cleStockage) || '[]');
        const elementHistorique = {
            id: Date.now(),
            commune: donneesRecherche.commune,
            codePostal: donneesRecherche.codePostal,
            codeInsee: donneesRecherche.codeInsee,
            latitude: parseFloat(donneesRecherche.latitude).toFixed(4),
            longitude: parseFloat(donneesRecherche.longitude).toFixed(4),
            jours: parseInt(donneesRecherche.jours, 10),
            timestamp: new Date().toISOString(),
            dateAffichage: new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        };

        const indexExistant = historique.findIndex(element => element.codeInsee === elementHistorique.codeInsee && element.jours === elementHistorique.jours);
        if (indexExistant !== -1) historique.splice(indexExistant, 1);

        historique.unshift(elementHistorique);
        if (historique.length > this.nombreMaxElementsHistorique) historique = historique.slice(0, this.nombreMaxElementsHistorique);

        localStorage.setItem(this.cleStockage, JSON.stringify(historique));
        this.afficherHistorique(historique);
    }

    afficherHistorique(historique) {
        const conteneur = document.getElementById('historyContainer');
        if (!historique || historique.length === 0) {
            conteneur.innerHTML = '<p class="no-history">Aucune recherche effectuée</p>';
            return;
        }

        const htmlHistorique = historique.map(element => {
            const donneesEscapees = this.echapperHtml(JSON.stringify(element));
            return `
            <div class="history-item" data-search='${donneesEscapees}'>
                <div class="history-main">
                    <div class="history-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <strong>${this.echapperHtml(element.commune)}</strong>
                        <span class="postal-code">(${this.echapperHtml(element.codePostal)})</span>
                    </div>
                    <div class="history-details">
                        <span class="history-days">
                            <i class="fas fa-calendar-alt"></i>
                            ${element.jours} jour${element.jours > 1 ? 's' : ''}
                        </span>
                        <span class="history-date">
                            <i class="fas fa-clock"></i>
                            ${this.echapperHtml(element.dateAffichage)}
                        </span>
                    </div>
                </div>
                <button type="button" class="history-reload-btn" title="Relancer cette recherche">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
            `;
        }).join('');

        conteneur.innerHTML = htmlHistorique;
    }

    echapperHtml(texte) {
        const div = document.createElement('div');
        div.textContent = texte;
        return div.innerHTML;
    }

    rechargerRecherche(donneesRecherche) {
        const inputCodePostal = document.getElementById('code-postal');
        const selectCommune = document.getElementById('communeSelect');
        const selectJours = document.getElementById('daysSelect');
        const boutonValidation = document.getElementById('validationButton');

        inputCodePostal.value = donneesRecherche.codePostal;
        selectCommune.innerHTML = `
            <option value="" disabled>Sélectionnez une commune</option>
            <option value="${this.echapperHtml(donneesRecherche.codeInsee)}" selected
                    data-lat="${donneesRecherche.latitude}"
                    data-lon="${donneesRecherche.longitude}">
                ${this.echapperHtml(donneesRecherche.commune)}
            </option>
        `;
        selectCommune.style.display = "block";
        selectJours.value = donneesRecherche.jours;
        const valeurJours = document.getElementById("days-value");
        if (valeurJours) valeurJours.textContent = `${donneesRecherche.jours} jour${donneesRecherche.jours > 1 ? "s" : ""}`;
        boutonValidation.style.display = "block";

        setTimeout(() => gererRechercheMeteo(), 500);
        afficherNotification('Recherche rechargée depuis l\'historique', 'success');
    }

    viderHistorique() {
        if (confirm('Êtes-vous sûr de vouloir vider l\'historique des recherches ?')) {
            localStorage.removeItem(this.cleStockage);
            this.afficherHistorique([]);
            afficherNotification('Historique vidé avec succès', 'success');
        }
    }

    associerEvenements() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#clearHistoryBtn')) {
                e.preventDefault();
                this.viderHistorique();
            }

            if (e.target.closest('.history-reload-btn')) {
                e.preventDefault();
                const elementHistorique = e.target.closest('.history-item');
                const donneesRecherche = JSON.parse(elementHistorique.dataset.search);
                this.rechargerRecherche(donneesRecherche);
            }
        });
    }
}

const API_KEY = 'a06cefd21bcfe179404023316c1ede7ecab94915b9a7959ae201c44927632b26';

// Attendre que le DOM soit complètement chargé
document.addEventListener('DOMContentLoaded', function () {
    initDarkMode();
    initDaysMenu();
    setupEventListeners();
    window.weatherHistory = new WeatherHistory();
});

// Fonction pour formater une date au format "jour de la semaine XX mois"
function formatDateToFrench(dateString) {
    const date = new Date(dateString);
    const mois = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    const joursDeLaSemaine = [
        'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'
    ];

    const jourSemaine = joursDeLaSemaine[date.getDay()];
    const jour = date.getDate().toString().padStart(2, '0');
    const moisNom = mois[date.getMonth()];

    return `${jourSemaine} ${jour} ${moisNom}`;
}

// Initialisation du mode sombre
function initDarkMode() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    // Vérifier la préférence système de l'utilisateur
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    // Vérifier la préférence sauvegardée ou utiliser la préférence système
    if (localStorage.getItem('darkMode') === 'enabled' ||
        (localStorage.getItem('darkMode') === null && prefersDarkScheme.matches)) {
        body.classList.add('dark-mode');
    }

    // Basculer le mode sombre au clic du bouton
    themeToggle.addEventListener('click', function () {
        body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
    });

    // Écouter les changements de préférence système
    prefersDarkScheme.addEventListener('change', (e) => {
        // Ne pas écraser la préférence explicite de l'utilisateur
        if (localStorage.getItem('darkMode') === null) {
            if (e.matches) {
                body.classList.add('dark-mode');
            } else {
                body.classList.remove('dark-mode');
            }
        }
    });
}

// Initialisation du slider de jours
function initDaysMenu() {
    const daysSelect = document.getElementById("daysSelect");
    const daysValue = document.getElementById("days-value");

    // Définir le texte initial
    updateDaysText(daysSelect.value);

    // Mettre à jour le texte lors du changement
    daysSelect.addEventListener("input", () => {
        updateDaysText(daysSelect.value);
    });

    function updateDaysText(days) {
        daysValue.textContent = `${days} jour${days > 1 ? "s" : ""}`;
        daysSelect.setAttribute('aria-valuenow', days);
        daysSelect.setAttribute('aria-valuetext', `${days} jour${days > 1 ? "s" : ""}`);
    }
}

function setupEventListeners() {
    const codePostalInput = document.getElementById('code-postal');
    const validationButton = document.getElementById('validationButton');

    // Événement pour la recherche de communes
    codePostalInput.addEventListener('input', debounce(handleCodePostalInput, 300));

    // Événement pour la recherche météo
    validationButton.addEventListener('click', handleMeteoSearch);
}

// Fonction de debounce pour limiter les appels API
function debounce(func, delay) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Gestion de l'entrée du code postal
async function handleCodePostalInput(event) {
    const codePostal = event.target.value;
    const communeSelect = document.getElementById('communeSelect');
    const validationButton = document.getElementById('validationButton');

    // Cacher les éléments par défaut
    communeSelect.style.display = "none";
    validationButton.style.display = "none";

    // Vérifier si le code postal est valide
    if (/^\d{5}$/.test(codePostal)) {
        try {
            const communes = await fetchCommunesByCodePostal(codePostal);

            // Réinitialiser le select
            communeSelect.innerHTML = '<option value="" disabled selected>Sélectionnez une commune</option>';

            // Ajouter les options
            communes.forEach(commune => {
                const option = document.createElement('option');
                option.value = commune.code;
                option.textContent = commune.nom;
                option.dataset.lat = commune.centre?.coordinates[1] || '';
                option.dataset.lon = commune.centre?.coordinates[0] || '';
                communeSelect.appendChild(option);
            });

            if (communes.length) {
                communeSelect.style.display = "block";
                validationButton.style.display = "block";
            } else {
                showNotification("Aucune commune trouvée pour ce code postal.", "error");
            }
        } catch (error) {
            showNotification("Erreur lors de la recherche des communes.", "error");
        }
    }
}

// Récupération des communes par code postal
async function fetchCommunesByCodePostal(codePostal) {
    try {
        const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}&fields=code,nom,centre&boost=population&limit=10`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.status}`);
        }

        const data = await response.json();
        return data.length ? data : [];
    } catch (error) {
        console.error("Erreur lors de la récupération des communes:", error);
        return [];
    }
}

// Récupération des données météo par code INSEE
async function fetchMeteoByCommune(codeInsee, days) {
    try {
        const url = `https://api.meteo-concept.com/api/forecast/daily?token=${API_KEY}&insee=${codeInsee}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.status}`);
        }

        const data = await response.json();
        return data.forecast?.slice(0, days) || [];
    } catch (error) {
        console.error("Erreur lors de la récupération des prévisions météo:", error);
        return [];
    }
}

// Gestion de la recherche météo
async function handleMeteoSearch() {
    const communeSelect = document.getElementById('communeSelect');
    const selectedOption = communeSelect.options[communeSelect.selectedIndex];

    // Vérifier si une commune est sélectionnée
    if (communeSelect.selectedIndex <= 0) {
        showNotification("Veuillez sélectionner une commune.", "error");
        return;
    }

    const selectedCommune = selectedOption.value;
    const latitude = selectedOption.dataset.lat;
    const longitude = selectedOption.dataset.lon;
    const selectedDays = parseInt(document.getElementById('daysSelect').value, 10);
    const codePostal = document.getElementById('code-postal').value;
    const communeName = selectedOption.textContent;

    if (selectedCommune && selectedDays) {
        try {
            // Afficher un indicateur de chargement
            const weatherInfo = document.getElementById("weatherInformation");
            weatherInfo.innerHTML = '<div class="loading">Chargement des données météo...</div>';
            weatherInfo.style.display = "block";

            const meteoData = await fetchMeteoByCommune(selectedCommune, selectedDays);

            if (meteoData.length) {
                displayWeatherData(meteoData, selectedDays, latitude, longitude);

                if (window.weatherHistory) {
                    window.weatherHistory.addToHistory({
                        commune: communeName,
                        codePostal: codePostal,
                        codeInsee: selectedCommune,
                        latitude: latitude,
                        longitude: longitude,
                        days: selectedDays
                    });
                }
            } else {
                showNotification("Aucune donnée météo disponible pour cette commune.", "error");
                weatherInfo.style.display = "none";
            }
        } catch (error) {
            showNotification("Erreur lors de la récupération des données météo.", "error");
            document.getElementById("weatherInformation").style.display = "none";
        }
    } else {
        showNotification("Veuillez sélectionner une commune et le nombre de jours.", "error");
    }
}

// Affichage des données météo
function displayWeatherData(meteoData, selectedDays, latitude, longitude) {
    const weatherInfo = document.getElementById("weatherInformation");

    weatherInfo.innerHTML = `
    <h2>Prévisions météo pour les ${selectedDays} prochain${selectedDays > 1 ? 's' : ''} jour${selectedDays > 1 ? 's' : ''}</h2>
    <div class="coordinates">
        <p><strong>Latitude :</strong> ${latitude}°</p>
        <p><strong>Longitude :</strong> ${longitude}°<br> ----- </p>
    </div>
    <div class="weather-cards-container">
        ${meteoData.map((day, index) => `
            <div class="weather-card">
                <h3 style="color: aqua;">${formatDateToFrench(day.datetime)}</h3>
                <div class="weather-details">
                    <p><strong>Températures :</strong> ${day.tmin}°C à ${day.tmax}°C</p>
                    <p><strong>Probabilité de pluie :</strong> ${day.probarain} %</p>
                    ${document.getElementById('checkbox-rain')?.checked ? `<p><strong>Cumul de pluie :</strong> ${day.rr10} mm</p>` : ''}
                    ${document.getElementById('checkbox-wind')?.checked ? `<p><strong>Vent moyen :</strong> ${day.wind10m} km/h</p>` : ''}
                    ${document.getElementById('checkbox-winddir')?.checked ? `<p><strong>Direction du vent :</strong> ${day.dirwind10m}°</p>` : ''}
                </div>
            </div>
        `).join('')}
    </div>
    `;

    weatherInfo.style.display = "block";
}

// Affichage de notifications
function showNotification(message, type = "info") {
    // Vérifier si une notification existe déjà
    let notification = document.querySelector('.notification');

    // Si elle existe, la supprimer
    if (notification) {
        notification.remove();
    }

    // Créer une nouvelle notification
    notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Ajouter la notification au DOM
    document.body.appendChild(notification);

    // Faire apparaître la notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Faire disparaître la notification après 3 secondes
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

class WeatherHistory {
    constructor() {
        this.maxHistoryItems = 10; // Limite à 10 éléments
        this.init();
    }

    init() {
        this.createHistorySection();
        this.loadHistory();
        this.bindEvents();
    }

    // Créer la section historique dans le DOM
    createHistorySection() {
        const selectionMenu = document.getElementById('selectionMenu');

        const historyHTML = `
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

        selectionMenu.insertAdjacentHTML('beforeend', historyHTML);
    }

    // Charger l'historique depuis le stockage local
    loadHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
            this.displayHistory(history);
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique :', error);
            this.displayHistory([]);
        }
    }

    // Ajouter une recherche à l'historique
    addToHistory(searchData) {
        try {
            let history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');

            // Créer l'objet de recherche
            const searchItem = {
                id: Date.now(),
                commune: searchData.commune,
                codePostal: searchData.codePostal,
                codeInsee: searchData.codeInsee,
                latitude: parseFloat(searchData.latitude).toFixed(4),
                longitude: parseFloat(searchData.longitude).toFixed(4),
                days: searchData.days,
                timestamp: new Date().toISOString(),
                displayDate: new Date().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };

            // Vérifier si cette recherche existe déjà (même commune, même nombre de jours)
            const existingIndex = history.findIndex(item =>
                item.codeInsee === searchItem.codeInsee && item.days === searchItem.days
            );

            // Si elle existe, la supprimer pour la remettre en premier
            if (existingIndex !== -1) {
                history.splice(existingIndex, 1);
            }

            // Ajouter en premier
            history.unshift(searchItem);

            // Limiter à maxHistoryItems
            if (history.length > this.maxHistoryItems) {
                history = history.slice(0, this.maxHistoryItems);
            }

            // Sauvegarder
            localStorage.setItem('weatherHistory', JSON.stringify(history));

            // Afficher
            this.displayHistory(history);
        } catch (error) {
            console.error('Erreur lors de l\'ajout à l\'historique :', error);
        }
    }

    // Afficher l'historique dans le DOM
    displayHistory(history) {
        const container = document.getElementById('historyContainer');

        if (!history || history.length === 0) {
            container.innerHTML = '<p class="no-history">Aucune recherche effectuée</p>';
            return;
        }

        const historyHTML = history.map(item => `
            <div class="history-item" data-search='${JSON.stringify(item)}'>
                <div class="history-main">
                    <div class="history-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <strong>${item.commune}</strong>
                        <span class="postal-code">(${item.codePostal})</span>
                    </div>
                    <div class="history-details">
                        <span class="history-days">
                            <i class="fas fa-calendar-alt"></i>
                            ${item.days} jour${item.days > 1 ? 's' : ''}
                        </span>
                        <span class="history-date">
                            <i class="fas fa-clock"></i>
                            ${item.displayDate}
                        </span>
                    </div>
                </div>
                <button type="button" class="history-reload-btn" title="Relancer cette recherche">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        `).join('');

        container.innerHTML = historyHTML;
    }

    // Relancer une recherche depuis l'historique
    reloadSearch(searchData) {
        try {
            // Remplir les champs du formulaire
            const codePostalInput = document.getElementById('code-postal');
            const communeSelect = document.getElementById('communeSelect');
            const daysSelect = document.getElementById('daysSelect');

            // Définir le code postal
            codePostalInput.value = searchData.codePostal;

            // Créer et sélectionner l'option de commune
            communeSelect.innerHTML = `
                <option value="" disabled>Sélectionnez une commune</option>
                <option value="${searchData.codeInsee}" selected
                        data-lat="${searchData.latitude}"
                        data-lon="${searchData.longitude}">
                    ${searchData.commune}
                </option>
            `;
            communeSelect.style.display = "block";

            // Définir le nombre de jours
            daysSelect.value = searchData.days;
            const daysValue = document.getElementById("days-value");
            daysValue.textContent = `${searchData.days} jour${searchData.days > 1 ? "s" : ""}`;

            // Afficher le bouton de validation
            document.getElementById('validationButton').style.display = "block";

            // Déclencher automatiquement la recherche
            setTimeout(() => {
                handleMeteoSearch();
            }, 500);

        } catch (error) {
            console.error('Erreur lors du rechargement de la recherche:', error);
            showNotification('Erreur lors du rechargement de la recherche', 'error');
        }
    }

    // Vider l'historique
    clearHistory() {
        if (confirm('Êtes-vous sûr de vouloir vider l\'historique des recherches ?')) {
            localStorage.removeItem('weatherHistory');
            this.displayHistory([]);
            showNotification('Historique vidé avec succès', 'success');
        }
    }

    // Lier les événements
    bindEvents() {
        // Bouton pour vider l'historique
        document.addEventListener('click', (e) => {
            if (e.target.closest('#clearHistoryBtn')) {
                this.clearHistory();
            }

            // Bouton pour relancer une recherche
            if (e.target.closest('.history-reload-btn')) {
                const historyItem = e.target.closest('.history-item');
                const searchData = JSON.parse(historyItem.dataset.search);
                this.reloadSearch(searchData);
            }
        });
    }
}

const CLE_API = 'a06cefd21bcfe179404023316c1ede7ecab94915b9a7959ae201c44927632b26';

// Attendre que le DOM soit complètement chargé
document.addEventListener('DOMContentLoaded', function() {
    DemarrerDarkMode();
    DemarrerMenuJours();
    EcouteursEvenements();
});

// Initialisation du mode sombre
function DemarrerDarkMode() {
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
    themeToggle.addEventListener('click', function() {
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
function DemarrerMenuJours() {
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

function EcouteursEvenements() {
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
    return function() {
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
        const url = `https://api.meteo-concept.com/api/forecast/daily?token=${CLE_API}&insee=${codeInsee}`;
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

    if (selectedCommune && selectedDays) {
        try {
            // Afficher un indicateur de chargement
            const weatherInfo = document.getElementById("weatherInformation");
            weatherInfo.innerHTML = '<div class="loading">Chargement des données météo...</div>';
            weatherInfo.style.display = "block";
            
            const meteoData = await fetchMeteoByCommune(selectedCommune, selectedDays);
            
            if (meteoData.length) {
                displayWeatherData(meteoData, selectedDays, latitude, longitude);
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
        <h2>Prévisions météo pour les ${selectedDays} prochains jours</h2>
        <div class="weather-cards-container">
            ${meteoData.map((day, index) => `
                <div class="weather-card">
                    <h3>Jour ${index + 1}</h3>
                    <div class="weather-details">
                        <p><strong>Températures:</strong> ${day.tmin}°C à ${day.tmax}°C</p>
                        <p><strong>Probabilité de pluie:</strong> ${day.probarain}%</p>
                        ${document.getElementById('checkbox-lat').checked ? `<p><strong>Latitude:</strong> ${latitude}°</p>` : ''}
                        ${document.getElementById('checkbox-lon').checked ? `<p><strong>Longitude:</strong> ${longitude}°</p>` : ''}
                        ${document.getElementById('checkbox-rain').checked ? `<p><strong>Cumul de pluie:</strong> ${day.rr10} mm</p>` : ''}
                        ${document.getElementById('checkbox-wind').checked ? `<p><strong>Vent moyen:</strong> ${day.wind10m} km/h</p>` : ''}
                        ${document.getElementById('checkbox-winddir').checked ? `<p><strong>Direction du vent:</strong> ${day.dirwind10m}°</p>` : ''}
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
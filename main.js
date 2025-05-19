const CLE_API = 'a06cefd21bcfe179404023316c1ede7ecab94915b9a7959ae201c44927632b26';

async function fetchCommunesByCodePostal(codePostal) {
    try {
        const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}&fields=code,nom&boost=population&limit=10`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur réseau: ${response.status}`);
        
        const data = await response.json();
        return data.length ? data : [];
    } catch (error) {
        console.error("Erreur lors de la récupération des communes:", error);
        return [];
    }
}

async function fetchMeteoByCommune(codeInsee, days) {
    try {
        const url = `https://api.meteo-concept.com/api/forecast/daily?token=${CLE_API}&insee=${codeInsee}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur réseau: ${response.status}`);

        const data = await response.json();
        return data.forecast?.slice(0, days) || [];
    } catch (error) {
        console.error("Erreur lors de la récupération des prévisions météo:", error);
        return [];
    }
}

document.getElementById('code-postal').addEventListener('input', async (event) => {
    const codePostal = event.target.value;
    const communeSelect = document.getElementById('communeSelect');
    const validationButton = document.getElementById('validationButton');

    communeSelect.style.display = "none";
    validationButton.style.display = "none";

    if (/^\d{5}$/.test(codePostal)) {
        const communes = await fetchCommunesByCodePostal(codePostal);
        communeSelect.innerHTML = communes.map(commune => 
            `<option value="${commune.code}">${commune.nom}</option>`
        ).join('');

        if (communes.length) {
            communeSelect.style.display = "block";
            validationButton.style.display = "block";
        } else {
            alert("Aucune commune trouvée pour ce code postal.");
        }
    }
});

document.getElementById('validationButton').addEventListener('click', async () => {
    const selectedCommune = document.getElementById('communeSelect').value;
    const selectedDays = parseInt(document.getElementById('daysSelect').value, 10);

    if (selectedCommune && selectedDays) {
        const meteoData = await fetchMeteoByCommune(selectedCommune, selectedDays);

        if (meteoData.length) {
            const weatherInfo = document.getElementById("weatherInformation");
            weatherInfo.innerHTML = meteoData.map(day => `
                <div>
                    <p><strong>Jour ${meteoData.indexOf(day) + 1} :</strong></p>
                    <p>Température Min : ${day.tmin}°C</p>
                    <p>Température Max : ${day.tmax}°C</p>
                    <p>Probabilité de pluie : ${day.probarain}%</p>
                </div>
            `).join('');
            weatherInfo.style.display = "block";
        } else {
            alert("Impossible de récupérer les données météo.");
        }
    } else {
        alert("Veuillez sélectionner une commune et le nombre de jours.");
    }
});

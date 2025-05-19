const CLE_API = '40cb912aff2f7792bb9ecd409d50ed4e2dca5e462e8e7ae2643237298e6198be';

async function getCommunesBycodepostal(codepostal) {
  try {
    const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codepostal)}&fields=code,nom&boost=population&limit=10`;
    const reponse = await fetch(url);
    if (!reponse.ok) {
      throw new erreur('Erreur de réseau ou de réponse de l\'API');
    }
    const data = await reponse.json();
    return data;
  } catch (erreur) {
    console.erreur('Erreur :', erreur.message);
    return [];
  }
}

async function getWeatherDataByInsee(codeinsee) {
  try {
    const url = `https://api.meteo-concept.com/api/forecast/daily?token=${CLE_API}&insee=${codeinsee}`;
    console.log('URL de l\'API :', url);

    const reponse = await fetch(url);
    if (!reponse.ok) {
      throw new erreur('Erreur de réseau ou de réponse de l\'API');
    }
    const data = await reponse.json();
    console.log('Données brutes de l\'API :', data);

    const InfosDuJour = data.forecast[0];

    const InfosMeteo = {
      temperatureMin: InfosDuJour.tmin,
      temperatureMax: InfosDuJour.tmax,
      rainProbability: InfosDuJour.probarain,
      sunHours: InfosDuJour.sun_hours,
    };

    console.log('Données météo traitées :', InfosMeteo);
    return InfosMeteo;

  } catch (erreur) {
    console.erreur('Erreur :', erreur.message);
  }
}

document.getElementById('code-postal').addEventListener('input', async (event) => {
  const codepostal = event.target.value;
  if (codepostal.length === 5) {
    const communes = await getCommunesBycodepostal(codepostal);
    const communeSelect = document.getElementById('communeSelect');
    communeSelect.innerHTML = '';
    communes.forEach(commune => {
      const option = document.createElement('option');
      option.value = commune.code;
      option.textContent = commune.nom;
      communeSelect.appendChild(option);
    });
  }
});

document.getElementById('postal_form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const codePostalInput = document.getElementById('code-postal');
    const communeSelect = document.getElementById('communeSelect');

    if (!codePostalInput || !communeSelect) {
        console.erreur('Éléments du formulaire non trouvés.');
        alert('Une erreur est survenue. Veuillez réessayer.');
        return;
    }

    const codePostal = codePostalInput.value;
    const selectedCommune = communeSelect.options[communeSelect.selectedIndex]?.value;

    console.log('Code postal :', codePostal);
    console.log('Commune sélectionnée :', selectedCommune);

    if (codePostal && selectedCommune) {
        const InfosMeteo = await getWeatherDataByInsee(selectedCommune);

        if (InfosMeteo) {
            const weatherSection = document.getElementById('weatherInformation');
            weatherSection.innerHTML = `
                <h2>Prévisions météo pour aujourd'hui</h2>
                <p>Température minimale : ${InfosMeteo.temperatureMin}°C</p>
                <p>Température maximale : ${InfosMeteo.temperatureMax}°C</p>
                <p>Probabilité de pluie : ${InfosMeteo.rainProbability}%</p>
                <p>Heures d'ensoleillement : ${InfosMeteo.sunHours} heures</p>
            `;
        } else {
            alert('Impossible de récupérer les données météo.');
        }
    } else {
        alert('Veuillez entrer un code postal VALIDE et sélectionner une commune.');
    }
});

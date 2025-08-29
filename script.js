const apiKey = "75a6c84abaf9e3d5fda65fc2d4c79df6"; // आपला OpenWeatherMap API Key

const units = {
  metric: { temp: "°C", speed: "m/s" },
  imperial: { temp: "°F", speed: "mph" }
};

let currentUnit = localStorage.getItem("unit") || "metric";
const form = document.getElementById('weatherForm');
const cityInput = document.getElementById('city');
const weatherDiv = document.getElementById('weatherResult');
const forecastDiv = document.getElementById('forecastResult');
const unitToggle = document.getElementById('unitToggle');
const geoBtn = document.getElementById('geoBtn');
const historyDiv = document.getElementById('history');
const darkModeToggle = document.getElementById('darkModeToggle');

// ======= Dark Mode =======
if (localStorage.getItem('darkMode') === "on") {
  document.body.classList.add('dark-mode');
  darkModeToggle.textContent = "☀️";
}
darkModeToggle.onclick = () => {
  document.body.classList.toggle('dark-mode');
  if (document.body.classList.contains('dark-mode')) {
    localStorage.setItem('darkMode', "on");
    darkModeToggle.textContent = "☀️";
  } else {
    localStorage.setItem('darkMode', "off");
    darkModeToggle.textContent = "🌙";
  }
};

// ======= UNIT TOGGLE =======
unitToggle.checked = (currentUnit === "imperial");
unitToggle.onchange = () => {
  currentUnit = unitToggle.checked ? "imperial" : "metric";
  localStorage.setItem("unit", currentUnit);
  // If weather shown, refresh it
  const lastCity = localStorage.getItem("lastCity");
  if (lastCity) getWeather(lastCity, false, true);
};

// ======= SEARCH HISTORY =======
function getHistory() {
  return JSON.parse(localStorage.getItem("cityHistory") || "[]");
}
function addHistory(city) {
  let hist = getHistory();
  hist = hist.filter(c => c.toLowerCase() !== city.toLowerCase());
  hist.unshift(city);
  if (hist.length > 5) hist = hist.slice(0, 5);
  localStorage.setItem("cityHistory", JSON.stringify(hist));
  renderHistory();
}
function renderHistory() {
  const hist = getHistory();
  if (hist.length === 0) {
    historyDiv.innerHTML = "";
    return;
  }
  historyDiv.innerHTML = `<div class="history-title">Recent cities:</div>
    <div class="history-list">
      ${hist.map(city => `<button class="history-item">${city}</button>`).join("")}
    </div>`;
  historyDiv.querySelectorAll(".history-item").forEach(btn =>
    btn.onclick = () => getWeather(btn.textContent)
  );
}
renderHistory();

// ======= GEOLOCATION =======
geoBtn.onclick = () => {
  weatherDiv.innerHTML = loadingHtml();
  forecastDiv.innerHTML = "";
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      getWeather({lat, lon});
    },
    err => {
      weatherDiv.innerHTML = `<div class="error-message">Could not access location.<br>Allow location access and try again.</div>`;
    }
  );
};

// ======= MAIN FORM =======
form.addEventListener('submit', function(event) {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) {
    weatherDiv.innerHTML = `<div class="error-message">Please enter a city name.</div>`;
    forecastDiv.innerHTML = "";
    return;
  }
  getWeather(city);
});

// ======= WEATHER FUNCTION =======
async function getWeather(cityOrCoords, fromHistory = false, refreshUnit = false) {
  weatherDiv.innerHTML = loadingHtml();
  forecastDiv.innerHTML = "";
  let url, cityKey;
  if (typeof cityOrCoords === "string") {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityOrCoords)}&appid=${apiKey}&units=${currentUnit}`;
    cityKey = cityOrCoords;
  } else {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${cityOrCoords.lat}&lon=${cityOrCoords.lon}&appid=${apiKey}&units=${currentUnit}`;
    cityKey = `${cityOrCoords.lat},${cityOrCoords.lon}`;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("City not found");
    const data = await response.json();

    // Color theme by temp
    let bgColor = "";
    let cardColor = "";
    if(data.main.temp >= (currentUnit === "metric" ? 30 : 86)) {
      bgColor = "var(--hot-bg)";
      cardColor = "var(--hot-card)";
    } else if (data.main.temp <= (currentUnit === "metric" ? 14 : 57)) {
      bgColor = "var(--cold-bg)";
      cardColor = "var(--cold-card)";
    } else {
      bgColor = "var(--main-bg)";
      cardColor = "var(--card-bg)";
    }
    document.querySelector("section").style.background = bgColor;

    const weatherHtml = `
      <div class="weather-card" style="background:${cardColor}">
        <div class="weather-desc">${data.weather[0].description}</div>
        <img class="weather-icon" src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" alt="weather icon"/>
        <div class="weather-temp">${Math.round(data.main.temp)}${units[currentUnit].temp}</div>
        <div class="weather-extra">Humidity: ${data.main.humidity}%<br>
        Wind: ${data.wind.speed} ${units[currentUnit].speed}<br>
        Location: ${data.name}, ${data.sys.country}
        </div>
      </div>
    `;
    weatherDiv.innerHTML = weatherHtml;

    // Forecast (5-day, 3-hourly data, filter for one/day)
    getForecast(data.coord.lat, data.coord.lon);

    // फॉर्म clear करा, history अपडेट करा
    if (!refreshUnit && typeof cityOrCoords === "string") {
      cityInput.value = "";
      addHistory(data.name);
      localStorage.setItem("lastCity", data.name);
    }
    if (!fromHistory && typeof cityOrCoords === "string") localStorage.setItem("lastCity", cityOrCoords);
  } catch (error) {
    weatherDiv.innerHTML = `<div class="error-message">Sorry, could not get weather for that city.<br><span style="font-size:14px;">(Try different city name.)</span></div>`;
    forecastDiv.innerHTML = "";
  }
}

// ======= FORECAST FUNCTION =======
async function getForecast(lat, lon) {
  forecastDiv.innerHTML = loadingHtml("Getting forecast...");
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    // Pick one forecast per day (12:00)
    const daily = [];
    let lastDate = "";
    for (const item of data.list) {
      const dt = new Date(item.dt * 1000);
      const dateStr = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (dt.getHours() === 12 && lastDate !== dateStr) {
        daily.push(item);
        lastDate = dateStr;
      }
      if (daily.length === 5) break;
    }
    forecastDiv.innerHTML = `
      <div class="forecast-list">
        ${daily.map(item => {
          const dt = new Date(item.dt * 1000);
          return `<div class="forecast-card">
            <div><b>${dt.toLocaleDateString(undefined, { weekday:"short" })}</b></div>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="icon"/>
            <div>${Math.round(item.main.temp)}${units[currentUnit].temp}</div>
            <div style="font-size:13px;">${item.weather[0].description}</div>
          </div>`;
        }).join("")}
      </div>
    `;
  } catch {
    forecastDiv.innerHTML = "";
  }
}

// ======= UTILS =======
function loadingHtml(msg="Loading...") {
  return `<div id="loadingSpinner">
    <div class="spinner"></div>
    <span style="margin-left:16px;font-size:16px;">${msg}</span>
  </div>`;
}

// ======= INIT: Auto-load last city =======
window.onload = function() {
  if (localStorage.getItem("lastCity")) {
    getWeather(localStorage.getItem("lastCity"), true);
  }
};
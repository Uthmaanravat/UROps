export interface WeatherForecast {
    date: string;
    temp: number;
    windSpeed: number; // in km/h
    humidity: number;
    pop: number; // probability of precipitation (0 to 1)
    description: string;
    isIdeal: boolean;
}

export async function get72HourForecast(lat: number, lon: number): Promise<WeatherForecast[]> {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (apiKey) {
        try {
            const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`OpenWeather API returned ${res.status}`);
            const data = await res.json();
            
            const list = data.list || [];
            // Filter to get midday forecasts (e.g. 12:00:00) to represent daily summaries
            const noonForecasts = list.filter((item: any) => item.dt_txt.includes("12:00:00"));
            
            const result = noonForecasts.slice(0, 3).map((item: any) => {
                const windSpeedKmH = (item.wind?.speed || 0) * 3.6;
                const pop = item.pop !== undefined ? item.pop : (item.rain ? 1 : 0);
                const humidity = item.main?.humidity || 0;
                // Ideal flight parameters: wind < 22 km/h, rain chance < 20%, humidity < 80%
                const isIdeal = windSpeedKmH < 22 && pop < 0.20 && humidity < 80;
                
                return {
                    date: item.dt_txt.split(" ")[0],
                    temp: item.main?.temp || 0,
                    windSpeed: Math.round(windSpeedKmH),
                    humidity,
                    pop,
                    description: item.weather?.[0]?.description || "clear",
                    isIdeal
                };
            });
            
            if (result.length > 0) return result;
        } catch (error) {
            console.error("Failed to fetch from OpenWeather, falling back to mock weather:", error);
        }
    }

    // Mock Weather Generator (Deterministic fallback based on coordinates & season)
    const month = new Date().getMonth();
    const isWinter = month >= 5 && month <= 7; // June, July, August in SA
    
    // Deterministic pseudo-random seed based on lat/lon
    const seed = Math.abs(Math.sin(lat + lon));
    
    const result: WeatherForecast[] = [];
    for (let day = 0; day < 3; day++) {
        const daySeed = Math.abs(Math.sin(seed + day));
        
        // Temperature range
        const temp = isWinter 
            ? 12 + Math.round(daySeed * 6)  // 12 - 18 °C
            : 20 + Math.round(daySeed * 8); // 20 - 28 °C
            
        // Rain chance
        const pop = isWinter
            ? (daySeed > 0.4 ? 0.5 + daySeed * 0.4 : 0.0) // 50-90% chance or 0%
            : (daySeed > 0.85 ? 0.3 : 0.0);
            
        // Wind speed (km/h)
        const windSpeed = isWinter
            ? 8 + Math.round(daySeed * 22)  // 8 - 30 km/h
            : 12 + Math.round(daySeed * 33); // 12 - 45 km/h
            
        // Humidity (%)
        const humidity = isWinter
            ? 70 + Math.round(daySeed * 25)
            : 45 + Math.round(daySeed * 30);

        const isIdeal = windSpeed < 22 && pop < 0.20 && humidity < 80;
        
        let description = "Clear sky";
        if (pop > 0.5) description = "Heavy rain";
        else if (pop > 0.1) description = "Light showers";
        else if (windSpeed > 28) description = "Strong winds";
        else if (humidity > 85) description = "Mist/Fog";

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + day);

        result.push({
            date: futureDate.toISOString().split("T")[0],
            temp,
            windSpeed,
            humidity,
            pop,
            description,
            isIdeal
        });
    }
    
    return result;
}

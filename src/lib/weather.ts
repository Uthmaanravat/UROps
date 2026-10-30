export interface WeatherForecast {
    date: string;
    temp: number;
    windSpeed: number; // in km/h
    windGusts?: number; // in km/h
    rainMm?: number; // mm
    humidity: number;
    pop: number; // probability of precipitation (0 to 1)
    description: string;
    isIdeal: boolean;
}

export interface FlightWeatherLimits {
    weatherLimitsConfigured?: boolean | null;
    sprayDriftWarnKmh?: number | null;
    windWarnKmh?: number | null;
    windLimitKmh?: number | null;
    gustWarnKmh?: number | null;
    gustLimitKmh?: number | null;
    rainLimitMm?: number | null;
}

export type FlightWeatherStatus = 'UNCONFIGURED' | 'FLYABLE' | 'MARGINAL' | 'NO_FLY' | 'UNAVAILABLE';

export interface SiteDayForecast {
    date: string; // YYYY-MM-DD
    windSpeedKmh: number;
    windGustsKmh: number;
    rainMm: number;
    rainProbPct: number;
    tempMaxC: number;
    latitude: number;
    longitude: number;
    locationLabel: string;
    isLiveForecast: boolean; // false if beyond 16-day Open-Meteo horizon
}

export interface EvaluatedFlightWeather {
    status: FlightWeatherStatus;
    badgeLabel: string;
    sprayDriftWarning: boolean;
    reasons: string[];
    unconfiguredNotice?: string;
    forecast: SiteDayForecast | null;
}

export const UNCONFIGURED_WEATHER_PROMPT =
    "Set limits from the JTC10 specification and ABEOD operations manual";

// Fast local coordinate lookup for Cape Town & Western Cape commercial zones (avoids unnecessary network hops)
const CAPE_TOWN_SUBURBS: Array<{ keywords: string[]; lat: number; lon: number; label: string }> = [
    { keywords: ['epping'], lat: -33.9328, lon: 18.5450, label: 'Epping, Cape Town' },
    { keywords: ['parow'], lat: -33.9068, lon: 18.5808, label: 'Parow, Cape Town' },
    { keywords: ['century city'], lat: -33.8927, lon: 18.5117, label: 'Century City, Cape Town' },
    { keywords: ['waterfront', 'v&a', 'silo'], lat: -33.9036, lon: 18.4205, label: 'V&A Waterfront, Cape Town' },
    { keywords: ['foreshore', 'christiaan barnard', 'heerengracht', 'hans strijdom', 'rockefeller'], lat: -33.9175, lon: 18.4285, label: 'Foreshore, Cape Town' },
    { keywords: ['sea point', 'beach road'], lat: -33.9169, lon: 18.3875, label: 'Sea Point, Cape Town' },
    { keywords: ['green point'], lat: -33.9069, lon: 18.4063, label: 'Green Point, Cape Town' },
    { keywords: ['claremont', 'newlands'], lat: -33.9806, lon: 18.4650, label: 'Claremont, Cape Town' },
    { keywords: ['bellville', 'tygervalley', 'tyger valley'], lat: -33.8744, lon: 18.6331, label: 'Tygervalley / Bellville' },
    { keywords: ['durbanville'], lat: -33.8316, lon: 18.6479, label: 'Durbanville, Cape Town' },
    { keywords: ['montague gardens'], lat: -33.8722, lon: 18.5236, label: 'Montague Gardens, Cape Town' },
    { keywords: ['paarden eiland'], lat: -33.9136, lon: 18.4694, label: 'Paarden Eiland, Cape Town' },
    { keywords: ['milnerton', 'table view', 'blouberg'], lat: -33.8256, lon: 18.4900, label: 'Table View / Milnerton' },
    { keywords: ['atlantis'], lat: -33.5667, lon: 18.4833, label: 'Atlantis, Western Cape' },
    { keywords: ['simon', 'simons town'], lat: -34.1933, lon: 18.4350, label: "Simon's Town" },
    { keywords: ['somerset west'], lat: -34.0757, lon: 18.8433, label: 'Somerset West' },
    { keywords: ['stellenbosch'], lat: -33.9321, lon: 18.8602, label: 'Stellenbosch' },
    { keywords: ['paarl'], lat: -33.7342, lon: 18.9621, label: 'Paarl' },
    { keywords: ['woodstock', 'salt river', 'observatory'], lat: -33.9275, lon: 18.4522, label: 'Woodstock / Salt River' },
    { keywords: ['gardens', 'bree street', 'loop street', 'long street', 'cbd'], lat: -33.9249, lon: 18.4241, label: 'Cape Town CBD' },
];

export async function resolveSiteCoordinates(
    addressOrSite?: string | null,
    cachedCoords?: { lat?: number; lon?: number; label?: string } | null
): Promise<{ lat: number; lon: number; label: string }> {
    if (cachedCoords && typeof cachedCoords.lat === 'number' && typeof cachedCoords.lon === 'number') {
        return {
            lat: cachedCoords.lat,
            lon: cachedCoords.lon,
            label: cachedCoords.label || addressOrSite || 'Cape Town'
        };
    }

    const raw = (addressOrSite || '').trim();
    const lower = raw.toLowerCase();

    for (const sub of CAPE_TOWN_SUBURBS) {
        if (sub.keywords.some(k => lower.includes(k))) {
            return { lat: sub.lat, lon: sub.lon, label: sub.label };
        }
    }

    // Try Open-Meteo free Geocoding API if a specific place name is provided
    if (raw.length >= 3) {
        try {
            // Extract likely suburb/city token
            const cleaned = raw.replace(/[0-9]+/g, ' ').split(',')[0].trim();
            if (cleaned.length >= 3) {
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleaned)}&count=5&language=en&format=json`;
                const res = await fetch(geoUrl, { next: { revalidate: 86400 } } as any);
                if (res.ok) {
                    const data = await res.json();
                    const zaMatch = (data.results || []).find((r: any) => r.country_code === 'ZA') || data.results?.[0];
                    if (zaMatch && typeof zaMatch.latitude === 'number') {
                        return {
                            lat: zaMatch.latitude,
                            lon: zaMatch.longitude,
                            label: `${zaMatch.name}${zaMatch.admin1 ? `, ${zaMatch.admin1}` : ''}`
                        };
                    }
                }
            }
        } catch {
            // Fallback to Cape Town default silently
        }
    }

    return { lat: -33.9249, lon: 18.4241, label: raw || 'Cape Town, ZA' };
}

/**
 * Fetches up to 16 days of daily site forecasts from Open-Meteo (free, no API key).
 */
export async function getOpenMeteoMultiDayForecast(
    lat: number,
    lon: number,
    locationLabel = 'Cape Town'
): Promise<Record<string, SiteDayForecast>> {
    const map: Record<string, SiteDayForecast> = {};
    try {
        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
            `&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max,temperature_2m_max` +
            `&wind_speed_unit=kmh&timezone=Africa%2FJohannesburg&forecast_days=16`;

        const res = await fetch(url, { next: { revalidate: 1800 } } as any);
        if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
        const data = await res.json();
        const daily = data?.daily;
        const times: string[] = daily?.time || [];

        for (let i = 0; i < times.length; i++) {
            const dateStr = times[i];
            map[dateStr] = {
                date: dateStr,
                windSpeedKmh: Math.round(Number(daily.wind_speed_10m_max?.[i] ?? 0)),
                windGustsKmh: Math.round(Number(daily.wind_gusts_10m_max?.[i] ?? 0)),
                rainMm: Math.round(Number(daily.precipitation_sum?.[i] ?? 0) * 10) / 10,
                rainProbPct: Math.round(Number(daily.precipitation_probability_max?.[i] ?? 0)),
                tempMaxC: Math.round(Number(daily.temperature_2m_max?.[i] ?? 20)),
                latitude: lat,
                longitude: lon,
                locationLabel,
                isLiveForecast: true
            };
        }
    } catch (err) {
        console.warn('Open-Meteo fetch failed, using deterministic Cape Town fallback:', err);
        const base = new Date();
        for (let d = 0; d < 16; d++) {
            const dt = new Date(base);
            dt.setDate(dt.getDate() + d);
            const dateStr = dt.toISOString().split('T')[0];
            const seed = Math.abs(Math.sin(lat * 12.3 + lon * 7.7 + d * 1.9));
            const wind = 12 + Math.round(seed * 20);
            const gusts = wind + 7 + Math.round(seed * 10);
            const rainMm = seed > 0.82 ? Math.round((seed - 0.75) * 12 * 10) / 10 : 0;
            map[dateStr] = {
                date: dateStr,
                windSpeedKmh: wind,
                windGustsKmh: gusts,
                rainMm,
                rainProbPct: rainMm > 0 ? 60 : 10,
                tempMaxC: 21,
                latitude: lat,
                longitude: lon,
                locationLabel,
                isLiveForecast: false
            };
        }
    }
    return map;
}

export async function getOpenMeteoSiteForecastForDate(
    addressOrSite: string | null | undefined,
    targetDate: Date | string | null | undefined,
    cachedCoords?: { lat?: number; lon?: number; label?: string } | null
): Promise<SiteDayForecast | null> {
    if (!targetDate) return null;
    const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    if (isNaN(d.getTime())) return null;

    const dateStr = d.toISOString().split('T')[0];
    const coords = await resolveSiteCoordinates(addressOrSite, cachedCoords);
    const allDays = await getOpenMeteoMultiDayForecast(coords.lat, coords.lon, coords.label);
    return allDays[dateStr] || null;
}

export function evaluateFlightWeatherStatus(
    forecast: SiteDayForecast | null,
    limits?: FlightWeatherLimits | null
): EvaluatedFlightWeather {
    if (!forecast) {
        return {
            status: 'UNAVAILABLE',
            badgeLabel: 'Beyond 16d range',
            sprayDriftWarning: false,
            reasons: ['Forecast available within 16 days of scheduled flight date.'],
            forecast: null
        };
    }

    const isConfigured = Boolean(
        limits?.weatherLimitsConfigured &&
        (
            limits.windLimitKmh != null ||
            limits.gustLimitKmh != null ||
            limits.windWarnKmh != null ||
            limits.gustWarnKmh != null ||
            limits.sprayDriftWarnKmh != null ||
            limits.rainLimitMm != null
        )
    );

    if (!isConfigured) {
        return {
            status: 'UNCONFIGURED',
            badgeLabel: 'Set weather limits',
            sprayDriftWarning: false,
            reasons: [UNCONFIGURED_WEATHER_PROMPT],
            unconfiguredNotice: UNCONFIGURED_WEATHER_PROMPT,
            forecast
        };
    }

    const reasons: string[] = [];
    let isRed = false;
    let isAmber = false;
    let sprayDriftWarning = false;

    // 1. Check Red (No-Fly) limits
    if (limits?.windLimitKmh != null && forecast.windSpeedKmh >= limits.windLimitKmh) {
        isRed = true;
        reasons.push(`Sustained wind ${forecast.windSpeedKmh} km/h ≥ ${limits.windLimitKmh} km/h no-fly limit`);
    }
    if (limits?.gustLimitKmh != null && forecast.windGustsKmh >= limits.gustLimitKmh) {
        isRed = true;
        reasons.push(`Gusts ${forecast.windGustsKmh} km/h ≥ ${limits.gustLimitKmh} km/h no-fly limit`);
    }
    if (limits?.rainLimitMm != null && forecast.rainMm >= limits.rainLimitMm) {
        isRed = true;
        reasons.push(`Rain ${forecast.rainMm} mm ≥ ${limits.rainLimitMm} mm limit`);
    }

    // 2. Check Spray Drift threshold (Sustained wind)
    if (limits?.sprayDriftWarnKmh != null && forecast.windSpeedKmh >= limits.sprayDriftWarnKmh) {
        sprayDriftWarning = true;
        isAmber = true;
        reasons.push(`Spray drift risk: wind ${forecast.windSpeedKmh} km/h ≥ ${limits.sprayDriftWarnKmh} km/h drift threshold`);
    }

    // 3. Check Amber (Marginal) aircraft limits
    if (!isRed) {
        if (limits?.windWarnKmh != null && forecast.windSpeedKmh >= limits.windWarnKmh) {
            isAmber = true;
            reasons.push(`Marginal wind ${forecast.windSpeedKmh} km/h ≥ ${limits.windWarnKmh} km/h warning`);
        }
        if (limits?.gustWarnKmh != null && forecast.windGustsKmh >= limits.gustWarnKmh) {
            isAmber = true;
            reasons.push(`Marginal gusts ${forecast.windGustsKmh} km/h ≥ ${limits.gustWarnKmh} km/h warning`);
        }
        if (forecast.rainMm > 0 && (limits?.rainLimitMm == null || forecast.rainMm < limits.rainLimitMm)) {
            isAmber = true;
            reasons.push(`Light rain forecast (${forecast.rainMm} mm)`);
        }
    }

    if (isRed) {
        return {
            status: 'NO_FLY',
            badgeLabel: 'No-Fly',
            sprayDriftWarning,
            reasons,
            forecast
        };
    }

    if (isAmber) {
        return {
            status: 'MARGINAL',
            badgeLabel: sprayDriftWarning && reasons.length === 1 ? 'Marginal (Spray Drift)' : 'Marginal',
            sprayDriftWarning,
            reasons,
            forecast
        };
    }

    return {
        status: 'FLYABLE',
        badgeLabel: 'Flyable',
        sprayDriftWarning: false,
        reasons: ['Within JTC10 & ABEOD weather limits'],
        forecast
    };
}

/**
 * Suggests the next available date after `fromDate` that has no scheduling conflict
 * and is not Red (NO_FLY) according to Open-Meteo.
 */
export async function suggestNextAvailableJobDate(params: {
    fromDate: Date;
    busyDateStrings: string[]; // YYYY-MM-DD
    addressOrSite?: string | null;
    limits?: FlightWeatherLimits | null;
}): Promise<{ suggestedDate: string; evaluated: EvaluatedFlightWeather }> {
    const busySet = new Set(params.busyDateStrings);
    const coords = await resolveSiteCoordinates(params.addressOrSite);
    const multiDay = await getOpenMeteoMultiDayForecast(coords.lat, coords.lon, coords.label);

    let fallbackCandidate: { suggestedDate: string; evaluated: EvaluatedFlightWeather } | null = null;

    for (let offset = 1; offset <= 14; offset++) {
        const candidate = new Date(params.fromDate);
        candidate.setDate(candidate.getDate() + offset);
        // Skip Sundays by default for standard commercial operations
        if (candidate.getDay() === 0) continue;

        const dateStr = candidate.toISOString().split('T')[0];
        if (busySet.has(dateStr)) continue;

        const forecast = multiDay[dateStr] || null;
        const evaluated = evaluateFlightWeatherStatus(forecast, params.limits);

        if (!fallbackCandidate) {
            fallbackCandidate = { suggestedDate: dateStr, evaluated };
        }

        if (evaluated.status !== 'NO_FLY') {
            return { suggestedDate: dateStr, evaluated };
        }
    }

    if (fallbackCandidate) return fallbackCandidate;

    const tomorrow = new Date(params.fromDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    return {
        suggestedDate: dateStr,
        evaluated: evaluateFlightWeatherStatus(multiDay[dateStr] || null, params.limits)
    };
}

/**
 * Legacy 72-hour forecast helper preserved for Lead Outreach & DroneDashboardClient compatibility.
 */
export async function get72HourForecast(lat: number, lon: number): Promise<WeatherForecast[]> {
    const multiDay = await getOpenMeteoMultiDayForecast(lat, lon, 'Site');
    const days = Object.values(multiDay).slice(0, 3);
    return days.map(d => ({
        date: d.date,
        temp: d.tempMaxC,
        windSpeed: d.windSpeedKmh,
        windGusts: d.windGustsKmh,
        rainMm: d.rainMm,
        humidity: 60,
        pop: d.rainProbPct / 100,
        description: d.rainMm > 1 ? 'Rain showers' : d.windGustsKmh > 30 ? 'Gusty winds' : 'Clear / flyable',
        isIdeal: d.windSpeedKmh < 22 && d.rainMm < 0.5
    }));
}

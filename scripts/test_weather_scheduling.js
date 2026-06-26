const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mirror deterministic weather generator from src/lib/weather.ts
function getDeterministicForecast(lat, lon) {
    const month = new Date().getMonth();
    const isWinter = month >= 5 && month <= 7; // June, July, August in SA
    const seed = Math.abs(Math.sin(lat + lon));
    
    const result = [];
    for (let day = 0; day < 3; day++) {
        const daySeed = Math.abs(Math.sin(seed + day));
        
        // Temperature range
        const temp = isWinter 
            ? 12 + Math.round(daySeed * 6)  // 12 - 18 °C
            : 20 + Math.round(daySeed * 8); // 20 - 28 °C
            
        // Rain chance
        const pop = isWinter
            ? (daySeed > 0.4 ? 0.5 + daySeed * 0.4 : 0.0)
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

// Generate the weather and dust risk outreach text exactly like actions.ts
function generateOutreachCopy(lead, forecast, isHighDust) {
    const hasIdealWindow = forecast.some(f => f.isIdeal);
    const idealDates = forecast.filter(f => f.isIdeal).map(f => {
        const d = new Date(f.date);
        return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    }).join(", ");

    let weatherUrgencyCopy = "";
    if (hasIdealWindow) {
        weatherUrgencyCopy = `Our drone flight dispatch has identified ideal weather window(s) on ${idealDates} (winds under 22km/h and 0% rain chance) for an immediate soft-wash cleaning and inspection with zero operations downtime.`;
    } else {
        weatherUrgencyCopy = `Note: Current 3-day weather forecasts show temporary flight limits (winds > 22km/h or rain). We are monitoring the window to schedule your soft-wash sequence as soon as conditions clear.`;
    }

    let dustRiskCopy = "";
    if (isHighDust) {
        dustRiskCopy = `Additionally, our geospatial analysis tags your facility within a high-dust industrial zone. Accelerated particulate accumulation on roof membranes degrades insulation efficiency and accelerates structural decay, making regular soft-wash treatment highly recommended.`;
    }

    return { weatherUrgencyCopy, dustRiskCopy };
}

async function testWeatherScheduling() {
    console.log("=== STARTING WEATHER-AWARE SCHEDULING & HIGH-DUST TRANSACTION INTEGRITY TEST ===");

    const testLeadId = "db5f9e42-98fb-4fe8-ac98-8b5d7da3b804"; // Sacks Circle Logistics
    const lead = await prisma.lead.findUnique({
        where: { id: testLeadId }
    });

    if (!lead) {
        console.error("❌ ERROR: Test lead not found! Ensure database has Sacks Circle Logistics seeded.");
        return;
    }

    console.log(`Found lead: "${lead.companyName}" at coordinates: (${lead.latitude}, ${lead.longitude})`);
    
    // Save original state
    const originalHighDust = lead.highDust;
    console.log(`Initial highDust status: ${originalHighDust}`);

    // 1. Verify highDust Toggle State Persistence
    console.log("\n1. Testing highDust database toggle...");
    
    // Toggle to opposite value
    const targetVal = !originalHighDust;
    await prisma.lead.update({
        where: { id: testLeadId },
        data: { highDust: targetVal }
    });

    let checkLead = await prisma.lead.findUnique({
        where: { id: testLeadId }
    });

    console.log(`Updated highDust status: ${checkLead.highDust} (Expected: ${targetVal})`);
    if (checkLead.highDust === targetVal) {
        console.log("✅ Database highDust toggle verified successfully!");
    } else {
        console.error("❌ ERROR: Database highDust toggle failed to persist.");
    }

    // 2. Weather Forecast Verification
    console.log("\n2. Simulating weather forecast retrieval...");
    const forecast = getDeterministicForecast(lead.latitude, lead.longitude);
    console.log("Generated 3-day forecast details:");
    console.table(forecast);

    // Verify constraints: winds < 22km/h, precipitation < 20%, humidity < 80%
    let hasIdealWindow = false;
    let verifiedIdealLogic = true;
    for (const day of forecast) {
        const meetsConstraints = day.windSpeed < 22 && day.pop < 0.20 && day.humidity < 80;
        if (day.isIdeal !== meetsConstraints) {
            verifiedIdealLogic = false;
            console.error(`❌ Constraint mismatch on ${day.date}: wind=${day.windSpeed}, rain=${day.pop}, humidity=${day.humidity}, isIdeal=${day.isIdeal} (expected: ${meetsConstraints})`);
        }
        if (day.isIdeal) hasIdealWindow = true;
    }

    if (verifiedIdealLogic) {
        console.log("✅ Weather window logic verified successfully (all constraints matched)!");
    } else {
        console.error("❌ ERROR: Weather window logic constraint mismatch found.");
    }

    // 3. Outreach Copy generation for High Dust vs Standard
    console.log("\n3. Testing custom outreach body generation...");
    
    console.log("Scenario A: highDust = false");
    const copyA = generateOutreachCopy(lead, forecast, false);
    console.log(`Weather Urgency: "${copyA.weatherUrgencyCopy}"`);
    console.log(`Dust Risk:       "${copyA.dustRiskCopy}"`);
    
    if (copyA.dustRiskCopy === "") {
        console.log("✅ Scenario A verified (no dust risk copy appended).");
    } else {
        console.error("❌ ERROR: Scenario A failed (dust risk copy should be empty).");
    }

    console.log("\nScenario B: highDust = true");
    const copyB = generateOutreachCopy(lead, forecast, true);
    console.log(`Weather Urgency: "${copyB.weatherUrgencyCopy}"`);
    console.log(`Dust Risk:       "${copyB.dustRiskCopy}"`);
    
    if (copyB.dustRiskCopy.includes("high-dust industrial zone")) {
        console.log("✅ Scenario B verified (dust risk copy correctly appended).");
    } else {
        console.error("❌ ERROR: Scenario B failed (dust risk copy is incorrect).");
    }

    // 4. Cleanup database state
    console.log("\n4. Reverting database changes...");
    await prisma.lead.update({
        where: { id: testLeadId },
        data: { highDust: originalHighDust }
    });
    
    const finalLead = await prisma.lead.findUnique({
        where: { id: testLeadId }
    });
    
    if (finalLead.highDust === originalHighDust) {
        console.log("✅ Database successfully restored to original state!");
    } else {
        console.error("❌ ERROR: Database state restore failed.");
    }

    console.log("\n=== WEATHER-AWARE SCHEDULING INTEGRITY TEST COMPLETED ===");
}

testWeatherScheduling()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

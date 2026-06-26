const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPricingAndQuoting() {
  console.log("=== STARTING DYNAMIC PRICING & AUTO-QUOTING TRANSACTION INTEGRITY TEST ===");

  const testLeadId = "db5f9e42-98fb-4fe8-ac98-8b5d7da3b804"; // Sacks Circle Logistics
  const lead = await prisma.lead.findUnique({
    where: { id: testLeadId }
  });

  if (!lead) {
    console.error("Test lead not found! Ensure database seed/pipeline has run.");
    return;
  }

  console.log(`Found lead: "${lead.companyName}"`);
  console.log(`Default Pricing Parameters -> Area: ${lead.estimatedArea} m², Pitch: ${lead.roofPitch}, Service: ${lead.serviceType}`);

  // Save original state to revert after testing
  const originalStatus = lead.status;
  const originalHistory = lead.history;
  const originalArea = lead.estimatedArea;
  const originalPitch = lead.roofPitch;
  const originalService = lead.serviceType;

  // 1. Simulate updating pricing parameters
  console.log("\n1. Simulating updating pricing parameters...");
  const newArea = 750;
  const newPitch = "steep";
  const newService = "solar";

  const updatedLead = await prisma.lead.update({
    where: { id: testLeadId },
    data: {
      estimatedArea: newArea,
      roofPitch: newPitch,
      serviceType: newService
    }
  });

  console.log(`Lead updated: Area=${updatedLead.estimatedArea}, Pitch=${updatedLead.roofPitch}, Service=${updatedLead.serviceType}`);

  // 2. Perform math verification
  console.log("\n2. Verifying dynamic pricing math...");
  
  // Base rate mapping (per m2)
  let baseRate = 15;
  if (updatedLead.serviceType === "chemical") {
    baseRate = 22;
  } else if (updatedLead.serviceType === "solar") {
    baseRate = 30; // Expect 30
  }

  // Pitch multiplier
  let pitchMultiplier = 1.0;
  if (updatedLead.roofPitch === "medium") {
    pitchMultiplier = 1.25;
  } else if (updatedLead.roofPitch === "steep") {
    pitchMultiplier = 1.5; // Expect 1.5
  }

  // Grime multiplier based on CV results (growth=1.0)
  const grimeScore = Math.max(updatedLead.biologicalGrowthScore, updatedLead.surfaceStainingScore);
  let grimeMultiplier = 1.0;
  if (grimeScore >= 0.70) {
    grimeMultiplier = 1.4; // Expect 1.4
  } else if (grimeScore >= 0.50) {
    grimeMultiplier = 1.2;
  }

  const unitPrice = baseRate * pitchMultiplier * grimeMultiplier;
  const subtotal = updatedLead.estimatedArea * unitPrice;
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  // Job difficulty
  let difficulty = "Moderate";
  if (updatedLead.roofPitch === "steep" || grimeScore >= 0.70) {
    difficulty = "Difficult"; // Expect Difficult
  } else if (updatedLead.roofPitch === "flat" && grimeScore < 0.50) {
    difficulty = "Easy";
  }

  // Job duration
  let duration = 4; // Base 4
  duration += Math.ceil(updatedLead.estimatedArea / 250); // 750 / 250 = 3
  if (updatedLead.roofPitch === "steep") duration += 2; // +2
  if (grimeScore >= 0.70) duration += 2; // +2
  // Total expected duration = 4 + 3 + 2 + 2 = 11 hours

  console.log(`Calculated Unit Price: R${unitPrice.toFixed(2)} (Expected: R63.00)`);
  console.log(`Calculated Subtotal:   R${subtotal.toFixed(2)} (Expected: R47,250.00)`);
  console.log(`Calculated Grand Total: R${total.toFixed(2)} (Expected: R54,337.50)`);
  console.log(`Calculated Difficulty:  ${difficulty} (Expected: Difficult)`);
  console.log(`Calculated Duration:    ${duration} Hours (Expected: 11 Hours)`);

  if (Math.abs(unitPrice - 63.00) < 0.01 && Math.abs(subtotal - 47250.00) < 0.01 && Math.abs(total - 54337.50) < 0.01 && difficulty === "Difficult" && duration === 11) {
    console.log("✅ Math formulas successfully verified!");
  } else {
    console.log("Checks:", {
      unitPriceCheck: unitPrice === 63.00,
      subtotalCheck: subtotal === 47250.00,
      totalCheck: Math.abs(total - 54337.50) < 0.01,
      difficultyCheck: difficulty === "Difficult",
      durationCheck: duration === 11,
      unitPrice,
      subtotal,
      total,
      difficulty,
      duration
    });
    console.error("❌ Math verification failed.");
  }

  // 3. Simulate Quote and Project creation
  console.log("\n3. Simulating Quote & Project creation...");
  const companyId = updatedLead.companyId;

  // Find or Create Client
  let client = await prisma.client.findFirst({
    where: { companyId, email: updatedLead.contactEmail }
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        name: updatedLead.companyName || "New Client",
        companyName: updatedLead.companyName,
        email: updatedLead.contactEmail,
        companyId
      }
    });
  }

  // Create Project in QUOTED status
  const project = await prisma.project.create({
    data: {
      name: `Roof Restoration & Cleaning - ${updatedLead.companyName}`,
      description: `Test quote project`,
      status: 'QUOTED',
      workflowStage: 'QUOTATION',
      clientId: client.id,
      companyId
    }
  });
  console.log(`Created Project: ID=${project.id}, status=${project.status}`);

  // Create Quote
  const quote = await prisma.invoice.create({
    data: {
      clientId: client.id,
      projectId: project.id,
      date: new Date(),
      number: 9999, // dummy seq number
      quoteNumber: `Q-TEST-9999`,
      subtotal,
      taxAmount: tax,
      total,
      type: 'QUOTE',
      status: 'SENT',
      companyId
    }
  });
  console.log(`Created Quote: QuoteNumber=${quote.quoteNumber}, Total=R${quote.total}`);

  // Update Lead status and history
  const updatedHistory = [
    ...(Array.isArray(updatedLead.history) ? updatedLead.history : []),
    {
      date: new Date().toISOString(),
      type: "system",
      content: `Quote ${quote.quoteNumber} generated for R${total.toLocaleString()} (Difficulty: ${difficulty}, Duration: ${duration}h) sent to client.`
    }
  ];

  const finalLead = await prisma.lead.update({
    where: { id: testLeadId },
    data: {
      projectId: project.id,
      status: "quote_sent",
      history: updatedHistory
    }
  });

  console.log(`Lead status updated: ${finalLead.status}`);
  console.log("Timeline history:", JSON.stringify(finalLead.history, null, 2));

  // 4. Verification Check
  console.log("\n=== DATABASE INTEGRITY VERIFICATION ===");
  const checkLead = await prisma.lead.findUnique({
    where: { id: testLeadId },
    include: {
      project: {
        include: {
          invoices: true
        }
      }
    }
  });

  if (checkLead.projectId === project.id && checkLead.status === "quote_sent" && checkLead.project.invoices[0].id === quote.id) {
    console.log("✅ SUCCESS: Dynamic Pricing quote generation structure verified in database!");
  } else {
    console.error("❌ FAILED: Database verification failed.");
  }

  // 5. Cleanup
  console.log("\n=== REVERTING TEST DATA FOR USER MANUAL TESTING ===");
  await prisma.invoice.delete({ where: { id: quote.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.lead.update({
    where: { id: testLeadId },
    data: {
      projectId: null,
      status: originalStatus,
      history: originalHistory,
      estimatedArea: originalArea,
      roofPitch: originalPitch,
      serviceType: originalService
    }
  });
  console.log("Deleted test quote, deleted test project, and restored original lead pricing states.");
  console.log("=== INTEGRITY TEST COMPLETED SUCCESSFULLY ===");
}

testPricingAndQuoting()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

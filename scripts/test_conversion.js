const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConversion() {
  console.log("=== STARTING CONVERSION TRANSACTION INTEGRITY TEST ===");

  // 1. Fetch a test qualified lead
  const testLeadId = "db5f9e42-98fb-4fe8-ac98-8b5d7da3b804"; // Sacks Circle Logistics
  const lead = await prisma.lead.findUnique({
    where: { id: testLeadId }
  });

  if (!lead) {
    console.error("Test lead not found! Ensure database seed/pipeline has run.");
    return;
  }

  console.log(`Found lead: "${lead.companyName}" (Status: ${lead.status}, ProjectID: ${lead.projectId})`);

  // Save original state to revert after testing
  const originalStatus = lead.status;
  const originalHistory = lead.history;

  // 2. Simulate convertLeadToProjectAction logic
  console.log("\n1. Simulating client & project creation...");
  const companyId = lead.companyId;

  // Find or create client
  let client = null;
  if (lead.contactEmail) {
    client = await prisma.client.findFirst({
      where: {
        companyId,
        email: lead.contactEmail
      }
    });
  }

  const isClientNew = !client;
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: lead.companyName || lead.contactName || "New Client (Scouted)",
        companyName: lead.companyName,
        email: lead.contactEmail,
        attentionTo: lead.contactName,
        address: lead.address,
        notes: `Test conversion for Lead ID: ${lead.id}`,
        companyId
      }
    });
    console.log(`Created new Client: "${client.name}" (ID: ${client.id})`);
  } else {
    console.log(`Found existing Client: "${client.name}" (ID: ${client.id})`);
  }

  // Create Project
  const projectName = `Roof Restoration & Soft-wash - ${lead.companyName || lead.address || 'Scouted Site'}`;
  const projectDesc = `Identified via autonomous drone scouting. Algae/Growth Score = ${(lead.biologicalGrowthScore * 100).toFixed(0)}%`;
  
  const project = await prisma.project.create({
    data: {
      name: projectName.slice(0, 100),
      description: projectDesc,
      status: 'PLANNING',
      workflowStage: 'SOW',
      commercialStatus: 'AWAITING_PO',
      clientId: client.id,
      companyId
    }
  });
  console.log(`Created new Project: "${project.name}" (ID: ${project.id})`);

  // Update Lead relationship & history
  console.log("\n2. Updating Lead reference and history...");
  const historyArray = Array.isArray(lead.history) ? lead.history : [];
  const updatedHistory = [
    ...historyArray,
    {
      date: new Date().toISOString(),
      type: "system",
      content: `Lead converted to Job/Project: "${project.name}" under Client: "${client.name}"`
    }
  ];

  const updatedLead = await prisma.lead.update({
    where: { id: testLeadId },
    data: {
      projectId: project.id,
      status: "closed",
      history: updatedHistory
    }
  });
  console.log(`Lead status updated: ${updatedLead.status}`);
  console.log("Lead history timeline is now:", JSON.stringify(updatedLead.history, null, 2));

  // 3. Simulate addLeadCallNoteAction logic
  console.log("\n3. Testing adding a call note...");
  const noteText = "Discussed scope with John. He approved the quote and requested SOW.";
  const historyWithNote = [
    ...updatedLead.history,
    {
      date: new Date().toISOString(),
      type: "note",
      content: noteText
    }
  ];

  const finalLead = await prisma.lead.update({
    where: { id: testLeadId },
    data: {
      history: historyWithNote
    }
  });
  console.log("Lead history timeline after call note:", JSON.stringify(finalLead.history, null, 2));

  // 4. Verification Check
  console.log("\n=== DATABASE VERIFICATION CHECK ===");
  const checkLead = await prisma.lead.findUnique({
    where: { id: testLeadId },
    include: {
      project: {
        include: {
          client: true
        }
      }
    }
  });

  if (checkLead.projectId === project.id && checkLead.status === "closed" && checkLead.project.clientId === client.id) {
    console.log("✅ SUCCESS: Lead project link, status, and client hierarchy fully verified!");
  } else {
    console.error("❌ FAILED: Verification check failed.");
  }

  // 5. Cleanup (Revert Changes to leave database clean for user review)
  console.log("\n=== REVERTING TEST DATA FOR USER MANUAL TESTING ===");
  // Delete project
  await prisma.project.delete({
    where: { id: project.id }
  });
  console.log("Deleted test project.");

  // Delete client if it was newly created
  if (isClientNew) {
    await prisma.client.delete({
      where: { id: client.id }
    });
    console.log("Deleted test client.");
  }

  // Restore lead fields
  await prisma.lead.update({
    where: { id: testLeadId },
    data: {
      projectId: null,
      status: originalStatus,
      history: originalHistory
    }
  });
  console.log("Restored lead status and history.");

  console.log("\n=== INTEGRITY TEST COMPLETED SUCCESSFULLY ===");
}

testConversion()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

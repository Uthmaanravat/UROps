const fs = require('fs');
const path = require('path');
const jsPDF = require('jspdf').jsPDF;

async function testPdf() {
  console.log('Testing PDF setup with jsPDF in Node...');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.rect(0, 0, 210, 36, 'F');
  console.log('jsPDF works in Node!');
}

testPdf().catch(console.error);

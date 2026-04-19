const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };

const CHECKBOX_GROUPS = {
  supplies: [
    ["None", "supplyNone"],
    ["Briefs", "supplyBriefs"],
    ["Pads", "supplyPads"],
    ["Catheter (monitor only, no care beyond scope)", "supplyCatheter"]
  ],
  tasks: [
    ["Laundry", "taskLaundry"],
    ["Dishes", "taskDishes"],
    ["Trash Removal", "taskTrash"],
    ["Cleaning Client Areas", "taskCleaningAreas"]
  ],
  behaviors: [
    ["None", "behaviorNone"],
    ["Agitation", "behaviorAgitation"],
    ["Wandering", "behaviorWandering"],
    ["Resistance to Care", "behaviorResistance"]
  ],
  sensory: [
    ["None", "sensoryNone"],
    ["Hearing Impairment", "hearingImpairment"],
    ["Vision Impairment", "visionImpairment"]
  ],
  risks: [
    ["Fall Hazards", "riskFallHazards"],
    ["Clutter", "riskClutter"],
    ["Pets", "riskPets"],
    ["Smoking in Home", "riskSmoking"],
    ["Unsafe Equipment", "riskUnsafeEquipment"],
    ["Poor Lighting", "riskPoorLighting"]
  ],
  services: [
    ["Personal Care Assistance", "recommendPersonalCare"],
    ["Mobility / Transfers", "recommendMobilityTransfers"],
    ["Toileting Support", "recommendToileting"],
    ["Meal Preparation", "recommendMealPreparation"],
    ["Housekeeping", "recommendHousekeeping"],
    ["Supervision / Safety Monitoring", "recommendSupervision"]
  ]
};

function normalizeText(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value || "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim();
}

function escapePdfText(value) {
  return normalizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " ");
}

function escapeHtml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapText(value, maxChars) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = next;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function value(data, key) {
  return normalizeText(data[key]);
}

function selectedList(data, fields) {
  return fields.filter(([, key]) => data[key] === true || value(data, key) === "on").map(([label]) => label);
}

function pdfFileName(assessment) {
  const safeName = value(assessment, "clientName").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `${safeName || "Client"}_Client_Assessment.pdf`;
}

function createPdfContext() {
  const pages = [];
  let stream = [];
  let y = 732;

  function push(command) { stream.push(command); }
  function addPage() { pages.push(stream); stream = []; y = 732; }
  function ensure(spaceNeeded) { if (y - spaceNeeded < PAGE.margin) addPage(); }
  function text(textValue, x, yPos, size = 9, font = FONT.body, color = 0) {
    push(`${color} g BT /${font} ${size} Tf ${x} ${yPos} Td (${escapePdfText(textValue)}) Tj ET`);
  }
  function line(x1, y1, x2, y2, width = 0.7) { push(`0 G ${width} w ${x1} ${y1} m ${x2} ${y2} l S`); }
  function rect(x, yPos, width, height) { push(`0 G 0.7 w ${x} ${yPos} ${width} ${height} re S`); }
  function fillRect(x, yPos, width, height) { push(`0 g ${x} ${yPos} ${width} ${height} re f`); }

  function title() {
    text("Community Regenerative Solutions", 132, 748, 18, FONT.bold);
    text("Initial Assessment (CRS-CL02)", 190, 724, 15, FONT.bold);
    line(PAGE.margin, 710, PAGE.width - PAGE.margin, 710, 1);
    y = 690;
  }

  function section(titleText) {
    ensure(34);
    fillRect(PAGE.margin, y - 4, PAGE.width - PAGE.margin * 2, 18);
    text(titleText.toUpperCase(), PAGE.margin + 7, y + 1, 10, FONT.bold, 1);
    y -= 26;
  }

  function field(label, fieldValue, x, width, options = {}) {
    const lineY = y - 18;
    text(label, x, y, options.labelSize || 7, FONT.bold);
    line(x, lineY, x + width, lineY);
    wrapText(fieldValue, Math.max(12, Math.floor(width / 5.2))).slice(0, options.maxLines || 2).forEach((part, index) => {
      text(part, x + 2, lineY + 4 - index * 10, options.valueSize || 9);
    });
  }

  function fieldRow(fields, height = 36) {
    ensure(height + 4);
    const gap = 12;
    const width = (PAGE.width - PAGE.margin * 2 - gap * (fields.length - 1)) / fields.length;
    fields.forEach(([label, fieldValue], index) => field(label, fieldValue, PAGE.margin + index * (width + gap), width));
    y -= height;
  }

  function fullField(label, fieldValue, height = 44) {
    if (!normalizeText(fieldValue)) return;
    ensure(height + 4);
    field(label, fieldValue, PAGE.margin, PAGE.width - PAGE.margin * 2, { maxLines: 4 });
    y -= height;
  }

  function paragraph(textValue) {
    const lines = wrapText(textValue, 95);
    ensure(lines.length * 11 + 10);
    lines.forEach((lineText) => {
      text(lineText, PAGE.margin, y, 9);
      y -= 11;
    });
    y -= 8;
  }

  function table(headers, rows, columnWidths) {
    if (!rows.length) return;
    const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0);
    const rowHeight = 25;
    const startX = PAGE.margin;
    ensure(rowHeight * (rows.length + 1) + 8);
    rect(startX, y - rowHeight, totalWidth, rowHeight);
    let x = startX;
    headers.forEach((header, index) => {
      if (index > 0) line(x, y, x, y - rowHeight);
      text(header, x + 4, y - 15, 8, FONT.bold);
      x += columnWidths[index];
    });
    y -= rowHeight;
    rows.forEach((row) => {
      ensure(rowHeight + 4);
      rect(startX, y - rowHeight, totalWidth, rowHeight);
      x = startX;
      row.forEach((cell, index) => {
        if (index > 0) line(x, y, x, y - rowHeight);
        wrapText(cell, Math.floor((columnWidths[index] - 8) / 5.2)).slice(0, 2).forEach((part, lineIndex) => {
          text(part, x + 4, y - 11 - lineIndex * 9, 8);
        });
        x += columnWidths[index];
      });
      y -= rowHeight;
    });
    y -= 12;
  }

  function finish() { pages.push(stream); return pages; }
  return { title, section, fieldRow, fullField, paragraph, table, finish };
}

function buildPdfPages(assessment) {
  const pdf = createPdfContext();
  pdf.title();
  pdf.section("Client Identification");
  pdf.fieldRow([["Client Name", value(assessment, "clientName")], ["Date of Assessment", value(assessment, "assessmentDate")]]);
  pdf.fieldRow([["Assessor Name", value(assessment, "assessorName")]]);
  pdf.fullField("Service Address", value(assessment, "serviceAddress"), 48);

  pdf.section("General Condition");
  pdf.fullField("Primary Conditions / Diagnoses", value(assessment, "primaryConditions"), 52);
  pdf.fieldRow([["Overall Physical Condition", value(assessment, "overallCondition")]]);
  pdf.fullField("General Observations", value(assessment, "generalObservations"), 52);

  pdf.section("Mobility & Transfers");
  pdf.table(["Area", "Status"], [["Mobility Status", value(assessment, "mobilityStatus")], ["Transfers", value(assessment, "transfersStatus")], ["Fall Risk", value(assessment, "fallRisk")]], [210, 320]);
  pdf.fullField("Notes", value(assessment, "mobilityNotes"), 52);

  pdf.section("Bathing & Personal Hygiene");
  pdf.table(["Area", "Status"], [["Bathing Ability", value(assessment, "bathingAbility")], ["Grooming", value(assessment, "groomingStatus")], ["Skin Condition Concerns", value(assessment, "skinConcerns")]], [210, 320]);
  pdf.fullField("Notes", value(assessment, "hygieneNotes"), 52);

  pdf.section("Dressing");
  pdf.fieldRow([["Dressing Ability", value(assessment, "dressingAbility")]]);
  pdf.fullField("Clothing Needs / Limitations", value(assessment, "clothingNeeds"), 52);

  pdf.section("Toileting & Continence");
  pdf.table(["Area", "Status"], [["Toileting Ability", value(assessment, "toiletingAbility")], ["Continence Status", value(assessment, "continenceStatus")], ["Use of Supplies", selectedList(assessment, CHECKBOX_GROUPS.supplies).join(", ")]], [210, 320]);
  pdf.fullField("Notes", value(assessment, "toiletingNotes"), 52);

  pdf.section("Nutrition & Meal Preparation");
  pdf.table(["Area", "Status"], [["Meal Preparation Needs", value(assessment, "mealPrepNeeds")], ["Feeding Ability", value(assessment, "feedingAbility")], ["Appetite Concerns", value(assessment, "appetiteConcerns")]], [210, 320]);
  pdf.fullField("Dietary Restrictions", value(assessment, "dietaryRestrictions"), 52);
  pdf.fullField("Notes", value(assessment, "nutritionNotes"), 52);

  pdf.section("Housekeeping Needs");
  pdf.fieldRow([["Light Housekeeping", value(assessment, "lightHousekeeping")]]);
  pdf.fullField("Tasks Needed", selectedList(assessment, CHECKBOX_GROUPS.tasks).join(", "), 44);
  pdf.fullField("Notes", value(assessment, "housekeepingNotes"), 52);

  pdf.section("Cognitive & Behavioral Status");
  pdf.table(["Area", "Status"], [["Orientation", value(assessment, "orientationStatus")], ["Memory", value(assessment, "memoryStatus")], ["Behavioral Concerns", selectedList(assessment, CHECKBOX_GROUPS.behaviors).join(", ")], ["Supervision Needs", value(assessment, "supervisionNeeds")]], [210, 320]);
  pdf.fullField("Notes", value(assessment, "cognitiveNotes"), 52);

  pdf.section("Communication");
  pdf.table(["Area", "Status"], [["Communication Ability", value(assessment, "communicationAbility")], ["Preferred Language", value(assessment, "preferredLanguage")], ["Hearing / Vision Issues", selectedList(assessment, CHECKBOX_GROUPS.sensory).join(", ")]], [210, 320]);
  pdf.fullField("Notes", value(assessment, "communicationNotes"), 52);

  pdf.section("Safety & Environmental Risks");
  pdf.fullField("Risks", selectedList(assessment, CHECKBOX_GROUPS.risks).join(", "), 44);
  pdf.fieldRow([["Emergency Plan Reviewed", value(assessment, "emergencyPlanReviewed")]]);
  pdf.fullField("Special Safety Instructions", value(assessment, "safetyInstructions"), 56);

  pdf.section("Medication Awareness (Non-Skilled)");
  pdf.paragraph("Staff do not administer medications.");
  pdf.fieldRow([["Medication Assistance", value(assessment, "medicationAssistance")]]);
  pdf.fullField("Notes", value(assessment, "medicationNotes"), 52);

  pdf.section("Summary of Needs");
  pdf.fieldRow([["Overall Level of Assistance", value(assessment, "overallAssistance")]]);
  pdf.fullField("Key Care Needs Identified", value(assessment, "keyCareNeeds"), 70);

  pdf.section("Recommended Services");
  pdf.fullField("Recommended Services", selectedList(assessment, CHECKBOX_GROUPS.services).join(", "), 58);

  pdf.section("Assessor Certification");
  pdf.paragraph("I certify that this assessment accurately reflects the client's current condition and care needs.");
  pdf.fieldRow([["Assessor Name", value(assessment, "certifierName")], ["Signature", value(assessment, "signature")]]);
  pdf.fieldRow([["Date", value(assessment, "signatureDate")]]);
  return pdf.finish();
}

function buildPdfBuffer(pageStreams) {
  const objects = [];
  function addObject(body) { objects.push(body); return objects.length; }
  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];
  pageStreams.forEach((stream) => {
    const content = stream.join("\n");
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function createClientAssessmentPdf(assessment) {
  return buildPdfBuffer(buildPdfPages(assessment));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(rawBody));
  return JSON.parse(rawBody || "{}");
}

function buildEmailHtml(assessment, submittedAtDisplay) {
  return `
    <p>New CRS initial assessment submitted.</p>
    <p><strong>Client:</strong> ${escapeHtml(assessment.clientName)}</p>
    <p><strong>Assessor:</strong> ${escapeHtml(assessment.assessorName)}</p>
    <p><strong>Assessment Date:</strong> ${escapeHtml(assessment.assessmentDate)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ assessment, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY environment variable.");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Initial Assessment - ${normalizeText(assessment.clientName) || "Client"}`,
    html: buildEmailHtml(assessment, submittedAtDisplay),
    attachments: [{ filename: pdfFileName(assessment), content: pdfBuffer }]
  });
  if (error) {
    console.error("Resend client assessment email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }
  console.info("Resend client assessment email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-client-assessment", { method: req.method });
  console.info("CRS route /api/submit-client-assessment: supabase helper loaded", { storeSupabaseSubmission: typeof storeSupabaseSubmission === "function" });
  console.info("CRS route /api/submit-client-assessment: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = await readJsonBody(req);
    const assessment = body.assessment || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createClientAssessmentPdf(assessment);
    const emailResult = await sendEmail({ assessment, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(assessment.clientName),
      email: "",
      submissionType: "client-assessment",
      pdfBuffer,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(assessment.clientName),
      email: "",
      submissionType: "client-assessment",
      pdfFileName: supabaseSubmission.pdfFileName,
      pdfUrl: supabaseSubmission.pdfUrl,
      dateSubmitted
    });
    return res.status(200).json({
      ok: true,
      emailId: emailResult?.id,
      submissionId: supabaseSubmission.id || storedSubmission.id,
      pdfUrl: supabaseSubmission.pdfUrl
    });
  } catch (error) {
    console.error("CRS client assessment submission failed:", error);
    return res.status(500).json({ error: error.message || "Client assessment submission failed." });
  }
};

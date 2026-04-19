const { Resend } = require("resend");
const { storeSubmission } = require("../submission-store");
const { storeSupabaseSubmission } = require("../supabase");

const PAGE = { width: 612, height: 792, margin: 42 };
const FONT = { body: "F1", bold: "F2" };
const PDF_FILENAME = "Community_Regenerative_Solutions_Orientation_Packet.pdf";

const TRAINING_ITEMS = [
  {
    title: "Agency Policies and Employee Expectations",
    field: "agencyPoliciesReviewed",
    paragraphs: [
      "Employees are expected to follow all Community Regenerative Solutions (CRS) policies and procedures at all times. This includes maintaining professionalism, respecting clients, following assigned schedules, and completing all required documentation accurately and on time. Employees must perform only tasks authorized in the client's service plan and follow all supervisory instructions. Employees are expected to present themselves in a clean and appropriate manner and maintain a respectful attitude in all interactions.",
      "Failure to follow agency policies, repeated tardiness, unprofessional behavior, or refusal to follow instructions may result in disciplinary action up to and including termination. Employees must also cooperate with supervisors, participate in required training, and uphold the standards of care expected by CRS and Texas HHSC. Employees are responsible for understanding their role and asking questions when unsure about expectations. Maintaining accountability and consistency in performance is required for continued employment.",
      "Employees must also protect agency property, maintain appropriate boundaries with clients, and avoid any conflicts of interest. All work must be performed honestly and ethically. Employees are expected to represent CRS in a professional manner at all times, both on and off duty when interacting with clients or their families."
    ]
  },
  {
    title: "Confidentiality and HIPAA",
    field: "confidentialityReviewed",
    paragraphs: [
      "All client information is confidential and must be protected in accordance with HIPAA regulations. Employees may only access or share client information as necessary to perform job duties. Discussing client information in public, with unauthorized individuals, or on social media is strictly prohibited. This includes avoiding conversations about clients in public places such as stores, restaurants, or with family and friends.",
      "Employees must protect all written, verbal, and electronic information. Any suspected breach of confidentiality must be reported immediately to a supervisor. Violations of confidentiality policies may result in disciplinary action and potential legal consequences. Employees must ensure that documents containing client information are stored securely and not left unattended.",
      "Electronic communication, including text messages and emails, must be handled carefully and only used when authorized. Employees must not take photos or recordings of clients without proper authorization. Protecting client privacy is a core responsibility and must be taken seriously at all times."
    ]
  },
  {
    title: "Abuse, Neglect, and Exploitation Reporting",
    field: "aneReviewed",
    paragraphs: [
      "Employees are required to immediately report any suspected abuse, neglect, or exploitation of a client. This includes physical, emotional, verbal, or financial harm, as well as failure to provide necessary care. Employees must remain alert to signs such as unexplained injuries, sudden behavioral changes, or unsafe living conditions.",
      "Reports must be made to a supervisor and to the appropriate state reporting hotline as required by Texas HHSC regulations. Employees are protected from retaliation when making a good faith report. Failure to report suspected abuse, neglect, or exploitation may result in serious disciplinary action, including termination. Employees must not attempt to investigate or resolve suspected abuse on their own.",
      "All reports should be made as soon as possible to ensure the safety of the client. Employees should document observations clearly and accurately when reporting concerns. The safety and protection of clients is a top priority and must never be delayed."
    ]
  },
  {
    title: "Client Rights, Dignity, and Respectful Care",
    field: "clientRightsReviewed",
    paragraphs: [
      "Clients have the right to be treated with dignity, respect, and privacy at all times. Employees must honor client preferences, promote independence, and avoid any behavior that could be considered disrespectful, abusive, or discriminatory. Care must be provided in a manner that supports the client's physical, emotional, and personal well-being.",
      "Employees must respect cultural differences, personal beliefs, and lifestyle choices of each client. Clients have the right to make decisions about their care, and employees must not force or pressure clients into actions against their wishes. Maintaining a respectful and professional relationship is required at all times. Employees must also ensure privacy during personal care tasks.",
      "Any concerns related to client rights must be reported to a supervisor. Employees should encourage independence while ensuring safety. Treating clients with dignity is a fundamental expectation of all CRS staff."
    ]
  },
  {
    title: "Infection Control and Universal Precautions",
    field: "infectionControlReviewed",
    paragraphs: [
      "Employees must follow standard infection control practices, including proper handwashing, use of gloves when appropriate, and maintaining a clean environment. Universal precautions must be used when exposure to bodily fluids is possible to protect both the employee and the client. Employees must follow all guidelines for preventing the spread of illness and infection.",
      "Proper disposal of waste, cleaning of surfaces, and personal hygiene are essential components of infection control. Employees should not report to work when experiencing symptoms of illness that could be transmitted to clients. Any exposure incidents or concerns must be reported to a supervisor immediately. Employees must follow any additional infection control guidance provided by the agency.",
      "Employees should also be aware of common infection risks in the home environment. Maintaining cleanliness and using protective equipment when necessary helps reduce the spread of illness. Infection control is an ongoing responsibility during every shift."
    ]
  },
  {
    title: "Emergency Procedures and Reporting Expectations",
    field: "emergencyProceduresReviewed",
    paragraphs: [
      "In the event of an emergency, employees must ensure the client's immediate safety and contact emergency services (911) if necessary. Employees should remain calm, provide basic assistance within their scope, and follow any instructions provided by emergency personnel. Protecting the client from further harm is the top priority.",
      "All incidents must be reported to a supervisor as soon as possible following the emergency. Employees must follow agency procedures for documenting and reporting emergencies, including completing any required incident reports. Timely and accurate reporting is critical for ensuring proper follow-up and compliance. Employees must not leave a client unattended during an emergency unless directed by emergency personnel.",
      "Employees should be familiar with the client's environment and any known risks. Knowing how to respond quickly and appropriately can prevent further harm. Following proper procedures ensures both safety and compliance."
    ]
  },
  {
    title: "Documentation and Timesheet Expectations",
    field: "documentationReviewed",
    paragraphs: [
      "Employees are responsible for accurately documenting all services provided. Timesheets and visit records must reflect actual hours worked and tasks completed. Documentation must be clear, complete, and submitted according to agency requirements. Accurate records are necessary for compliance, billing, and quality of care.",
      "Falsification of documentation, including incorrect times or services not provided, is strictly prohibited. Employees must not sign in or out for another employee or submit inaccurate information. Any questions regarding documentation must be directed to a supervisor. Employees must ensure all entries are truthful and completed in a timely manner.",
      "Late or incomplete documentation may affect service delivery and agency compliance. Employees must follow all EVV or documentation requirements as assigned. Maintaining accurate records is a critical part of the job."
    ]
  },
  {
    title: "Call-Off, Attendance, and Schedule Communication",
    field: "callOffReviewed",
    paragraphs: [
      "Employees must report absences, lateness, or scheduling conflicts to their supervisor as soon as possible. Reliable attendance is essential to ensure continuity of care for clients. Employees are expected to arrive on time and be prepared to perform assigned duties.",
      "Repeated absences, failure to notify the supervisor, or frequent tardiness may result in disciplinary action. Employees must follow agency procedures for requesting time off and communicating schedule changes. Clear and timely communication is required at all times. Employees must not abandon a shift without proper notice.",
      "Consistent attendance reflects professionalism and reliability. Employees must understand the impact of missed shifts on clients. Maintaining communication with supervisors is required at all times."
    ]
  },
  {
    title: "Service Plan, Task List, and Supervisor Communication",
    field: "servicePlanReviewed",
    paragraphs: [
      "Employees must follow the client's authorized service plan and only perform approved tasks. Services provided must match what has been authorized and documented. Employees must not add, remove, or change services without proper approval from the agency.",
      "Any changes in the client's condition, environment, or needs must be reported to a supervisor immediately. Employees must maintain communication with supervisors regarding concerns, incidents, or questions. Following the service plan ensures compliance and client safety. Employees must not accept instructions from unauthorized individuals that conflict with the service plan.",
      "Supervisors are responsible for approving any changes to care. Employees must document and communicate clearly. Adhering to the service plan is a key part of compliance."
    ]
  },
  {
    title: "Prohibited Tasks",
    field: "prohibitedTasksReviewed",
    paragraphs: [
      "PAS Attendants are not permitted to perform skilled nursing services. This includes administering medications, providing medical treatments, or making medical decisions. Employees may only provide non-skilled personal care services as authorized in the service plan.",
      "Employees must not perform tasks they have not been trained or authorized to perform. If a client requests a task outside of the employee's scope, the employee must politely decline and report the request to a supervisor. Following these limitations protects both the employee and the client. Performing unauthorized tasks may result in disciplinary action.",
      "Employees must always stay within their role and responsibilities. When in doubt, they must contact a supervisor before proceeding. Maintaining proper boundaries ensures safety and compliance."
    ]
  }
];

function normalizeText(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function escapePdfText(value) {
  return normalizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
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

function checked(valueText) {
  return normalizeText(valueText) ? "Yes" : "";
}

function escapeHtml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createPdfContext() {
  const pages = [];
  let stream = [];
  let y = 732;

  function push(command) {
    stream.push(command);
  }

  function addPage() {
    pages.push(stream);
    stream = [];
    y = 732;
  }

  function ensure(spaceNeeded) {
    if (y - spaceNeeded < PAGE.margin) {
      addPage();
    }
  }

  function text(textValue, x, yPos, size = 9, font = FONT.body, color = 0) {
    push(`${color} g BT /${font} ${size} Tf ${x} ${yPos} Td (${escapePdfText(textValue)}) Tj ET`);
  }

  function line(x1, y1, x2, y2, width = 0.7) {
    push(`0 G ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function rect(x, yPos, width, height) {
    push(`0 G 0.7 w ${x} ${yPos} ${width} ${height} re S`);
  }

  function fillRect(x, yPos, width, height) {
    push(`0 g ${x} ${yPos} ${width} ${height} re f`);
  }

  function title() {
    text("Community Regenerative Solutions", 132, 748, 18, FONT.bold);
    text("Orientation & Training Packet", 195, 724, 15, FONT.bold);
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
    fields.forEach(([label, fieldValue], index) => {
      field(label, fieldValue, PAGE.margin + index * (width + gap), width);
    });
    y -= height;
  }

  function fullField(label, fieldValue, height = 48) {
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

  function topicBlock(item, packet) {
    ensure(70);
    text(item.title, PAGE.margin, y, 10, FONT.bold);
    y -= 14;
    item.paragraphs.forEach((paragraphText) => {
      const paragraphLines = wrapText(paragraphText, 92);
      ensure(paragraphLines.length * 11 + 8);
      paragraphLines.forEach((lineText) => {
        text(lineText, PAGE.margin, y, 9);
        y -= 11;
      });
      y -= 5;
    });
    table(
      ["Acknowledgment", "Completed"],
      [["I reviewed and understand this section", checked(packet[item.field])]],
      [430, 100]
    );
  }

  function table(headers, rows, columnWidths) {
    if (!rows.length) return;
    const totalWidth = columnWidths.reduce((sum, item) => sum + item, 0);
    const startX = PAGE.margin;
    const rowHeight = 24;
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

  function finish() {
    pages.push(stream);
    return pages;
  }

  return { title, section, fieldRow, fullField, paragraph, table, topicBlock, finish };
}

function buildPdfPages(packet) {
  const pdf = createPdfContext();
  pdf.title();

  pdf.section("Employee Information");
  pdf.fieldRow([
    ["Full Legal Name", value(packet, "fullName")],
    ["Email Address", value(packet, "email")]
  ]);
  pdf.fieldRow([
    ["Phone Number", value(packet, "phone")],
    ["Orientation Date", value(packet, "orientationDate")]
  ]);

  pdf.section("Orientation & Training Review");
  pdf.paragraph("This packet documents required orientation and training before the employee provides services for Community Regenerative Solutions. The employee confirms that each topic below was reviewed and understood.");
  TRAINING_ITEMS.forEach((item) => {
    pdf.topicBlock(item, packet);
  });

  pdf.section("Questions or Notes");
  pdf.fullField("Questions, comments, or topics needing follow-up", value(packet, "questions"), 70);

  pdf.section("Final Acknowledgment");
  pdf.paragraph("By signing below, I confirm that I have completed the orientation and training review above, understand the topics covered, and agree to follow Community Regenerative Solutions policies and procedures.");
  pdf.fieldRow([
    ["Full Legal Name", value(packet, "finalFullName")],
    ["Signature", value(packet, "signature")]
  ]);
  pdf.fieldRow([
    ["Orientation Date", value(packet, "orientationDate")],
    ["Trainer / Supervisor Name", value(packet, "trainerName")]
  ]);

  return pdf.finish();
}

function buildPdfBuffer(pageStreams) {
  const objects = [];
  function addObject(body) {
    objects.push(body);
    return objects.length;
  }

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
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function createOrientationPacketPdf(packet) {
  return buildPdfBuffer(buildPdfPages(packet));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  return JSON.parse(rawBody || "{}");
}

function buildEmailHtml(packet, submittedAtDisplay) {
  return `
    <p>New CRS orientation and training packet submitted.</p>
    <p><strong>Employee:</strong> ${escapeHtml(packet.fullName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(packet.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(packet.phone)}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(submittedAtDisplay)}</p>
  `;
}

async function sendEmail({ packet, submittedAtDisplay, pdfBuffer }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "info@communityregenerativesolutions.com",
    subject: `New CRS Orientation Packet - ${normalizeText(packet.fullName) || "Employee"}`,
    html: buildEmailHtml(packet, submittedAtDisplay),
    attachments: [
      {
        filename: PDF_FILENAME,
        content: pdfBuffer
      }
    ]
  });

  if (error) {
    console.error("Resend orientation email failed:", error);
    throw new Error(`Resend email failed: ${error.message || JSON.stringify(error)}`);
  }

  console.info("Resend orientation email sent:", data);
  return data;
}

module.exports = async function handler(req, res) {
  console.info("CRS route started: /api/submit-orientation", { method: req.method });
  console.info("CRS route /api/submit-orientation: supabase helper loaded", {
    storeSupabaseSubmission: typeof storeSupabaseSubmission === "function"
  });
  console.info("CRS route /api/submit-orientation: env vars present", {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY)
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const packet = body.packet || body || {};
    const dateSubmitted = body.submittedAt || new Date().toISOString();
    const submittedAtDisplay = body.submittedAtDisplay || new Date().toLocaleString();
    const pdfBuffer = createOrientationPacketPdf(packet);
    const emailResult = await sendEmail({ packet, submittedAtDisplay, pdfBuffer });
    const supabaseSubmission = await storeSupabaseSubmission({
      fullName: normalizeText(packet.fullName),
      email: normalizeText(packet.email),
      submissionType: "orientation",
      pdfBuffer,
      createdAt: dateSubmitted
    });
    const storedSubmission = await storeSubmission({
      fullName: normalizeText(packet.fullName),
      email: normalizeText(packet.email),
      submissionType: "orientation",
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
    console.error("CRS orientation packet submission failed:", error);
    return res.status(500).json({
      error: error.message || "Orientation packet submission failed."
    });
  }
};

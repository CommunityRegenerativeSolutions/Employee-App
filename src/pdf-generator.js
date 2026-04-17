/*
  Simple browser-side PDF generator.
  No external library is used. The code below writes a basic text PDF Blob that
  can be downloaded, printed, emailed later, or uploaded to a private admin app.
*/

const pdfTemplate = [
  {
    title: "Personal Information",
    rows: [
      ["Full Legal Name", "fullName"],
      ["Phone Number", "phone"],
      ["Email Address", "email"],
      ["Home Address", "address"]
    ]
  },
  {
    title: "Position Information",
    rows: [
      ["Position Applying For", "position"],
      ["Availability", "availability"]
    ]
  },
  {
    title: "Qualifications",
    rows: [
      ["Legally Authorized to Work in the United States", "authorizedToWork"],
      ["Reliable Transportation", "reliableTransportation"],
      ["Able to Assist with Personal Care Tasks", "personalCareTasks"]
    ]
  },
  {
    title: "Criminal History",
    rows: [
      ["Felony Conviction", "felonyConviction"],
      ["Explanation", "felonyExplanation"],
      ["Note", "A conviction does not automatically disqualify you from employment. Additional review may be required."]
    ]
  },
  {
    title: "Experience",
    rows: [
      ["Caregiving Experience", "caregivingExperience"],
      ["Experience Description", "experienceDetails"]
    ]
  },
  {
    title: "Previous Employment 1",
    rows: employerRows("employer1")
  },
  {
    title: "Previous Employment 2",
    rows: employerRows("employer2")
  },
  {
    title: "Previous Employment 3",
    rows: employerRows("employer3")
  },
  {
    title: "Education",
    rows: [
      ["Highest Level Completed", "educationLevel"],
      ["School Name", "schoolName"],
      ["City/State", "schoolLocation"],
      ["Degree or Certification Earned", "degreeEarned"],
      ["Graduation Date or Last Date Attended", "graduationDate"]
    ]
  },
  {
    title: "References",
    rows: [
      ["Reference 1 Name", "reference1Name"],
      ["Reference 1 Relationship", "reference1Relationship"],
      ["Reference 1 Phone", "reference1Phone"],
      ["Reference 1 Email", "reference1Email"],
      ["Reference 2 Name", "reference2Name"],
      ["Reference 2 Relationship", "reference2Relationship"],
      ["Reference 2 Phone", "reference2Phone"],
      ["Reference 2 Email", "reference2Email"],
      ["Reference 3 Name", "reference3Name"],
      ["Reference 3 Relationship", "reference3Relationship"],
      ["Reference 3 Phone", "reference3Phone"],
      ["Reference 3 Email", "reference3Email"]
    ]
  },
  {
    title: "Emergency Contact",
    rows: [
      ["Emergency Contact Name", "emergencyName"],
      ["Emergency Contact Phone Number", "emergencyPhone"]
    ]
  },
  {
    title: "Acknowledgment and Authorization",
    rows: [
      ["Information is true and complete", "certifyTrueComplete"],
      ["False or omitted information acknowledgment", "falseInfoAcknowledgment"],
      ["Authorization to verify information", "authorizeVerification"],
      ["No guarantee of employment", "noGuaranteeAcknowledgment"]
    ]
  },
  {
    title: "Signature and Date",
    rows: [
      ["Applicant Signature", "signature"],
      ["Date", "signatureDate"]
    ]
  }
];

function employerRows(prefix) {
  return [
    ["Employer Name", `${prefix}Name`],
    ["Job Title", `${prefix}JobTitle`],
    ["Supervisor Name", `${prefix}Supervisor`],
    ["Employer Phone Number", `${prefix}Phone`],
    ["Employer Address", `${prefix}Address`],
    ["Start Date", `${prefix}StartDate`],
    ["End Date", `${prefix}EndDate`],
    ["Reason for Leaving", `${prefix}Reason`],
    ["May Contact Employer", `${prefix}MayContact`]
  ];
}

function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function normalizePdfText(value) {
  if (value === true) {
    return "Yes";
  }

  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim() || "";
}

function wrapPdfText(text, maxChars) {
  const words = normalizePdfText(text).split(/\s+/).filter(Boolean);
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

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [""];
}

function getPdfValue(applicationData, keyOrText) {
  if (Object.prototype.hasOwnProperty.call(applicationData, keyOrText)) {
    return normalizePdfText(applicationData[keyOrText]);
  }

  return keyOrText;
}

function drawText(stream, text, x, y, size = 10, font = "F1") {
  stream.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
}

function addPage(pages, stream) {
  pages.push(stream);
}

function buildPdfPages(applicationData) {
  const pages = [];
  let stream = [];
  let y = 742;

  function newPage() {
    addPage(pages, stream);
    stream = [];
    y = 742;
    drawText(stream, "Community Regenerative Solutions", 54, y, 16, "F2");
    y -= 20;
    drawText(stream, "Employment Application", 54, y, 13, "F2");
    y -= 28;
  }

  function ensureRoom(spaceNeeded) {
    if (y - spaceNeeded < 54) {
      newPage();
    }
  }

  drawText(stream, "Community Regenerative Solutions", 54, y, 18, "F2");
  y -= 22;
  drawText(stream, "Employment Application", 54, y, 14, "F2");
  y -= 18;
  drawText(stream, `Generated: ${new Date().toLocaleString()}`, 54, y, 9);
  y -= 28;

  pdfTemplate.forEach((section) => {
    ensureRoom(34);
    drawText(stream, section.title, 54, y, 12, "F2");
    y -= 16;

    section.rows.forEach(([label, keyOrText]) => {
      const value = getPdfValue(applicationData, keyOrText);
      const labelLines = wrapPdfText(`${label}:`, 25);
      const valueLines = wrapPdfText(value, 68);
      const rowLines = Math.max(labelLines.length, valueLines.length);
      ensureRoom(rowLines * 13 + 4);

      for (let index = 0; index < rowLines; index += 1) {
        drawText(stream, labelLines[index] || "", 68, y, 9, "F2");
        drawText(stream, valueLines[index] || "", 230, y, 9);
        y -= 13;
      }

      y -= 2;
    });

    y -= 8;
  });

  addPage(pages, stream);
  return pages;
}

function buildPdfDocument(pageStreams) {
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

  return new Blob([pdf], { type: "application/pdf" });
}

function createEmploymentApplicationPdf(applicationData) {
  const pageStreams = buildPdfPages(applicationData);
  return buildPdfDocument(pageStreams);
}

window.CRSPdfGenerator = {
  createEmploymentApplicationPdf
};

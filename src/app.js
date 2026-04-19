const form = document.querySelector("#applicationForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const experienceDetailsGroup = document.querySelector("#experienceDetailsGroup");
const experienceDetails = document.querySelector("#experienceDetails");
const felonyExplanationGroup = document.querySelector("#felonyExplanationGroup");
const felonyExplanation = document.querySelector("#felonyExplanation");
const signatureDate = document.querySelector("#signatureDate");
const finalAcknowledgmentDate = document.querySelector("#finalAcknowledgmentDate");
const downloadPdfLink = document.querySelector("#downloadPdfLink");
const submitButton = form.querySelector(".submit-button");
const submissionStatus = document.querySelector("#submissionStatus");
const appConfig = window.CRSApplicationConfig || {};

function configureFormSubmissionAttributes() {
  if (!isSubmissionEndpointConfigured()) {
    console.error("CRS application: Submission endpoint is missing in src/config.js.");
    return;
  }

  form.method = "POST";
  form.action = appConfig.submissionEndpoint;
  form.enctype = "application/x-www-form-urlencoded";
  console.info("CRS application: Form configured to POST to server route.", form.action);
}

// Set today's date as a convenience. The applicant can still change it.
signatureDate.value = new Date().toISOString().slice(0, 10);
finalAcknowledgmentDate.value = new Date().toISOString().slice(0, 10);

// These labels make validation messages clear for nontechnical applicants.
const fieldLabels = {
  fullName: "Full Legal Name",
  phone: "Phone Number",
  email: "Email Address",
  address: "Home Address",
  city: "City",
  state: "State",
  zipCode: "ZIP Code",
  position: "Position Applying For",
  availability: "Availability",
  dateAvailable: "Date Available to Start",
  daysAvailable: "Days Available",
  preferredShifts: "Preferred Shift(s)",
  authorizedToWork: "Legal authorization to work in the United States",
  reliableTransportation: "Reliable transportation",
  validDriversLicense: "Valid driver's license",
  personalCareTasks: "Ability to assist with personal care tasks",
  caregivingExperience: "Caregiving experience",
  employer1Name: "Previous Employment 1 Employer Name",
  employer1JobTitle: "Previous Employment 1 Job Title",
  employer1Supervisor: "Previous Employment 1 Supervisor Name",
  employer1Phone: "Previous Employment 1 Employer Phone Number",
  employer1Address: "Previous Employment 1 Employer Address",
  employer1StartDate: "Previous Employment 1 Start Date",
  employer1EndDate: "Previous Employment 1 End Date",
  employer1Reason: "Previous Employment 1 Reason for Leaving",
  employer1MayContact: "Permission to contact Previous Employment 1",
  educationLevel: "Highest Level of Education Completed",
  reference1Name: "Reference 1 Full Name",
  reference1Relationship: "Reference 1 Relationship",
  reference1Phone: "Reference 1 Phone Number",
  reference1Email: "Reference 1 Email Address",
  felonyConviction: "Felony conviction question",
  felonyExplanation: "Felony explanation",
  emergencyName: "Emergency Contact Name",
  emergencyRelationship: "Emergency Contact Relationship",
  emergencyPhone: "Emergency Contact Phone Number",
  certifyTrueComplete: "Certification that application information is true and complete",
  falseInfoAcknowledgment: "Acknowledgment about false, misleading, or omitted information",
  authorizeVerification: "Authorization to verify application information",
  noGuaranteeAcknowledgment: "Acknowledgment that application submission does not guarantee employment",
  signature: "Signature",
  signatureDate: "Date",
  jobDescriptionAcknowledged: "Job Description Acknowledgment checkbox",
  confidentialityAcknowledged: "Confidentiality and HIPAA acknowledgment",
  backgroundCheckAcknowledged: "Background check authorization",
  aneAcknowledged: "Abuse, neglect, and exploitation reporting acknowledgment",
  clientRightsAcknowledged: "Client rights acknowledgment",
  atWillAcknowledged: "At-will employment acknowledgment",
  attendanceAcknowledged: "Attendance and reliability policy acknowledgment",
  finalAcknowledgmentFullName: "Final Acknowledgment Full Name",
  finalAcknowledgmentSignature: "Final Acknowledgment Signature",
  finalAcknowledgmentDate: "Final Acknowledgment Date"
};

const emailSections = [
  {
    title: "Personal Info",
    rows: [
      ["Full Legal Name", "fullName"],
      ["Phone Number", "phone"],
      ["Email Address", "email"],
      ["Home Address", "address"],
      ["City", "city"],
      ["State", "state"],
      ["ZIP Code", "zipCode"]
    ]
  },
  {
    title: "Position Information",
    rows: [
      ["Position Applying For", "position"],
      ["Availability", "availability"],
      ["Date Available to Start", "dateAvailable"],
      ["Days Available", "daysAvailable"],
      ["Preferred Shift(s)", "preferredShifts"]
    ]
  },
  {
    title: "Qualifications",
    rows: [
      ["Legally Authorized to Work in the United States", "authorizedToWork"],
      ["Reliable Transportation", "reliableTransportation"],
      ["Valid Driver's License", "validDriversLicense"],
      ["Able to Assist with Personal Care Tasks", "personalCareTasks"]
    ]
  },
  {
    title: "Criminal History",
    rows: [
      ["Felony Conviction", "felonyConviction"],
      ["Felony Explanation", "felonyExplanation"]
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
    rows: emailEmployerRows("employer1")
  },
  {
    title: "Previous Employment 2",
    rows: emailEmployerRows("employer2")
  },
  {
    title: "Previous Employment 3",
    rows: emailEmployerRows("employer3")
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
      ["Emergency Contact Relationship", "emergencyRelationship"],
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
  },
  {
    title: "Job Description Acknowledgment",
    rows: [
      ["Acknowledgment Checked", "jobDescriptionAcknowledged"]
    ]
  },
  {
    title: "Additional Applicant Acknowledgments",
    rows: [
      ["Confidentiality and HIPAA Agreement", "confidentialityAcknowledged"],
      ["Background Check Authorization", "backgroundCheckAcknowledged"],
      ["ANE Reporting", "aneAcknowledged"],
      ["Client Rights Acknowledgment", "clientRightsAcknowledged"],
      ["At-Will Employment Statement", "atWillAcknowledged"],
      ["Attendance and Reliability Policy", "attendanceAcknowledged"]
    ]
  },
  {
    title: "Final Acknowledgment",
    rows: [
      ["Typed Full Name", "finalAcknowledgmentFullName"],
      ["Signature", "finalAcknowledgmentSignature"],
      ["Date", "finalAcknowledgmentDate"]
    ]
  }
];

function emailEmployerRows(prefix) {
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

function getCaregivingExperienceAnswer() {
  return form.querySelector('input[name="caregivingExperience"]:checked')?.value || "";
}

function updateExperienceDetailsVisibility() {
  const hasExperience = getCaregivingExperienceAnswer() === "Yes";
  experienceDetailsGroup.hidden = !hasExperience;
  experienceDetails.required = hasExperience;

  if (!hasExperience) {
    experienceDetails.value = "";
    experienceDetails.classList.remove("field-error");
    experienceDetails.removeAttribute("aria-invalid");
  }
}

function getFelonyConvictionAnswer() {
  return form.querySelector('input[name="felonyConviction"]:checked')?.value || "";
}

function updateFelonyExplanationVisibility() {
  const hasFelonyConviction = getFelonyConvictionAnswer() === "Yes";
  felonyExplanationGroup.hidden = !hasFelonyConviction;
  felonyExplanation.required = hasFelonyConviction;

  if (!hasFelonyConviction) {
    felonyExplanation.value = "";
    felonyExplanation.classList.remove("field-error");
    felonyExplanation.removeAttribute("aria-invalid");
  }
}

function clearErrors() {
  errorSummary.hidden = true;
  errorSummary.innerHTML = "";
  form.querySelectorAll(".field-error").forEach((field) => {
    field.classList.remove("field-error");
    field.removeAttribute("aria-invalid");
  });
}

function showStatus(message, type = "info") {
  submissionStatus.textContent = message;
  submissionStatus.className = `submission-status ${type}`;
  submissionStatus.hidden = false;
}

function clearStatus() {
  submissionStatus.hidden = true;
  submissionStatus.textContent = "";
  submissionStatus.className = "submission-status";
}

function markInvalidField(field) {
  field.classList.add("field-error");
  field.setAttribute("aria-invalid", "true");
}

function validateForm() {
  clearErrors();

  const messages = [];
  const requiredFields = Array.from(form.querySelectorAll("[required]"));

  requiredFields.forEach((field) => {
    if (field.type === "radio") {
      const group = form.querySelectorAll(`input[name="${field.name}"]`);
      const checked = form.querySelector(`input[name="${field.name}"]:checked`);

      if (!checked && !messages.includes(`${fieldLabels[field.name]} is required.`)) {
        messages.push(`${fieldLabels[field.name]} is required.`);
        group.forEach(markInvalidField);
      }

      return;
    }

    if (field.type === "checkbox") {
      if (!field.checked) {
        messages.push(`${fieldLabels[field.name]} is required.`);
        markInvalidField(field);
      }

      return;
    }

    if (!field.value.trim()) {
      messages.push(`${fieldLabels[field.name]} is required.`);
      markInvalidField(field);
      return;
    }

    if (field.type === "email" && !field.validity.valid) {
      messages.push(`Please enter a valid email address for ${fieldLabels[field.name] || "this field"}.`);
      markInvalidField(field);
    }
  });

  return messages;
}

function showErrors(messages) {
  errorSummary.innerHTML = `
    <strong>Please fix the following before submitting:</strong>
    <ul>${messages.map((message) => `<li>${message}</li>`).join("")}</ul>
  `;
  errorSummary.hidden = false;
  errorSummary.focus();
  showStatus("Please complete the required fields before submitting.", "error");
}

function showSubmissionError(message) {
  console.error("CRS application: Visible submission error:", message);
  showErrors([message]);
}

function collectSubmissionPreview() {
  const formData = new FormData(form);

  /*
    This object is not sent anywhere yet.
    It shows the shape a future private admin app or backend endpoint could receive.
  */
  const applicant = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    applicant[checkbox.name] = checkbox.checked;
  });

  return {
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    applicant,
    files: {
      resume: form.resume.files[0]?.name || ""
    }
  };
}

function createPdfFileName(applicantName) {
  const safeName = String(applicantName || "Applicant")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "");

  return `${safeName || "Applicant"}_Employment_Application.pdf`;
}

function preparePdfDownload(submission) {
  const pdfBlob = window.CRSPdfGenerator.createEmploymentApplicationPdf(submission.applicant);
  const pdfUrl = URL.createObjectURL(pdfBlob);

  downloadPdfLink.href = pdfUrl;
  downloadPdfLink.download = createPdfFileName(submission.applicant.fullName);
  downloadPdfLink.hidden = false;

  return pdfBlob;
}

function formatAnswer(value) {
  if (value === true) {
    return "Yes";
  }

  return String(value || "").trim() || "Not provided";
}

function buildEmailBody(submission) {
  const lines = [
    "Community Regenerative Solutions",
    "Employment Application Submission",
    "",
    `Submitted to: ${appConfig.submissionEmail || "Info@communityregenerativesolutions.com"}`,
    `Submitted at: ${submission.submittedAtDisplay}`,
    `Resume file selected: ${submission.files.resume || "Not provided"}`,
    ""
  ];

  emailSections.forEach((section) => {
    lines.push(section.title.toUpperCase());
    section.rows.forEach(([label, key]) => {
      lines.push(`${label}: ${formatAnswer(submission.applicant[key])}`);
    });
    lines.push("");
  });

  return lines.join("\n");
}

function isSubmissionEndpointConfigured() {
  return Boolean(appConfig.submissionEndpoint);
}

function buildServerPayload(submission) {
  return {
    formType: "application",
    submittedAt: submission.submittedAt,
    submittedAtDisplay: submission.submittedAtDisplay,
    data: submission.applicant,
    files: submission.files,
    emailBody: buildEmailBody(submission)
  };
}

async function sendApplicationEmail(submission, pdfBlob) {
  if (!isSubmissionEndpointConfigured()) {
    console.error("CRS application: Cannot submit because server endpoint is missing.");
    throw new Error("Submission is not configured yet. Please check the server setup.");
  }

  console.info("CRS application: Sending POST request to server route.", appConfig.submissionEndpoint);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(appConfig.submissionEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildServerPayload(submission)),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("CRS application: Server failure response:", response.status, responseText);
      throw new Error("Submission failed. The application email could not be sent. Please try again.");
    }

    const responseData = await response.json().catch(() => ({}));
    console.info("CRS application: Server success response:", response.status, responseData);
  } catch (error) {
    console.error("CRS application: Request failed or timed out:", error);
    if (error.name === "AbortError") {
      throw new Error("Submission timed out. Please check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Application";
}

form.addEventListener("change", () => {
  updateExperienceDetailsVisibility();
  updateFelonyExplanationVisibility();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS application: Submit started.");
  console.info("CRS application: Server endpoint configured:", isSubmissionEndpointConfigured(), appConfig.submissionEndpoint || "(missing)");
  clearStatus();

  const messages = validateForm();
  if (messages.length > 0) {
    console.warn("CRS application: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting application...", "info");

  try {
    const submission = collectSubmissionPreview();
    const pdfBlob = preparePdfDownload(submission);
    console.info("Employment application submission preview:", submission);

    await sendApplicationEmail(submission, pdfBlob);

    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS application: JavaScript submission error:", error);
    showSubmissionError(error.message || "Submission failed. Please try again.");
  } finally {
    setSubmitting(false);
  }
});

configureFormSubmissionAttributes();
updateExperienceDetailsVisibility();
updateFelonyExplanationVisibility();

const form = document.querySelector("#clientIncidentReportForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const incidentDate = document.querySelector("#incidentDate");
const signatureDate = document.querySelector("#signatureDate");
const attendantName = document.querySelector("#attendantName");
const signatureAttendantName = document.querySelector("#signatureAttendantName");

const fieldLabels = {
  clientName: "Client Name",
  incidentDate: "Date of Incident",
  incidentTime: "Time of Incident",
  attendantName: "Attendant Name",
  incidentLocation: "Location of Incident",
  incidentDescription: "Description of Incident",
  clientConditionAfter: "Client condition after incident",
  signatureAttendantName: "Attendant Name",
  attendantSignature: "Signature",
  signatureDate: "Date"
};

const today = new Date().toISOString().slice(0, 10);
incidentDate.value = today;
signatureDate.value = today;

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

function markInvalidField(field) {
  field.classList.add("field-error");
  field.setAttribute("aria-invalid", "true");
}

function validateForm() {
  clearErrors();
  const messages = [];

  Array.from(form.querySelectorAll("[required]")).forEach((field) => {
    if (field.type === "radio") {
      const group = form.querySelectorAll(`input[name="${field.name}"]`);
      const checked = form.querySelector(`input[name="${field.name}"]:checked`);
      const message = `${fieldLabels[field.name] || "This option"} is required.`;

      if (!checked && !messages.includes(message)) {
        messages.push(message);
        group.forEach(markInvalidField);
      }

      return;
    }

    if (!field.value.trim()) {
      messages.push(`${fieldLabels[field.name] || "This field"} is required.`);
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

function collectSubmission() {
  const formData = new FormData(form);
  const incidentReport = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    incidentReport[checkbox.name] = checkbox.checked;
  });

  return {
    formType: "client-incident-report",
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    incidentReport
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Incident Report";
}

async function submitClientIncidentReport(submission) {
  console.info("CRS incident report: Sending POST request to /api/submit-form.");

  const response = await fetch("/api/submit-form", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(submission)
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error("CRS incident report: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The incident report email could not be sent. Please try again.");
  }

  const responseData = await response.json().catch(() => ({}));
  console.info("CRS incident report: Server success response:", response.status, responseData);
}

attendantName.addEventListener("input", () => {
  if (!signatureAttendantName.value.trim()) {
    signatureAttendantName.value = attendantName.value;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS incident report: Submit started.");
  submissionStatus.hidden = true;

  const messages = validateForm();
  if (messages.length) {
    console.warn("CRS incident report: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting incident report...", "info");

  try {
    await submitClientIncidentReport(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS incident report: JavaScript submission error:", error);
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});

const form = document.querySelector("#clientVisitNoteForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const dateOfService = document.querySelector("#dateOfService");
const signedDate = document.querySelector("#signedDate");
const incidentDetailsGroup = document.querySelector("#incidentDetailsGroup");
const incidentDetails = document.querySelector("#incidentDetails");
const incompleteExplanationGroup = document.querySelector("#incompleteExplanationGroup");
const incompleteExplanation = document.querySelector("#incompleteExplanation");

const fieldLabels = {
  clientName: "Client Name",
  dateOfService: "Date of Service",
  attendantName: "Attendant / Caregiver Name",
  arrivalTime: "Arrival Time",
  departureTime: "Departure Time",
  clientCondition: "Client condition today",
  observationNotes: "Notes / observations",
  incidentOccurred: "Incident, injury, refusal, or unusual event",
  incidentDetails: "Incident details",
  servicesCompleted: "Services completed as planned",
  incompleteExplanation: "Task completion explanation",
  attendantSignature: "Attendant Signature",
  signedDate: "Visit Note Date Signed"
};

const today = new Date().toISOString().slice(0, 10);
dateOfService.value = today;
signedDate.value = today;

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

function updateConditionalFields() {
  const incidentValue = form.querySelector('input[name="incidentOccurred"]:checked')?.value || "";
  const completedValue = form.querySelector('input[name="servicesCompleted"]:checked')?.value || "";

  incidentDetailsGroup.hidden = incidentValue !== "Yes";
  incidentDetails.required = incidentValue === "Yes";
  if (incidentValue !== "Yes") incidentDetails.value = "";

  incompleteExplanationGroup.hidden = completedValue !== "No";
  incompleteExplanation.required = completedValue === "No";
  if (completedValue !== "No") incompleteExplanation.value = "";
}

function validateForm() {
  clearErrors();
  updateConditionalFields();
  const messages = [];

  Array.from(form.querySelectorAll("[required]")).forEach((field) => {
    if (field.closest("[hidden]")) return;

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
  const visitNote = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    visitNote[checkbox.name] = checkbox.checked;
  });

  return {
    formType: "client-visit-note",
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    visitNote
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Visit Note";
}

async function submitClientVisitNote(submission) {
  console.info("CRS visit note: Sending POST request to /api/submit-form.");

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
    console.error("CRS visit note: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The visit note email could not be sent. Please try again.");
  }

  const responseData = await response.json().catch(() => ({}));
  console.info("CRS visit note: Server success response:", response.status, responseData);
}

form.addEventListener("change", updateConditionalFields);
updateConditionalFields();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS visit note: Submit started.");
  submissionStatus.hidden = true;

  const messages = validateForm();
  if (messages.length) {
    console.warn("CRS visit note: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting visit note...", "info");

  try {
    await submitClientVisitNote(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS visit note: JavaScript submission error:", error);
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});

const form = document.querySelector("#clientIntakeForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const signatureDate = document.querySelector("#signatureDate");

const fieldLabels = {
  fullName: "Full Legal Name",
  dateOfBirth: "Date of Birth",
  gender: "Gender",
  phone: "Phone Number",
  serviceAddress: "Service Address",
  emergencyName: "Emergency Contact Full Name",
  emergencyRelationship: "Emergency Contact Relationship",
  emergencyPhone: "Emergency Contact Phone Number",
  mobilityStatus: "Mobility",
  transferStatus: "Transfers",
  toiletingStatus: "Toileting",
  bathingStatus: "Bathing",
  serviceConsent: "Consent to receive services",
  signerName: "Client / Responsible Party Name",
  signature: "Signature",
  signatureDate: "Date"
};

signatureDate.value = new Date().toISOString().slice(0, 10);

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

    if (field.type === "checkbox") {
      if (!field.checked) {
        messages.push(`${fieldLabels[field.name] || "This checkbox"} is required.`);
        markInvalidField(field);
      }
      return;
    }

    if (!field.value.trim()) {
      messages.push(`${fieldLabels[field.name] || "This field"} is required.`);
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

function collectSubmission() {
  const formData = new FormData(form);
  const intake = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    intake[checkbox.name] = checkbox.checked;
  });

  return {
    formType: "client-intake",
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    intake
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Client Intake";
}

async function submitClientIntake(submission) {
  console.info("CRS client intake: Sending POST request to /api/submit-form.");

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
    console.error("CRS client intake: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The client intake email could not be sent. Please try again.");
  }

  const responseData = await response.json().catch(() => ({}));
  console.info("CRS client intake: Server success response:", response.status, responseData);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS client intake: Submit started.");
  submissionStatus.hidden = true;

  const messages = validateForm();
  if (messages.length) {
    console.warn("CRS client intake: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting client intake...", "info");

  try {
    await submitClientIntake(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS client intake: JavaScript submission error:", error);
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});

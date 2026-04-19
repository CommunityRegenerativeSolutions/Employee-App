const form = document.querySelector("#orientationForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const orientationDate = document.querySelector("#orientationDate");

const fieldLabels = {
  fullName: "Full Legal Name",
  email: "Email Address",
  phone: "Phone Number",
  orientationDate: "Orientation Date",
  trainerName: "Trainer / Supervisor Name",
  agencyPoliciesReviewed: "Agency policies and employee expectations",
  confidentialityReviewed: "Confidentiality and HIPAA expectations",
  aneReviewed: "Abuse, neglect, and exploitation reporting requirements",
  clientRightsReviewed: "Client rights",
  infectionControlReviewed: "Infection control",
  emergencyProceduresReviewed: "Emergency procedures",
  documentationReviewed: "Documentation rules and timesheet expectations",
  callOffReviewed: "Call-off, attendance, and schedule communication procedures",
  servicePlanReviewed: "Service plan, task list, and supervisor contact process",
  prohibitedTasksReviewed: "Prohibited tasks",
  finalFullName: "Full Legal Name",
  signature: "Signature"
};

orientationDate.value = new Date().toISOString().slice(0, 10);

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
    if (field.type === "checkbox") {
      if (!field.checked) {
        messages.push(`${fieldLabels[field.name] || "This acknowledgment"} is required.`);
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
      messages.push(`Please enter a valid email address for ${fieldLabels[field.name]}.`);
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
  const packet = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    packet[checkbox.name] = checkbox.checked;
  });

  return {
    formType: "orientation",
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    data: packet
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Orientation Packet";
}

async function submitOrientationPacket(submission) {
  console.info("CRS orientation packet: Sending POST request to /api/submit-form.");

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
    console.error("CRS orientation packet: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The orientation packet email could not be sent. Please try again.");
  }

  const responseData = await response.json().catch(() => ({}));
  console.info("CRS orientation packet: Server success response:", response.status, responseData);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS orientation packet: Submit started.");
  submissionStatus.hidden = true;

  const messages = validateForm();
  if (messages.length) {
    console.warn("CRS orientation packet: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting orientation packet...", "info");

  try {
    await submitOrientationPacket(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS orientation packet: JavaScript submission error:", error);
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});

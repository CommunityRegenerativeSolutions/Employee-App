const form = document.querySelector("#backgroundForm");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const fullName = document.querySelector("#fullName");
const employeeSignatureName = document.querySelector("#employeeSignatureName");
const signatureDate = document.querySelector("#signatureDate");

const fieldLabels = {
  fullName: "Full Legal Name",
  dateOfBirth: "Date of Birth",
  ssnLast4: "Last 4 of SSN",
  currentAddress: "Current Address",
  backgroundAuthorization: "Background check authorization",
  employeeSignatureName: "Employee Full Name",
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

    if (field.name === "ssnLast4" && !/^\d{4}$/.test(field.value.trim())) {
      messages.push("Last 4 of SSN must be exactly 4 digits.");
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
  const authorization = Object.fromEntries(formData.entries());

  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    authorization[checkbox.name] = checkbox.checked;
  });

  return {
    formType: "background",
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    data: authorization
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Background Authorization";
}

async function submitBackgroundAuthorization(submission) {
  console.info("CRS background authorization: Sending POST request to /api/submit-form.");

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
    console.error("CRS background authorization: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The background authorization email could not be sent. Please try again.");
  }

  const responseData = await response.json().catch(() => ({}));
  console.info("CRS background authorization: Server success response:", response.status, responseData);
}

fullName.addEventListener("input", () => {
  if (!employeeSignatureName.dataset.edited) {
    employeeSignatureName.value = fullName.value;
  }
});

employeeSignatureName.addEventListener("input", () => {
  employeeSignatureName.dataset.edited = "true";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.info("CRS background authorization: Submit started.");
  submissionStatus.hidden = true;

  const messages = validateForm();
  if (messages.length) {
    console.warn("CRS background authorization: Validation failed:", messages);
    showErrors(messages);
    return;
  }

  setSubmitting(true);
  showStatus("Submitting background authorization...", "info");

  try {
    await submitBackgroundAuthorization(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    console.error("CRS background authorization: JavaScript submission error:", error);
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});

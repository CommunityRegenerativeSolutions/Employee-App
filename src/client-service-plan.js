const form = document.querySelector("#clientServicePlanForm");
const serviceTables = document.querySelector("#serviceTables");
const successMessage = document.querySelector("#successMessage");
const errorSummary = document.querySelector("#errorSummary");
const submissionStatus = document.querySelector("#submissionStatus");
const submitButton = form.querySelector(".submit-button");
const effectiveDate = document.querySelector("#effectiveDate");
const clientSignatureDate = document.querySelector("#clientSignatureDate");

const SERVICE_SECTIONS = [
  ["A", "Personal Hygiene / Bathing", ["Gather bathing supplies", "Assist with entering/leaving tub or shower", "Standby assistance for safety", "Sponge bath", "Bed bath", "Wash hair", "Dry hair", "Oral hygiene", "Grooming", "Shaving", "Nail care", "Apply lotion / skin care", "Dressing after bathing", "Other"]],
  ["B", "Dressing / Personal Care", ["Select clothing", "Upper body dressing", "Lower body dressing", "Undressing", "Apply shoes / socks", "Assist with braces / supports", "Personal appearance / grooming", "Other"]],
  ["C", "Toileting / Continence", ["Toilet transfer assistance", "Standby assistance for toileting", "Assist with clothing during toileting", "Incontinence brief change", "Perineal care / hygiene", "Assist with commode use", "Assist with urinal use", "Empty commode / supplies cleanup", "Catheter bag positioning / non-skilled observation only", "Handwashing after toileting", "Other"]],
  ["D", "Mobility / Transfers", ["Bed mobility", "Transfer bed to chair", "Transfer chair to toilet", "Repositioning", "Walking assistance", "Wheelchair assistance", "Standby for fall prevention", "Other"]],
  ["E", "Nutrition / Meal Support", ["Meal planning", "Meal preparation", "Feeding assistance", "Set up meal tray", "Encourage fluids", "Clean eating area", "Observe appetite / intake", "Other"]],
  ["F", "Housekeeping / Home Support", ["Laundry", "Dishes", "Trash removal", "Clean bathroom used by client", "Clean bedroom / client area", "Change linens", "Organize supplies", "Other"]],
  ["G", "Supervision / Safety Monitoring", ["Cueing / reminders", "Redirection", "Monitoring for confusion", "Supervision for safety", "Observe changes in condition", "Report concerns to supervisor", "Other"]]
];

const fieldLabels = {
  clientName: "Client Name",
  effectiveDate: "Start / Effective Date",
  assistanceLevel: "Overall level of assistance",
  clientSignerName: "Client / Responsible Party Name",
  clientSignature: "Client / Responsible Party Signature",
  clientSignatureDate: "Client signature date"
};

function fieldName(sectionCode, rowIndex, suffix) {
  return `section${sectionCode}Row${rowIndex}${suffix}`;
}

function renderServiceTables() {
  serviceTables.innerHTML = SERVICE_SECTIONS.map(([code, title, rows]) => `
    <section class="form-section" aria-labelledby="section${code}Title">
      <h2 id="section${code}Title">${code}. ${title}</h2>
      <div class="plan-table-wrap">
        <table class="plan-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Frequency</th>
              <th>Level of Assistance</th>
              <th>Notes / Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((activity, index) => `
              <tr>
                <td class="activity-cell">${activity}</td>
                <td>
                  <select name="${fieldName(code, index, "Frequency")}">
                    <option value="">Select</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>As Needed</option>
                  </select>
                </td>
                <td>
                  <select name="${fieldName(code, index, "Assistance")}">
                    <option value="">Select</option>
                    <option>Independent</option>
                    <option>Standby</option>
                    <option>Assist</option>
                    <option>Total Care</option>
                  </select>
                </td>
                <td><textarea name="${fieldName(code, index, "Notes")}" rows="2"></textarea></td>
              </tr>
            `).join("")}
            <tr class="summary-row">
              <td colspan="3">Section summary / attendant instructions</td>
              <td><textarea name="section${code}Summary" rows="2"></textarea></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `).join("");
}

const today = new Date().toISOString().slice(0, 10);
effectiveDate.value = today;
clientSignatureDate.value = today;
renderServiceTables();

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
  errorSummary.innerHTML = `<strong>Please fix the following before submitting:</strong><ul>${messages.map((message) => `<li>${message}</li>`).join("")}</ul>`;
  errorSummary.hidden = false;
  errorSummary.focus();
  showStatus("Please complete the required fields before submitting.", "error");
}

function collectSubmission() {
  const formData = new FormData(form);
  const servicePlan = Object.fromEntries(formData.entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    servicePlan[checkbox.name] = checkbox.checked;
  });
  return {
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString(),
    servicePlan
  };
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Service Plan";
}

async function submitClientServicePlan(submission) {
  const response = await fetch("/api/submit-client-service-plan", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(submission)
  });
  if (!response.ok) {
    const responseText = await response.text();
    console.error("CRS client service plan: Server failure response:", response.status, responseText);
    throw new Error("Submission failed. The client service plan email could not be sent. Please try again.");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submissionStatus.hidden = true;
  const messages = validateForm();
  if (messages.length) {
    showErrors(messages);
    return;
  }
  setSubmitting(true);
  showStatus("Submitting client service plan...", "info");
  try {
    await submitClientServicePlan(collectSubmission());
    form.hidden = true;
    successMessage.hidden = false;
    successMessage.focus();
  } catch (error) {
    showErrors([error.message || "Submission failed. Please try again."]);
  } finally {
    setSubmitting(false);
  }
});

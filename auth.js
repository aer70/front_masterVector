const API_BASE = "https://backendmastervector-production.up.railway.app";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authError = document.getElementById("authError");

function setError(message) {
  if (authError) {
    authError.textContent = message || "";
  }
}

function saveTokens(payload, email) {
  localStorage.setItem("access_token", payload.access_token);
  localStorage.setItem("refresh_token", payload.refresh_token);
  localStorage.setItem("user_email", email);
}

async function submitJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { response, data } = await submitJson("/auth/login", { email, password });
    if (!response.ok) {
      setError(data.detail || "Ошибка входа.");
      return;
    }

    saveTokens(data, email);
    window.location.href = "index.html";
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { response, data } = await submitJson("/auth/register", { email, password });
    if (!response.ok) {
      setError(data.detail || "Ошибка регистрации.");
      return;
    }

    saveTokens(data, email);
    window.location.href = "index.html";
  });
}

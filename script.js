(() => {
  "use strict";

  const sets = {
    upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
    lower: "abcdefghijkmnopqrstuvwxyz",
    numbers: "23456789",
    symbols: "!@#$%^&*()-_=+[]{}:,.?"
  };

  const ambiguous = /[Il1O0o|`'"]/g;

  const words = [
    "apple","arrow","autumn","beacon","berry","blue","cactus","candle",
    "cedar","cloud","comet","coral","crystal","dawn","delta","ember",
    "falcon","forest","garden","glacier","harbor","hazel","island",
    "jasmine","juniper","lantern","maple","meadow","meteor","mist",
    "moon","ocean","orbit","otter","pepper","planet","prairie","quartz",
    "raven","river","rocket","sage","shadow","silver","solar","sparrow",
    "spring","stone","summit","sunset","thunder","tiger","valley",
    "violet","willow","winter","zephyr"
  ];

  const HISTORY_KEYS = {
    password: "genpass-history-password",
    phrase: "genpass-history-phrase",
    pin: "genpass-history-pin"
  };

  const MAX_HISTORY = 10;

  const CUSTOM_WORDS_KEY = "genpass-custom-words";
  const USE_CUSTOM_WORDS_KEY = "genpass-use-custom-words";
  const THEME_KEY = "genpass-theme";
  const CURRENT_PASSWORD_KEY = "genpass-current-password";

  const $ = id => document.getElementById(id);

  const checks = {
    uppercase: $("uppercase"),
    lowercase: $("lowercase"),
    numbers: $("numbers"),
    symbols: $("symbols"),
    ambiguous: $("ambiguous")
  };

  /* ---------------- RANDOMNESS ---------------- */

  function randomUint32() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
  }

  function randomInt(max) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error("Invalid random range.");
    }

    const limit = Math.floor(0x100000000 / max) * max;

    let value;

    do {
      value = randomUint32();
    } while (value >= limit);

    return value % max;
  }

  function pick(string) {
    return string[randomInt(string.length)];
  }

  /* ---------------- PASSWORD GENERATOR ---------------- */

  function charset() {
    let pool = "";

    if (checks.uppercase?.checked) {
      pool += sets.upper;
    }

    if (checks.lowercase?.checked) {
      pool += sets.lower;
    }

    if (checks.numbers?.checked) {
      pool += sets.numbers;
    }

    if (checks.symbols?.checked) {
      pool += sets.symbols;
    }

    if (checks.ambiguous?.checked) {
      pool = pool.replace(ambiguous, "");
    }

    return pool;
  }

  function shuffle(chars) {
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars;
  }

  function generatePassword(length) {
    const groups = [];

    if (checks.uppercase?.checked) {
      groups.push(
        checks.ambiguous?.checked
          ? sets.upper.replace(ambiguous, "")
          : sets.upper
      );
    }

    if (checks.lowercase?.checked) {
      groups.push(
        checks.ambiguous?.checked
          ? sets.lower.replace(ambiguous, "")
          : sets.lower
      );
    }

    if (checks.numbers?.checked) {
      groups.push(
        checks.ambiguous?.checked
          ? sets.numbers.replace(ambiguous, "")
          : sets.numbers
      );
    }

    if (checks.symbols?.checked) {
      groups.push(
        checks.ambiguous?.checked
          ? sets.symbols.replace(ambiguous, "")
          : sets.symbols
      );
    }

    if (!groups.length) {
      throw new Error("Select at least one character type.");
    }

    if (length < groups.length) {
      throw new Error(
        `Length must be at least ${groups.length} for the selected character types.`
      );
    }

    const pool = charset();

    if (!pool.length) {
      throw new Error("No usable characters remain.");
    }

    const output = groups.map(pick);

    while (output.length < length) {
      output.push(pick(pool));
    }

    return shuffle(output).join("");
  }

  /* ---------------- ANALYZER ---------------- */

  function analyze(password) {
    if (!password) {
      return {
        score: 0,
        label: "—",
        entropy: 0,
        tips: ["Enter a password to analyze."],
        size: 0,
        unique: 0
      };
    }

    let size = 0;

    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/[0-9]/.test(password)) size += 10;
    if (/[^A-Za-z0-9]/.test(password)) size += 33;

    const unique = new Set(password).size;

    const entropy = size
      ? password.length * Math.log2(size)
      : 0;

    let score =
      entropy >= 100 ? 4 :
      entropy >= 70 ? 3 :
      entropy >= 50 ? 2 :
      entropy >= 30 ? 1 :
      0;

    const tips = [];

    if (password.length < 12) {
      tips.push("Use at least 12 characters.");
    }

    if (!/[a-z]/.test(password)) {
      tips.push("Add lowercase letters.");
    }

    if (!/[A-Z]/.test(password)) {
      tips.push("Add uppercase letters.");
    }

    if (!/[0-9]/.test(password)) {
      tips.push("Add numbers.");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      tips.push("Add symbols.");
    }

    if (/(.)\1{2,}/.test(password)) {
      score = Math.max(0, score - 1);
      tips.push("Avoid repeated characters.");
    }

    if (
      /^(?:123|234|345|456|567|678|789|abc|bcd|qwe)/i.test(password)
    ) {
      score = Math.max(0, score - 1);
      tips.push("Avoid obvious sequences.");
    }

    if (!tips.length) {
      tips.push(
        "Looks strong. A unique password is best for every account."
      );
    }

    const labels = [
      "Very weak",
      "Weak",
      "Fair",
      "Strong",
      "Very strong"
    ];

    return {
      score,
      label: labels[score],
      entropy,
      tips,
      size,
      unique
    };
  }

  function setMeter(element, score) {
    if (!element) return;
    element.style.width = `${score * 25}%`;
  }

  /* ---------------- HISTORY ---------------- */

  function loadHistory(kind) {
    try {
      const value = sessionStorage.getItem(HISTORY_KEYS[kind]);

      if (!value) return [];

      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(kind, list) {
    try {
      sessionStorage.setItem(
        HISTORY_KEYS[kind],
        JSON.stringify(list.slice(0, MAX_HISTORY))
      );
    } catch {}
  }

  function addToHistory(kind, value) {
    if (!value || !HISTORY_KEYS[kind]) return;

    const list = loadHistory(kind);
    const filtered = list.filter(item => item !== value);

    filtered.unshift(value);

    saveHistory(kind, filtered);
    renderHistory(kind);
  }

  function clearHistory(kind) {
    try {
      sessionStorage.removeItem(HISTORY_KEYS[kind]);
    } catch {}

    renderHistory(kind);
  }

  function historyElementId(kind) {
    if (kind === "password") return "passwordHistory";
    if (kind === "phrase") return "phraseHistory";
    if (kind === "pin") return "pinHistory";
    return null;
  }

  function historyEmptyText(kind) {
    if (kind === "password") {
      return "No passwords generated yet this session.";
    }

    if (kind === "phrase") {
      return "No passphrases generated yet this session.";
    }

    return "No PINs generated yet this session.";
  }

  function renderHistory(kind) {
    const element = $(historyElementId(kind));

    if (!element) return;

    const list = loadHistory(kind);

    element.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("li");

      empty.className = "history-empty";
      empty.textContent = historyEmptyText(kind);

      element.appendChild(empty);
      return;
    }

    list.forEach(value => {
      const item = document.createElement("li");
      item.className = "history-item";

      const code = document.createElement("code");
      code.textContent = value;

      const button = document.createElement("button");

      button.type = "button";
      button.className = "mini-copy";
      button.textContent = "Copy";

      button.addEventListener("click", () => {
        copyText(value, button);
      });

      item.append(code, button);
      element.appendChild(item);
    });
  }

  /* ---------------- PASSWORD DISPLAY ---------------- */

  function updateStrength(password) {
    const result = analyze(password);

    if ($("strengthText")) {
      $("strengthText").textContent = result.label;
    }

    if ($("entropyText")) {
      $("entropyText").textContent =
        `${Math.round(result.entropy)} bits`;
    }

    setMeter($("strengthBar"), result.score);
  }

  function generate() {
    const error = $("generatorError");

    if (error) {
      error.textContent = "";
    }

    try {
      const value = generatePassword(
        Number($("length").value)
      );

      $("passwordOutput").textContent = value;

      updateStrength(value);

      try {
        sessionStorage.setItem(
          CURRENT_PASSWORD_KEY,
          value
        );
      } catch {}

      addToHistory("password", value);
    } catch (e) {
      if (error) {
        error.textContent =
          e instanceof Error
            ? e.message
            : "Unable to generate password.";
      }
    }
  }

  function restoreCurrentPassword() {
    try {
      const saved =
        sessionStorage.getItem(
          CURRENT_PASSWORD_KEY
        );

      if (
        saved &&
        $("passwordOutput")
      ) {
        $("passwordOutput").textContent = saved;
        updateStrength(saved);

        return true;
      }
    } catch {}

    return false;
  }

  function clearCurrentPassword() {
    try {
      sessionStorage.removeItem(
        CURRENT_PASSWORD_KEY
      );
    } catch {}
  }

  /* ---------------- COPY ---------------- */

  async function copyText(text, button) {
    if (
      !text ||
      text === "—" ||
      text === "Generating…"
    ) {
      return;
    }

    if (
      !navigator.clipboard ||
      !navigator.clipboard.writeText
    ) {
      showCopyState(button, "Copy failed", true);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showCopyState(button, "Copied!", false);
    } catch {
      showCopyState(button, "Copy failed", true);
    }
  }

  function showCopyState(button, text, failed) {
    if (!button) return;

    const oldText = button.textContent;

    button.textContent = text;

    button.classList.toggle("is-copied", !failed);
    button.classList.toggle("is-copy-failed", failed);

    setTimeout(() => {
      button.textContent = oldText;
      button.classList.remove(
        "is-copied",
        "is-copy-failed"
      );
    }, 1200);
  }

  /* ---------------- PASSPHRASE ---------------- */

  function parseCustomWords(text) {
    return text
      .split(/[\n,]+/)
      .map(word => word.trim())
      .filter(Boolean);
  }

  function activeWordList() {
    const toggle = $("useCustomWords");

    if (toggle?.checked) {
      const list = parseCustomWords(
        $("customWordsInput")?.value || ""
      );

      if (list.length >= 4) {
        return list;
      }
    }

    return words;
  }

  function phrase() {
    const count = Number(
      $("wordCount").value
    );

    const list = activeWordList();

    const chosen = Array.from(
      { length: count },
      () => list[randomInt(list.length)]
    );

    const capitalize =
      $("capitalizeWords").checked;

    const separator =
      $("separator").value;

    return chosen
      .map(word => {
        if (!capitalize) return word;

        return (
          word[0].toUpperCase() +
          word.slice(1)
        );
      })
      .join(separator);
  }

  function generatePhrase() {
    try {
      const value = phrase();

      $("phraseOutput").textContent = value;

      addToHistory("phrase", value);

      return value;
    } catch {
      $("phraseOutput").textContent = "Error";
      return "";
    }
  }

  /* ---------------- PIN ---------------- */

  function pin() {
    const length =
      Number($("pinLength").value);

    const avoid =
      $("noSequential").checked;

    let result = "";

    for (let i = 0; i < length; i++) {
      let digit;
      let attempts = 0;

      do {
        digit = String(randomInt(10));
        attempts++;

        if (attempts > 100) break;

      } while (
        avoid &&
        i >= 2 &&
        (
          (
            result[i - 1] ===
              String(
                (Number(result[i - 2]) + 1) % 10
              ) &&
            digit ===
              String(
                (Number(result[i - 1]) + 1) % 10
              )
          ) ||
          (
            result[i - 2] === result[i - 1] &&
            digit === result[i - 1]
          )
        )
      );

      result += digit;
    }

    return result;
  }

  function generatePin() {
    try {
      const value = pin();

      $("pinOutput").textContent = value;

      addToHistory("pin", value);

      return value;
    } catch {
      $("pinOutput").textContent = "Error";
      return "";
    }
  }

  /* ---------------- ANALYSIS UI ---------------- */

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"']/g,
      character =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[character]
    );
  }

  function renderAnalysis() {
    const input = $("analyzeInput");

    if (!input) return;

    const result = analyze(input.value);

    $("analysisResult").hidden = false;

    $("analysisStrength").textContent =
      result.label;

    $("analysisEntropy").textContent =
      `${Math.round(result.entropy)} bits`;

    setMeter(
      $("analysisBar"),
      result.score
    );

    $("analysisTips").innerHTML =
      result.tips
        .map(tip => `<li>${escapeHtml(tip)}</li>`)
        .join("");

    $("analysisStats").innerHTML = `
      <div class="stat">
        <b>${input.value.length}</b>
        <small>characters</small>
      </div>

      <div class="stat">
        <b>${result.unique}</b>
        <small>unique chars</small>
      </div>

      <div class="stat">
        <b>${result.size || "—"}</b>
        <small>estimated charset</small>
      </div>
    `;
  }

  /* ---------------- RANGE CONTROLS ---------------- */

  if ($("length")) {
    $("length").addEventListener("input", () => {
      $("lengthValue").textContent =
        $("length").value;
    });

    $("length").addEventListener("change", () => {
      clearCurrentPassword();
    });
  }

  if ($("wordCount")) {
    $("wordCount").addEventListener("input", () => {
      $("wordCountValue").textContent =
        $("wordCount").value;
    });
  }

  if ($("pinLength")) {
    $("pinLength").addEventListener("input", () => {
      $("pinLengthValue").textContent =
        $("pinLength").value;
    });
  }

  Object.values(checks).forEach(check => {
    if (!check) return;

    check.addEventListener("change", () => {
      clearCurrentPassword();
    });
  });

  /* ---------------- PASSWORD BUTTONS ---------------- */

  $("generateBtn")?.addEventListener(
    "click",
    generate
  );

  $("copyPassword")?.addEventListener(
    "click",
    () => {
      copyText(
        $("passwordOutput").textContent,
        $("copyPassword")
      );
    }
  );

  document
    .querySelectorAll(".preset[data-preset]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const preset = button.dataset.preset;

        checks.uppercase.checked = true;
        checks.lowercase.checked = true;
        checks.numbers.checked = true;
        checks.symbols.checked = true;
        checks.ambiguous.checked = true;

        if (preset === "strong") {
          $("length").value = 20;
        }

        if (preset === "maximum") {
          $("length").value = 32;
        }

        if (preset === "easy") {
          $("length").value = 16;
          checks.symbols.checked = false;
        }

        if (preset === "alphanumeric") {
          $("length").value = 20;
          checks.symbols.checked = false;
        }

        if (preset === "ultra") {
          $("length").value = 64;
        }

        $("lengthValue").textContent =
          $("length").value;

        generate();
      });
    });

  /* ---------------- BATCH ---------------- */

  document
    .querySelectorAll(".batch")
    .forEach(button => {
      button.addEventListener("click", () => {
        const box = $("batchOutput");

        if (!box) return;

        box.hidden = false;
        box.innerHTML = "";

        const count =
          Number(button.dataset.count);

        try {
          for (let i = 0; i < count; i++) {
            const value =
              generatePassword(
                Number($("length").value)
              );

            addToHistory("password", value);

            const row =
              document.createElement("div");

            row.className = "batch-item";

            const code =
              document.createElement("code");

            code.textContent = value;

            const copyButton =
              document.createElement("button");

            copyButton.type = "button";
            copyButton.className = "mini-copy";
            copyButton.textContent = "Copy";

            copyButton.addEventListener(
              "click",
              () => copyText(value, copyButton)
            );

            row.append(code, copyButton);
            box.appendChild(row);
          }
        } catch (error) {
          box.textContent =
            error instanceof Error
              ? error.message
              : "Unable to generate batch.";
        }
      });
    });

  /* ---------------- HISTORY CLEAR ---------------- */

  $("clearPasswordHistory")?.addEventListener(
    "click",
    () => clearHistory("password")
  );

  $("clearPhraseHistory")?.addEventListener(
    "click",
    () => clearHistory("phrase")
  );

  $("clearPinHistory")?.addEventListener(
    "click",
    () => clearHistory("pin")
  );

  /* ---------------- PIN PRESETS ---------------- */

  document
    .querySelectorAll(".pin-preset")
    .forEach(button => {
      button.addEventListener("click", () => {
        $("pinLength").value =
          button.dataset.pinlen;

        $("pinLengthValue").textContent =
          $("pinLength").value;

        generatePin();
      });
    });

  /* ---------------- PASSPHRASE PRESETS ---------------- */

  document
    .querySelectorAll(".phrase-preset")
    .forEach(button => {
      button.addEventListener("click", () => {
        $("wordCount").value =
          button.dataset.words;

        $("wordCountValue").textContent =
          $("wordCount").value;

        generatePhrase();
      });
    });

  /* ---------------- CUSTOM WORDS ---------------- */

  function validateCustomWords() {
    const input = $("customWordsInput");

    if (!input) return;

    const list = parseCustomWords(input.value);

    $("customWordsError").textContent =
      input.value.trim() && list.length < 4
        ? "Enter at least 4 words."
        : "";

    try {
      localStorage.setItem(
        CUSTOM_WORDS_KEY,
        JSON.stringify(list)
      );
    } catch {}
  }

  $("useCustomWords")?.addEventListener(
    "change",
    () => {
      const enabled =
        $("useCustomWords").checked;

      $("customWordsBlock")
        ?.classList.toggle(
          "hidden",
          !enabled
        );

      try {
        localStorage.setItem(
          USE_CUSTOM_WORDS_KEY,
          enabled ? "1" : "0"
        );
      } catch {}
    }
  );

  $("customWordsInput")?.addEventListener(
    "input",
    validateCustomWords
  );

  try {
    const savedWords =
      JSON.parse(
        localStorage.getItem(
          CUSTOM_WORDS_KEY
        )
      );

    if (
      Array.isArray(savedWords) &&
      savedWords.length &&
      $("customWordsInput")
    ) {
      $("customWordsInput").value =
        savedWords.join(", ");
    }
  } catch {}

  try {
    if (
      localStorage.getItem(
        USE_CUSTOM_WORDS_KEY
      ) === "1"
    ) {
      $("useCustomWords").checked = true;

      $("customWordsBlock")
        ?.classList.remove("hidden");
    }
  } catch {}

  /* ---------------- PASSPHRASE BUTTONS ---------------- */

  $("generatePhraseBtn")?.addEventListener(
    "click",
    generatePhrase
  );

  $("copyPhrase")?.addEventListener(
    "click",
    () => {
      copyText(
        $("phraseOutput").textContent,
        $("copyPhrase")
      );
    }
  );

  /* ---------------- PIN BUTTONS ---------------- */

  $("generatePinBtn")?.addEventListener(
    "click",
    generatePin
  );

  $("copyPin")?.addEventListener(
    "click",
    () => {
      copyText(
        $("pinOutput").textContent,
        $("copyPin")
      );
    }
  );

  /* ---------------- ANALYZER ---------------- */

  $("analyzeInput")?.addEventListener(
    "input",
    renderAnalysis
  );

  $("analyzeGenerate")?.addEventListener(
    "click",
    () => {
      try {
        const value =
          generatePassword(24);

        $("analyzeInput").value =
          value;

        renderAnalysis();
      } catch {}
    }
  );

  /* ---------------- KEYBOARD SHORTCUT ---------------- */

  document.addEventListener(
    "keydown",
    event => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        generate();
      }
    }
  );

  /* ---------------- THEME ---------------- */

  function applyTheme(theme) {
    const isLight = theme === "light";

    if (isLight) {
      document.documentElement.setAttribute(
        "data-theme",
        "light"
      );
    } else {
      document.documentElement.removeAttribute(
        "data-theme"
      );
    }

    const button = $("themeBtn");

    if (button) {
      button.textContent =
        isLight ? "☀" : "☾";

      button.setAttribute(
        "aria-label",
        isLight
          ? "Switch to dark mode"
          : "Switch to light mode"
      );

      button.setAttribute(
        "title",
        isLight
          ? "Switch to dark mode"
          : "Switch to light mode"
      );

      button.setAttribute(
        "aria-pressed",
        String(isLight)
      );
    }

    const themeMeta =
      document.querySelector(
        'meta[name="theme-color"]'
      );

    if (themeMeta) {
      themeMeta.setAttribute(
        "content",
        isLight ? "#f4f6f8" : "#080b10"
      );
    }
  }

  let savedTheme = "dark";

  try {
    if (
      localStorage.getItem(THEME_KEY) ===
      "light"
    ) {
      savedTheme = "light";
    }
  } catch {}

  applyTheme(savedTheme);

  $("themeBtn")?.addEventListener(
    "click",
    () => {
      const isLight =
        document.documentElement.getAttribute(
          "data-theme"
        ) === "light";

      const nextTheme =
        isLight ? "dark" : "light";

      applyTheme(nextTheme);

      try {
        localStorage.setItem(
          THEME_KEY,
          nextTheme
        );
      } catch {}
    }
  );

  /* ---------------- PWA INSTALL ---------------- */

  let deferredInstallPrompt = null;

  window.addEventListener(
    "beforeinstallprompt",
    event => {
      event.preventDefault();

      deferredInstallPrompt = event;

      const button = $("installBtn");

      if (button) {
        button.hidden = false;
        button.classList.remove("hidden");
      }
    }
  );

  $("installBtn")?.addEventListener(
    "click",
    async () => {
      if (!deferredInstallPrompt) {
        return;
      }

      deferredInstallPrompt.prompt();

      try {
        await deferredInstallPrompt.userChoice;
      } catch {}

      deferredInstallPrompt = null;

      $("installBtn").hidden = true;
    }
  );

  window.addEventListener(
    "appinstalled",
    () => {
      deferredInstallPrompt = null;

      const button = $("installBtn");

      if (button) {
        button.hidden = true;
      }
    }
  );

  /* ---------------- SERVICE WORKER ---------------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("./sw.js")
          .catch(() => {});
      }
    );
  }

  /* ---------------- INITIAL STATE ---------------- */

  if ($("lengthValue")) {
    $("lengthValue").textContent =
      $("length").value;
  }

  if ($("wordCountValue")) {
    $("wordCountValue").textContent =
      $("wordCount").value;
  }

  if ($("pinLengthValue")) {
    $("pinLengthValue").textContent =
      $("pinLength").value;
  }

  renderHistory("password");
  renderHistory("phrase");
  renderHistory("pin");

  /*
   * Restore the existing password after a
   * normal page refresh. Only generate a new
   * password when there is nothing to restore.
   */
  if (!restoreCurrentPassword()) {
    generate();
  }

  generatePhrase();
  generatePin();

})();

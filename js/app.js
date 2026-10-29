/**
 * app.js
 * Multi-Set Vault UI, PDF-to-Mock Engine, Mistake Notebook, Analytics & KaTeX integration
 */
const App = {
  init() {
    StorageManager.getDB();
    this.loadSavedApiKey();
    this.renderHeaderStats();
    this.renderMistakeNotebook();
    this.renderTestSetsVault();
    this.renderAnalytics();
    this.updateSetFilterDropdown();
  },

  // KaTeX helper
  renderMath(container) {
    if (window.renderMathInElement && container) {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  },

  loadSavedApiKey() {
    const keyInput = document.getElementById("gemini-api-key-input");
    const saved = localStorage.getItem("gemini_api_key");
    if (keyInput && saved) {
      keyInput.value = saved;
    }
  },

  saveApiKeyFromUI() {
    const keyInput = document.getElementById("gemini-api-key-input");
    if (!keyInput) return;
    const key = keyInput.value.trim();
    if (!key) {
      this.showToast("Kripya valid API Key enter karein!", "error");
      return;
    }
    localStorage.setItem("gemini_api_key", key);
    this.showToast("Gemini API Key successfully save ho gayi!", "success");
  },

  formatDuration(seconds) {
    const sec = Math.max(0, Math.round(seconds || 0));
    if (sec === 0) return "--";
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  },

  renderHeaderStats() {
    const progress = StorageManager.getUserProgress();
    document.getElementById("streak-count").textContent = progress.streak || 1;
    this.updateBadges();
  },

  updateBadges() {
    const progress = StorageManager.getUserProgress();
    const count = (progress.incorrectQuestionIds || []).length;
    const mistakeBadge = document.getElementById("mistake-count-badge");
    if (mistakeBadge) mistakeBadge.textContent = count;
    const notebookBadge = document.getElementById("notebook-count-badge");
    if (notebookBadge) notebookBadge.textContent = `${count} prashn`;
  },

  // Setup tab ke dropdown ko update karein jisme saare sets date ke sath dikhein
  updateSetFilterDropdown() {
    const dropdown = document.getElementById("quiz-set-select");
    if (!dropdown) return;

    const sets = StorageManager.getAllTestSets();
    const currentSelected = dropdown.value;

    dropdown.innerHTML = `<option value="all">📁 Sabhi Files Mix (${StorageManager.getAllQuestions().length} Sawal)</option>`;

    sets.forEach(s => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.title} [${s.subject}] • (${s.questions.length} sawal - ${s.uploadDate})`;
      dropdown.appendChild(option);
    });

    if (currentSelected && sets.some(s => s.id === currentSelected)) {
      dropdown.value = currentSelected;
    }
  },

  showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "fixed bottom-5 right-5 z-50 transform transition-all duration-300 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold";

    if (type === "success") toast.classList.add("bg-emerald-600");
    else if (type === "error") toast.classList.add("bg-rose-600");
    else toast.classList.add("bg-slate-800");

    toast.classList.remove("translate-y-20", "opacity-0", "pointer-events-none");
    setTimeout(() => {
      toast.classList.add("translate-y-20", "opacity-0", "pointer-events-none");
    }, 3200);
  },

  switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.remove("bg-white", "text-brand-700", "shadow-sm", "border", "border-slate-200");
      btn.classList.add("text-slate-600");
    });

    const activeSection = document.getElementById(`tab-${tabId}`);
    if (activeSection) activeSection.classList.remove("hidden");

    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
      activeNav.classList.add("bg-white", "text-brand-700", "shadow-sm", "border", "border-slate-200");
      activeNav.classList.remove("text-slate-600");
    }

    if (tabId === "quiz") this.updateSetFilterDropdown();
    if (tabId === "notebook") this.renderMistakeNotebook();
    if (tabId === "bank") this.renderTestSetsVault();
    if (tabId === "stats") this.renderAnalytics();
  },

  startMistakesOnlyQuiz() {
    const mistakes = StorageManager.getUserProgress().incorrectQuestionIds || [];
    if (mistakes.length === 0) {
      this.showToast("Review ke liye koi galat sawal nahi hai!", "info");
      return;
    }
    this.switchTab("quiz");
    document.getElementById("quiz-mode-select").value = "mistakes";
    QuizEngine.startQuiz();
  },

  renderMistakeNotebook() {
    const container = document.getElementById("mistakes-list");
    if (!container) return;
    container.innerHTML = "";

    const mistakes = new Set(StorageManager.getUserProgress().incorrectQuestionIds || []);
    const questions = StorageManager.getAllQuestions();
    const mistakeQuestions = questions.filter(q => mistakes.has(q.id));

    if (mistakeQuestions.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h3 class="font-bold text-slate-800 text-lg">Shaandaar! Koi galti baki nahi hai</h3>
          <p class="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Jab aap test denge aur koi sawal galat hoga, toh wo yahan automatic revision ke liye aa jayega.</p>
        </div>
      `;
      return;
    }

    mistakeQuestions.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3";
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">Galti #${idx + 1}</span>
            <span class="text-xs text-slate-400 font-medium">${q.subject || "General"} • ${q.topic || "Topic"}</span>
          </div>
          <button onclick="App.resolveMistake('${q.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Revision Purna (Resolved)
          </button>
        </div>

        <p class="text-slate-800 font-medium text-sm sm:text-base leading-relaxed">${q.question}</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          ${q.options.map((opt, oIdx) => `
            <div class="p-2.5 rounded-lg border ${oIdx === q.answer ? "border-emerald-400 bg-emerald-50/50 text-emerald-900 font-semibold" : "border-slate-200 bg-slate-50 text-slate-600"}">
              <span class="font-bold mr-1">${String.fromCharCode(65 + oIdx)}.</span><span>${opt}</span>
            </div>
          `).join("")}
        </div>

        <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-slate-700">
          <span class="font-bold text-amber-800 block mb-1">💡 Solution & Explanation:</span>
          <p class="whitespace-pre-line leading-relaxed">${q.explanation || "Uttar: Vikalp " + String.fromCharCode(65 + q.answer)}</p>
        </div>
      `;
      container.appendChild(card);
    });

    this.renderMath(container);
  },

  resolveMistake(id) {
    StorageManager.removeMistake(id);
    this.updateBadges();
    this.renderMistakeNotebook();
    this.showToast("Prashn ko sudhara hua maan liya gaya!", "success");
  },

  clearResolvedMistakesPrompt() {
    if (confirm("Kya aap sabhi galat sawalon ki list saaf karna chahte hain?")) {
      StorageManager.clearAllMistakes();
      this.updateBadges();
      this.renderMistakeNotebook();
      this.showToast("Mistake notebook khali kar di gayi.", "info");
    }
  },

  // TAB 3: Alag-Alag Uploaded Files/Sets ka Vault Render Karein
  renderTestSetsVault() {
    const container = document.getElementById("bank-list-container");
    const statsText = document.getElementById("bank-stats-text");
    if (!container) return;

    const sets = StorageManager.getAllTestSets();
    const totalQ = StorageManager.getAllQuestions().length;

    if (statsText) {
      statsText.textContent = `Total Uploaded Sets: ${sets.length} | Kul Sawal: ${totalQ}`;
    }

    container.innerHTML = "";

    if (sets.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Koi test set uplabdh nahi hai. Upar se PDF ya JSON upload karein.</p>`;
      return;
    }

    sets.forEach(set => {
      const card = document.createElement("div");
      card.className = "p-5 rounded-2xl border border-slate-200 hover:border-brand-200 bg-white shadow-sm space-y-4 transition";

      const badgeColor = set.sourceType === "PDF" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200";

      card.innerHTML = `
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded text-xs font-bold border ${badgeColor}">${set.sourceType}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">${set.subject}</span>
              <span class="text-xs text-slate-400">📅 ${set.uploadDate}</span>
            </div>
            <h4 class="font-bold text-slate-800 text-base">${set.title}</h4>
            <p class="text-xs text-slate-500 mt-0.5">Total Questions: <span class="font-semibold text-slate-700">${set.questions.length}</span></p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="QuizEngine.startSetQuiz('${set.id}')" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5">
              <span>▶</span> Iska Test Dein
            </button>
            <button onclick="App.confirmDeleteSet('${set.id}', '${set.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-xs font-medium border border-slate-200 transition" title="Set Delete Karein">
              🗑️
            </button>
          </div>
        </div>

        <!-- Sample Questions Preview (First 2 questions) -->
        <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 space-y-1.5">
          <span class="font-semibold text-slate-500 block text-[11px] uppercase tracking-wider">Preview (Pehle 2 Sawal):</span>
          ${set.questions.slice(0, 2).map((q, qIdx) => `
            <div class="truncate">
              <span class="font-bold text-slate-700">Q${qIdx + 1}.</span>${q.question}
            </div>
          `).join("")}
        </div>
      `;
      container.appendChild(card);
    });

    this.renderMath(container);
  },

  confirmDeleteSet(setId, title) {
    if (confirm(`Kya aap set "${title}" ko delete karna chahte hain? Iske sawal aur iski mistakelist hata di jayegi.`)) {
      StorageManager.deleteTestSet(setId);
      this.renderTestSetsVault();
      this.updateSetFilterDropdown();
      this.updateBadges();
      this.showToast("Set kamyabi se delete ho gaya!", "success");
    }
  },

  // 1. JSON File Upload (As a dedicated set)
  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
        const sub = parsed.subject || "General";

        const newSet = StorageManager.addNewTestSet(cleanTitle, sub, questionsList, "JSON");
        this.renderTestSetsVault();
        this.updateSetFilterDropdown();
        this.showToast(`Naya set "${newSet.title}" (${newSet.questions.length} sawal) add ho gaya!`, "success");
      } catch (err) {
        this.showToast("Invalid JSON file format!", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  },

  // 2. Direct PDF Upload with Gemini AI & PDF.js
  async handlePdfToMock(event) {
    const file = event.target.files[0];
    if (!file) return;

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      this.showToast("Pehle Gemini API Key dalein aur Save karein!", "error");
      document.getElementById("api-key-setup-box")?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const statusText = document.getElementById("pdf-status-text");
    if (statusText) {
      statusText.classList.remove("hidden");
      statusText.textContent = "⏳ PDF se prashn nikaale ja rahe hain...";
    }

    try {
      // PDF.js Text Extraction
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let rawText = "";

      const maxPages = Math.min(pdf.numPages, 6); // Pehle 6 pages
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        rawText += textContent.items.map(item => item.str).join(" ") + "\n";
      }

      if (statusText) statusText.textContent = "🤖 AI Multiple-Choice Questions prepare kar raha hai...";

      const prompt = `
Extract all multiple-choice questions from this study sheet text. Return ONLY a valid JSON array adhering strictly to this schema:
[
  {
    "id": "PDF_Q1",
    "subject": "Maths",
    "topic": "General",
    "question": "Question text in Hindi or English (use $...$ for inline math or formulas if applicable)",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0,
    "explanation": "Detailed explanation"
  }
]
Rules:
- "answer" must be the zero-based index of correct option (0 for A, 1 for B, 2 for C, 3 for D).
- Output strictly raw JSON only. No markdown formatting, no backticks, no comments.

Content:
${rawText.slice(0, 10000)}
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      if (!data.candidates || !data.candidates[0]) {
        throw new Error("AI response format error");
      }

      let resText = data.candidates[0].content.parts[0].text.trim();
      resText = resText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

      const questions = JSON.parse(resText);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

      // Alag set ke roop me save karein
      const newSet = StorageManager.addNewTestSet(cleanTitle, questions[0]?.subject || "PDF Mock", questions, "PDF");

      if (statusText) statusText.textContent = `✅ ${newSet.questions.length} sawal tayyar! Test shuru ho raha hai...`;

      this.renderTestSetsVault();
      this.updateSetFilterDropdown();

      setTimeout(() => {
        if (statusText) statusText.classList.add("hidden");
        QuizEngine.startSetQuiz(newSet.id);
      }, 1200);

    } catch (err) {
      console.error(err);
      if (statusText) statusText.textContent = "❌ PDF parse karne me error aaya. Kripya check karein text readable hai ya nahi.";
      this.showToast("PDF parsing error! Check API key or PDF text.", "error");
    }

    event.target.value = "";
  },

  openPasteModal() {
    document.getElementById("paste-json-modal").classList.remove("hidden");
  },

  closePasteModal() {
    document.getElementById("paste-json-modal").classList.add("hidden");
  },

  importFromPastedText() {
    const text = document.getElementById("json-paste-area").value.trim();
    if (!text) {
      this.showToast("Kripya pehle JSON data paste karein.", "error");
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      const title = `Pasted Set (${new Date().toLocaleTimeString("hi-IN", { hour: '2-digit', minute: '2-digit' })})`;
      
      const newSet = StorageManager.addNewTestSet(title, "General", questionsList, "JSON");
      this.closePasteModal();
      document.getElementById("json-paste-area").value = "";
      this.renderTestSetsVault();
      this.updateSetFilterDropdown();
      this.showToast(`Naya set "${newSet.title}" jod diya gaya!`, "success");
    } catch (err) {
      this.showToast("JSON format galat hai!", "error");
    }
  },

  restoreDefaultQuestions() {
    if (confirm("Kya aap default questions restore karna chahte hain?")) {
      StorageManager.restoreDefaults();
      this.renderTestSetsVault();
      this.updateSetFilterDropdown();
      this.showToast("Default questions restore ho gaye!", "success");
    }
  },

  renderAnalytics() {
    const progress = StorageManager.getUserProgress();
    const history = progress.history || [];

    const totalSolved = progress.totalAttempted || 0;
    const totalCorrect = history.reduce((acc, curr) => acc + (curr.correct || 0), 0);
    const overallAcc = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

    document.getElementById("stat-tests-count").textContent = history.length;
    document.getElementById("stat-total-solved").textContent = totalSolved;
    document.getElementById("stat-overall-accuracy").textContent = `${overallAcc}%`;
    document.getElementById("stat-streak-display").textContent = `${progress.streak || 1} din 🔥`;

    const historyContainer = document.getElementById("history-table-container");
    if (!historyContainer) return;

    if (history.length === 0) {
      historyContainer.innerHTML = `<p class="text-sm text-slate-400 py-4 text-center">Abhi tak koi test record nahi hai.</p>`;
      return;
    }

    historyContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 uppercase font-semibold text-xs">
              <th class="py-2.5">Date / Time</th>
              <th class="py-2.5">File / Set Name</th>
              <th class="py-2.5">Attempts</th>
              <th class="py-2.5">Correct</th>
              <th class="py-2.5">Wrong</th>
              <th class="py-2.5">Accuracy</th>
              <th class="py-2.5">Time Taken</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${history.map(item => `
              <tr>
                <td class="py-2.5 text-slate-500">${new Date(item.date).toLocaleDateString("hi-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td class="py-2.5 font-semibold text-slate-800">${item.setName || "Mixed Test"}</td>
                <td class="py-2.5 font-medium text-slate-700">${item.total}</td>
                <td class="py-2.5 font-semibold text-emerald-600">${item.correct}</td>
                <td class="py-2.5 font-semibold text-rose-600">${item.wrong}</td>
                <td class="py-2.5">
                  <span class="px-2 py-0.5 rounded-full text-xs font-bold ${item.accuracy >= 70 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
                    ${item.accuracy}%
                  </span>
                </td>
                <td class="py-2.5 font-medium text-slate-600">
                  <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                    ⏱️ ${item.totalTimeTaken ? this.formatDuration(item.totalTimeTaken) : "--"}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  clearHistoryLog() {
    if (confirm("Kya aap itihaas aur analytics saaf karna chahte hain?")) {
      StorageManager.clearHistory();
      this.renderAnalytics();
      this.showToast("History saaf kar di gayi.", "info");
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
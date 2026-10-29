/**
 * app.js
 * Multi-Set Vault UI, 100% Offline PDF-to-Mock Engine (No API Key Required),
 * Mistake Notebook, Analytics & KaTeX Auto-Rendering.
 */
const App = {
  init() {
    StorageManager.getDB();
    this.renderHeaderStats();
    this.renderMistakeNotebook();
    this.renderTestSetsVault();
    this.renderAnalytics();
    this.updateSetFilterDropdown();
  },

  // KaTeX formula render helper
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
    const streakEl = document.getElementById("streak-count");
    if (streakEl) streakEl.textContent = progress.streak || 1;
    this.updateBadges();
  },

  updateBadges() {
    const progress = StorageManager.getUserProgress();
    const count = (progress.incorrectQuestionIds || []).length;
    const mistakeBadge = document.getElementById("mistake-count-badge");
    if (mistakeBadge) mistakeBadge.textContent = count;
    const notebookBadge = document.getElementById("notebook-count-badge");
    if (notebookBadge) notebookBadge.textContent = `${count} प्रश्न`;
  },

  updateSetFilterDropdown() {
    const dropdown = document.getElementById("quiz-set-select");
    if (!dropdown) return;

    const sets = StorageManager.getAllTestSets();
    const currentSelected = dropdown.value;

    dropdown.innerHTML = `<option value="all">📁 सभी फाइल्स मिक्स (${StorageManager.getAllQuestions().length} सवाल)</option>`;

    sets.forEach(s => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.title} [${s.subject}] • (${s.questions.length} सवाल - ${s.uploadDate})`;
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
    }, 3500);
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
      this.showToast("रिवीजन के लिए कोई गलत सवाल नहीं बचा है!", "info");
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
          <h3 class="font-bold text-slate-800 text-lg">शानदार! कोई गलती बकाया नहीं है</h3>
          <p class="text-slate-500 text-sm mt-1 max-w-sm mx-auto">जब आप टेस्ट देंगे और कोई सवाल गलत होगा, तो वह स्वतः यहाँ रिवीजन के लिए दर्ज हो जाएगा।</p>
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
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">गलती #${idx + 1}</span>
            <span class="text-xs text-slate-400 font-medium">${q.subject || "General"} • ${q.topic || "Topic"}</span>
          </div>
          <button onclick="App.resolveMistake('${q.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            रिवीजन पूर्ण (Resolved)
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
          <span class="font-bold text-amber-800 block mb-1">💡 सही हल / व्याख्या:</span>
          <p class="whitespace-pre-line leading-relaxed">${q.explanation || "उत्तर: विकल्प " + String.fromCharCode(65 + q.answer)}</p>
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
    this.showToast("प्रश्न को सुधारा हुआ मान लिया गया!", "success");
  },

  clearResolvedMistakesPrompt() {
    if (confirm("क्या आप सभी गलत सवालों की लिस्ट साफ़ करना चाहते हैं?")) {
      StorageManager.clearAllMistakes();
      this.updateBadges();
      this.renderMistakeNotebook();
      this.showToast("मिस्टेक नोटबुक खाली कर दी गई।", "info");
    }
  },

  renderTestSetsVault() {
    const container = document.getElementById("bank-list-container");
    const statsText = document.getElementById("bank-stats-text");
    if (!container) return;

    const sets = StorageManager.getAllTestSets();
    const totalQ = StorageManager.getAllQuestions().length;

    if (statsText) {
      statsText.textContent = `कुल अपलोड सेट: ${sets.length} | कुल सवाल: ${totalQ}`;
    }

    container.innerHTML = "";

    if (sets.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">कोई टेस्ट सेट उपलब्ध नहीं है। ऊपर से PDF या JSON अपलोड करें।</p>`;
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
            <p class="text-xs text-slate-500 mt-0.5">कुल प्रश्न: <span class="font-semibold text-slate-700">${set.questions.length}</span></p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="QuizEngine.startSetQuiz('${set.id}')" class="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5">
              <span>▶</span> इसका टेस्ट दें
            </button>
            <button onclick="App.confirmDeleteSet('${set.id}', '${set.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-xs font-medium border border-slate-200 transition" title="सेट डिलीट करें">
              🗑️
            </button>
          </div>
        </div>

        <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 space-y-1.5">
          <span class="font-semibold text-slate-500 block text-[11px] uppercase tracking-wider">Preview (पहले 2 सवाल):</span>
          ${set.questions.slice(0, 2).map((q, qIdx) => `
            <div class="truncate">
              <span class="font-bold text-slate-700">Q${qIdx + 1}.</span> ${q.question}
            </div>
          `).join("")}
        </div>
      `;
      container.appendChild(card);
    });

    this.renderMath(container);
  },

  confirmDeleteSet(setId, title) {
    if (confirm(`क्या आप सेट "${title}" को डिलीट करना चाहते हैं? इसके सभी सवाल और मिस्टेक्स हटा दिए जाएंगे।`)) {
      StorageManager.deleteTestSet(setId);
      this.renderTestSetsVault();
      this.updateSetFilterDropdown();
      this.updateBadges();
      this.showToast("सेट सफलतापूर्वक हटा दिया गया!", "success");
    }
  },

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
        this.showToast(`नया सेट "${newSet.title}" जोड़ा गया!`, "success");
      } catch (err) {
        this.showToast("अमान्य JSON फाइल प्रारूप!", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  },

  // 100% OFFLINE PARSER ENGINE
  parseQuestionsOffline(text, fileName) {
    const rawBlocks = text.split(/(?:\r?\n)+(?=(?:Q\.?\s*\d+|प्र\.?\s*\d+|प्रश्न\s*\d+|\b\d{1,3}[\.\)]\s*))/i);
    const questions = [];

    rawBlocks.forEach((blk, idx) => {
      const cleanBlock = blk.trim();
      if (!cleanBlock || cleanBlock.length < 15) return;

      const optMatches = [...cleanBlock.matchAll(/(?:\(([A-Da-d1-4])\)|(?:[A-Da-d1-4][\.\)]))\s*([^\n\(\)]+)/g)];

      if (optMatches.length >= 2) {
        const firstOptIndex = optMatches[0].index;
        const qText = cleanBlock.substring(0, firstOptIndex)
          .replace(/^(?:Q\.?\s*\d+|प्र\.?\s*\d+|प्रश्न\s*\d+|\b\d{1,3}[\.\)]\s*)[:\.\-]?\s*/i, "")
          .trim();

        const options = optMatches.slice(0, 4).map(m => m[2].trim());

        let answer = 0;
        const ansMatch = cleanBlock.match(/(?:Ans(?:wer)?|उत्तर|हल)\s*[:\-]?\s*\(?([A-Da-d1-4])/i);
        if (ansMatch) {
          const char = ansMatch[1].toUpperCase();
          if (["A", "1"].includes(char)) answer = 0;
          else if (["B", "2"].includes(char)) answer = 1;
          else if (["C", "3"].includes(char)) answer = 2;
          else if (["D", "4"].includes(char)) answer = 3;
        }

        if (qText.length > 3 && options.length >= 2) {
          questions.push({
            id: `PDF_SET_${Date.now()}_${idx + 1}`,
            subject: "PDF Mock",
            topic: fileName.replace(/\.[^/.]+$/, ""),
            question: qText,
            options: options,
            answer: answer,
            explanation: "PDF से स्वतः निकाला गया प्रश्न।",
            source: fileName
          });
        }
      }
    });

    return questions;
  },

  // Direct PDF Handler (Offline)
  async handlePdfToMock(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusText = document.getElementById("pdf-status-text");
    if (statusText) {
      statusText.classList.remove("hidden");
      statusText.textContent = "⏳ PDF से टेक्स्ट निकाला जा रहा है...";
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let rawText = "";

      const maxPages = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map(item => item.str).join(" ");
        rawText += pageStrings + "\n";
      }

      if (rawText.trim().length < 40) {
        throw new Error("SCANNED_PDF");
      }

      if (statusText) statusText.textContent = "⚡ सवालों और विकल्पों को अलग किया जा रहा है...";

      const parsedQuestions = this.parseQuestionsOffline(rawText, file.name);

      if (!parsedQuestions || parsedQuestions.length === 0) {
        throw new Error("NO_QUESTIONS_PARSED");
      }

      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
      const newSet = StorageManager.addNewTestSet(cleanTitle, "Practice Set", parsedQuestions, "PDF");

      if (statusText) statusText.textContent = `✅ ${newSet.questions.length} सवाल तैयार! टेस्ट शुरू हो रहा है...`;
      this.showToast(`${newSet.questions.length} सवालों का नया सेट तैयार हो गया!`, "success");

      this.renderTestSetsVault();
      this.updateSetFilterDropdown();

      setTimeout(() => {
        if (statusText) statusText.classList.add("hidden");
        QuizEngine.startSetQuiz(newSet.id);
      }, 1000);

    } catch (err) {
      console.error(err);
      if (err.message === "SCANNED_PDF") {
        this.showToast("यह स्कैन/फोटो वाली PDF है! कृपया डिजिटल टेक्स्ट PDF अपलोड करें।", "error");
        if (statusText) statusText.textContent = "❌ स्कैन/फोटो PDF का टेक्स्ट नहीं पढ़ा जा सकता।";
      } else {
        this.showToast("सवालों के विकल्प नहीं मिल सके। कृपया PDF फॉर्मेट चेक करें।", "error");
        if (statusText) statusText.textContent = "❌ सवालों के विकल्प नहीं पहचाने जा सके।";
      }
    }

    event.target.value = "";
  },

  openPasteModal() {
    const modal = document.getElementById("paste-json-modal");
    if (modal) modal.classList.remove("hidden");
  },

  closePasteModal() {
    const modal = document.getElementById("paste-json-modal");
    if (modal) modal.classList.add("hidden");
  },

  importFromPastedText() {
    const text = document.getElementById("json-paste-area").value.trim();
    if (!text) {
      this.showToast("कृपया पहले JSON डेटा पेस्ट करें।", "error");
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
      this.showToast(`नया सेट "${newSet.title}" जोड़ा गया!`, "success");
    } catch (err) {
      this.showToast("JSON फॉर्मेट गलत है!", "error");
    }
  },

  restoreDefaultQuestions() {
    if (confirm("क्या आप डिफ़ॉल्ट सवाल रीस्टोर करना चाहते हैं?")) {
      StorageManager.restoreDefaults();
      this.renderTestSetsVault();
      this.updateSetFilterDropdown();
      this.showToast("डिफ़ॉल्ट सवाल रीस्टोर हो गए!", "success");
    }
  },

  renderAnalytics() {
    const progress = StorageManager.getUserProgress();
    const history = progress.history || [];

    const totalSolved = progress.totalAttempted || 0;
    const totalCorrect = history.reduce((acc, curr) => acc + (curr.correct || 0), 0);
    const overallAcc = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

    const tCount = document.getElementById("stat-tests-count");
    if (tCount) tCount.textContent = history.length;
    const sCount = document.getElementById("stat-total-solved");
    if (sCount) sCount.textContent = totalSolved;
    const aCount = document.getElementById("stat-overall-accuracy");
    if (aCount) aCount.textContent = `${overallAcc}%`;
    const streakDisplay = document.getElementById("stat-streak-display");
    if (streakDisplay) streakDisplay.textContent = `${progress.streak || 1} दिन 🔥`;

    const historyContainer = document.getElementById("history-table-container");
    if (!historyContainer) return;

    if (history.length === 0) {
      historyContainer.innerHTML = `<p class="text-sm text-slate-400 py-4 text-center">अभी तक कोई टेस्ट रिकॉर्ड नहीं है।</p>`;
      return;
    }

    historyContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 uppercase font-semibold text-xs">
              <th class="py-2.5">दिनांक / समय</th>
              <th class="py-2.5">फाइल / सेट नाम</th>
              <th class="py-2.5">प्रयास</th>
              <th class="py-2.5">सही</th>
              <th class="py-2.5">गलत</th>
              <th class="py-2.5">सटीकता</th>
              <th class="py-2.5">समय</th>
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
    if (confirm("क्या आप इतिहास और एनालिटिक्स साफ़ करना चाहते हैं?")) {
      StorageManager.clearHistory();
      this.renderAnalytics();
      this.showToast("इतिहास साफ़ कर दिया गया।", "info");
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
/**
 * app.js
 * Tab routing, Mistake Notebook, Question Bank, Analytics, and JSON import modal
 */
const App = {
  init() {
    StorageManager.getDB();
    this.renderHeaderStats();
    this.renderMistakeNotebook();
    this.renderQuestionBankList();
    this.renderAnalytics();
    this.updateTopicFilterDropdown(); // नए टॉपिक फ़िल्टर ड्रॉपडाउन को इनिशियलाइज़ किया
  },

  renderHeaderStats() {
    const progress = StorageManager.getUserProgress();
    document.getElementById("streak-count").textContent = progress.streak || 1;
    this.updateBadges();
  },

  updateBadges() {
    const progress = StorageManager.getUserProgress();
    const count = (progress.incorrectQuestionIds || []).length;
    document.getElementById("mistake-count-badge").textContent = count;
    const notebookBadge = document.getElementById("notebook-count-badge");
    if (notebookBadge) notebookBadge.textContent = `${count} प्रश्न`;
  },

  // सभी उपलब्ध सवालों से यूनीक टॉपिक/सब्जेक्ट निकालकर ड्रॉपडाउन अपडेट करने का फ़ंक्शन
  updateTopicFilterDropdown() {
    const dropdown = document.getElementById("quiz-topic-select");
    if (!dropdown) return;

    const questions = StorageManager.getAllQuestions();
    
    // सभी टॉपिक्स की गिनती और सूची तैयार करें
    const topicCounts = {};
    questions.forEach(q => {
      const topicName = q.topic || q.subject || "अन्य";
      topicCounts[topicName] = (topicCounts[topicName] || 0) + 1;
    });

    const currentSelected = dropdown.value;
    dropdown.innerHTML = `<option value="all">सभी विषय एवं टॉपिक (${questions.length} सवाल)</option>`;

    Object.keys(topicCounts).sort().forEach(topic => {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = `${topic} (${topicCounts[topic]} सवाल)`;
      dropdown.appendChild(option);
    });

    if (currentSelected && topicCounts[currentSelected]) {
      dropdown.value = currentSelected;
    }
  },

  showToast(message, type = "info") {
    const toast = document.getElementById("toast");
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

    if (tabId === "quiz") this.updateTopicFilterDropdown();
    if (tabId === "notebook") this.renderMistakeNotebook();
    if (tabId === "bank") this.renderQuestionBankList();
    if (tabId === "stats") this.renderAnalytics();
  },

  startMistakesOnlyQuiz() {
    const mistakes = StorageManager.getUserProgress().incorrectQuestionIds || [];
    if (mistakes.length === 0) {
      this.showToast("समीक्षा के लिए कोई गलत सवाल नहीं बचा है!", "info");
      return;
    }
    this.switchTab("quiz");
    document.getElementById("quiz-mode-select").value = "mistakes";
    QuizEngine.startQuiz();
  },

  renderMistakeNotebook() {
    const container = document.getElementById("mistakes-list");
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
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">गलत हुआ प्रश्न #${idx + 1}</span>
            <span class="text-xs text-slate-400 font-medium">${q.subject || "Reasoning"} • ${q.topic || "Topic"}</span>
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
              <span class="font-bold mr-1">${String.fromCharCode(65 + oIdx)}.</span>${opt}
            </div>
          `).join("")}
        </div>

        <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-slate-700">
          <span class="font-bold text-amber-800 block mb-1">💡 सही हल / व्याख्या:</span>
          <p class="whitespace-pre-line">${q.explanation || "उत्तर: विकल्प " + String.fromCharCode(65 + q.answer)}</p>
        </div>
      `;
      container.appendChild(card);
    });
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

  renderQuestionBankList() {
    const container = document.getElementById("bank-list-container");
    const searchTerm = (document.getElementById("bank-search")?.value || "").toLowerCase().trim();
    const statsText = document.getElementById("bank-stats-text");

    const questions = StorageManager.getAllQuestions();
    const filtered = questions.filter(q =>
      q.question.toLowerCase().includes(searchTerm) ||
      (q.topic && q.topic.toLowerCase().includes(searchTerm)) ||
      (q.subject && q.subject.toLowerCase().includes(searchTerm))
    );

    statsText.textContent = `कुल उपलब्ध सवाल: ${questions.length} (दिख रहे हैं: ${filtered.length})`;
    container.innerHTML = "";

    if (filtered.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">कोई प्रश्न नहीं मिला।</p>`;
      return;
    }

    filtered.forEach((q, idx) => {
      const item = document.createElement("div");
      item.className = "p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 space-y-2";
      item.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <span class="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">#${q.id || (idx + 1)}</span>
          <span class="text-xs text-slate-400 font-medium">${q.subject || "Reasoning"} • ${q.topic || "Topic"}</span>
        </div>
        <p class="text-sm font-semibold text-slate-800">${q.question}</p>
        <div class="text-xs text-slate-500">
          सही उत्तर: <span class="font-bold text-emerald-600">${q.options[q.answer]}</span>
        </div>
      `;
      container.appendChild(item);
    });
  },

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const count = StorageManager.importQuestions(parsed);
        this.renderQuestionBankList();
        this.updateTopicFilterDropdown(); // नया टॉपिक जुड़ते ही ड्रॉपडाउन अपडेट
        this.showToast(`${count} सवाल सफलतापूर्वक इम्पोर्ट हुए!`, "success");
      } catch (err) {
        this.showToast("अमान्य JSON फाइल प्रारूप!", "error");
      }
    };
    reader.readAsText(file);
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
      this.showToast("कृपया पहले JSON डेटा पेस्ट करें।", "error");
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const count = StorageManager.importQuestions(parsed);
      this.closePasteModal();
      document.getElementById("json-paste-area").value = "";
      this.renderQuestionBankList();
      this.updateTopicFilterDropdown(); // नया टॉपिक जुड़ते ही ड्रॉपडाउन अपडेट
      this.showToast(`${count} सवाल सफलतापूर्वक जोड़े गए!`, "success");
    } catch (err) {
      this.showToast("JSON पार्स करने में त्रुटि! फॉर्मेट चेक करें।", "error");
    }
  },

  restoreDefaultQuestions() {
    if (confirm("क्या आप डिफ़ॉल्ट सवाल रीस्टोर करना चाहते हैं?")) {
      StorageManager.restoreDefaults();
      this.renderQuestionBankList();
      this.updateTopicFilterDropdown(); // डिफ़ॉल्ट रीस्टोर पर ड्रॉपडाउन अपडेट
      this.showToast("Piyush Varshney Sir की शीट के 10 मूल सवाल रीस्टोर हो गए!", "success");
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
    document.getElementById("stat-streak-display").textContent = `${progress.streak || 1} दिन 🔥`;

    const historyContainer = document.getElementById("history-table-container");
    if (history.length === 0) {
      historyContainer.innerHTML = `<p class="text-sm text-slate-400 py-4 text-center">अभी तक कोई टेस्ट रिकॉर्ड नहीं है।</p>`;
      return;
    }

    historyContainer.innerHTML = `
      <table class="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-slate-400 uppercase font-semibold text-xs">
            <th class="py-2.5">समय / दिनांक</th>
            <th class="py-2.5">प्रयास</th>
            <th class="py-2.5">सही</th>
            <th class="py-2.5">गलत</th>
            <th class="py-2.5">सटीकता</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${history.map(item => `
            <tr>
              <td class="py-2.5 text-slate-500">${new Date(item.date).toLocaleDateString("hi-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              <td class="py-2.5 font-medium text-slate-700">${item.total}</td>
              <td class="py-2.5 font-semibold text-emerald-600">${item.correct}</td>
              <td class="py-2.5 font-semibold text-rose-600">${item.wrong}</td>
              <td class="py-2.5">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${item.accuracy >= 70 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
                  ${item.accuracy}%
                </span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
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
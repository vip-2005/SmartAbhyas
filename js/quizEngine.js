/**
 * quizEngine.js
 * Multi-Set Real Exam Mode:
 * Specific Set filtering, Neutral Selection, Timer, Time Tracking, KaTeX rendering, and Set-based Logging.
 */
const QuizEngine = {
  quizQuestions: [],
  currentIndex: 0,
  userResponses: {}, // { [index]: selectedOptionIndex }
  timeSpentPerQuestion: {}, // { [index]: secondsSpent }
  questionStartTime: null,
  timerInterval: null,
  timeRemaining: 60,
  perQuestionTimer: 60,
  currentSetName: "Mixed Test",

  // Math equations render helper (KaTeX)
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

  // Seconds format helper
  formatSeconds(totalSec) {
    const sec = Math.max(0, Math.round(totalSec || 0));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  },

  // Time recording for current question
  recordCurrentQuestionTime() {
    if (this.questionStartTime) {
      const elapsed = Math.round((Date.now() - this.questionStartTime) / 1000);
      this.timeSpentPerQuestion[this.currentIndex] = (this.timeSpentPerQuestion[this.currentIndex] || 0) + elapsed;
      this.questionStartTime = Date.now();
    }
  },

  // Target specific set directly from Vault/Card
  startSetQuiz(setId) {
    App.switchTab("quiz");
    const setSelect = document.getElementById("quiz-set-select");
    if (setSelect) {
      setSelect.value = setId;
    }
    this.startQuiz();
  },

  startQuiz() {
    const limit = parseInt(document.getElementById("quiz-limit").value);
    const mode = document.getElementById("quiz-mode-select").value;
    const timerVal = parseInt(document.getElementById("quiz-timer-setting").value);
    const selectedSetId = document.getElementById("quiz-set-select") ? document.getElementById("quiz-set-select").value : "all";

    const allSets = StorageManager.getAllTestSets();
    let targetQuestions = [];

    // 1. Set Filter: Specific file ya All Sets
    if (selectedSetId === "all") {
      this.currentSetName = "Sabhi Files (Mixed Test)";
      targetQuestions = StorageManager.getAllQuestions();
    } else {
      const foundSet = allSets.find(s => s.id === selectedSetId);
      if (foundSet) {
        this.currentSetName = foundSet.title;
        targetQuestions = foundSet.questions || [];
      } else {
        App.showToast("Chuna gaya set nahi mila!", "error");
        return;
      }
    }

    if (targetQuestions.length === 0) {
      App.showToast("Is set me koi sawal uplabdh nahi hai!", "error");
      return;
    }

    let pool = [];

    // 2. Mode Filter (Normal vs Mistakes Only)
    if (mode === "mistakes") {
      const mistakes = new Set(StorageManager.getUserProgress().incorrectQuestionIds || []);
      pool = targetQuestions.filter(q => mistakes.has(q.id));
      if (pool.length === 0) {
        App.showToast("Is set me koi galat sawal nahi mila!", "info");
        return;
      }
    } else {
      pool = [...targetQuestions];
    }

    // Shuffle
    pool.sort(() => Math.random() - 0.5);
    this.quizQuestions = pool.slice(0, Math.min(limit, pool.length));

    this.currentIndex = 0;
    this.userResponses = {};
    this.timeSpentPerQuestion = {};
    this.perQuestionTimer = timerVal;

    document.getElementById("quiz-setup-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.add("hidden");
    document.getElementById("quiz-live-card").classList.remove("hidden");

    const oldReview = document.getElementById("post-quiz-review-container");
    if (oldReview) oldReview.classList.add("hidden");

    this.renderCurrentQuestion();
  },

  renderCurrentQuestion() {
    clearInterval(this.timerInterval);
    this.questionStartTime = Date.now();

    const q = this.quizQuestions[this.currentIndex];
    const total = this.quizQuestions.length;

    document.getElementById("live-subject-tag").textContent = q.subject || "General";
    document.getElementById("live-topic-tag").textContent = q.topic || "General";
    document.getElementById("live-progress-text").textContent = `Sawal ${this.currentIndex + 1} / ${total}`;
    document.getElementById("question-source-tag").textContent = `Source: ${q.source || this.currentSetName}`;
    
    const questionTextEl = document.getElementById("live-question-text");
    questionTextEl.textContent = q.question;

    const progressPercent = ((this.currentIndex + 1) / total) * 100;
    document.getElementById("quiz-progress-bar").style.width = `${progressPercent}%`;

    // Options Render
    const optionsBox = document.getElementById("options-container");
    optionsBox.innerHTML = "";

    const savedAnswer = this.userResponses[this.currentIndex];

    q.options.forEach((optText, index) => {
      const isSelected = (savedAnswer === index);
      const optBtn = document.createElement("button");

      optBtn.className = isSelected
        ? "option-btn w-full p-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-900 font-semibold flex items-start gap-3 transition shadow-sm"
        : "option-btn w-full p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left font-medium text-slate-700 flex items-start gap-3 transition";

      optBtn.innerHTML = `
        <span class="${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'} w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border border-slate-200 mt-0.5 flex-shrink-0">
          ${String.fromCharCode(65 + index)}
        </span>
        <span class="text-sm sm:text-base flex-grow text-left opt-content">${optText}</span>
      `;
      optBtn.onclick = () => this.selectOption(index);
      optionsBox.appendChild(optBtn);
    });

    // Render KaTeX in Question & Options
    this.renderMath(questionTextEl);
    this.renderMath(optionsBox);

    // Buttons State
    const prevBtn = document.getElementById("btn-prev-question");
    if (prevBtn) prevBtn.disabled = (this.currentIndex === 0);

    const clearBtn = document.getElementById("btn-clear-response");
    if (clearBtn) clearBtn.disabled = (savedAnswer === undefined);

    const nextBtn = document.getElementById("btn-next-question");
    if (nextBtn) {
      nextBtn.disabled = false;
      if (this.currentIndex === total - 1) {
        nextBtn.innerHTML = `Submit Test <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
      } else {
        nextBtn.innerHTML = `Save & Next <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>`;
      }
    }

    // Timer Logic
    const timerBox = document.getElementById("timer-box");
    const timerDisplay = document.getElementById("timer-display");

    if (this.perQuestionTimer > 0) {
      timerBox.classList.remove("hidden");
      this.timeRemaining = this.perQuestionTimer;
      timerDisplay.textContent = `${this.timeRemaining}s`;

      this.timerInterval = setInterval(() => {
        this.timeRemaining--;
        timerDisplay.textContent = `${this.timeRemaining}s`;
        if (this.timeRemaining <= 0) {
          clearInterval(this.timerInterval);
          this.handleTimeUp();
        }
      }, 1000);
    } else {
      timerBox.classList.add("hidden");
    }
  },

  selectOption(index) {
    this.userResponses[this.currentIndex] = index;
    const optionsBox = document.getElementById("options-container");
    const buttons = optionsBox.querySelectorAll("button");
    buttons.forEach((btn, optIdx) => {
      const isSelected = (optIdx === index);
      btn.className = isSelected
        ? "option-btn w-full p-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-900 font-semibold flex items-start gap-3 transition shadow-sm"
        : "option-btn w-full p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left font-medium text-slate-700 flex items-start gap-3 transition";

      const badge = btn.querySelector("span:first-child");
      if (badge) {
        badge.className = `${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'} w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border border-slate-200 mt-0.5 flex-shrink-0`;
      }
    });

    const clearBtn = document.getElementById("btn-clear-response");
    if (clearBtn) clearBtn.disabled = false;
  },

  clearCurrentResponse() {
    delete this.userResponses[this.currentIndex];
    this.renderCurrentQuestion();
    App.showToast("Option hata diya gaya");
  },

  previousQuestion() {
    this.recordCurrentQuestionTime();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrentQuestion();
    }
  },

  saveAndNext() {
    this.recordCurrentQuestionTime();
    if (this.currentIndex < this.quizQuestions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
    } else {
      this.confirmSubmit();
    }
  },

  handleTimeUp() {
    this.recordCurrentQuestionTime();
    App.showToast("Samay samapt! Agle sawal par ja rahe hain.", "warning");
    if (this.currentIndex < this.quizQuestions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
    } else {
      this.finishQuiz();
    }
  },

  confirmSubmit() {
    const total = this.quizQuestions.length;
    const attempted = Object.keys(this.userResponses).length;
    const unattempted = total - attempted;

    const confirmMsg = `Kya aap test submit karna chahte hain?\n\nTotal Questions: ${total}\nAttempted: ${attempted}\nUnattempted: ${unattempted}`;
    if (confirm(confirmMsg)) {
      this.finishQuiz();
    }
  },

  abortQuiz() {
    if (confirm("Kya aap test radd karna chahte hain? Progress save nahi hogi.")) {
      clearInterval(this.timerInterval);
      this.questionStartTime = null;
      this.resetToSetupView();
      App.showToast("Test cancel kar diya gaya.");
    }
  },

  resetToSetupView() {
    clearInterval(this.timerInterval);
    this.questionStartTime = null;
    document.getElementById("quiz-setup-card").classList.remove("hidden");
    document.getElementById("quiz-live-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.add("hidden");
  },

  finishQuiz() {
    clearInterval(this.timerInterval);
    this.recordCurrentQuestionTime();

    document.getElementById("quiz-live-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.remove("hidden");

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    this.quizQuestions.forEach((q, idx) => {
      const selected = this.userResponses[idx];
      if (selected === undefined) {
        unattempted++;
      } else if (selected === q.answer) {
        correct++;
      } else {
        wrong++;
        if (q.id) {
          StorageManager.addMistake(q.id);
        }
      }
    });

    const total = this.quizQuestions.length;
    const accuracy = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

    document.getElementById("res-total").textContent = total;
    document.getElementById("res-correct").textContent = correct;
    document.getElementById("res-wrong").textContent = wrong;
    document.getElementById("res-accuracy").textContent = `${accuracy}%`;
    document.getElementById("res-added-mistakes").textContent = `${wrong} sawal`;
    document.getElementById("result-timestamp").textContent = `Samapt: ${new Date().toLocaleDateString("hi-IN", { hour: "2-digit", minute: "2-digit" })}`;

    const totalTimeTaken = Object.values(this.timeSpentPerQuestion).reduce((acc, curr) => acc + curr, 0);
    const avgTime = total > 0 ? Math.round(totalTimeTaken / total) : 0;

    // Set name ke sath record save karein
    StorageManager.recordQuiz(total, correct, wrong, accuracy, totalTimeTaken, avgTime, this.currentSetName);

    App.updateBadges();
    App.renderHeaderStats();
    App.renderAnalytics();

    const emojiEl = document.getElementById("result-emoji");
    if (accuracy >= 80) emojiEl.textContent = "🏆";
    else if (accuracy >= 50) emojiEl.textContent = "👍";
    else emojiEl.textContent = "📖";

    this.renderPostQuizReview();
  },

  renderPostQuizReview() {
    let reviewContainer = document.getElementById("post-quiz-review-container");
    if (!reviewContainer) {
      reviewContainer = document.createElement("div");
      reviewContainer.id = "post-quiz-review-container";
      reviewContainer.className = "mt-8 text-left space-y-4 pt-6 border-t border-slate-200";
      document.getElementById("quiz-result-card").appendChild(reviewContainer);
    }

    reviewContainer.classList.remove("hidden");
    reviewContainer.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>📝</span> Sabhi Prashno Ka Hal Va Vyakhya (Detailed Solutions)
        </h3>
        <span class="text-xs text-slate-500">${this.currentSetName}</span>
      </div>
    `;

    this.quizQuestions.forEach((q, idx) => {
      const userSel = this.userResponses[idx];
      const isCorrect = (userSel === q.answer);
      const isUnattempted = (userSel === undefined);
      const timeSpent = this.timeSpentPerQuestion[idx] || 0;

      let statusBadge = "";
      let cardBorder = "border-slate-200 bg-white";

      if (isCorrect) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">✓ Sahi (+1)</span>`;
        cardBorder = "border-emerald-200 bg-emerald-50/20";
      } else if (isUnattempted) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">Chhoda (0)</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">✕ Galat Uttar</span>`;
        cardBorder = "border-rose-200 bg-rose-50/20";
      }

      const timeBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">⏱️ ${this.formatSeconds(timeSpent)}</span>`;

      const qCard = document.createElement("div");
      qCard.className = `p-4 sm:p-5 rounded-2xl border ${cardBorder} space-y-3 transition`;

      let optionsListHtml = "";
      q.options.forEach((opt, oIdx) => {
        let optStyle = "p-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm flex items-center gap-2 text-slate-700 bg-white";
        let mark = "";

        if (oIdx === q.answer) {
          optStyle = "p-2.5 rounded-lg border border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 text-xs sm:text-sm flex items-center gap-2";
          mark = `<span class="ml-auto text-xs font-bold text-emerald-600">✓ Sahi Uttar</span>`;
        } else if (oIdx === userSel && !isCorrect) {
          optStyle = "p-2.5 rounded-lg border border-rose-400 bg-rose-50 font-semibold text-rose-900 text-xs sm:text-sm flex items-center gap-2";
          mark = `<span class="ml-auto text-xs font-bold text-rose-600">Aapka Chayan</span>`;
        }

        optionsListHtml += `
          <div class="${optStyle}">
            <span class="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-slate-100 border border-slate-200">${String.fromCharCode(65 + oIdx)}</span>
            <span class="opt-content">${opt}</span>
            ${mark}
          </div>
        `;
      });

      qCard.innerHTML = `
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 uppercase">Q${idx + 1}. [${q.subject || 'General'}]</span>
            ${timeBadge}
          </div>
          ${statusBadge}
        </div>
        <p class="text-sm sm:text-base font-semibold text-slate-800 question-body">${q.question}</p>
        <div class="space-y-1.5 pt-1">${optionsListHtml}</div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
          <span class="text-xs font-bold text-brand-700 block mb-1">💡 Solution & Explanation:</span>
          <p class="text-xs sm:text-sm text-slate-600 whitespace-pre-line leading-relaxed exp-body">${q.explanation || 'Vyakhya uplabdh nahi hai.'}</p>
        </div>
      `;

      reviewContainer.appendChild(qCard);
    });

    // KaTeX render in review
    this.renderMath(reviewContainer);
  }
};
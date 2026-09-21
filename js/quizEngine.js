/**
 * quizEngine.js
 * Real Exam Mode: Navigation, Neutral Selection, Timer, Question Time Tracking, and Post-Exam Review
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

  // Seconds ko format karne ke liye helper (e.g. 45s ya 1m 15s)
  formatSeconds(totalSec) {
    const sec = Math.max(0, Math.round(totalSec || 0));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  },

  // Current question par bitaye gaye samay ko save karna
  recordCurrentQuestionTime() {
    if (this.questionStartTime) {
      const elapsed = Math.round((Date.now() - this.questionStartTime) / 1000);
      this.timeSpentPerQuestion[this.currentIndex] = (this.timeSpentPerQuestion[this.currentIndex] || 0) + elapsed;
      this.questionStartTime = Date.now(); // reset reference
    }
  },

  startQuiz() {
    const limit = parseInt(document.getElementById("quiz-limit").value);
    const mode = document.getElementById("quiz-mode-select").value;
    const timerVal = parseInt(document.getElementById("quiz-timer-setting").value);
    const selectedTopic = document.getElementById("quiz-topic-select") ? document.getElementById("quiz-topic-select").value : "all";

    const allQuestions = StorageManager.getAllQuestions();
    const mistakes = StorageManager.getUserProgress().incorrectQuestionIds || [];

    let pool = [];

    // 1. मोड के अनुसार सवाल छाँटें
    if (mode === "mistakes") {
      const mistakeSet = new Set(mistakes);
      pool = allQuestions.filter(q => mistakeSet.has(q.id));
      if (pool.length === 0) {
        App.showToast("अभिनंदन! आपकी मिस्टेक नोटबुक में कोई गलत सवाल नहीं है।", "success");
        return;
      }
    } else {
      pool = [...allQuestions];
    }

    // 2. टॉपिक/विषय फ़िल्टर
    if (selectedTopic !== "all") {
      pool = pool.filter(q => (q.topic === selectedTopic || q.subject === selectedTopic));
      if (pool.length === 0) {
        App.showToast(`चुने गए टॉपिक '${selectedTopic}' में कोई सवाल नहीं मिला!`, "error");
        return;
      }
    }

    if (pool.length === 0) {
      App.showToast("कोई प्रश्न उपलब्ध नहीं है। कृपया सवाल बैंक में प्रश्न जोड़ें।", "error");
      return;
    }

    pool.sort(() => Math.random() - 0.5);
    this.quizQuestions = pool.slice(0, Math.min(limit, pool.length));

    this.currentIndex = 0;
    this.userResponses = {};
    this.timeSpentPerQuestion = {};
    this.perQuestionTimer = timerVal;

    document.getElementById("quiz-setup-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.add("hidden");
    document.getElementById("quiz-live-card").classList.remove("hidden");

    // अगर पहले से रिव्यू बॉक्स बना हो तो उसे रीसेट करें
    const oldReview = document.getElementById("post-quiz-review-container");
    if (oldReview) oldReview.classList.add("hidden");

    this.renderCurrentQuestion();
  },

  renderCurrentQuestion() {
    clearInterval(this.timerInterval);

    // Question start timestamp track karna
    this.questionStartTime = Date.now();

    const q = this.quizQuestions[this.currentIndex];
    const total = this.quizQuestions.length;

    document.getElementById("live-subject-tag").textContent = q.subject || "रीजनिंग";
    document.getElementById("live-topic-tag").textContent = q.topic || "सामान्य";
    document.getElementById("live-progress-text").textContent = `सवाल ${this.currentIndex + 1} / ${total}`;
    document.getElementById("question-source-tag").textContent = q.source || "SmartAbhyas Database";
    document.getElementById("live-question-text").textContent = q.question;

    const progressPercent = ((this.currentIndex + 1) / total) * 100;
    document.getElementById("quiz-progress-bar").style.width = `${progressPercent}%`;

    // एक्सप्लेनेशन लाइव टेस्ट में पूरी तरह छिपा रहेगा
    const expBox = document.getElementById("explanation-container");
    if (expBox) expBox.classList.add("hidden");
    const expBtn = document.getElementById("btn-toggle-explain");
    if (expBtn) expBtn.classList.add("hidden");

    // Options Render
    const optionsBox = document.getElementById("options-container");
    optionsBox.innerHTML = "";

    const savedAnswer = this.userResponses[this.currentIndex];

    q.options.forEach((optText, index) => {
      const isSelected = (savedAnswer === index);
      const optBtn = document.createElement("button");
      
      // Neutral Real-Exam Styling
      optBtn.className = isSelected
        ? "option-btn w-full p-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-900 font-semibold flex items-start gap-3 transition shadow-sm"
        : "option-btn w-full p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left font-medium text-slate-700 flex items-start gap-3 transition";

      optBtn.innerHTML = `
        <span class="${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'} w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border border-slate-200 mt-0.5 flex-shrink-0">
          ${String.fromCharCode(65 + index)}
        </span>
        <span class="text-sm sm:text-base flex-grow text-left">${optText}</span>
      `;
      optBtn.onclick = () => this.selectOption(index);
      optionsBox.appendChild(optBtn);
    });

    // Buttons State
    const prevBtn = document.getElementById("btn-prev-question");
    if (prevBtn) prevBtn.disabled = (this.currentIndex === 0);

    const clearBtn = document.getElementById("btn-clear-response");
    if (clearBtn) clearBtn.disabled = (savedAnswer === undefined);

    const nextBtn = document.getElementById("btn-next-question");
    if (nextBtn) {
      nextBtn.disabled = false;
      if (this.currentIndex === total - 1) {
        nextBtn.innerHTML = `सबमिट करें <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
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
    // केवल UI पर न्यूट्रल हाइलाइट अपडेट करें
    const optionsBox = document.getElementById("options-container");
    const buttons = optionsBox.querySelectorAll("button");
    buttons.forEach((btn, optIdx) => {
      const isSelected = (optIdx === index);
      btn.className = isSelected
        ? "option-btn w-full p-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-900 font-semibold flex items-start gap-3 transition shadow-sm"
        : "option-btn w-full p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left font-medium text-slate-700 flex items-start gap-3 transition";

      const badge = btn.querySelector("span");
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
    App.showToast("विकल्प हटा दिया गया");
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
    App.showToast("समय समाप्त! अगले सवाल पर जा रहे हैं।", "warning");
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

    const confirmMsg = `क्या आप वाकई टेस्ट सबमिट करना चाहते हैं?\n\nकुल प्रश्न: ${total}\nहल किए गए: ${attempted}\nछूटे हुए: ${unattempted}`;
    if (confirm(confirmMsg)) {
      this.finishQuiz();
    }
  },

  abortQuiz() {
    if (confirm("क्या आप वाकई टेस्ट रद्द करना चाहते हैं? प्रगति सेव नहीं होगी।")) {
      clearInterval(this.timerInterval);
      this.resetToSetupView();
      App.showToast("टेस्ट रद्द कर दिया गया।");
    }
  },

  resetToSetupView() {
    clearInterval(this.timerInterval);
    document.getElementById("quiz-setup-card").classList.remove("hidden");
    document.getElementById("quiz-live-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.add("hidden");
  },

  finishQuiz() {
    clearInterval(this.timerInterval);
    this.recordCurrentQuestionTime(); // Final question ka time record karein

    document.getElementById("quiz-live-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.remove("hidden");

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    let wrongQuestions = [];

    this.quizQuestions.forEach((q, idx) => {
      const selected = this.userResponses[idx];
      if (selected === undefined) {
        unattempted++;
      } else if (selected === q.answer) {
        correct++;
      } else {
        wrong++;
        wrongQuestions.push(q);
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
    document.getElementById("res-added-mistakes").textContent = `${wrong} सवाल`;
    document.getElementById("result-timestamp").textContent = `समाप्त: ${new Date().toLocaleDateString("hi-IN", { hour: "2-digit", minute: "2-digit" })}`;

    StorageManager.recordQuiz(total, correct, wrong, accuracy);
    App.updateBadges();
    App.renderHeaderStats();
    App.renderAnalytics();

    const emojiEl = document.getElementById("result-emoji");
    if (accuracy >= 80) emojiEl.textContent = "🏆";
    else if (accuracy >= 50) emojiEl.textContent = "👍";
    else emojiEl.textContent = "📖";

    // टेस्ट के बाद विस्तृत हल और रिव्यू तैयार करें
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
          <span>📝</span> सभी प्रश्नों का हल व व्याख्या (Detailed Solutions)
        </h3>
        <span class="text-xs text-slate-500">रिवीजन करें और गलतियों को समझें</span>
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
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">✓ सही (+1)</span>`;
        cardBorder = "border-emerald-200 bg-emerald-50/20";
      } else if (isUnattempted) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">छोड़ दिया (0)</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">✕ गलत उत्तर</span>`;
        cardBorder = "border-rose-200 bg-rose-50/20";
      }

      // Liya gaya time badge
      const timeBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">⏱️ ${this.formatSeconds(timeSpent)}</span>`;

      const qCard = document.createElement("div");
      qCard.className = `p-4 sm:p-5 rounded-2xl border ${cardBorder} space-y-3 transition`;

      let optionsListHtml = "";
      q.options.forEach((opt, oIdx) => {
        let optStyle = "p-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm flex items-center gap-2 text-slate-700 bg-white";
        let mark = "";

        if (oIdx === q.answer) {
          optStyle = "p-2.5 rounded-lg border border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 text-xs sm:text-sm flex items-center gap-2";
          mark = `<span class="ml-auto text-xs font-bold text-emerald-600">✓ सही उत्तर</span>`;
        } else if (oIdx === userSel && !isCorrect) {
          optStyle = "p-2.5 rounded-lg border border-rose-400 bg-rose-50 font-semibold text-rose-900 text-xs sm:text-sm flex items-center gap-2";
          mark = `<span class="ml-auto text-xs font-bold text-rose-600">आपका चयन</span>`;
        }

        optionsListHtml += `
          <div class="${optStyle}">
            <span class="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-slate-100 border border-slate-200">${String.fromCharCode(65 + oIdx)}</span>
            <span>${opt}</span>
            ${mark}
          </div>
        `;
      });

      qCard.innerHTML = `
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 uppercase">Q${idx + 1}. [${q.subject || 'सामान्य'}]</span>
            ${timeBadge}
          </div>
          ${statusBadge}
        </div>
        <p class="text-sm sm:text-base font-semibold text-slate-800">${q.question}</p>
        <div class="space-y-1.5 pt-1">${optionsListHtml}</div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
          <span class="text-xs font-bold text-brand-700 block mb-1">💡 विस्तृत हल (Explanation):</span>
          <p class="text-xs sm:text-sm text-slate-600 whitespace-pre-line leading-relaxed">${q.explanation || 'व्याख्या उपलब्ध नहीं है।'}</p>
        </div>
      `;
      reviewContainer.appendChild(qCard);
    });
  }
};
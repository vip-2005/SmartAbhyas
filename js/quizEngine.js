/**
 * quizEngine.js
 * Quiz timing, question shuffling, options, and instant feedback
 */
const QuizEngine = {
  quizQuestions: [],
  currentIndex: 0,
  score: { correct: 0, wrong: 0 },
  timerInterval: null,
  timeRemaining: 60,
  answeredCurrent: false,

  startQuiz() {
    const limit = parseInt(document.getElementById("quiz-limit").value);
    const mode = document.getElementById("quiz-mode-select").value;
    const timerVal = parseInt(document.getElementById("quiz-timer-setting").value);

    const allQuestions = StorageManager.getAllQuestions();
    const mistakes = StorageManager.getUserProgress().incorrectQuestionIds || [];

    let pool = [];
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

    if (pool.length === 0) {
      App.showToast("कोई प्रश्न उपलब्ध नहीं है। कृपया सवाल बैंक में प्रश्न जोड़ें।", "error");
      return;
    }

    pool.sort(() => Math.random() - 0.5);
    this.quizQuestions = pool.slice(0, Math.min(limit, pool.length));

    this.currentIndex = 0;
    this.score = { correct: 0, wrong: 0 };
    this.timeRemaining = timerVal;

    document.getElementById("quiz-setup-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.add("hidden");
    document.getElementById("quiz-live-card").classList.remove("hidden");

    this.renderCurrentQuestion();
  },

  renderCurrentQuestion() {
    this.answeredCurrent = false;
    clearInterval(this.timerInterval);

    const q = this.quizQuestions[this.currentIndex];
    const total = this.quizQuestions.length;

    document.getElementById("live-subject-tag").textContent = q.subject || "रीजनिंग";
    document.getElementById("live-topic-tag").textContent = q.topic || "Direction & Distance";
    document.getElementById("live-progress-text").textContent = `सवाल ${this.currentIndex + 1} / ${total}`;
    document.getElementById("question-source-tag").textContent = q.source || "SmartAbhyas Database";
    document.getElementById("live-question-text").textContent = q.question;

    const progressPercent = (this.currentIndex / total) * 100;
    document.getElementById("quiz-progress-bar").style.width = `${progressPercent}%`;

    const nextBtn = document.getElementById("btn-next-question");
    nextBtn.disabled = true;
    nextBtn.textContent = (this.currentIndex === total - 1) ? "टेस्ट समाप्त करें" : "अगला सवाल";
    document.getElementById("explanation-container").classList.add("hidden");
    document.getElementById("btn-toggle-explain").classList.add("hidden");

    const optionsBox = document.getElementById("options-container");
    optionsBox.innerHTML = "";

    q.options.forEach((optText, index) => {
      const optBtn = document.createElement("button");
      optBtn.className = "option-btn w-full p-4 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 text-left font-medium text-slate-700 flex items-start gap-3 transition-all duration-150";
      optBtn.innerHTML = `
        <span class="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center border border-slate-200 mt-0.5 flex-shrink-0">
          ${String.fromCharCode(65 + index)}
        </span>
        <span class="text-sm sm:text-base flex-grow">${optText}</span>
      `;
      optBtn.onclick = () => this.handleAnswerSelect(index);
      optionsBox.appendChild(optBtn);
    });

    const timerBox = document.getElementById("timer-box");
    const timerDisplay = document.getElementById("timer-display");
    const timerSetting = parseInt(document.getElementById("quiz-timer-setting").value);

    if (timerSetting > 0) {
      timerBox.classList.remove("hidden");
      this.timeRemaining = timerSetting;
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

  handleAnswerSelect(selectedIndex) {
    if (this.answeredCurrent) return;
    this.answeredCurrent = true;
    clearInterval(this.timerInterval);

    const q = this.quizQuestions[this.currentIndex];
    const buttons = document.querySelectorAll(".option-btn");
    const isCorrect = (selectedIndex === q.answer);

    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      btn.classList.remove("hover:border-brand-500", "hover:bg-brand-50/40");

      if (idx === q.answer) {
        btn.className = "w-full p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold flex items-start gap-3 transition";
        btn.querySelector("span").className = "w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0";
      } else if (idx === selectedIndex && !isCorrect) {
        btn.className = "w-full p-4 rounded-xl border-2 border-rose-500 bg-rose-50 text-rose-900 font-medium flex items-start gap-3 transition";
        btn.querySelector("span").className = "w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0";
      }
    });

    if (isCorrect) {
      this.score.correct++;
    } else {
      this.score.wrong++;
      if (q.id) {
        StorageManager.addMistake(q.id);
        App.updateBadges();
      }
    }

    const explainStatus = document.getElementById("explanation-status");
    if (isCorrect) {
      explainStatus.textContent = "✓ आपका उत्तर सही है";
      explainStatus.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
    } else {
      explainStatus.textContent = "✕ गलत उत्तर";
      explainStatus.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800";
    }

    document.getElementById("live-explanation-text").textContent = q.explanation || "कोई विस्तृत व्याख्या उपलब्ध नहीं है।";
    document.getElementById("explanation-container").classList.remove("hidden");
    document.getElementById("btn-toggle-explain").classList.remove("hidden");
    document.getElementById("btn-next-question").disabled = false;
  },

  handleTimeUp() {
    if (this.answeredCurrent) return;
    App.showToast("समय समाप्त हो गया!", "error");
    this.handleAnswerSelect(-1);
  },

  toggleExplanation() {
    document.getElementById("explanation-container").classList.toggle("hidden");
  },

  nextQuestion() {
    if (this.currentIndex < this.quizQuestions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
    } else {
      this.finishQuiz();
    }
  },

  abortQuiz() {
    clearInterval(this.timerInterval);
    this.resetToSetupView();
    App.showToast("टेस्ट रद्द कर दिया गया।");
  },

  resetToSetupView() {
    document.getElementById("quiz-setup-card").classList.remove("hidden");
    document.getElementById("quiz-live-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.add("hidden");
  },

  finishQuiz() {
    clearInterval(this.timerInterval);
    document.getElementById("quiz-live-card").classList.add("hidden");
    document.getElementById("quiz-result-card").classList.remove("hidden");

    const total = this.quizQuestions.length;
    const correct = this.score.correct;
    const wrong = this.score.wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    document.getElementById("res-total").textContent = total;
    document.getElementById("res-correct").textContent = correct;
    document.getElementById("res-wrong").textContent = wrong;
    document.getElementById("res-accuracy").textContent = `${accuracy}%`;
    document.getElementById("res-added-mistakes").textContent = `${wrong} सवाल`;
    document.getElementById("result-timestamp").textContent = `समाप्त: ${new Date().toLocaleDateString("hi-IN", { hour: "2-digit", minute: "2-digit" })}`;

    StorageManager.recordQuiz(total, correct, wrong, accuracy);
    App.renderHeaderStats();
    App.renderAnalytics();

    const emojiEl = document.getElementById("result-emoji");
    if (accuracy >= 80) emojiEl.textContent = "🏆";
    else if (accuracy >= 50) emojiEl.textContent = "👍";
    else emojiEl.textContent = "📖";
  }
};
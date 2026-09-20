/**
 * storage.js
 * Exactly adheres to:
 * {
 *   "questions": [...],
 *   "userProgress": {
 *      "totalAttempted": 0,
 *      "incorrectQuestionIds": [],
 *      "streak": 1,
 *      "lastQuizDate": "2026-09-20",
 *      "history": []
 *   }
 * }
 */
const StorageManager = {
  DB_KEY: "smartabhyas_db",

  getDB() {
    const raw = localStorage.getItem(this.DB_KEY);
    if (!raw) {
      const initialSchema = {
        questions: DEFAULT_QUESTIONS,
        userProgress: {
          totalAttempted: 0,
          incorrectQuestionIds: [],
          streak: 1,
          lastQuizDate: null,
          history: []
        }
      };
      localStorage.setItem(this.DB_KEY, JSON.stringify(initialSchema));
      return initialSchema;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {
        questions: DEFAULT_QUESTIONS,
        userProgress: { totalAttempted: 0, incorrectQuestionIds: [], streak: 1, lastQuizDate: null, history: [] }
      };
    }
  },

  saveDB(db) {
    localStorage.setItem(this.DB_KEY, JSON.stringify(db));
  },

  getAllQuestions() {
    return this.getDB().questions || [];
  },

  getUserProgress() {
    return this.getDB().userProgress || {
      totalAttempted: 0,
      incorrectQuestionIds: [],
      streak: 1,
      lastQuizDate: null,
      history: []
    };
  },

  addMistake(id) {
    if (!id) return;
    const db = this.getDB();
    const mistakes = new Set(db.userProgress.incorrectQuestionIds || []);
    mistakes.add(id);
    db.userProgress.incorrectQuestionIds = Array.from(mistakes);
    this.saveDB(db);
  },

  removeMistake(id) {
    const db = this.getDB();
    db.userProgress.incorrectQuestionIds = (db.userProgress.incorrectQuestionIds || []).filter(item => item !== id);
    this.saveDB(db);
  },

  clearAllMistakes() {
    const db = this.getDB();
    db.userProgress.incorrectQuestionIds = [];
    this.saveDB(db);
  },

  recordQuiz(total, correct, wrong, accuracy) {
    const db = this.getDB();
    const progress = db.userProgress;

    progress.totalAttempted = (progress.totalAttempted || 0) + total;

    // Daily Streak Tracker
    const today = new Date().toISOString().split("T")[0];
    if (!progress.lastQuizDate) {
      progress.streak = 1;
      progress.lastQuizDate = today;
    } else if (progress.lastQuizDate !== today) {
      const lastDate = new Date(progress.lastQuizDate);
      const diffDays = Math.round((new Date(today) - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        progress.streak = (progress.streak || 0) + 1;
      } else if (diffDays > 1) {
        progress.streak = 1;
      }
      progress.lastQuizDate = today;
    }

    // Save history
    if (!progress.history) progress.history = [];
    progress.history.unshift({
      date: new Date().toISOString(),
      total,
      correct,
      wrong,
      accuracy
    });
    if (progress.history.length > 25) progress.history.pop();

    this.saveDB(db);
  },

  clearHistory() {
    const db = this.getDB();
    db.userProgress.history = [];
    db.userProgress.totalAttempted = 0;
    this.saveDB(db);
  },

  // Import questions with dynamic subject / topic support
  importQuestions(data) {
    const db = this.getDB();
    let list = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.questions)) {
      list = data.questions;
      if (data.userProgress) {
        db.userProgress = { ...db.userProgress, ...data.userProgress };
      }
    } else {
      throw new Error("Invalid format! Must be an array of questions or complete schema.");
    }

    let count = 0;
    list.forEach((item, idx) => {
      if (item.question && Array.isArray(item.options) && typeof item.answer === "number") {
        const cleanSub = (item.subject || "Reasoning").trim();
        const cleanTopic = (item.topic || "General").trim();
        const id = item.id || `${cleanSub.substring(0, 3).toUpperCase()}_${Date.now()}_${idx}`;

        const newQ = {
          id: id,
          subject: cleanSub,
          topic: cleanTopic,
          question: item.question,
          options: item.options,
          answer: item.answer,
          explanation: item.explanation || "",
          source: item.source || "Uploaded JSON"
        };

        const existingIdx = db.questions.findIndex(q => q.id === newQ.id);
        if (existingIdx >= 0) {
          db.questions[existingIdx] = newQ;
        } else {
          db.questions.push(newQ);
        }
        count++;
      }
    });

    this.saveDB(db);
    return count;
  },

  restoreDefaults() {
    const db = this.getDB();
    db.questions = [...DEFAULT_QUESTIONS];
    this.saveDB(db);
  },

  exportDatabase() {
    const db = this.getDB();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `smartabhyas_questions_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};
/**
 * storage.js
 * Multi-Set Storage Architecture with Universal JSON Normalizer.
 * Gemini AI se kisi bhi format me aane wale JSON ko safely clean aur save karta hai.
 */
const StorageManager = {
  DB_KEY: "smartabhyas_db",

  getDB() {
    const raw = localStorage.getItem(this.DB_KEY);
    if (!raw) {
      const initialSchema = {
        testSets: [
          {
            id: "default_set_01",
            title: "Default Reasoning (Direction & Distance)",
            subject: "Reasoning",
            uploadDate: "2026-10-29",
            sourceType: "Default",
            questions: (typeof DEFAULT_QUESTIONS !== "undefined") ? DEFAULT_QUESTIONS : []
          }
        ],
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
      const db = JSON.parse(raw);
      if (!db.testSets) {
        db.testSets = [
          {
            id: "legacy_set",
            title: "Pehle Ke Sawal (Archive)",
            subject: "General",
            uploadDate: new Date().toISOString().split("T")[0],
            sourceType: "Archive",
            questions: db.questions || []
          }
        ];
        delete db.questions;
        this.saveDB(db);
      }
      return db;
    } catch (e) {
      return {
        testSets: [],
        userProgress: { totalAttempted: 0, incorrectQuestionIds: [], streak: 1, lastQuizDate: null, history: [] }
      };
    }
  },

  saveDB(db) {
    localStorage.setItem(this.DB_KEY, JSON.stringify(db));
  },

  getAllTestSets() {
    return this.getDB().testSets || [];
  },

  getTestSetById(setId) {
    const sets = this.getAllTestSets();
    return sets.find(s => s.id === setId) || null;
  },

  getAllQuestions() {
    const sets = this.getAllTestSets();
    let all = [];
    sets.forEach(s => {
      all = all.concat(s.questions || []);
    });
    return all;
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

  // Gemini AI ke alag-alag variations ko standard questions array me convert karna
  normalizeRawQuestions(data) {
    let list = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (typeof data === "object" && data !== null) {
      const possibleKeys = ["questions", "data", "quiz", "test", "items", "mcqs", "result", "list"];
      for (const k of possibleKeys) {
        if (Array.isArray(data[k])) {
          list = data[k];
          break;
        }
      }
      if (list.length === 0) {
        for (const val of Object.values(data)) {
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
            list = val;
            break;
          }
        }
      }
    }

    const validated = [];

    list.forEach((raw, idx) => {
      if (!raw || typeof raw !== "object") return;

      // 1. Question extract
      const qText = raw.question || raw.questionText || raw.q || raw.problem || raw.text || "";
      if (!qText || String(qText).trim().length < 2) return;

      // 2. Options extract (Array ya Object {A:..., B:...})
      let options = [];
      const rawOpts = raw.options || raw.choices || raw.opts || raw.answers;
      if (Array.isArray(rawOpts)) {
        options = rawOpts.map(o => (typeof o === "object" && o !== null ? (o.text || o.option || Object.values(o)[0]) : String(o).trim()));
      } else if (typeof rawOpts === "object" && rawOpts !== null) {
        options = Object.values(rawOpts).map(o => String(o).trim());
      }

      if (options.length < 2) return;

      // 3. Answer extract (Number 0-3, letter "A"-"D", ya option text match)
      let answerIndex = 0;
      const rawAns = raw.answer !== undefined ? raw.answer : (raw.correct_answer !== undefined ? raw.correct_answer : (raw.correctAnswer !== undefined ? raw.correctAnswer : raw.ans));

      if (typeof rawAns === "number") {
        if (rawAns >= 0 && rawAns < options.length) {
          answerIndex = rawAns;
        } else if (rawAns >= 1 && rawAns <= options.length) {
          answerIndex = rawAns - 1; // 1-based index fix
        }
      } else if (typeof rawAns === "string") {
        const cleanAns = rawAns.trim();
        const upper = cleanAns.toUpperCase();

        if (["A", "OPTION A", "(A)"].includes(upper)) answerIndex = 0;
        else if (["B", "OPTION B", "(B)"].includes(upper)) answerIndex = 1;
        else if (["C", "OPTION C", "(C)"].includes(upper)) answerIndex = 2;
        else if (["D", "OPTION D", "(D)"].includes(upper)) answerIndex = 3;
        else {
          // Direct option text comparison
          const matchIdx = options.findIndex(opt => opt.toLowerCase() === cleanAns.toLowerCase());
          if (matchIdx !== -1) {
            answerIndex = matchIdx;
          }
        }
      }

      // 4. Explanation extract
      const explanation = raw.explanation || raw.solution || raw.sol || raw.reason || raw.detail || "";

      validated.push({
        id: raw.id || `q_${Date.now()}_${idx + 1}`,
        subject: raw.subject || "General",
        topic: raw.topic || "General",
        question: String(qText).trim(),
        options: options,
        answer: answerIndex,
        explanation: String(explanation).trim()
      });
    });

    return validated;
  },

  // Naya Set add karna (har JSON upload alag set banega)
  addNewTestSet(title, subject, rawData) {
    const db = this.getDB();
    if (!db.testSets) db.testSets = [];

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const setId = `set_${Date.now()}`;

    // Normalize incoming data
    const validatedQuestions = this.normalizeRawQuestions(rawData);

    if (validatedQuestions.length === 0) {
      throw new Error("Koi valid question nahi mila! JSON format check karein.");
    }

    // Attach setId & source to each question
    validatedQuestions.forEach(q => {
      q.setId = setId;
      q.source = title;
      if (subject && subject !== "General") q.subject = subject;
    });

    const newSet = {
      id: setId,
      title: title || `Test Set (${today})`,
      subject: subject || (validatedQuestions[0]?.subject || "General"),
      uploadDate: today,
      sourceType: "JSON",
      questions: validatedQuestions
    };

    db.testSets.unshift(newSet);
    this.saveDB(db);
    return newSet;
  },

  deleteTestSet(setId) {
    const db = this.getDB();
    const setTarget = db.testSets.find(s => s.id === setId);
    if (!setTarget) return false;

    const targetQIds = new Set(setTarget.questions.map(q => q.id));
    db.testSets = db.testSets.filter(s => s.id !== setId);

    db.userProgress.incorrectQuestionIds = (db.userProgress.incorrectQuestionIds || []).filter(
      id => !targetQIds.has(id)
    );

    this.saveDB(db);
    return true;
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

  recordQuiz(total, correct, wrong, accuracy, totalTimeTaken = 0, avgTime = 0, setName = "Mixed Test") {
    const db = this.getDB();
    const progress = db.userProgress;

    progress.totalAttempted = (progress.totalAttempted || 0) + total;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (!progress.lastQuizDate) {
      progress.streak = 1;
      progress.lastQuizDate = today;
    } else if (progress.lastQuizDate !== today) {
      const d1 = new Date(today);
      const d2 = new Date(progress.lastQuizDate);
      const diffDays = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        progress.streak = (progress.streak || 0) + 1;
      } else if (diffDays > 1) {
        progress.streak = 1;
      }
      progress.lastQuizDate = today;
    }

    if (!progress.history) progress.history = [];
    progress.history.unshift({
      date: new Date().toISOString(),
      setName: setName,
      total,
      correct,
      wrong,
      accuracy,
      totalTimeTaken,
      avgTime
    });

    if (progress.history.length > 30) progress.history.pop();
    this.saveDB(db);
  },

  clearHistory() {
    const db = this.getDB();
    db.userProgress.history = [];
    db.userProgress.totalAttempted = 0;
    this.saveDB(db);
  },

  exportDatabase() {
    const db = this.getDB();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `smartabhyas_vault_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};
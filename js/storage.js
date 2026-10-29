/**
 * storage.js
 * Multi-Set Storage Architecture:
 * Har upload alag Test Set (Vault) me save hoga.
 * User kisi bhi file ka alag se test de sakta hai ya delete kar sakta hai.
 */
const StorageManager = {
  DB_KEY: "smartabhyas_db",

  getDB() {
    const raw = localStorage.getItem(this.DB_KEY);
    if (!raw) {
      const initialSchema = {
        // Sets list jisme har uploaded file ka record aur sawal honge
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
      // Purane schema ko naye testSets schema me migrate karein agar zaroorat ho
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

  // Saare Test Sets ki list (Upload date aur info ke sath)
  getAllTestSets() {
    return this.getDB().testSets || [];
  },

  // Kisi specific Test Set ko ID se nikalna
  getTestSetById(setId) {
    const sets = this.getAllTestSets();
    return sets.find(s => s.id === setId) || null;
  },

  // Saare sets ke sawal ek sath (all-in-one practice ke liye)
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

  // Naya Test Set Add karna (PDF ya JSON upload hone par)
  addNewTestSet(title, subject, questionsList, sourceType = "JSON") {
    const db = this.getDB();
    if (!db.testSets) db.testSets = [];

    // Local YYYY-MM-DD date
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const setId = `set_${Date.now()}`;

    // Clean aur validate questions
    const validatedQuestions = [];
    questionsList.forEach((item, idx) => {
      if (item.question && Array.isArray(item.options) && typeof item.answer === "number") {
        validatedQuestions.push({
          id: item.id || `${setId}_q${idx + 1}`,
          subject: (item.subject || subject || "General").trim(),
          topic: (item.topic || "General").trim(),
          question: item.question,
          options: item.options,
          answer: item.answer,
          explanation: item.explanation || "",
          source: title,
          setId: setId
        });
      }
    });

    if (validatedQuestions.length === 0) {
      throw new Error("Koi valid question nahi mila!");
    }

    const newSet = {
      id: setId,
      title: title || `Test Set (${today})`,
      subject: subject || "General",
      uploadDate: today,
      sourceType: sourceType, // "PDF" ya "JSON"
      questions: validatedQuestions
    };

    db.testSets.unshift(newSet); // Sabse upar dikhega
    this.saveDB(db);
    return newSet;
  },

  // Kisi specific file/set ko delete karna taaki storage khali rahe
  deleteTestSet(setId) {
    const db = this.getDB();
    const setTarget = db.testSets.find(s => s.id === setId);
    if (!setTarget) return false;

    // Is set ke questions ki IDs
    const targetQIds = new Set(setTarget.questions.map(q => q.id));

    // Set delete karein
    db.testSets = db.testSets.filter(s => s.id !== setId);

    // Mistake notebook me se bhi in deleted sawalon ko hata dein
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

    // Daily Streak Tracker
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

  // Pure data ka backup JSON
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
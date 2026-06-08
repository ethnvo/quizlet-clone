const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function fakeElement() {
  return {
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    addEventListener() {},
    focus() {},
    set onclick(_handler) {},
    set onchange(_handler) {},
    set textContent(_value) {},
    set innerHTML(_value) {},
    style: {},
  };
}

const htmlPath = path.join(__dirname, "..", "flashcards.html");

function makeLocalStorage(seed = {}) {
  const store = { ...seed };
  return {
    store,
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
}

function loadFlashcardsScript(seedStorage) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const localStorage = makeLocalStorage(seedStorage);
  const context = {
    console,
    alert() {},
    confirm() { return true; },
    FileReader: function FileReader() {},
    localStorage,
    document: {
      getElementById() { return fakeElement(); },
      querySelectorAll() { return []; },
      querySelector() { return fakeElement(); },
      addEventListener() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return context;
}

const app = loadFlashcardsScript();
const html = fs.readFileSync(htmlPath, "utf8");
const visibleHtml = html.split("<script>")[0];

assert.equal(typeof app.questionPrompt, "function", "questionPrompt should be defined");
assert.equal(typeof app.buildExam, "function", "buildExam should be defined");
assert.equal(typeof app.difficultyRank, "function", "difficultyRank should be defined");
assert.equal(typeof app.curatedOptionsForCard, "function", "curatedOptionsForCard should be defined");
assert.equal(typeof app.shouldUseExamSelectAll, "function", "shouldUseExamSelectAll should be defined");
assert.equal(typeof app.explainQuestion, "function", "explainQuestion should be defined");
assert.equal(typeof app.baseReviewPrompt, "function", "baseReviewPrompt should be defined");
assert.equal(typeof app.scheduleIdkReview, "function", "scheduleIdkReview should be defined");
assert.equal(typeof app.recordExamPoints, "function", "recordExamPoints should be defined");
assert.equal(typeof app.currentExamScore, "function", "currentExamScore should be defined");
assert.equal(typeof app.examCanGoBack, "function", "examCanGoBack should be defined");
assert.equal(typeof app.goExamBack, "function", "goExamBack should be defined");
assert.equal(typeof app.goExamForward, "function", "goExamForward should be defined");
assert.equal(typeof app.currentExamIndex, "function", "currentExamIndex should be defined");
assert.equal(typeof app.hasExamAnswer, "function", "hasExamAnswer should be defined");
assert.equal(typeof app.recordExamResponse, "function", "recordExamResponse should be defined");
assert.equal(typeof app.saveExamProgress, "function", "saveExamProgress should be defined");
assert.equal(typeof app.loadExamProgress, "function", "loadExamProgress should be defined");
assert.equal(typeof app.resetExamProgress, "function", "resetExamProgress should be defined");
assert.equal(typeof app.confirmResetExamProgress, "function", "confirmResetExamProgress should be defined");
assert.match(html, /data-mode="marathon"/, "the ultimate study mode should be named Marathon");
assert.match(visibleHtml, /class="tab active" data-mode="marathon">[^<]*Marathon/, "Marathon should be the first active tab");
assert.doesNotMatch(visibleHtml, /class="tab active" data-mode="cards"/, "Flashcards should not be the default tab");
assert.doesNotMatch(visibleHtml, /Ultimate/, "visible tab text should not say Ultimate anymore");
assert.doesNotMatch(visibleHtml, />[^<]*Exam[^<]*</, "visible tab text should not say Exam");
assert.match(html, /Marathon score/, "runtime status text should say Marathon score");
assert.match(html, /Marathon complete/, "runtime finish text should say Marathon complete");
assert.match(html, /I don'?t know|IDK/i, "Marathon should include an IDK button");
assert.match(html, /Drill this now/i, "IDK explanation should offer an immediate drill");
assert.match(html, /coming back soon/i, "missed IDK reviews should be queued again");
assert.match(html, />Back</, "Marathon should include a Back button");
assert.match(html, /Restart from 0/, "Marathon should include an explicit restart-from-zero control");
assert.match(html, /Reset Marathon from question 1/i, "Restart from 0 should require confirmation");
assert.match(html, /q\.response/, "Marathon renderers should restore prior answers from question response state");
assert.match(html, /data-text=/, "Marathon answer buttons should keep stable response text for restoration");

const barePrompt = app.questionPrompt(
  { term: "correlograms", definition: "for correlation coefficients" },
  "quiz"
);
assert.match(barePrompt, /information visualization/i);
assert.match(barePrompt, /correlograms/i);
assert.match(barePrompt, /which answer/i);

const existingQuestion = app.questionPrompt(
  { term: "when should heatmaps be used?", definition: "there are large amounts of data" },
  "write"
);
assert.equal(existingQuestion, "when should heatmaps be used?");

const boolPrompt = app.questionPrompt(
  { term: "bar charts are better than pie charts", definition: "False" },
  "quiz"
);
assert.equal(boolPrompt, "True or false: bar charts are better than pie charts");

const correlogramOptions = app.curatedOptionsForCard({
  term: "correlograms",
  definition: "for correlation coefficients"
});
assert.equal(correlogramOptions.length, 4, "matching deck cards should get curated answer choices");
assert.ok(correlogramOptions.some(o => o.correct), "curated deck choices should include a correct answer");
assert.ok(
  correlogramOptions.every(o => !/^true$|^false$/i.test(o.text)),
  "curated non-boolean choices should not degrade into true/false"
);

assert.ok(
  app.difficultyRank({ term: "exploratory analysis", definition: "develop an understanding of the data" }) <
    app.difficultyRank({ term: "Principal Component Analysis", definition: "a technique that can be used to preform dimensionality reductions" }),
  "fundamentals should come before advanced dimensionality ideas"
);
assert.ok(
  app.difficultyRank({ term: "bar charts are common that means", definition: "less of a learning curve for audience" }) <
    app.difficultyRank({ term: "projection challenge", definition: "there is always some type of distortion that is introduced" }),
  "basic chart reading should come before map projection concepts"
);

app.buildExam();
assert.equal(app.examCanGoBack(), false, "the first marathon question should not go back");
assert.ok(app.examQuestions.length >= 90, "exam should expand into a longer marathon");
assert.ok(app.examQuestions.some(q => q.kind === "mcq"), "exam should include multiple choice");
assert.ok(app.examQuestions.some(q => q.kind === "write"), "exam should include written questions");
assert.ok(
  app.examQuestions.every(q => q.prompt.length > q.card.term.length || /\?$/.test(q.card.term)),
  "exam prompts should add context for bare terms"
);
assert.match(app.examQuestions[0].prompt, /main purpose|goal|why do we use/i, "exam should start with fundamentals");
assert.ok(
  app.examQuestions.findIndex(q => /projection|cartogram|pca|principal component/i.test(q.prompt)) > 40,
  "advanced map and dimensionality questions should come later in the marathon"
);

const curatedMcq = app.examQuestions.filter(q => q.kind === "mcq" && q.options);
assert.ok(curatedMcq.length >= 40, "exam should include many curated multiple-choice questions");
curatedMcq.slice(0, 30).forEach(q => {
  assert.equal(q.options.length, 4, "curated MCQs should have four options");
  assert.equal(new Set(q.options.map(o => o.text)).size, 4, "curated MCQ options should not repeat");
  assert.equal(q.options.filter(o => o.correct).length, 1, "curated MCQs should have one correct option");
});

const qualitiesQuestion = app.examQuestions.find(q => /three qualities/i.test(q.prompt));
assert.ok(qualitiesQuestion, "marathon should include the visualization qualities question");
assert.equal(qualitiesQuestion.kind, "mcq", "visualization qualities should be a standard MCQ");
assert.equal(qualitiesQuestion.options.length, 4, "visualization qualities should use curated choices");
assert.equal(
  app.shouldUseExamSelectAll(qualitiesQuestion),
  false,
  "curated comma-list answers should not become select-all questions"
);
assert.match(
  app.explainQuestion(qualitiesQuestion),
  /aesthetic, clear, and correct/i,
  "explanations should teach the correct idea"
);
assert.equal(
  app.baseReviewPrompt({ prompt: "Active recall: Active recall: Which statement about histograms is correct?" }),
  "Which statement about histograms is correct?",
  "baseReviewPrompt should strip repeated Active recall prefixes"
);
assert.equal(
  app.baseReviewPrompt({ prompt: "Again later: Active recall: Again later: What do scales do?" }),
  "What do scales do?",
  "baseReviewPrompt should strip mixed repeated review prefixes"
);

function recallCopiesOf(ctx, q) {
  return ctx.examQuestions.filter(x =>
    x.idkReview && x.index === q.index && x.card.definition === q.card.definition);
}

const beforeIdkLength = app.examQuestions.length;
const scheduled = app.scheduleIdkReview(qualitiesQuestion);
assert.equal(scheduled, true, "scheduling a fresh card's recall should succeed");
assert.equal(app.examQuestions.length, beforeIdkLength + 1, "IDK should add exactly one recall copy, not a far-future duplicate");
const recallCopy = recallCopiesOf(app, qualitiesQuestion)[0];
assert.equal(recallCopy.kind, "write", "the recall copy should force written recall");
assert.equal(recallCopy.idkReview, true, "the recall copy should be marked as an IDK review");
assert.equal(recallCopy.points, null, "the recall copy should start unanswered so the FRQ input is enabled");
assert.equal(app.hasExamAnswer(recallCopy), false, "the recall copy should not be treated as answered");
assert.match(recallCopy.prompt, /Active recall/i, "the recall copy should be framed as active recall");
assert.doesNotMatch(recallCopy.prompt, /Active recall:\s*Active recall:/i, "recall prompts should not duplicate the Active recall prefix");

// "No more than 3 queued ahead" guard: with nothing answered, scheduling stops at the pending cap.
let guard = 0;
while (app.scheduleIdkReview(qualitiesQuestion) && guard < 50) guard++;
const pendingAhead = recallCopiesOf(app, qualitiesQuestion).filter(q => !app.hasExamAnswer(q)).length;
assert.ok(pendingAhead <= 3, "no more than 3 un-answered recall copies should be queued ahead at once");
assert.equal(app.scheduleIdkReview(qualitiesQuestion), false, "once the pending cap is hit, scheduling should refuse to add more");

// Override / got-it-right: clearFutureIdk drops every pending recall copy of the card.
app.clearFutureIdk(qualitiesQuestion);
const leftover = recallCopiesOf(app, qualitiesQuestion).filter(q => !app.hasExamAnswer(q)).length;
assert.equal(leftover, 0, "clearFutureIdk should remove all pending recall copies of the card");

assert.equal(typeof app.clearFutureIdk, "function", "clearFutureIdk should be defined");
assert.equal(typeof app.idkCopies, "function", "idkCopies should be defined");

app.buildExam();
const firstQuestion = app.examQuestions[0];
app.recordExamResponse(firstQuestion, { type: "mcq", selected: "Wrong answer", right: false });
assert.deepEqual(firstQuestion.response, { type: "mcq", selected: "Wrong answer", right: false });
app.recordExamPoints(firstQuestion, 1);
app.recordExamPoints(firstQuestion, 1);
assert.equal(app.currentExamScore(), 1, "re-answering the same question should not double-count points");
app.recordExamPoints(firstQuestion, 0);
assert.equal(app.currentExamScore(), 0, "changing a revisited answer should adjust the score");
app.finishExamQuestion(1);
assert.equal(app.examCanGoBack(), true, "after moving forward, marathon should allow going back");
app.goExamBack();
assert.equal(app.examCanGoBack(), false, "going back to the first question should disable back navigation");
app.goExamForward();
assert.equal(app.examCanGoBack(), true, "going forward again should restore back navigation");
assert.equal(app.currentExamIndex(), 1, "currentExamIndex should report marathon position");
app.saveExamProgress();
const resumed = loadFlashcardsScript(app.localStorage.store);
assert.equal(resumed.currentExamIndex(), 1, "Marathon should restore the saved question index from localStorage");
assert.equal(resumed.currentExamScore(), 1, "Marathon should restore saved score from localStorage");
assert.equal(resumed.examQuestions[0].points, 1, "Marathon should restore per-question scoring state");
assert.deepEqual(
  resumed.examQuestions[0].response,
  { type: "mcq", selected: "Wrong answer", right: false },
  "Marathon should restore the exact previous answer when going back after reload"
);
const writeQuestion = resumed.examQuestions.find(q => q.kind === "write");
resumed.recordExamResponse(writeQuestion, { type: "write", answer: "my attempt", verdict: "close" });
assert.deepEqual(writeQuestion.response, { type: "write", answer: "my attempt", verdict: "close" });
const marathonKey = Object.keys(app.localStorage.store).find(key => key.includes("marathon"));
const dirtySaved = JSON.parse(app.localStorage.store[marathonKey]);
// Corrupt an active-recall entry with a doubled prefix; normalize should strip it on load.
dirtySaved.questions[1].idkReview = true;
dirtySaved.questions[1].prompt = "Active recall: Active recall: Which statement about histograms is correct?";
const migrated = loadFlashcardsScript({ [marathonKey]: JSON.stringify(dirtySaved) });
assert.equal(
  migrated.examQuestions[1].prompt,
  "Active recall: Which statement about histograms is correct?",
  "loading saved Marathon progress should normalize duplicate review prefixes"
);
resumed.resetExamProgress();
assert.equal(
  Object.keys(resumed.localStorage.store).some(key => key.includes("marathon")),
  false,
  "resetExamProgress should remove Marathon localStorage state"
);

console.log("flashcards exam tests passed");

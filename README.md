# AI Prep

An adaptive study app for high school Technology Student Association (TSA) members learning artificial intelligence and prompt engineering. It works like a focused tutor: short lessons, Learn sessions that concentrate on what you get wrong, and hands-on prompt writing reviewed by an AI coach.

## Features

- **Learn mode.** Sessions run in rounds of 7 to 10 questions, shown as a conversation. Items climb **New → Familiar → Mastered**. New items appear as multiple choice, Familiar items come back as typed answers, and a miss drops an item one level and brings it back 3 to 5 questions later. Leitner-box spaced repetition schedules reviews across days. **Review my mistakes** builds a session from missed items, most-missed first.
- **Prompt practice inside Learn.** 17 prompt-writing challenges and 11 Spot the Problem rounds are part of Unit 7 and go through the same mastery levels. A prompt passes at a score of 80 or higher.
- **Local AI coach with Ollama (optional).** The coach runs the student's prompt on a model on their own computer, reads what it produced, then reviews the prompt against the rubric. It returns feedback for each criterion, a short coaching summary and a revised prompt. No account, API key or cost, and nothing leaves the computer. Without Ollama, or if it's unreachable, a rule-based checklist grades the prompt offline.
- **Gamified.** XP for correct answers, with combo, perfect-round and session bonuses. Levels, a daily XP goal with a progress ring, study streaks and 15 achievements. Sound effects are synthesized in the browser (no audio files) and can be muted or turned down. Confetti and toasts mark milestones, and animations respect reduced-motion settings.
- **Smart Answers.** Typed answers are graded offline and leniently: case, punctuation and leading articles are ignored, common abbreviations are expanded (ML, NN, LLM and others), and small typos are accepted. A near-miss that is a different real term (overfitting for underfitting, precision for recall) is never accepted. Close answers get an "Almost" hint and one more try.
- **Also included:** flashcards, timed or untimed practice tests, a searchable glossary with 103 terms, 8 lessons with diagrams, a home page with mastery by unit, a study streak and weakest terms, light and dark mode, and Advisor mode.
- **Content:** 8 units with 221 questions, all validated automatically.

## Setup

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
npm run build      # validate content, type-check, and build to dist/
npm run preview    # serve the production build locally
npm test           # run the unit tests (Vitest)
npm run validate-content
```

`npm run build` runs `validate-content` first, so a build fails if any content rule is broken.

## Editing content

All study content is JSON in `src/content/`:

| File | Contents |
| --- | --- |
| `units/u1-what-is-ai.json` … `units/u8-glossary.json` | Each unit's lesson, key terms and questions |
| `prompt-challenges.json` | Prompt Lab challenges with rubrics |
| `spot-the-problem.json` | Spot the Problem rounds |

### Questions

Every question needs `id`, `unitId`, `type`, `prompt`, `answer`, `explanation` (1 to 3 sentences), `difficulty` (1, 2 or 3) and `tags`.

| `type` | `answer` | Notes |
| --- | --- | --- |
| `mc`, `scenario` | the correct option's text | exactly 4 `options`, including the answer |
| `tf` | `true` or `false` | |
| `written` | the main answer | `acceptedAnswers` required (may be `[]`); optional 4 `options` let Learn mode show it as multiple choice first |
| `matching` | list of `{ "term", "definition" }` | at least 3 pairs |
| `ordering` | steps in the correct order | at least 3 steps |

Optional fields:

- `acceptedAnswers`: synonyms and abbreviations that count as correct. On `mc` and `scenario` questions, adding this field lets Learn mode ask the question as a typed answer at the Familiar level.
- `confusableWith`: real terms that look similar but are wrong. These are never accepted. Every glossary term and alias is also blocked automatically for other items.
- `orderInsensitive`: for comma-separated multi-part answers that may be typed in any order.
- `hint`: shown after an "Almost" answer.

Lessons need 300 to 600 words and a `diagram` or an `analogy`. `diagramAfter` sets which section the diagram follows.

### Prompt challenges

Each challenge has a `scenario`, an optional `weakPrompt`, a `strongExample` and a `rubric` of 4 to 6 criteria. Each criterion names a `check`: `task`, `audience`, `format`, `length`, `role`, `context`, `examples`, `constraints`, `steps`, `reasoning`, `verification`, `tone`, `noPersonalData`, `delimiters` or `keywords`. The `task` and `keywords` checks also use `keywords`. Validation requires the strong example to pass every criterion and the weak prompt to miss at least one. Practice items belong to Unit 7 unless they set `unitId`.

### What validation checks

Unique IDs; answers present and contained in their options; 4 options for multiple choice; explanations of 1 to 3 sentences; difficulty of 1 to 3; at least 25 questions per unit; lesson length; no placeholder text. It also self-tests Smart Answers: every accepted answer must grade as correct, and no confusable term may grade as correct. Prompt rubrics are checked against their strong and weak examples.

### Advisor mode

Turn it on in **Settings**. Advisors can add, edit and delete questions, import and export the question bank, download a unit as a JSON file, and review answers that students marked "I was right" (each one is logged as a flag). Edits are stored in that browser. To share them, download the unit file, replace the matching file in `src/content/units/`, run `npm run validate-content`, and redeploy. Advisor mode is a convenience switch, not a security control.

## The local AI coach (Ollama)

AI features are optional. They use [Ollama](https://ollama.com), which runs an open model on the student's own computer, so there's no account, API key or cost, and nothing typed is sent to an online service. Ollama runs on Windows, Mac and Linux. Most school Chromebooks can't run it; those devices automatically use the offline checklist.

**Setup (also shown in the app under Settings):**

1. Install Ollama from [ollama.com/download](https://ollama.com/download).
2. Download a model: `ollama pull llama3.2` (about 2 GB). Computers with 16 GB of memory or more can use a larger model, such as `qwen2.5:7b`, for better reviews. Any chat model works; embedding-only models are hidden from the list.
3. **Allow the website to reach Ollama.** Ollama already accepts requests from `localhost`, so `npm run dev` works with no changes. For the hosted site, set `OLLAMA_ORIGINS` to the site's origin, then quit and restart Ollama:
   - Windows: `setx OLLAMA_ORIGINS "https://ducksarecool1.github.io"`
   - Mac: `launchctl setenv OLLAMA_ORIGINS "https://ducksarecool1.github.io"`
   - Linux: add `Environment="OLLAMA_ORIGINS=https://ducksarecool1.github.io"` with `sudo systemctl edit ollama`, then restart it.

   If the browser asks whether the site may access devices on your local network, choose Allow. Safari may block an https site from reaching `http://localhost`; Chrome, Edge and Firefox allow it.
4. In **Settings**, turn on "Use my local Ollama model" and select **Check connection**. The app lists the installed models and picks one automatically.

**How a review works:**

- The app makes two calls to Ollama's `/api/chat`. The first runs the student's prompt. The second reviews the prompt and its output, using a JSON schema for structured output.
- The model's step-by-step "thinking" mode is turned off for speed; on a laptop, a review takes about 10 to 20 seconds.
- Small local models sometimes claim a checklist item is met when it isn't. So each "met" must quote the exact words from the student's prompt, and the app checks that the quote really appears there. The score comes from those verified judgments. Personal data is always checked by the deterministic offline detector.
- If Ollama is off, unreachable, slow (over 2 minutes) or returns unusable output, the review falls back to the offline checklist with a message explaining why.

## Gamification

| Action | XP |
| --- | --- |
| Correct multiple choice or true/false | 10 |
| Correct typed, matching or ordering answer | 15 |
| Combo bonus (3+ in a row / 5+ in a row) | +2 / +5 |
| Passing prompt practice (score 80+) | 10 + score ÷ 10 |
| Perfect round / finished session | +10 / +20 |
| Spot the Problem correct | 10 |
| Practice test, per correct answer | 5 |
| Flashcard reviewed | 2 |

- Wrong answers cost nothing; the item simply comes back.
- Levels need 100, 300, 600, 1,000 XP and so on.
- The daily goal (20, 50, 100 or 150 XP) is set on the Achievements page or in Settings.
- Achievements and XP are stored with the rest of the student's progress and included in progress exports.

## Deploying for free

The build is a static site in `dist/`. Routing uses `#/` URLs and asset paths are relative, so it works from any folder.

- **Netlify:** build command `npm run build`, publish directory `dist`.
- **Vercel:** framework preset Vite, build command `npm run build`, output directory `dist`.
- **GitHub Pages:** push the repo, then under Settings → Pages choose GitHub Actions and use the Vite static site starter workflow, or build locally and publish `dist/` to a `gh-pages` branch:

  ```bash
  npm run build && npx gh-pages -d dist
  ```

## Accessibility

- Every control is reachable from the keyboard, with visible focus rings and a skip link.
- Multiple choice: press 1 to 4 to answer. True/false: T or F. Flashcards: Space flips the card, 1 marks "Still learning", 2 marks "Know it".
- Matching works by tapping (no dragging required), and ordering uses arrow buttons.
- Results are announced with ARIA live regions.
- Color pairs meet WCAG AA in light and dark mode.
- The layout works from phone width up, and the app respects reduced-motion settings.

## Project structure

```
src/
  content/            JSON study content (edit this)
  lib/                pure logic: smartAnswer, learnSession, srs, selection, promptGrader,
                      promptReview, ai (Ollama), gamification, sound, celebrate, items,
                      stats, validateContent, storage
  components/         AnswerInput, Chat, PromptPractice, GameWidgets, Celebrations,
                      Layout, Diagram, ...
  pages/              Dashboard (home), Learn, Units, Flashcards, PracticeTest, PromptLab,
                      SpotProblem, Glossary, Achievements, Settings, Advisor
scripts/              validate-content.ts and loadContent.ts
tests/                Vitest unit tests
```

## Facts to verify

All content was written and fact-checked for accuracy as of 2026, but a human should confirm these items before relying on them in competition:

1. Unit 6 lesson and question u6-q10: the U.S. Copyright Office's position that copyright requires human authorship, so purely AI-generated material generally is not protected.
2. Unit 6 lesson and question u6-q27: studies found some facial analysis systems less accurate for some groups. This is stated generally, with no figures.
3. Unit 1: AlexNet won the 2012 ImageNet challenge "by a wide margin" using GPUs.
4. Unit 1: the 1956 Dartmouth workshop proposal, by John McCarthy and colleagues, introduced the term "artificial intelligence."
5. Unit 1 glossary example: the "T" in GPT stands for transformer.
6. Unit 1: ChatGPT was released in November 2022.
7. Question u3-q19: the RLHF steps are simplified. Many real pipelines add a supervised fine-tuning step before reward modeling.
8. Unit 2 glossary example: the token split of "unbelievable" is illustrative. Real tokenizers differ.
9. Unit 4: the description of diffusion models is simplified for a high school audience.
10. Question u7-q21: the description of the temperature setting is a general description. Products vary.

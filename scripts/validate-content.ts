// `npm run validate-content`: fails (exit code 1) if any content rule is broken.
// `npm run build` runs this first, so invalid content can never be deployed.
import { validateContent } from '../src/lib/validateContent';
import { loadContentFromDisk } from './loadContent';

const report = validateContent(loadContentFromDisk());
const { stats } = report;

console.log('AI Prep content validation');
console.log(`  Units: ${stats.units}`);
for (const [id, n] of Object.entries(stats.questionsPerUnit)) {
  console.log(`    ${id}: ${n} questions, lesson ${stats.lessonWords[id]} words`);
}
console.log(`  Questions: ${stats.questions}`);
console.log(`  Glossary terms: ${stats.terms}`);
console.log(`  Prompt challenges: ${stats.challenges}`);
console.log(`  Spot-the-problem items: ${stats.spotProblems}`);

for (const w of report.warnings) console.warn(`  warning: ${w}`);

if (report.errors.length > 0) {
  console.error(`\n${report.errors.length} error(s):`);
  for (const e of report.errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nAll content checks passed.');

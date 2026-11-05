import { execSync } from 'child_process';

const commits = execSync('git log --format=%H', { encoding: 'utf8' }).trim().split('\n');
console.log(`Searching ${commits.length} commits for isOneDockPier...`);

for (const hash of commits) {
  try {
    const diff = execSync(`git show ${hash}`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    if (diff.includes('isOneDockPier')) {
      console.log(`Found in commit: ${hash}`);
      const lines = diff.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('isOneDockPier')) {
          console.log(`  ${l}`);
        }
      });
    }
  } catch(e) {}
}

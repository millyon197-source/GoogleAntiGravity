import fs from 'fs';

const hashTablePath = './dae_hash_table.json';
const table = JSON.parse(fs.readFileSync(hashTablePath, 'utf8'));

let samplePath = null;
table.forEach(bucket => {
  bucket.forEach(item => {
    if (!samplePath && item.files.length > 0) {
      const fullPath = `D:${item.folder_path.replace(/\//g, '\\')}\\${item.files[0]}`;
      if (fs.existsSync(fullPath)) {
        samplePath = fullPath;
      }
    }
  });
});

if (samplePath) {
  console.log('--- COLLADA FILE INSPECTION ---');
  console.log('File:', samplePath);
  const content = fs.readFileSync(samplePath, 'utf8');
  const upAxisMatch = /<up_axis>([^<]+)<\/up_axis>/i.exec(content);
  console.log('Up Axis:', upAxisMatch ? upAxisMatch[1] : 'Not specified');

  const nodeRegex = /<node\s+([^>]+)>([\s\S]*?)<\/node>/gi;
  let match;
  while ((match = nodeRegex.exec(content)) !== null) {
    if (match[2].includes('<matrix') || match[2].includes('<translate') || match[2].includes('<rotate')) {
      console.log('Node:', match[1]);
      const matrixMatch = /<matrix[^>]*>([^<]+)<\/matrix>/i.exec(match[2]);
      const transMatch = /<translate[^>]*>([^<]+)<\/translate>/i.exec(match[2]);
      const rotMatch = /<rotate[^>]*>([^<]+)<\/rotate>/i.exec(match[2]);
      if (matrixMatch) console.log('  Matrix:', matrixMatch[1].trim());
      if (transMatch) console.log('  Translate:', transMatch[1].trim());
      if (rotMatch) console.log('  Rotate:', rotMatch[1].trim());
    }
  }
} else {
  console.log('No DAE files found on disk under D:\\assets1');
}

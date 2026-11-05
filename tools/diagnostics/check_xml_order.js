import fs from 'fs';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const content = fs.readFileSync(xmlPath, 'utf8');

const regex = /<entry\s+index="(\d+)"/g;
let match;
const indicesInFile = [];
while ((match = regex.exec(content)) !== null) {
  indicesInFile.push(parseInt(match[1]));
}

console.log('Indices 20 to 50:', indicesInFile.slice(20, 50));
console.log('Indices 50 to 80:', indicesInFile.slice(50, 80));

// Find where index=1 is located in indicesInFile
const idxOf1 = indicesInFile.indexOf(1);
console.log('Index of entry 1 in file order:', idxOf1);
console.log('Surrounding indices:', indicesInFile.slice(idxOf1 - 5, idxOf1 + 6));

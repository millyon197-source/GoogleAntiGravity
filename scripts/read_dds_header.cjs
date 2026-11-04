const fs = require('fs');

const ddsBuffer = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
console.log('File size:', ddsBuffer.length);
// DDS Header
const magic = ddsBuffer.toString('ascii', 0, 4);
const height = ddsBuffer.readUInt32LE(12);
const width = ddsBuffer.readUInt32LE(16);
const mipMapCount = ddsBuffer.readUInt32LE(28);
const fourCC = ddsBuffer.toString('ascii', 84, 88);
console.log(`Magic: ${magic}, Width: ${width}, Height: ${height}, Mipmaps: ${mipMapCount}, FourCC: ${fourCC}`);

// Check pixel data after 128 byte header
console.log('First 64 bytes of pixel data:');
console.log(ddsBuffer.subarray(128, 192));

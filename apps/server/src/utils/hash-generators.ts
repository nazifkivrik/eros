import fs from "node:fs/promises";
import { createReadStream } from "node:fs";

const HASH_CHUNK_SIZE = 65536; // 64KB

/**
 * Generate OpenSubtitles hash for a video file
 * Algorithm: Sum first 64KB + last 64KB + file size (as 64-bit unsigned int)
 *
 * @param filePath - Absolute path to the video file
 * @returns 16-character hexadecimal hash string
 */
export async function generateOSHash(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  const fileSize = stats.size;

  if (fileSize < HASH_CHUNK_SIZE) {
    throw new Error("File too small for OSHASH calculation (minimum 64KB required)");
  }

  // Read first 64KB
  const firstChunk = await readChunk(filePath, 0, HASH_CHUNK_SIZE);

  // Read last 64KB
  const lastChunk = await readChunk(filePath, fileSize - HASH_CHUNK_SIZE, HASH_CHUNK_SIZE);

  // Calculate hash
  let hash = BigInt(fileSize);

  // Add first chunk (process as 64-bit unsigned integers)
  for (let i = 0; i < HASH_CHUNK_SIZE; i += 8) {
    hash += firstChunk.readBigUInt64LE(i);
  }

  // Add last chunk
  for (let i = 0; i < HASH_CHUNK_SIZE; i += 8) {
    hash += lastChunk.readBigUInt64LE(i);
  }

  // Keep only 64 bits (handle overflow)
  hash = hash & BigInt("0xFFFFFFFFFFFFFFFF");

  // Return as 16-character hex string
  return hash.toString(16).padStart(16, "0");
}

/**
 * Read a chunk of data from a file
 *
 * @param filePath - Path to the file
 * @param start - Start byte position
 * @param length - Number of bytes to read
 * @returns Buffer containing the chunk data
 */
async function readChunk(filePath: string, start: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start, end: start + length - 1 });

    stream.on("data", (chunk) => chunks.push(chunk as Buffer));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// @MX:NOTE [AUTO] Minimal ZIP (STORE method) writer + reader for audit packages.
// @MX:REASON No ZIP library is a project dependency. Audit packages are small text
//            evidence files (JSON/JSONL), so STORE (no compression) is sufficient
//            and keeps the format fully deterministic for hash verification.
//            PKZIP spec: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5)

import { crc32 } from 'node:zlib';

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

interface ZipFile {
  path: string;
  content: Buffer;
}

/**
 * Serializes a list of files into a ZIP buffer using STORE (method 0, no compression).
 * Returns the raw ZIP binary.
 */
export function writeZip(files: ZipFile[]): Buffer {
  // Interleave each file's [localHeader, name, content] so the running offset
  // matches what we record in the central directory. Concatenating all headers
  // then all data would desync the offsets and break readers.
  const localBlobs: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.path, 'utf8');
    const crc = crc32(file.content) >>> 0; // unsigned
    const size = file.content.length;

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract (2.0)
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(0, 8); // compression method: STORE
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14); // CRC-32
    localHeader.writeUInt32LE(size, 18); // compressed size
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length

    localBlobs.push(localHeader, nameBuf, file.content);

    // Central directory entry (46 bytes + name)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_DIR_SIG, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // gp bit flag
    central.writeUInt16LE(0, 10); // method: STORE
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // offset of local header
    centralEntries.push(central, nameBuf);

    offset += localHeader.length + nameBuf.length + file.content.length;
  }

  const localBlob = Buffer.concat(localBlobs);
  const centralBlob = Buffer.concat(centralEntries);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(files.length, 8); // entries on this disk
  end.writeUInt16LE(files.length, 10); // total entries
  end.writeUInt32LE(centralBlob.length, 12); // central dir size
  end.writeUInt32LE(localBlob.length, 16); // offset of central dir
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBlob, centralBlob, end]);
}

interface ParsedCentralEntry {
  path: string;
  localHeaderOffset: number;
  compressedSize: number;
  crc: number;
}

function readCentralDirectory(buf: Buffer): ParsedCentralEntry[] {
  // Find End Of Central Directory record by scanning backwards for its signature.
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === END_OF_CENTRAL_DIR_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('ZIP EOCD record not found');

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries: ParsedCentralEntry[] = [];
  let cursor = centralOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(cursor) !== CENTRAL_DIR_SIG) {
      throw new Error(`ZIP central entry ${i} signature mismatch`);
    }
    const crc = buf.readUInt32LE(cursor + 16);
    const compSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const path = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    entries.push({ path, localHeaderOffset, compressedSize: compSize, crc });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Reads a single entry from a STORE-mode ZIP and returns its UTF-8 text content.
 * Returns null if the entry does not exist.
 */
export function readZipEntry(zipBuffer: Buffer, entryPath: string): string | null {
  const entries = readCentralDirectory(zipBuffer);
  const entry = entries.find((e) => e.path === entryPath);
  if (!entry) return null;

  // Parse local file header to find data start.
  const off = entry.localHeaderOffset;
  if (zipBuffer.readUInt32LE(off) !== LOCAL_FILE_HEADER_SIG) {
    throw new Error('ZIP local header signature mismatch');
  }
  const nameLen = zipBuffer.readUInt16LE(off + 26);
  const extraLen = zipBuffer.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const data = zipBuffer.subarray(dataStart, dataStart + entry.compressedSize);
  return data.toString('utf8');
}

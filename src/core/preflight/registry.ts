import type { CapabilityLevel, VirtualFile } from '../vfs/types'
import type { FileCategory } from './types'

export interface FormatDescriptor {
  readonly mime: string
  readonly category: FileCategory
  readonly level: CapabilityLevel
  readonly adapterId: string
  readonly reason: string
  readonly macroEnabled?: boolean
  readonly activeContent?: boolean
  readonly executable?: boolean
  readonly nestedArchive?: boolean
}

const TEXT = (mime: string, category: 'text' | 'code' = 'text'): FormatDescriptor => ({
  mime,
  category,
  level: 'A',
  adapterId: 'text',
  reason: 'Contenuto testuale leggibile integralmente con adapter generico.',
})

const INVENTORY = (mime: string, category: FileCategory): FormatDescriptor => ({
  mime,
  category,
  level: 'D',
  adapterId: 'inventory',
  reason: 'Metadati e inventario sicuro; nessuna conversione universale promessa.',
})

const EXTENSIONS: Readonly<Record<string, FormatDescriptor>> = {
  txt: TEXT('text/plain'),
  md: TEXT('text/markdown'),
  markdown: TEXT('text/markdown'),
  rst: TEXT('text/x-rst'),
  json: TEXT('application/json', 'code'),
  jsonc: TEXT('application/json', 'code'),
  jsonl: TEXT('application/x-ndjson', 'code'),
  xml: TEXT('application/xml', 'code'),
  yaml: TEXT('application/yaml', 'code'),
  yml: TEXT('application/yaml', 'code'),
  toml: TEXT('application/toml', 'code'),
  ini: TEXT('text/plain', 'code'),
  properties: TEXT('text/plain', 'code'),
  csv: TEXT('text/csv'),
  tsv: TEXT('text/tab-separated-values'),
  html: { ...TEXT('text/html', 'code'), activeContent: true },
  htm: { ...TEXT('text/html', 'code'), activeContent: true },
  css: TEXT('text/css', 'code'),
  js: TEXT('text/javascript', 'code'),
  mjs: TEXT('text/javascript', 'code'),
  cjs: TEXT('text/javascript', 'code'),
  ts: TEXT('text/typescript', 'code'),
  tsx: TEXT('text/typescript', 'code'),
  jsx: TEXT('text/javascript', 'code'),
  py: TEXT('text/x-python', 'code'),
  java: TEXT('text/x-java-source', 'code'),
  kt: TEXT('text/x-kotlin', 'code'),
  kts: TEXT('text/x-kotlin', 'code'),
  c: TEXT('text/x-c', 'code'),
  h: TEXT('text/x-c', 'code'),
  cc: TEXT('text/x-c++', 'code'),
  cpp: TEXT('text/x-c++', 'code'),
  cxx: TEXT('text/x-c++', 'code'),
  hpp: TEXT('text/x-c++', 'code'),
  cs: TEXT('text/x-csharp', 'code'),
  go: TEXT('text/x-go', 'code'),
  rs: TEXT('text/x-rust', 'code'),
  swift: TEXT('text/x-swift', 'code'),
  php: TEXT('text/x-php', 'code'),
  rb: TEXT('text/x-ruby', 'code'),
  sh: TEXT('text/x-shellscript', 'code'),
  bash: TEXT('text/x-shellscript', 'code'),
  zsh: TEXT('text/x-shellscript', 'code'),
  ps1: TEXT('text/x-powershell', 'code'),
  bat: TEXT('text/x-msdos-batch', 'code'),
  cmd: TEXT('text/x-msdos-batch', 'code'),
  sql: TEXT('application/sql', 'code'),
  graphql: TEXT('application/graphql', 'code'),
  gql: TEXT('application/graphql', 'code'),
  vue: TEXT('text/plain', 'code'),
  svelte: TEXT('text/plain', 'code'),
  pdf: {
    mime: 'application/pdf',
    category: 'document',
    level: 'A',
    adapterId: 'pdf',
    reason: 'Pagine originali e testo sono tecnicamente rappresentabili nel browser.',
  },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
    level: 'B',
    adapterId: 'docx',
    reason: 'Estrazione semantica strutturata con resa visuale derivata, non identica a Word.',
  },
  docm: {
    mime: 'application/vnd.ms-word.document.macroEnabled.12',
    category: 'document',
    level: 'B',
    adapterId: 'docx',
    reason: 'Contenuto OOXML estraibile senza eseguire macro.',
    macroEnabled: true,
  },
  doc: INVENTORY('application/msword', 'document'),
  rtf: INVENTORY('application/rtf', 'document'),
  odt: INVENTORY('application/vnd.oasis.opendocument.text', 'document'),
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'spreadsheet',
    level: 'B',
    adapterId: 'spreadsheet',
    reason: 'Valori, formule e struttura del workbook sono estraibili con limiti documentati.',
  },
  xlsm: {
    mime: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    category: 'spreadsheet',
    level: 'B',
    adapterId: 'spreadsheet',
    reason: 'Workbook estraibile senza valutare formule o eseguire macro.',
    macroEnabled: true,
  },
  xls: INVENTORY('application/vnd.ms-excel', 'spreadsheet'),
  ods: INVENTORY('application/vnd.oasis.opendocument.spreadsheet', 'spreadsheet'),
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    category: 'presentation',
    level: 'B',
    adapterId: 'presentation',
    reason: 'Testo, note e media inventariabili con resa semplificata.',
  },
  pptm: {
    mime: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    category: 'presentation',
    level: 'B',
    adapterId: 'presentation',
    reason: 'Contenuto OOXML estraibile senza eseguire macro.',
    macroEnabled: true,
  },
  ppt: INVENTORY('application/vnd.ms-powerpoint', 'presentation'),
  png: { mime: 'image/png', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata browser-native.' },
  jpg: { mime: 'image/jpeg', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata browser-native.' },
  jpeg: { mime: 'image/jpeg', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata browser-native.' },
  gif: { mime: 'image/gif', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata browser-native.' },
  webp: { mime: 'image/webp', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata browser-native.' },
  bmp: { mime: 'image/bmp', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata browser-native.' },
  tif: { mime: 'image/tiff', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata se decodificabile in sicurezza.' },
  tiff: { mime: 'image/tiff', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale derivata se decodificabile in sicurezza.' },
  svg: { mime: 'image/svg+xml', category: 'image', level: 'C', adapterId: 'image', reason: 'Rappresentazione visuale solo dopo sanitizzazione.', activeContent: true },
  zip: { ...INVENTORY('application/zip', 'archive'), nestedArchive: true },
  gz: { ...INVENTORY('application/gzip', 'archive'), nestedArchive: true },
  tgz: { ...INVENTORY('application/gzip', 'archive'), nestedArchive: true },
  rar: { ...INVENTORY('application/vnd.rar', 'archive'), nestedArchive: true },
  '7z': { ...INVENTORY('application/x-7z-compressed', 'archive'), nestedArchive: true },
  tar: { ...INVENTORY('application/x-tar', 'archive'), nestedArchive: true },
  mp3: INVENTORY('audio/mpeg', 'audio'),
  wav: INVENTORY('audio/wav', 'audio'),
  ogg: INVENTORY('audio/ogg', 'audio'),
  m4a: INVENTORY('audio/mp4', 'audio'),
  mp4: INVENTORY('video/mp4', 'video'),
  mov: INVENTORY('video/quicktime', 'video'),
  webm: INVENTORY('video/webm', 'video'),
  sqlite: INVENTORY('application/vnd.sqlite3', 'database'),
  sqlite3: INVENTORY('application/vnd.sqlite3', 'database'),
  db: INVENTORY('application/octet-stream', 'database'),
  exe: { mime: 'application/vnd.microsoft.portable-executable', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Eseguibile bloccato: solo segnalazione, nessuna apertura.', executable: true },
  dll: { mime: 'application/vnd.microsoft.portable-executable', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Libreria eseguibile bloccata.', executable: true },
  msi: { mime: 'application/x-msi', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Installer eseguibile bloccato.', executable: true },
  app: { mime: 'application/octet-stream', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Bundle applicativo bloccato.', executable: true },
  dmg: { mime: 'application/x-apple-diskimage', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Immagine disco inventariata ma non aperta.', executable: true },
  apk: { mime: 'application/vnd.android.package-archive', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Pacchetto applicativo bloccato.', executable: true },
  jar: { mime: 'application/java-archive', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Archivio eseguibile Java bloccato.', executable: true },
  wasm: { mime: 'application/wasm', category: 'binary', level: 'E', adapterId: 'blocked', reason: 'Modulo WebAssembly inventariato senza esecuzione.', executable: true },
}

const SPECIAL_NAMES: Readonly<Record<string, FormatDescriptor>> = {
  dockerfile: TEXT('text/x-dockerfile', 'code'),
  makefile: TEXT('text/x-makefile', 'code'),
  license: TEXT('text/plain'),
  readme: TEXT('text/plain'),
  '.env': TEXT('text/plain', 'code'),
  '.gitignore': TEXT('text/plain', 'code'),
  '.npmrc': TEXT('text/plain', 'code'),
  '.editorconfig': TEXT('text/plain', 'code'),
}

export function descriptorForFile(file: Pick<VirtualFile, 'extension' | 'name'>): FormatDescriptor | undefined {
  return EXTENSIONS[file.extension] ?? SPECIAL_NAMES[file.name.toLowerCase()]
}

export function unknownTextDescriptor(): FormatDescriptor {
  return {
    mime: 'text/plain',
    category: 'text',
    level: 'B',
    adapterId: 'text',
    reason: 'Testo rilevato senza un formato affidabile; estrazione generica con segnalazione.',
  }
}

export function unknownBinaryDescriptor(): FormatDescriptor {
  return {
    mime: 'application/octet-stream',
    category: 'binary',
    level: 'D',
    adapterId: 'inventory',
    reason: 'Formato binario non riconosciuto: metadati e inventario soltanto.',
  }
}

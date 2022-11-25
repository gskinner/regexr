import libpcre2 from './libpcre2.js';
import {Buffer} from 'buffer';

const utf16Decoder = new TextDecoder('utf-16')
let initialized = false
const cfunc = {}

const ptrSym = Symbol('ptr')
const nametableSym = Symbol('nametable')
const patternSym = Symbol('pattern')

const PCRE2_NO_MATCH = -1
const PCRE2_ERROR_NOMEMORY = -48
const PCRE2_SUBSTITUTE_GLOBAL = 0x00000100
const PCRE2_SUBSTITUTE_EXTENDED = 0x00000200

const MAX_OUTPUT_BUFFER_SIZE = 1 * 1024 * 1024

export default class PCRE {
  static async init() {
    await libpcre2.loaded;

    Object.assign(cfunc, {
      malloc(bytes) { return libpcre2._malloc(bytes) },
      free(ptr) { return libpcre2._free(ptr) },
      version: libpcre2.cwrap('version', 'number', ['number']),
      compile: libpcre2.cwrap('compile', 'number', ['array', 'number', 'string']),
      destroyCode: libpcre2.cwrap('destroyCode', null, ['number']),
      lastErrorMessage: libpcre2.cwrap('lastErrorMessage', 'number', ['number', 'number']),
      lastErrorOffset: libpcre2.cwrap('lastErrorOffset', 'number'),
      match: libpcre2.cwrap('match', 'number', ['number', 'array', 'number', 'number']),
      substitute: libpcre2.cwrap('substitute', 'number', ['number', 'array', 'number', 'number', 'number', 'number', 'array', 'number', 'number', 'number']),
      createMatchData: libpcre2.cwrap('createMatchData', 'number', ['number']),
      destroyMatchData: libpcre2.cwrap('destroyMatchData', null, ['number']),
      getOvectorCount: libpcre2.cwrap('getOvectorCount', 'number', ['number']),
      getOvectorPtr: libpcre2.cwrap('getOvectorPointer', 'number', ['number']),
      getCaptureCount: libpcre2.cwrap('getCaptureCount', 'number', ['number']),
      getMatchNameCount: libpcre2.cwrap('getMatchNameCount', 'number', ['number']),
      getMatchNameTableEntrySize: libpcre2.cwrap('getMatchNameTableEntrySize', 'number', ['number']),
      getMatchNameTable: libpcre2.cwrap('getMatchNameTable', 'number', ['number']),
    })

    initialized = true
  }

  static version() {
    const len = cfunc.version(0)
    const ptr = allocateStringBuffer(len)
    cfunc.version(ptr)
    return copyAndFreeStringBuffer(ptr, len)
  }

  constructor(pattern, flags = '') {
    const patternBuffer = Buffer.from(pattern, 'utf16le')
    const ptr = cfunc.compile(patternBuffer, patternBuffer.length / 2, flags)

    if (ptr === 0) {
      const { errorMessage, offset } = this.getLastError()
      const err = new Error(errorMessage)
      err.offset = offset
      throw err
    }

    this[ptrSym] = ptr
    this[patternSym] = pattern

    // extract the nametable
    const nameCount = this.getMatchNameCount()
    const entrySize = this.getMatchNameTableEntrySize()
    const tableBuf = this.getMatchNameTable()
    this[nametableSym] = convertNameTable(tableBuf, nameCount, entrySize)
  }

  destroy() {
    if (this[ptrSym] === 0) return
    cfunc.destroyCode(this[ptrSym])
    this[ptrSym] = 0
  }

  getLastError() {
    const errMsgBufLen = 256
    const errMsgBuf = allocateStringBuffer(errMsgBufLen)
    const actualErrMsgLen = cfunc.lastErrorMessage(errMsgBuf, errMsgBufLen)
    const errorMessage = copyAndFreeStringBuffer(errMsgBuf, actualErrMsgLen)
    const offset = cfunc.lastErrorOffset()

    return { errorMessage, offset }
  }

  createMatchData() {
    return cfunc.createMatchData(this[ptrSym])
  }

  destroyMatchData(matchDataPtr) {
    cfunc.destroyMatchData(matchDataPtr)
  }

  exec(subject, options) {
    if (options) {
      return this.matchAll(subject)
    }
    else {
      return this.match(subject)
    }
  }

  match(subject, start) {
    if (start >= subject.length) {
      return null
    }

    const startOffset = start || 0

    const subjectBuffer = Buffer.from(subject, 'utf16le')

    const matchDataPtr = this.createMatchData()

    const result = cfunc.match(
      this[ptrSym],
      subjectBuffer,
      subjectBuffer.length / 2,
      startOffset,
      matchDataPtr
    )

    if (result < 0) {
      this.destroyMatchData(matchDataPtr)

      if (result === PCRE2_NO_MATCH) {
        return null
      }
      else {
        const msg = getPCRE2Error(result)
        const err = new Error(msg)
        err.code = result
        throw err
      }
    }

    // extract the matches from the pcre2_match_data block
    const matchCount = this.getOvectorCount(matchDataPtr)
    const vectorPtr = this.getOvectorPtr(matchDataPtr)
    const matches = convertOVector(subject, vectorPtr, matchCount)

    // merge in nametable entries
    const results = { ...matches }
    for (let i in matches) {
      if (i in this[nametableSym]) {
        const name = this[nametableSym][i]
        results[name] = matches[i]
        results[name].group = i
        matches[i].name = name
      }
    }

    this.destroyMatchData(matchDataPtr)

    results.length = matchCount
    return results
  }

  matchAll(subject) {
    let safety = 1000

    let results = []
    let iter
    let start = 0

    while ((iter = this.match(subject, start)) !== null) {
      results.push(iter)
      start = iter[0].end

      safety--
      // assert(safety > 0, 'safety limit exceeded')
    }

    return results
  }

  substituteAll(subject, replacement) {
    return this.substitute(subject, replacement, 0, PCRE2_SUBSTITUTE_GLOBAL)
  }

  substitute(subject, replacement, startOffset, options) {
    if (startOffset >= subject.length) {
      return null
    }

    startOffset = startOffset || 0
    options = options || 0
    options = options | PCRE2_SUBSTITUTE_EXTENDED

    const subjectBuffer = Buffer.from(subject, 'utf16le')

    const replacementBuffer = Buffer.from(replacement, 'utf16le')

    let factor = 1.5

    for (; ;) {
      const matchDataPtr = this.createMatchData()

      // This size is in character units, not bytes
      const outputBufferSize = Math.trunc(subject.length * factor)

      if (outputBufferSize > MAX_OUTPUT_BUFFER_SIZE) {
        return PCRE2_ERROR_NOMEMORY
      }

      const outputBuffer = allocateStringBuffer(outputBufferSize)

      const result = cfunc.substitute(
        this[ptrSym],
        subjectBuffer,
        subjectBuffer.length / 2,
        startOffset,
        matchDataPtr,
        options,
        replacementBuffer,
        replacementBuffer.length / 2,
        outputBuffer,
        outputBufferSize)

      if (result < 0) {
        this.destroyMatchData(matchDataPtr)

        if (result === PCRE2_ERROR_NOMEMORY) {
          cfunc.free(outputBuffer)
          factor *= 2
          continue
        }
        else {
          cfunc.free(outputBuffer)
          const msg = getPCRE2Error(result)
          const err = new Error(msg)
          err.code = result
          throw err
        }
      }

      return copyAndFreeStringBuffer(outputBuffer, result)
    }
  }

  getOvectorCount(matchDataPtr) {
    return cfunc.getOvectorCount(matchDataPtr)
  }

  getOvectorPtr(matchDataPtr) {
    return cfunc.getOvectorPtr(matchDataPtr)
  }

  getCaptureCount() {
    if (this[ptrSym] === 0) return
    return cfunc.getCaptureCount(this[ptrSym])
  }

  getMatchNameCount() {
    if (this[ptrSym] === 0) return
    return cfunc.getMatchNameCount(this[ptrSym])
  }

  getMatchNameTableEntrySize() {
    if (this[ptrSym] === 0) return
    return cfunc.getMatchNameTableEntrySize(this[ptrSym])
  }

  getMatchNameTable() {
    if (this[ptrSym] === 0) return
    return cfunc.getMatchNameTable(this[ptrSym])
  }
}

function allocateStringBuffer(len) {
  return cfunc.malloc(len * 2)
}

function copyStringBuffer(ptr, len) {
  len = libpcre2.HEAPU16[(ptr / 2) + (len - 1)] === 0 ? len - 1 : len
  const encodedString = libpcre2.HEAP8.subarray(ptr, ptr + (len * 2))
  return utf16Decoder.decode(encodedString)
}

function copyAndFreeStringBuffer(ptr, len) {
  const string = copyStringBuffer(ptr, len)
  cfunc.free(ptr)
  return string
}

function convertOVector(subject, vectorPtr, vectorCount) {
  const table = []

  for (let i = 0; i < vectorCount; i++) {
    let ptr = vectorPtr + i * 4 * 2
    const start = libpcre2.getValue(ptr, 'i32', false)
    const end = libpcre2.getValue(ptr + 4, 'i32', false)
    const match = subject.substring(start, end)
    table.push({ start, end, match })
  }

  return table
}

function convertNameTable(nameTablePtr, entries, entrySize) {
  const table = {}

  for (let i = 0; i < entries; i++) {
    let ptr = nameTablePtr + entrySize * i * 2

    const index = libpcre2.getValue(ptr, 'i16', false)
    const name = copyStringBuffer(ptr + 2, utf16lelen(ptr + 2))
    table[index] = name
  }

  return table
}

function utf16lelen(ptr) {
  let len = 0
  while (libpcre2.getValue(ptr, 'i16', false) !== 0) {
    len++
    ptr += 2
  }
  return len
}

const ERRORS = {
  "-1": "PCRE2_ERROR_NOMATCH",
  "-2": "PCRE2_ERROR_PARTIAL",
  "-3": "PCRE2_ERROR_UTF8_ERR1",
  "-4": "PCRE2_ERROR_UTF8_ERR2",
  "-5": "PCRE2_ERROR_UTF8_ERR3",
  "-6": "PCRE2_ERROR_UTF8_ERR4",
  "-7": "PCRE2_ERROR_UTF8_ERR5",
  "-8": "PCRE2_ERROR_UTF8_ERR6",
  "-9": "PCRE2_ERROR_UTF8_ERR7",
  "-10": "PCRE2_ERROR_UTF8_ERR8",
  "-11": "PCRE2_ERROR_UTF8_ERR9",
  "-12": "PCRE2_ERROR_UTF8_ERR10",
  "-13": "PCRE2_ERROR_UTF8_ERR11",
  "-14": "PCRE2_ERROR_UTF8_ERR12",
  "-15": "PCRE2_ERROR_UTF8_ERR13",
  "-16": "PCRE2_ERROR_UTF8_ERR14",
  "-17": "PCRE2_ERROR_UTF8_ERR15",
  "-18": "PCRE2_ERROR_UTF8_ERR16",
  "-19": "PCRE2_ERROR_UTF8_ERR17",
  "-20": "PCRE2_ERROR_UTF8_ERR18",
  "-21": "PCRE2_ERROR_UTF8_ERR19",
  "-22": "PCRE2_ERROR_UTF8_ERR20",
  "-23": "PCRE2_ERROR_UTF8_ERR21",
  "-24": "PCRE2_ERROR_UTF16_ERR1",
  "-25": "PCRE2_ERROR_UTF16_ERR2",
  "-26": "PCRE2_ERROR_UTF16_ERR3",
  "-27": "PCRE2_ERROR_UTF32_ERR1",
  "-28": "PCRE2_ERROR_UTF32_ERR2",
  "-29": "PCRE2_ERROR_BADDATA",
  "-30": "PCRE2_ERROR_MIXEDTABLES",
  "-31": "PCRE2_ERROR_BADMAGIC",
  "-32": "PCRE2_ERROR_BADMODE",
  "-33": "PCRE2_ERROR_BADOFFSET",
  "-34": "PCRE2_ERROR_BADOPTION",
  "-35": "PCRE2_ERROR_BADREPLACEMENT",
  "-36": "PCRE2_ERROR_BADUTFOFFSET",
  "-37": "PCRE2_ERROR_CALLOUT",
  "-38": "PCRE2_ERROR_DFA_BADRESTART",
  "-39": "PCRE2_ERROR_DFA_RECURSE",
  "-40": "PCRE2_ERROR_DFA_UCOND",
  "-41": "PCRE2_ERROR_DFA_UFUNC",
  "-42": "PCRE2_ERROR_DFA_UITEM",
  "-43": "PCRE2_ERROR_DFA_WSSIZE",
  "-44": "PCRE2_ERROR_INTERNAL",
  "-45": "PCRE2_ERROR_JIT_BADOPTION",
  "-46": "PCRE2_ERROR_JIT_STACKLIMIT",
  "-47": "PCRE2_ERROR_MATCHLIMIT",
  "-48": "PCRE2_ERROR_NOMEMORY",
  "-49": "PCRE2_ERROR_NOSUBSTRING",
  "-50": "PCRE2_ERROR_NOUNIQUESUBSTRING",
  "-51": "PCRE2_ERROR_NULL",
  "-52": "PCRE2_ERROR_RECURSELOOP",
  "-53": "PCRE2_ERROR_DEPTHLIMIT",
  "-54": "PCRE2_ERROR_UNAVAILABLE",
  "-55": "PCRE2_ERROR_UNSET",
  "-56": "PCRE2_ERROR_BADOFFSETLIMIT",
  "-57": "PCRE2_ERROR_BADREPESCAPE",
  "-58": "PCRE2_ERROR_REPMISSINGBRACE",
  "-59": "PCRE2_ERROR_BADSUBSTITUTION",
  "-60": "PCRE2_ERROR_BADSUBSPATTERN",
  "-61": "PCRE2_ERROR_TOOMANYREPLACE",
  "-62": "PCRE2_ERROR_BADSERIALIZEDDATA",
  "-63": "PCRE2_ERROR_HEAPLIMIT",
  "-64": "PCRE2_ERROR_CONVERT_SYNTAX",
  "-65": "PCRE2_ERROR_INTERNAL_DUPMATCH",
  "-66": "PCRE2_ERROR_DFA_UINVALID_UTF",
}

function getPCRE2Error(result) {
  const code = `${result}`

  if (code in ERRORS) {
    return ERRORS[code]
  }
  else {
    return "UNKNOWN"
  }
}

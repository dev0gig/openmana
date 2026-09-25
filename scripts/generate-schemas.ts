/*
 * Generates the TypeScript side of the app's JSON Schemas from their only
 * sources (the same way engine/protocol/scripts/generate.mjs does it for the
 * engine protocol). Two schemas:
 *
 *   local data  src/storage/schema/local-data.schema.json → src/storage/generated/
 *               (IndexedDB records, the backup file)
 *               and → src/storage/generated/catalog/ (the lines of the card
 *               catalog file: only loaded while a catalog is installed, so
 *               the app's start bundle does not carry them)
 *   Scryfall    src/cards/scryfall/scryfall.schema.json → src/cards/scryfall/generated/
 *               (what OpenMana reads from Scryfall's bulk data and API)
 *
 * For each:
 *   records.ts      types (json-schema-to-typescript; once per schema)
 *   constants.ts    versions and enums as runtime lists (local data only)
 *   validators.js   precompiled validators (Ajv standalone code: no eval at
 *                   run time, no Ajv in the bundle)
 *   validators.d.ts their types
 *
 *   npm run generate                          write the files
 *   node scripts/generate-schemas.ts --check  fail if they are not what the schemas give
 *
 * The generated files are committed: a schema change shows up in review as a
 * diff of types and validators. `npm run check` and `npm run build` run the
 * check first, so a forgotten regeneration fails instead of shipping stale
 * validators.
 */
import fs from "node:fs"
import path from "node:path"
import { Ajv2020 } from "ajv/dist/2020.js"
import standalone from "ajv/dist/standalone/index.js"
import { compile, type JSONSchema } from "json-schema-to-typescript"

const root = path.resolve(import.meta.dirname, "..")

interface Target {
  /** For messages. */
  readonly name: string
  readonly schemaFile: string
  readonly outDir: string
  /** The name of the synthetic root type (never emitted). */
  readonly rootTitle: string
  /** The public validators: export name -> definition in the schema. */
  readonly validators: Readonly<Record<string, string>>
  /** Types come from another target's records.ts (import path from outDir); no records.ts of its own. */
  readonly recordsFrom?: string
  /** constants.ts: versions (constant name -> definition with a const) and enums as runtime lists (constant name -> definition). */
  readonly constants?: {
    readonly versions: readonly { readonly name: string; readonly def: string; readonly doc: string }[]
    readonly enums: Readonly<Record<string, string>>
  }
}

const TARGETS: readonly Target[] = [
  {
    name: "local data",
    schemaFile: path.join(root, "src/storage/schema/local-data.schema.json"),
    outDir: path.join(root, "src/storage/generated"),
    rootTitle: "LocalDataDefinitions",
    validators: {
      validateDeckRecord: "DeckRecord",
      validateSettingRecord: "SettingRecord",
      validateMatchRecord: "MatchRecord",
      validateMatchLogEntry: "MatchLogEntry",
      validateCardRecord: "CardRecord",
      validatePrintRecord: "PrintRecord",
      validateSetRecord: "SetRecord",
      validateForgeOnlyCardRecord: "ForgeOnlyCardRecord",
      validateCacheEntryRecord: "CacheEntryRecord",
      validateMetaRecord: "MetaRecord",
      validateBackupHeader: "BackupHeader",
      validateBackupRecordLine: "BackupRecordLine",
      validateBackupEnd: "BackupEnd",
    },
    constants: {
      versions: [
        { name: "SCHEMA_VERSION", def: "SchemaVersion", doc: "Version of the record schemas = version of the IndexedDB database." },
        { name: "BACKUP_FORMAT_VERSION", def: "BackupFormatVersion", doc: "Version of the backup container format." },
        { name: "CATALOG_FORMAT_VERSION", def: "CatalogFormatVersion", doc: "Version of the card catalog container format." },
      ],
      enums: {
        DECK_FORMATS: "DeckFormat",
        DECK_SOURCE_KINDS: "DeckSourceKind",
        MATCH_STATUSES: "MatchStatus",
        GAME_RESULTS: "GameResult",
        CACHE_STATUSES: "CacheStatus",
        IMPORT_MODES: "ImportMode",
        BACKUP_STORES: "BackupStore",
        IMAGE_STATUSES: "ImageStatus",
        FORGE_ONLY_REASONS: "ForgeOnlyReason",
      },
    },
  },
  {
    name: "card catalog lines",
    schemaFile: path.join(root, "src/storage/schema/local-data.schema.json"),
    outDir: path.join(root, "src/storage/generated/catalog"),
    rootTitle: "LocalDataDefinitions",
    recordsFrom: "../records.ts",
    validators: {
      validateCatalogHeader: "CatalogHeader",
      validateCatalogLine: "CatalogLine",
      validateCatalogEnd: "CatalogEnd",
    },
  },
  {
    name: "Scryfall",
    schemaFile: path.join(root, "src/cards/scryfall/scryfall.schema.json"),
    outDir: path.join(root, "src/cards/scryfall/generated"),
    rootTitle: "ScryfallDefinitions",
    validators: {
      validateScryfallCard: "ScryfallCard",
      validateScryfallSet: "ScryfallSet",
      validateScryfallList: "ScryfallList",
      validateScryfallError: "ScryfallError",
      validateScryfallBulkDataList: "ScryfallBulkDataList",
    },
  },
]

function header(target: Target): string {
  return [
    "/*",
    " * GENERATED by scripts/generate-schemas.ts from",
    ` * ${path.relative(root, target.schemaFile)}. Do not edit: change the schema`,
    " * and run `npm run generate`.",
    " */",
  ].join("\n")
}

interface SchemaDocument {
  readonly $schema: string
  readonly $id: string
  readonly title: string
  readonly $defs: Record<string, Record<string, unknown>>
}

class GenerateError extends Error {}

function fail(message: string): never {
  throw new GenerateError(message)
}

function readSchema(target: Target): SchemaDocument {
  return JSON.parse(fs.readFileSync(target.schemaFile, "utf8")) as SchemaDocument
}

/**
 * A discriminated union (MetaRecord, CatalogLine) carries
 * `type`/`required`/`discriminator` next to its oneOf for the validators.
 * Every branch repeats the discriminator, so for the types the plain union of
 * the branches is the same type and reads better than the intersection the
 * tool would render.
 */
function schemaForTypes(schema: SchemaDocument): SchemaDocument {
  const copy = structuredClone(schema)
  for (const def of Object.values(copy.$defs)) {
    if (Array.isArray(def["oneOf"])) {
      const discriminator = (def["discriminator"] as { propertyName?: string } | undefined)?.propertyName
      for (const branch of def["oneOf"] as { $ref?: string }[]) {
        const target = branch.$ref ? copy.$defs[branch.$ref.replace("#/$defs/", "")] : undefined
        if (!target?.["title"]) fail(`union ${String(def["title"])}: every branch must be a $ref to a titled definition`)
        if (discriminator && !(target["required"] as string[] | undefined)?.includes(discriminator)) {
          fail(`union ${String(def["title"])}: branch ${String(target["title"])} must require '${discriminator}' itself`)
        }
      }
      delete def["type"]
      delete def["required"]
      delete def["properties"]
      delete def["discriminator"]
    }
  }
  return copy
}

async function generateTypes(target: Target, schema: SchemaDocument): Promise<string> {
  // json-schema-to-typescript declares $defs only below an object root, so the
  // definitions are compiled under a synthetic empty object that is removed again.
  const copy = schemaForTypes(schema)
  const syntheticRoot = {
    $schema: copy.$schema,
    $id: copy.$id,
    title: target.rootTitle,
    type: "object",
    additionalProperties: false,
    properties: {},
    $defs: copy.$defs,
  } as unknown as JSONSchema
  let ts = await compile(syntheticRoot, target.rootTitle, {
    bannerComment: header(target),
    unreachableDefinitions: true,
    additionalProperties: false,
    format: true,
    declareExternallyReferenced: true,
  })
  const rootName = target.rootTitle
  ts = ts.replace(new RegExp(`export interface ${rootName} \\{\\}\\n`), "")
  ts = ts.replace(new RegExp(`\\n \\*\\n \\* This interface was referenced by \`${rootName}\`'s JSON-Schema\\n \\* via the \`definition\` "[^"]+"\\.`, "g"), "")
  ts = ts.replace(new RegExp(`/\\*\\*\\n \\* This interface was referenced by \`${rootName}\`'s JSON-Schema\\n \\* via the \`definition\` "[^"]+"\\.\\n \\*/\\n`, "g"), "")
  if (ts.includes(rootName)) fail(`${target.name}: could not remove the synthetic root from the generated types`)
  return ts
}

function generateConstants(target: Target, schema: SchemaDocument): string | null {
  if (!target.constants) return null
  const defs = schema.$defs
  const constOf = (name: string): number => {
    const value = defs[name]?.["const"]
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) fail(`$defs.${name}.const must be a positive integer`)
    return value
  }
  const lines = [header(target), "", 'import type * as R from "./records.ts"']
  for (const version of target.constants.versions) {
    lines.push("")
    lines.push(`/** ${version.doc} */`)
    lines.push(`export const ${version.name} = ${constOf(version.def)} as const satisfies R.${version.def}`)
  }
  for (const [name, def] of Object.entries(target.constants.enums)) {
    const values = defs[def]?.["enum"]
    if (!Array.isArray(values)) fail(`$defs.${def} is not an enum`)
    lines.push("")
    lines.push(`/** Every value of ${def}. */`)
    lines.push(`export const ${name} = ${JSON.stringify(values)} as const satisfies readonly R.${def}[]`)
  }
  return `${lines.join("\n")}\n`
}

/** The schema without description/title annotations (they do not change what is valid). */
function withoutDocumentation(schema: SchemaDocument): SchemaDocument {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip)
    if (value === null || typeof value !== "object") return value
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "description" && key !== "title")
        .map(([key, child]) => [key, key === "properties" || key === "$defs" ? stripMap(child) : strip(child)]),
    )
  }
  // Inside properties and $defs the keys are names, not keywords: a property may be called "title".
  const stripMap = (map: unknown): unknown =>
    Object.fromEntries(Object.entries(map as Record<string, unknown>).map(([name, child]) => [name, strip(child)]))
  return strip(schema) as SchemaDocument
}

function generateValidators(target: Target, schema: SchemaDocument): string {
  const ajv = new Ajv2020({
    code: { source: true, esm: true, lines: true },
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
    inlineRefs: false,
    discriminator: true,
  })
  // Annotation for json-schema-to-typescript only.
  ajv.addKeyword({ keyword: "tsType", schemaType: "string" })
  // The validators only check; the documentation stays in the schema file
  // (Ajv would otherwise copy every description into the bundle).
  ajv.addSchema(withoutDocumentation(schema))
  const refs: Record<string, string> = {}
  for (const [name, def] of Object.entries(target.validators)) {
    if (!schema.$defs[def]) fail(`${target.name}: validator ${name}: $defs.${def} is missing`)
    refs[name] = `${schema.$id}#/$defs/${def}`
  }
  // A CommonJS module: its default export is on .default for TypeScript and Node alike.
  const code = standalone.default(ajv, refs)
  // Statements only: the schema's descriptions may well contain the word "import".
  if (/\brequire\(\s*["']|^\s*import\s[^\n]*\bfrom\s*["']/m.test(code)) {
    fail(
      `${target.name}: the generated validators import Ajv runtime helpers (minLength, uniqueItems, format …); avoid those keywords so the validators stay dependency-free`,
    )
  }
  return `${header(target)}\n// @ts-nocheck\n/* eslint-disable */\n${code}\n`
}

function generateValidatorTypes(target: Target): string {
  const lines = [
    header(target),
    "",
    `import type * as R from "${target.recordsFrom ?? "./records.ts"}"`,
    "",
    "/** One problem found by a validator (Ajv's error object, reduced to what OpenMana reads). */",
    "export interface SchemaError {",
    "  readonly instancePath: string",
    "  readonly schemaPath: string",
    "  readonly keyword: string",
    "  readonly params: Readonly<Record<string, unknown>>",
    "  readonly message?: string",
    "}",
    "",
    "/** A validator: a type guard that keeps the problems of its last call in `errors`. */",
    "export interface Validator<T> {",
    "  (data: unknown): data is T",
    "  errors?: readonly SchemaError[] | null",
    "}",
    "",
  ]
  for (const [name, def] of Object.entries(target.validators)) {
    lines.push(`export declare const ${name}: Validator<R.${def}>`)
  }
  return `${lines.join("\n")}\n`
}

/** The generated files of one target as its schema gives them: file name -> content. */
async function generatedFiles(target: Target): Promise<Record<string, string>> {
  const schema = readSchema(target)
  const files: Record<string, string> = {
    "validators.js": generateValidators(target, schema),
    "validators.d.ts": generateValidatorTypes(target),
  }
  if (target.recordsFrom === undefined) files["records.ts"] = await generateTypes(target, schema)
  const constants = generateConstants(target, schema)
  if (constants !== null) files["constants.ts"] = constants
  return files
}

/** Generated files that differ from what is on disk (empty: up to date), as paths relative to the repository. */
export async function staleFiles(): Promise<string[]> {
  const stale: string[] = []
  for (const target of TARGETS) {
    for (const [file, content] of Object.entries(await generatedFiles(target))) {
      const full = path.join(target.outDir, file)
      if (!fs.existsSync(full) || fs.readFileSync(full, "utf8") !== content) stale.push(path.relative(root, full))
    }
  }
  return stale
}

async function main(): Promise<void> {
  if (process.argv.includes("--check")) {
    const stale = await staleFiles()
    if (stale.length > 0) {
      fail(`generated schema files are stale (${stale.join(", ")}): a schema changed without regenerating. Run \`npm run generate\` and commit the result.`)
    }
    console.error("[openmana-schemas] generated files match the schemas")
    return
  }
  for (const target of TARGETS) {
    const outputs = await generatedFiles(target)
    fs.mkdirSync(target.outDir, { recursive: true })
    for (const [file, content] of Object.entries(outputs)) {
      fs.writeFileSync(path.join(target.outDir, file), content)
    }
    console.error(`[openmana-schemas] ${target.name}: wrote ${Object.keys(outputs).join(", ")} to ${path.relative(root, target.outDir)}`)
  }
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    console.error(`[openmana-schemas] ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

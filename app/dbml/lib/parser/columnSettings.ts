import { unquote } from "./settings";
import type { RefSymbol } from "./types";

export interface InlineRef {
  symbol: RefSymbol;
  table: string;
  column: string;
}

export interface ParsedColumnSettings {
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isIncrement: boolean;
  defaultValue: string | null;
  note: string | null;
  inlineRef: InlineRef | null;
}

const REF_SETTING_PATTERN = /^(<>|<|>|-)\s*([\w."]+)\.([\w"]+)$/;

/** Interpreta la lista de settings `[...]` de una columna (`pk`, `not null`, `ref: > t.c`, etc). */
export function parseColumnSettings(settingsList: string[]): ParsedColumnSettings {
  const result: ParsedColumnSettings = {
    isPrimaryKey: false,
    isNotNull: false,
    isUnique: false,
    isIncrement: false,
    defaultValue: null,
    note: null,
    inlineRef: null,
  };

  for (const rawSetting of settingsList) {
    const setting: string = rawSetting.trim();
    const lower: string = setting.toLowerCase();

    if (lower === "pk" || lower === "primary key") {
      result.isPrimaryKey = true;
    } else if (lower === "not null") {
      result.isNotNull = true;
    } else if (lower === "null") {
      result.isNotNull = false;
    } else if (lower === "unique") {
      result.isUnique = true;
    } else if (lower === "increment") {
      result.isIncrement = true;
    } else if (lower.startsWith("default:")) {
      result.defaultValue = unquote(setting.slice("default:".length));
    } else if (lower.startsWith("note:")) {
      result.note = unquote(setting.slice("note:".length));
    } else if (lower.startsWith("ref:")) {
      const refBody: string = setting.slice("ref:".length).trim();
      const match = refBody.match(REF_SETTING_PATTERN);
      if (match) {
        const [, symbol, table, column] = match;
        result.inlineRef = {
          symbol: symbol as RefSymbol,
          table: (table.split(".").pop() ?? table).replace(/"/g, ""),
          column: column.replace(/"/g, ""),
        };
      }
    }
    // Otros settings (p. ej. "color" u otros no estándar) se ignoran.
  }

  return result;
}

export interface ParsedTableSettings {
  headerColor: string | null;
  note: string | null;
}

/** Interpreta la lista de settings `[...]` de una tabla (`headercolor:`, `note:`). */
export function parseTableSettings(settingsList: string[]): ParsedTableSettings {
  const result: ParsedTableSettings = { headerColor: null, note: null };

  for (const rawSetting of settingsList) {
    const setting: string = rawSetting.trim();
    const lower: string = setting.toLowerCase();

    if (lower.startsWith("headercolor:")) {
      result.headerColor = unquote(setting.slice("headercolor:".length));
    } else if (lower.startsWith("note:")) {
      result.note = unquote(setting.slice("note:".length));
    }
  }

  return result;
}

export interface ParsedTableGroupSettings {
  color: string | null;
}

/** Interpreta la lista de settings `[...]` de un TableGroup (`color:`). */
export function parseTableGroupSettings(settingsList: string[]): ParsedTableGroupSettings {
  const result: ParsedTableGroupSettings = { color: null };

  for (const rawSetting of settingsList) {
    const setting: string = rawSetting.trim();
    const lower: string = setting.toLowerCase();

    if (lower.startsWith("color:")) {
      result.color = unquote(setting.slice("color:".length));
    }
  }

  return result;
}

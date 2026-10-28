"use client";

import { useMemo, useRef } from "react";
import type { ChangeEvent, UIEvent } from "react";
import { tokenizeDbml } from "./lib/highlight/tokenizeDbml";
import type { DbmlToken, DbmlTokenType } from "./lib/highlight/tokenizeDbml";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  errorLine: number | null;
  className?: string;
}

const FONT_SIZE_PX: number = 13;
const LINE_HEIGHT_PX: number = 20;
const PADDING_PX: number = 16;

const TOKEN_CLASSES: Record<DbmlTokenType, string> = {
  comment: "text-zinc-500 dark:text-zinc-500 italic",
  string: "text-emerald-600 dark:text-emerald-400",
  keyword: "text-indigo-600 dark:text-indigo-400 font-semibold",
  attribute: "text-amber-600 dark:text-amber-400",
  type: "text-sky-600 dark:text-sky-400",
  name: "text-fuchsia-600 dark:text-fuchsia-400 font-semibold",
  number: "text-orange-600 dark:text-orange-400",
  punctuation: "text-zinc-500 dark:text-zinc-400",
  plain: "text-zinc-900 dark:text-zinc-100",
};

const SHARED_TEXT_STYLE: React.CSSProperties = {
  fontSize: FONT_SIZE_PX,
  lineHeight: `${LINE_HEIGHT_PX}px`,
  padding: PADDING_PX,
  tabSize: 2,
};

/**
 * Editor con resaltado de sintaxis hecho a mano: un `<pre>` con los tokens
 * coloreados queda debajo de un `<textarea>` cuyo texto es transparente
 * (solo se ve su cursor). Ambos comparten fuente/tamaño/padding exactos y
 * se desplazan en sincronía, para que el color "siga" al texto real sin
 * depender de un editor de código de terceros.
 */
export function CodeEditor({ value, onChange, errorLine, className }: CodeEditorProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const tokens: DbmlToken[] = useMemo(() => tokenizeDbml(value), [value]);

  function syncScroll(event: UIEvent<HTMLTextAreaElement>): void {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onChange(event.target.value);
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <pre
        ref={highlightRef}
        aria-hidden="true"
        style={SHARED_TEXT_STYLE}
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono"
      >
        {errorLine !== null && (
          <div
            className="absolute left-0 right-0 bg-red-500/15"
            style={{ top: PADDING_PX + (errorLine - 1) * LINE_HEIGHT_PX, height: LINE_HEIGHT_PX }}
          />
        )}
        {tokens.map((token, index) => (
          <span key={index} className={TOKEN_CLASSES[token.type]}>
            {token.text}
          </span>
        ))}
        {/* Línea final en blanco para que el textarea pueda desplazarse hasta el último renglón vacío. */}
        {"\n"}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={syncScroll}
        spellCheck={false}
        aria-label="Código DBML"
        style={SHARED_TEXT_STYLE}
        className="relative h-full w-full resize-none overflow-auto whitespace-pre-wrap break-words bg-transparent font-mono text-transparent caret-zinc-900 outline-none dark:caret-zinc-100"
      />
    </div>
  );
}

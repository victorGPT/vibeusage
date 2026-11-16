import * as React from "react"
import { Button } from "@ui-sdk/react/button"
import { notify } from "#src/ui/hardware/toaster.tsx"
import { haptic } from "#src/ui/hardware/lib/haptics.ts"
import { Display } from "#src/ui/hardware/display.tsx"

type Language = "ts" | "tsx" | "js" | "css" | "sh" | "text"

// Just enough highlighting for a screen: keywords, strings, numbers and
// comments. One pass of one regex per language, so it stays tiny.
const patterns: Record<Exclude<Language, "text">, RegExp> = {
  ts: /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`)|\b(import|from|export|const|let|var|function|return|if|else|for|while|await|async|new|type|interface|extends|class|default|as|of|in|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/gm,
  tsx: /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`)|\b(import|from|export|const|let|var|function|return|if|else|for|while|await|async|new|type|interface|extends|class|default|as|of|in|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/gm,
  js: /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`)|\b(import|from|export|const|let|var|function|return|if|else|for|while|await|async|new|class|default|of|in|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/gm,
  css: /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*')|(@[\w-]+|--[\w-]+)|\b(\d+(?:\.\d+)?(?:px|em|rem|%|deg|ms|s)?)\b/gm,
  sh: /(#.*$)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*')|^\s*(\$|pnpm|npm|npx|git|cd|node)\b|(\B--?[\w-]+)/gm,
}
const kinds = ["comment", "string", "keyword", "number"] as const
const names: Record<Language, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  css: "CSS",
  sh: "Shell",
  text: "",
}

function highlight(line: string, language: Language) {
  if (language === "text") return [line]
  const pattern = new RegExp(patterns[language].source, "gm")
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(pattern)) {
    const index = match.index!
    if (index > last) parts.push(line.slice(last, index))
    const kind = kinds[match.slice(1).findIndex((group) => group !== undefined)]
    parts.push(
      <span key={index} data-token={kind}>
        {match[0]}
      </span>,
    )
    last = index + match[0].length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

// Types the lines out a character at a time, the way a console prints.
function useTyping(lines: string[], enabled: boolean) {
  const [typed, setTyped] = React.useState({ line: 0, chars: 0 })
  const key = lines.join("\n")
  React.useEffect(() => {
    const instant = !enabled || matchMedia("(prefers-reduced-motion: reduce)").matches
    setTyped(instant ? { line: lines.length, chars: 0 } : { line: 0, chars: 0 })
  }, [key, enabled])
  React.useEffect(() => {
    const { line, chars } = typed
    if (line >= lines.length) return
    const done = chars >= lines[line].length
    const id = setTimeout(
      () => setTyped(done ? { line: line + 1, chars: 0 } : { line, chars: chars + 1 }),
      done ? 320 : 18 + Math.random() * 26,
    )
    return () => clearTimeout(id)
  }, [typed, key])
  return typed
}

// Code on a screen: numbered lines, light highlighting, a copy key, and if
// asked, the lines typed out with a cursor riding the end.
function CodeBlock({
  code,
  language = "text",
  typing = false,
  label,
  errors,
}: {
  code: string
  language?: Language
  typing?: boolean
  label?: string
  errors?: RegExp
}) {
  const lines = code.replace(/\n$/, "").split("\n")
  const typed = useTyping(lines, typing)
  const [copied, setCopied] = React.useState(false)
  const finished = typed.line >= lines.length

  // The toast shows the moment the key is pressed: the clipboard write can
  // take a while to settle, and waiting on it made the toast lag. If the
  // write fails, an error toast follows.
  const copy = () => {
    notify("Copied", { description: `${lines.length} lines of ${names[language] || "code"}` })
    haptic("success")
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
    navigator.clipboard.writeText(code).catch(() => {
      setCopied(false)
      haptic("error")
      notify("Couldn't copy", { description: "The clipboard wasn't available." })
    })
  }

  return (
    <div data-kit="code-block">
      {(label ?? names[language]) && <span data-kit="code-label">{label ?? names[language]}</span>}
      <div data-kit="code-body">
        <Display aspect="auto">
          <div data-kit="code" data-language={language}>
            {/* Every line is laid out from the start, so typing never changes the height. */}
            <ol aria-live={typing ? "polite" : undefined}>
              {lines.map((line, i) => {
                const current = i === typed.line
                const pending = i > typed.line
                const text = current ? line.slice(0, typed.chars) : line
                return (
                  <li
                    key={i}
                    data-error={errors?.test(line) || undefined}
                    data-pending={pending || undefined}
                    aria-hidden={pending || undefined}
                  >
                    <span data-kit="code-number" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <code>{highlight(text, language)}</code>
                    {current && <span data-kit="code-cursor" aria-hidden />}
                  </li>
                )
              })}
              {typing && (
                <li data-pending={!finished || undefined}>
                  <span data-kit="code-number" aria-hidden>
                    {String(lines.length + 1).padStart(2, "0")}
                  </span>
                  {finished && <span data-kit="code-cursor" data-idle aria-hidden />}
                </li>
              )}
            </ol>
          </div>
        </Display>
        {/* A side key on the bezel, a UI SDK button. It stays pushed in for a moment once the code is copied. */}
        <Button data-kit="code-copy" data-copied={copied || undefined} onClick={() => copy()} aria-label={copied ? "Copied" : "Copy code"} />
      </div>
    </div>
  )
}

export { CodeBlock, type Language }

// Rollup-Plugin: verkleinert die statischen Teile von Lit-Templates (html``, svg``, css``).
// Nutzt den TypeScript-Parser, damit verschachtelte Templates und ${…}-Ausdrücke sicher erhalten bleiben.
import ts from "typescript";

const minifyHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
const minifyCss = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .replace(/:\s+/g, ":")
    .replace(/;}/g, "}");

export default function minifyLiterals() {
  return {
    name: "minify-lit-literals",
    transform(code, id) {
      if (!id.endsWith(".ts") || id.includes("node_modules")) return null;
      const sf = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const edits = [];
      const visit = (node) => {
        if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && ["html", "svg", "css"].includes(node.tag.text)) {
          const fn = node.tag.text === "css" ? minifyCss : minifyHtml;
          const t = node.template;
          const push = (start, end) => edits.push({ start, end, text: fn(code.slice(start, end)) });
          if (ts.isNoSubstitutionTemplateLiteral(t)) push(t.getStart(sf) + 1, t.end - 1);
          else {
            push(t.head.getStart(sf) + 1, t.head.end - 2);
            for (const span of t.templateSpans) {
              const lit = span.literal;
              push(lit.getStart(sf) + 1, lit.end - (ts.isTemplateTail(lit) ? 1 : 2));
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      if (!edits.length) return null;
      edits.sort((a, b) => b.start - a.start);
      let out = code;
      for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
      return { code: out, map: null };
    },
  };
}

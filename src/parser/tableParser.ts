import type { TableBlock } from "../types/content";
import type { ParserContext } from "./types";
import { parseInlineChildren } from "./inlineParser";

export function parseTable(table: Element, context: ParserContext): TableBlock {
  const rowElements = Array.from(table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr"));
  const rows = rowElements.map((row) => ({
    cells: Array.from(row.children)
      .filter((cell) => cell.matches("th,td"))
      .map((cell) => ({
        header: cell.tagName.toLowerCase() === "th",
        colspan: Number(cell.getAttribute("colspan") ?? 1) || 1,
        rowspan: Number(cell.getAttribute("rowspan") ?? 1) || 1,
        children: parseInlineChildren(cell, context)
      }))
  }));
  const columnCount = rows.reduce((max, row) => Math.max(max, row.cells.reduce((sum, cell) => sum + cell.colspan, 0)), 0);
  return { type: "table", rows, columnCount };
}

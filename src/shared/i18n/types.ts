/** Russian source text → [Ukrainian, English]. Missing entries fall back to the Russian text. */
export type Dict = Record<string, [uk: string, en: string]>

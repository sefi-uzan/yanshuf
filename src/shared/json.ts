export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function tryParseJson(content: string): JsonValue | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return null;
  }
}

export function formatJson(content: string): string | null {
  const parsed = tryParseJson(content);
  if (parsed === null) return null;
  return JSON.stringify(parsed, null, 2);
}

export function isCollapsibleJson(value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object';
}

export function collectCollapsiblePaths(value: JsonValue, path = '$'): string[] {
  if (!isCollapsibleJson(value)) return [];

  const paths = [path];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectCollapsiblePaths(item, `${path}[${index}]`));
    });
    return paths;
  }

  for (const key of Object.keys(value)) {
    paths.push(...collectCollapsiblePaths(value[key], `${path}.${key}`));
  }
  return paths;
}

export function collapsibleChildCount(value: JsonValue[] | Record<string, JsonValue>): number {
  return Array.isArray(value) ? value.length : Object.keys(value).length;
}

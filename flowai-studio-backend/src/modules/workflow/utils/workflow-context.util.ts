/** 读取工作流上下文路径，支持 `nodeId.field` 和 `{{nodeId.field}}`。 */
export function resolveContextValue(
  reference: string,
  context: Record<string, any>,
): any {
  if (!reference) return undefined;

  const path = reference.replace(/^\{\{|\}\}$/g, "").trim();
  if (!path) return undefined;

  let value: any = context;
  for (const key of path.split(".")) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

/** 将字符串中的工作流变量替换为对应上下文值，其他类型原样返回。 */
export function resolveTemplate<T>(
  template: T,
  context: Record<string, any>,
): T | string {
  if (typeof template !== "string") return template;

  return template.replace(/\{\{(.+?)\}\}/g, (match, path) => {
    const value = resolveContextValue(path, context);
    if (value === undefined) return match;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

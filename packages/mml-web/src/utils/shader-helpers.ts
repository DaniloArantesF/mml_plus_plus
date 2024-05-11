export function injectBeforeMain(shaderSource: string, codeToInject: string): string {
  return shaderSource.replace(
    "void main() {",
    `

${codeToInject}

void main() {`,
  );
}

export function injectInsideMain(shaderSource: string, codeToInject: string): string {
  return shaderSource.replace(
    "void main() {",
    `void main() {

${codeToInject}

    `,
  );
}

export function injectBefore(shaderSource: string, before: string, codeToInject: string): string {
  return shaderSource.replace(
    before,
    `
${codeToInject}

${before}
    `,
  );
}

export function injectAfter(shaderSource: string, after: string, codeToInject: string): string {
  return shaderSource.replace(
    after,
    `
${after}

${codeToInject}

    `,
  );
}

export function injectTop(shaderSource: string, codeToInject: string): string {
  return `
${codeToInject}

${shaderSource}
  `;
}

export const regexBeforeMain = /([\s\S]*?)(?=void\s+main\s*\(\s*(void)?\s*\)\s*\{)/;

export const regexInsideMain = /void\s+main\s*\(\s*(void)?\s*\)\s*\{([\s\S]*?)\}/;

// Migrations Drizzle : fichiers .sql embarqués comme chaînes (babel-plugin-inline-import).
declare module '*.sql' {
  const content: string;
  export default content;
}

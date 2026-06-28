declare module "bun" {
  interface Env {
    DATABASE_URL?: string;
  }
}

declare module "*.css";

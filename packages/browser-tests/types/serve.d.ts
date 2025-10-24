declare module "serve" {
  import type { Server } from "http";

  function serve(
    folder: string,
    options: { port: number; single: boolean; listen: boolean },
  ): Promise<Server>;
  export default serve;
}

declare module "serve" {
  function serve(
    folder: string,
    options: { port: number; single: boolean; listen: boolean },
  ): any;
  export default serve;
}

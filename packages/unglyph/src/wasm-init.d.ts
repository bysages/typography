declare module "*.wasm?init" {
  const initWasm: (imports?: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
  export default initWasm;
}

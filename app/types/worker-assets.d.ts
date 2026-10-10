// These imports are bundled by Wrangler's Data and CompiledWasm rules.
declare module '~/assets/NotoSansJP-Medium.ttf' {
  const font: ArrayBuffer;
  export default font;
}

declare module '@resvg/resvg-wasm/index_bg.wasm' {
  const wasm: WebAssembly.Module;
  export default wasm;
}

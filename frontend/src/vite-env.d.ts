/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

declare module '*.ttf?url' {
  const src: string;
  export default src;
}

// hls.js ships no typings for its "light" build (same API, without subtitles / alt audio / DRM)
declare module 'hls.js/light' {
  export { default } from 'hls.js';
  export * from 'hls.js';
}

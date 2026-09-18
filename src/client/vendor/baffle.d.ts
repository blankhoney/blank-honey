declare module 'baffle' {
  export type Baffle = {
    start(): Baffle;
    stop(): Baffle;
    text(replace: (original: string) => string): Baffle;
  };
  export default function baffle(
    elements: HTMLElement | HTMLElement[],
    options: { characters: string; speed: number },
  ): Baffle;
}

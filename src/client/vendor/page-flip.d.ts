/** Application-facing subset of StPageFlip 2.0.7; implementation and local patches are adjacent. */
export class PageFlip {
  constructor(
    host: HTMLElement,
    options: {
      width: number;
      height: number;
      size: 'fixed';
      usePortrait: boolean;
      useMouseEvents: boolean;
      autoSize: boolean;
      showCover: boolean;
      showPageCorners: boolean;
      disableFlipByClick: boolean;
      drawShadow: boolean;
      maxShadowOpacity: number;
      flippingTime: number;
    },
  );
  on(name: 'init' | 'changeState', callback: (event: { data: unknown }) => void): this;
  loadFromHTML(pages: HTMLElement[]): void;
  flipNext(corner?: 'top' | 'bottom'): void;
  destroy(): void;
}

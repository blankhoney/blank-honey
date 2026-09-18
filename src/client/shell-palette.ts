type Palette = Pick<CSSStyleDeclaration, 'color' | 'backgroundColor' | 'borderColor'>;
export type ShellPalette = { element: HTMLElement; pseudo?: string; palette: Palette }[];

function colors(element: HTMLElement, pseudo?: string): Palette {
  const style = getComputedStyle(element, pseudo);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
  };
}

/** Astro detaches persisted nodes, so CSS transitions alone lose their old computed colors. */
export function captureShellPalette(shell: HTMLElement): ShellPalette {
  const elements = [
    shell,
    ...shell.querySelectorAll<HTMLElement>(
      '#navigation, #shell-search, a, button, input, select, label, legend, small, span, p, .nav-top, .settings, .about',
    ),
  ];
  const snapshots: ShellPalette = elements.map((element) => ({
    element,
    palette: colors(element),
  }));
  const navigation = shell.querySelector<HTMLElement>('#navigation');
  if (navigation)
    snapshots.push({
      element: navigation,
      pseudo: '::before',
      palette: colors(navigation, '::before'),
    });
  return snapshots;
}

export function animateShellPalette(snapshots: ShellPalette, duration: number) {
  const animations = new Set<Animation>();
  const dispose = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
  };
  try {
    // Measure all destination styles before applying any animation to their ancestors.
    const targets = snapshots.map(({ element, pseudo }) => colors(element, pseudo));
    snapshots.forEach(({ element, pseudo, palette }, index) => {
      if (!element.isConnected || duration <= 0) return;
      const target = targets[index];
      if (
        Object.keys(palette).every(
          (key) => palette[key as keyof Palette] === target[key as keyof Palette],
        )
      )
        return;
      const animation = element.animate([palette, target], {
        duration,
        easing: 'ease-in-out',
        fill: 'both',
        pseudoElement: pseudo,
      });
      animations.add(animation);
      void animation.finished.then(
        () => {
          animations.delete(animation);
          animation.cancel();
        },
        () => {},
      );
    });
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}

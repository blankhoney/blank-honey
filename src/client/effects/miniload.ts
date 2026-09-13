import type { HeroContext } from '../hero';

export default async function ({ host, stage, signal, reduced, light }: HeroContext) {
  const { ShaderMount, ditheringFragmentShader, DitheringShapes, DitheringTypes } =
    await import('@paper-design/shaders');
  if (signal.aborted) return;
  // Paper's reusable Bayer/noise shader replaces the reference's redistribution-restricted component.
  const shader = new ShaderMount(
    stage,
    ditheringFragmentShader,
    {
      u_colorBack: [0, 0, 0, 1],
      u_colorFront: [0.42, 0.42, 0.42, 1],
      u_shape: DitheringShapes.simplex,
      u_type: DitheringTypes['8x8'],
      u_pxSize: 2,
      u_fit: 2,
      u_scale: 0.45,
      u_rotation: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_offsetX: 0,
      u_offsetY: 0,
      u_worldWidth: 0,
      u_worldHeight: 0,
    },
    undefined,
    reduced ? 0 : 0.14,
    0,
    1,
    light ? 500_000 : 1_800_000,
  );
  // Darken only the cloud beneath the pointer, leaving the foreground text untouched.
  const shadow = document.createElement('div');
  shadow.className = 'pixel-cloud-shadow';
  stage.append(shadow);
  function hideShadow() {
    shadow.classList.remove('visible');
  }
  host.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      const bounds = stage.getBoundingClientRect();
      shadow.style.transform = `translate3d(${event.clientX - bounds.left}px, ${event.clientY - bounds.top}px, 0) translate(-50%, -50%)`;
      shadow.classList.add('visible');
    },
    { signal },
  );
  host.addEventListener('pointerleave', hideShadow, { signal });
  window.addEventListener('blur', hideShadow, { signal });
  signal.addEventListener(
    'abort',
    () => {
      shadow.remove();
      shader.dispose();
    },
    { once: true },
  );
}

<!--
  Inline SVG that defines the displacement filter referenced by
  `--glass-distort` in app.css. Drop ONCE in the root layout; every
  element with `.glass-refract` references it by id.

  Tunable knobs:
    baseFrequency  — lower = larger ripple wavelength. 0.008 is gentle
                     enough for hero panels without making cards look
                     like flowing water.
    numOctaves     — adds finer noise. 2 is plenty; higher tanks GPU.
    seed           — different seeds produce visually distinct ripples
                     if we ever want per-section variation.
    scale          — distortion strength in px. 30 reads as "thick
                     glass" on a card without the dramatic ripple that
                     made Chromium's render look out of step with the
                     no-distortion fallback elsewhere; drop further for
                     buttons.
-->
<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
	<!-- Full-strength refraction for hero panels + dialogs + the floating chrome. -->
	<filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="2" seed="92" />
		<feDisplacementMap in="SourceGraphic" scale="30" xChannelSelector="R" yChannelSelector="G" />
	</filter>
	<!-- Subtle variant for content-dense surfaces (ticket rows, message
	     bubbles, anything where heavy ripple would make text shimmer).
	     Higher baseFrequency = tighter noise pattern; lower scale = less
	     displacement. Reads as "softly defocused" rather than "rippling
	     glass." -->
	<filter id="glass-distortion-subtle" x="0%" y="0%" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.02 0.02" numOctaves="1" seed="44" />
		<feDisplacementMap in="SourceGraphic" scale="14" xChannelSelector="R" yChannelSelector="G" />
	</filter>
</svg>

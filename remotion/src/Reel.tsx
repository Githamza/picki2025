import React from 'react';
import {z} from 'zod';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Inter';

const {fontFamily} = loadFont('normal', {
  weights: ['400', '700'],
  subsets: ['latin'],
});

export const ReelSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});

type ReelProps = z.infer<typeof ReelSchema>;

export const Reel: React.FC<ReelProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // Title entrance (spring)
  const titleScale = spring({
    frame,
    fps,
    config: {damping: 200},
  });

  const titleY = interpolate(titleScale, [0, 1], [40, 0]);

  // Subtitle entrance (delayed)
  const subtitleOpacity = interpolate(
    frame,
    [0.5 * fps, 1.2 * fps],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const subtitleY = interpolate(
    frame,
    [0.5 * fps, 1.2 * fps],
    [20, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  // Fade out at the end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FFD700 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            transform: `translateY(${titleY}px) scale(${titleScale})`,
            textShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

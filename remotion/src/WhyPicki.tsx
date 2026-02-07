import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { loadFont } from "@remotion/google-fonts/Poppins";

const { fontFamily } = loadFont("normal", {
  weights: ["600", "800", "900"],
  subsets: ["latin"],
});

// ─── Scene: Hook ────────────────────────────────────────────

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "30%" slams in first
  const percentPop = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 180 },
  });
  const percentScale = interpolate(percentPop, [0, 1], [3, 1]);
  const percentRotate = interpolate(percentPop, [0, 1], [12, -3]);

  // Strikethrough animates across the 30%
  const strikeWidth = interpolate(frame, [0.4 * fps, 0.7 * fps], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle appears after
  const subtitleIn = spring({
    frame,
    fps,
    delay: 12,
    config: { damping: 200 },
  });
  const subtitleY = interpolate(subtitleIn, [0, 1], [50, 0]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #0f0f0f 0%, #1a1a2e 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Top line */}
      <div
        style={{
          position: "absolute",
          top: 580,
          fontSize: 42,
          fontWeight: 600,
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          opacity: subtitleIn,
        }}
      >
        Vous donnez encore
      </div>

      {/* Big 30% with strikethrough */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 200,
            fontWeight: 900,
            color: "#FF4444",
            textAlign: "center",
            transform: `scale(${percentScale}) rotate(${percentRotate}deg)`,
            textShadow: "0 0 60px rgba(255,68,68,0.5)",
          }}
        >
          30%
        </div>
        {/* Strikethrough line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "-10%",
            width: `${strikeWidth}%`,
            height: 12,
            background: "white",
            borderRadius: 6,
            transform: "rotate(-8deg)",
          }}
        />
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          bottom: 640,
          fontSize: 38,
          fontWeight: 800,
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          padding: "0 70px",
          transform: `translateY(${subtitleY}px)`,
          opacity: subtitleIn,
          lineHeight: 1.4,
        }}
      >
        de commission à UEat ?
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: Reason Card ─────────────────────────────────────

type ReasonProps = {
  number: string;
  headline: string;
  detail: string;
  accentColor: string;
  bg: string;
};

const ReasonCard: React.FC<ReasonProps> = ({
  number,
  headline,
  detail,
  accentColor,
  bg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Number flies in from left
  const numSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180 },
  });
  const numX = interpolate(numSpring, [0, 1], [-400, 0]);
  const numScale = interpolate(numSpring, [0, 1], [0.5, 1]);

  // Headline slams in
  const headSpring = spring({
    frame,
    fps,
    delay: 4,
    config: { damping: 15, stiffness: 200 },
  });
  const headY = interpolate(headSpring, [0, 1], [80, 0]);

  // Detail fades up
  const detailSpring = spring({
    frame,
    fps,
    delay: 10,
    config: { damping: 200 },
  });
  const detailY = interpolate(detailSpring, [0, 1], [40, 0]);

  // Accent bar
  const barWidth = interpolate(
    spring({ frame, fps, delay: 6, config: { damping: 200 } }),
    [0, 1],
    [0, 260]
  );

  return (
    <AbsoluteFill
      style={{
        background: bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Big ghost number */}
      <div
        style={{
          position: "absolute",
          top: 480,
          fontSize: 280,
          fontWeight: 900,
          color: accentColor,
          opacity: 0.15,
          transform: `translateX(${numX}px) scale(${numScale})`,
        }}
      >
        {number}
      </div>

      {/* Content block */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          padding: "0 60px",
          zIndex: 1,
        }}
      >
        {/* Number badge */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#0f0f0f",
            background: accentColor,
            width: 64,
            height: 64,
            borderRadius: 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${numScale})`,
            boxShadow: `0 8px 30px ${accentColor}66`,
          }}
        >
          {number}
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            lineHeight: 1.15,
            transform: `translateY(${headY}px)`,
            opacity: headSpring,
          }}
        >
          {headline}
        </div>

        {/* Accent bar */}
        <div
          style={{
            height: 5,
            width: barWidth,
            background: accentColor,
            borderRadius: 3,
          }}
        />

        {/* Detail */}
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.75)",
            textAlign: "center",
            lineHeight: 1.4,
            transform: `translateY(${detailY}px)`,
            opacity: detailSpring,
            padding: "0 20px",
          }}
        >
          {detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: CTA ─────────────────────────────────────────────

const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 160 } });
  const scale = interpolate(pop, [0, 1], [0, 1]);

  const btnSpring = spring({ frame, fps, delay: 8, config: { damping: 200 } });
  const btnY = interpolate(btnSpring, [0, 1], [50, 0]);

  const urlSpring = spring({ frame, fps, delay: 16, config: { damping: 200 } });
  const urlY = interpolate(urlSpring, [0, 1], [30, 0]);

  // Pulsing glow
  const pulse = interpolate(frame, [0, 30, 60], [1, 1.06, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(160deg, #FF6B35 0%, #F7931E 40%, #FFD700 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          transform: `scale(${scale * pulse})`,
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            textShadow: "0 4px 20px rgba(0,0,0,0.2)",
            lineHeight: 1.15,
            padding: "0 40px",
          }}
        >
          Rejoignez Piki
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            opacity: btnSpring,
          }}
        >
          Créez votre boutique en 1 min
        </div>
        <div
          style={{
            background: "white",
            color: "#FF6B35",
            fontSize: 32,
            fontWeight: 800,
            padding: "20px 50px",
            borderRadius: 50,
            transform: `translateY(${btnY}px)`,
            opacity: btnSpring,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          }}
        >
          Commencer gratuitement
        </div>
        {/* Website URL */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            letterSpacing: 3,
            opacity: urlSpring,
            transform: `translateY(${urlY}px)`,
          }}
        >
          piki-app.fr
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ───────────────────────────────────────

const TRANSITION_DURATION = 10; // frames

export const WhyPicki: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <TransitionSeries>
        {/* Hook: "Vous donnez encore 30% ?" - 2s */}
        <TransitionSeries.Sequence durationInFrames={60}>
          <Hook />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Raison 1 */}
        <TransitionSeries.Sequence durationInFrames={70}>
          <ReasonCard
            number="1"
            headline="0% de commission"
            detail="Gardez 100% de vos ventes, zéro frais cachés"
            accentColor="#00D4AA"
            bg="linear-gradient(160deg, #0f0f0f 0%, #1a1a2e 100%)"
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Raison 2 */}
        <TransitionSeries.Sequence durationInFrames={70}>
          <ReasonCard
            number="2"
            headline="Prêt en 1 minute"
            detail="Importez votre menu Uber Eats et c'est parti"
            accentColor="#FF6B35"
            bg="linear-gradient(160deg, #0a0a1a 0%, #162447 100%)"
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Raison 3 */}
        <TransitionSeries.Sequence durationInFrames={70}>
          <ReasonCard
            number="3"
            headline="Votre marque, votre vitrine"
            detail="Votre propre boutique en ligne, clé en main"
            accentColor="#A78BFA"
            bg="linear-gradient(160deg, #1a0a2e 0%, #16213e 100%)"
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* CTA */}
        <TransitionSeries.Sequence durationInFrames={70}>
          <CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

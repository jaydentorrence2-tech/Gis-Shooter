/**
 * Shared Precision Crosshair & Hitmarker Reticle Renderer
 * Used 1:1 across both the In-Game HUD and the Crosshair Editor Live Preview Box.
 */

import React from 'react';
import { CrosshairConfig } from '../game/GameEngine';

interface CrosshairReticleProps {
  config: CrosshairConfig;
  spread?: number;
  isAiming?: boolean;
  hitmarkerActive?: boolean;
  hitmarkerHeadshot?: boolean;
}

export const CrosshairReticle: React.FC<CrosshairReticleProps> = ({
  config,
  spread = 0.1,
  isAiming = false,
  hitmarkerActive = false,
  hitmarkerHeadshot = false,
}) => {
  const cx = 64;
  const cy = 64;

  // Dynamic expansion/contraction in pixels based on movement, crouch & recoil
  const dynamicDelta = config.dynamic ? (spread - 0.1) * 46 : 0;
  const aimCompression = isAiming ? -Math.min(config.gap * 0.45, 3) : 0;
  const effectiveGap = Math.max(1, config.gap + dynamicDelta + aimCompression);

  const showLines = config.style === 'classic' || config.style === 'cross_dot';
  const showDot = config.style === 'dot' || config.style === 'cross_dot';
  const showCircle = config.style === 'circle';

  const activeColor = hitmarkerActive
    ? hitmarkerHeadshot
      ? '#EF4444'
      : '#F87171'
    : config.color;

  const circleRadius = Math.max(6, effectiveGap + config.length * 0.72);
  const halfHit = hitmarkerHeadshot ? 12 : 9;
  const innerHit = hitmarkerHeadshot ? 5 : 4;

  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 128 128"
      className="pointer-events-none overflow-visible"
      style={{ opacity: config.opacity }}
    >
      {/* 1. Black Outline Underlay Pass (for bright surface legibility) */}
      {config.outline && (
        <g stroke="rgba(2, 6, 23, 0.92)" fill="rgba(2, 6, 23, 0.92)" strokeLinecap="square">
          {showLines && (
            <g strokeWidth={config.thickness + 2}>
              <line x1={cx} y1={cy - effectiveGap - config.length} x2={cx} y2={cy - effectiveGap} />
              <line x1={cx} y1={cy + effectiveGap} x2={cx} y2={cy + effectiveGap + config.length} />
              <line x1={cx - effectiveGap - config.length} y1={cy} x2={cx - effectiveGap} y2={cy} />
              <line x1={cx + effectiveGap} y1={cy} x2={cx + effectiveGap + config.length} y2={cy} />
            </g>
          )}
          {showCircle && (
            <circle
              cx={cx}
              cy={cy}
              r={circleRadius}
              fill="none"
              strokeWidth={config.thickness + 2}
            />
          )}
          {showDot && <circle cx={cx} cy={cy} r={config.dotSize * 0.5 + 1} stroke="none" />}
        </g>
      )}

      {/* 2. Primary Colored Reticle Pass */}
      <g stroke={activeColor} fill={activeColor} strokeLinecap="square">
        {showLines && (
          <g strokeWidth={config.thickness}>
            <line x1={cx} y1={cy - effectiveGap - config.length} x2={cx} y2={cy - effectiveGap} />
            <line x1={cx} y1={cy + effectiveGap} x2={cx} y2={cy + effectiveGap + config.length} />
            <line x1={cx - effectiveGap - config.length} y1={cy} x2={cx - effectiveGap} y2={cy} />
            <line x1={cx + effectiveGap} y1={cy} x2={cx + effectiveGap + config.length} y2={cy} />
          </g>
        )}
        {showCircle && (
          <circle
            cx={cx}
            cy={cy}
            r={circleRadius}
            fill="none"
            strokeWidth={config.thickness}
          />
        )}
        {showDot && <circle cx={cx} cy={cy} r={config.dotSize * 0.5} stroke="none" />}
      </g>

      {/* 3. Animated Hitmarker Confirmation X (White bodyshot / Crimson Headshot) */}
      {hitmarkerActive && (
        <g
          stroke={hitmarkerHeadshot ? '#EF4444' : '#FFFFFF'}
          strokeWidth={hitmarkerHeadshot ? 2.8 : 2.2}
          strokeLinecap="round"
        >
          <line x1={cx - halfHit} y1={cy - halfHit} x2={cx - innerHit} y2={cy - innerHit} />
          <line x1={cx + halfHit} y1={cy - halfHit} x2={cx + innerHit} y2={cy - innerHit} />
          <line x1={cx - halfHit} y1={cy + halfHit} x2={cx - innerHit} y2={cy + innerHit} />
          <line x1={cx + halfHit} y1={cy + halfHit} x2={cx + innerHit} y2={cy + innerHit} />
        </g>
      )}
    </svg>
  );
};

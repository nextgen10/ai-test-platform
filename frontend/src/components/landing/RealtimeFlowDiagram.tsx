'use client';

import React from 'react';
import { Box, alpha, useTheme } from '@mui/material';

const AMBER = '#af8626';
const GREEN = '#469a6c';
const RED = '#e60000';
const BLUE = '#00759e';

export default function RealtimeFlowDiagram() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const cardBg = isLight ? '#f9f9f7' : '#1c1c1c';
  const cardBorder = isLight ? '#e0dfd7' : '#404040';
  const textColor = isLight ? '#1c1c1c' : '#f9f9f7';
  const mutedColor = isLight ? '#8e8d83' : '#b8b3a2';

  return (
    <Box sx={{ width: '100%' }}>
        {/* The Animated SVG Flow Diagram - Wide 1440 x 550 Canvas */}
        <Box
          component="svg"
          viewBox="0 0 1440 550"
          sx={{
            width: '100%',
            height: 'auto',
            display: 'block',
            '& text': { userSelect: 'none' },
          }}
        >
          <defs>
            {/* Real-time flowing dash animation */}
            <style>
              {`
                @keyframes flowStream {
                  from { stroke-dashoffset: 48; }
                  to { stroke-dashoffset: 0; }
                }
                .flow-line {
                  stroke-dasharray: 8 6;
                  animation: flowStream 1.3s linear infinite;
                }
                .loop-line {
                  stroke-dasharray: 6 5;
                  animation: flowStream 1.8s linear infinite;
                }
              `}
            </style>

            {/* Marker Arrows */}
            <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill={RED} />
            </marker>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill={GREEN} />
            </marker>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill={AMBER} />
            </marker>
            <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill={BLUE} />
            </marker>
          </defs>

          {/* ================= BACKGROUND FLOW CONNECTORS ================= */}

          {/* Path 1: Input (200, 108) -> Analyst (310, 108) [110px Gap] */}
          <path d="M 200 108 L 310 108" fill="none" stroke={AMBER} strokeWidth="2.5" className="flow-line" markerEnd="url(#arrow-amber)" />
          <circle r="4.5" fill={AMBER}>
            <animateMotion path="M 200 108 L 310 108" dur="1s" repeatCount="indefinite" />
          </circle>

          {/* Path 2: Analyst (510, 108) -> Approval Gate (620, 108) [110px Gap] */}
          <path d="M 510 108 L 620 108" fill="none" stroke={GREEN} strokeWidth="2.5" className="flow-line" markerEnd="url(#arrow-green)" />
          <circle r="4.5" fill={GREEN}>
            <animateMotion path="M 510 108 L 620 108" dur="1s" repeatCount="indefinite" />
          </circle>

          {/* Path 2b: Approval Gate REJECT branch (UPWARDS to avoid overlap) */}
          <path d="M 720 70 L 720 46" fill="none" stroke="#da0000" strokeWidth="2.2" strokeDasharray="4 4" markerEnd="url(#arrow-red)" />
          <circle r="4" fill="#da0000">
            <animateMotion path="M 720 70 L 720 46" dur="1.2s" repeatCount="indefinite" />
          </circle>

          {/* Path 3: Approval Gate Approved (820, 108) -> Test Designer (930, 108) [110px Gap] */}
          <path d="M 820 108 L 930 108" fill="none" stroke={RED} strokeWidth="2.5" className="flow-line" markerEnd="url(#arrow-red)" />
          <circle r="4.5" fill={RED}>
            <animateMotion path="M 820 108 L 930 108" dur="1s" repeatCount="indefinite" />
          </circle>

          {/* Curve Row 1 -> Row 2: Test Designer (1130, 108) to Test Generator (1130, 268) */}
          <path
            d="M 1130 108 L 1230 108 Q 1270 108 1270 148 L 1270 228 Q 1270 268 1230 268 L 1130 268"
            fill="none"
            stroke={RED}
            strokeWidth="2.5"
            className="flow-line"
            markerEnd="url(#arrow-red)"
          />
          <circle r="4.5" fill={RED}>
            <animateMotion path="M 1130 108 L 1230 108 Q 1270 108 1270 148 L 1270 228 Q 1270 268 1230 268 L 1130 268" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Path 5: Test Generator (930, 268) -> Test Reviewer (820, 268) [110px Leftward stream] */}
          <path d="M 930 268 L 820 268" fill="none" stroke={RED} strokeWidth="2.5" className="flow-line" markerEnd="url(#arrow-red)" />
          <circle r="4.5" fill={RED}>
            <animateMotion path="M 930 268 L 820 268" dur="1s" repeatCount="indefinite" />
          </circle>

          {/* Retry Loop (Reviewer to Generator along top of Row 2) */}
          <path
            d="M 720 230 Q 720 178 875 178 Q 1030 178 1030 230"
            fill="none"
            stroke={AMBER}
            strokeWidth="2"
            className="loop-line"
            markerEnd="url(#arrow-amber)"
          />
          <circle r="3.5" fill={AMBER}>
            <animateMotion path="M 720 230 Q 720 178 875 178 Q 1030 178 1030 230" dur="1.8s" repeatCount="indefinite" />
          </circle>

          {/* Path 6: Test Reviewer (620, 268) -> Test Evaluator (510, 268) [110px Leftward stream] */}
          <path d="M 620 268 L 510 268" fill="none" stroke={BLUE} strokeWidth="2.5" className="flow-line" markerEnd="url(#arrow-blue)" />
          <circle r="4.5" fill={BLUE}>
            <animateMotion path="M 620 268 L 510 268" dur="1s" repeatCount="indefinite" />
          </circle>

          {/* Curve Row 2 -> Row 3: Test Evaluator (310, 268) to Validated Test Suite (310, 428) */}
          <path
            d="M 310 268 L 210 268 Q 170 268 170 308 L 170 388 Q 170 428 210 428 L 310 428"
            fill="none"
            stroke={GREEN}
            strokeWidth="2.5"
            className="flow-line"
            markerEnd="url(#arrow-green)"
          />
          <circle r="4.5" fill={GREEN}>
            <animateMotion path="M 310 268 L 210 268 Q 170 268 170 308 L 170 388 Q 170 428 210 428 L 310 428" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Path 7: Validated Suite (620, 428) -> Gap Closer (740, 428) [120px Gap] */}
          <path d="M 620 428 L 740 428" fill="none" stroke={BLUE} strokeWidth="2.2" strokeDasharray="5 4" markerEnd="url(#arrow-blue)" />
          <circle r="4" fill={BLUE}>
            <animateMotion path="M 620 428 L 740 428" dur="1.2s" repeatCount="indefinite" />
          </circle>

          {/* Loop: Gap Closer (895, 466) -> In-Place Delta Patch -> Validated Suite (465, 466) */}
          <path
            d="M 895 466 Q 895 515 680 515 Q 465 515 465 466"
            fill="none"
            stroke={BLUE}
            strokeWidth="2"
            className="loop-line"
            markerEnd="url(#arrow-blue)"
          />
          <circle r="3.8" fill={BLUE}>
            <animateMotion path="M 895 466 Q 895 515 680 515 Q 465 515 465 466" dur="2.2s" repeatCount="indefinite" />
          </circle>


          {/* ================= STAGE NODES (CARDS) ================= */}

          {/* ROW 1: NODE 0 - Requirement Input */}
          <g transform="translate(40, 70)">
            <rect width="160" height="76" rx="10" fill={cardBg} stroke={cardBorder} strokeWidth="1.5" />
            <rect width="160" height="4" rx="2" fill={mutedColor} />
            <text x="80" y="28" fill={mutedColor} fontSize="10" fontWeight="500" textAnchor="middle">INPUT</text>
            <text x="80" y="46" fill={textColor} fontSize="12" fontWeight="500" textAnchor="middle">requirement.md</text>
            <text x="80" y="62" fill={mutedColor} fontSize="9.5" textAnchor="middle">Business Spec</text>
          </g>

          {/* ARTIFACT 1 LABEL (Centered in 110px gap [200, 310]) */}
          <g transform="translate(220, 88)">
            <rect width="70" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(AMBER, 0.4)} strokeWidth="1" />
            <text x="35" y="12" fill={AMBER} fontSize="8.5" fontFamily="monospace" fontWeight="500" textAnchor="middle">raw spec</text>
          </g>

          {/* ROW 1: NODE 1 - Requirement Analyst */}
          <g transform="translate(310, 70)">
            <rect width="200" height="76" rx="10" fill={cardBg} stroke={AMBER} strokeWidth="1.8" />
            <rect width="200" height="4" rx="2" fill={AMBER} />
            <circle cx="28" cy="28" r="11" fill={alpha(AMBER, 0.15)} />
            <text x="28" y="32" fill={AMBER} fontSize="11" fontWeight="500" textAnchor="middle">1</text>
            <text x="50" y="32" fill={textColor} fontSize="13" fontWeight="500">Analyst Agent</text>
            <text x="50" y="47" fill={AMBER} fontSize="9.5" fontWeight="500">8 INVEST Criteria</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Scores clarity & feasibility</text>
          </g>

          {/* ARTIFACT 2 LABEL (Centered in 110px gap [510, 620]) */}
          <g transform="translate(525, 88)">
            <rect width="80" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(GREEN, 0.4)} strokeWidth="1" />
            <text x="40" y="12" fill={GREEN} fontSize="8" fontFamily="monospace" fontWeight="500" textAnchor="middle">quality.json</text>
          </g>

          {/* ROW 1: NODE 2 - Human Approval Gate */}
          <g transform="translate(620, 70)">
            <rect width="200" height="76" rx="10" fill={cardBg} stroke={GREEN} strokeWidth="1.8" />
            <rect width="200" height="4" rx="2" fill={GREEN} />
            <polygon points="28,17 38,28 28,39 18,28" fill={alpha(GREEN, 0.15)} stroke={GREEN} strokeWidth="1.2" />
            <text x="50" y="32" fill={textColor} fontSize="13" fontWeight="500">Approval Gate</text>
            <text x="50" y="47" fill={GREEN} fontSize="9.5" fontWeight="500">Human-in-the-Loop</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">AWAITING_APPROVAL</text>
          </g>

          {/* REJECT TERMINATION BOX (Cleanly situated UPWARDS at y=10) */}
          <g transform="translate(630, 10)">
            <rect width="180" height="34" rx="7" fill={isLight ? '#fbeaea' : '#2a2a2a'} stroke="#da0000" strokeWidth="1.2" strokeDasharray="3 3" />
            <text x="90" y="18" fill="#da0000" fontSize="10.5" fontWeight="500" textAnchor="middle">Rejected ➔ Run Halt</text>
            <text x="90" y="28" fill={mutedColor} fontSize="8" textAnchor="middle">Reason Logged &bull; No Tokens Wasted</text>
          </g>

          {/* ARTIFACT 3 LABEL (Centered in 110px gap [820, 930]) */}
          <g transform="translate(840, 88)">
            <rect width="70" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(RED, 0.4)} strokeWidth="1" />
            <text x="35" y="12" fill={RED} fontSize="8" fontFamily="monospace" fontWeight="500" textAnchor="middle">approved</text>
          </g>

          {/* ROW 1: NODE 3 - Test Designer */}
          <g transform="translate(930, 70)">
            <rect width="200" height="76" rx="10" fill={cardBg} stroke={RED} strokeWidth="1.8" />
            <rect width="200" height="4" rx="2" fill={RED} />
            <circle cx="28" cy="28" r="11" fill={alpha(RED, 0.15)} />
            <text x="28" y="32" fill={RED} fontSize="11" fontWeight="500" textAnchor="middle">2</text>
            <text x="50" y="32" fill={textColor} fontSize="13" fontWeight="500">Test Designer</text>
            <text x="50" y="47" fill={RED} fontSize="9.5" fontWeight="500">5-Category Matrix</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Functional to Data</text>
          </g>

          {/* DESIGN JSON ARTIFACT */}
          <g transform="translate(1190, 178)">
            <rect width="76" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(RED, 0.4)} strokeWidth="1" />
            <text x="38" y="12" fill={RED} fontSize="8" fontFamily="monospace" fontWeight="500" textAnchor="middle">design.json</text>
          </g>


          {/* ================= ROW 2 (Right to Left) ================= */}

          {/* RETRY LOOP LABEL */}
          <text x="875" y="168" fill={AMBER} fontSize="9.5" fontWeight="500" textAnchor="middle">
            ↺ Schema Retry Loop (max 2)
          </text>

          {/* ROW 2: NODE 4 - Test Generator */}
          <g transform="translate(930, 230)">
            <rect width="200" height="76" rx="10" fill={cardBg} stroke={RED} strokeWidth="1.8" />
            <rect width="200" height="4" rx="2" fill={RED} />
            <circle cx="28" cy="28" r="11" fill={alpha(RED, 0.15)} />
            <text x="28" y="32" fill={RED} fontSize="11" fontWeight="500" textAnchor="middle">3</text>
            <text x="50" y="32" fill={textColor} fontSize="13" fontWeight="500">Test Generator</text>
            <text x="50" y="47" fill={RED} fontSize="9.5" fontWeight="500">Actionable Steps</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Synthesizes TC Specs</text>
          </g>

          {/* ARTIFACT 4 LABEL (Centered in 110px gap [820, 930]) */}
          <g transform="translate(840, 248)">
            <rect width="70" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(RED, 0.4)} strokeWidth="1" />
            <text x="35" y="12" fill={RED} fontSize="7.8" fontFamily="monospace" fontWeight="500" textAnchor="middle">draft.json</text>
          </g>

          {/* ROW 2: NODE 5 - Test Reviewer */}
          <g transform="translate(620, 230)">
            <rect width="200" height="76" rx="10" fill={cardBg} stroke={RED} strokeWidth="1.8" />
            <rect width="200" height="4" rx="2" fill={RED} />
            <circle cx="28" cy="28" r="11" fill={alpha(RED, 0.15)} />
            <text x="28" y="32" fill={RED} fontSize="11" fontWeight="500" textAnchor="middle">4</text>
            <text x="50" y="32" fill={textColor} fontSize="13" fontWeight="500">Test Reviewer</text>
            <text x="50" y="47" fill={RED} fontSize="9.5" fontWeight="500">Independent Critic</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Validates JSON Schema</text>
          </g>

          {/* ARTIFACT 5 LABEL (Centered in 110px gap [510, 620]) */}
          <g transform="translate(530, 248)">
            <rect width="70" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(BLUE, 0.4)} strokeWidth="1" />
            <text x="35" y="12" fill={BLUE} fontSize="7.8" fontFamily="monospace" fontWeight="500" textAnchor="middle">cases.json</text>
          </g>

          {/* ROW 2: NODE 6 - Test Evaluator */}
          <g transform="translate(310, 230)">
            <rect width="200" height="76" rx="10" fill={cardBg} stroke={BLUE} strokeWidth="1.8" />
            <rect width="200" height="4" rx="2" fill={BLUE} />
            <circle cx="28" cy="28" r="11" fill={alpha(BLUE, 0.15)} />
            <text x="28" y="32" fill={BLUE} fontSize="11" fontWeight="500" textAnchor="middle">5</text>
            <text x="50" y="32" fill={textColor} fontSize="13" fontWeight="500">Test Evaluator</text>
            <text x="50" y="47" fill={BLUE} fontSize="9.5" fontWeight="500">5-D RQS Scoring</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Evaluates suite quality</text>
          </g>

          {/* EVALUATION JSON ARTIFACT */}
          <g transform="translate(180, 338)">
            <rect width="84" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(GREEN, 0.4)} strokeWidth="1" />
            <text x="42" y="12" fill={GREEN} fontSize="7.5" fontFamily="monospace" fontWeight="500" textAnchor="middle">evaluation.json</text>
          </g>


          {/* ================= ROW 3 (Left to Right) ================= */}

          {/* ROW 3: NODE 7 - Validated Test Suite */}
          <g transform="translate(310, 390)">
            <rect width="310" height="76" rx="10" fill={isLight ? '#f4f3ee' : '#2a2a2a'} stroke={GREEN} strokeWidth="2" />
            <rect width="310" height="4" rx="2" fill={GREEN} />
            <circle cx="28" cy="28" r="11" fill={GREEN} />
            <path d="M 23 28 L 27 32 L 34 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
            <text x="52" y="32" fill={textColor} fontSize="13.5" fontWeight="500">Validated Test Suite</text>
            <text x="52" y="47" fill={GREEN} fontSize="10" fontWeight="500">Production Ready Suite</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Strict schema &bull; 100% Traceability</text>
          </g>

          {/* ARTIFACT 6 LABEL (Centered in 120px gap [620, 740]) */}
          <g transform="translate(640, 418)">
            <rect width="80" height="18" rx="4" fill={isLight ? '#f4f3ee' : '#1c1c1c'} stroke={alpha(BLUE, 0.4)} strokeWidth="1" />
            <text x="40" y="12" fill={BLUE} fontSize="7.8" fontFamily="monospace" fontWeight="500" textAnchor="middle">on reprocess</text>
          </g>

          {/* ROW 3: NODE 8 - Gap Closer */}
          <g transform="translate(740, 390)">
            <rect width="310" height="76" rx="10" fill={cardBg} stroke={BLUE} strokeWidth="1.8" strokeDasharray="4 3" />
            <rect width="310" height="4" rx="2" fill={BLUE} />
            <circle cx="28" cy="28" r="11" fill={alpha(BLUE, 0.15)} />
            <text x="28" y="33" fill={BLUE} fontSize="12" fontWeight="500" textAnchor="middle">↺</text>
            <text x="52" y="32" fill={BLUE} fontSize="13.5" fontWeight="500">Gap Closer (Reprocess)</text>
            <text x="52" y="47" fill={mutedColor} fontSize="9.5">Non-destructive healing</text>
            <text x="20" y="65" fill={mutedColor} fontSize="9.5">Amends suite in-place without wiping</text>
          </g>

          {/* REPROCESS LOOP LABEL */}
          <text x="680" y="534" fill={BLUE} fontSize="9.5" fontWeight="500" textAnchor="middle">
            ↺ In-Place Delta Reprocess (Preserves Passing Cases)
          </text>
        </Box>
    </Box>
  );
}

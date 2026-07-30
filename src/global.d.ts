import React from 'react';
declare module 'react' {
  interface CSSProperties {
    justifyBetween?: string | boolean;
    spaceY?: string | number;
  }
}
declare global {
  var AlertTriangle: any;
}

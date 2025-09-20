// types/qr-scanner.d.ts
declare module "@yudiel/react-qr-scanner" {
    import * as React from "react";
  
    export interface QrScannerProps {
      onDecode?: (result: string | string[]) => void;
      onError?: (error: unknown) => void;
      constraints?: MediaTrackConstraints;
      containerStyle?: React.CSSProperties;
      videoStyle?: React.CSSProperties;
    }
  
    export const QrScanner: React.FC<QrScannerProps>;
    export default QrScanner;
  }
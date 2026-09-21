import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import QRCode from "qrcode";

export interface QRCodeCanvasProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const QRCodeCanvas: React.FC<QRCodeCanvasProps> = ({
  value,
  size = 200,
  color = "#0f172a",
  backgroundColor = "#ffffff",
}) => {
  const { rects, moduleCount } = useMemo(() => {
    try {
      const qr = QRCode.create(value || " ", { errorCorrectionLevel: "M" });
      const count = qr.modules.size;
      const list: Rect[] = [];

      // Optimize rendering: combine consecutive dark modules horizontally
      for (let r = 0; r < count; r++) {
        let startCol = -1;
        for (let c = 0; c < count; c++) {
          const isDark = Boolean(qr.modules.get(r, c));
          if (isDark) {
            if (startCol === -1) {
              startCol = c;
            }
          } else {
            if (startCol !== -1) {
              list.push({
                x: startCol,
                y: r,
                width: c - startCol,
                height: 1,
              });
              startCol = -1;
            }
          }
        }
        if (startCol !== -1) {
          list.push({
            x: startCol,
            y: r,
            width: count - startCol,
            height: 1,
          });
        }
      }

      return { rects: list, moduleCount: count };
    } catch (e) {
      console.warn("Failed to generate QR modules:", e);
      return { rects: [], moduleCount: 21 };
    }
  }, [value]);

  const scale = size / (moduleCount || 21);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor,
        },
      ]}
    >
      {rects.map((rect, idx) => (
        <View
          key={idx}
          style={{
            position: "absolute",
            left: rect.x * scale,
            top: rect.y * scale,
            width: rect.width * scale,
            height: rect.height * scale,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 8,
  },
});

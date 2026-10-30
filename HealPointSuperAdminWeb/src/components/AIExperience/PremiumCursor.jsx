import { useEffect, useRef } from "react";

const PremiumCursor = () => {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  const target = useRef({ x: -120, y: -120 });
  const ring = useRef({ x: -120, y: -120 });
  const glow = useRef({ x: -120, y: -120 });

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer) return undefined;

    let frameId;
    const move = (event) => {
      target.current.x = event.clientX;
      target.current.y = event.clientY;
      dotRef.current?.classList.add("is-visible");
      ringRef.current?.classList.add("is-visible");
      glowRef.current?.classList.add("is-visible");
    };

    const animate = () => {
      ring.current.x += (target.current.x - ring.current.x) * 0.22;
      ring.current.y += (target.current.y - ring.current.y) * 0.22;
      glow.current.x += (target.current.x - glow.current.x) * 0.1;
      glow.current.y += (target.current.y - glow.current.y) * 0.1;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${target.current.x}px, ${target.current.y}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${glow.current.x}px, ${glow.current.y}px, 0)`;
      }

      frameId = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", move, { passive: true });
    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="premium-cursor" aria-hidden="true">
      <span className="premium-cursor-glow" ref={glowRef} />
      <span className="premium-cursor-ring" ref={ringRef} />
      <span className="premium-cursor-dot" ref={dotRef} />
    </div>
  );
};

export default PremiumCursor;

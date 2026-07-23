"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Bloco de assinatura desenhada. Guarda o traço como data URI PNG num input
 * hidden (name), incluído no submit do formulário. Assinatura é opcional.
 */
export function SignaturePad({
  name,
  defaultValue = "",
  label,
}: {
  name: string;
  defaultValue?: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d1f20";
    if (defaultValue) {
      const img = new window.Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = defaultValue;
    }
  }, [defaultValue]);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = ponto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = ponto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function terminar() {
    if (!drawing.current) return;
    drawing.current = false;
    setValue(canvasRef.current!.toDataURL("image/png"));
  }

  function limpar() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setValue("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={limpar}>
          Limpar
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={140}
        className="h-[110px] w-full touch-none border border-border bg-background"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
      />
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}

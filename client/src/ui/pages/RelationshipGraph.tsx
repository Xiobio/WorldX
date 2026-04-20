import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Network, type Node } from "vis-network";
import { DataSet } from "vis-data";
import { apiClient } from "../services/api-client";
import type { GraphData } from "../../types/api";
import { CHARACTER_COLORS } from "../../config/game-config";

const LABEL_COLORS: Record<string, string> = {
  friend: "#00b894",
  close_friend: "#00cec9",
  rival: "#d63031",
  neutral: "#636e72",
  romantic: "#e84393",
  mentor: "#fdcb6e",
};

function formatGeneratedAt(value: GraphData["generatedAt"]): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  const hour = Math.floor(value.tick / 2);
  const minute = value.tick % 2 === 0 ? "00" : "30";
  return `Day ${value.day} ${hour.toString().padStart(2, "0")}:${minute}`;
}

export function RelationshipGraph() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generatedAtLabel = formatGeneratedAt(data?.generatedAt);

  useEffect(() => {
    apiClient.getGraph().then(setData).catch((err) => {
      console.warn("[RelationshipGraph] Failed to load graph:", err);
      setError(t("graph.loadError"));
    });
  }, [t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate("/", { replace: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    try {
      const nodes = new DataSet<Node>(
        data.nodes.map((n) => {
          const nameHash = n.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const colorVal = CHARACTER_COLORS[nameHash % CHARACTER_COLORS.length];
          return {
            id: n.id,
            label: n.name,
            color: {
              background: `#${colorVal.toString(16).padStart(6, "0")}`,
              border: "#ffffff44",
              highlight: { background: "#fff", border: "#fff" },
            },
            font: { color: "#ffffff", size: 14 },
            shape: "box",
            margin: { top: 10, bottom: 10, left: 15, right: 15 },
            borderWidth: 1,
            shadow: { enabled: true, color: "rgba(0,0,0,0.4)", size: 10, x: 0, y: 4 },
            shapeProperties: { borderRadius: 8 },
          };
        })
      );

      const edges = new DataSet(
        data.edges.map((e, i) => ({
          id: `e${i}`,
          from: e.source,
          to: e.target,
          label: e.label,
          color: {
            color: LABEL_COLORS[e.label] || "#636e72",
            opacity: 0.6,
          },
          width: Math.max(1, e.strength * 5),
          font: { size: 9, color: "#888", strokeWidth: 0 },
        }))
      );

      networkRef.current = new Network(containerRef.current, { nodes, edges }, {
        physics: {
          forceAtlas2Based: { gravitationalConstant: -40, springLength: 120 },
          solver: "forceAtlas2Based",
          stabilization: { iterations: 100 },
        },
        interaction: { hover: true, tooltipDelay: 200 },
      });
    } catch (err) {
      console.warn("[RelationshipGraph] vis-network error:", err);
      setError(t("graph.renderError"));
    }

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [data]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(26, 26, 46, 0.96)",
          pointerEvents: "auto",
          zIndex: 1200,
        }}
      >
        {error ? (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "#888",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        )}
      </div>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          zIndex: 1300,
          pointerEvents: "none",
        }}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => navigate("/", { replace: true })}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#e0e0e0",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
            pointerEvents: "auto",
          }}
        >
          {t("graph.backToWorld")}
        </button>
        <h2
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#e0e0e0",
            fontSize: 16,
            margin: 0,
            pointerEvents: "none",
          }}
        >
          {t("graph.title")}
          {generatedAtLabel && (
            <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>
              {generatedAtLabel}
            </span>
          )}
        </h2>
      </div>
    </>
  );
}

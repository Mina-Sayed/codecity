"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CityModel } from "@codecity/city-layout";
import type { Finding } from "@codecity/graph-core";
import type { GitHubAnalysisProgress } from "@codecity/repository-ingestion";
import { parseAnalysisEventLine } from "../../lib/analysis-events";
import { WorkspaceShell } from "./workspace-shell";

type Status = "idle" | "running" | "ready" | "error";

interface AnalysisResult {
  model: CityModel;
  findings: Finding[];
}

const ANALYSIS_STAGES = [
  ["validating_repository", "Validate repository"],
  ["fetching_metadata", "Resolve repository"],
  ["downloading_archive", "Download source"],
  ["extracting_archive", "Open source safely"],
  ["analyzing_sources", "Read architecture"],
  ["applying_rules", "Surface hotspots"],
] as const;

function isGitHubRepositoryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "github.com" && parts.length === 2;
  } catch {
    return false;
  }
}

export function RepositoryExperience() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<GitHubAnalysisProgress | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function cancelAnalysis() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("idle");
    setProgress(null);
    setError(null);
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = repositoryUrl.trim();
    if (!url) return;
    if (!isGitHubRepositoryUrl(url)) {
      setStatus("error");
      setError("Enter a standard GitHub repository URL, for example https://github.com/owner/repository.");
      setProgress(null);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus("running");
    setProgress({ stage: "validating_repository", message: "Validating GitHub repository URL." });
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: url }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message ?? `Analysis request failed with status ${response.status}.`);
      }
      if (!response.body) throw new Error("Analysis response did not include a stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resolved = false;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const message = parseAnalysisEventLine(line);
          if (message.type === "progress") {
            setProgress(message.progress);
          } else if (message.type === "result") {
            setResult({ model: message.model, findings: message.findings });
            setStatus("ready");
            resolved = true;
          } else {
            throw new Error(message.message);
          }
        }
        if (done) break;
      }

      if (!resolved) throw new Error("Analysis finished without returning a city model.");
    } catch (reason) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "CodeCity could not analyze this repository.");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  if (status === "ready" && result) {
    return (
      <div className="repository-result">
        <button
          className="analyze-another"
          type="button"
          onClick={() => {
            setStatus("idle");
            setResult(null);
            setProgress(null);
          }}
        >
          Analyze another repo
        </button>
        <WorkspaceShell model={result.model} findings={result.findings} />
      </div>
    );
  }

  return (
    <main className="landing-shell">
      <section className="landing-card">
        <div className="landing-intro">
          <div className="landing-kicker"><span className="kicker-dot" /> CODECITY / FIELD ATLAS</div>
          <h1>See the shape of your codebase.</h1>
          <p className="landing-copy">
            Paste a public GitHub repository. CodeCity turns its JavaScript and TypeScript architecture into a map you can inspect, search, and explore.
          </p>
          <form className="repo-form" onSubmit={analyze} noValidate>
            <label htmlFor="repository-url">Public GitHub repository</label>
            <div className="repo-form-row">
              <input
                id="repository-url"
                name="repositoryUrl"
                type="url"
                inputMode="url"
                autoComplete="url"
                required
                disabled={status === "running"}
                placeholder="https://github.com/owner/repository"
                value={repositoryUrl}
                aria-invalid={status === "error" ? true : undefined}
                aria-describedby={status === "error" ? "repository-url-error" : undefined}
                onChange={(event) => {
                  setRepositoryUrl(event.target.value);
                  if (status === "error") setStatus("idle");
                }}
              />
              <button type="submit" disabled={status === "running" || !repositoryUrl.trim()}>
                {status === "running" ? "Reading…" : "Build my city"}
              </button>
            </div>
          </form>
          <div className="landing-notes" aria-label="Analysis guarantees">
            <span><b>01</b> Public repos only</span>
            <span><b>02</b> No install</span>
            <span><b>03</b> No code execution</span>
          </div>
        </div>

        <aside className="landing-preview" aria-label="CodeCity preview">
          <div className="preview-topline"><span>LIVE ARCHITECTURE MAP</span><span className="preview-status"><span className="status-dot" /> READY</span></div>
          <div className="preview-map" aria-hidden="true">
            <span className="map-line map-line-one" />
            <span className="map-line map-line-two" />
            <span className="map-line map-line-three" />
            <span className="map-node map-node-one" />
            <span className="map-node map-node-two" />
            <span className="map-node map-node-three" />
            <span className="map-node map-node-four" />
            <span className="map-stack map-stack-one" />
            <span className="map-stack map-stack-two" />
            <span className="map-stack map-stack-three" />
          </div>
          <div className="preview-caption">
            <div><span className="eyebrow">FROM SOURCE TO CITY</span><strong>Trace the systems that matter.</strong></div>
            <span className="preview-coordinate">X 04 / Z 12</span>
          </div>
        </aside>

        {status === "running" && progress ? (
          <div className="analysis-progress" role="status" aria-live="polite">
            <div className="analysis-progress-header">
              <div><span className="eyebrow">ANALYSIS IN FLIGHT</span><strong>{progress.message}</strong></div>
              <button className="cancel-analysis" type="button" onClick={cancelAnalysis}>Cancel</button>
            </div>
            <ol className="analysis-stages">
              {ANALYSIS_STAGES.map(([stage, label], index) => {
                const currentIndex = ANALYSIS_STAGES.findIndex(([key]) => key === progress.stage);
                const state = index < currentIndex ? "complete" : index === currentIndex ? "active" : "upcoming";
                return <li className={`analysis-stage ${state}`} key={stage}><span className="stage-marker" />{label}</li>;
              })}
            </ol>
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="analysis-error" role="alert">
            <strong>Analysis failed</strong>
            <p id="repository-url-error">{error}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

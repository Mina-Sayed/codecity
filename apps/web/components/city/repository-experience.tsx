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
        <p className="eyebrow">CodeCity / GitHub analysis</p>
        <h1>Walk inside your codebase.</h1>
        <p className="landing-copy">
          Paste a public GitHub repository. CodeCity reads JavaScript and TypeScript, builds the dependency graph,
          flags engineering hotspots, then turns the result into an interactive 3D city.
        </p>
        <form className="repo-form" onSubmit={analyze}>
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
              onChange={(event) => setRepositoryUrl(event.target.value)}
            />
            <button type="submit" disabled={status === "running" || !repositoryUrl.trim()}>
              {status === "running" ? "Analyzing…" : "Build my city"}
            </button>
          </div>
        </form>

        {status === "running" && progress ? (
          <div className="analysis-progress" role="status" aria-live="polite">
            <span className="progress-pulse" aria-hidden="true" />
            <div className="analysis-progress-copy">
              <strong>{progress.stage.replaceAll("_", " ")}</strong>
              <p>{progress.message}</p>
            </div>
            <button className="cancel-analysis" type="button" onClick={cancelAnalysis}>Cancel</button>
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="analysis-error" role="alert">
            <strong>Analysis failed</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <div className="landing-notes">
          <span>Public repositories only</span>
          <span>No dependency installation</span>
          <span>No repository code execution</span>
        </div>
      </section>
    </main>
  );
}

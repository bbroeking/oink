"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rosie } from "../svg";

export default function Login() {
  const [pw, setPw] = useState("");
  const [showErr, setShowErr] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setShowErr(true);
      setShakeKey((k) => k + 1); // restart the shake animation
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <Rosie size={78} />
        <div className="kicker">★ internal</div>
        <h1>Analytics</h1>
        <div className="sub">Tickle the Pig — for your eyes only</div>

        <form onSubmit={submit} autoComplete="off">
          <input
            className="pw"
            type="password"
            placeholder="Password"
            aria-label="Password"
            value={pw}
            autoFocus
            onChange={(e) => {
              setPw(e.target.value);
              setShowErr(false);
            }}
          />
          <button className="enter" type="submit" disabled={busy}>
            {busy ? "…" : "Enter"}
          </button>
          <div className={"login-err" + (showErr ? " show" : "")} role="alert">
            <span className="x" key={shakeKey}>
              Wrong password.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

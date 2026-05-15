"use client";

import { Alert } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { loginWithPassword } from "@/lib/kagu/api";

interface LoginFormProps {
  authMessage?: string;
  nextPath?: string;
}

export function LoginForm({ authMessage, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await loginWithPassword({ password, username });
      const destination = nextPath || response.redirectTo || "/dashboard";

      router.push(destination);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Giris istegi tamamlanamadi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
        Kullanici Girisi
      </div>
      <form className="grid gap-4 p-4" onSubmit={handleSubmit}>
        <div className="text-xs leading-5 text-slate-600">
          Yetkili kullanici bilgilerinizle oturum acin. Bu ekran web paneli ve
          ayarlar yonetimi icin ortak giris noktasi olarak calisir.
        </div>
        {authMessage ? (
          <Alert showIcon title={authMessage} type="warning" />
        ) : null}
        {errorMessage ? (
          <Alert showIcon title={errorMessage} type="error" />
        ) : null}
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Kullanici Adi</span>
          <input
            autoComplete="username"
            className="border border-[var(--line)] bg-[#f9fbfd] px-3 py-2 outline-none focus:border-[var(--accent)]"
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="kullanici.adi"
            required
            value={username}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Sifre</span>
          <input
            autoComplete="current-password"
            className="border border-[var(--line)] bg-[#f9fbfd] px-3 py-2 outline-none focus:border-[var(--accent)]"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sifrenizi girin"
            required
            type="password"
            value={password}
          />
        </label>
        <div className="border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-xs leading-5 text-slate-700">
          Giris sonrasi moduller, kullanici yetkisi ve rol atamalarina gore
          filtrelenir.
        </div>
        <button
          className="toolbar-button mt-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Giris Yapiliyor" : "Giris Yap"}
        </button>
      </form>
    </div>
  );
}

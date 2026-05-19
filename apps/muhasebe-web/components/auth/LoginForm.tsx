"use client";

import { Alert } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { loginWithPassword } from "@/lib/kagu/api";

interface LoginFormProps {
  nextPath?: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
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
        error instanceof Error ? error.message : "Giriş isteği tamamlanamadı.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      {errorMessage ? (
        <Alert showIcon title={errorMessage} type="error" />
      ) : null}
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Kullanıcı Adı</span>
        <input
          autoComplete="username"
          className="border border-[var(--line)] bg-[#f9fbfd] px-3 py-2 outline-none focus:border-[var(--accent)]"
          name="username"
          onChange={(event) => setUsername(event.target.value)}
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
          required
          type="password"
          value={password}
        />
      </label>
      <button
        className="toolbar-button mt-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        Giriş Yap
      </button>
    </form>
  );
}

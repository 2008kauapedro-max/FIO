"use client";

import React, { useEffect, useState } from "react";
import {
  LOCALE_OPTIONS,
  STORAGE_KEYS,
  type SupportedCurrency,
  type SupportedLocale,
} from "../i18n/config";
import { useI18n } from "../i18n/I18nProvider";

type PersistPreferencesInput = {
  preferred_locale: SupportedLocale;
  preferred_region: string;
  preferred_currency: SupportedCurrency;
};

type LanguageGateProps = {
  children: React.ReactNode;
  onPersistPreferences?: (
    preferences: PersistPreferencesInput
  ) => Promise<void> | void;
};

export function LanguageGate({
  children,
  onPersistPreferences,
}: LanguageGateProps) {
  const {
    locale,
    region,
    currency,
    ready,
    setLocale,
    t,
  } = useI18n();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;

    const done =
      window.localStorage.getItem(STORAGE_KEYS.languageGateDone) === "1";

    setOpen(!done);
  }, [ready]);

  async function finishGate() {
    try {
      setSaving(true);

      if (onPersistPreferences) {
        await onPersistPreferences({
          preferred_locale: locale,
          preferred_region: region,
          preferred_currency: currency,
        });
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.languageGateDone, "1");
      }

      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function skipGate() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.languageGateDone, "1");
    }
    setOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      {children}

      {open ? (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fio-language-title"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-950 sm:p-6">
            <div className="mb-5">
              <h2
                id="fio-language-title"
                className="text-xl font-semibold text-zinc-950 dark:text-white"
              >
                {t("language.title")}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("language.subtitle")}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {LOCALE_OPTIONS.map((option) => {
                const active = option.value === locale;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      // IMPORTANTE:
                      // a tradução muda AQUI, imediatamente no clique.
                      setLocale(option.value, {
                        persistLocal: true,
                        updateDefaults: true,
                      });
                    }}
                    className={[
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                        : "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <span className="text-2xl" aria-hidden>
                      {option.flag}
                    </span>
                    <span className="font-medium">{option.nativeLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={skipGate}
                disabled={saving}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {t("common.skip")}
              </button>

              <button
                type="button"
                onClick={finishGate}
                disabled={saving}
                className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
              >
                {saving ? t("common.loading") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

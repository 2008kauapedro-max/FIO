"use client";

import React from "react";
import {
  LOCALE_OPTIONS,
  type SupportedCurrency,
  type SupportedLocale,
} from "../i18n/config";
import { useI18n } from "../i18n/I18nProvider";

type LanguageSettingsProps = {
  onSave?: (preferences: {
    preferred_locale: SupportedLocale;
    preferred_region: string;
    preferred_currency: SupportedCurrency;
  }) => Promise<void> | void;
};

export function LanguageSettings({ onSave }: LanguageSettingsProps) {
  const {
    locale,
    region,
    currency,
    setLocale,
    setRegion,
    setCurrency,
    t,
  } = useI18n();

  async function handleSave() {
    await onSave?.({
      preferred_locale: locale,
      preferred_region: region,
      preferred_currency: currency,
    });
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("language.region")}</h2>
        <p className="text-sm text-zinc-500">{t("language.subtitle")}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {LOCALE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              setLocale(option.value, {
                persistLocal: true,
                updateDefaults: true,
              })
            }
            className={[
              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left",
              option.value === locale
                ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                : "border-zinc-200 dark:border-zinc-800",
            ].join(" ")}
          >
            <span className="text-xl">{option.flag}</span>
            <span>{option.nativeLabel}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">{t("language.regionLabel")}</span>
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            maxLength={2}
            className="w-full rounded-xl border px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">{t("language.currencyLabel")}</span>
          <select
            value={currency}
            onChange={(event) =>
              setCurrency(event.target.value as SupportedCurrency)
            }
            className="w-full rounded-xl border px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="MXN">MXN</option>
            <option value="ARS">ARS</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950"
        >
          {t("common.save")}
        </button>
      </div>
    </section>
  );
}

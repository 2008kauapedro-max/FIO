import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportedCurrency, SupportedLocale } from "./config";
import { isSupportedLocale } from "./config";

export type LocalePreferences = {
  preferred_locale: SupportedLocale;
  preferred_region: string;
  preferred_currency: SupportedCurrency;
};

export async function loadLocalePreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<LocalePreferences | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_locale, preferred_region, preferred_currency")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const preferredLocale = isSupportedLocale(data.preferred_locale)
    ? data.preferred_locale
    : "pt-BR";

  return {
    preferred_locale: preferredLocale,
    preferred_region: data.preferred_region || "BR",
    preferred_currency: (data.preferred_currency || "BRL") as SupportedCurrency,
  };
}

export async function saveLocalePreferences(
  supabase: SupabaseClient,
  userId: string,
  preferences: LocalePreferences
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_locale: preferences.preferred_locale,
      preferred_region: preferences.preferred_region,
      preferred_currency: preferences.preferred_currency,
    })
    .eq("id", userId);

  if (error) throw error;
}
